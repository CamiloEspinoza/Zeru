import { Module } from '@nestjs/common';
import { ZeruMcpController } from './mcp.controller';
import { ZeruMcpService } from './mcp.service';
import { AccountingModule } from '../accounting/accounting.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';

@Module({
  imports: [AccountingModule, ApiKeysModule],
  controllers: [ZeruMcpController],
  providers: [ZeruMcpService],
})
export class ZeruMcpModule {}
