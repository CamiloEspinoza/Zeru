import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

// Constants
import {
  DTE_EMISSION_QUEUE,
  DTE_STATUS_CHECK_QUEUE,
  DTE_EXCHANGE_QUEUE,
  DTE_BULK_BOLETA_QUEUE,
  DTE_RCOF_QUEUE,
  DTE_RECEIVED_QUEUE,
  DTE_QUEUE_CONFIG,
} from './constants/queue.constants';

// Infrastructure services
import { SiiCircuitBreakerService } from './sii/sii-circuit-breaker.service';
import { DteStateMachineService } from './services/dte-state-machine.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('REDIS_URL'),
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6380),
          maxRetriesPerRequest: null,
        },
      }),
    }),
    BullModule.registerQueue(
      {
        name: DTE_EMISSION_QUEUE,
        defaultJobOptions: DTE_QUEUE_CONFIG.EMISSION,
      },
      {
        name: DTE_STATUS_CHECK_QUEUE,
        defaultJobOptions: DTE_QUEUE_CONFIG.STATUS_CHECK,
      },
      {
        name: DTE_EXCHANGE_QUEUE,
        defaultJobOptions: DTE_QUEUE_CONFIG.EXCHANGE,
      },
      {
        name: DTE_BULK_BOLETA_QUEUE,
        defaultJobOptions: DTE_QUEUE_CONFIG.BULK_BOLETA,
      },
      {
        name: DTE_RCOF_QUEUE,
        defaultJobOptions: DTE_QUEUE_CONFIG.RCOF,
      },
      {
        name: DTE_RECEIVED_QUEUE,
        defaultJobOptions: DTE_QUEUE_CONFIG.RECEIVED,
      },
    ),
  ],
  controllers: [],
  providers: [
    // Infrastructure
    SiiCircuitBreakerService,
    DteStateMachineService,
  ],
  exports: [SiiCircuitBreakerService, DteStateMachineService],
})
export class DteModule {}
