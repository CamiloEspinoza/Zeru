import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DteExchangeProcessor } from './dte-exchange.processor';
import { PrismaService } from '../../../prisma/prisma.service';
import { DteConfigService } from '../services/dte-config.service';
import { EmailService } from '../../email/email.service';
import { Job } from 'bullmq';

describe('DteExchangeProcessor', () => {
  let processor: DteExchangeProcessor;
  let prisma: any;
  let tenantDb: any;
  let configService: any;
  let emailService: any;
  let eventEmitter: any;

  const tenantId = 'tenant-1';
  const dteId = 'dte-1';
  const recipientEmail = 'cliente@example.com';
  const jobData = { dteId, tenantId, recipientEmail };

  beforeEach(async () => {
    tenantDb = {
      dte: { findFirstOrThrow: jest.fn() },
      dteExchange: {
        findFirst: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      dteExchangeEvent: {
        findMany: jest.fn(),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    prisma = { forTenant: jest.fn().mockReturnValue(tenantDb) };

    configService = {
      get: jest.fn().mockResolvedValue({
        rut: '76123456-7',
        environment: 'CERTIFICATION',
      }),
    };
    emailService = { sendWithAttachments: jest.fn().mockResolvedValue(undefined) };
    eventEmitter = { emit: jest.fn() };

    const mod = await Test.createTestingModule({
      providers: [
        DteExchangeProcessor,
        { provide: PrismaService, useValue: prisma },
        { provide: DteConfigService, useValue: configService },
        { provide: EmailService, useValue: emailService },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    processor = mod.get(DteExchangeProcessor);
  });

  function makeJob(data = jobData, attemptsMade = 0): Job<any> {
    return {
      data,
      attemptsMade,
      opts: { attempts: 5 },
    } as unknown as Job<any>;
  }

  const mockDte = {
    id: dteId,
    folio: 101,
    dteType: 'FACTURA_ELECTRONICA',
    fechaEmision: new Date('2026-04-16T10:00:00Z'),
  };

  it('loads DTE tenant-scoped, sends acuses via EmailService.sendWithAttachments and marks exchange SENT', async () => {
    tenantDb.dte.findFirstOrThrow.mockResolvedValue(mockDte);
    tenantDb.dteExchange.findFirst.mockResolvedValue({ id: 'exchange-1' });
    tenantDb.dteExchangeEvent.findMany.mockResolvedValue([
      { eventType: 'RECEPCION_DTE', xmlContent: '<RecepcionDTE/>', createdAt: new Date() },
      { eventType: 'RESULTADO_DTE', xmlContent: '<ResultadoDTE/>', createdAt: new Date() },
      { eventType: 'ENVIO_RECIBOS', xmlContent: '<EnvioRecibos/>', createdAt: new Date() },
    ]);

    await processor.process(makeJob());

    expect(prisma.forTenant).toHaveBeenCalledWith(tenantId);
    expect(tenantDb.dte.findFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: dteId } }),
    );

    // sendWithAttachments called with all 3 XMLs
    expect(emailService.sendWithAttachments).toHaveBeenCalledTimes(1);
    const [tid, to, subject, html, attachments] =
      emailService.sendWithAttachments.mock.calls[0];
    expect(tid).toBe(tenantId);
    expect(to).toBe(recipientEmail);
    expect(subject).toContain('101');
    expect(html).toContain('101');
    expect(attachments.map((a: any) => a.filename)).toEqual([
      'RecepcionDTE.xml',
      'ResultadoDTE.xml',
      'EnvioRecibos.xml',
    ]);

    // Exchange status updated to SENT
    expect(tenantDb.dteExchange.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { dteId, tenantId, recipientEmail },
        data: { status: 'SENT' },
      }),
    );

    // Success event + domain event emitted
    expect(tenantDb.dteExchangeEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          exchangeId: 'exchange-1',
          eventType: 'ENVIO_DTE',
        }),
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'dte.exchange.sent',
      expect.objectContaining({ tenantId, dteId, recipientEmail }),
    );
  });

  it('throws when the exchange row does not exist', async () => {
    tenantDb.dte.findFirstOrThrow.mockResolvedValue(mockDte);
    tenantDb.dteExchange.findFirst.mockResolvedValue(null);

    await expect(processor.process(makeJob())).rejects.toThrow(
      /DteExchange not found/,
    );
    expect(emailService.sendWithAttachments).not.toHaveBeenCalled();
  });

  it('throws when no signed acuse XMLs are available', async () => {
    tenantDb.dte.findFirstOrThrow.mockResolvedValue(mockDte);
    tenantDb.dteExchange.findFirst.mockResolvedValue({ id: 'exchange-1' });
    tenantDb.dteExchangeEvent.findMany.mockResolvedValue([]);

    await expect(processor.process(makeJob())).rejects.toThrow(
      /No signed acuse XMLs/,
    );
    expect(emailService.sendWithAttachments).not.toHaveBeenCalled();
  });

  it('persists SEND_FAILED event and re-throws when the email send fails', async () => {
    tenantDb.dte.findFirstOrThrow.mockResolvedValue(mockDte);
    tenantDb.dteExchange.findFirst.mockResolvedValue({ id: 'exchange-1' });
    tenantDb.dteExchangeEvent.findMany.mockResolvedValue([
      { eventType: 'RECEPCION_DTE', xmlContent: '<RecepcionDTE/>', createdAt: new Date() },
    ]);
    emailService.sendWithAttachments.mockRejectedValue(new Error('SES 503'));

    await expect(processor.process(makeJob())).rejects.toThrow('SES 503');

    expect(tenantDb.dteExchangeEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          exchangeId: 'exchange-1',
          eventType: 'SEND_FAILED',
          metadata: expect.objectContaining({
            error: 'SES 503',
            recipientEmail,
          }),
        }),
      }),
    );
    expect(tenantDb.dteExchange.updateMany).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('onFailed at max attempts marks the DteExchange as ERROR', async () => {
    await processor.onFailed(
      makeJob(jobData, 5),
      new Error('SMTP unreachable'),
    );

    expect(tenantDb.dteExchange.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { dteId, tenantId, recipientEmail },
        data: { status: 'ERROR' },
      }),
    );
  });

  it('onFailed before max attempts does not mutate state', async () => {
    await processor.onFailed(makeJob(jobData, 2), new Error('transient'));

    expect(tenantDb.dteExchange.updateMany).not.toHaveBeenCalled();
  });
});
