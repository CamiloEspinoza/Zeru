import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';

/**
 * Daily cron job (09:00) that checks for expiring or expired
 * DTE certificates across all tenants and emits events accordingly.
 *
 * - EXPIRED:  validUntil < now           -> update status, emit 'dte.certificate.expired'
 * - CRITICAL: validUntil < now + 7 days  -> emit 'dte.certificate.expiring-critical'
 * - WARNING:  validUntil < now + 30 days -> emit 'dte.certificate.expiring-soon'
 */
@Injectable()
export class CertificateExpiryCron {
  private readonly logger = new Logger(CertificateExpiryCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron('0 9 * * *')
  async checkExpiringCertificates() {
    this.logger.log('Running certificate expiry check');

    // Cross-tenant read is acceptable for cron scanning
    const db = this.prisma as unknown as PrismaClient;
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // 1. Find all ACTIVE certificates that expire within 30 days (includes already expired)
    const certificates = await db.dteCertificate.findMany({
      where: {
        status: 'ACTIVE',
        validUntil: { lt: in30Days },
      },
      select: {
        id: true,
        tenantId: true,
        subjectName: true,
        subjectRut: true,
        validUntil: true,
      },
    });

    if (certificates.length === 0) {
      this.logger.log('Certificate expiry check complete: no certificates expiring soon');
      return;
    }

    let expiredCount = 0;
    let criticalCount = 0;
    let warningCount = 0;

    // Group by tenantId so status updates use tenant-scoped clients
    const grouped = new Map<string, typeof certificates>();
    for (const cert of certificates) {
      const list = grouped.get(cert.tenantId) ?? [];
      list.push(cert);
      grouped.set(cert.tenantId, list);
    }

    for (const [tenantId, certs] of grouped) {
      const tenantDb = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

      for (const cert of certs) {
        try {
          if (cert.validUntil < now) {
            // Already expired — update status and notify
            await tenantDb.dteCertificate.update({
              where: { id: cert.id },
              data: { status: 'EXPIRED' },
            });

            this.eventEmitter.emit('dte.certificate.expired', {
              tenantId,
              certificateId: cert.id,
              subjectName: cert.subjectName,
              subjectRut: cert.subjectRut,
              validUntil: cert.validUntil,
            });

            expiredCount++;
            this.logger.warn(
              `Certificate ${cert.id} (${cert.subjectRut}) expired on ${cert.validUntil.toISOString()}`,
            );
          } else if (cert.validUntil < in7Days) {
            // Expiring within 7 days — critical
            const daysRemaining = Math.ceil(
              (cert.validUntil.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
            );

            this.eventEmitter.emit('dte.certificate.expiring-critical', {
              tenantId,
              certificateId: cert.id,
              subjectName: cert.subjectName,
              subjectRut: cert.subjectRut,
              validUntil: cert.validUntil,
              daysRemaining,
            });

            criticalCount++;
            this.logger.warn(
              `Certificate ${cert.id} (${cert.subjectRut}) expiring in ${daysRemaining} day(s)`,
            );
          } else {
            // Expiring within 30 days — warning
            const daysRemaining = Math.ceil(
              (cert.validUntil.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
            );

            this.eventEmitter.emit('dte.certificate.expiring-soon', {
              tenantId,
              certificateId: cert.id,
              subjectName: cert.subjectName,
              subjectRut: cert.subjectRut,
              validUntil: cert.validUntil,
              daysRemaining,
            });

            warningCount++;
            this.logger.log(
              `Certificate ${cert.id} (${cert.subjectRut}) expiring in ${daysRemaining} day(s)`,
            );
          }
        } catch (error) {
          this.logger.error(
            `Failed to process certificate ${cert.id} (${cert.subjectRut}): ${error}`,
          );
        }
      }
    }

    this.logger.log(
      `Certificate expiry check complete: ${expiredCount} expired, ${criticalCount} critical, ${warningCount} warning`,
    );
  }
}
