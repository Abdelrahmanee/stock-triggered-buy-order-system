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
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
  AdminInitiateAuthCommand,
  RespondToAuthChallengeCommand,
  UsernameExistsException,
  NotAuthorizedException,
  UserNotConfirmedException,
  CodeMismatchException,
  ExpiredCodeException,
} from '@aws-sdk/client-cognito-identity-provider';
import { createHmac } from 'crypto';
import { AppLogger } from '../../common/logging/app-logger.service';
import { AppConfigService } from '../../config/app-config.service';
import { UserRole } from '../../common/constants/user-role.constant';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { InviteAdminDto } from './dto/invite-admin.dto';
import { AcceptAdminInviteDto } from './dto/accept-admin-invite.dto';

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

    let cognitoSub: string;
    try {
      const result = await this.cognito.send(
        new SignUpCommand({
          ClientId: this.config.cognitoClientId,
          SecretHash: this.computeSecretHash(dto.email.toLowerCase()),
          Username: dto.email.toLowerCase(),
          Password: dto.password,
          UserAttributes: [{ Name: 'email', Value: dto.email.toLowerCase() }],
        }),
      );
      cognitoSub = result.UserSub!;
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
      cognitoSub,
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

  async inviteAdmin(dto: InviteAdminDto) {
    this.logger.info('Inviting admin user', { email: dto.email }, AuthService.name);

    try {
      await this.cognito.send(
        new AdminCreateUserCommand({
          UserPoolId: this.config.cognitoUserPoolId,
          Username: dto.email.toLowerCase(),
          UserAttributes: [
            { Name: 'email', Value: dto.email.toLowerCase() },
            { Name: 'name', Value: dto.name },
            { Name: 'email_verified', Value: 'true' },
          ],
          DesiredDeliveryMediums: ['EMAIL'],
        }),
      );
    } catch (err) {
      if (err instanceof UsernameExistsException) {
        throw new ConflictException('User with this email already exists');
      }
      throw err;
    }

    this.logger.info('Admin invitation sent', { email: dto.email }, AuthService.name);
    return { message: 'Invitation sent. The user will receive a temporary password by email.' };
  }

  async acceptAdminInvite(dto: AcceptAdminInviteDto) {
    const email = dto.email.toLowerCase();
    this.logger.info('Accepting admin invite', { email }, AuthService.name);

    // Initiate auth with the temporary password — Cognito will return NEW_PASSWORD_REQUIRED challenge
    const authResult = await this.cognito.send(
      new AdminInitiateAuthCommand({
        UserPoolId: this.config.cognitoUserPoolId,
        ClientId: this.config.cognitoClientId,
        AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
        AuthParameters: {
          USERNAME: email,
          PASSWORD: dto.temporaryPassword,
          SECRET_HASH: this.computeSecretHash(email),
        },
      }),
    );

    if (authResult.ChallengeName !== 'NEW_PASSWORD_REQUIRED') {
      throw new BadRequestException('No pending password challenge for this user');
    }

    // Respond to the challenge with the new permanent password
    const challengeResult = await this.cognito.send(
      new RespondToAuthChallengeCommand({
        ClientId: this.config.cognitoClientId,
        ChallengeName: 'NEW_PASSWORD_REQUIRED',
        Session: authResult.Session,
        ChallengeResponses: {
          USERNAME: email,
          NEW_PASSWORD: dto.newPassword,
          SECRET_HASH: this.computeSecretHash(email),
        },
      }),
    );

    // Add user to admin-group in Cognito
    await this.cognito.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: this.config.cognitoUserPoolId,
        Username: email,
        GroupName: this.config.cognitoAdminGroupName,
      }),
    );

    // Upsert local user record with admin role
    let user = await this.usersService.findByEmail(email);
    if (!user) {
      user = await this.usersService.create({ name: dto.email, email, password: '', role: UserRole.ADMIN });
    } else {
      await this.usersService.updateRole(user._id.toString(), UserRole.ADMIN);
    }

    const auth = challengeResult.AuthenticationResult!;
    this.logger.info('Admin invite accepted', { email }, AuthService.name);
    return {
      accessToken: auth.AccessToken!,
      idToken: auth.IdToken!,
      refreshToken: auth.RefreshToken!,
    };
  }
}
