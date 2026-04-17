import { Test } from '@nestjs/testing';
import { RcofService } from './rcof.service';
import { DteConfigService } from './dte-config.service';
import { CertificateService } from '../certificate/certificate.service';
import { PrismaService } from '../../../prisma/prisma.service';

// Mock ConsumoFolio from @devlas/dte-sii: capture calls to setCaratula/agregar/generar.
const setCaratulaMock = jest.fn();
const agregarMock = jest.fn();
const generarMock = jest.fn();
const consumoFolioCtorMock = jest.fn();

jest.mock('@devlas/dte-sii', () => ({
  ConsumoFolio: jest.fn().mockImplementation((cert: unknown) => {
    consumoFolioCtorMock(cert);
    return {
      setCaratula: setCaratulaMock,
      agregar: agregarMock,
      generar: generarMock,
    };
  }),
}));

describe('RcofService', () => {
  let service: RcofService;
  let prisma: { forTenant: jest.Mock };
  let tenantDb: {
    dte: { findMany: jest.Mock };
    dteRcof: { upsert: jest.Mock };
  };
  let configService: { get: jest.Mock };
  let certService: { getPrimaryCert: jest.Mock };

  const makeBoleta = (overrides: Record<string, unknown> = {}) => ({
    folio: 1,
    dteType: 'BOLETA_ELECTRONICA',
    status: 'ACCEPTED',
    fechaEmision: new Date('2026-04-16'),
    montoNeto: 0,
    iva: 0,
    montoExento: 0,
    montoTotal: 1190,
    tasaIva: 19,
    folioReleased: false,
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    generarMock.mockReturnValue('<ConsumoFolios>ok</ConsumoFolios>');

    tenantDb = {
      dte: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      dteRcof: {
        upsert: jest.fn().mockResolvedValue({ id: 'rcof-1' }),
      },
    };

    prisma = {
      forTenant: jest.fn().mockReturnValue(tenantDb),
    };

    configService = {
      get: jest.fn().mockResolvedValue({
        rut: '76123456-7',
        resolutionNum: 80,
        resolutionDate: new Date('2014-08-22'),
      }),
    };

    certService = {
      getPrimaryCert: jest
        .fn()
        .mockResolvedValue({ rut: '11111111-1', _kind: 'cert' }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RcofService,
        { provide: PrismaService, useValue: prisma },
        { provide: DteConfigService, useValue: configService },
        { provide: CertificateService, useValue: certService },
      ],
    }).compile();

    service = moduleRef.get(RcofService);
  });

  it('generate() returns { xml, summary } with empty RCOF when no boletas', async () => {
    const result = await service.generate(
      'tenant-1',
      new Date('2026-04-16'),
      1,
    );

    expect(result.xml).toBe('<ConsumoFolios>ok</ConsumoFolios>');
    expect(result.summary).toEqual([]);
    // setCaratula still called with proper fields.
    expect(setCaratulaMock).toHaveBeenCalledWith(
      expect.objectContaining({
        RutEmisor: '76123456-7',
        RutEnvia: '11111111-1',
        FchResol: '2014-08-22',
        NroResol: 80,
        SecEnvio: 1,
      }),
    );
  });

  it('generate() computes summary for mix of emitted + voided boletas', async () => {
    tenantDb.dte.findMany.mockResolvedValueOnce([
      makeBoleta({ folio: 1, status: 'ACCEPTED' }),
      makeBoleta({ folio: 2, status: 'SENT' }),
      makeBoleta({ folio: 3, status: 'VOIDED' }),
    ]);
    // Second call (releasedBoletas): empty.
    tenantDb.dte.findMany.mockResolvedValueOnce([]);

    const result = await service.generate('tenant-1', new Date('2026-04-16'));

    expect(result.summary).toHaveLength(1);
    expect(result.summary[0]).toMatchObject({
      tipoDte: 39,
      emitidos: 2,
      anulados: 1,
      rangoDesde: 1,
      rangoHasta: 3,
      montoTotal: 1190 * 2, // voided excluded from montoTotal
    });
    expect(agregarMock).toHaveBeenCalledTimes(3);
  });

  it('generate() reports Boleta Exenta (41) with MntNeto=0 and IVA=0', async () => {
    tenantDb.dte.findMany.mockResolvedValueOnce([
      makeBoleta({
        dteType: 'BOLETA_EXENTA_ELECTRONICA',
        folio: 5,
        montoTotal: 500,
        montoExento: 500,
      }),
    ]);
    tenantDb.dte.findMany.mockResolvedValueOnce([]);

    const result = await service.generate('tenant-1', new Date('2026-04-16'));

    expect(result.summary[0].tipoDte).toBe(41);
    // Inspect what was passed to rcof.agregar(tipoDte, parsed).
    expect(agregarMock).toHaveBeenCalledWith(
      41,
      expect.objectContaining({
        Encabezado: expect.objectContaining({
          Totales: expect.objectContaining({
            MntNeto: 0,
            IVA: 0,
            MntExe: 500,
            MntTotal: 500,
          }),
        }),
      }),
    );
  });

  it('generate() derives MntNeto/IVA from MntTotal when they are zero', async () => {
    tenantDb.dte.findMany.mockResolvedValueOnce([
      makeBoleta({
        folio: 7,
        montoTotal: 1190,
        montoNeto: 0,
        iva: 0,
        tasaIva: 19,
      }),
    ]);
    tenantDb.dte.findMany.mockResolvedValueOnce([]);

    await service.generate('tenant-1', new Date('2026-04-16'));

    // Expect 1190 / 1.19 ≈ 1000 and IVA = 190.
    expect(agregarMock).toHaveBeenCalledWith(
      39,
      expect.objectContaining({
        Encabezado: expect.objectContaining({
          Totales: expect.objectContaining({
            MntNeto: 1000,
            IVA: 190,
            MntTotal: 1190,
          }),
        }),
      }),
    );
  });

  it('generate() invokes ConsumoFolio(cert) and setCaratula correctly', async () => {
    await service.generate('tenant-1', new Date('2026-04-16'), 7);
    // Constructor receives the certificate.
    expect(consumoFolioCtorMock).toHaveBeenCalledWith(
      expect.objectContaining({ rut: '11111111-1' }),
    );
    // Carátula includes secEnvio we passed.
    expect(setCaratulaMock).toHaveBeenCalledWith(
      expect.objectContaining({ SecEnvio: 7 }),
    );
  });

  it('save() upserts the RCOF record for the tenant+date+environment', async () => {
    await service.save(
      'tenant-1',
      new Date('2026-04-16T10:00:00.000Z'),
      'CERTIFICATION',
      '<xml/>',
      [
        {
          tipoDte: 39,
          emitidos: 2,
          anulados: 0,
          rangoDesde: 1,
          rangoHasta: 2,
          montoTotal: 2380,
        },
      ],
    );

    expect(tenantDb.dteRcof.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId_date_environment: expect.objectContaining({
            tenantId: 'tenant-1',
            environment: 'CERTIFICATION',
          }),
        }),
        create: expect.objectContaining({
          status: 'GENERATED',
          xmlContent: '<xml/>',
        }),
        update: expect.objectContaining({
          status: 'GENERATED',
          xmlContent: '<xml/>',
        }),
      }),
    );
  });
});
