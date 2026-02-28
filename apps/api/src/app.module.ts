import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { AiModule } from './modules/ai/ai.module';
import { FilesModule } from './modules/files/files.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { PublicApiModule } from './modules/public-api/public-api.module';
import { ZeruMcpModule } from './modules/mcp/mcp.module';
import { EncryptionModule } from './common/services/encryption.module';
import { StorageConfigModule } from './modules/storage-config/storage-config.module';
import { TenantResolverMiddleware } from './common/middleware/tenant-resolver.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    EncryptionModule,
    PrismaModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    AccountingModule,
    AiModule,
    StorageConfigModule,
    FilesModule,
    ApiKeysModule,
    PublicApiModule,
    ZeruMcpModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantResolverMiddleware).forRoutes('*');
  }
}
