import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  CreatePropertyDefinitionDto,
  UpdatePropertyDefinitionDto,
  ReorderPropertyDefinitionsDto,
} from '../dto/property.dto';
import { randomUUID } from 'crypto';

interface SelectOption {
  id: string;
  label: string;
  color: string;
}

@Injectable()
export class ProjectPropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllDefinitions(tenantId: string, projectId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    return client.projectPropertyDefinition.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createDefinition(
    tenantId: string,
    projectId: string,
    dto: CreatePropertyDefinitionDto,
  ) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    // Validate that SELECT/MULTI_SELECT have options
    if (
      (dto.type === 'SELECT' || dto.type === 'MULTI_SELECT') &&
      (!dto.options || dto.options.length === 0)
    ) {
      throw new BadRequestException(
        'SELECT y MULTI_SELECT requieren al menos una opción',
      );
    }

    // Generate server-side UUIDs for options if they don't exist
    let options: SelectOption[] | undefined;
    if (dto.options && dto.options.length > 0) {
      options = dto.options.map((opt) => ({
        id: opt.id || randomUUID(),
        label: opt.label,
        color: opt.color,
      }));
    }

    // Determine sort order
    let sortOrder = dto.sortOrder;
    if (sortOrder === undefined) {
      const maxOrder = await client.projectPropertyDefinition.aggregate({
        where: { projectId, deletedAt: null },
        _max: { sortOrder: true },
      });
      sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
    }

    return client.projectPropertyDefinition.create({
      data: {
        name: dto.name,
        type: dto.type,
        options: options ?? undefined,
        sortOrder,
        isRequired: dto.isRequired,
        isVisible: dto.isVisible,
        isFilterable: dto.isFilterable,
        projectId,
        tenantId,
      },
    });
  }

  async updateDefinition(
    tenantId: string,
    projectId: string,
    id: string,
    dto: UpdatePropertyDefinitionDto,
  ) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const definition = await client.projectPropertyDefinition.findFirst({
      where: { id, projectId, deletedAt: null },
    });
    if (!definition) {
      throw new NotFoundException('Propiedad no encontrada');
    }

    // If updating options for SELECT/MULTI_SELECT, handle removed option ids
    let cleanupRemovedOptions = false;
    let removedOptionIds: string[] = [];

    if (
      dto.options !== undefined &&
      (definition.type === 'SELECT' || definition.type === 'MULTI_SELECT')
    ) {
      const existingOptions = (definition.options as SelectOption[]) || [];
      const existingIds = new Set(existingOptions.map((o) => o.id));
      const newOptions = dto.options || [];
      const newIds = new Set(newOptions.map((o) => o.id));

      removedOptionIds = [...existingIds].filter((eid) => !newIds.has(eid));
      if (removedOptionIds.length > 0) {
        cleanupRemovedOptions = true;
      }
    }

    const updated = await client.projectPropertyDefinition.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.options !== undefined && { options: dto.options }),
        ...(dto.isRequired !== undefined && { isRequired: dto.isRequired }),
        ...(dto.isVisible !== undefined && { isVisible: dto.isVisible }),
        ...(dto.isFilterable !== undefined && { isFilterable: dto.isFilterable }),
      },
    });

    // Clean up task values that referenced removed options
    if (cleanupRemovedOptions && removedOptionIds.length > 0) {
      const affectedValues = await client.taskPropertyValue.findMany({
        where: { propertyDefinitionId: id },
        select: { id: true, selectedOptionIds: true },
      });

      const removedSet = new Set(removedOptionIds);
      for (const val of affectedValues) {
        const filtered = val.selectedOptionIds.filter(
          (oid) => !removedSet.has(oid),
        );
        if (filtered.length !== val.selectedOptionIds.length) {
          await client.taskPropertyValue.update({
            where: { id: val.id },
            data: { selectedOptionIds: filtered },
          });
        }
      }
    }

    return updated;
  }

  async removeDefinition(tenantId: string, projectId: string, id: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const definition = await client.projectPropertyDefinition.findFirst({
      where: { id, projectId, deletedAt: null },
    });
    if (!definition) {
      throw new NotFoundException('Propiedad no encontrada');
    }

    // Soft delete
    await client.projectPropertyDefinition.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Propiedad eliminada' };
  }

  async reorderDefinitions(
    tenantId: string,
    projectId: string,
    dto: ReorderPropertyDefinitionsDto,
  ) {
    await this.prisma.$transaction(async (tx: any) => {
      for (let i = 0; i < dto.ids.length; i++) {
        await tx.projectPropertyDefinition.updateMany({
          where: {
            id: dto.ids[i],
            projectId,
            tenantId,
            deletedAt: null,
          },
          data: { sortOrder: i },
        });
      }
    });

    return { message: 'Orden actualizado' };
  }
}
