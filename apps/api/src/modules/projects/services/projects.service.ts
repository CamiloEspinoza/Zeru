import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  CreateProjectDto,
  UpdateProjectDto,
  ListProjectsDto,
  CreateSectionDto,
  UpdateSectionDto,
  ReorderSectionsDto,
} from '../dto';

const DEFAULT_STATUSES = [
  { name: 'Backlog', slug: 'backlog', category: 'backlog', sortOrder: 0 },
  {
    name: 'Por hacer',
    slug: 'por-hacer',
    category: 'active',
    sortOrder: 1,
    isDefault: true,
  },
  {
    name: 'En progreso',
    slug: 'en-progreso',
    category: 'active',
    sortOrder: 2,
  },
  {
    name: 'En revision',
    slug: 'en-revision',
    category: 'active',
    sortOrder: 3,
  },
  { name: 'Hecho', slug: 'hecho', category: 'done', sortOrder: 4 },
  {
    name: 'Cancelado',
    slug: 'cancelado',
    category: 'cancelled',
    sortOrder: 5,
  },
];

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(tenantId: string, userId: string, dto: CreateProjectDto) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    // Validate unique key per tenant
    const existing = await client.project.findFirst({
      where: { key: dto.key },
    });
    if (existing) {
      throw new ConflictException(
        `Ya existe un proyecto con la clave "${dto.key}"`,
      );
    }

    let project;
    try {
      project = await this.prisma.$transaction(async (tx: any) => {
      // Create project
      const created = await tx.project.create({
        data: {
          name: dto.name,
          description: dto.description,
          key: dto.key,
          visibility: dto.visibility,
          color: dto.color,
          icon: dto.icon,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          createdById: userId,
          tenantId,
        },
      });

      // Create default status configs
      await tx.taskStatusConfig.createMany({
        data: DEFAULT_STATUSES.map((s) => ({
          name: s.name,
          slug: s.slug,
          category: s.category,
          sortOrder: s.sortOrder,
          isDefault: s.isDefault ?? false,
          projectId: created.id,
          tenantId,
        })),
      });

      // Add creator as OWNER
      await tx.projectMember.create({
        data: {
          projectId: created.id,
          userId,
          role: 'OWNER',
          tenantId,
        },
      });

      // Add initial members
      if (dto.memberIds?.length) {
        const uniqueIds = dto.memberIds.filter((id) => id !== userId);
        if (uniqueIds.length > 0) {
          await tx.projectMember.createMany({
            data: uniqueIds.map((memberId) => ({
              projectId: created.id,
              userId: memberId,
              role: 'MEMBER',
              tenantId,
            })),
          });
        }
      }

      // Create default "Board" view
      await tx.taskView.create({
        data: {
          name: 'Board',
          type: 'BOARD',
          isDefault: true,
          projectId: created.id,
          createdById: userId,
          tenantId,
        },
      });

      return created;
    });
    } catch (e) {
      // Race-safe duplicate-key handling for project.key (unique per tenant)
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          `Ya existe un proyecto con la clave "${dto.key}"`,
        );
      }
      throw e;
    }

    this.eventEmitter.emit('project.created', {
      tenantId,
      projectId: project.id,
      userId,
    });

    return project;
  }

  async findAll(tenantId: string, userId: string, dto: ListProjectsDto) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    // Visibility filter: users can see PUBLIC projects or projects they
    // are a member of. We compose this with any text search the caller
    // requested by AND-ing two top-level OR groups.
    const visibilityClause = {
      OR: [
        { visibility: 'PUBLIC' },
        { members: { some: { userId } } },
      ],
    };

    const filterClauses: Record<string, unknown>[] = [visibilityClause];
    if (dto.search) {
      filterClauses.push({
        OR: [
          { name: { contains: dto.search, mode: 'insensitive' } },
          { key: { contains: dto.search, mode: 'insensitive' } },
        ],
      });
    }

    const where: Record<string, unknown> = {
      deletedAt: null,
      AND: filterClauses,
      ...(dto.status ? { status: dto.status } : {}),
    };

    const [data, total] = await Promise.all([
      client.project.findMany({
        where,
        orderBy: { [dto.sortBy]: dto.sortOrder },
        skip: (dto.page - 1) * dto.perPage,
        take: dto.perPage,
        include: {
          createdBy: {
            select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
          },
          _count: {
            select: {
              tasks: true,
              members: true,
            },
          },
        },
      }),
      client.project.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: dto.page,
        perPage: dto.perPage,
        totalPages: Math.ceil(total / dto.perPage),
      },
    };
  }

  async findOne(tenantId: string, id: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const project = await client.project.findFirst({
      where: { id, deletedAt: null },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        taskStatuses: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        },
        sections: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        },
        labels: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        },
        taskViews: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: { tasks: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Proyecto con id ${id} no encontrado`);
    }

    return project;
  }

  async update(tenantId: string, id: string, userId: string, dto: UpdateProjectDto) {
    const existing = await this.findOne(tenantId, id);

    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const project = await client.project.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.visibility !== undefined && { visibility: dto.visibility }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.startDate !== undefined && {
          startDate: dto.startDate ? new Date(dto.startDate) : null,
        }),
        ...(dto.dueDate !== undefined && {
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });

    this.eventEmitter.emit('project.updated', {
      tenantId,
      projectId: id,
      userId,
      changes: dto,
      previous: {
        name: existing.name,
        status: existing.status,
        visibility: existing.visibility,
      },
    });

    return project;
  }

  async remove(tenantId: string, id: string, userId: string) {
    await this.findOne(tenantId, id);

    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    await client.project.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.eventEmitter.emit('project.deleted', {
      tenantId,
      projectId: id,
      userId,
    });

    return { message: 'Proyecto eliminado' };
  }

  async duplicate(tenantId: string, id: string, userId: string) {
    const source = await this.findOne(tenantId, id);

    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    // Find a unique key
    let newKey = `${source.key}2`;
    let attempt = 2;
    while (await client.project.findFirst({ where: { key: newKey } })) {
      attempt++;
      newKey = `${source.key}${attempt}`;
    }

    const project = await this.prisma.$transaction(async (tx: any) => {
      const created = await tx.project.create({
        data: {
          name: `${source.name} (copia)`,
          description: source.description,
          key: newKey,
          visibility: source.visibility,
          color: source.color,
          icon: source.icon,
          createdById: userId,
          tenantId,
        },
      });

      // Copy statuses
      if (source.taskStatuses?.length) {
        await tx.taskStatusConfig.createMany({
          data: source.taskStatuses.map(
            (s: { name: string; slug: string; color: string | null; category: string; sortOrder: number; isDefault: boolean }) => ({
              name: s.name,
              slug: s.slug,
              color: s.color,
              category: s.category,
              sortOrder: s.sortOrder,
              isDefault: s.isDefault,
              projectId: created.id,
              tenantId,
            }),
          ),
        });
      }

      // Copy sections
      if (source.sections?.length) {
        await tx.projectSection.createMany({
          data: source.sections.map((s: { name: string; sortOrder: number }) => ({
            name: s.name,
            sortOrder: s.sortOrder,
            projectId: created.id,
            tenantId,
          })),
        });
      }

      // Copy labels
      if (source.labels?.length) {
        await tx.label.createMany({
          data: source.labels.map((l: { name: string; color: string; sortOrder: number }) => ({
            name: l.name,
            color: l.color,
            sortOrder: l.sortOrder,
            projectId: created.id,
            tenantId,
          })),
        });
      }

      // Copy views
      if (source.taskViews?.length) {
        await tx.taskView.createMany({
          data: source.taskViews.map(
            (v: { name: string; type: string; config: unknown; filters: unknown; isDefault: boolean; sortOrder: number }) => ({
              name: v.name,
              type: v.type,
              config: v.config,
              filters: v.filters,
              isDefault: v.isDefault,
              sortOrder: v.sortOrder,
              projectId: created.id,
              createdById: userId,
              tenantId,
            }),
          ),
        });
      }

      // Add creator as OWNER
      await tx.projectMember.create({
        data: {
          projectId: created.id,
          userId,
          role: 'OWNER',
          tenantId,
        },
      });

      return created;
    });

    this.eventEmitter.emit('project.created', {
      tenantId,
      projectId: project.id,
      userId,
      duplicatedFrom: id,
    });

    return project;
  }

  // ─── Section Methods ───────────────────────────────────

  async findSections(tenantId: string, projectId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    return client.projectSection.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createSection(
    tenantId: string,
    projectId: string,
    dto: CreateSectionDto,
  ) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const maxOrder = await client.projectSection.aggregate({
      where: { projectId, deletedAt: null },
      _max: { sortOrder: true },
    });

    const section = await client.projectSection.create({
      data: {
        name: dto.name,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        projectId,
        tenantId,
      },
    });

    this.eventEmitter.emit('section.changed', {
      tenantId,
      projectId,
      sectionId: section.id,
      action: 'created',
      changes: { name: section.name, sortOrder: section.sortOrder },
    });

    return section;
  }

  async updateSection(
    tenantId: string,
    projectId: string,
    sectionId: string,
    dto: UpdateSectionDto,
  ) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const section = await client.projectSection.findFirst({
      where: { id: sectionId, projectId, deletedAt: null },
    });
    if (!section) {
      throw new NotFoundException('Seccion no encontrada');
    }

    const updated = await client.projectSection.update({
      where: { id: sectionId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });

    this.eventEmitter.emit('section.changed', {
      tenantId,
      projectId,
      sectionId,
      action: 'updated',
      changes: dto,
    });

    return updated;
  }

  async deleteSection(tenantId: string, projectId: string, sectionId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const section = await client.projectSection.findFirst({
      where: { id: sectionId, projectId, deletedAt: null },
    });
    if (!section) {
      throw new NotFoundException('Seccion no encontrada');
    }

    await this.prisma.$transaction(async (tx: any) => {
      // Unset sectionId on tasks
      await tx.task.updateMany({
        where: { sectionId, tenantId },
        data: { sectionId: null },
      });

      await tx.projectSection.update({
        where: { id: sectionId },
        data: { deletedAt: new Date() },
      });
    });

    this.eventEmitter.emit('section.changed', {
      tenantId,
      projectId,
      sectionId,
      action: 'deleted',
      changes: {},
    });

    return { message: 'Seccion eliminada' };
  }

  async reorderSections(
    tenantId: string,
    projectId: string,
    dto: ReorderSectionsDto,
  ) {
    await this.prisma.$transaction(async (tx: any) => {
      for (let i = 0; i < dto.sectionIds.length; i++) {
        await tx.projectSection.updateMany({
          where: {
            id: dto.sectionIds[i],
            projectId,
            tenantId,
          },
          data: { sortOrder: i },
        });
      }
    });

    this.eventEmitter.emit('section.changed', {
      tenantId,
      projectId,
      sectionId: null,
      action: 'reordered',
      changes: { sectionIds: dto.sectionIds },
    });

    return this.findSections(tenantId, projectId);
  }
}
