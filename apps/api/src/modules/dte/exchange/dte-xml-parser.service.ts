import { Injectable, Logger } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { SII_CODE_TO_DTE_TYPE } from '../constants/dte-types.constants';

// ────────────────────────────────────────────────────────────
// Parsed output interfaces
// ────────────────────────────────────────────────────────────

export interface ParsedDte {
  tipoDTE: number;
  folio: number;
  fechaEmision: string;
  emisor: {
    rut: string;
    razonSocial: string;
    giro: string;
    direccion?: string;
    comuna?: string;
    ciudad?: string;
  };
  receptor: {
    rut: string;
    razonSocial: string;
    giro?: string;
    direccion?: string;
    comuna?: string;
  };
  totales: {
    montoNeto: number;
    montoExento: number;
    iva: number;
    montoTotal: number;
    tasaIva?: number;
  };
  items: Array<{
    lineNumber: number;
    itemName: string;
    quantity: number;
    unitPrice: number;
    montoItem: number;
    description?: string;
    indExe?: number;
  }>;
  referencias?: Array<{
    tipoDocRef: number;
    folioRef: number;
    fechaRef: string;
    codRef?: number;
    razonRef?: string;
  }>;
  tedXml: string;
  xmlContent: string;
  /** DTE type name mapped from SII_CODE_TO_DTE_TYPE, if known */
  dteTypeName?: string;
}

// ────────────────────────────────────────────────────────────
// Service
// ────────────────────────────────────────────────────────────

/**
 * Parses EnvioDTE / DTE XML documents into structured ParsedDte objects.
 *
 * SII XML structure:
 *   EnvioDTE > SetDTE > DTE[] > Documento > Encabezado, Detalle[], Referencia[]
 *   EnvioDTE > SetDTE > DTE[] > TED
 *
 * A single EnvioDTE envelope can contain multiple DTE documents.
 * This service handles both:
 *  - Full EnvioDTE envelopes (multiple DTEs)
 *  - Standalone DTE documents (single DTE without envelope)
 */
@Injectable()
export class DteXmlParserService {
  private readonly logger = new Logger(DteXmlParserService.name);

  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    // SII XML uses namespaces — remove them for easier access
    removeNSPrefix: true,
    // Preserve number-like strings as strings; we'll parse numbers explicitly
    parseTagValue: false,
    // Always return arrays for these tags even when there's only one element
    isArray: (name: string) => {
      return ['DTE', 'Detalle', 'Referencia'].includes(name);
    },
  });

  private readonly xmlBuilder = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    removeNSPrefix: true,
    parseTagValue: false,
  });

  /**
   * Parse an EnvioDTE XML string into an array of ParsedDte objects.
   * Also handles standalone DTE XML (without EnvioDTE wrapper).
   */
  parseEnvioDte(xmlContent: string): ParsedDte[] {
    const parsed = this.parser.parse(xmlContent);

    // Determine the root: EnvioDTE wrapper or standalone DTE
    let dteNodes: any[];

    if (parsed.EnvioDTE) {
      const setDte = parsed.EnvioDTE.SetDTE;
      if (!setDte) {
        this.logger.warn('EnvioDTE found but no SetDTE inside');
        return [];
      }
      dteNodes = this.ensureArray(setDte.DTE);
    } else if (parsed.DTE) {
      dteNodes = this.ensureArray(parsed.DTE);
    } else {
      this.logger.warn(
        'XML does not contain EnvioDTE or DTE root element',
      );
      return [];
    }

    const results: ParsedDte[] = [];

    for (const dteNode of dteNodes) {
      try {
        const result = this.parseSingleDte(dteNode, xmlContent);
        if (result) {
          results.push(result);
        }
      } catch (error) {
        this.logger.error(`Failed to parse individual DTE: ${error}`);
        // Continue with next DTE in the envelope
      }
    }

    this.logger.log(
      `Parsed ${results.length} DTE(s) from XML (${dteNodes.length} found in envelope)`,
    );
    return results;
  }

  /**
   * Parse a single DTE node from the XML tree.
   */
  private parseSingleDte(
    dteNode: any,
    fullXmlContent: string,
  ): ParsedDte | null {
    const documento = dteNode.Documento;
    if (!documento) {
      this.logger.warn('DTE node has no Documento child');
      return null;
    }

    const encabezado = documento.Encabezado;
    if (!encabezado) {
      this.logger.warn('Documento has no Encabezado');
      return null;
    }

    // ─── IdDoc ──────────────────────────────────────────────
    const idDoc = encabezado.IdDoc;
    const tipoDTE = this.toNumber(idDoc?.TipoDTE, 0);
    const folio = this.toNumber(idDoc?.Folio, 0);
    const fechaEmision = this.toString(idDoc?.FchEmis);

    // ─── Emisor ─────────────────────────────────────────────
    const emisorNode = encabezado.Emisor;
    const emisor = {
      rut: this.toString(emisorNode?.RUTEmisor),
      razonSocial: this.toString(emisorNode?.RznSoc || emisorNode?.RznSocEmisor),
      giro: this.toString(emisorNode?.GiroEmis || emisorNode?.GiroEmisor),
      direccion: this.toStringOptional(emisorNode?.DirOrigen),
      comuna: this.toStringOptional(emisorNode?.CmnaOrigen),
      ciudad: this.toStringOptional(emisorNode?.CiudadOrigen),
    };

    // ─── Receptor ───────────────────────────────────────────
    const receptorNode = encabezado.Receptor;
    const receptor = {
      rut: this.toString(receptorNode?.RUTRecep),
      razonSocial: this.toString(receptorNode?.RznSocRecep),
      giro: this.toStringOptional(receptorNode?.GiroRecep),
      direccion: this.toStringOptional(receptorNode?.DirRecep),
      comuna: this.toStringOptional(receptorNode?.CmnaRecep),
    };

    // ─── Totales ────────────────────────────────────────────
    const totalesNode = encabezado.Totales;
    const totales = {
      montoNeto: this.toNumber(totalesNode?.MntNeto, 0),
      montoExento: this.toNumber(totalesNode?.MntExe, 0),
      iva: this.toNumber(totalesNode?.IVA, 0),
      montoTotal: this.toNumber(totalesNode?.MntTotal, 0),
      tasaIva: this.toNumberOptional(totalesNode?.TasaIVA),
    };

    // ─── Detalle (items) ────────────────────────────────────
    const detalleNodes = this.ensureArray(documento.Detalle);
    const items = detalleNodes.map((det: any, idx: number) => ({
      lineNumber: this.toNumber(det?.NroLinDet, idx + 1),
      itemName: this.toString(det?.NmbItem),
      quantity: this.toNumber(det?.QtyItem, 1),
      unitPrice: this.toNumber(det?.PrcItem, 0),
      montoItem: this.toNumber(det?.MontoItem, 0),
      description: this.toStringOptional(det?.DscItem),
      indExe: this.toNumberOptional(det?.IndExe),
    }));

    // ─── Referencia ─────────────────────────────────────────
    const refNodes = documento.Referencia
      ? this.ensureArray(documento.Referencia)
      : [];
    const referencias =
      refNodes.length > 0
        ? refNodes.map((ref: any) => ({
            tipoDocRef: this.toNumber(ref?.TpoDocRef, 0),
            folioRef: this.toNumber(ref?.FolioRef, 0),
            fechaRef: this.toString(ref?.FchRef),
            codRef: this.toNumberOptional(ref?.CodRef),
            razonRef: this.toStringOptional(ref?.RazonRef),
          }))
        : undefined;

    // ─── TED (Timbre Electrónico) ───────────────────────────
    const tedXml = this.extractTedXml(dteNode, fullXmlContent);

    // ─── Individual DTE XML content ─────────────────────────
    const dteXmlContent = this.extractDteXml(fullXmlContent, folio, tipoDTE);

    return {
      tipoDTE,
      folio,
      fechaEmision,
      emisor,
      receptor,
      totales,
      items,
      referencias,
      tedXml,
      xmlContent: dteXmlContent,
      dteTypeName: SII_CODE_TO_DTE_TYPE[tipoDTE],
    };
  }

  /**
   * Extract the raw TED XML string from the full document.
   * We need the original XML (not re-serialized) to preserve the digital signature.
   */
  private extractTedXml(dteNode: any, fullXml: string): string {
    // Try to extract from the raw XML using regex — preserves original formatting
    const tedMatch = fullXml.match(/<TED[\s>][\s\S]*?<\/TED>/);
    if (tedMatch) {
      return tedMatch[0];
    }

    // Fallback: if the node has TED data, return a note
    if (dteNode.TED) {
      this.logger.warn(
        'Could not extract raw TED XML; parsed node exists but raw extraction failed',
      );
    }

    return '';
  }

  /**
   * Extract the individual DTE XML from the full envelope.
   * When multiple DTEs are in the envelope, we extract by matching folio+type.
   */
  private extractDteXml(
    fullXml: string,
    folio: number,
    tipoDTE: number,
  ): string {
    // Try to extract the individual <DTE>...</DTE> block
    const dteRegex = /<DTE[\s>][\s\S]*?<\/DTE>/g;
    let match: RegExpExecArray | null;

    while ((match = dteRegex.exec(fullXml)) !== null) {
      const dteBlock = match[0];
      // Check if this block contains our folio and type
      if (
        dteBlock.includes(`<Folio>${folio}</Folio>`) &&
        dteBlock.includes(`<TipoDTE>${tipoDTE}</TipoDTE>`)
      ) {
        return dteBlock;
      }
    }

    // Fallback: if there's only one DTE, or we couldn't match, return the whole XML
    return fullXml;
  }

  // ────────────────────────────────────────────────────────────
  // Type coercion helpers (SII XML values can be strings or missing)
  // ────────────────────────────────────────────────────────────

  private ensureArray<T>(value: T | T[] | undefined | null): T[] {
    if (value == null) return [];
    return Array.isArray(value) ? value : [value];
  }

  private toNumber(value: unknown, fallback: number): number {
    if (value == null) return fallback;
    const num = Number(value);
    return isNaN(num) ? fallback : num;
  }

  private toNumberOptional(value: unknown): number | undefined {
    if (value == null) return undefined;
    const num = Number(value);
    return isNaN(num) ? undefined : num;
  }

  private toString(value: unknown): string {
    if (value == null) return '';
    return String(value).trim();
  }

  private toStringOptional(value: unknown): string | undefined {
    if (value == null) return undefined;
    const str = String(value).trim();
    return str.length > 0 ? str : undefined;
  }
}
