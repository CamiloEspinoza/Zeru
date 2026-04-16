import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient, DteType } from '@prisma/client';
import { DteConfigService } from '../services/dte-config.service';
import {
  DteBuilderService,
  DteBuildInput,
} from '../services/dte-builder.service';
import { CertificateService } from '../certificate/certificate.service';
import { FolioService } from '../folio/folio.service';
import { FolioAllocationService } from '../folio/folio-allocation.service';
import { SiiSenderService } from '../sii/sii-sender.service';

// ─── Types ───────────────────────────────────────────────

export enum CertificationStage {
  NOT_STARTED = 'NOT_STARTED',
  STAGE_1_SET_PRUEBAS = 'STAGE_1_SET_PRUEBAS',
  STAGE_2_SIMULACION = 'STAGE_2_SIMULACION',
  STAGE_3_INTERCAMBIO = 'STAGE_3_INTERCAMBIO',
  STAGE_4_MUESTRAS_PDF = 'STAGE_4_MUESTRAS_PDF',
  STAGE_5_DECLARACION = 'STAGE_5_DECLARACION',
  STAGE_6_AUTORIZACION = 'STAGE_6_AUTORIZACION',
  COMPLETED = 'COMPLETED',
}

export interface StageDetail {
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  startedAt?: string;
  completedAt?: string;
  error?: string;
  result?: Record<string, unknown>;
}

export interface CertificationData {
  currentStage: CertificationStage;
  startedAt: string | null;
  completedAt: string | null;
  stages: Record<string, StageDetail>;
}

interface GeneratedDteSummary {
  dteType: string;
  folio: number;
  montoTotal: number;
}

// ─── Constants ───────────────────────────────────────────

const STAGE_ORDER: CertificationStage[] = [
  CertificationStage.NOT_STARTED,
  CertificationStage.STAGE_1_SET_PRUEBAS,
  CertificationStage.STAGE_2_SIMULACION,
  CertificationStage.STAGE_3_INTERCAMBIO,
  CertificationStage.STAGE_4_MUESTRAS_PDF,
  CertificationStage.STAGE_5_DECLARACION,
  CertificationStage.STAGE_6_AUTORIZACION,
  CertificationStage.COMPLETED,
];

function defaultCertificationData(): CertificationData {
  return {
    currentStage: CertificationStage.NOT_STARTED,
    startedAt: null,
    completedAt: null,
    stages: {
      [CertificationStage.STAGE_1_SET_PRUEBAS]: { status: 'pending' },
      [CertificationStage.STAGE_2_SIMULACION]: { status: 'pending' },
      [CertificationStage.STAGE_3_INTERCAMBIO]: { status: 'pending' },
      [CertificationStage.STAGE_4_MUESTRAS_PDF]: { status: 'pending' },
      [CertificationStage.STAGE_5_DECLARACION]: { status: 'pending' },
      [CertificationStage.STAGE_6_AUTORIZACION]: { status: 'pending' },
    },
  };
}

// ─── Service ─────────────────────────────────────────────

@Injectable()
export class CertificationService {
  private readonly logger = new Logger(CertificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: DteConfigService,
    private readonly builderService: DteBuilderService,
    private readonly certService: CertificateService,
    private readonly folioService: FolioService,
    private readonly folioAllocation: FolioAllocationService,
    private readonly siiSender: SiiSenderService,
  ) {}

  // ─── Read status ──────────────────────────────────────────

  async getStatus(tenantId: string) {
    const config = await this.configService.getOptional(tenantId);
    if (!config) {
      return {
        configured: false,
        certification: defaultCertificationData(),
      };
    }

    const certification =
      (config.certificationData as CertificationData | null) ??
      defaultCertificationData();

    return {
      configured: true,
      environment: config.environment,
      certification,
    };
  }

  // ─── Stage 1: Set de Pruebas ─────────────────────────────

  async startStage1(tenantId: string) {
    const config = await this.configService.get(tenantId);

    if (config.environment !== 'CERTIFICATION') {
      throw new BadRequestException(
        'La certificacion solo se puede realizar en ambiente de certificacion',
      );
    }

    const certData = this.getCertData(config.certificationData);

    if (
      certData.currentStage !== CertificationStage.NOT_STARTED &&
      certData.currentStage !== CertificationStage.STAGE_1_SET_PRUEBAS
    ) {
      throw new BadRequestException(
        'La etapa 1 solo se puede iniciar al comienzo de la certificacion',
      );
    }

    const cert = await this.certService.getPrimaryCert(tenantId);

    // Validate folio availability for all required types
    const requiredTypes: DteType[] = [
      'FACTURA_ELECTRONICA' as DteType,
      'NOTA_CREDITO_ELECTRONICA' as DteType,
      'NOTA_DEBITO_ELECTRONICA' as DteType,
    ];
    for (const dteType of requiredTypes) {
      await this.folioService.validateAvailability(
        tenantId,
        dteType,
        config.environment,
      );
    }

    certData.currentStage = CertificationStage.STAGE_1_SET_PRUEBAS;
    certData.startedAt = certData.startedAt ?? new Date().toISOString();
    certData.stages[CertificationStage.STAGE_1_SET_PRUEBAS] = {
      status: 'in_progress',
      startedAt: new Date().toISOString(),
    };

    const generatedDtes: GeneratedDteSummary[] = [];
    const allXmls: string[] = [];

    try {
      const today = new Date().toISOString().slice(0, 10);
      const emisor = {
        rut: config.rut,
        razonSocial: config.razonSocial,
        giro: config.giro,
        actividadEco: config.actividadEco,
        direccion: config.direccion,
        comuna: config.comuna,
      };

      const testReceptor = {
        rut: '97004000-5',
        razonSocial: 'SII Certificacion',
        giro: 'Gobierno',
        direccion: 'Teatinos 120',
        comuna: 'Santiago',
      };

      // Helper to build & collect a DTE
      const buildDte = async (input: DteBuildInput) => {
        const allocation = await this.folioAllocation.allocate(
          tenantId,
          input.dteType,
          config.environment,
        );
        const updatedInput = { ...input, folio: allocation.folio };
        const caf = await this.folioService.getDecryptedCaf(
          tenantId,
          allocation.folioRangeId,
        );
        const result = this.builderService.build(updatedInput, caf, cert);
        allXmls.push(result.xml);
        generatedDtes.push({
          dteType: input.dteType,
          folio: allocation.folio,
          montoTotal: result.montoTotal,
        });
        return { allocation, result };
      };

      // ── Factura 1: Caso base (items variados con descuento) ──
      const factura1 = await buildDte({
        dteType: 'FACTURA_ELECTRONICA' as DteType,
        folio: 0, // replaced by buildDte
        fechaEmision: today,
        formaPago: 1,
        emisor,
        receptor: testReceptor,
        items: [
          {
            nombre: 'Servicio de consultoria',
            cantidad: 10,
            precioUnitario: 50000,
            descuento: 5000,
          },
          {
            nombre: 'Licencia de software',
            cantidad: 1,
            precioUnitario: 250000,
          },
          {
            nombre: 'Soporte tecnico',
            cantidad: 5,
            precioUnitario: 30000,
            unidad: 'HRS',
          },
        ],
      });

      // ── Factura 2: Caso con item exento ──
      const factura2 = await buildDte({
        dteType: 'FACTURA_ELECTRONICA' as DteType,
        folio: 0,
        fechaEmision: today,
        formaPago: 2,
        emisor,
        receptor: testReceptor,
        items: [
          {
            nombre: 'Producto gravado',
            cantidad: 3,
            precioUnitario: 100000,
          },
          {
            nombre: 'Producto exento',
            cantidad: 2,
            precioUnitario: 75000,
            exento: true,
          },
        ],
      });

      // ── Factura 3: Caso con muchos items ──
      await buildDte({
        dteType: 'FACTURA_ELECTRONICA' as DteType,
        folio: 0,
        fechaEmision: today,
        formaPago: 1,
        emisor,
        receptor: testReceptor,
        items: Array.from({ length: 8 }, (_, i) => ({
          nombre: `Producto ${i + 1}`,
          cantidad: i + 1,
          precioUnitario: 10000 * (i + 1),
        })),
      });

      // ── Nota de Crédito referenciando Factura 1 ──
      await buildDte({
        dteType: 'NOTA_CREDITO_ELECTRONICA' as DteType,
        folio: 0,
        fechaEmision: today,
        emisor,
        receptor: testReceptor,
        items: [
          {
            nombre: 'Servicio de consultoria',
            cantidad: 2,
            precioUnitario: 50000,
          },
        ],
        referencias: [
          {
            tipoDocRef: 33,
            folioRef: factura1.allocation.folio,
            fechaRef: today,
            codRef: 1,
            razonRef: 'Anula parcialmente factura',
          },
        ],
      });

      // ── Nota de Débito referenciando Factura 2 ──
      await buildDte({
        dteType: 'NOTA_DEBITO_ELECTRONICA' as DteType,
        folio: 0,
        fechaEmision: today,
        emisor,
        receptor: testReceptor,
        items: [
          {
            nombre: 'Cargo adicional por servicio urgente',
            cantidad: 1,
            precioUnitario: 80000,
          },
        ],
        referencias: [
          {
            tipoDocRef: 33,
            folioRef: factura2.allocation.folio,
            fechaRef: today,
            codRef: 3,
            razonRef: 'Corrige montos factura',
          },
        ],
      });

      // Build the EnvioDTE envelope with all test XMLs
      const envelopeXml = this.builderService.buildEnvelope(
        allXmls,
        config.rut,
        config.rut,
        config.resolutionDate.toISOString().slice(0, 10),
        config.resolutionNum,
        cert,
      );

      // Send to SII
      const sendResult = await this.siiSender.sendDte(
        envelopeXml,
        cert,
        config.rut,
        config.environment,
      );

      certData.stages[CertificationStage.STAGE_1_SET_PRUEBAS] = {
        status: 'completed',
        startedAt:
          certData.stages[CertificationStage.STAGE_1_SET_PRUEBAS].startedAt,
        completedAt: new Date().toISOString(),
        result: {
          generatedDtes: generatedDtes as unknown as Record<string, unknown>[],
          trackId: sendResult.trackId,
          totalDocuments: generatedDtes.length,
        },
      };
      certData.currentStage = CertificationStage.STAGE_2_SIMULACION;

      this.logger.log(
        `Stage 1 completed for tenant ${tenantId}: ${generatedDtes.length} DTEs generated, trackId=${sendResult.trackId}`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      certData.stages[CertificationStage.STAGE_1_SET_PRUEBAS] = {
        status: 'error',
        startedAt:
          certData.stages[CertificationStage.STAGE_1_SET_PRUEBAS].startedAt,
        error: message,
        result: {
          generatedDtes: generatedDtes as unknown as Record<string, unknown>[],
        },
      };

      this.logger.error(
        `Stage 1 failed for tenant ${tenantId}: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    await this.saveCertData(tenantId, certData);

    return {
      certification: certData,
      generatedDtes,
    };
  }

  // ─── Stage 2: Simulación ─────────────────────────────────

  async startStage2(tenantId: string) {
    const config = await this.configService.get(tenantId);
    const certData = this.getCertData(config.certificationData);

    if (certData.currentStage !== CertificationStage.STAGE_2_SIMULACION) {
      throw new BadRequestException(
        'Debe completar la etapa 1 antes de iniciar la etapa 2',
      );
    }

    certData.stages[CertificationStage.STAGE_2_SIMULACION] = {
      status: 'in_progress',
      startedAt: new Date().toISOString(),
    };

    await this.saveCertData(tenantId, certData);

    return {
      certification: certData,
      message:
        'Etapa 2 iniciada. Emita documentos de prueba usando el flujo normal de emision. ' +
        'Cuando haya enviado suficientes documentos y el SII los haya aceptado, ' +
        'marque esta etapa como completada.',
    };
  }

  // ─── Manual advance ──────────────────────────────────────

  async markStageComplete(tenantId: string, stage?: CertificationStage) {
    const config = await this.configService.get(tenantId);
    const certData = this.getCertData(config.certificationData);

    const targetStage = stage ?? certData.currentStage;

    if (
      targetStage === CertificationStage.NOT_STARTED ||
      targetStage === CertificationStage.COMPLETED
    ) {
      throw new BadRequestException('No se puede avanzar desde esta etapa');
    }

    const stageIndex = STAGE_ORDER.indexOf(targetStage);
    if (stageIndex === -1) {
      throw new NotFoundException(`Etapa no reconocida: ${targetStage}`);
    }

    const currentIndex = STAGE_ORDER.indexOf(certData.currentStage);
    if (stageIndex > currentIndex) {
      throw new BadRequestException(
        `No puede completar la etapa ${targetStage} porque aun no ha llegado a ella`,
      );
    }

    certData.stages[targetStage] = {
      ...certData.stages[targetStage],
      status: 'completed',
      completedAt: new Date().toISOString(),
    };

    const nextStage = STAGE_ORDER[stageIndex + 1];
    if (nextStage) {
      certData.currentStage = nextStage;
    }

    if (nextStage === CertificationStage.COMPLETED) {
      certData.completedAt = new Date().toISOString();
    }

    await this.saveCertData(tenantId, certData);

    this.logger.log(
      `Tenant ${tenantId} advanced certification: ${targetStage} -> ${nextStage}`,
    );

    return { certification: certData };
  }

  // ─── Reset ────────────────────────────────────────────────

  async reset(tenantId: string) {
    const certData = defaultCertificationData();
    await this.saveCertData(tenantId, certData);

    this.logger.log(`Certification reset for tenant ${tenantId}`);

    return { certification: certData };
  }

  // ─── Private helpers ──────────────────────────────────────

  private getCertData(raw: unknown): CertificationData {
    if (raw && typeof raw === 'object' && 'currentStage' in raw) {
      return raw as CertificationData;
    }
    return defaultCertificationData();
  }

  private async saveCertData(tenantId: string, data: CertificationData) {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    await db.dteConfig.update({
      where: { tenantId },
      data: { certificationData: data as any },
    });
  }
}
