import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';
import { DteEmissionService } from './dte-emission.service';
import { DTE_TYPE_TO_SII_CODE } from '../constants/dte-types.constants';
import { CorrectAmountsSchema, EmitDteSchema } from '@zeru/shared';

@Injectable()
export class DteCorrectionService {
  private readonly logger = new Logger(DteCorrectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emissionService: DteEmissionService,
  ) {}

  async correctText(
    tenantId: string,
    userId: string,
    dteId: string,
    reason: string,
  ) {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const original = await db.dte.findUniqueOrThrow({
      where: { id: dteId },
    });

    if (!['ACCEPTED', 'ACCEPTED_WITH_OBJECTION'].includes(original.status)) {
      throw new BadRequestException(
        'Solo se pueden corregir DTEs aceptados por el SII',
      );
    }

    const siiCode = DTE_TYPE_TO_SII_CODE[original.dteType];

    // CodRef=2 NC has $0 total — just a text correction notice
    const ncData: EmitDteSchema = {
      dteType: 'NOTA_CREDITO_ELECTRONICA',
      receptorRut: original.receptorRut ?? undefined,
      receptorRazon: original.receptorRazon ?? undefined,
      receptorGiro: original.receptorGiro ?? undefined,
      receptorDir: original.receptorDir ?? undefined,
      receptorComuna: original.receptorComuna ?? undefined,
      items: [
        {
          itemName: 'Corrección de texto',
          quantity: 1,
          unitPrice: 0,
        },
      ],
      references: [
        {
          tipoDocRef: siiCode,
          folioRef: original.folio,
          fechaRef: original.fechaEmision.toISOString().split('T')[0],
          codRef: 'CORRIGE_TEXTO',
          razonRef: reason,
        },
      ],
    };

    this.logger.log(
      `Text correction for DTE ${dteId} — generating NC CodRef=2`,
    );
    const nc = await this.emissionService.emit(tenantId, userId, ncData);

    await db.dteReference.updateMany({
      where: { dteId: nc.id },
      data: { referencedDteId: dteId },
    });

    return {
      originalDteId: dteId,
      creditNoteId: nc.id,
      creditNoteFolio: nc.folio,
    };
  }

  async correctAmounts(
    tenantId: string,
    userId: string,
    dteId: string,
    data: CorrectAmountsSchema,
  ) {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const original = await db.dte.findUniqueOrThrow({
      where: { id: dteId },
      include: { items: true },
    });

    if (!['ACCEPTED', 'ACCEPTED_WITH_OBJECTION'].includes(original.status)) {
      throw new BadRequestException(
        'Solo se pueden corregir DTEs aceptados por el SII',
      );
    }

    const siiCode = DTE_TYPE_TO_SII_CODE[original.dteType];

    if (data.strategy === 'PARTIAL_NC') {
      // Calculate differential items
      const diffItems = data.items.map((correction) => {
        const originalItem = original.items.find(
          (i) => i.lineNumber === correction.lineNumber,
        );
        if (!originalItem) {
          throw new BadRequestException(
            `Línea ${correction.lineNumber} no encontrada en el DTE original`,
          );
        }

        const origQty = Number(originalItem.quantity);
        const origPrice = Number(originalItem.unitPrice);
        const newQty = correction.correctedQuantity ?? origQty;
        const newPrice = correction.correctedUnitPrice ?? origPrice;

        const originalTotal = origQty * origPrice;
        const correctedTotal = newQty * newPrice;
        const diff = originalTotal - correctedTotal;

        if (diff <= 0) {
          throw new BadRequestException(
            `Corrección de línea ${correction.lineNumber}: el monto corregido debe ser menor al original. Use Nota de Débito para aumentos.`,
          );
        }

        return {
          itemName: originalItem.itemName,
          description: `Corrección de monto (original: $${originalTotal}, corregido: $${correctedTotal})`,
          quantity: 1,
          unitPrice: diff,
        };
      });

      const ncData: EmitDteSchema = {
        dteType: 'NOTA_CREDITO_ELECTRONICA',
        receptorRut: original.receptorRut ?? undefined,
        receptorRazon: original.receptorRazon ?? undefined,
        receptorGiro: original.receptorGiro ?? undefined,
        receptorDir: original.receptorDir ?? undefined,
        receptorComuna: original.receptorComuna ?? undefined,
        items: diffItems,
        references: [
          {
            tipoDocRef: siiCode,
            folioRef: original.folio,
            fechaRef: original.fechaEmision.toISOString().split('T')[0],
            codRef: 'CORRIGE_MONTOS',
            razonRef: data.reason,
          },
        ],
      };

      this.logger.log(
        `Partial amount correction for DTE ${dteId} — generating NC CodRef=3`,
      );
      const nc = await this.emissionService.emit(tenantId, userId, ncData);

      await db.dteReference.updateMany({
        where: { dteId: nc.id },
        data: { referencedDteId: dteId },
      });

      return {
        originalDteId: dteId,
        creditNoteId: nc.id,
        creditNoteFolio: nc.folio,
        strategy: 'PARTIAL_NC' as const,
      };
    } else {
      // FULL_NC_AND_REISSUE: void original + create new with corrected amounts
      // Import DteVoidService would create circular dep — call emit directly
      const voidNcData: EmitDteSchema = {
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
          indExe: item.indExe ?? undefined,
        })),
        references: [
          {
            tipoDocRef: siiCode,
            folioRef: original.folio,
            fechaRef: original.fechaEmision.toISOString().split('T')[0],
            codRef: 'ANULA_DOCUMENTO',
            razonRef: `${data.reason} (anulación para re-emisión con montos corregidos)`,
          },
        ],
      };

      this.logger.log(`Full NC + reissue for DTE ${dteId}`);
      const nc = await this.emissionService.emit(tenantId, userId, voidNcData);

      await db.dteReference.updateMany({
        where: { dteId: nc.id },
        data: { referencedDteId: dteId },
      });

      // Create new DTE with corrected amounts
      const correctedItems = original.items.map((item) => {
        const correction = data.items.find(
          (c) => c.lineNumber === item.lineNumber,
        );
        return {
          itemName: item.itemName,
          description: item.description ?? undefined,
          quantity: correction?.correctedQuantity ?? Number(item.quantity),
          unit: item.unit ?? undefined,
          unitPrice: correction?.correctedUnitPrice ?? Number(item.unitPrice),
          indExe: item.indExe ?? undefined,
        };
      });

      const newDte = await this.emissionService.emit(tenantId, userId, {
        dteType: original.dteType,
        receptorRut: original.receptorRut ?? undefined,
        receptorRazon: original.receptorRazon ?? undefined,
        receptorGiro: original.receptorGiro ?? undefined,
        receptorDir: original.receptorDir ?? undefined,
        receptorComuna: original.receptorComuna ?? undefined,
        formaPago: original.formaPago ?? undefined,
        items: correctedItems,
      });

      return {
        originalDteId: dteId,
        creditNoteId: nc.id,
        creditNoteFolio: nc.folio,
        newDteId: newDte.id,
        newDteFolio: newDte.folio,
        strategy: 'FULL_NC_AND_REISSUE' as const,
      };
    }
  }
}
