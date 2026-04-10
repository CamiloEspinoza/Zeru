import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LabPatientService } from './lab-patient.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('LabPatientService', () => {
  let service: LabPatientService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      labPatient: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        LabPatientService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(LabPatientService);
  });

  it('search by RUT uses exact match', async () => {
    await service.search('tenant-1', { rut: '12.345.678-5', page: 1, pageSize: 20 });
    expect(prisma.labPatient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ rut: '12.345.678-5' }),
      }),
    );
  });

  it('search by query uses OR with contains', async () => {
    await service.search('tenant-1', { query: 'Perez', page: 1, pageSize: 20 });
    expect(prisma.labPatient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ paternalLastName: { contains: 'Perez', mode: 'insensitive' } }),
          ]),
        }),
      }),
    );
  });

  it('search without filters returns all non-deleted, non-merged', async () => {
    await service.search('tenant-1', { page: 1, pageSize: 20 });
    expect(prisma.labPatient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          deletedAt: null,
          mergedIntoId: null,
        }),
      }),
    );
  });

  it('search returns paginated result', async () => {
    prisma.labPatient.findMany.mockResolvedValue([{ id: '1' }]);
    prisma.labPatient.count.mockResolvedValue(1);
    const result = await service.search('tenant-1', { page: 1, pageSize: 20 });
    expect(result).toEqual({ items: [{ id: '1' }], total: 1, page: 1, pageSize: 20 });
  });

  it('findById returns patient with service requests', async () => {
    const patient = { id: 'p1', serviceRequests: [] };
    prisma.labPatient.findFirst.mockResolvedValue(patient);
    const result = await service.findById('p1', 'tenant-1');
    expect(result).toBe(patient);
  });

  it('findById throws for missing patient', async () => {
    prisma.labPatient.findFirst.mockResolvedValue(null);
    await expect(service.findById('nope', 'tenant-1')).rejects.toThrow(NotFoundException);
  });
});
