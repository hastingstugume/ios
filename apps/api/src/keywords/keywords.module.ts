import { Module } from '@nestjs/common';
import { KeywordsService } from './keywords.service';
import { KeywordsController } from './keywords.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [KeywordsService],
  controllers: [KeywordsController],
  exports: [KeywordsService],
})
export class KeywordsModule {}
