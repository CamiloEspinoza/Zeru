import { Test } from '@nestjs/testing';
import { DteVoidService } from './dte-void.service';
import { DteEmissionService } from './dte-emission.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('DteVoidService', () => {
  let service: DteVoidService;
  let prisma: any;
  let emissionService: any;

  beforeEach(async () => {
    prisma = {
      dte: {
        findUniqueOrThrow: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      dteReference: { updateMany: jest.fn() },
      forTenant: jest.fn().mockReturnThis(),
    };

    emissionService = {
      emit: jest.fn().mockResolvedValue({ id: 'nc-1', folio: 200 }),
    };

    const module = await Test.createTestingModule({
      providers: [
        DteVoidService,
        { provide: PrismaService, useValue: prisma },
        { provide: DteEmissionService, useValue: emissionService },
      ],
    }).compile();

    service = module.get(DteVoidService);
  });

  it('should allow voiding an ACCEPTED DTE', async () => {
    prisma.dte.findUniqueOrThrow.mockResolvedValue({
      id: 'dte-1',
      status: 'ACCEPTED',
      direction: 'EMITTED',
      dteType: 'FACTURA_ELECTRONICA',
      folio: 100,
      fechaEmision: new Date('2026-04-01'),
      items: [{ itemName: 'Test', quantity: 1, unitPrice: 100000 }],
    });

    const check = await service.checkCanVoid('t1', 'dte-1');
    expect(check.canVoid).toBe(true);
  });

  it('should reject voiding a DRAFT DTE', async () => {
    prisma.dte.findUniqueOrThrow.mockResolvedValue({
      id: 'dte-1',
      status: 'DRAFT',
      direction: 'EMITTED',
      dteType: 'FACTURA_ELECTRONICA',
    });

    const check = await service.checkCanVoid('t1', 'dte-1');
    expect(check.canVoid).toBe(false);
    expect(check.reasons[0]).toContain('DRAFT');
  });

  it('should reject voiding if NC already exists', async () => {
    prisma.dte.findUniqueOrThrow.mockResolvedValue({
      id: 'dte-1',
      status: 'ACCEPTED',
      direction: 'EMITTED',
      dteType: 'FACTURA_ELECTRONICA',
    });
    prisma.dte.findFirst.mockResolvedValue({ id: 'nc-existing', folio: 150 });

    const check = await service.checkCanVoid('t1', 'dte-1');
    expect(check.canVoid).toBe(false);
    expect(check.reasons[0]).toContain('nota de crédito');
  });

  it('should generate NC when voiding', async () => {
    prisma.dte.findUniqueOrThrow.mockResolvedValue({
      id: 'dte-1',
      status: 'ACCEPTED',
      direction: 'EMITTED',
      dteType: 'FACTURA_ELECTRONICA',
      folio: 100,
      receptorRut: '77654321-K',
      receptorRazon: 'Cliente',
      fechaEmision: new Date('2026-04-01'),
      items: [
        {
          itemName: 'Servicio',
          quantity: 1,
          unitPrice: 100000,
          description: null,
          unit: null,
          descuentoPct: null,
          descuentoMonto: null,
          indExe: null,
        },
      ],
    });

    const result = await service.void(
      't1',
      'user-1',
      'dte-1',
      'Error de facturación',
    );
    expect(result.creditNoteId).toBe('nc-1');
    expect(emissionService.emit).toHaveBeenCalledWith(
      't1',
      'user-1',
      expect.objectContaining({
        dteType: 'NOTA_CREDITO_ELECTRONICA',
        references: [
          expect.objectContaining({ codRef: 'ANULA_DOCUMENTO' }),
        ],
      }),
    );
  });
});
