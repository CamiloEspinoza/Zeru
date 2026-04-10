import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { S3Service } from '../../files/s3.service';
import { UsersService } from '../../users/users.service';
import type {
  CreatePersonProfileDto,
  UpdatePersonProfileDto,
  ListPersonProfilesDto,
} from '../dto';

const ALLOWED_IMAGE_MIMETYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

@Injectable()
export class PersonProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly usersService: UsersService,
  ) {}

  async create(tenantId: string, dto: CreatePersonProfileDto) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    // Validate reportsToId exists if provided
    if (dto.reportsToId) {
      await this.findOne(tenantId, dto.reportsToId);
    }

    return client.personProfile.create({
      data: {
        name: dto.name,
        role: dto.role,
        departmentId: dto.departmentId ?? undefined,
        personType: dto.personType ?? 'INTERNAL',
        company: dto.company,
        email: dto.email,
        phone: dto.phone,
        notes: dto.notes,
        reportsToId: dto.reportsToId ?? undefined,
        employeeCode: dto.employeeCode,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        status: dto.status,
        source: dto.source,
      },
      include: {
        department: { select: { id: true, name: true, color: true } },
      },
    });
  }

  async findAll(tenantId: string, dto: ListPersonProfilesDto) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (dto.search) {
      where.OR = [
        { name: { contains: dto.search, mode: 'insensitive' } },
        { role: { contains: dto.search, mode: 'insensitive' } },
        { department: { name: { contains: dto.search, mode: 'insensitive' } } },
        { email: { contains: dto.search, mode: 'insensitive' } },
      ];
    }

    if (dto.departmentId) {
      where.departmentId = dto.departmentId;
    }

    if (dto.status) {
      where.status = dto.status;
    }

    if (dto.reportsToId) {
      where.reportsToId = dto.reportsToId;
    }

    const [data, total] = await Promise.all([
      client.personProfile.findMany({
        where,
        include: {
          reportsTo: { select: { id: true, name: true, role: true } },
          department: { select: { id: true, name: true, color: true } },
          user: { select: { id: true, email: true, isActive: true, type: true } },
        },
        orderBy: { name: 'asc' },
        skip: (dto.page - 1) * dto.perPage,
        take: dto.perPage,
      }),
      client.personProfile.count({ where }),
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

    const profile = await client.personProfile.findFirst({
      where: { id, deletedAt: null },
      include: {
        reportsTo: { select: { id: true, name: true, role: true } },
        department: { select: { id: true, name: true, color: true } },
        user: { select: { id: true, email: true, isActive: true, type: true } },
        directReports: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            role: true,
            department: { select: { id: true, name: true, color: true } },
            status: true,
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException(`Perfil de persona con id ${id} no encontrado`);
    }

    return profile;
  }

  async update(tenantId: string, id: string, dto: UpdatePersonProfileDto) {
    await this.findOne(tenantId, id);

    // Validate reportsToId if provided
    if (dto.reportsToId !== undefined && dto.reportsToId !== null) {
      if (dto.reportsToId === id) {
        throw new BadRequestException('Una persona no puede reportar a sí misma');
      }
      await this.findOne(tenantId, dto.reportsToId);
    }

    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    if (dto.userId !== undefined && dto.userId !== null) {
      const membership = await this.prisma.userTenant.findFirst({
        where: { userId: dto.userId, tenantId },
      });
      if (!membership) {
        throw new NotFoundException('User not found in this tenant');
      }
    }

    return client.personProfile.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.departmentId !== undefined && { departmentId: dto.departmentId }),
        ...(dto.personType !== undefined && { personType: dto.personType }),
        ...(dto.company !== undefined && { company: dto.company }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.reportsToId !== undefined && { reportsToId: dto.reportsToId }),
        ...(dto.employeeCode !== undefined && { employeeCode: dto.employeeCode }),
        ...(dto.startDate !== undefined && {
          startDate: dto.startDate ? new Date(dto.startDate) : null,
        }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.source !== undefined && { source: dto.source }),
        ...(dto.userId !== undefined && { userId: dto.userId }),
      },
      include: {
        department: { select: { id: true, name: true, color: true } },
        user: { select: { id: true, email: true, isActive: true, type: true } },
      },
    });
  }

  async createUserFromPerson(
    tenantId: string,
    personId: string,
    role: 'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'VIEWER' = 'VIEWER',
  ) {
    const person = await this.prisma.personProfile.findFirst({
      where: { id: personId, tenantId, deletedAt: null },
    });

    if (!person) {
      throw new NotFoundException('Person not found');
    }

    if (person.userId) {
      throw new ConflictException('Person already has a linked user account');
    }

    if (!person.email) {
      throw new BadRequestException(
        'Person must have an email to create a user account',
      );
    }

    const nameParts = person.name.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || firstName;

    const user = await this.usersService.create(tenantId, {
      email: person.email,
      firstName,
      lastName,
      role,
    });

    return this.prisma.personProfile.update({
      where: { id: personId },
      data: { userId: user.id },
      include: {
        department: true,
        reportsTo: { select: { id: true, name: true, role: true } },
        user: { select: { id: true, email: true, isActive: true, type: true } },
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    return client.personProfile.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async uploadAvatar(tenantId: string, id: string, file: Express.Multer.File) {
    if (!ALLOWED_IMAGE_MIMETYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Tipo de archivo no permitido: ${file.mimetype}. Tipos permitidos: ${ALLOWED_IMAGE_MIMETYPES.join(', ')}`,
      );
    }

    await this.findOne(tenantId, id);

    const ext = file.originalname.split('.').pop() ?? 'jpg';
    const key = `tenants/${tenantId}/persons/${id}/avatar.${ext}`;
    await this.s3.upload(tenantId, key, file.buffer, file.mimetype);

    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    return client.personProfile.update({
      where: { id },
      data: { avatarS3Key: key },
    });
  }

  async getAvatarUrl(tenantId: string, id: string) {
    const profile = await this.findOne(tenantId, id);

    if (!profile.avatarS3Key) {
      return { url: null };
    }

    const url = await this.s3.getPresignedUrl(tenantId, profile.avatarS3Key, 3600);
    return { url };
  }

  async getOrgchart(tenantId: string, rootId?: string, depth = 10) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    // Load all non-deleted persons for this tenant
    const persons = await client.personProfile.findMany({
      where: { deletedAt: null },
      include: {
        department: { select: { id: true, name: true, color: true } },
      },
      orderBy: { name: 'asc' },
    });

    // Build tree in memory
    type PersonNode = (typeof persons)[number] & {
      directReports: PersonNode[];
      directReportsCount: number;
    };

    const personMap = new Map<string, PersonNode>();
    for (const p of persons) {
      personMap.set(p.id, { ...p, directReports: [], directReportsCount: 0 });
    }

    const roots: PersonNode[] = [];
    const unassigned: PersonNode[] = [];

    for (const person of personMap.values()) {
      if (person.reportsToId && personMap.has(person.reportsToId)) {
        personMap.get(person.reportsToId)!.directReports.push(person);
      }
    }

    // Compute directReportsCount for all nodes
    for (const person of personMap.values()) {
      person.directReportsCount = person.directReports.length;
    }

    // Classify root-level persons (no reportsToId or reportsTo not found)
    for (const person of personMap.values()) {
      if (!person.reportsToId || !personMap.has(person.reportsToId)) {
        if (person.directReports.length > 0) {
          roots.push(person);
        } else {
          unassigned.push(person);
        }
      }
    }

    // If no clear roots exist, all unassigned become roots
    if (roots.length === 0 && unassigned.length > 0) {
      roots.push(...unassigned.splice(0));
    }

    // If rootId specified, return subtree from that node
    if (rootId && personMap.has(rootId)) {
      return {
        roots: [personMap.get(rootId)],
        unassigned: [],
        stats: this.buildOrgchartStats(persons, personMap),
      };
    }

    // Trim tree to requested depth
    const trimToDepth = (nodes: PersonNode[], currentDepth: number) => {
      if (currentDepth >= depth) {
        for (const node of nodes) {
          node.directReports = [];
        }
        return;
      }
      for (const node of nodes) {
        trimToDepth(node.directReports, currentDepth + 1);
      }
    };
    trimToDepth(roots, 1);

    return {
      roots,
      unassigned,
      stats: this.buildOrgchartStats(persons, personMap),
    };
  }

  private buildOrgchartStats(
    persons: { status: string; department: { id: string; name: string; color: string | null } | null; reportsToId: string | null }[],
    personMap: Map<string, { directReports: unknown[] }>,
  ) {
    const departments = [
      ...new Set(
        persons
          .map((p) => p.department?.name)
          .filter((d): d is string => d !== null && d !== undefined && d !== ''),
      ),
    ].sort();

    // Compute max depth
    const computeDepth = (nodeId: string, visited: Set<string>): number => {
      if (visited.has(nodeId)) return 0;
      visited.add(nodeId);
      const node = personMap.get(nodeId);
      if (!node || (node.directReports as { id: string }[]).length === 0) return 1;
      return (
        1 +
        Math.max(
          ...(node.directReports as { id: string }[]).map((child) =>
            computeDepth(child.id, visited),
          ),
        )
      );
    };

    // Find root nodes (no reportsToId) and compute max depth from them
    const rootIds = persons
      .filter((p) => !p.reportsToId)
      .map((p) => (p as { id: string }).id);
    const maxDepth =
      rootIds.length > 0
        ? Math.max(...rootIds.map((id) => computeDepth(id, new Set())))
        : 0;

    return {
      totalPersons: persons.length,
      totalActive: persons.filter((p) => p.status === 'ACTIVE').length,
      totalVacant: persons.filter((p) => p.status === 'VACANT').length,
      totalUnassigned: persons.filter(
        (p) => !p.reportsToId && (personMap.get((p as { id: string }).id)?.directReports as unknown[])?.length === 0,
      ).length,
      departments,
      maxDepth,
    };
  }

  async updateReportsTo(
    tenantId: string,
    personId: string,
    reportsToId: string | null,
  ) {
    // Validate that the person exists
    await this.findOne(tenantId, personId);

    // Validate that a person cannot report to themselves
    if (reportsToId === personId) {
      throw new BadRequestException(
        'Una persona no puede reportar a sí misma',
      );
    }

    // Validate that reportsTo exists if not null, and check for cycles
    if (reportsToId) {
      await this.findOne(tenantId, reportsToId);
      await this.validateNoCycle(tenantId, personId, reportsToId);
    }

    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    return client.personProfile.update({
      where: { id: personId },
      data: { reportsToId },
      include: {
        reportsTo: { select: { id: true, name: true, role: true } },
      },
    });
  }

  /**
   * Validates that setting reportsToId would not create a cycle.
   * Walks up the chain from the new manager to ensure we never reach personId.
   */
  private async validateNoCycle(
    tenantId: string,
    personId: string,
    newManagerId: string,
  ) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const visited = new Set<string>();
    let currentId: string | null = newManagerId;

    while (currentId) {
      if (currentId === personId) {
        throw new BadRequestException(
          'No se puede asignar este reporte porque crearía un ciclo en la jerarquía',
        );
      }
      if (visited.has(currentId)) break;
      visited.add(currentId);

      const current = await client.personProfile.findFirst({
        where: { id: currentId, deletedAt: null },
        select: { reportsToId: true },
      });
      currentId = current?.reportsToId ?? null;
    }
  }

  async getDepartments(tenantId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    return client.department.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, color: true },
    });
  }
}
