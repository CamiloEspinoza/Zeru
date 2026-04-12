import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { ServerOptions } from 'socket.io';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter> | undefined;

  constructor(
    app: INestApplication,
    private readonly config: ConfigService,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const redisUrl = this.config.get<string>('REDIS_URL');
    const redisOptions = redisUrl
      ? redisUrl
      : {
          host: this.config.get<string>('REDIS_HOST', 'localhost'),
          port: this.config.get<number>('REDIS_PORT', 6379),
        };

    const pubClient = new Redis(redisOptions as string);
    const subClient = pubClient.duplicate();

    // Wait for both clients to be ready (with timeout)
    await Promise.all([
      new Promise<void>((resolve) => {
        if (pubClient.status === 'ready') return resolve();
        pubClient.once('ready', resolve);
        setTimeout(resolve, 5000); // Don't block forever
      }),
      new Promise<void>((resolve) => {
        if (subClient.status === 'ready') return resolve();
        subClient.once('ready', resolve);
        setTimeout(resolve, 5000);
      }),
    ]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: this.config.get('CORS_ORIGIN', 'http://localhost:3027'),
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }

    return server;
  }
}
