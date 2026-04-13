import { Test } from '@nestjs/testing';
import { DteXmlParserService } from './dte-xml-parser.service';

describe('DteXmlParserService', () => {
  let service: DteXmlParserService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [DteXmlParserService],
    }).compile();

    service = module.get(DteXmlParserService);
  });

  const FACTURA_XML = `<?xml version="1.0" encoding="ISO-8859-1"?>
<EnvioDTE version="1.0">
  <SetDTE>
    <DTE>
      <Documento>
        <Encabezado>
          <IdDoc>
            <TipoDTE>33</TipoDTE>
            <Folio>12345</Folio>
            <FchEmis>2026-04-10</FchEmis>
          </IdDoc>
          <Emisor>
            <RUTEmisor>76123456-7</RUTEmisor>
            <RznSoc>Empresa Test SpA</RznSoc>
            <GiroEmis>Servicios TI</GiroEmis>
            <DirOrigen>Av. Test 123</DirOrigen>
            <CmnaOrigen>Santiago</CmnaOrigen>
          </Emisor>
          <Receptor>
            <RUTRecep>77654321-K</RUTRecep>
            <RznSocRecep>Receptor SpA</RznSocRecep>
            <GiroRecep>Comercio</GiroRecep>
          </Receptor>
          <Totales>
            <MntNeto>100000</MntNeto>
            <MntExe>0</MntExe>
            <TasaIVA>19</TasaIVA>
            <IVA>19000</IVA>
            <MntTotal>119000</MntTotal>
          </Totales>
        </Encabezado>
        <Detalle>
          <NroLinDet>1</NroLinDet>
          <NmbItem>Servicio de consultoria</NmbItem>
          <QtyItem>1</QtyItem>
          <PrcItem>100000</PrcItem>
          <MontoItem>100000</MontoItem>
        </Detalle>
      </Documento>
      <TED version="1.0">
        <DD>
          <RE>76123456-7</RE>
          <TD>33</TD>
          <F>12345</F>
        </DD>
      </TED>
    </DTE>
  </SetDTE>
</EnvioDTE>`;

  it('should parse a single DTE from EnvioDTE envelope', () => {
    const results = service.parseEnvioDte(FACTURA_XML);

    expect(results).toHaveLength(1);
    const dte = results[0];
    expect(dte.tipoDTE).toBe(33);
    expect(dte.folio).toBe(12345);
    expect(dte.fechaEmision).toBe('2026-04-10');
    expect(dte.emisor.rut).toBe('76123456-7');
    expect(dte.emisor.razonSocial).toBe('Empresa Test SpA');
    expect(dte.receptor.rut).toBe('77654321-K');
    expect(dte.totales.montoNeto).toBe(100000);
    expect(dte.totales.iva).toBe(19000);
    expect(dte.totales.montoTotal).toBe(119000);
    expect(dte.items).toHaveLength(1);
    expect(dte.items[0].itemName).toBe('Servicio de consultoria');
    expect(dte.dteTypeName).toBe('FACTURA_ELECTRONICA');
  });

  it('should handle standalone DTE XML (no EnvioDTE wrapper)', () => {
    const standaloneXml = `<?xml version="1.0" encoding="ISO-8859-1"?>
<DTE>
  <Documento>
    <Encabezado>
      <IdDoc>
        <TipoDTE>61</TipoDTE>
        <Folio>500</Folio>
        <FchEmis>2026-04-12</FchEmis>
      </IdDoc>
      <Emisor>
        <RUTEmisor>76111222-3</RUTEmisor>
        <RznSoc>NC Emisor</RznSoc>
        <GiroEmis>Retail</GiroEmis>
      </Emisor>
      <Receptor>
        <RUTRecep>77333444-5</RUTRecep>
        <RznSocRecep>NC Receptor</RznSocRecep>
      </Receptor>
      <Totales>
        <MntNeto>50000</MntNeto>
        <IVA>9500</IVA>
        <MntTotal>59500</MntTotal>
      </Totales>
    </Encabezado>
    <Detalle>
      <NroLinDet>1</NroLinDet>
      <NmbItem>Devolucion</NmbItem>
      <QtyItem>1</QtyItem>
      <PrcItem>50000</PrcItem>
      <MontoItem>50000</MontoItem>
    </Detalle>
    <Referencia>
      <TpoDocRef>33</TpoDocRef>
      <FolioRef>12345</FolioRef>
      <FchRef>2026-04-10</FchRef>
      <CodRef>1</CodRef>
      <RazonRef>Anula documento</RazonRef>
    </Referencia>
  </Documento>
</DTE>`;

    const results = service.parseEnvioDte(standaloneXml);

    expect(results).toHaveLength(1);
    const dte = results[0];
    expect(dte.tipoDTE).toBe(61);
    expect(dte.folio).toBe(500);
    expect(dte.dteTypeName).toBe('NOTA_CREDITO_ELECTRONICA');
    expect(dte.referencias).toHaveLength(1);
    expect(dte.referencias![0].tipoDocRef).toBe(33);
    expect(dte.referencias![0].codRef).toBe(1);
  });

  it('should return empty array for invalid XML', () => {
    const results = service.parseEnvioDte('<html><body>Not XML</body></html>');
    expect(results).toHaveLength(0);
  });

  it('should extract TED XML preserving original format', () => {
    const results = service.parseEnvioDte(FACTURA_XML);
    expect(results[0].tedXml).toContain('<TED');
    expect(results[0].tedXml).toContain('</TED>');
  });
});
