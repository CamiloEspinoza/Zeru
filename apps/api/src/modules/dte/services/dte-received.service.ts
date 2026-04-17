import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient, DteStatus, ExchangeStatus } from '@prisma/client';
import { DteXmlParserService, ParsedDte } from '../exchange/dte-xml-parser.service';
import {
  DteValidationService,
  ValidationResult,
} from '../exchange/dte-validation.service';
import { ExchangeResponseService } from '../exchange/exchange-response.service';
import { CertificateService } from '../certificate/certificate.service';
import { XmlSanitizerService } from './xml-sanitizer.service';
import {
  SII_CODE_TO_DTE_TYPE,
  DTE_TYPE_TO_SII_CODE,
} from '../constants/dte-types.constants';
import { ImapXmlReceivedPayload } from '../exchange/imap-polling.service';
import { SiiReclamoService, ReclamoAction } from '../sii/sii-reclamo.service';

export interface ReceivedDteResult {
  dteId: string;
  validation: ValidationResult;
  isNew: boolean;
}

@Injectable()
export class DteReceivedService {
  private readonly logger = new Logger(DteReceivedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly xmlParser: DteXmlParserService,
    private readonly validationService: DteValidationService,
    private readonly exchangeResponse: ExchangeResponseService,
    private readonly certificateService: CertificateService,
    private readonly xmlSanitizer: XmlSanitizerService,
    private readonly eventEmitter: EventEmitter2,
    private readonly siiReclamoService: SiiReclamoService,
  ) {}

  /**
   * Handles the dte.xml-received event emitted by ImapPollingService.
   * Parses the XML, validates each DTE, and persists them.
   */
  @OnEvent('dte.xml-received')
  async handleXmlReceived(payload: ImapXmlReceivedPayload): Promise<void> {
    const { tenantId, xmlContent, fromEmail } = payload;

    this.logger.log(
      `Processing received XML from ${fromEmail} for tenant ${tenantId}`,
    );

    this.xmlSanitizer.validateNoInjection(xmlContent);

    const parsedDtes = this.xmlParser.parseEnvioDte(xmlContent);

    if (parsedDtes.length === 0) {
      this.logger.warn(`No DTEs found in XML from ${fromEmail}`);
      return;
    }

    for (const parsed of parsedDtes) {
      try {
        await this.processReceivedDte(tenantId, parsed, fromEmail);
      } catch (error) {
        this.logger.error(
          `Failed to process received DTE tipo=${parsed.tipoDTE} folio=${parsed.folio}: ${error}`,
        );
      }
    }
  }

  /**
   * Process a single received DTE: validate, persist, link LegalEntity.
   */
  async processReceivedDte(
    tenantId: string,
    parsed: ParsedDte,
    fromEmail?: string,
  ): Promise<ReceivedDteResult> {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    // Validate the received DTE
    const validation = await this.validationService.validate(parsed, tenantId);

    // Check for duplicates
    const dteTypeName = SII_CODE_TO_DTE_TYPE[parsed.tipoDTE];
    if (dteTypeName) {
      const existing = await db.dte.findFirst({
        where: {
          tenantId,
          dteType: dteTypeName as any,
          folio: parsed.folio,
          emisorRut: parsed.emisor.rut,
          direction: 'RECEIVED',
        },
        select: { id: true },
      });

      if (existing) {
        this.logger.log(
          `DTE tipo=${parsed.tipoDTE} folio=${parsed.folio} from ${parsed.emisor.rut} already exists (${existing.id})`,
        );
        return { dteId: existing.id, validation, isNew: false };
      }
    }

    // Auto-link or create LegalEntity for the emisor
    const legalEntityId = await this.findOrCreateLegalEntity(
      db,
      tenantId,
      parsed.emisor,
    );

    // Persist the received DTE
    const now = new Date();
    const dte = await db.dte.create({
      data: {
        dteType: (dteTypeName as any) ?? 'FACTURA_ELECTRONICA',
        folio: parsed.folio,
        environment: 'PRODUCTION',
        status: validation.valid ? 'ACCEPTED' : 'ERROR',
        direction: 'RECEIVED',

        emisorRut: parsed.emisor.rut,
        emisorRazon: parsed.emisor.razonSocial,
        emisorGiro: parsed.emisor.giro,

        receptorRut: parsed.receptor.rut,
        receptorRazon: parsed.receptor.razonSocial,
        receptorGiro: parsed.receptor.giro,
        receptorDir: parsed.receptor.direccion,
        receptorComuna: parsed.receptor.comuna,

        montoNeto: parsed.totales.montoNeto,
        montoExento: parsed.totales.montoExento,
        iva: parsed.totales.iva,
        montoTotal: parsed.totales.montoTotal,
        tasaIva: parsed.totales.tasaIva ?? 19,

        fechaEmision: new Date(parsed.fechaEmision),
        xmlContent: parsed.xmlContent,
        tedXml: parsed.tedXml,

        receptionDate: now,
        deadlineDate: validation.deadlineDate,

        legalEntityId,
        tenantId,

        items: {
          create: parsed.items.map((item) => ({
            lineNumber: item.lineNumber,
            itemName: item.itemName,
            description: item.description,
            indExe: item.indExe,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            montoItem: item.montoItem,
          })),
        },

        references: parsed.referencias
          ? {
              create: parsed.referencias.map((ref, idx) => ({
                lineNumber: idx + 1,
                tipoDocRef: ref.tipoDocRef,
                folioRef: ref.folioRef,
                fechaRef: new Date(ref.fechaRef),
                codRef: ref.codRef
                  ? (this.mapCodRef(ref.codRef) as any)
                  : undefined,
                razonRef: ref.razonRef,
              })),
            }
          : undefined,

        logs: {
          create: {
            action: 'CREATED',
            message: `DTE recibido via ${fromEmail ? `email de ${fromEmail}` : 'upload manual'}`,
            metadata: validation.valid
              ? undefined
              : { errors: validation.errors, warnings: validation.warnings },
          },
        },

        exchanges: {
          create: {
            status: 'PENDING_SEND' as ExchangeStatus,
            recipientEmail: fromEmail ?? '',
            deadlineAt: validation.deadlineDate,
            tenantId,
          },
        },
      },
    });

    this.logger.log(
      `Persisted received DTE ${dte.id}: tipo=${parsed.tipoDTE} folio=${parsed.folio} from ${parsed.emisor.rut} (valid=${validation.valid})`,
    );

    // Note: 'dte.received' emit removed — 'dte.xml-received' covers the
    // notification path and no other listener consumed this redundant event.

    return { dteId: dte.id, validation, isNew: true };
  }

  /**
   * Manually upload an XML file as a received DTE.
   */
  async uploadManual(
    tenantId: string,
    xmlContent: string,
    _userId: string,
  ): Promise<ReceivedDteResult[]> {
    this.xmlSanitizer.validateNoInjection(xmlContent);

    const parsedDtes = this.xmlParser.parseEnvioDte(xmlContent);

    if (parsedDtes.length === 0) {
      throw new ConflictException(
        'No se encontraron DTEs válidos en el XML proporcionado',
      );
    }

    const results: ReceivedDteResult[] = [];
    for (const parsed of parsedDtes) {
      const result = await this.processReceivedDte(tenantId, parsed);
      results.push(result);
    }

    return results;
  }

  /**
   * Accept a received DTE: send RecepcionDTE + EnvioRecibos responses.
   */
  async acceptDte(
    tenantId: string,
    dteId: string,
    userId: string,
  ): Promise<void> {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const dte = await db.dte.findUnique({
      where: { id: dteId },
      select: {
        id: true,
        direction: true,
        status: true,
        deadlineDate: true,
        dteType: true,
        folio: true,
        emisorRut: true,
      },
    });

    if (!dte) throw new NotFoundException(`DTE ${dteId} no encontrado`);
    if (dte.direction !== 'RECEIVED') {
      throw new ConflictException('Solo se pueden aceptar DTEs recibidos');
    }

    // Load certificate for XML signing
    const cert = await this.certificateService.getPrimaryCert(tenantId);

    // Generate signed response XMLs
    const recepcionXml = await this.exchangeResponse.generateRecepcionDte(
      tenantId,
      dteId,
      cert,
    );
    const resultadoXml = await this.exchangeResponse.generateResultadoDte(
      tenantId,
      dteId,
      true,
      cert,
    );
    const recibosXml = await this.exchangeResponse.generateEnvioRecibos(
      tenantId,
      dteId,
      cert,
    );

    // Update DTE status and log
    await db.dte.update({
      where: { id: dteId },
      data: {
        status: 'ACCEPTED',
        decidedAt: new Date(),
        decidedById: userId,
      },
    });

    // Update exchange status
    await db.dteExchange.updateMany({
      where: { dteId, tenantId },
      data: { status: 'ACCEPTED' as ExchangeStatus },
    });

    // Log exchange events
    const exchange = await db.dteExchange.findFirst({
      where: { dteId, tenantId },
    });

    if (exchange) {
      await db.dteExchangeEvent.createMany({
        data: [
          {
            exchangeId: exchange.id,
            eventType: 'RECEPCION_DTE',
            xmlContent: recepcionXml,
          },
          {
            exchangeId: exchange.id,
            eventType: 'RESULTADO_DTE',
            xmlContent: resultadoXml,
          },
          {
            exchangeId: exchange.id,
            eventType: 'ENVIO_RECIBOS',
            xmlContent: recibosXml,
          },
        ],
      });
    }

    await db.dteLog.create({
      data: {
        dteId,
        action: 'ACCEPTED',
        message: 'DTE aceptado por el usuario',
        actorId: userId,
      },
    });

    this.eventEmitter.emit('dte.received.accepted', {
      tenantId,
      dteId,
    });

    // Register the acceptance at the SII (RegistroReclamoDTE — ACD).
    // Failure here must not rollback the local decision.
    await this.registerReclamoSafely(tenantId, dte, 'ACD');

    this.logger.log(`DTE ${dteId} accepted by user ${userId}`);
  }

  /**
   * Reject a received DTE.
   */
  async rejectDte(
    tenantId: string,
    dteId: string,
    userId: string,
    reason?: string,
  ): Promise<void> {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const dte = await db.dte.findUnique({
      where: { id: dteId },
      select: {
        id: true,
        direction: true,
        dteType: true,
        folio: true,
        emisorRut: true,
      },
    });

    if (!dte) throw new NotFoundException(`DTE ${dteId} no encontrado`);
    if (dte.direction !== 'RECEIVED') {
      throw new ConflictException('Solo se pueden rechazar DTEs recibidos');
    }

    // Load certificate for XML signing
    const cert = await this.certificateService.getPrimaryCert(tenantId);

    const resultadoXml = await this.exchangeResponse.generateResultadoDte(
      tenantId,
      dteId,
      false,
      cert,
    );

    await db.dte.update({
      where: { id: dteId },
      data: {
        status: 'REJECTED',
        decidedAt: new Date(),
        decidedById: userId,
      },
    });

    await db.dteExchange.updateMany({
      where: { dteId, tenantId },
      data: { status: 'REJECTED' as ExchangeStatus },
    });

    const exchange = await db.dteExchange.findFirst({
      where: { dteId, tenantId },
    });

    if (exchange) {
      await db.dteExchangeEvent.create({
        data: {
          exchangeId: exchange.id,
          eventType: 'RESULTADO_DTE',
          xmlContent: resultadoXml,
          metadata: reason ? { reason } : undefined,
        },
      });
    }

    await db.dteLog.create({
      data: {
        dteId,
        action: 'REJECTED',
        message: reason
          ? `DTE rechazado: ${reason}`
          : 'DTE rechazado por el usuario',
        actorId: userId,
      },
    });

    this.eventEmitter.emit('dte.received.rejected', {
      tenantId,
      dteId,
      reason,
    });

    // Register the rejection at the SII (RegistroReclamoDTE — RCD).
    // Failure here must not rollback the local decision.
    await this.registerReclamoSafely(tenantId, dte, 'RCD');

    this.logger.log(`DTE ${dteId} rejected by user ${userId}`);
  }

  /**
   * Call SiiReclamoService to register an ACD/RCD action at the SII.
   * Logs and swallows any error — the local decision is authoritative.
   */
  private async registerReclamoSafely(
    tenantId: string,
    dte: {
      id: string;
      dteType: string;
      folio: number;
      emisorRut: string | null;
    },
    action: ReclamoAction,
  ): Promise<void> {
    if (!dte.emisorRut) {
      this.logger.warn(
        `Skipping SII reclamo ${action} for DTE ${dte.id}: missing emisorRut`,
      );
      return;
    }

    const tipoDte = DTE_TYPE_TO_SII_CODE[dte.dteType];
    if (!tipoDte) {
      this.logger.warn(
        `Skipping SII reclamo ${action} for DTE ${dte.id}: unknown dteType ${dte.dteType}`,
      );
      return;
    }

    try {
      const result = await this.siiReclamoService.registrarReclamo(
        tenantId,
        dte.emisorRut,
        tipoDte,
        dte.folio,
        action,
      );
      this.logger.log(
        `SII reclamo ${action} registered for DTE ${dte.id} (codResp=${result.codResp})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to register SII reclamo ${action} for DTE ${dte.id}: ${error}. Local decision stands.`,
      );
    }
  }

  /**
   * List received DTEs for the bandeja (inbox).
   */
  async listReceived(
    tenantId: string,
    filters?: {
      status?: DteStatus;
      pending?: boolean;
      limit?: number;
      offset?: number;
    },
  ) {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const where: any = { direction: 'RECEIVED' };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.pending) {
      where.decidedAt = null;
      where.deadlineDate = { gte: new Date() };
    }

    return db.dte.findMany({
      where,
      include: {
        items: true,
        legalEntity: { select: { id: true, legalName: true, rut: true } },
        exchanges: {
          select: { id: true, status: true, deadlineAt: true },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { receptionDate: 'desc' },
      take: filters?.limit ?? 50,
      skip: filters?.offset ?? 0,
    });
  }

  /**
   * Find or create a LegalEntity for the emisor RUT.
   */
  private async findOrCreateLegalEntity(
    db: PrismaClient,
    tenantId: string,
    emisor: ParsedDte['emisor'],
  ): Promise<string | null> {
    if (!emisor.rut) return null;

    // Try to find existing LegalEntity by RUT
    const existing = await db.legalEntity.findFirst({
      where: { tenantId, rut: emisor.rut },
      select: { id: true },
    });

    if (existing) return existing.id;

    // Create a new LegalEntity as supplier
    const entity = await db.legalEntity.create({
      data: {
        rut: emisor.rut,
        legalName: emisor.razonSocial,
        businessActivity: emisor.giro,
        street: emisor.direccion,
        commune: emisor.comuna,
        city: emisor.ciudad,
        isSupplier: true,
        isAuthorizedDte: true,
        tenantId,
      },
    });

    this.logger.log(
      `Created LegalEntity ${entity.id} for emisor ${emisor.rut} (${emisor.razonSocial})`,
    );

    return entity.id;
  }

  /**
   * Maps SII CodRef integer to DteReferenceCode enum name.
   */
  private mapCodRef(codRef: number): string | undefined {
    switch (codRef) {
      case 1:
        return 'ANULA_DOCUMENTO';
      case 2:
        return 'CORRIGE_TEXTO';
      case 3:
        return 'CORRIGE_MONTOS';
      default:
        return undefined;
    }
  }
}
