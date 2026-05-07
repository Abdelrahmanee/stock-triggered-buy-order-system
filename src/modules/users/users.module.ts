import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { S3Provider } from '../../common/providers/s3.provider';
import { AppConfigModule } from '../../config/app-config.module';
import { WalletModule } from '../wallet/wallet.module';
import { User, UserSchema } from './schemas/user.schema';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    forwardRef(() => WalletModule),
    AppConfigModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, S3Provider],
  exports: [UsersService, MongooseModule],
})
export class UsersModule {}
