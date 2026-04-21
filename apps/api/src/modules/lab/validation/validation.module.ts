import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { IdentityAgent } from './agents/identity.agent';
import { OriginAgent } from './agents/origin.agent';
import { TraceabilityAgent } from './agents/traceability.agent';
import { ConsolidatorService } from './services/consolidator.service';
import { AgentRunnerService } from './services/agent-runner.service';
import { ValidationSyncedListener } from './listeners/validation-synced.listener';
import { ValidationLlmModule } from './llm/validation-llm.module';

@Module({
  imports: [PrismaModule, ValidationLlmModule],
  providers: [
    IdentityAgent,
    OriginAgent,
    TraceabilityAgent,
    ConsolidatorService,
    AgentRunnerService,
    ValidationSyncedListener,
  ],
  exports: [AgentRunnerService],
})
export class ValidationModule {}
