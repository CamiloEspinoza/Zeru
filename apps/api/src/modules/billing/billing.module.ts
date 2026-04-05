import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { BillingConceptsService } from './billing-concepts.service';
import { BillingConceptsController } from './billing-concepts.controller';
import { BillingAgreementsService } from './billing-agreements.service';
import { BillingAgreementsController } from './billing-agreements.controller';

@Module({
  imports: [PrismaModule],
  controllers: [BillingConceptsController, BillingAgreementsController],
  providers: [BillingConceptsService, BillingAgreementsService],
  exports: [BillingConceptsService, BillingAgreementsService],
})
export class BillingModule {}
