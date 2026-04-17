import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EncryptionService } from '../../../common/services/encryption.service';
import { AuditService } from '../../audit/audit.service';
import { CertificateParserService } from './certificate-parser.service';
import { Certificado } from '@devlas/dte-sii';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class CertificateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly audit: AuditService,
    private readonly parser: CertificateParserService,
  ) {}

  async list(tenantId: string) {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    return db.dteCertificate.findMany({
      select: {
        id: true,
        subjectName: true,
        subjectRut: true,
        issuer: true,
        validFrom: true,
        validUntil: true,
        status: true,
        isPrimary: true,
        sha256Fingerprint: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upload(
    tenantId: string,
    file: Buffer,
    password: string,
    isPrimary: boolean,
  ) {
    const { info } = this.parser.parse(file, password);

    const encryptedP12 = this.encryption.encrypt(file.toString('base64'));
    const encryptedPassword = this.encryption.encrypt(password);

    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    if (isPrimary) {
      await db.dteCertificate.updateMany({
        where: { isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const cert = await db.dteCertificate.create({
      data: {
        ...info,
        encryptedP12,
        encryptedPassword,
        isPrimary,
        tenantId,
      },
    });

    await this.audit.log({
      entityType: 'DteCertificate',
      entityId: cert.id,
      action: 'UPLOADED',
    });

    const { encryptedP12: _, encryptedPassword: __, ...safeCert } = cert;
    return safeCert;
  }

  async getPrimaryCert(tenantId: string): Promise<Certificado> {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const record = await db.dteCertificate.findFirst({
      where: { isPrimary: true, status: 'ACTIVE' },
    });

    if (!record) {
      throw new BadRequestException(
        'No se encontró certificado digital primario activo',
      );
    }

    await this.audit.log({
      entityType: 'DteCertificate',
      entityId: record.id,
      action: 'DECRYPTED',
    });

    try {
      const p12Base64 = this.encryption.decrypt(record.encryptedP12);
      const password = this.encryption.decrypt(record.encryptedPassword);
      const p12Buffer = Buffer.from(p12Base64, 'base64');

      return new Certificado(p12Buffer, password);
    } catch {
      throw new BadRequestException(
        'No se pudo descifrar el certificado digital. Verifique que la contraseña sea correcta y que el archivo .p12 no esté corrupto.',
      );
    }
  }

  async validatePrimaryCertExists(tenantId: string): Promise<void> {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const count = await db.dteCertificate.count({
      where: { isPrimary: true, status: 'ACTIVE' },
    });
    if (count === 0) {
      throw new BadRequestException(
        'No hay certificado digital primario activo. Suba un certificado .p12 en Configuración.',
      );
    }
  }

  async delete(tenantId: string, id: string) {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    await db.dteCertificate.delete({ where: { id } });
    await this.audit.log({
      entityType: 'DteCertificate',
      entityId: id,
      action: 'DELETED',
    });
  }

  /**
   * Atomically set a certificate as primary: clears isPrimary on all other
   * certificates for the tenant, and sets isPrimary=true on the target.
   */
  async setPrimary(tenantId: string, id: string) {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const target = await db.dteCertificate.findFirst({ where: { id } });
    if (!target) {
      throw new BadRequestException('Certificado no encontrado.');
    }
    if (target.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Solo se pueden marcar como primarios certificados activos.',
      );
    }

    await db.$transaction([
      db.dteCertificate.updateMany({
        where: { isPrimary: true, id: { not: id } },
        data: { isPrimary: false },
      }),
      db.dteCertificate.update({
        where: { id },
        data: { isPrimary: true },
      }),
    ]);

    await this.audit.log({
      entityType: 'DteCertificate',
      entityId: id,
      action: 'SET_PRIMARY',
    });

    return { id, isPrimary: true };
  }
}
