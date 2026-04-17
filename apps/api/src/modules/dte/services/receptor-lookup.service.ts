import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';

export interface ReceptorData {
  rut: string;
  razonSocial: string;
  giro?: string;
  direccion?: string;
  comuna?: string;
  ciudad?: string;
  dteExchangeEmail?: string;
  source: 'cache' | 'sii';
}

@Injectable()
export class ReceptorLookupService {
  private readonly logger = new Logger(ReceptorLookupService.name);

  constructor(private readonly prisma: PrismaService) {}

  async lookup(tenantId: string, rut: string): Promise<ReceptorData | null> {
    // Step 1: Check LegalEntity cache
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const entity = await db.legalEntity.findFirst({
      where: { rut },
    });

    if (entity && entity.legalName && entity.siiLastRefresh) {
      return {
        rut: entity.rut,
        razonSocial: entity.legalName,
        giro: entity.businessActivity ?? undefined,
        direccion: entity.street ?? undefined,
        comuna: entity.commune ?? undefined,
        ciudad: entity.city ?? undefined,
        dteExchangeEmail: entity.dteExchangeEmail ?? undefined,
        source: 'cache',
      };
    }

    // Step 2: Query SII via ce_consulta_rut (placeholder — implemented in Plan E)
    // This requires mTLS with the tenant's digital certificate
    // For now, return null if not in cache
    this.logger.log(
      `Receptor ${rut} not found in cache. SII lookup not yet implemented.`,
    );
    return null;
  }

  async cacheReceptorData(
    tenantId: string,
    data: ReceptorData,
  ): Promise<void> {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    await db.legalEntity.upsert({
      where: {
        tenantId_rut: { tenantId, rut: data.rut },
      },
      create: {
        rut: data.rut,
        legalName: data.razonSocial,
        businessActivity: data.giro,
        street: data.direccion,
        commune: data.comuna,
        city: data.ciudad,
        dteExchangeEmail: data.dteExchangeEmail,
        isAuthorizedDte: true,
        siiLastRefresh: new Date(),
        isClient: true,
        tenantId,
      },
      update: {
        legalName: data.razonSocial,
        businessActivity: data.giro,
        street: data.direccion,
        commune: data.comuna,
        city: data.ciudad,
        dteExchangeEmail: data.dteExchangeEmail,
        isAuthorizedDte: true,
        siiLastRefresh: new Date(),
      },
    });
  }
}
