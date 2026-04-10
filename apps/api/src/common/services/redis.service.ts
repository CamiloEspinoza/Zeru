import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {
  constructor(config: ConfigService) {
    const redisUrl = config.get<string>('REDIS_URL');
    super(
      redisUrl ?? {
        host: config.get<string>('REDIS_HOST', 'localhost'),
        port: config.get<number>('REDIS_PORT', 6379),
      },
      { maxRetriesPerRequest: null },
    );
  }

  async onModuleDestroy() {
    await this.quit();
  }
}
