import { Test } from '@nestjs/testing';
import { DteReceivedProcessor } from './dte-received.processor';
import { DteXmlParserService } from '../exchange/dte-xml-parser.service';
import { DteValidationService } from '../exchange/dte-validation.service';
import { DteReceivedService } from '../services/dte-received.service';
import { XmlSanitizerService } from '../services/xml-sanitizer.service';
import { Job } from 'bullmq';

describe('DteReceivedProcessor', () => {
  let processor: DteReceivedProcessor;
  let xmlParser: any;
  let validationService: any;
  let receivedService: any;
  let xmlSanitizer: any;

  const tenantId = 'tenant-1';

  const baseJob = (overrides: Partial<any> = {}): Job<any> => ({
    data: {
      tenantId,
      xmlContent: '<EnvioDTE>...</EnvioDTE>',
      source: 'imap' as const,
      fromEmail: 'proveedor@example.com',
      ...overrides,
    },
    attemptsMade: 0,
    opts: { attempts: 3 },
  } as unknown as Job<any>);

  beforeEach(async () => {
    xmlParser = { parseEnvioDte: jest.fn() };
    validationService = {};
    receivedService = { processReceivedDte: jest.fn() };
    xmlSanitizer = { validateNoInjection: jest.fn() };

    const mod = await Test.createTestingModule({
      providers: [
        DteReceivedProcessor,
        { provide: DteXmlParserService, useValue: xmlParser },
        { provide: DteValidationService, useValue: validationService },
        { provide: DteReceivedService, useValue: receivedService },
        { provide: XmlSanitizerService, useValue: xmlSanitizer },
      ],
    }).compile();

    processor = mod.get(DteReceivedProcessor);
  });

  it('calls processReceivedDte for every parsed DTE and completes on full success', async () => {
    xmlParser.parseEnvioDte.mockReturnValue([
      { tipoDTE: 33, folio: 1 },
      { tipoDTE: 33, folio: 2 },
      { tipoDTE: 34, folio: 10 },
    ]);
    receivedService.processReceivedDte.mockResolvedValue({
      dteId: 'x',
      isNew: true,
      validation: { valid: true },
    });

    await expect(processor.process(baseJob())).resolves.toBeUndefined();

    expect(xmlSanitizer.validateNoInjection).toHaveBeenCalledWith(
      '<EnvioDTE>...</EnvioDTE>',
    );
    expect(receivedService.processReceivedDte).toHaveBeenCalledTimes(3);
    expect(receivedService.processReceivedDte).toHaveBeenNthCalledWith(
      1,
      tenantId,
      { tipoDTE: 33, folio: 1 },
      'proveedor@example.com',
    );
  });

  it('returns early when no DTEs are parsed', async () => {
    xmlParser.parseEnvioDte.mockReturnValue([]);

    await processor.process(baseJob());

    expect(receivedService.processReceivedDte).not.toHaveBeenCalled();
  });

  it('throws when all DTEs fail (so BullMQ retries the job)', async () => {
    xmlParser.parseEnvioDte.mockReturnValue([
      { tipoDTE: 33, folio: 1 },
      { tipoDTE: 33, folio: 2 },
    ]);
    receivedService.processReceivedDte.mockRejectedValue(new Error('db down'));

    await expect(processor.process(baseJob())).rejects.toThrow(
      /All 2 DTEs failed/,
    );

    expect(receivedService.processReceivedDte).toHaveBeenCalledTimes(2);
  });

  it('completes without throwing on partial success (successCount > 0 && failCount > 0)', async () => {
    xmlParser.parseEnvioDte.mockReturnValue([
      { tipoDTE: 33, folio: 1 },
      { tipoDTE: 33, folio: 2 },
      { tipoDTE: 33, folio: 3 },
    ]);
    receivedService.processReceivedDte
      .mockResolvedValueOnce({ dteId: 'd1', isNew: true, validation: { valid: true } })
      .mockRejectedValueOnce(new Error('duplicate'))
      .mockResolvedValueOnce({ dteId: 'd3', isNew: true, validation: { valid: true } });

    await expect(processor.process(baseJob())).resolves.toBeUndefined();

    expect(receivedService.processReceivedDte).toHaveBeenCalledTimes(3);
  });

  it('propagates XML injection errors from the sanitizer before parsing', async () => {
    xmlSanitizer.validateNoInjection.mockImplementation(() => {
      throw new Error('XXE blocked');
    });

    await expect(processor.process(baseJob())).rejects.toThrow('XXE blocked');

    expect(xmlParser.parseEnvioDte).not.toHaveBeenCalled();
    expect(receivedService.processReceivedDte).not.toHaveBeenCalled();
  });
});
