import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';
import { DteEmissionService } from './dte-emission.service';
import { DTE_TYPE_TO_SII_CODE } from '../constants/dte-types.constants';
import { EmitDteSchema } from '@zeru/shared';

export interface VoidabilityCheck {
  canVoid: boolean;
  reasons: string[];
  warnings: string[];
}

@Injectable()
export class DteVoidService {
  private readonly logger = new Logger(DteVoidService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emissionService: DteEmissionService,
  ) {}

  async checkCanVoid(
    tenantId: string,
    dteId: string,
  ): Promise<VoidabilityCheck> {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const dte = await db.dte.findUniqueOrThrow({
      where: { id: dteId },
      include: { items: true, references: true },
    });

    const reasons: string[] = [];
    const warnings: string[] = [];

    if (!['ACCEPTED', 'ACCEPTED_WITH_OBJECTION'].includes(dte.status)) {
      reasons.push(
        `DTE está en estado ${dte.status}. Solo se pueden anular DTEs aceptados por el SII.`,
      );
    }

    if (dte.direction !== 'EMITTED') {
      reasons.push('Solo se pueden anular DTEs emitidos, no recibidos.');
    }

    if (
      ['NOTA_CREDITO_ELECTRONICA', 'NOTA_DEBITO_ELECTRONICA'].includes(
        dte.dteType,
      )
    ) {
      reasons.push(
        'No se puede anular una nota de crédito o débito directamente.',
      );
    }

    // Check if already has a voiding NC
    const existingVoidNc = await db.dte.findFirst({
      where: {
        dteType: 'NOTA_CREDITO_ELECTRONICA',
        direction: 'EMITTED',
        references: {
          some: {
            referencedDteId: dteId,
            codRef: 'ANULA_DOCUMENTO',
          },
        },
        status: { notIn: ['ERROR', 'REJECTED'] },
      },
    });

    if (existingVoidNc) {
      reasons.push(
        `Ya existe una nota de crédito de anulación (folio ${existingVoidNc.folio}).`,
      );
    }

    return {
      canVoid: reasons.length === 0,
      reasons,
      warnings,
    };
  }

  async void(
    tenantId: string,
    userId: string,
    dteId: string,
    reason: string,
  ) {
    const check = await this.checkCanVoid(tenantId, dteId);
    if (!check.canVoid) {
      throw new BadRequestException(check.reasons.join(' '));
    }

    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const original = await db.dte.findUniqueOrThrow({
      where: { id: dteId },
      include: { items: true },
    });

    const siiCode = DTE_TYPE_TO_SII_CODE[original.dteType];

    // Build NC emission data with same items as original
    const ncData: EmitDteSchema = {
      dteType: 'NOTA_CREDITO_ELECTRONICA',
      receptorRut: original.receptorRut ?? undefined,
      receptorRazon: original.receptorRazon ?? undefined,
      receptorGiro: original.receptorGiro ?? undefined,
      receptorDir: original.receptorDir ?? undefined,
      receptorComuna: original.receptorComuna ?? undefined,
      items: original.items.map((item) => ({
        itemName: item.itemName,
        description: item.description ?? undefined,
        quantity: Number(item.quantity),
        unit: item.unit ?? undefined,
        unitPrice: Number(item.unitPrice),
        descuentoPct: item.descuentoPct ? Number(item.descuentoPct) : undefined,
        descuentoMonto: item.descuentoMonto
          ? Number(item.descuentoMonto)
          : undefined,
        indExe: item.indExe ?? undefined,
      })),
      references: [
        {
          tipoDocRef: siiCode,
          folioRef: original.folio,
          fechaRef: original.fechaEmision.toISOString().split('T')[0],
          codRef: 'ANULA_DOCUMENTO',
          razonRef: reason || 'Anula documento de referencia',
        },
      ],
    };

    this.logger.log(
      `Voiding DTE ${dteId} (folio ${original.folio}) — generating NC`,
    );

    // Emit the NC — this allocates folio, creates DTE, and enqueues
    const nc = await this.emissionService.emit(tenantId, userId, ncData);

    // Update the reference to link back to original DTE
    await db.dteReference.updateMany({
      where: { dteId: nc.id },
      data: { referencedDteId: dteId },
    });

    this.logger.log(
      `NC folio ${nc.folio} created to void DTE folio ${original.folio}`,
    );

    return {
      originalDteId: dteId,
      creditNoteId: nc.id,
      creditNoteFolio: nc.folio,
    };
  }
}
