import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
  ConfirmSignUpCommand,
  UsernameExistsException,
  NotAuthorizedException,
  UserNotConfirmedException,
  CodeMismatchException,
  ExpiredCodeException,
} from '@aws-sdk/client-cognito-identity-provider';
import { createHmac } from 'crypto';
import { AppLogger } from '../../common/logging/app-logger.service';
import { AppConfigService } from '../../config/app-config.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

@Injectable()
export class AuthService {
  private readonly cognito: CognitoIdentityProviderClient;

  constructor(
    private readonly usersService: UsersService,
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
  ) {
    this.cognito = new CognitoIdentityProviderClient({ region: config.cognitoRegion });
  }

  private computeSecretHash(username: string): string {
    return createHmac('sha256', this.config.cognitoClientSecret)
      .update(username + this.config.cognitoClientId)
      .digest('base64');
  }

  async register(dto: RegisterDto) {
    this.logger.info('Attempting user registration', { email: dto.email }, AuthService.name);

    try {
      await this.cognito.send(
        new SignUpCommand({
          ClientId: this.config.cognitoClientId,
          SecretHash: this.computeSecretHash(dto.email.toLowerCase()),
          Username: dto.email.toLowerCase(),
          Password: dto.password,
          UserAttributes: [{ Name: 'email', Value: dto.email.toLowerCase() }],
        }),
      );
    } catch (err) {
      if (err instanceof UsernameExistsException) {
        throw new ConflictException('User with this email already exists');
      }
      throw err;
    }

    const user = await this.usersService.create({
      name: dto.name,
      email: dto.email.toLowerCase(),
      password: '',
      walletBalance: dto.walletBalance ?? 0,
    });

    this.logger.info('User registration completed', { email: user.email }, AuthService.name);
    return { user: user.toJSON() };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    try {
      await this.cognito.send(
        new ConfirmSignUpCommand({
          ClientId: this.config.cognitoClientId,
          SecretHash: this.computeSecretHash(dto.email.toLowerCase()),
          Username: dto.email.toLowerCase(),
          ConfirmationCode: dto.code,
        }),
      );
    } catch (err) {
      if (err instanceof CodeMismatchException) throw new BadRequestException('Invalid verification code');
      if (err instanceof ExpiredCodeException) throw new BadRequestException('Verification code has expired');
      throw err;
    }
    return { message: 'Email verified successfully' };
  }

  async refreshToken(dto: RefreshTokenDto) {
    try {
      const result = await this.cognito.send(
        new InitiateAuthCommand({
          AuthFlow: 'REFRESH_TOKEN_AUTH',
          ClientId: this.config.cognitoClientId,
          AuthParameters: {
            REFRESH_TOKEN: dto.refreshToken,
            SECRET_HASH: this.computeSecretHash(dto.email.toLowerCase()),
          },
        }),
      );
      const auth = result.AuthenticationResult!;
      return { accessToken: auth.AccessToken!, idToken: auth.IdToken! };
    } catch (err) {
      if (err instanceof NotAuthorizedException) throw new UnauthorizedException('Invalid or expired refresh token');
      throw err;
    }
  }

  async login(dto: LoginDto) {
    this.logger.info('Attempting user login', { email: dto.email }, AuthService.name);

    let tokens: { accessToken: string; idToken: string; refreshToken: string };
    try {
      const result = await this.cognito.send(
        new InitiateAuthCommand({
          AuthFlow: 'USER_PASSWORD_AUTH',
          ClientId: this.config.cognitoClientId,
          AuthParameters: {
            USERNAME: dto.email.toLowerCase(),
            PASSWORD: dto.password,
            SECRET_HASH: this.computeSecretHash(dto.email.toLowerCase()),
          },
        }),
      );
      const auth = result.AuthenticationResult!;
      tokens = {
        accessToken: auth.AccessToken!,
        idToken: auth.IdToken!,
        refreshToken: auth.RefreshToken!,
      };
    } catch (err) {
      if (err instanceof NotAuthorizedException || err instanceof UserNotConfirmedException) {
        throw new UnauthorizedException('Invalid credentials');
      }
      throw err;
    }

    const user = await this.usersService.findByEmail(dto.email);
    this.logger.info('User login completed', { email: dto.email }, AuthService.name);
    return { user, ...tokens };
  }
}
