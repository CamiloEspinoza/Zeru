import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  CreateProcessStepSchema,
  UpdateProcessStepSchema,
  UpdateStepCompletionSchema,
  ReorderStepsSchema,
} from '@zeru/shared';

const DEFAULT_STEPS = [
  { name: 'Contabilización de Ventas', description: 'Registrar ingresos por ventas del período', order: 0 },
  { name: 'Contabilización de Compras', description: 'Registrar facturas de proveedores', order: 1 },
  { name: 'Boletas de Honorarios', description: 'Contabilizar boletas de honorarios emitidas y recibidas', order: 2 },
  { name: 'Remuneraciones', description: 'Contabilizar sueldos, leyes sociales y finiquitos', order: 3 },
  { name: 'Provisiones', description: 'Registrar provisiones del período (vacaciones, impuestos, etc.)', order: 4 },
  { name: 'Depreciaciones', description: 'Calcular y registrar depreciaciones de activos fijos', order: 5 },
  { name: 'Conciliación Bancaria', description: 'Conciliar saldos contables con estados de cuenta bancarios', order: 6 },
  { name: 'Ajustes y Reclasificaciones', description: 'Correcciones y reclasificaciones contables', order: 7 },
  { name: 'Revisión y Cierre', description: 'Revisión final y cierre del período', order: 8 },
];

@Injectable()
export class AccountingProcessService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllSteps(tenantId: string) {
    return this.prisma.accountingProcessStep.findMany({
      where: { tenantId },
      orderBy: { order: 'asc' },
    });
  }

  async createStep(tenantId: string, data: CreateProcessStepSchema) {
    return this.prisma.accountingProcessStep.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description ?? null,
        order: data.order,
      },
    });
  }

  async updateStep(id: string, tenantId: string, data: UpdateProcessStepSchema) {
    const step = await this.prisma.accountingProcessStep.findFirst({
      where: { id, tenantId },
    });

    if (!step) {
      throw new NotFoundException(`Step with id ${id} not found`);
    }

    return this.prisma.accountingProcessStep.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.order !== undefined && { order: data.order }),
      },
    });
  }

  async deleteStep(id: string, tenantId: string) {
    const step = await this.prisma.accountingProcessStep.findFirst({
      where: { id, tenantId },
    });

    if (!step) {
      throw new NotFoundException(`Step with id ${id} not found`);
    }

    return this.prisma.accountingProcessStep.delete({ where: { id } });
  }

  async reorderSteps(tenantId: string, data: ReorderStepsSchema) {
    const ids = data.steps.map((s) => s.id);
    const existing = await this.prisma.accountingProcessStep.findMany({
      where: { id: { in: ids }, tenantId },
      select: { id: true },
    });

    if (existing.length !== ids.length) {
      throw new BadRequestException('One or more step IDs are invalid');
    }

    await this.prisma.$transaction(
      data.steps.map((s) =>
        this.prisma.accountingProcessStep.update({
          where: { id: s.id },
          data: { order: s.order },
        }),
      ),
    );

    return this.findAllSteps(tenantId);
  }

  async loadDefaultSteps(tenantId: string) {
    const existingCount = await this.prisma.accountingProcessStep.count({
      where: { tenantId },
    });

    if (existingCount > 0) {
      throw new BadRequestException(
        'Ya existen pasos configurados. Elimínalos primero para cargar la plantilla.',
      );
    }

    await this.prisma.accountingProcessStep.createMany({
      data: DEFAULT_STEPS.map((s) => ({ ...s, tenantId })),
    });

    return this.findAllSteps(tenantId);
  }

  async getProgress(tenantId: string, fiscalPeriodId: string) {
    const period = await this.prisma.fiscalPeriod.findFirst({
      where: { id: fiscalPeriodId, tenantId },
    });

    if (!period) {
      throw new NotFoundException(`Fiscal period with id ${fiscalPeriodId} not found`);
    }

    const steps = await this.prisma.accountingProcessStep.findMany({
      where: { tenantId },
      orderBy: { order: 'asc' },
      include: {
        completions: {
          where: { fiscalPeriodId },
          include: {
            completedBy: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
      },
    });

    return steps.map((step) => ({
      ...step,
      completion: step.completions[0] ?? null,
    }));
  }

  async updateStepCompletion(
    stepId: string,
    tenantId: string,
    userId: string,
    data: UpdateStepCompletionSchema,
  ) {
    const step = await this.prisma.accountingProcessStep.findFirst({
      where: { id: stepId, tenantId },
    });

    if (!step) {
      throw new NotFoundException(`Step with id ${stepId} not found`);
    }

    const period = await this.prisma.fiscalPeriod.findFirst({
      where: { id: data.fiscalPeriodId, tenantId },
    });

    if (!period) {
      throw new NotFoundException(`Fiscal period with id ${data.fiscalPeriodId} not found`);
    }

    return this.prisma.accountingStepCompletion.upsert({
      where: {
        stepId_fiscalPeriodId: {
          stepId,
          fiscalPeriodId: data.fiscalPeriodId,
        },
      },
      create: {
        stepId,
        fiscalPeriodId: data.fiscalPeriodId,
        status: data.status,
        notes: data.notes ?? null,
        completedById: data.status === 'COMPLETED' ? userId : null,
        completedAt: data.status === 'COMPLETED' ? new Date() : null,
      },
      update: {
        status: data.status,
        notes: data.notes ?? null,
        completedById: data.status === 'COMPLETED' ? userId : null,
        completedAt: data.status === 'COMPLETED' ? new Date() : null,
      },
      include: {
        completedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }
}
