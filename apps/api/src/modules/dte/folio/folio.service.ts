import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EncryptionService } from '../../../common/services/encryption.service';
import { CAF } from '@devlas/dte-sii';
import { DteType, DteEnvironment, PrismaClient } from '@prisma/client';
import { SII_CODE_TO_DTE_TYPE } from '../constants/dte-types.constants';

@Injectable()
export class FolioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async uploadCaf(tenantId: string, cafXml: string) {
    const caf = new CAF(cafXml);
    const dteTypeStr = SII_CODE_TO_DTE_TYPE[caf.getTipoDTE()];
    if (!dteTypeStr) {
      throw new BadRequestException(
        `Tipo DTE no soportado: ${caf.getTipoDTE()}`,
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
    const record = await db.dteFolio.findUniqueOrThrow({
      where: { id: folioId },
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
