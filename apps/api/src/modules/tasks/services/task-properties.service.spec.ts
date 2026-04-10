import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TaskPropertiesService } from './task-properties.service';
import { PrismaService } from '../../../prisma/prisma.service';

const TENANT_ID = 'tenant-1';
const TASK_ID = 'task-1';
const PROJECT_ID = 'project-1';
const PROP_DEF_ID = 'prop-def-1';

function createMockClient() {
  return {
    taskPropertyValue: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockImplementation(({ create }) => ({
        id: 'val-1',
        ...create,
        createdAt: new Date(),
        updatedAt: new Date(),
        personUser: null,
      })),
      delete: jest.fn().mockResolvedValue({}),
    },
    task: {
      findFirst: jest.fn().mockResolvedValue({
        id: TASK_ID,
        projectId: PROJECT_ID,
      }),
    },
    projectPropertyDefinition: {
      findFirst: jest.fn().mockResolvedValue({
        id: PROP_DEF_ID,
        type: 'TEXT',
        projectId: PROJECT_ID,
        options: null,
      }),
    },
    projectMember: {
      findFirst: jest.fn().mockResolvedValue({ id: 'member-1' }),
    },
  };
}

describe('TaskPropertiesService', () => {
  let service: TaskPropertiesService;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(async () => {
    mockClient = createMockClient();

    const mockPrisma = {
      forTenant: jest.fn().mockReturnValue(mockClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskPropertiesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TaskPropertiesService>(TaskPropertiesService);
  });

  describe('getTaskPropertyValues', () => {
    it('returns property values for a task', async () => {
      const values = [
        { id: 'v1', textValue: 'Hello', propertyDefinitionId: 'pd1' },
      ];
      mockClient.taskPropertyValue.findMany.mockResolvedValue(values);

      const result = await service.getTaskPropertyValues(TENANT_ID, TASK_ID);

      expect(result).toEqual(values);
      expect(mockClient.taskPropertyValue.findMany).toHaveBeenCalledWith({
        where: { taskId: TASK_ID },
        include: {
          personUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
      });
    });
  });

  describe('upsertValue', () => {
    it('throws NotFoundException when task not found', async () => {
      mockClient.task.findFirst.mockResolvedValue(null);

      await expect(
        service.upsertValue(TENANT_ID, TASK_ID, PROP_DEF_ID, {
          textValue: 'Test',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when definition not in project', async () => {
      mockClient.projectPropertyDefinition.findFirst.mockResolvedValue(null);

      await expect(
        service.upsertValue(TENANT_ID, TASK_ID, 'bad-prop', {
          textValue: 'Test',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('upserts a TEXT value', async () => {
      const result = await service.upsertValue(
        TENANT_ID,
        TASK_ID,
        PROP_DEF_ID,
        { textValue: 'Hello world' },
      );

      expect(result).toBeDefined();
      expect(mockClient.taskPropertyValue.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            taskId_propertyDefinitionId: {
              taskId: TASK_ID,
              propertyDefinitionId: PROP_DEF_ID,
            },
          },
          create: expect.objectContaining({
            textValue: 'Hello world',
            taskId: TASK_ID,
            propertyDefinitionId: PROP_DEF_ID,
            tenantId: TENANT_ID,
          }),
          update: expect.objectContaining({
            textValue: 'Hello world',
          }),
        }),
      );
    });

    it('validates SELECT option ids', async () => {
      mockClient.projectPropertyDefinition.findFirst.mockResolvedValue({
        id: PROP_DEF_ID,
        type: 'SELECT',
        projectId: PROJECT_ID,
        options: [{ id: 'opt-1', label: 'A', color: '#FF0000' }],
      });

      await expect(
        service.upsertValue(TENANT_ID, TASK_ID, PROP_DEF_ID, {
          selectedOptionIds: ['bad-opt'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('validates SELECT allows only one option', async () => {
      mockClient.projectPropertyDefinition.findFirst.mockResolvedValue({
        id: PROP_DEF_ID,
        type: 'SELECT',
        projectId: PROJECT_ID,
        options: [
          { id: 'opt-1', label: 'A', color: '#FF0000' },
          { id: 'opt-2', label: 'B', color: '#00FF00' },
        ],
      });

      await expect(
        service.upsertValue(TENANT_ID, TASK_ID, PROP_DEF_ID, {
          selectedOptionIds: ['opt-1', 'opt-2'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('validates PERSON is a project member', async () => {
      mockClient.projectPropertyDefinition.findFirst.mockResolvedValue({
        id: PROP_DEF_ID,
        type: 'PERSON',
        projectId: PROJECT_ID,
        options: null,
      });
      mockClient.projectMember.findFirst.mockResolvedValue(null);

      await expect(
        service.upsertValue(TENANT_ID, TASK_ID, PROP_DEF_ID, {
          personUserId: 'non-member',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('upserts a NUMBER value', async () => {
      mockClient.projectPropertyDefinition.findFirst.mockResolvedValue({
        id: PROP_DEF_ID,
        type: 'NUMBER',
        projectId: PROJECT_ID,
        options: null,
      });

      await service.upsertValue(TENANT_ID, TASK_ID, PROP_DEF_ID, {
        numberValue: 42.5,
      });

      expect(mockClient.taskPropertyValue.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            numberValue: 42.5,
            textValue: null,
          }),
        }),
      );
    });
  });

  describe('clearValue', () => {
    it('returns null when value does not exist', async () => {
      mockClient.taskPropertyValue.findFirst.mockResolvedValue(null);

      const result = await service.clearValue(
        TENANT_ID,
        TASK_ID,
        PROP_DEF_ID,
      );

      expect(result).toBeNull();
      expect(mockClient.taskPropertyValue.delete).not.toHaveBeenCalled();
    });

    it('deletes the value when it exists', async () => {
      mockClient.taskPropertyValue.findFirst.mockResolvedValue({
        id: 'val-1',
      });

      const result = await service.clearValue(
        TENANT_ID,
        TASK_ID,
        PROP_DEF_ID,
      );

      expect(result).toBeNull();
      expect(mockClient.taskPropertyValue.delete).toHaveBeenCalledWith({
        where: { id: 'val-1' },
      });
    });
  });
});
