import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { S3Provider } from '../../common/providers/s3.provider';
import { WalletService } from '../wallet/wallet.service';
import { UpdateWalletDto } from './dto/update-wallet.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly walletService: WalletService,
    private readonly s3: S3Provider,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@CurrentUser() user: JwtPayload) {
    return this.usersService.findById(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/wallet')
  async deposit(@CurrentUser() user: JwtPayload, @Body() dto: UpdateWalletDto) {
    return this.walletService.deposit(user.sub, dto.amount);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const existing = await this.usersService.findById(user.sub);
    if (existing.avatarUrl) {
      await this.s3.deleteFile(existing.avatarUrl);
    }
    const key = `avatars/${user.sub}-${Date.now()}.${file.originalname.split('.').pop()}`;
    const url = await this.s3.uploadFile(key, file.buffer, file.mimetype);
    return this.usersService.updateAvatar(user.sub, url);
  }
}
