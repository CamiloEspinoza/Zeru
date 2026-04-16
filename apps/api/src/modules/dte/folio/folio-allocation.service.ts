import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient, DteType, DteEnvironment } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface AllocatedFolio {
  folio: number;
  folioRangeId: string;
}

interface FolioRangeRow {
  id: string;
  nextFolio: number;
  rangeTo: number;
  alertThreshold: number;
}

@Injectable()
export class FolioAllocationService {
  private readonly logger = new Logger(FolioAllocationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async allocate(
    tenantId: string,
    dteType: DteType,
    environment: DteEnvironment,
  ): Promise<AllocatedFolio> {
    const db = this.prisma as unknown as PrismaClient;
    return db.$transaction(async (tx) => {
      const folioRanges = await tx.$queryRawUnsafe<FolioRangeRow[]>(
        `SELECT id, "nextFolio", "rangeTo", "alertThreshold"
         FROM dte_folios
         WHERE "tenantId" = $1
           AND "dteType"::text = $2
           AND "environment"::text = $3
           AND "isActive" = true
           AND "isExhausted" = false
           AND "expiresAt" > NOW()
         ORDER BY "rangeFrom" ASC
         LIMIT 1
         FOR UPDATE`,
        tenantId,
        dteType,
        environment,
      );

      if (!folioRanges.length) {
        throw new BadRequestException(
          `No hay folios disponibles para ${dteType} en ambiente ${environment}`,
        );
      }

      const range = folioRanges[0];
      const folio = range.nextFolio;
      const nextFolio = folio + 1;
      const isExhausted = nextFolio > range.rangeTo;
      const remaining = range.rangeTo - folio;

      // Defense-in-depth: include tenantId in WHERE to prevent cross-tenant updates
      // even though the SELECT already filters by tenantId with FOR UPDATE lock.
      await tx.$executeRawUnsafe(
        `UPDATE dte_folios SET "nextFolio" = $1, "isExhausted" = $2, "updatedAt" = NOW() WHERE id = $3 AND "tenantId" = $4`,
        nextFolio,
        isExhausted,
        range.id,
        tenantId,
      );

      if (remaining > 0 && remaining <= range.alertThreshold) {
        this.eventEmitter.emit('dte.folio.low_stock', {
          tenantId,
          dteType,
          remaining,
          folioRangeId: range.id,
        });
        this.logger.warn(
          `Folios running low: ${remaining} remaining for ${dteType}`,
        );
      }

      if (isExhausted) {
        this.eventEmitter.emit('dte.folio.exhausted', {
          tenantId,
          dteType,
          folioRangeId: range.id,
        });
        this.logger.warn(`Folio range exhausted for ${dteType}`);
      }

      return { folio, folioRangeId: range.id };
    });
  }

  /**
   * Allocate multiple folios sequentially.
   *
   * Each allocation acquires a `FOR UPDATE` lock on the folio range row,
   * so this is safe for concurrent access but not optimized for large batches.
   * A more efficient batch allocation can be implemented later if needed.
   */
  async allocateBatch(
    tenantId: string,
    dteType: DteType,
    environment: DteEnvironment,
    count: number,
  ): Promise<AllocatedFolio[]> {
    const results: AllocatedFolio[] = [];
    for (let i = 0; i < count; i++) {
      results.push(await this.allocate(tenantId, dteType, environment));
    }
    return results;
  }
}
