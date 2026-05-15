import { ConflictException, UnauthorizedException } from '@nestjs/common';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  UsernameExistsException,
  NotAuthorizedException,
} from '@aws-sdk/client-cognito-identity-provider';
import { mockClient } from 'aws-sdk-client-mock';
import { AppLogger } from '../../common/logging/app-logger.service';
import { AppConfigService } from '../../config/app-config.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

const cognitoMock = mockClient(CognitoIdentityProviderClient);

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let logger: jest.Mocked<AppLogger>;

  const config = {
    cognitoRegion: 'us-east-1',
    cognitoClientId: 'test-client-id',
    cognitoClientSecret: 'test-client-secret',
    cognitoUserPoolId: 'us-east-1_test',
  } as AppConfigService;

  beforeEach(() => {
    cognitoMock.reset();

    usersService = {
      findByEmail: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    logger = {
      info: jest.fn(),
      warnWithMeta: jest.fn(),
    } as unknown as jest.Mocked<AppLogger>;

    authService = new AuthService(usersService, config, logger);
  });

  it('registers a new user via Cognito and persists locally', async () => {
    cognitoMock.on(SignUpCommand).resolves({ UserSub: 'cognito-sub' });
    usersService.create.mockResolvedValue({
      email: 'user@example.com',
      toJSON: () => ({ email: 'user@example.com', name: 'User' }),
    } as any);

    const result = await authService.register({
      name: 'User',
      email: 'user@example.com',
      password: 'Secret123!',
    });

    expect(result.user).toEqual({ email: 'user@example.com', name: 'User' });
    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'user@example.com', password: '' }),
    );
  });

  it('throws ConflictException when Cognito reports duplicate email', async () => {
    cognitoMock
      .on(SignUpCommand)
      .rejects(
        new UsernameExistsException({ message: 'exists', $metadata: {} }),
      );

    await expect(
      authService.register({
        name: 'User',
        email: 'dup@example.com',
        password: 'Secret123!',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns Cognito tokens on successful login', async () => {
    cognitoMock.on(InitiateAuthCommand).resolves({
      AuthenticationResult: {
        AccessToken: 'access',
        IdToken: 'id',
        RefreshToken: 'refresh',
      },
    });
    usersService.findByEmail.mockResolvedValue({
      email: 'user@example.com',
    } as any);

    const result = await authService.login({
      email: 'user@example.com',
      password: 'Secret123!',
    });

    expect(result.accessToken).toBe('access');
    expect(result.idToken).toBe('id');
    expect(result.refreshToken).toBe('refresh');
  });

  it('throws UnauthorizedException on bad credentials', async () => {
    cognitoMock
      .on(InitiateAuthCommand)
      .rejects(new NotAuthorizedException({ message: 'bad', $metadata: {} }));

    await expect(
      authService.login({ email: 'user@example.com', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
