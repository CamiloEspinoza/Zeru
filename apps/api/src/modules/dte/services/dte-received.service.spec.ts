import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DteReceivedService } from './dte-received.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { DteXmlParserService } from '../exchange/dte-xml-parser.service';
import { DteValidationService } from '../exchange/dte-validation.service';
import { ExchangeResponseService } from '../exchange/exchange-response.service';
import { CertificateService } from '../certificate/certificate.service';
import { XmlSanitizerService } from './xml-sanitizer.service';
import { SiiReclamoService } from '../sii/sii-reclamo.service';

const mockCert = { fake: 'cert' };

describe('DteReceivedService', () => {
  let service: DteReceivedService;
  let prisma: any;
  let xmlParser: any;
  let validationService: any;
  let exchangeResponse: any;
  let certificateService: any;
  let eventEmitter: any;

  beforeEach(async () => {
    prisma = {
      forTenant: jest.fn().mockReturnValue({
        dte: {
          findFirst: jest.fn().mockResolvedValue(null),
          findUnique: jest.fn(),
          create: jest.fn().mockResolvedValue({ id: 'new-dte-1' }),
          update: jest.fn(),
        },
        legalEntity: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest
            .fn()
            .mockResolvedValue({ id: 'le-1', rut: '76123456-7' }),
        },
        dteExchange: {
          findFirst: jest.fn().mockResolvedValue({ id: 'exc-1' }),
          updateMany: jest.fn(),
        },
        dteExchangeEvent: {
          create: jest.fn(),
          createMany: jest.fn(),
        },
        dteLog: {
          create: jest.fn(),
        },
      }),
    };

    xmlParser = {
      parseEnvioDte: jest.fn().mockReturnValue([
        {
          tipoDTE: 33,
          folio: 100,
          fechaEmision: '2026-04-10',
          emisor: {
            rut: '76123456-7',
            razonSocial: 'Proveedor SpA',
            giro: 'Comercio',
          },
          receptor: {
            rut: '77654321-K',
            razonSocial: 'Mi Empresa SpA',
          },
          totales: {
            montoNeto: 100000,
            montoExento: 0,
            iva: 19000,
            montoTotal: 119000,
          },
          items: [
            {
              lineNumber: 1,
              itemName: 'Producto',
              quantity: 1,
              unitPrice: 100000,
              montoItem: 100000,
            },
          ],
          tedXml: '<TED>...</TED>',
          xmlContent: '<DTE>...</DTE>',
          dteTypeName: 'FACTURA_ELECTRONICA',
        },
      ]),
    };

    validationService = {
      validate: jest.fn().mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        deadlineDate: new Date('2026-04-23'),
      }),
    };

    exchangeResponse = {
      generateRecepcionDte: jest.fn().mockResolvedValue('<RecepcionDTE/>'),
      generateResultadoDte: jest.fn().mockResolvedValue('<ResultadoDTE/>'),
      generateEnvioRecibos: jest.fn().mockResolvedValue('<EnvioRecibos/>'),
    };

    certificateService = {
      getPrimaryCert: jest.fn().mockResolvedValue(mockCert),
    };

    eventEmitter = {
      emit: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        DteReceivedService,
        { provide: PrismaService, useValue: prisma },
        { provide: DteXmlParserService, useValue: xmlParser },
        { provide: DteValidationService, useValue: validationService },
        { provide: ExchangeResponseService, useValue: exchangeResponse },
        { provide: CertificateService, useValue: certificateService },
        {
          provide: XmlSanitizerService,
          useValue: {
            sanitize: jest.fn((x: string) => x),
            validateNoInjection: jest.fn(),
          },
        },
        { provide: EventEmitter2, useValue: eventEmitter },
        {
          provide: SiiReclamoService,
          useValue: {
            registrarReclamo: jest
              .fn()
              .mockResolvedValue({ success: true, codResp: 0, descResp: 'OK' }),
          },
        },
      ],
    }).compile();

    service = module.get(DteReceivedService);
  });

  it('should persist a valid received DTE and create LegalEntity', async () => {
    const parsed = xmlParser.parseEnvioDte()[0];
    const result = await service.processReceivedDte(
      'tenant-1',
      parsed,
      'proveedor@example.com',
    );

    expect(result.isNew).toBe(true);
    expect(result.validation.valid).toBe(true);

    const db = prisma.forTenant('tenant-1');
    expect(db.dte.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          direction: 'RECEIVED',
          folio: 100,
          emisorRut: '76123456-7',
          legalEntityId: 'le-1',
        }),
      }),
    );
  });

  it('should skip duplicate DTEs and return isNew=false', async () => {
    const db = prisma.forTenant('tenant-1');
    db.dte.findFirst.mockResolvedValue({ id: 'existing-dte' });

    const parsed = xmlParser.parseEnvioDte()[0];
    const result = await service.processReceivedDte('tenant-1', parsed);

    expect(result.isNew).toBe(false);
    expect(result.dteId).toBe('existing-dte');
    expect(db.dte.create).not.toHaveBeenCalled();
  });

  it('should reuse existing LegalEntity when RUT matches', async () => {
    const db = prisma.forTenant('tenant-1');
    db.legalEntity.findFirst.mockResolvedValue({
      id: 'existing-le',
      rut: '76123456-7',
    });

    const parsed = xmlParser.parseEnvioDte()[0];
    await service.processReceivedDte('tenant-1', parsed);

    expect(db.legalEntity.create).not.toHaveBeenCalled();
    expect(db.dte.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          legalEntityId: 'existing-le',
        }),
      }),
    );
  });

  it('should NOT emit redundant dte.received event (superseded by dte.xml-received)', async () => {
    const parsed = xmlParser.parseEnvioDte()[0];
    await service.processReceivedDte('tenant-1', parsed);

    expect(eventEmitter.emit).not.toHaveBeenCalledWith(
      'dte.received',
      expect.objectContaining({
        tenantId: 'tenant-1',
        dteId: 'new-dte-1',
        folio: 100,
      }),
    );
  });

  it('should accept a received DTE and generate response XMLs', async () => {
    const db = prisma.forTenant('tenant-1');
    db.dte.findUnique.mockResolvedValue({
      id: 'dte-1',
      direction: 'RECEIVED',
      status: 'ACCEPTED',
    });

    await service.acceptDte('tenant-1', 'dte-1', 'user-1');

    expect(certificateService.getPrimaryCert).toHaveBeenCalledWith('tenant-1');
    expect(exchangeResponse.generateRecepcionDte).toHaveBeenCalledWith(
      'tenant-1',
      'dte-1',
      mockCert,
    );
    expect(exchangeResponse.generateResultadoDte).toHaveBeenCalledWith(
      'tenant-1',
      'dte-1',
      true,
      mockCert,
    );
    expect(exchangeResponse.generateEnvioRecibos).toHaveBeenCalledWith(
      'tenant-1',
      'dte-1',
      mockCert,
    );

    expect(db.dte.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'ACCEPTED',
          decidedById: 'user-1',
        }),
      }),
    );
  });

  it('should reject a received DTE with reason', async () => {
    const db = prisma.forTenant('tenant-1');
    db.dte.findUnique.mockResolvedValue({
      id: 'dte-2',
      direction: 'RECEIVED',
    });

    await service.rejectDte('tenant-1', 'dte-2', 'user-1', 'Factura errónea');

    expect(db.dte.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'REJECTED',
          decidedById: 'user-1',
        }),
      }),
    );

    expect(db.dteLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'REJECTED',
          message: expect.stringContaining('Factura errónea'),
        }),
      }),
    );
  });

  it('should throw ConflictException for empty XML on upload', async () => {
    xmlParser.parseEnvioDte.mockReturnValue([]);

    await expect(
      service.uploadManual('tenant-1', '<xml/>', 'user-1'),
    ).rejects.toThrow('No se encontraron DTEs válidos');
  });
});
