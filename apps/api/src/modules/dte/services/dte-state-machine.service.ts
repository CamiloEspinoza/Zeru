import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { DteStatus, PrismaClient } from '@prisma/client';
import { VALID_TRANSITIONS } from '../constants/state-machine.constants';

@Injectable()
export class DteStateMachineService {
  private readonly logger = new Logger(DteStateMachineService.name);

  async transition(
    dteId: string,
    from: DteStatus,
    to: DteStatus,
    db: PrismaClient,
    logMessage?: string,
    actorId?: string,
  ): Promise<void> {
    const allowed = VALID_TRANSITIONS[from];
    if (!allowed || !allowed.includes(to)) {
      throw new ConflictException(
        `Transición inválida: ${from} → ${to}. Transiciones permitidas desde ${from}: ${allowed?.join(', ') || 'ninguna'}`,
      );
    }

    const result = await db.dte.updateMany({
      where: { id: dteId, status: from },
      data: { status: to },
    });

    if (result.count === 0) {
      const current = await db.dte.findUnique({
        where: { id: dteId },
        select: { status: true },
      });
      throw new ConflictException(
        `DTE ${dteId} ya no está en estado ${from} (estado actual: ${current?.status ?? 'no encontrado'})`,
      );
    }

    await db.dteLog.create({
      data: {
        dteId,
        action: to as any,
        message: logMessage ?? `${from} → ${to}`,
        actorId,
      },
    });

    this.logger.log(`DTE ${dteId}: ${from} → ${to}`);
  }

  canTransition(from: DteStatus, to: DteStatus): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
  }
}
