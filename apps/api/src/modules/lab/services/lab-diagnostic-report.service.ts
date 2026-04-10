import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { toDiagnosticReportStatus, toExamCategory, toSigningRole } from '../constants/enum-maps';
import type {
  UpdateMacroscopySchema,
  CompleteMacroscopySchema,
  RegisterMacroSignerSchema,
  LabReportSearchSchema,
} from '@zeru/shared';
import type { FmLabSyncEvent } from './fm-lab-sync.service';

@Injectable()
export class LabDiagnosticReportService {
  private readonly logger = new Logger(LabDiagnosticReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async search(tenantId: string, filters: LabReportSearchSchema) {
    const { page, pageSize, ...where } = filters;
    const skip = (page - 1) * pageSize;

    const whereClause: Record<string, unknown> = { tenantId };
    if (where.status) whereClause.status = toDiagnosticReportStatus(where.status);
    if (where.dateFrom || where.dateTo) {
      whereClause.validatedAt = {
        ...(where.dateFrom ? { gte: new Date(where.dateFrom) } : {}),
        ...(where.dateTo ? { lte: new Date(where.dateTo) } : {}),
      };
    }

    // Category and labOrigin filter through serviceRequest relation
    const serviceRequestWhere: Record<string, unknown> = {};
    if (where.category) serviceRequestWhere.category = toExamCategory(where.category);
    if (where.labOriginId) serviceRequestWhere.labOriginId = where.labOriginId;
    if (where.patientRut) serviceRequestWhere.subjectRut = where.patientRut;
    if (Object.keys(serviceRequestWhere).length > 0) {
      whereClause.serviceRequest = serviceRequestWhere;
    }

    // Full-text search on conclusion + fullText
    if (where.query) {
      whereClause.OR = [
        { conclusion: { contains: where.query, mode: 'insensitive' } },
        { fullText: { contains: where.query, mode: 'insensitive' } },
        { serviceRequest: { subjectRut: { contains: where.query } } },
        {
          serviceRequest: {
            subjectPaternalLastName: { contains: where.query, mode: 'insensitive' },
          },
        },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.labDiagnosticReport.findMany({
        where: whereClause,
        select: {
          id: true,
          fmInformeNumber: true,
          fmSource: true,
          status: true,
          conclusion: true,
          macroscopicDescription: true,
          isUrgent: true,
          isAlteredOrCritical: true,
          validatedAt: true,
          createdAt: true,
          serviceRequest: {
            select: {
              id: true,
              subjectFirstName: true,
              subjectPaternalLastName: true,
              subjectMaternalLastName: true,
              subjectRut: true,
              category: true,
              labOriginCodeSnapshot: true,
              muestraDe: true,
            },
          },
          signers: {
            where: { isActive: true },
            select: { nameSnapshot: true, role: true },
            orderBy: { signatureOrder: 'asc' },
          },
        },
        orderBy: { validatedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.labDiagnosticReport.count({ where: whereClause }),
    ]);

    return { items, total, page, pageSize };
  }

  async findById(id: string, tenantId: string) {
    const report = await this.prisma.labDiagnosticReport.findFirst({
      where: { id, tenantId },
      include: {
        serviceRequest: {
          include: {
            patient: true,
            specimens: { include: { slides: true } },
          },
        },
        signers: { orderBy: { signatureOrder: 'asc' } },
        workflowEvents: { orderBy: { occurredAt: 'asc' } },
        communications: { orderBy: { loggedAt: 'desc' } },
        attachments: { orderBy: { sequenceOrder: 'asc' } },
        examCharges: { orderBy: { enteredAt: 'desc' } },
        observations: true,
        technicalObservations: { orderBy: { observedAt: 'desc' } },
        adverseEvents: { orderBy: { occurredAt: 'desc' } },
      },
    });
    if (!report) throw new NotFoundException(`DiagnosticReport ${id} not found`);
    return report;
  }

  async updateMacroscopy(
    id: string,
    tenantId: string,
    data: UpdateMacroscopySchema,
  ) {
    const report = await this.prisma.labDiagnosticReport.findFirst({
      where: { id, tenantId },
      select: { id: true, fmSource: true },
    });
    if (!report) throw new NotFoundException(`DiagnosticReport ${id} not found`);

    await this.prisma.labDiagnosticReport.updateMany({
      where: { id, tenantId },
      data: { macroscopicDescription: data.macroscopicDescription },
    });
    const updated = await this.prisma.labDiagnosticReport.findUniqueOrThrow({ where: { id } });

    try {
      this.eventEmitter.emit('fm.lab.sync', {
        tenantId,
        entityType: 'lab-diagnostic-report',
        entityId: id,
        action: 'macroscopy-update',
        changedFields: ['macroscopicDescription'],
      } satisfies FmLabSyncEvent);
    } catch (error) {
      this.logger.error(`Failed to emit fm.lab.sync: ${error instanceof Error ? error.message : error}`);
    }

    return updated;
  }

  async completeMacroscopy(
    id: string,
    tenantId: string,
    data: CompleteMacroscopySchema,
  ) {
    const report = await this.prisma.labDiagnosticReport.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!report) throw new NotFoundException(`DiagnosticReport ${id} not found`);

    // Create workflow event for macroscopy completion
    const event = await this.prisma.labExamWorkflowEvent.create({
      data: {
        tenantId,
        diagnosticReportId: id,
        eventType: 'MACROSCOPY',
        occurredAt: new Date(),
        performedByNameSnapshot: data.performedByNameSnapshot,
        performedById: data.performedById ?? null,
        sourceField: 'Zeru:macroscopy-complete',
      },
    });

    try {
      this.eventEmitter.emit('fm.lab.sync', {
        tenantId,
        entityType: 'lab-workflow-event',
        entityId: event.id,
        action: 'macroscopy-complete',
      } satisfies FmLabSyncEvent);
    } catch (error) {
      this.logger.error(`Failed to emit fm.lab.sync: ${error instanceof Error ? error.message : error}`);
    }

    return event;
  }

  async registerMacroSigner(
    tenantId: string,
    data: RegisterMacroSignerSchema,
  ) {
    const report = await this.prisma.labDiagnosticReport.findFirst({
      where: { id: data.diagnosticReportId, tenantId },
      select: { id: true },
    });
    if (!report) {
      throw new NotFoundException(
        `DiagnosticReport ${data.diagnosticReportId} not found`,
      );
    }

    // Get next signature order
    const maxOrder = await this.prisma.labDiagnosticReportSigner.aggregate({
      where: { diagnosticReportId: data.diagnosticReportId },
      _max: { signatureOrder: true },
    });
    let nextOrder = (maxOrder._max.signatureOrder ?? 0) + 1;

    // Create pathologist signer
    const pathologistSigner = await this.prisma.labDiagnosticReportSigner.create({
      data: {
        tenantId,
        diagnosticReportId: data.diagnosticReportId,
        codeSnapshot: data.pathologistCode,
        nameSnapshot: data.pathologistName,
        role: toSigningRole('PRIMARY_PATHOLOGIST'),
        signatureOrder: nextOrder,
        signedAt: new Date(),
        isActive: true,
        roleSnapshot: 'PATOLOGO MACRO',
      },
    });

    try {
      this.eventEmitter.emit('fm.lab.sync', {
        tenantId,
        entityType: 'lab-signer',
        entityId: pathologistSigner.id,
        action: 'macro-signer',
      } satisfies FmLabSyncEvent);
    } catch (error) {
      this.logger.error(`Failed to emit fm.lab.sync: ${error instanceof Error ? error.message : error}`);
    }

    // Create assistant signer if provided
    if (data.assistantCode && data.assistantName) {
      nextOrder++;
      await this.prisma.labDiagnosticReportSigner.create({
        data: {
          tenantId,
          diagnosticReportId: data.diagnosticReportId,
          codeSnapshot: data.assistantCode,
          nameSnapshot: data.assistantName,
          role: toSigningRole('OTHER'),
          signatureOrder: nextOrder,
          signedAt: new Date(),
          isActive: true,
          roleSnapshot: 'AYUDANTE MACRO',
        },
      });
    }

    return pathologistSigner;
  }
}
