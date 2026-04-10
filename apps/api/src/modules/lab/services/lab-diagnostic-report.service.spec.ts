import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException } from '@nestjs/common';
import { LabDiagnosticReportService } from './lab-diagnostic-report.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('LabDiagnosticReportService', () => {
  let service: LabDiagnosticReportService;
  let prisma: any;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    prisma = {
      labDiagnosticReport: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      labExamWorkflowEvent: { create: jest.fn() },
      labDiagnosticReportSigner: {
        create: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({ _max: { signatureOrder: null } }),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        LabDiagnosticReportService,
        { provide: PrismaService, useValue: prisma },
        EventEmitter2,
      ],
    }).compile();

    service = module.get(LabDiagnosticReportService);
    eventEmitter = module.get(EventEmitter2);
    jest.spyOn(eventEmitter, 'emit');
  });

  it('updateMacroscopy emits fm.lab.sync event', async () => {
    prisma.labDiagnosticReport.findFirst.mockResolvedValue({
      id: 'dr-1',
      fmSource: 'BIOPSIAS',
    });
    prisma.labDiagnosticReport.updateMany.mockResolvedValue({ count: 1 });
    prisma.labDiagnosticReport.findUniqueOrThrow.mockResolvedValue({ id: 'dr-1' });

    await service.updateMacroscopy('dr-1', 'tenant-1', {
      macroscopicDescription: 'Fragmento de tejido grisaceo',
    });

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'fm.lab.sync',
      expect.objectContaining({
        entityType: 'lab-diagnostic-report',
        action: 'macroscopy-update',
      }),
    );
  });

  it('completeMacroscopy creates workflow event', async () => {
    prisma.labDiagnosticReport.findFirst.mockResolvedValue({ id: 'dr-1' });
    prisma.labExamWorkflowEvent.create.mockResolvedValue({ id: 'evt-1' });

    await service.completeMacroscopy('dr-1', 'tenant-1', {
      performedByNameSnapshot: 'Dr. Martinez',
    });

    expect(prisma.labExamWorkflowEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'MACROSCOPY',
          performedByNameSnapshot: 'Dr. Martinez',
        }),
      }),
    );
  });

  it('registerMacroSigner creates signer and emits event', async () => {
    prisma.labDiagnosticReport.findFirst.mockResolvedValue({ id: 'dr-1' });
    prisma.labDiagnosticReportSigner.create.mockResolvedValue({ id: 'signer-1' });

    await service.registerMacroSigner('tenant-1', {
      diagnosticReportId: 'dr-1',
      pathologistCode: 'PAT-001',
      pathologistName: 'Dr. Martinez',
    });

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'fm.lab.sync',
      expect.objectContaining({
        entityType: 'lab-signer',
        action: 'macro-signer',
      }),
    );
  });

  it('findById throws for non-existent report', async () => {
    prisma.labDiagnosticReport.findFirst.mockResolvedValue(null);
    await expect(service.findById('nope', 'tenant-1')).rejects.toThrow(NotFoundException);
  });

  it('search returns paginated results', async () => {
    const mockItems = [{ id: 'dr-1' }];
    prisma.labDiagnosticReport.findMany.mockResolvedValue(mockItems);
    prisma.labDiagnosticReport.count.mockResolvedValue(1);

    const result = await service.search('tenant-1', { page: 1, pageSize: 20 });

    expect(result).toEqual({
      items: mockItems,
      total: 1,
      page: 1,
      pageSize: 20,
    });
    expect(prisma.labDiagnosticReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1' },
        skip: 0,
        take: 20,
      }),
    );
  });

  it('updateMacroscopy throws for non-existent report', async () => {
    prisma.labDiagnosticReport.findFirst.mockResolvedValue(null);
    await expect(
      service.updateMacroscopy('nope', 'tenant-1', {
        macroscopicDescription: 'test',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('completeMacroscopy throws for non-existent report', async () => {
    prisma.labDiagnosticReport.findFirst.mockResolvedValue(null);
    await expect(
      service.completeMacroscopy('nope', 'tenant-1', {
        performedByNameSnapshot: 'Dr. Test',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('registerMacroSigner throws for non-existent report', async () => {
    prisma.labDiagnosticReport.findFirst.mockResolvedValue(null);
    await expect(
      service.registerMacroSigner('tenant-1', {
        diagnosticReportId: 'nope',
        pathologistCode: 'PAT-001',
        pathologistName: 'Dr. Test',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('registerMacroSigner creates assistant signer when provided', async () => {
    prisma.labDiagnosticReport.findFirst.mockResolvedValue({ id: 'dr-1' });
    prisma.labDiagnosticReportSigner.create.mockResolvedValue({ id: 'signer-1' });
    prisma.labDiagnosticReportSigner.aggregate.mockResolvedValue({
      _max: { signatureOrder: 2 },
    });

    await service.registerMacroSigner('tenant-1', {
      diagnosticReportId: 'dr-1',
      pathologistCode: 'PAT-001',
      pathologistName: 'Dr. Martinez',
      assistantCode: 'ASS-001',
      assistantName: 'Asistente Test',
    });

    // Should be called twice: pathologist + assistant
    expect(prisma.labDiagnosticReportSigner.create).toHaveBeenCalledTimes(2);

    // Pathologist signer at order 3 (max was 2)
    expect(prisma.labDiagnosticReportSigner.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          codeSnapshot: 'PAT-001',
          signatureOrder: 3,
        }),
      }),
    );

    // Assistant signer at order 4
    expect(prisma.labDiagnosticReportSigner.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          codeSnapshot: 'ASS-001',
          signatureOrder: 4,
        }),
      }),
    );
  });
});
