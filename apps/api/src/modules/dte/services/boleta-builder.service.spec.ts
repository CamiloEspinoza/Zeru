import { Test } from '@nestjs/testing';
import {
  BoletaBuilderService,
  BoletaBuildInput,
} from './boleta-builder.service';

// Mock @devlas/dte-sii for boleta builder specs.
const generarXMLMock = jest.fn();
const timbrarMock = jest.fn();
const firmarMock = jest.fn();
const dteConstructorMock = jest.fn();

const buildEmisorBoletaMock = jest.fn((cfg: unknown) => ({
  _kind: 'emisor',
  cfg,
}));
const buildReceptorBoletaMock = jest.fn((cfg: unknown) => ({
  _kind: 'receptor',
  cfg,
}));

const envioAgregarMock = jest.fn();
const envioGenerarMock = jest.fn();
const envioConstructorMock = jest.fn();

const state: { xml: string; montoTotal: number } = {
  xml: '',
  montoTotal: 0,
};

jest.mock('@devlas/dte-sii', () => ({
  DTE: jest.fn().mockImplementation((cfg: unknown) => {
    dteConstructorMock(cfg);
    return {
      generarXML: generarXMLMock,
      timbrar: timbrarMock,
      firmar: firmarMock,
      getXML: () => state.xml,
      get montoTotal() {
        return state.montoTotal;
      },
    };
  }),
  EnvioBOLETA: jest.fn().mockImplementation((cfg: unknown) => {
    envioConstructorMock(cfg);
    return {
      agregar: envioAgregarMock,
      generar: envioGenerarMock,
    };
  }),
  buildEmisorBoleta: (cfg: unknown) => buildEmisorBoletaMock(cfg),
  buildReceptorBoleta: (cfg: unknown) => buildReceptorBoletaMock(cfg),
  CAF: jest.fn(),
  Certificado: jest.fn(),
}));

describe('BoletaBuilderService', () => {
  let service: BoletaBuilderService;

  const fakeCaf = { _kind: 'caf' } as unknown as Parameters<
    BoletaBuilderService['build']
  >[1];
  const fakeCert = {
    rut: '11111111-1',
  } as unknown as Parameters<BoletaBuilderService['build']>[2];

  const baseBoletaInput: BoletaBuildInput = {
    dteType: 'BOLETA_ELECTRONICA',
    folio: 10,
    fechaEmision: '2026-04-16',
    emisor: {
      rut: '76123456-7',
      razonSocial: 'Test SpA',
      giro: 'Retail',
      actividadEco: 479100,
      direccion: 'Av. Siempre Viva 123',
      comuna: 'Santiago',
    },
    items: [
      {
        nombre: 'Producto X',
        cantidad: 1,
        precioUnitario: 1190, // bruto (IVA incluido)
      },
    ],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    state.xml = `<DTE><Documento><TED><DD><F>10</F></DD></TED></Documento></DTE>`;
    state.montoTotal = 1190;
    envioGenerarMock.mockReturnValue('<EnvioBOLETA>ok</EnvioBOLETA>');

    const moduleRef = await Test.createTestingModule({
      providers: [BoletaBuilderService],
    }).compile();

    service = moduleRef.get(BoletaBuilderService);
  });

  it('build() constructs Boleta Electrónica (39) with bruto pricing', () => {
    const result = service.build(baseBoletaInput, fakeCaf, fakeCert);

    expect(result.montoTotal).toBe(1190);
    expect(result.tedXml).toContain('<TED');
    const cfg = dteConstructorMock.mock.calls[0][0];
    expect(cfg.tipo).toBe(39);
    // Boleta uses `precio` (bruto) not `precioUnit`.
    expect(cfg.items[0].precio).toBe(1190);
    expect(cfg.items[0].exento).toBe(false);
  });

  it('build() constructs Boleta Exenta (41) without IVA', () => {
    state.montoTotal = 1000;
    const exentaInput: BoletaBuildInput = {
      ...baseBoletaInput,
      dteType: 'BOLETA_EXENTA_ELECTRONICA',
      items: [
        {
          nombre: 'Servicio exento',
          cantidad: 1,
          precioUnitario: 1000,
          exento: true,
        },
      ],
    };

    const result = service.build(exentaInput, fakeCaf, fakeCert);

    expect(result.montoTotal).toBe(1000);
    const cfg = dteConstructorMock.mock.calls[0][0];
    expect(cfg.tipo).toBe(41);
    expect(cfg.items[0].exento).toBe(true);
  });

  it('build() supports optional receptor (consumidor final)', () => {
    const noReceptorInput: BoletaBuildInput = {
      ...baseBoletaInput,
      receptor: undefined,
    };

    service.build(noReceptorInput, fakeCaf, fakeCert);

    // When no receptor is supplied, buildReceptorBoleta() is called with undefined.
    expect(buildReceptorBoletaMock).toHaveBeenCalledWith(undefined);
    expect(buildEmisorBoletaMock).toHaveBeenCalledWith(
      expect.objectContaining({ rut: '76123456-7' }),
    );
  });

  it('build() forwards receptor when provided', () => {
    const withReceptor: BoletaBuildInput = {
      ...baseBoletaInput,
      receptor: {
        rut: '99999999-9',
        razonSocial: 'Pedro Perez',
      },
    };

    service.build(withReceptor, fakeCaf, fakeCert);

    expect(buildReceptorBoletaMock).toHaveBeenCalledWith(
      expect.objectContaining({ rut: '99999999-9' }),
    );
  });

  it('build() rejects non-boleta tipos', () => {
    const bad: BoletaBuildInput = {
      ...baseBoletaInput,
      dteType: 'FACTURA_ELECTRONICA',
    };
    expect(() => service.build(bad, fakeCaf, fakeCert)).toThrow(
      /only supports tipo 39 and 41/,
    );
  });

  it('buildEnvelope() wraps boleta XMLs and enforces max 50 per envelope', () => {
    const out = service.buildEnvelope(
      ['<DTE>a</DTE>', '<DTE>b</DTE>'],
      {
        emisorRut: '76123456-7',
        enviaRut: '11111111-1',
        resolutionDate: '2014-08-22',
        resolutionNum: 80,
      },
      fakeCert,
    );
    expect(envioAgregarMock).toHaveBeenCalledTimes(2);
    expect(out).toBe('<EnvioBOLETA>ok</EnvioBOLETA>');

    const tooMany = Array.from({ length: 51 }).map((_, i) => `<DTE>${i}</DTE>`);
    expect(() =>
      service.buildEnvelope(
        tooMany,
        {
          emisorRut: '76123456-7',
          enviaRut: '11111111-1',
          resolutionDate: '2014-08-22',
          resolutionNum: 80,
        },
        fakeCert,
      ),
    ).toThrow(/Cannot exceed 50 boletas/);

    expect(() =>
      service.buildEnvelope(
        [],
        {
          emisorRut: '76123456-7',
          enviaRut: '11111111-1',
          resolutionDate: '2014-08-22',
          resolutionNum: 80,
        },
        fakeCert,
      ),
    ).toThrow(/zero boletas/);
  });
});
