import { Test } from '@nestjs/testing';
import { DteEmissionService } from './dte-emission.service';
import { DteConfigService } from './dte-config.service';
import { CertificateService } from '../certificate/certificate.service';
import { FolioService } from '../folio/folio.service';
import { FolioAllocationService } from '../folio/folio-allocation.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { getQueueToken } from '@nestjs/bullmq';
import { DTE_EMISSION_QUEUE } from '../constants/queue.constants';

describe('DteEmissionService', () => {
  let service: DteEmissionService;
  let prisma: any;
  let tenantDb: any;
  let queue: any;
  let configService: any;
  let certService: any;
  let folioService: any;
  let folioAllocation: any;

  beforeEach(async () => {
    tenantDb = {
      dte: {
        create: jest.fn().mockResolvedValue({
          id: 'dte-1',
          dteType: 'FACTURA_ELECTRONICA',
          folio: 100,
          status: 'QUEUED',
          items: [
            {
              id: 'item-1',
              lineNumber: 1,
              itemName: 'Test Service',
              quantity: 1,
              unitPrice: 100000,
              montoItem: 100000,
            },
          ],
          references: [],
        }),
      },
    };

    prisma = {
      forTenant: jest.fn().mockReturnValue(tenantDb),
    };

    queue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };

    configService = {
      get: jest.fn().mockResolvedValue({
        rut: '76123456-7',
        razonSocial: 'Test SpA',
        giro: 'Servicios',
        actividadEco: 620100,
        direccion: 'Test 123',
        comuna: 'Santiago',
        environment: 'CERTIFICATION',
        resolutionNum: 80,
        resolutionDate: new Date('2014-08-22'),
      }),
    };

    certService = {
      validatePrimaryCertExists: jest.fn().mockResolvedValue(undefined),
    };

    folioService = {
      validateAvailability: jest.fn().mockResolvedValue(undefined),
    };

    folioAllocation = {
      allocate: jest
        .fn()
        .mockResolvedValue({ folio: 100, folioRangeId: 'range-1' }),
    };

    const module = await Test.createTestingModule({
      providers: [
        DteEmissionService,
        { provide: PrismaService, useValue: prisma },
        { provide: DteConfigService, useValue: configService },
        { provide: CertificateService, useValue: certService },
        { provide: FolioService, useValue: folioService },
        { provide: FolioAllocationService, useValue: folioAllocation },
        { provide: getQueueToken(DTE_EMISSION_QUEUE), useValue: queue },
      ],
    }).compile();

    service = module.get(DteEmissionService);
  });

  it('should validate config, cert, and folios before emission', async () => {
    await service.emit('tenant-1', 'user-1', {
      dteType: 'FACTURA_ELECTRONICA',
      receptorRut: '77654321-K',
      receptorRazon: 'Cliente Ltda',
      items: [{ itemName: 'Servicio', quantity: 1, unitPrice: 100000 }],
    });

    expect(configService.get).toHaveBeenCalledWith('tenant-1');
    expect(certService.validatePrimaryCertExists).toHaveBeenCalledWith(
      'tenant-1',
    );
    expect(folioService.validateAvailability).toHaveBeenCalledWith(
      'tenant-1',
      'FACTURA_ELECTRONICA',
      'CERTIFICATION',
    );
  });

  it('should allocate folio before enqueueing', async () => {
    await service.emit('tenant-1', 'user-1', {
      dteType: 'FACTURA_ELECTRONICA',
      receptorRut: '77654321-K',
      receptorRazon: 'Cliente Ltda',
      items: [{ itemName: 'Servicio', quantity: 1, unitPrice: 100000 }],
    });

    expect(folioAllocation.allocate).toHaveBeenCalledWith(
      'tenant-1',
      'FACTURA_ELECTRONICA',
      'CERTIFICATION',
    );
  });

  it('should create DTE with QUEUED status and assigned folio', async () => {
    const result = await service.emit('tenant-1', 'user-1', {
      dteType: 'FACTURA_ELECTRONICA',
      receptorRut: '77654321-K',
      receptorRazon: 'Cliente Ltda',
      items: [{ itemName: 'Servicio', quantity: 1, unitPrice: 100000 }],
    });

    expect(result.folio).toBe(100);
    expect(result.status).toBe('QUEUED');
    expect(tenantDb.dte.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          folio: 100,
          status: 'QUEUED',
          folioRangeId: 'range-1',
          emisorRut: '76123456-7',
        }),
      }),
    );
  });

  it('should enqueue job with deterministic ID', async () => {
    await service.emit('tenant-1', 'user-1', {
      dteType: 'FACTURA_ELECTRONICA',
      receptorRut: '77654321-K',
      receptorRazon: 'Cliente Ltda',
      items: [{ itemName: 'Servicio', quantity: 1, unitPrice: 100000 }],
    });

    expect(queue.add).toHaveBeenCalledWith(
      'dte.emit',
      { dteId: 'dte-1', tenantId: 'tenant-1' },
      expect.objectContaining({ jobId: 'emit-dte-1' }),
    );
  });

  it('should reject NC without references', async () => {
    await expect(
      service.emit('tenant-1', 'user-1', {
        dteType: 'NOTA_CREDITO_ELECTRONICA',
        receptorRut: '77654321-K',
        receptorRazon: 'Cliente Ltda',
        items: [{ itemName: 'Servicio', quantity: 1, unitPrice: 100000 }],
      }),
    ).rejects.toThrow('Notas de crédito/débito requieren referencia');
  });
});
