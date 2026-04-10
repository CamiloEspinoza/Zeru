import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ProjectPropertiesService } from './project-properties.service';
import { PrismaService } from '../../../prisma/prisma.service';

// ─── Helpers ─────────────────────────────────────────────────

const TENANT_ID = 'tenant-1';
const PROJECT_ID = 'project-1';

function createMockClient() {
  return {
    projectPropertyDefinition: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: null } }),
      create: jest.fn().mockImplementation(({ data }) => ({
        id: 'prop-1',
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      update: jest.fn().mockImplementation(({ data }) => ({
        id: 'prop-1',
        name: 'Test',
        type: 'TEXT',
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    taskPropertyValue: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
  };
}

describe('ProjectPropertiesService', () => {
  let service: ProjectPropertiesService;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(async () => {
    mockClient = createMockClient();

    const mockPrisma = {
      forTenant: jest.fn().mockReturnValue(mockClient),
      $transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn(mockClient);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectPropertiesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ProjectPropertiesService>(ProjectPropertiesService);
  });

  describe('findAllDefinitions', () => {
    it('returns definitions ordered by sortOrder', async () => {
      const defs = [
        { id: '1', name: 'Budget', sortOrder: 0 },
        { id: '2', name: 'Priority', sortOrder: 1 },
      ];
      mockClient.projectPropertyDefinition.findMany.mockResolvedValue(defs);

      const result = await service.findAllDefinitions(TENANT_ID, PROJECT_ID);

      expect(result).toEqual(defs);
      expect(
        mockClient.projectPropertyDefinition.findMany,
      ).toHaveBeenCalledWith({
        where: { projectId: PROJECT_ID, deletedAt: null },
        orderBy: { sortOrder: 'asc' },
      });
    });
  });

  describe('createDefinition', () => {
    it('creates a TEXT property with auto sortOrder', async () => {
      const result = await service.createDefinition(TENANT_ID, PROJECT_ID, {
        name: 'Notes',
        type: 'TEXT',
        isRequired: false,
        isVisible: false,
        isFilterable: true,
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('Notes');
      expect(
        mockClient.projectPropertyDefinition.create,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Notes',
            type: 'TEXT',
            sortOrder: 0,
            projectId: PROJECT_ID,
          }),
        }),
      );
    });

    it('throws when SELECT has no options', async () => {
      await expect(
        service.createDefinition(TENANT_ID, PROJECT_ID, {
          name: 'Status',
          type: 'SELECT',
          isRequired: false,
          isVisible: false,
          isFilterable: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a SELECT property with options', async () => {
      const result = await service.createDefinition(TENANT_ID, PROJECT_ID, {
        name: 'Category',
        type: 'SELECT',
        options: [
          { id: 'opt-1', label: 'A', color: '#FF0000' },
          { id: 'opt-2', label: 'B', color: '#00FF00' },
        ],
        isRequired: false,
        isVisible: false,
        isFilterable: true,
      });

      expect(result).toBeDefined();
      expect(
        mockClient.projectPropertyDefinition.create,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Category',
            type: 'SELECT',
            options: expect.arrayContaining([
              expect.objectContaining({ label: 'A' }),
              expect.objectContaining({ label: 'B' }),
            ]),
          }),
        }),
      );
    });
  });

  describe('updateDefinition', () => {
    it('throws NotFoundException when definition not found', async () => {
      mockClient.projectPropertyDefinition.findFirst.mockResolvedValue(null);

      await expect(
        service.updateDefinition(TENANT_ID, PROJECT_ID, 'nonexistent', {
          name: 'Updated',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates name successfully', async () => {
      mockClient.projectPropertyDefinition.findFirst.mockResolvedValue({
        id: 'prop-1',
        name: 'Old Name',
        type: 'TEXT',
        options: null,
      });

      const result = await service.updateDefinition(
        TENANT_ID,
        PROJECT_ID,
        'prop-1',
        { name: 'New Name' },
      );

      expect(result).toBeDefined();
      expect(
        mockClient.projectPropertyDefinition.update,
      ).toHaveBeenCalledWith({
        where: { id: 'prop-1' },
        data: { name: 'New Name' },
      });
    });
  });

  describe('removeDefinition', () => {
    it('throws NotFoundException when definition not found', async () => {
      mockClient.projectPropertyDefinition.findFirst.mockResolvedValue(null);

      await expect(
        service.removeDefinition(TENANT_ID, PROJECT_ID, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('soft deletes the definition', async () => {
      mockClient.projectPropertyDefinition.findFirst.mockResolvedValue({
        id: 'prop-1',
        name: 'Budget',
      });

      const result = await service.removeDefinition(
        TENANT_ID,
        PROJECT_ID,
        'prop-1',
      );

      expect(result.message).toBe('Propiedad eliminada');
      expect(
        mockClient.projectPropertyDefinition.update,
      ).toHaveBeenCalledWith({
        where: { id: 'prop-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  describe('reorderDefinitions', () => {
    it('updates sortOrder based on array index', async () => {
      await service.reorderDefinitions(TENANT_ID, PROJECT_ID, {
        ids: ['id-b', 'id-a', 'id-c'],
      });

      expect(
        mockClient.projectPropertyDefinition.updateMany,
      ).toHaveBeenCalledTimes(3);
      expect(
        mockClient.projectPropertyDefinition.updateMany,
      ).toHaveBeenCalledWith({
        where: {
          id: 'id-b',
          projectId: PROJECT_ID,
          tenantId: TENANT_ID,
          deletedAt: null,
        },
        data: { sortOrder: 0 },
      });
    });
  });
});
