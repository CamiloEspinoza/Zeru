import { Module } from '@nestjs/common';
import { AiModule } from '../../../ai/ai.module';
import { ValidationLlmService } from './validation-llm.service';

@Module({
  imports: [AiModule],
  providers: [ValidationLlmService],
  exports: [ValidationLlmService],
})
export class ValidationLlmModule {}
