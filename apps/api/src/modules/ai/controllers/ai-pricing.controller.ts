import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../../common/guards/super-admin.guard';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import {
  CreatePricingDto,
  UpdatePricingDto,
  RecalculateCostsDto,
  createPricingSchema,
  updatePricingSchema,
  recalculateCostsSchema,
} from '../dto';
import { AiPricingService } from '../services/ai-pricing.service';

@Controller('ai/pricing')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AiPricingController {
  constructor(private readonly pricingService: AiPricingService) {}

  @Get()
  findAll() {
    return this.pricingService.findAll();
  }

  @Get('active')
  findActive() {
    return this.pricingService.findActive();
  }

  @Post()
  create(@Body(new ZodValidationPipe(createPricingSchema)) body: CreatePricingDto) {
    return this.pricingService.create({
      ...body,
      validFrom: body.validFrom ? new Date(body.validFrom) : undefined,
    });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(updatePricingSchema)) body: UpdatePricingDto) {
    return this.pricingService.update(id, body);
  }

  @Post('recalculate')
  async recalculate(@Body(new ZodValidationPipe(recalculateCostsSchema)) body: RecalculateCostsDto) {
    const count = await this.pricingService.recalculateCosts(new Date(body.from), new Date(body.to));
    return { recalculatedCount: count };
  }
}
