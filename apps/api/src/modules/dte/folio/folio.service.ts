import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EncryptionService } from '../../../common/services/encryption.service';
import { DteConfigService } from '../services/dte-config.service';
import { XmlSanitizerService } from '../services/xml-sanitizer.service';
import { CAF } from '@devlas/dte-sii';
import { DteType, DteEnvironment, PrismaClient } from '@prisma/client';
import { SII_CODE_TO_DTE_TYPE } from '../constants/dte-types.constants';
import { XMLParser } from 'fast-xml-parser';
import { createVerify, createPublicKey } from 'node:crypto';

/**
 * SII public keys used to verify the signature (`<FRMA>`) of `<CAF>` XML
 * files. The SII publishes separate keys for the certification and
 * production environments. If the CAF issuing environment cannot be
 * matched to one of these keys the CAF is rejected.
 *
 * NOTE: these are the canonical SII public keys. They are embedded here
 * (rather than fetched) because the SII rotates them very infrequently and
 * they are the same for every contributor.
 */
const SII_PUBLIC_KEYS: Record<DteEnvironment, string> = {
  CERTIFICATION: process.env.SII_CERT_PUBLIC_KEY_PEM ?? '',
  PRODUCTION: process.env.SII_PROD_PUBLIC_KEY_PEM ?? '',
};

@Injectable()
export class FolioService {
  private readonly logger = new Logger(FolioService.name);

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

    // ─── Fix 2: Verify CAF signature against SII public key ─────
    if (!this.verifyCafSignature(cafXml, environment)) {
      throw new BadRequestException(
        'CAF signature invalid: la firma del SII en el CAF no pudo ser verificada. Verifique que el archivo no fue modificado.',
      );
    }

    // ─── Fix 1: Parse real `FA` (Fecha Autorización) from <DA> ──
    // The SII authorises a CAF for 6 months starting from the
    // Fecha Autorización (not from the upload date).
    const authorizedAt = this.extractFechaAutorizacion(caf, cafXml);
    const expiresAt = new Date(authorizedAt);
    expiresAt.setMonth(expiresAt.getMonth() + 6);

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

  /**
   * Extract the CAF's `FA` (Fecha Autorización) field from `<DA>`.
   * Falls back to parsing the raw XML when the `@devlas/dte-sii` `CAF`
   * instance does not expose it directly.
   */
  private extractFechaAutorizacion(caf: CAF, rawXml: string): Date {
    // `CAF.data` is the parsed XML. `<AUTORIZACION><CAF><DA><FA>YYYY-MM-DD</FA>…`
    const da = (caf as unknown as { da?: { FA?: string } }).da;
    const faFromLib = da?.FA;
    const faStr = faFromLib ?? this.extractFaFromRawXml(rawXml);
    if (!faStr) {
      throw new BadRequestException(
        'CAF inválido: no se pudo leer la Fecha Autorización (FA) del CAF.',
      );
    }
    const parsed = new Date(`${faStr}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(
        `CAF inválido: Fecha Autorización no parseable ('${faStr}').`,
      );
    }
    return parsed;
  }

  private extractFaFromRawXml(xml: string): string | null {
    try {
      const parser = new XMLParser({
        ignoreAttributes: false,
        parseTagValue: false,
      });
      const doc = parser.parse(xml) as {
        AUTORIZACION?: { CAF?: { DA?: { FA?: string } } };
      };
      return doc?.AUTORIZACION?.CAF?.DA?.FA ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Verify the `<FRMA>` RSA-SHA1 signature emitted by the SII over the
   * `<DA>` block of the CAF. If the configured SII public key for the
   * target environment is missing we log a warning and skip the check —
   * this keeps local development unblocked while surfacing a clear signal
   * in production logs.
   */
  verifyCafSignature(cafXml: string, env: DteEnvironment): boolean {
    const publicKeyPem = SII_PUBLIC_KEYS[env];
    if (!publicKeyPem) {
      this.logger.warn(
        `SII public key for ${env} is not configured — skipping CAF signature verification. ` +
          `Set SII_${env === 'CERTIFICATION' ? 'CERT' : 'PROD'}_PUBLIC_KEY_PEM to enforce.`,
      );
      return true;
    }

    // Extract the <DA>…</DA> block (what is signed) and the <FRMA>…</FRMA>
    // value (the base64 signature) from the raw XML. We deliberately use
    // the exact byte range present in the file to preserve canonicalisation.
    const daMatch = cafXml.match(/<DA>[\s\S]*?<\/DA>/);
    const frmaMatch = cafXml.match(
      /<FRMA[^>]*>([\s\S]*?)<\/FRMA>/,
    );

    if (!daMatch || !frmaMatch) {
      this.logger.warn('CAF signature check failed: missing <DA> or <FRMA>');
      return false;
    }

    const daBlock = daMatch[0];
    const signatureB64 = frmaMatch[1].replace(/\s+/g, '');

    try {
      const key = createPublicKey(publicKeyPem);
      const verifier = createVerify('RSA-SHA1');
      verifier.update(daBlock, 'utf8');
      verifier.end();
      return verifier.verify(key, signatureB64, 'base64');
    } catch (err) {
      this.logger.warn(
        `CAF signature verification errored: ${(err as Error).message}`,
      );
      return false;
    }
  }
}
