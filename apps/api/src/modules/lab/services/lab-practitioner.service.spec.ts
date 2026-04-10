import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LabPractitionerService } from './lab-practitioner.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('LabPractitionerService', () => {
  let service: LabPractitionerService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      labPractitioner: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        LabPractitionerService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(LabPractitionerService);
  });

  it('search filters by role when provided', async () => {
    await service.search('tenant-1', { role: 'PATHOLOGIST', page: 1, pageSize: 20 });
    expect(prisma.labPractitioner.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ roles: { has: 'PATHOLOGIST' } }),
      }),
    );
  });

  it('search filters by isActive when provided', async () => {
    await service.search('tenant-1', { isActive: true, page: 1, pageSize: 20 });
    expect(prisma.labPractitioner.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      }),
    );
  });

  it('search by query uses OR with contains', async () => {
    await service.search('tenant-1', { query: 'Garcia', page: 1, pageSize: 20 });
    expect(prisma.labPractitioner.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ paternalLastName: { contains: 'Garcia', mode: 'insensitive' } }),
          ]),
        }),
      }),
    );
  });

  it('search without filters returns all non-deleted', async () => {
    await service.search('tenant-1', { page: 1, pageSize: 20 });
    expect(prisma.labPractitioner.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          deletedAt: null,
        }),
      }),
    );
  });

  it('search returns paginated result', async () => {
    prisma.labPractitioner.findMany.mockResolvedValue([{ id: '1' }]);
    prisma.labPractitioner.count.mockResolvedValue(1);
    const result = await service.search('tenant-1', { page: 1, pageSize: 20 });
    expect(result).toEqual({ items: [{ id: '1' }], total: 1, page: 1, pageSize: 20 });
  });

  it('findById returns practitioner', async () => {
    const practitioner = { id: 'pr1', firstName: 'John' };
    prisma.labPractitioner.findFirst.mockResolvedValue(practitioner);
    const result = await service.findById('pr1', 'tenant-1');
    expect(result).toBe(practitioner);
  });

  it('findById throws for missing practitioner', async () => {
    prisma.labPractitioner.findFirst.mockResolvedValue(null);
    await expect(service.findById('nope', 'tenant-1')).rejects.toThrow(NotFoundException);
  });
});
