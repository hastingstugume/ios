import { Module } from '@nestjs/common';
import { SignalsService } from './signals.service';
import { SignalsController } from './signals.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [SignalsService],
  controllers: [SignalsController],
  exports: [SignalsService],
})
export class SignalsModule {}
