import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

interface SpofResult {
  id: string;
  name: string;
  description: string | null;
  process_count: bigint;
  personProfileId?: string | null;
  personName?: string | null;
  isRealPerson?: boolean;
}

interface BottleneckResult {
  id: string;
  name: string;
  type: string;
  description: string | null;
  dependency_count: bigint;
}

@Injectable()
export class OrgDiagnosisService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get full diagnosis for a project.
   */
  async getDiagnosis(tenantId: string, projectId: string) {
    const [problems, entities, relations, spofs, bottlenecks] =
      await Promise.all([
        this.getProblems(tenantId, projectId),
        this.getEntityStats(tenantId, projectId),
        this.getRelationStats(tenantId, projectId),
        this.detectSPOFs(tenantId, projectId),
        this.detectBottlenecks(tenantId, projectId),
      ]);
    return { problems, entities, relations, spofs, bottlenecks };
  }

  /**
   * Detect Single Points of Failure: roles that appear in many processes.
   * A SPOF is a role that executes activities across multiple processes.
   */
  async detectSPOFs(tenantId: string, projectId: string): Promise<SpofResult[]> {
    const rawSpofs = await this.prisma.$queryRawUnsafe<SpofResult[]>(
      `
      SELECT e.id, e.name, e.description,
        COUNT(DISTINCT r2."fromEntityId") as process_count
      FROM org_entities e
      JOIN org_relations r ON r."fromEntityId" = e.id AND r.type = 'EXECUTES'
      JOIN org_relations r2 ON r2.type = 'CONTAINS'
        AND r2."toEntityId" = r."toEntityId"
      WHERE e."tenantId" = $1
        AND e."projectId" = $2
        AND e.type = 'ROLE'
        AND e."validTo" IS NULL
        AND e."deletedAt" IS NULL
      GROUP BY e.id, e.name, e.description
      HAVING COUNT(DISTINCT r2."fromEntityId") > 1
      ORDER BY process_count DESC
      LIMIT 10
      `,
      tenantId,
      projectId,
    );

    // Enrich SPOFs with PersonProfile data
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    for (const spof of rawSpofs) {
      try {
        // Check if the SPOF role entity has a linked PersonProfile
        const entity = await client.orgEntity.findFirst({
          where: { id: spof.id, deletedAt: null },
          select: { metadata: true },
        });
        const meta = entity?.metadata as Record<string, unknown> | null;

        if (meta?.personProfileId) {
          const person = await client.personProfile.findFirst({
            where: {
              id: meta.personProfileId as string,
              deletedAt: null,
            },
            select: { id: true, name: true },
          });
          if (person) {
            spof.personProfileId = person.id;
            spof.personName = person.name;
            spof.isRealPerson = true;
          }
        }
      } catch {
        // Ignore enrichment errors
      }
    }

    // Sort: real persons first (higher risk), then by process_count
    return rawSpofs.sort((a, b) => {
      if (a.isRealPerson && !b.isRealPerson) return -1;
      if (!a.isRealPerson && b.isRealPerson) return 1;
      return Number(b.process_count) - Number(a.process_count);
    });
  }

  /**
   * Detect bottlenecks: entities with high in-degree (many things depend on them).
   */
  async detectBottlenecks(
    tenantId: string,
    projectId: string,
  ): Promise<BottleneckResult[]> {
    return this.prisma.$queryRawUnsafe<BottleneckResult[]>(
      `
      SELECT e.id, e.name, e.type, e.description,
        COUNT(*) as dependency_count
      FROM org_entities e
      JOIN org_relations r ON r."toEntityId" = e.id AND r.type = 'DEPENDS_ON'
      WHERE e."tenantId" = $1
        AND e."projectId" = $2
        AND e."validTo" IS NULL
        AND e."deletedAt" IS NULL
      GROUP BY e.id, e.name, e.type, e.description
      ORDER BY dependency_count DESC
      LIMIT 10
      `,
      tenantId,
      projectId,
    );
  }

  private async getProblems(tenantId: string, projectId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    return client.problem.findMany({
      where: { projectId, deletedAt: null },
      include: { affectedEntities: { include: { entity: true } } },
      orderBy: [{ severity: 'asc' }, { confidence: 'desc' }],
    });
  }

  private async getEntityStats(tenantId: string, projectId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    return client.orgEntity.groupBy({
      by: ['type'],
      where: { projectId, validTo: null, deletedAt: null },
      _count: true,
    });
  }

  private async getRelationStats(tenantId: string, projectId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    return client.orgRelation.groupBy({
      by: ['type'],
      where: { projectId, validTo: null },
      _count: true,
    });
  }
}
