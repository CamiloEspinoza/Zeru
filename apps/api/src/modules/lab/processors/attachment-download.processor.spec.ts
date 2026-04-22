import { Test } from '@nestjs/testing';
import { AttachmentDownloadProcessor } from './attachment-download.processor';
import { PrismaService } from '../../../prisma/prisma.service';
import { S3Service } from '../../files/s3.service';
import { FmApiService } from '../../filemaker/services/fm-api.service';
import { FmAuthService } from '../../filemaker/services/fm-auth.service';
import { LabImportOrchestratorService } from '../services/lab-import-orchestrator.service';

describe('AttachmentDownloadProcessor', () => {
  let processor: AttachmentDownloadProcessor;
  let prisma: any;
  let s3Service: jest.Mocked<S3Service>;

  beforeEach(async () => {
    prisma = {
      labDiagnosticReportAttachment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'att-1',
          tenantId: 'tenant-1',
          s3Key: 'Biopsias/LAB-001/2026/03/12345.pdf',
          fmContainerUrlOriginal: null,
          citolabS3KeyOriginal: 'Biopsias/LAB-001/2026/03/12345.pdf',
          migrationStatus: 'PENDING_MIGRATION',
          migrationAttempts: 0,
        }),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      labImportRun: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'run-1',
          startedAt: new Date('2026-01-01'),
        }),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        AttachmentDownloadProcessor,
        { provide: PrismaService, useValue: prisma },
        {
          provide: S3Service,
          useValue: {
            upload: jest.fn(),
            download: jest.fn(),
          },
        },
        { provide: FmApiService, useValue: {} },
        {
          provide: FmAuthService,
          useValue: {
            getToken: jest.fn().mockResolvedValue('mock-token'),
            invalidateSession: jest.fn(),
          },
        },
        {
          provide: LabImportOrchestratorService,
          useValue: { advancePhase: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: 'CITOLAB_S3_CONFIG',
          useValue: { bucket: 'archivos-citolab-virginia', region: 'us-east-1' },
        },
      ],
    }).compile();

    processor = module.get(AttachmentDownloadProcessor);
    s3Service = module.get(S3Service);

    // Mock the Citolab S3 download (uses its own S3Client internally)
    jest.spyOn(processor, 'downloadFromCitolabS3').mockResolvedValue({
      buffer: Buffer.from('fake-pdf'),
      contentType: 'application/pdf',
    });
  });

  it('copies PDF from Citolab S3 to Zeru S3', async () => {
    const job = {
      data: {
        runId: 'run-1',
        tenantId: 'tenant-1',
        attachmentId: 'att-1',
        targetS3Key: 'Biopsias/LAB-001/2026/03/12345.pdf',
        fmContainerUrl: null,
        citolabS3Key: 'Biopsias/LAB-001/2026/03/12345.pdf',
      },
    } as any;

    await processor.process(job);

    expect(processor.downloadFromCitolabS3).toHaveBeenCalledWith(
      'Biopsias/LAB-001/2026/03/12345.pdf',
    );
    expect(s3Service.upload).toHaveBeenCalledWith(
      'tenant-1',
      'Biopsias/LAB-001/2026/03/12345.pdf',
      expect.any(Buffer),
      'application/pdf',
    );
    expect(prisma.labDiagnosticReportAttachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          migrationStatus: 'UPLOADED',
          migratedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('keeps PENDING_MIGRATION on intermediate error (retries)', async () => {
    jest.spyOn(processor, 'downloadFromCitolabS3').mockRejectedValue(new Error('NoSuchKey'));

    const job = {
      data: {
        runId: 'run-1',
        tenantId: 'tenant-1',
        attachmentId: 'att-1',
        targetS3Key: 'Biopsias/LAB-001/2026/03/12345.pdf',
        fmContainerUrl: null,
        citolabS3Key: 'Biopsias/LAB-001/2026/03/12345.pdf',
      },
    } as any;

    await expect(processor.process(job)).rejects.toThrow('NoSuchKey');

    // On intermediate failures, status stays PENDING_MIGRATION so advancePhase still counts it.
    // FAILED_MIGRATION is only set on final retry exhaustion via @OnWorkerEvent('failed').
    expect(prisma.labDiagnosticReportAttachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          migrationStatus: 'PENDING_MIGRATION',
          migrationError: expect.stringContaining('NoSuchKey'),
        }),
      }),
    );
  });

  it('skips if attachment already UPLOADED', async () => {
    prisma.labDiagnosticReportAttachment.findUnique.mockResolvedValue({
      id: 'att-1',
      migrationStatus: 'UPLOADED',
    });

    const job = {
      data: {
        runId: 'run-1',
        tenantId: 'tenant-1',
        attachmentId: 'att-1',
        targetS3Key: 'key',
        fmContainerUrl: null,
        citolabS3Key: 'key',
      },
    } as any;

    await processor.process(job);

    // Should not attempt any download or update
    expect(processor.downloadFromCitolabS3).not.toHaveBeenCalled();
    expect(prisma.labDiagnosticReportAttachment.update).not.toHaveBeenCalled();
  });

  it('skips if attachment not found', async () => {
    prisma.labDiagnosticReportAttachment.findUnique.mockResolvedValue(null);

    const job = {
      data: {
        runId: 'run-1',
        tenantId: 'tenant-1',
        attachmentId: 'att-missing',
        targetS3Key: 'key',
        fmContainerUrl: null,
        citolabS3Key: null,
      },
    } as any;

    await processor.process(job);

    expect(processor.downloadFromCitolabS3).not.toHaveBeenCalled();
    expect(prisma.labDiagnosticReportAttachment.update).not.toHaveBeenCalled();
  });

  it('marks as SKIPPED when no source URL is available', async () => {
    const job = {
      data: {
        runId: 'run-1',
        tenantId: 'tenant-1',
        attachmentId: 'att-1',
        targetS3Key: 'key',
        fmContainerUrl: null,
        citolabS3Key: null,
      },
    } as any;

    await processor.process(job);

    // First call: DOWNLOADING status; second call: SKIPPED status
    const updateCalls = prisma.labDiagnosticReportAttachment.update.mock.calls;
    const lastCall = updateCalls[updateCalls.length - 1][0];
    expect(lastCall.data).toMatchObject({
      migrationStatus: 'SKIPPED',
      migrationError: 'No source URL available',
    });
  });

  describe('downloadFromFmContainer — auth retry on 401', () => {
    let fmAuthService: any;
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
      fmAuthService = processor['fmAuthService'];
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('invalidates session and retries once when the first fetch returns 401', async () => {
      const firstResponse = new Response(null, { status: 401, statusText: 'Unauthorized' });
      const secondResponse = new Response(Buffer.from('binary-ok'), {
        status: 200,
        headers: { 'content-type': 'application/pdf' },
      });
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(firstResponse)
        .mockResolvedValueOnce(secondResponse);
      global.fetch = fetchMock as any;

      fmAuthService.getToken
        .mockResolvedValueOnce('stale-token')
        .mockResolvedValueOnce('fresh-token');

      const result = await processor.downloadFromFmContainer(
        'https://fm.example.com/Streaming_SSL/foo.pdf',
        'BIOPSIAS',
      );

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fmAuthService.invalidateSession).toHaveBeenCalledWith('BIOPSIAS');
      expect(fmAuthService.getToken).toHaveBeenCalledTimes(2);
      expect(result.contentType).toBe('application/pdf');
      expect(result.buffer.toString()).toBe('binary-ok');
    });

    it('throws with the original 401 when the retry also returns 401', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValue(new Response(null, { status: 401, statusText: 'Unauthorized' }));
      global.fetch = fetchMock as any;

      await expect(
        processor.downloadFromFmContainer(
          'https://fm.example.com/Streaming_SSL/foo.pdf',
          'BIOPSIAS',
        ),
      ).rejects.toThrow(/401/);
      expect(fetchMock).toHaveBeenCalledTimes(2); // initial + one retry
      expect(fmAuthService.invalidateSession).toHaveBeenCalledTimes(1);
    });
  });

  it('downloads from FM container when fmContainerUrl is provided', async () => {
    // Mock the additional findUnique call for resolving fmSource
    prisma.labDiagnosticReportAttachment.findUnique.mockResolvedValue({
      id: 'att-1',
      tenantId: 'tenant-1',
      s3Key: 'photos/photo1.jpg',
      fmContainerUrlOriginal: 'https://fm.example.com/Streaming_SSL/photo1.jpg',
      citolabS3KeyOriginal: null,
      migrationStatus: 'PENDING_MIGRATION',
      migrationAttempts: 0,
      diagnosticReport: { fmSource: 'BIOPSIAS' },
    });

    jest.spyOn(processor, 'downloadFromFmContainer').mockResolvedValue({
      buffer: Buffer.from('fake-image'),
      contentType: 'image/jpeg',
    });

    const job = {
      data: {
        runId: 'run-1',
        tenantId: 'tenant-1',
        attachmentId: 'att-1',
        targetS3Key: 'photos/photo1.jpg',
        fmContainerUrl: 'https://fm.example.com/Streaming_SSL/photo1.jpg',
        citolabS3Key: null,
      },
    } as any;

    await processor.process(job);

    expect(processor.downloadFromFmContainer).toHaveBeenCalledWith(
      'https://fm.example.com/Streaming_SSL/photo1.jpg',
      'BIOPSIAS',
    );
    expect(s3Service.upload).toHaveBeenCalledWith(
      'tenant-1',
      'photos/photo1.jpg',
      expect.any(Buffer),
      'image/jpeg',
    );
    expect(prisma.labDiagnosticReportAttachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          migrationStatus: 'UPLOADED',
          migratedAt: expect.any(Date),
          sizeBytes: Buffer.from('fake-image').length,
        }),
      }),
    );
  });
});
