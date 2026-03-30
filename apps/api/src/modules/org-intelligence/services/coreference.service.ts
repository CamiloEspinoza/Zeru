import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaClient, OrgEntityType, OrgRelationType, ProblemSeverity } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  ExtractionResult,
  ExtractionP1,
  ExtractionP2,
  ExtractionP3,
  ExtractionP4,
  ExtractionP5,
} from './extraction-schemas';

// ---------------------------------------------------------------------------
// Helper type — maps entity name → created entity id
// ---------------------------------------------------------------------------

type EntityMap = Map<string, string>;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class CoreferenceService {
  private readonly logger = new Logger(CoreferenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Process extraction results and create/update OrgEntity, OrgRelation,
   * Problem, ProblemLink, and FactualClaim records.
   *
   * Handles basic deduplication within the interview by using a name→id map.
   * Inter-interview deduplication is deferred to a future phase.
   */
  async processExtraction(
    tenantId: string,
    interviewId: string,
    projectId: string,
  ): Promise<void> {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    // 1. Load interview extraction result
    const interview = await client.interview.findFirst({
      where: { id: interviewId, deletedAt: null },
    });

    if (!interview) {
      throw new NotFoundException(
        `Entrevista con id ${interviewId} no encontrada`,
      );
    }

    const extraction = interview.extractionResult as unknown as ExtractionResult | null;
    if (!extraction) {
      throw new NotFoundException(
        `La entrevista ${interviewId} no tiene resultado de extracción`,
      );
    }

    // 2. Process in a single transaction for atomicity
    await client.$transaction(async (tx) => {
      const entityMap: EntityMap = new Map();

      // Pass 1: Create entities (roles, departments, systems)
      if (extraction.pass1) {
        await this.processPass1(
          tx as unknown as PrismaClient,
          extraction.pass1,
          tenantId,
          projectId,
          interviewId,
          entityMap,
        );
      }

      // Pass 2: Create process & activity entities + relations
      if (extraction.pass2) {
        await this.processPass2(
          tx as unknown as PrismaClient,
          extraction.pass2,
          tenantId,
          projectId,
          interviewId,
          entityMap,
        );
      }

      // Pass 3: Create problems + links to affected entities
      if (extraction.pass3) {
        await this.processPass3(
          tx as unknown as PrismaClient,
          extraction.pass3,
          tenantId,
          projectId,
          interviewId,
          entityMap,
        );
      }

      // Pass 4: Create dependency relations
      if (extraction.pass4) {
        await this.processPass4(
          tx as unknown as PrismaClient,
          extraction.pass4,
          tenantId,
          projectId,
          interviewId,
          entityMap,
        );
      }

      // Pass 5: Create factual claims
      if (extraction.pass5) {
        await this.processPass5(
          tx as unknown as PrismaClient,
          extraction.pass5,
          tenantId,
          projectId,
          interviewId,
        );
      }
    });

    this.logger.log(
      `[${interviewId}] Coreference processing complete — entities created/mapped`,
    );
  }

  // -------------------------------------------------------------------------
  // Pass 1: Roles, Departments, Systems → OrgEntity
  // -------------------------------------------------------------------------

  private async processPass1(
    tx: PrismaClient,
    p1: ExtractionP1,
    tenantId: string,
    projectId: string,
    interviewId: string,
    entityMap: EntityMap,
  ): Promise<void> {
    // Departments
    for (const dept of p1.departments) {
      const entity = await tx.orgEntity.create({
        data: {
          type: OrgEntityType.DEPARTMENT,
          name: dept.name,
          aliases: dept.aliases,
          confidence: dept.confidence,
          sourceInterviewId: interviewId,
          metadata: {
            parentDepartment: dept.parentDepartment,
            headRole: dept.headRole,
          },
          tenantId,
          projectId,
        },
      });
      entityMap.set(this.normalizeKey('DEPARTMENT', dept.name), entity.id);
      for (const alias of dept.aliases) {
        entityMap.set(this.normalizeKey('DEPARTMENT', alias), entity.id);
      }
    }

    // Roles
    for (const role of p1.roles) {
      const entity = await tx.orgEntity.create({
        data: {
          type: OrgEntityType.ROLE,
          name: role.canonicalName,
          aliases: role.aliases,
          confidence: role.confidence,
          sourceInterviewId: interviewId,
          metadata: {
            department: role.department,
            responsibilities: role.responsibilities,
            reportsTo: role.reportsTo,
          },
          tenantId,
          projectId,
        },
      });
      entityMap.set(this.normalizeKey('ROLE', role.canonicalName), entity.id);
      for (const alias of role.aliases) {
        entityMap.set(this.normalizeKey('ROLE', alias), entity.id);
      }

      // Create BELONGS_TO relation if department exists
      if (role.department) {
        const deptId = this.resolveEntity(entityMap, 'DEPARTMENT', role.department);
        if (deptId) {
          await tx.orgRelation.create({
            data: {
              type: OrgRelationType.BELONGS_TO,
              fromEntityId: entity.id,
              toEntityId: deptId,
              confidence: role.confidence,
              sourceInterviewId: interviewId,
              tenantId,
              projectId,
            },
          });
        }
      }
    }

    // Systems
    for (const sys of p1.systems) {
      const entity = await tx.orgEntity.create({
        data: {
          type: OrgEntityType.SYSTEM,
          name: sys.name,
          aliases: sys.aliases,
          confidence: sys.confidence,
          sourceInterviewId: interviewId,
          metadata: {
            systemType: sys.type,
            purpose: sys.purpose,
            usedBy: sys.usedBy,
          },
          tenantId,
          projectId,
        },
      });
      entityMap.set(this.normalizeKey('SYSTEM', sys.name), entity.id);
      for (const alias of sys.aliases) {
        entityMap.set(this.normalizeKey('SYSTEM', alias), entity.id);
      }

      // Create USES relations for roles that use this system
      for (const roleName of sys.usedBy) {
        const roleId = this.resolveEntity(entityMap, 'ROLE', roleName);
        if (roleId) {
          await tx.orgRelation.create({
            data: {
              type: OrgRelationType.USES,
              fromEntityId: roleId,
              toEntityId: entity.id,
              confidence: sys.confidence,
              sourceInterviewId: interviewId,
              tenantId,
              projectId,
            },
          });
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Pass 2: Processes & Activities → OrgEntity + OrgRelation
  // -------------------------------------------------------------------------

  private async processPass2(
    tx: PrismaClient,
    p2: ExtractionP2,
    tenantId: string,
    projectId: string,
    interviewId: string,
    entityMap: EntityMap,
  ): Promise<void> {
    for (const proc of p2.processes) {
      // Create process entity
      const processEntity = await tx.orgEntity.create({
        data: {
          type: OrgEntityType.PROCESS,
          name: proc.name,
          aliases: proc.aliases,
          confidence: proc.confidence,
          sourceInterviewId: interviewId,
          metadata: {
            frequency: proc.frequency,
            trigger: proc.trigger,
            output: proc.output,
          },
          tenantId,
          projectId,
        },
      });
      entityMap.set(this.normalizeKey('PROCESS', proc.name), processEntity.id);
      for (const alias of proc.aliases) {
        entityMap.set(this.normalizeKey('PROCESS', alias), processEntity.id);
      }

      // Link process to owner role
      if (proc.owner) {
        const ownerId = this.resolveEntity(entityMap, 'ROLE', proc.owner);
        if (ownerId) {
          await tx.orgRelation.create({
            data: {
              type: OrgRelationType.OWNS,
              fromEntityId: ownerId,
              toEntityId: processEntity.id,
              confidence: proc.confidence,
              sourceInterviewId: interviewId,
              tenantId,
              projectId,
            },
          });
        }
      }

      // Link process to department
      if (proc.department) {
        const deptId = this.resolveEntity(entityMap, 'DEPARTMENT', proc.department);
        if (deptId) {
          await tx.orgRelation.create({
            data: {
              type: OrgRelationType.BELONGS_TO,
              fromEntityId: processEntity.id,
              toEntityId: deptId,
              confidence: proc.confidence,
              sourceInterviewId: interviewId,
              tenantId,
              projectId,
            },
          });
        }
      }

      // Create activity entities
      for (const activity of proc.activities) {
        const actEntity = await tx.orgEntity.create({
          data: {
            type: OrgEntityType.ACTIVITY,
            name: activity.name,
            aliases: [],
            confidence: proc.confidence,
            sourceInterviewId: interviewId,
            metadata: {
              order: activity.order,
              estimatedDuration: activity.estimatedDuration,
              isManual: activity.isManual,
              description: activity.description,
              documents: activity.documents,
            },
            tenantId,
            projectId,
          },
        });

        // Activity CONTAINS relation (process contains activity)
        await tx.orgRelation.create({
          data: {
            type: OrgRelationType.CONTAINS,
            fromEntityId: processEntity.id,
            toEntityId: actEntity.id,
            weight: activity.order,
            confidence: proc.confidence,
            sourceInterviewId: interviewId,
            tenantId,
            projectId,
          },
        });

        // Activity EXECUTES relation (role executes activity)
        if (activity.executor) {
          const executorId = this.resolveEntity(entityMap, 'ROLE', activity.executor);
          if (executorId) {
            await tx.orgRelation.create({
              data: {
                type: OrgRelationType.EXECUTES,
                fromEntityId: executorId,
                toEntityId: actEntity.id,
                confidence: proc.confidence,
                sourceInterviewId: interviewId,
                tenantId,
                projectId,
              },
            });
          }
        }

        // Activity USES relations (activity uses systems)
        for (const sysName of activity.systems) {
          const sysId = this.resolveEntity(entityMap, 'SYSTEM', sysName);
          if (sysId) {
            await tx.orgRelation.create({
              data: {
                type: OrgRelationType.USES,
                fromEntityId: actEntity.id,
                toEntityId: sysId,
                confidence: proc.confidence,
                sourceInterviewId: interviewId,
                tenantId,
                projectId,
              },
            });
          }
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Pass 3: Problems → Problem + ProblemLink
  // -------------------------------------------------------------------------

  private async processPass3(
    tx: PrismaClient,
    p3: ExtractionP3,
    tenantId: string,
    projectId: string,
    interviewId: string,
    entityMap: EntityMap,
  ): Promise<void> {
    for (const prob of p3.problems) {
      const problem = await tx.problem.create({
        data: {
          title: prob.description.slice(0, 200),
          description: prob.description,
          severity: prob.severity as ProblemSeverity,
          category: prob.category,
          evidence: {
            quote: prob.evidence,
            speakerRole: prob.speakerRole,
            suggestedImprovement: prob.suggestedImprovement,
            frequency: prob.frequency,
          },
          confidence: prob.confidence,
          sourceInterviewId: interviewId,
          tenantId,
          projectId,
        },
      });

      // Link to affected entities (processes, roles, systems)
      const affectedNames = [
        ...prob.affectedProcesses.map((n) => ({ name: n, type: 'PROCESS' as const })),
        ...prob.affectedRoles.map((n) => ({ name: n, type: 'ROLE' as const })),
        ...prob.affectedSystems.map((n) => ({ name: n, type: 'SYSTEM' as const })),
      ];

      for (const affected of affectedNames) {
        const entityId = this.resolveEntity(entityMap, affected.type, affected.name);
        if (entityId) {
          await tx.problemLink.create({
            data: {
              problemId: problem.id,
              entityId,
            },
          });
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Pass 4: Dependencies → OrgRelation
  // -------------------------------------------------------------------------

  private async processPass4(
    tx: PrismaClient,
    p4: ExtractionP4,
    tenantId: string,
    projectId: string,
    interviewId: string,
    entityMap: EntityMap,
  ): Promise<void> {
    for (const dep of p4.dependencies) {
      const fromId = this.resolveEntity(
        entityMap,
        dep.fromType,
        dep.from,
      );
      const toId = this.resolveEntity(
        entityMap,
        dep.toType,
        dep.to,
      );

      if (!fromId || !toId) {
        this.logger.debug(
          `Skipping dependency ${dep.from} → ${dep.to}: entity not found in map`,
        );
        continue;
      }

      // Map extraction dependency type to OrgRelationType
      const relationType = this.mapDependencyType(dep.type);

      await tx.orgRelation.create({
        data: {
          type: relationType,
          description: dep.description,
          fromEntityId: fromId,
          toEntityId: toId,
          weight: dep.isCritical ? 2.0 : 1.0,
          confidence: dep.confidence,
          sourceInterviewId: interviewId,
          metadata: {
            dependencyType: dep.type,
            isCritical: dep.isCritical,
            evidence: dep.evidence,
          },
          tenantId,
          projectId,
        },
      });
    }
  }

  // -------------------------------------------------------------------------
  // Pass 5: Factual Claims → FactualClaim
  // -------------------------------------------------------------------------

  private async processPass5(
    tx: PrismaClient,
    p5: ExtractionP5,
    tenantId: string,
    projectId: string,
    interviewId: string,
  ): Promise<void> {
    for (const claim of p5.claims) {
      await tx.factualClaim.create({
        data: {
          subject: claim.subject,
          predicate: claim.predicate,
          object: claim.value,
          claimType: claim.valueType,
          confidence: claim.confidence,
          evidence: claim.evidence,
          sourceInterviewId: interviewId,
          tenantId,
          projectId,
        },
      });
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Creates a normalized key for entity lookup. This allows matching
   * entities regardless of case or minor whitespace differences.
   */
  private normalizeKey(type: string, name: string): string {
    return `${type}::${name.toLowerCase().trim()}`;
  }

  /**
   * Tries to resolve an entity name to its ID. Searches across all entity
   * types if the specific type match fails (handles cases where the LLM
   * references a role name in a system or process context).
   */
  private resolveEntity(
    entityMap: EntityMap,
    type: string,
    name: string,
  ): string | null {
    // Try exact type match first
    const key = this.normalizeKey(type, name);
    const directMatch = entityMap.get(key);
    if (directMatch) return directMatch;

    // Fallback: search across all types (fuzzy cross-type resolution)
    const normalizedName = name.toLowerCase().trim();
    for (const [mapKey, id] of entityMap.entries()) {
      const [, mapName] = mapKey.split('::');
      if (mapName === normalizedName) return id;
    }

    return null;
  }

  /**
   * Maps extraction dependency type string to the closest OrgRelationType.
   */
  private mapDependencyType(
    depType: string,
  ): OrgRelationType {
    const mapping: Record<string, OrgRelationType> = {
      INFORMATION: OrgRelationType.INPUTS,
      APPROVAL: OrgRelationType.DEPENDS_ON,
      MATERIAL: OrgRelationType.INPUTS,
      TRIGGER: OrgRelationType.TRIGGERS,
      DATA: OrgRelationType.INPUTS,
      RESOURCE: OrgRelationType.DEPENDS_ON,
      COORDINATION: OrgRelationType.DEPENDS_ON,
    };
    return mapping[depType] ?? OrgRelationType.DEPENDS_ON;
  }
}
