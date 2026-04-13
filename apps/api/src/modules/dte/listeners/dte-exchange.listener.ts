import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

interface DteSignedPayload {
  tenantId: string;
  dteId: string;
  folio: number;
  dteType: string;
}

@Injectable()
export class DteExchangeListener {
  private readonly logger = new Logger(DteExchangeListener.name);

  @OnEvent('dte.signed')
  async handleSigned(payload: DteSignedPayload) {
    // Skip boletas — they don't require exchange
    const boletaTypes = [
      'BOLETA_ELECTRONICA',
      'BOLETA_EXENTA_ELECTRONICA',
    ];
    if (boletaTypes.includes(payload.dteType)) return;

    this.logger.log(
      `DTE ${payload.dteId} signed — queuing exchange send to receptor`,
    );
    // TODO: Queue job to send XML to receptor's exchange email
    // This will be fully implemented in Plan E (Exchange module)
    // For now, just log the intent
  }
}
