import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AppLogger } from '../../common/logging/app-logger.service';
import { AppConfigService } from '../../config/app-config.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let appConfigService: AppConfigService;
  let logger: jest.Mocked<AppLogger>;

  beforeEach(() => {
    usersService = {
      findByEmail: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-token'),
    } as unknown as jest.Mocked<JwtService>;

    appConfigService = {
      bcryptRounds: 1,
    } as AppConfigService;

    logger = {
      info: jest.fn(),
      warnWithMeta: jest.fn(),
    } as unknown as jest.Mocked<AppLogger>;

    authService = new AuthService(
      usersService,
      jwtService,
      appConfigService,
      logger,
    );
  });

  it('registers a new user and returns a token without exposing the password', async () => {
    usersService.findByEmail.mockResolvedValue(null);
    usersService.create.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      status: 'active',
      toJSON: () => ({
        id: 'user-id',
        email: 'user@example.com',
        name: 'User',
        walletBalance: 100,
      }),
    } as any);

    const result = await authService.register({
      name: 'User',
      email: 'user@example.com',
      password: 'secret123',
      walletBalance: 100,
    });

    expect(result.accessToken).toBe('signed-token');
    expect(result.user).toEqual({
      id: 'user-id',
      email: 'user@example.com',
      name: 'User',
      walletBalance: 100,
    });

    const createInput = usersService.create.mock.calls[0][0];
    expect(await bcrypt.compare('secret123', createInput.password)).toBe(true);
  });

  it('rejects duplicate registrations', async () => {
    usersService.findByEmail.mockResolvedValue({
      _id: 'existing',
    } as any);

    await expect(
      authService.register({
        name: 'User',
        email: 'user@example.com',
        password: 'secret123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects invalid login credentials', async () => {
    usersService.findByEmail.mockResolvedValue(null);

    await expect(
      authService.login({
        email: 'missing@example.com',
        password: 'secret123',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
