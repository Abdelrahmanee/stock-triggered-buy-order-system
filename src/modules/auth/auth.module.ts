import { Module } from '@nestjs/common';
import { AppConfigModule } from '../../config/app-config.module';
import { LoggingModule } from '../../common/logging/logging.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [UsersModule, AppConfigModule, LoggingModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
