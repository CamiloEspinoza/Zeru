import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { USER_SUMMARY_SELECT, mapUserWithAvatar } from '../../users/user-select';
import type { SetPropertyValueDto } from '../../projects/dto/property.dto';

interface SelectOption {
  id: string;
  label: string;
  color: string;
}

@Injectable()
export class TaskPropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  async getTaskPropertyValues(tenantId: string, taskId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const raw = await client.taskPropertyValue.findMany({
      where: { taskId },
      include: {
        personUser: { select: USER_SUMMARY_SELECT },
      },
    });
    return raw.map((v) => ({
      ...v,
      personUser: v.personUser ? mapUserWithAvatar(v.personUser) : null,
    }));
  }

  async upsertValue(
    tenantId: string,
    taskId: string,
    propertyDefinitionId: string,
    dto: SetPropertyValueDto,
  ) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    // Verify the task exists
    const task = await client.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: { id: true, projectId: true },
    });
    if (!task) {
      throw new NotFoundException('Tarea no encontrada');
    }

    // Verify the property definition exists and belongs to the same project
    const definition = await client.projectPropertyDefinition.findFirst({
      where: {
        id: propertyDefinitionId,
        projectId: task.projectId,
        deletedAt: null,
      },
    });
    if (!definition) {
      throw new NotFoundException(
        'Definición de propiedad no encontrada en este proyecto',
      );
    }

    // Validate SELECT options
    if (
      (definition.type === 'SELECT' || definition.type === 'MULTI_SELECT') &&
      dto.selectedOptionIds &&
      dto.selectedOptionIds.length > 0
    ) {
      const validOptions = (definition.options as SelectOption[]) || [];
      const validIds = new Set(validOptions.map((o) => o.id));
      for (const optId of dto.selectedOptionIds) {
        if (!validIds.has(optId)) {
          throw new BadRequestException(
            `Opción ${optId} no es válida para esta propiedad`,
          );
        }
      }

      // For single SELECT, only one option allowed
      if (
        definition.type === 'SELECT' &&
        dto.selectedOptionIds.length > 1
      ) {
        throw new BadRequestException(
          'SELECT solo permite una opción seleccionada',
        );
      }
    }

    // Validate PERSON: user must be a project member
    if (definition.type === 'PERSON' && dto.personUserId) {
      const member = await client.projectMember.findFirst({
        where: {
          projectId: task.projectId,
          userId: dto.personUserId,
        },
      });
      if (!member) {
        throw new BadRequestException(
          'El usuario no es miembro de este proyecto',
        );
      }
    }

    // Build the data payload based on property type
    const data = this.buildValueData(definition.type, dto);

    const raw = await client.taskPropertyValue.upsert({
      where: {
        taskId_propertyDefinitionId: {
          taskId,
          propertyDefinitionId,
        },
      },
      create: {
        taskId,
        propertyDefinitionId,
        tenantId,
        ...data,
      },
      update: data,
      include: {
        personUser: { select: USER_SUMMARY_SELECT },
      },
    });

    return {
      ...raw,
      personUser: raw.personUser ? mapUserWithAvatar(raw.personUser) : null,
    };
  }

  async clearValue(
    tenantId: string,
    taskId: string,
    propertyDefinitionId: string,
  ) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const value = await client.taskPropertyValue.findFirst({
      where: { taskId, propertyDefinitionId },
    });
    if (!value) {
      // Already cleared — return 204 equivalent
      return null;
    }

    await client.taskPropertyValue.delete({
      where: { id: value.id },
    });

    return null;
  }

  private buildValueData(
    type: string,
    dto: SetPropertyValueDto,
  ): Record<string, unknown> {
    // Reset all typed columns, then set the relevant one
    const base: Record<string, unknown> = {
      textValue: null,
      numberValue: null,
      dateValue: null,
      booleanValue: null,
      selectedOptionIds: [],
      personUserId: null,
    };

    switch (type) {
      case 'TEXT':
        base.textValue = dto.textValue ?? null;
        break;
      case 'NUMBER':
        base.numberValue = dto.numberValue ?? null;
        break;
      case 'DATE':
        base.dateValue = dto.dateValue ? new Date(dto.dateValue) : null;
        break;
      case 'CHECKBOX':
        base.booleanValue = dto.booleanValue ?? null;
        break;
      case 'SELECT':
      case 'MULTI_SELECT':
        base.selectedOptionIds = dto.selectedOptionIds ?? [];
        break;
      case 'PERSON':
        base.personUserId = dto.personUserId ?? null;
        break;
      case 'URL':
        base.textValue = dto.textValue ?? null;
        break;
    }

    return base;
  }
}
