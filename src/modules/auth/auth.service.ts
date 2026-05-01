import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AppLogger } from '../../common/logging/app-logger.service';
import { AppConfigService } from '../../config/app-config.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly appConfigService: AppConfigService,
    private readonly logger: AppLogger,
  ) {}

  async register(dto: RegisterDto) {
    this.logger.info(
      'Attempting user registration',
      { email: dto.email.toLowerCase() },
      AuthService.name,
    );

    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      this.logger.warnWithMeta(
        'Registration blocked because email already exists',
        { email: dto.email.toLowerCase() },
        AuthService.name,
      );
      throw new ConflictException('User with this email already exists');
    }

    const password = await bcrypt.hash(
      dto.password,
      this.appConfigService.bcryptRounds,
    );

    const user = await this.usersService.create({
      name: dto.name,
      email: dto.email.toLowerCase(),
      password,
      walletBalance: dto.walletBalance ?? 0,
    });

    const token = await this.signToken(user.id, user.email, user.status);
    this.logger.info(
      'User registration completed',
      { userId: user.id, email: user.email },
      AuthService.name,
    );
    return { user: user.toJSON(), accessToken: token };
  }

  async login(dto: LoginDto) {
    this.logger.info(
      'Attempting user login',
      { email: dto.email.toLowerCase() },
      AuthService.name,
    );
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      this.logger.warnWithMeta(
        'Login failed because user was not found',
        { email: dto.email.toLowerCase() },
        AuthService.name,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches) {
      this.logger.warnWithMeta(
        'Login failed because password validation failed',
        { userId: user._id.toString(), email: user.email },
        AuthService.name,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = await this.signToken(
      user._id.toString(),
      user.email,
      user.status,
    );

    const { password, ...safeUser } = user;
    this.logger.info(
      'User login completed',
      { userId: user._id.toString(), email: user.email },
      AuthService.name,
    );
    return { user: safeUser, accessToken: token };
  }

  private async signToken(sub: string, email: string, status: string) {
    return this.jwtService.signAsync({ sub, email, status });
  }
}
