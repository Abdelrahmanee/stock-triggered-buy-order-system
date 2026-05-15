import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import * as JwksRsa from 'jwks-rsa';
import { AppConfigService } from '../../config/app-config.service';
import { UserRole } from '../constants/user-role.constant';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { RequestContextService } from '../logging/request-context.service';
import { UsersService } from '../../modules/users/users.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly jwksClient: JwksRsa.JwksClient;

  constructor(
    private readonly config: AppConfigService,
    private readonly requestContextService: RequestContextService,
    private readonly usersService: UsersService,
  ) {
    this.jwksClient = JwksRsa({
      jwksUri: `https://cognito-idp.${config.cognitoRegion}.amazonaws.com/${config.cognitoUserPoolId}/.well-known/jwks.json`,
      cache: true,
      rateLimit: true,
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.slice(7);

    try {
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || typeof decoded === 'string') throw new Error();

      const key = await this.jwksClient.getSigningKey(decoded.header.kid);
      const publicKey = key.getPublicKey();

      const payload = jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as jwt.JwtPayload;

      const cognitoSub = payload.sub!;
      const user = await this.usersService.findByCognitoSub(cognitoSub);
      if (!user) throw new UnauthorizedException('User not found');

      request.user = {
        sub: user._id.toString(),
        email: payload.email ?? payload['cognito:username'] ?? '',
        status: user.status,
        role: this.extractRole(payload),
      };
      this.requestContextService.setUserId(user._id.toString());
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractRole(payload: jwt.JwtPayload): UserRole {
    const groups: string[] = payload['cognito:groups'] ?? [];
    return groups.includes(this.config.cognitoAdminGroupName)
      ? UserRole.ADMIN
      : UserRole.USER;
  }
}
