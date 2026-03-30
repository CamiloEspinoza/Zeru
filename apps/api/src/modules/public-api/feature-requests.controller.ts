import { Controller, Post, Body, Req, HttpCode } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Request } from 'express';

@Controller('public/feature-requests')
export class FeatureRequestsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @HttpCode(201)
  async create(
    @Body() body: { text: string; email?: string },
    @Req() req: Request,
  ) {
    if (!body.text || body.text.trim().length < 3) {
      return { error: 'La propuesta debe tener al menos 3 caracteres' };
    }

    if (body.text.length > 1000) {
      return { error: 'La propuesta no puede exceder 1000 caracteres' };
    }

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.ip ??
      null;

    await this.prisma.featureRequest.create({
      data: {
        text: body.text.trim(),
        email: body.email?.trim() || null,
        ip,
      },
    });

    return { success: true, message: 'Propuesta recibida' };
  }
}
