import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AppConfigService } from '../../config/app-config.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { RequestContextService } from '../logging/request-context.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly appConfigService: AppConfigService,
    private readonly requestContextService: RequestContextService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.slice(7);

    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.appConfigService.jwtSecret,
      });
      request.user = payload;
      this.requestContextService.setUserId(payload.sub);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
