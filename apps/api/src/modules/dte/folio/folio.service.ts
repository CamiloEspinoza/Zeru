import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EncryptionService } from '../../../common/services/encryption.service';
import { DteConfigService } from '../services/dte-config.service';
import { XmlSanitizerService } from '../services/xml-sanitizer.service';
import { CAF } from '@devlas/dte-sii';
import { DteType, DteEnvironment, PrismaClient } from '@prisma/client';
import { SII_CODE_TO_DTE_TYPE } from '../constants/dte-types.constants';

@Injectable()
export class FolioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly dteConfigService: DteConfigService,
    private readonly xmlSanitizer: XmlSanitizerService,
  ) {}

  async uploadCaf(tenantId: string, cafXml: string) {
    this.xmlSanitizer.validateNoInjection(cafXml);

    const caf = new CAF(cafXml);
    const dteTypeStr = SII_CODE_TO_DTE_TYPE[caf.getTipoDTE()];
    if (!dteTypeStr) {
      throw new BadRequestException(
        `Tipo DTE no soportado: ${caf.getTipoDTE()}`,
      );
    }

    // Validate that the CAF's RUT matches the tenant's configured RUT
    const config = await this.dteConfigService.get(tenantId);
    const cafRut = caf.getRutEmisor();
    const configRut = config.rut.replace(/\./g, '');
    const normalizedCafRut = String(cafRut).replace(/\./g, '');
    if (normalizedCafRut !== configRut) {
      throw new BadRequestException(
        `El RUT del CAF (${cafRut}) no coincide con el RUT configurado del emisor (${config.rut}). Verifique que el archivo CAF corresponde a su empresa.`,
      );
    }
    const dteType = dteTypeStr as DteType;
    const environment: DteEnvironment = caf.esCertificacion()
      ? 'CERTIFICATION'
      : 'PRODUCTION';
    const authorizedAt = new Date();
    const expiresAt = new Date(
      authorizedAt.getTime() + 6 * 30 * 24 * 60 * 60 * 1000,
    );
    const encryptedCafXml = this.encryption.encrypt(cafXml);

    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    return db.dteFolio.create({
      data: {
        dteType,
        environment,
        rangeFrom: caf.getFolioDesde(),
        rangeTo: caf.getFolioHasta(),
        nextFolio: caf.getFolioDesde(),
        encryptedCafXml,
        authorizedAt,
        expiresAt,
        tenantId,
      },
    });
  }

  async list(tenantId: string) {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    return db.dteFolio.findMany({
      select: {
        id: true,
        dteType: true,
        environment: true,
        rangeFrom: true,
        rangeTo: true,
        nextFolio: true,
        authorizedAt: true,
        expiresAt: true,
        isActive: true,
        isExhausted: true,
        alertThreshold: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDecryptedCaf(tenantId: string, folioId: string): Promise<CAF> {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const record = await db.dteFolio.findFirstOrThrow({
      where: { id: folioId, tenantId },
    });
    const cafXml = this.encryption.decrypt(record.encryptedCafXml);
    return new CAF(cafXml);
  }

  async validateAvailability(
    tenantId: string,
    dteType: DteType,
    environment: DteEnvironment,
  ): Promise<void> {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const available = await db.dteFolio.findFirst({
      where: { dteType, environment, isActive: true, isExhausted: false },
    });
    if (!available) {
      throw new BadRequestException(
        `No hay folios disponibles para ${dteType} en ${environment}. Suba un archivo CAF.`,
      );
    }
  }
}
