import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';
import { EmitDteSchema, UpdateDteDraftSchema } from '@zeru/shared';

@Injectable()
export class DteDraftService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, userId: string, data: EmitDteSchema) {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    return db.dte.create({
      data: {
        dteType: data.dteType,
        folio: 0,
        environment: 'CERTIFICATION',
        status: 'DRAFT',
        direction: 'EMITTED',
        emisorRut: '',
        emisorRazon: '',
        receptorRut: data.receptorRut,
        receptorRazon: data.receptorRazon,
        receptorGiro: data.receptorGiro,
        receptorDir: data.receptorDir,
        receptorComuna: data.receptorComuna,
        receptorCiudad: data.receptorCiudad,
        formaPago: data.formaPago,
        medioPago: data.medioPago,
        indServicio: data.indServicio,
        periodoDesde: data.periodoDesde
          ? new Date(data.periodoDesde)
          : undefined,
        periodoHasta: data.periodoHasta
          ? new Date(data.periodoHasta)
          : undefined,
        fechaEmision: data.fechaEmision
          ? new Date(data.fechaEmision)
          : new Date(),
        fechaVenc: data.fechaVenc ? new Date(data.fechaVenc) : undefined,
        legalEntityId: data.legalEntityId,
        createdById: userId,
        tenantId,
        items: {
          create: data.items.map((item, idx) => ({
            lineNumber: idx + 1,
            itemName: item.itemName,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            descuentoPct: item.descuentoPct,
            descuentoMonto: item.descuentoMonto,
            recargoPct: item.recargoPct,
            recargoMonto: item.recargoMonto,
            indExe: item.indExe,
            codigosItem: item.codigosItem,
            montoItem:
              item.quantity * item.unitPrice -
              (item.descuentoMonto || 0) +
              (item.recargoMonto || 0),
          })),
        },
        references: data.references?.length
          ? {
              create: data.references.map((ref, idx) => ({
                lineNumber: idx + 1,
                tipoDocRef: ref.tipoDocRef,
                folioRef: ref.folioRef,
                fechaRef: new Date(ref.fechaRef),
                codRef: ref.codRef,
                razonRef: ref.razonRef,
              })),
            }
          : undefined,
        logs: {
          create: { action: 'CREATED', message: 'Borrador creado' },
        },
      },
      include: { items: true, references: true },
    });
  }

  async update(tenantId: string, dteId: string, data: UpdateDteDraftSchema) {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const dte = await db.dte.findUniqueOrThrow({ where: { id: dteId } });

    if (dte.status !== 'DRAFT') {
      throw new BadRequestException(
        'Solo se pueden editar DTEs en estado borrador',
      );
    }

    if (data.items) {
      await db.dteItem.deleteMany({ where: { dteId } });
    }
    if (data.references) {
      await db.dteReference.deleteMany({ where: { dteId } });
    }

    return db.dte.update({
      where: { id: dteId },
      data: {
        receptorRut: data.receptorRut,
        receptorRazon: data.receptorRazon,
        receptorGiro: data.receptorGiro,
        receptorDir: data.receptorDir,
        receptorComuna: data.receptorComuna,
        formaPago: data.formaPago,
        fechaVenc: data.fechaVenc ? new Date(data.fechaVenc) : undefined,
        items: data.items
          ? {
              create: data.items.map((item, idx) => ({
                lineNumber: idx + 1,
                itemName: item.itemName,
                description: item.description,
                quantity: item.quantity,
                unit: item.unit,
                unitPrice: item.unitPrice,
                descuentoPct: item.descuentoPct,
                descuentoMonto: item.descuentoMonto,
                recargoPct: item.recargoPct,
                recargoMonto: item.recargoMonto,
                indExe: item.indExe,
                codigosItem: item.codigosItem,
                montoItem:
                  item.quantity * item.unitPrice -
                  (item.descuentoMonto || 0) +
                  (item.recargoMonto || 0),
              })),
            }
          : undefined,
        references: data.references
          ? {
              create: data.references.map((ref, idx) => ({
                lineNumber: idx + 1,
                tipoDocRef: ref.tipoDocRef,
                folioRef: ref.folioRef,
                fechaRef: new Date(ref.fechaRef),
                codRef: ref.codRef,
                razonRef: ref.razonRef,
              })),
            }
          : undefined,
      },
      include: { items: true, references: true },
    });
  }

  async delete(tenantId: string, dteId: string) {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const dte = await db.dte.findUniqueOrThrow({ where: { id: dteId } });

    if (dte.status !== 'DRAFT') {
      throw new BadRequestException(
        'Solo se pueden eliminar DTEs en estado borrador',
      );
    }

    await db.dte.delete({ where: { id: dteId } });
  }
}
