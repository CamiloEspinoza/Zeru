import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class OrgDiagramService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a Mermaid flowchart for a process and its activities.
   */
  async generateProcessDiagram(
    tenantId: string,
    processEntityId: string,
  ): Promise<string> {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    // 1. Load the process entity
    const process = await client.orgEntity.findFirst({
      where: { id: processEntityId, type: 'PROCESS', deletedAt: null },
    });

    if (!process) {
      throw new NotFoundException('Proceso no encontrado');
    }

    // 2. Load CONTAINS relations (process -> activities)
    const containsRelations = await client.orgRelation.findMany({
      where: {
        fromEntityId: processEntityId,
        type: 'CONTAINS',
        validTo: null,
      },
      include: { toEntity: true },
    });

    const activities = containsRelations
      .map((r) => r.toEntity)
      .filter((e) => e.type === 'ACTIVITY' && !e.deletedAt)
      .sort((a, b) => a.name.localeCompare(b.name));

    if (activities.length === 0) {
      return `flowchart TD\n  empty["${this.escapeMermaid(process.name)}<br/>Sin actividades"]`;
    }

    // 3. Load PRECEDES relations between activities
    const activityIds = activities.map((a) => a.id);
    const precedesRelations = await client.orgRelation.findMany({
      where: {
        type: 'PRECEDES',
        fromEntityId: { in: activityIds },
        toEntityId: { in: activityIds },
        validTo: null,
      },
    });

    // 4. Load EXECUTES relations (who does each activity)
    const executesRelations = await client.orgRelation.findMany({
      where: {
        type: 'EXECUTES',
        toEntityId: { in: activityIds },
        validTo: null,
      },
      include: { fromEntity: true },
    });

    // 4b. Enrich executor names with PersonProfile real names
    const executorMap = new Map<string, string>();
    for (const rel of executesRelations) {
      let displayName = rel.fromEntity.name;

      // Check if the role OrgEntity has a linked PersonProfile
      const roleMeta = rel.fromEntity.metadata as Record<string, unknown> | null;
      if (roleMeta?.personProfileId) {
        try {
          const person = await client.personProfile.findFirst({
            where: {
              id: roleMeta.personProfileId as string,
              deletedAt: null,
            },
            select: { name: true },
          });
          if (person) {
            displayName = `${person.name} (${rel.fromEntity.name})`;
          }
        } catch {
          // Ignore — use original entity name
        }
      }

      executorMap.set(rel.toEntityId, displayName);
    }

    // 5. Build Mermaid flowchart
    const lines: string[] = ['flowchart TD'];

    // Node definitions
    const nodeIdMap = new Map<string, string>();
    activities.forEach((activity, idx) => {
      const nodeId = `A${idx}`;
      nodeIdMap.set(activity.id, nodeId);
      const executor = executorMap.get(activity.id);
      const label = executor
        ? `${this.escapeMermaid(activity.name)}<br/>Responsable: ${this.escapeMermaid(executor)}`
        : this.escapeMermaid(activity.name);
      lines.push(`  ${nodeId}["${label}"]`);
    });

    // Edges from PRECEDES relations
    if (precedesRelations.length > 0) {
      for (const rel of precedesRelations) {
        const from = nodeIdMap.get(rel.fromEntityId);
        const to = nodeIdMap.get(rel.toEntityId);
        if (from && to) {
          lines.push(`  ${from} --> ${to}`);
        }
      }
    } else {
      // Fallback: chain activities sequentially
      for (let i = 0; i < activities.length - 1; i++) {
        const from = nodeIdMap.get(activities[i].id);
        const to = nodeIdMap.get(activities[i + 1].id);
        if (from && to) {
          lines.push(`  ${from} --> ${to}`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate an org chart (department hierarchy) as Mermaid.
   */
  async generateOrgChart(
    tenantId: string,
    projectId: string,
  ): Promise<string> {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    // 1. Load all DEPARTMENT entities
    const departments = await client.orgEntity.findMany({
      where: {
        projectId,
        type: 'DEPARTMENT',
        validTo: null,
        deletedAt: null,
      },
      orderBy: { name: 'asc' },
    });

    // 2. Load BELONGS_TO relations between departments
    const deptIds = departments.map((d) => d.id);
    const deptRelations = await client.orgRelation.findMany({
      where: {
        type: 'BELONGS_TO',
        fromEntityId: { in: deptIds },
        toEntityId: { in: deptIds },
        validTo: null,
      },
    });

    // 3. Load ROLE entities with BELONGS_TO to departments
    const roles = await client.orgEntity.findMany({
      where: {
        projectId,
        type: 'ROLE',
        validTo: null,
        deletedAt: null,
      },
      orderBy: { name: 'asc' },
    });

    const roleIds = roles.map((r) => r.id);
    const roleDeptRelations = await client.orgRelation.findMany({
      where: {
        type: 'BELONGS_TO',
        fromEntityId: { in: roleIds },
        toEntityId: { in: deptIds },
        validTo: null,
      },
    });

    // 4. Build Mermaid flowchart TD
    const lines: string[] = ['flowchart TD'];

    const nodeIdMap = new Map<string, string>();

    departments.forEach((dept, idx) => {
      const nodeId = `D${idx}`;
      nodeIdMap.set(dept.id, nodeId);
      lines.push(`  ${nodeId}["${this.escapeMermaid(dept.name)}"]`);
    });

    // Enrich role names with linked PersonProfile names
    const roleDisplayNames = new Map<string, string>();
    for (const role of roles) {
      let displayName = role.name;
      const roleMeta = role.metadata as Record<string, unknown> | null;
      if (roleMeta?.personProfileId) {
        try {
          const person = await client.personProfile.findFirst({
            where: {
              id: roleMeta.personProfileId as string,
              deletedAt: null,
            },
            select: { name: true },
          });
          if (person) {
            displayName = `${person.name}<br/>${role.name}`;
          }
        } catch {
          // Ignore — use original entity name
        }
      }
      roleDisplayNames.set(role.id, displayName);
    }

    roles.forEach((role, idx) => {
      const nodeId = `R${idx}`;
      nodeIdMap.set(role.id, nodeId);
      const display = roleDisplayNames.get(role.id) ?? role.name;
      lines.push(`  ${nodeId}("${this.escapeMermaid(display)}")`);
    });

    // Department hierarchy (child BELONGS_TO parent => parent --> child)
    for (const rel of deptRelations) {
      const child = nodeIdMap.get(rel.fromEntityId);
      const parent = nodeIdMap.get(rel.toEntityId);
      if (child && parent) {
        lines.push(`  ${parent} --> ${child}`);
      }
    }

    // Roles belonging to departments
    for (const rel of roleDeptRelations) {
      const role = nodeIdMap.get(rel.fromEntityId);
      const dept = nodeIdMap.get(rel.toEntityId);
      if (role && dept) {
        lines.push(`  ${dept} --> ${role}`);
      }
    }

    if (departments.length === 0 && roles.length === 0) {
      lines.push('  empty["Sin departamentos ni roles"]');
    }

    return lines.join('\n');
  }

  /**
   * Generate a dependency map between processes.
   */
  async generateDependencyMap(
    tenantId: string,
    projectId: string,
  ): Promise<string> {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    // Load PROCESS entities
    const processes = await client.orgEntity.findMany({
      where: {
        projectId,
        type: 'PROCESS',
        validTo: null,
        deletedAt: null,
      },
      orderBy: { name: 'asc' },
    });

    const processIds = processes.map((p) => p.id);

    // Load DEPENDS_ON and TRIGGERS relations between PROCESS entities
    const relations = await client.orgRelation.findMany({
      where: {
        type: { in: ['DEPENDS_ON', 'TRIGGERS'] },
        fromEntityId: { in: processIds },
        toEntityId: { in: processIds },
        validTo: null,
      },
    });

    const lines: string[] = ['flowchart LR'];

    const nodeIdMap = new Map<string, string>();
    processes.forEach((proc, idx) => {
      const nodeId = `P${idx}`;
      nodeIdMap.set(proc.id, nodeId);
      lines.push(`  ${nodeId}["${this.escapeMermaid(proc.name)}"]`);
    });

    for (const rel of relations) {
      const from = nodeIdMap.get(rel.fromEntityId);
      const to = nodeIdMap.get(rel.toEntityId);
      if (from && to) {
        const label = rel.type === 'DEPENDS_ON' ? 'depende de' : 'dispara';
        lines.push(`  ${from} -->|${label}| ${to}`);
      }
    }

    if (processes.length === 0) {
      lines.push('  empty["Sin procesos"]');
    }

    return lines.join('\n');
  }

  private escapeMermaid(text: string): string {
    return text.replace(/"/g, "'").replace(/[[\]{}()]/g, ' ').trim();
  }
}
