import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { WalletLedger, WalletLedgerSchema } from './schemas/wallet-ledger.schema';
import { WalletService } from './wallet.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WalletLedger.name, schema: WalletLedgerSchema },
    ]),
    forwardRef(() => UsersModule),
  ],
  providers: [WalletService],
  exports: [WalletService, MongooseModule],
})
export class WalletModule {}
