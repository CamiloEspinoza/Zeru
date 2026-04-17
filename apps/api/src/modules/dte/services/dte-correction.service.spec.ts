import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DteCorrectionService } from './dte-correction.service';
import { DteEmissionService } from './dte-emission.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('DteCorrectionService', () => {
  let service: DteCorrectionService;
  let prisma: any;
  let tenantDb: any;
  let emissionService: any;

  const tenantId = 'tenant-1';
  const userId = 'user-1';
  const dteId = 'dte-orig';

  const originalDte = {
    id: dteId,
    dteType: 'FACTURA_ELECTRONICA',
    folio: 100,
    status: 'ACCEPTED',
    fechaEmision: new Date('2024-06-15'),
    receptorRut: '77654321-K',
    receptorRazon: 'Cliente Ltda',
    receptorGiro: 'Servicios',
    receptorDir: 'Av Test 456',
    receptorComuna: 'Providencia',
    formaPago: 1,
    items: [
      {
        lineNumber: 1,
        itemName: 'Servicio de Consultoría',
        description: 'Consultoría TI',
        quantity: 1,
        unit: 'UN',
        unitPrice: 100000,
        indExe: null,
      },
      {
        lineNumber: 2,
        itemName: 'Soporte Técnico',
        description: null,
        quantity: 2,
        unit: 'HR',
        unitPrice: 50000,
        indExe: null,
      },
    ],
  };

  beforeEach(async () => {
    tenantDb = {
      dte: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(originalDte),
      },
      dteReference: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    prisma = { forTenant: jest.fn().mockReturnValue(tenantDb) };

    emissionService = {
      emit: jest.fn().mockResolvedValue({
        id: 'nc-1',
        folio: 200,
        dteType: 'NOTA_CREDITO_ELECTRONICA',
        status: 'QUEUED',
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        DteCorrectionService,
        { provide: PrismaService, useValue: prisma },
        { provide: DteEmissionService, useValue: emissionService },
      ],
    }).compile();

    service = module.get(DteCorrectionService);
  });

  // ─── Text correction (CodRef=2) ────────────────────
  describe('correctText', () => {
    it('should create NC with CodRef=CORRIGE_TEXTO referencing original DTE', async () => {
      const result = await service.correctText(
        tenantId,
        userId,
        dteId,
        'Corrección de giro del receptor',
      );

      expect(result.originalDteId).toBe(dteId);
      expect(result.creditNoteId).toBe('nc-1');
      expect(result.creditNoteFolio).toBe(200);

      // Verify NC emission was called with correct data
      expect(emissionService.emit).toHaveBeenCalledWith(
        tenantId,
        userId,
        expect.objectContaining({
          dteType: 'NOTA_CREDITO_ELECTRONICA',
          items: [
            expect.objectContaining({
              itemName: 'Corrección de texto',
              quantity: 1,
              unitPrice: 0,
            }),
          ],
          references: [
            expect.objectContaining({
              tipoDocRef: 33, // SII code for FACTURA_ELECTRONICA
              folioRef: 100,
              codRef: 'CORRIGE_TEXTO',
              razonRef: 'Corrección de giro del receptor',
            }),
          ],
        }),
      );

      // Verify back-reference was linked
      expect(tenantDb.dteReference.updateMany).toHaveBeenCalledWith({
        where: { dteId: 'nc-1' },
        data: { referencedDteId: dteId },
      });
    });

    it('should reject text correction for non-ACCEPTED DTE', async () => {
      tenantDb.dte.findUniqueOrThrow.mockResolvedValue({
        ...originalDte,
        status: 'QUEUED',
      });

      await expect(
        service.correctText(tenantId, userId, dteId, 'reason'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.correctText(tenantId, userId, dteId, 'reason'),
      ).rejects.toThrow('Solo se pueden corregir DTEs aceptados por el SII');
    });

    it('should reject text correction for DRAFT DTE', async () => {
      tenantDb.dte.findUniqueOrThrow.mockResolvedValue({
        ...originalDte,
        status: 'DRAFT',
      });

      await expect(
        service.correctText(tenantId, userId, dteId, 'reason'),
      ).rejects.toThrow('Solo se pueden corregir DTEs aceptados por el SII');
    });

    it('should allow text correction for ACCEPTED_WITH_OBJECTION DTE', async () => {
      tenantDb.dte.findUniqueOrThrow.mockResolvedValue({
        ...originalDte,
        status: 'ACCEPTED_WITH_OBJECTION',
      });

      const result = await service.correctText(
        tenantId,
        userId,
        dteId,
        'fix giro',
      );

      expect(result.creditNoteId).toBe('nc-1');
      expect(emissionService.emit).toHaveBeenCalled();
    });
  });

  // ─── Amount correction (CodRef=3) ──────────────────
  describe('correctAmounts — PARTIAL_NC', () => {
    it('should create NC with differential for amount correction', async () => {
      // Original: line 1 = 1 * 100000 = 100000
      // Corrected: line 1 = 1 * 80000 = 80000
      // Diff: 100000 - 80000 = 20000
      const result = await service.correctAmounts(tenantId, userId, dteId, {
        strategy: 'PARTIAL_NC',
        items: [{ lineNumber: 1, correctedUnitPrice: 80000 }],
        reason: 'Precio incorrecto',
      });

      expect(result.strategy).toBe('PARTIAL_NC');
      expect(result.creditNoteId).toBe('nc-1');

      const emitCall = emissionService.emit.mock.calls[0];
      const ncData = emitCall[2];

      expect(ncData.dteType).toBe('NOTA_CREDITO_ELECTRONICA');
      expect(ncData.items).toHaveLength(1);
      expect(ncData.items[0].unitPrice).toBe(20000); // differential
      expect(ncData.items[0].quantity).toBe(1);
      expect(ncData.references[0].codRef).toBe('CORRIGE_MONTOS');
    });

    it('should calculate differential correctly for quantity correction', async () => {
      // Original: line 2 = 2 * 50000 = 100000
      // Corrected: line 2 = 1 * 50000 = 50000
      // Diff: 100000 - 50000 = 50000
      await service.correctAmounts(tenantId, userId, dteId, {
        strategy: 'PARTIAL_NC',
        items: [{ lineNumber: 2, correctedQuantity: 1 }],
        reason: 'Cantidad equivocada',
      });

      const ncData = emissionService.emit.mock.calls[0][2];
      expect(ncData.items[0].unitPrice).toBe(50000);
    });

    it('should reject negative differential (corrected > original)', async () => {
      // Original line 1: 1 * 100000 = 100000
      // Corrected: 1 * 120000 = 120000 → diff = -20000 (invalid)
      await expect(
        service.correctAmounts(tenantId, userId, dteId, {
          strategy: 'PARTIAL_NC',
          items: [{ lineNumber: 1, correctedUnitPrice: 120000 }],
          reason: 'This should fail',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.correctAmounts(tenantId, userId, dteId, {
          strategy: 'PARTIAL_NC',
          items: [{ lineNumber: 1, correctedUnitPrice: 120000 }],
          reason: 'This should fail',
        }),
      ).rejects.toThrow(
        'el monto corregido debe ser menor al original',
      );
    });

    it('should throw for non-existent line number', async () => {
      await expect(
        service.correctAmounts(tenantId, userId, dteId, {
          strategy: 'PARTIAL_NC',
          items: [{ lineNumber: 99, correctedUnitPrice: 50000 }],
          reason: 'Non-existent line',
        }),
      ).rejects.toThrow('Línea 99 no encontrada en el DTE original');
    });

    it('should reject amount correction for non-ACCEPTED DTE', async () => {
      tenantDb.dte.findUniqueOrThrow.mockResolvedValue({
        ...originalDte,
        status: 'SENT',
      });

      await expect(
        service.correctAmounts(tenantId, userId, dteId, {
          strategy: 'PARTIAL_NC',
          items: [{ lineNumber: 1, correctedUnitPrice: 80000 }],
          reason: 'reason',
        }),
      ).rejects.toThrow('Solo se pueden corregir DTEs aceptados por el SII');
    });
  });

  // ─── Full NC + Reissue strategy ────────────────────
  describe('correctAmounts — FULL_NC_AND_REISSUE', () => {
    it('should create void NC for full amount AND re-emit with corrected items', async () => {
      // First emit call = void NC, second emit call = new DTE
      emissionService.emit
        .mockResolvedValueOnce({
          id: 'nc-void',
          folio: 300,
          dteType: 'NOTA_CREDITO_ELECTRONICA',
          status: 'QUEUED',
        })
        .mockResolvedValueOnce({
          id: 'new-dte',
          folio: 301,
          dteType: 'FACTURA_ELECTRONICA',
          status: 'QUEUED',
        });

      const result = await service.correctAmounts(tenantId, userId, dteId, {
        strategy: 'FULL_NC_AND_REISSUE',
        items: [{ lineNumber: 1, correctedUnitPrice: 80000 }],
        reason: 'Re-emitir con precio correcto',
      });

      expect(result.strategy).toBe('FULL_NC_AND_REISSUE');
      expect(result.creditNoteId).toBe('nc-void');
      expect(result.newDteId).toBe('new-dte');
      expect(result.newDteFolio).toBe(301);

      // First call: void NC with ANULA_DOCUMENTO
      const voidNcData = emissionService.emit.mock.calls[0][2];
      expect(voidNcData.dteType).toBe('NOTA_CREDITO_ELECTRONICA');
      expect(voidNcData.references[0].codRef).toBe('ANULA_DOCUMENTO');
      expect(voidNcData.items).toHaveLength(2); // All original items

      // Second call: new DTE with corrected amounts
      const newDteData = emissionService.emit.mock.calls[1][2];
      expect(newDteData.dteType).toBe('FACTURA_ELECTRONICA');
      expect(newDteData.items[0].unitPrice).toBe(80000); // corrected
      expect(newDteData.items[1].unitPrice).toBe(50000); // unchanged
      expect(newDteData.items[1].quantity).toBe(2); // unchanged
    });

    it('should link void NC back-reference to original DTE', async () => {
      emissionService.emit
        .mockResolvedValueOnce({ id: 'nc-void', folio: 300 })
        .mockResolvedValueOnce({ id: 'new-dte', folio: 301 });

      await service.correctAmounts(tenantId, userId, dteId, {
        strategy: 'FULL_NC_AND_REISSUE',
        items: [{ lineNumber: 1, correctedUnitPrice: 80000 }],
        reason: 'Re-emit',
      });

      expect(tenantDb.dteReference.updateMany).toHaveBeenCalledWith({
        where: { dteId: 'nc-void' },
        data: { referencedDteId: dteId },
      });
    });
  });
});
