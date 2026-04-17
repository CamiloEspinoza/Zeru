import { Test } from '@nestjs/testing';
import { DteBuilderService, DteBuildInput } from './dte-builder.service';

// Mock @devlas/dte-sii — the real lib pulls in native deps; we only need spies.
const generarXMLMock = jest.fn();
const timbrarMock = jest.fn();
const firmarMock = jest.fn();
const getXMLMock = jest.fn();
const dteConstructorMock = jest.fn();

const envioAgregarMock = jest.fn();
const envioGenerarMock = jest.fn();
const envioConstructorMock = jest.fn();

// Holder allowing per-test customization of the generated XML & monto.
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
      getXML: () => {
        getXMLMock();
        return state.xml;
      },
      get montoTotal() {
        return state.montoTotal;
      },
    };
  }),
  EnvioDTE: jest.fn().mockImplementation((cfg: unknown) => {
    envioConstructorMock(cfg);
    return {
      agregar: envioAgregarMock,
      generar: envioGenerarMock,
    };
  }),
  CAF: jest.fn(),
  Certificado: jest.fn(),
}));

describe('DteBuilderService', () => {
  let service: DteBuilderService;

  const fakeCaf = { _kind: 'caf' } as unknown as Parameters<
    DteBuilderService['build']
  >[1];
  const fakeCert = {
    rut: '11111111-1',
    _kind: 'cert',
  } as unknown as Parameters<DteBuilderService['build']>[2];

  const baseFacturaInput: DteBuildInput = {
    dteType: 'FACTURA_ELECTRONICA',
    folio: 101,
    fechaEmision: '2026-04-16',
    formaPago: 1,
    emisor: {
      rut: '76123456-7',
      razonSocial: 'Test SpA',
      giro: 'Servicios',
      actividadEco: 620100,
      direccion: 'Test 123',
      comuna: 'Santiago',
    },
    receptor: {
      rut: '77654321-K',
      razonSocial: 'Cliente Ltda',
      giro: 'Retail',
      direccion: 'Calle 1',
      comuna: 'Providencia',
    },
    items: [
      {
        nombre: 'Servicio A',
        cantidad: 1,
        precioUnitario: 100000,
      },
      {
        nombre: 'Servicio B',
        cantidad: 2,
        precioUnitario: 50000,
      },
    ],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    state.xml = `<DTE><Documento><TED version="1.0"><DD><F>101</F></DD></TED></Documento></DTE>`;
    state.montoTotal = 238000; // 200000 neto + 19% IVA
    envioGenerarMock.mockReturnValue('<EnvioDTE>ok</EnvioDTE>');

    const moduleRef = await Test.createTestingModule({
      providers: [DteBuilderService],
    }).compile();

    service = moduleRef.get(DteBuilderService);
  });

  it('build() returns { xml, tedXml, montoTotal } for Factura 33 with IVA 19%', () => {
    const result = service.build(baseFacturaInput, fakeCaf, fakeCert);

    expect(result.xml).toBe(state.xml);
    expect(result.montoTotal).toBe(238000);
    expect(result.tedXml).toContain('<TED');
    expect(result.tedXml).toContain('</TED>');

    // Ensure the DTE constructor was called with tipo=33 and mapped items.
    expect(dteConstructorMock).toHaveBeenCalledTimes(1);
    const cfg = dteConstructorMock.mock.calls[0][0];
    expect(cfg.tipo).toBe(33);
    expect(cfg.folio).toBe(101);
    expect(cfg.items).toHaveLength(2);
    expect(cfg.items[0].precioUnit).toBe(100000);
  });

  it('build() constructs a Nota de Crédito (61) with referencias', () => {
    const ncInput: DteBuildInput = {
      ...baseFacturaInput,
      dteType: 'NOTA_CREDITO_ELECTRONICA',
      folio: 55,
      referencias: [
        {
          tipoDocRef: 33,
          folioRef: 101,
          fechaRef: '2026-04-10',
          codRef: 1,
          razonRef: 'Anula documento',
        },
      ],
    };

    const result = service.build(ncInput, fakeCaf, fakeCert);

    expect(result.montoTotal).toBe(238000);
    const cfg = dteConstructorMock.mock.calls[0][0];
    expect(cfg.tipo).toBe(61);
    expect(cfg.referencias).toEqual([
      expect.objectContaining({
        tipoDocRef: 33,
        folioRef: 101,
        codRef: 1,
      }),
    ]);
  });

  it('build() handles Factura Exenta (34) with exempt items', () => {
    state.montoTotal = 100000; // no IVA because exenta
    const exentaInput: DteBuildInput = {
      ...baseFacturaInput,
      dteType: 'FACTURA_EXENTA_ELECTRONICA',
      items: [
        {
          nombre: 'Servicio Exento',
          cantidad: 1,
          precioUnitario: 100000,
          exento: true,
        },
      ],
    };

    const result = service.build(exentaInput, fakeCaf, fakeCert);

    expect(result.montoTotal).toBe(100000);
    const cfg = dteConstructorMock.mock.calls[0][0];
    expect(cfg.tipo).toBe(34);
    expect(cfg.items[0].exento).toBe(true);
  });

  it('build() generates TED that includes the folio', () => {
    state.xml = `<DTE><Documento><TED version="1.0"><DD><F>42</F></DD></TED></Documento></DTE>`;
    state.montoTotal = 1000;
    const result = service.build(
      { ...baseFacturaInput, folio: 42 },
      fakeCaf,
      fakeCert,
    );

    expect(result.tedXml).toMatch(/<TED[\s\S]*<\/TED>/);
    expect(result.tedXml).toContain('<F>42</F>');
    expect(timbrarMock).toHaveBeenCalledWith(fakeCaf);
    expect(firmarMock).toHaveBeenCalledWith(fakeCert);
  });

  it('build() throws if TED cannot be extracted', () => {
    state.xml = '<DTE><Documento>no TED here</Documento></DTE>';
    expect(() =>
      service.build(baseFacturaInput, fakeCaf, fakeCert),
    ).toThrow(/Timbre Electrónico/);
  });

  it('buildEnvelope() wraps signed DTEs into <EnvioDTE>', () => {
    const out = service.buildEnvelope(
      ['<DTE>a</DTE>', '<DTE>b</DTE>'],
      '76123456-7',
      '11111111-1',
      '2014-08-22',
      80,
      fakeCert,
    );

    expect(envioConstructorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        rutEmisor: '76123456-7',
        rutEnvia: '11111111-1',
        fchResol: '2014-08-22',
        nroResol: 80,
      }),
    );
    expect(envioAgregarMock).toHaveBeenCalledTimes(2);
    expect(out).toBe('<EnvioDTE>ok</EnvioDTE>');
  });
});
