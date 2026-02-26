import { Module } from '@nestjs/common';
import { ZeruMcpController } from './mcp.controller';
import { ZeruMcpService } from './mcp.service';

@Module({
  controllers: [ZeruMcpController],
  providers: [ZeruMcpService],
})
export class ZeruMcpModule {}
