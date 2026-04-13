import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';
import { DteEmissionService } from './dte-emission.service';

@Injectable()
export class DteReissueService {
  private readonly logger = new Logger(DteReissueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emissionService: DteEmissionService,
  ) {}

  async reissue(tenantId: string, userId: string, dteId: string) {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const original = await db.dte.findUniqueOrThrow({
      where: { id: dteId },
      include: { items: true, references: true },
    });

    if (!['REJECTED', 'ERROR'].includes(original.status)) {
      throw new BadRequestException(
        'Solo se pueden re-emitir DTEs rechazados o con error',
      );
    }

    this.logger.log(
      `Re-issuing DTE ${dteId} (folio ${original.folio}) with new folio`,
    );

    const newDte = await this.emissionService.emit(tenantId, userId, {
      dteType: original.dteType,
      receptorRut: original.receptorRut ?? undefined,
      receptorRazon: original.receptorRazon ?? undefined,
      receptorGiro: original.receptorGiro ?? undefined,
      receptorDir: original.receptorDir ?? undefined,
      receptorComuna: original.receptorComuna ?? undefined,
      formaPago: original.formaPago ?? undefined,
      medioPago: original.medioPago ?? undefined,
      indServicio: original.indServicio ?? undefined,
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
      references: original.references.map((ref) => ({
        tipoDocRef: ref.tipoDocRef,
        folioRef: ref.folioRef,
        fechaRef: ref.fechaRef.toISOString().split('T')[0],
        codRef: ref.codRef ?? undefined,
        razonRef: ref.razonRef ?? undefined,
      })),
    });

    // Log the connection between original and reissued
    await db.dteLog.create({
      data: {
        dteId: original.id,
        action: 'SII_RESPONSE',
        message: `Re-emitido como folio ${newDte.folio} (DTE ${newDte.id})`,
      },
    });

    return {
      originalDteId: dteId,
      originalFolio: original.folio,
      newDteId: newDte.id,
      newDteFolio: newDte.folio,
    };
  }
}
