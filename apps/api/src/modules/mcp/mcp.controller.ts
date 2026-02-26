import { Controller, Get, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { ZeruMcpService } from './mcp.service';

@Controller('mcp')
export class ZeruMcpController {
  constructor(private readonly mcpService: ZeruMcpService) {}

  @Get('sse')
  async sse(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.mcpService.handleSse(req, res);
  }

  @Post('messages')
  async messages(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.mcpService.handleMessage(req, res);
  }
}
