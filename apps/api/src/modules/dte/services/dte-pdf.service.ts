import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';
import { BrowserPoolService } from '../../browser/browser-pool.service';
import { Pdf417Service } from './pdf417.service';
import {
  DTE_TYPE_NAMES,
  DTE_TYPE_TO_SII_CODE,
} from '../constants/dte-types.constants';
import { COMMERCIALLY_USABLE_STATES } from '../constants/state-machine.constants';
import * as Handlebars from 'handlebars';
import { readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class DtePdfService {
  private readonly logger = new Logger(DtePdfService.name);
  private templates: Record<string, HandlebarsTemplateDelegate> = {};

  constructor(
    private readonly prisma: PrismaService,
    private readonly browserPool: BrowserPoolService,
    private readonly pdf417: Pdf417Service,
  ) {
    this.loadTemplates();
  }

  private loadTemplates() {
    Handlebars.registerHelper('formatNumber', (num: number) => {
      if (num == null) return '';
      return new Intl.NumberFormat('es-CL').format(num);
    });

    const templatesDir = join(__dirname, '..', 'templates');
    const templateNames = ['factura', 'boleta', 'boleta-thermal'];

    for (const name of templateNames) {
      try {
        const source = readFileSync(
          join(templatesDir, `${name}.hbs`),
          'utf-8',
        );
        this.templates[name] = Handlebars.compile(source);
      } catch (error) {
        this.logger.warn(`Template ${name}.hbs not found: ${error.message}`);
      }
    }
  }

  async generatePdf(
    tenantId: string,
    dteId: string,
    format: 'standard' | 'thermal' = 'standard',
  ): Promise<Buffer> {
    if (!this.browserPool.isAvailable()) {
      throw new BadRequestException(
        'Generación de PDF no disponible (Puppeteer no inicializado)',
      );
    }

    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const dte = await db.dte.findUniqueOrThrow({
      where: { id: dteId },
      include: { items: true, references: true },
    });

    if (!COMMERCIALLY_USABLE_STATES.includes(dte.status)) {
      throw new BadRequestException(
        `No se puede generar PDF para DTE en estado ${dte.status}`,
      );
    }

    // Generate PDF417 barcode from TED
    let pdf417Base64 = '';
    if (dte.tedXml) {
      pdf417Base64 = await this.pdf417.generate(dte.tedXml);
    }

    // Select template
    const siiCode = DTE_TYPE_TO_SII_CODE[dte.dteType] || 0;
    const isBoleta = [39, 41].includes(siiCode);
    let templateName: string;

    if (format === 'thermal') {
      templateName = 'boleta-thermal';
    } else if (isBoleta) {
      templateName = 'boleta';
    } else {
      templateName = 'factura';
    }

    const template = this.templates[templateName];
    if (!template) {
      throw new BadRequestException(`Template ${templateName} no disponible`);
    }

    const formaPagoNames: Record<number, string> = {
      1: 'Contado',
      2: 'Crédito',
      3: 'Sin Costo',
    };

    // Render HTML
    const html = template({
      emisor: {
        rut: dte.emisorRut,
        razonSocial: dte.emisorRazon,
        giro: dte.emisorGiro,
        direccion: '',
        comuna: '',
        ciudad: '',
      },
      receptor: {
        rut: dte.receptorRut,
        razonSocial: dte.receptorRazon,
        giro: dte.receptorGiro,
        direccion: dte.receptorDir,
        comuna: dte.receptorComuna,
      },
      tipoDteNombre: DTE_TYPE_NAMES[siiCode] || dte.dteType,
      folio: dte.folio,
      fechaEmision: dte.fechaEmision.toISOString().split('T')[0],
      fechaVenc: dte.fechaVenc?.toISOString().split('T')[0],
      formaPagoNombre: dte.formaPago
        ? formaPagoNames[dte.formaPago]
        : undefined,
      items: dte.items.map((item) => ({
        lineNumber: item.lineNumber,
        itemName: item.itemName,
        description: item.description,
        quantity: Number(item.quantity),
        unit: item.unit,
        unitPrice: Number(item.unitPrice),
        discount: item.descuentoMonto ? Number(item.descuentoMonto) : undefined,
        montoItem: Number(item.montoItem),
      })),
      montoNeto: dte.montoNeto || undefined,
      montoExento: dte.montoExento || undefined,
      tasaIva: Number(dte.tasaIva),
      iva: dte.iva || undefined,
      montoTotal: dte.montoTotal,
      references: dte.references.map((ref) => ({
        tipoDocNombre:
          DTE_TYPE_NAMES[ref.tipoDocRef] || `Tipo ${ref.tipoDocRef}`,
        folioRef: ref.folioRef,
        fechaRef: ref.fechaRef.toISOString().split('T')[0],
        razonRef: ref.razonRef,
      })),
      pdf417Base64,
      resolutionNum: '',
      resolutionDate: '',
      isBoleta,
      branding: { logoUrl: undefined },
    });

    // HTML -> PDF via Puppeteer
    const page = await this.browserPool.acquire();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });

      if (format === 'thermal') {
        return (await page.pdf({
          width: '80mm',
          printBackground: true,
          margin: { top: '2mm', bottom: '2mm', left: '2mm', right: '2mm' },
        })) as Buffer;
      }

      return (await page.pdf({
        format: 'Letter',
        printBackground: true,
        margin: {
          top: '10mm',
          bottom: '10mm',
          left: '10mm',
          right: '10mm',
        },
      })) as Buffer;
    } finally {
      await this.browserPool.release(page);
    }
  }
}
