import { Injectable, Logger } from '@nestjs/common';
import { validateRut } from '@zeru/shared';
import { DteConfigService } from '../services/dte-config.service';
import { ChileanHolidaysService } from '../../../common/services/chilean-holidays.service';
import { ParsedDte } from './dte-xml-parser.service';
import { TASA_IVA } from '../constants/dte-types.constants';

// ────────────────────────────────────────────────────────────
// Interfaces
// ────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  deadlineDate: Date;
}

// ────────────────────────────────────────────────────────────
// Exempt DTE types (no IVA expected)
// ────────────────────────────────────────────────────────────

const EXEMPT_DTE_TYPES = new Set([34, 41]);

// ────────────────────────────────────────────────────────────
// Service
// ────────────────────────────────────────────────────────────

/**
 * Validates received (incoming) DTEs before persisting them.
 *
 * Checks:
 * - Receptor RUT matches our DteConfig RUT (document is addressed to us)
 * - Folio is a positive integer
 * - Totals are consistent (neto + iva = total, or exento = total for exempt)
 * - fechaEmision is not in the future
 * - Emisor RUT is a valid Chilean RUT format
 * - Calculates the 8-business-day deadline for accepting/rejecting
 *
 * NOTE: XMLDSig signature verification is NOT yet implemented.
 * See TODO below — will be integrated when @devlas/dte-sii exposes verification APIs.
 */
@Injectable()
export class DteValidationService {
  private readonly logger = new Logger(DteValidationService.name);

  constructor(
    private readonly configService: DteConfigService,
    private readonly holidaysService: ChileanHolidaysService,
  ) {}

  /**
   * Validate a parsed DTE document.
   *
   * @param parsedDte - The parsed DTE to validate
   * @param tenantId  - Tenant ID to look up our DteConfig (our RUT)
   * @returns Validation result with errors (if any) and the 8-business-day deadline
   */
  async validate(
    parsedDte: ParsedDte,
    tenantId: string,
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // ─── 1. Receptor RUT matches our config ─────────────────
    const config = await this.configService.get(tenantId);
    const ourRut = this.normalizeRut(config.rut);
    const receptorRut = this.normalizeRut(parsedDte.receptor.rut);

    if (!receptorRut) {
      errors.push('El DTE no tiene RUT de receptor');
    } else if (ourRut !== receptorRut) {
      errors.push(
        `El RUT del receptor (${parsedDte.receptor.rut}) no coincide con nuestro RUT (${config.rut})`,
      );
    }

    // ─── 2. Folio is positive ───────────────────────────────
    if (!parsedDte.folio || parsedDte.folio <= 0) {
      errors.push(
        `Folio inválido: ${parsedDte.folio}. Debe ser un entero positivo`,
      );
    }

    // ─── 3. Totals consistency ──────────────────────────────
    this.validateTotals(parsedDte, errors, warnings);

    // ─── 4. Fecha de emisión not in the future ──────────────
    if (parsedDte.fechaEmision) {
      const emisionDate = new Date(parsedDte.fechaEmision);
      const today = new Date();
      today.setHours(23, 59, 59, 999); // Allow same day

      if (emisionDate > today) {
        errors.push(
          `La fecha de emisión (${parsedDte.fechaEmision}) es futura`,
        );
      }
    } else {
      errors.push('El DTE no tiene fecha de emisión');
    }

    // ─── 5. Emisor RUT format + mod-11 DV validation ────────
    if (!parsedDte.emisor.rut) {
      errors.push('El DTE no tiene RUT de emisor');
    } else if (!this.isValidRutFormat(parsedDte.emisor.rut)) {
      errors.push(
        `El RUT del emisor tiene formato inválido: ${parsedDte.emisor.rut}`,
      );
    } else if (!validateRut(parsedDte.emisor.rut)) {
      errors.push(
        `El RUT del emisor tiene dígito verificador inválido (mod-11): ${parsedDte.emisor.rut}`,
      );
    }

    // ─── 6. XMLDSig verification ────────────────────────────
    // TODO: Implement XML digital signature verification.
    // When @devlas/dte-sii exposes a verification/validation API, integrate it here.
    // For now, we skip cryptographic verification and rely on SII's own validation
    // when we send the RecepcionDTE response.
    //
    // Future implementation:
    //   const signatureValid = await dteVerifier.verifySignature(parsedDte.xmlContent);
    //   if (!signatureValid) {
    //     errors.push('La firma digital del DTE no es válida');
    //   }

    // ─── 7. Basic structural checks ────────────────────────
    if (!parsedDte.emisor.razonSocial) {
      warnings.push('El emisor no tiene razón social');
    }

    if (parsedDte.items.length === 0) {
      warnings.push('El DTE no tiene líneas de detalle');
    }

    if (!parsedDte.tedXml) {
      warnings.push(
        'No se encontró el Timbre Electrónico (TED) en el documento',
      );
    }

    // ─── Calculate deadline ─────────────────────────────────
    const deadlineDate = this.calculateDeadline(new Date(), 8);

    const valid = errors.length === 0;

    if (!valid) {
      this.logger.warn(
        `DTE ${parsedDte.tipoDTE}#${parsedDte.folio} validation failed: ${errors.join('; ')}`,
      );
    }

    return { valid, errors, warnings, deadlineDate };
  }

  /**
   * Validate totals consistency based on DTE type.
   */
  private validateTotals(
    parsedDte: ParsedDte,
    errors: string[],
    warnings: string[],
  ): void {
    const { montoNeto, montoExento, iva, montoTotal, tasaIva } =
      parsedDte.totales;
    const isExempt = EXEMPT_DTE_TYPES.has(parsedDte.tipoDTE);

    if (isExempt) {
      // Exempt documents: montoExento should equal montoTotal, no IVA
      if (iva !== 0) {
        errors.push(
          `DTE exento (tipo ${parsedDte.tipoDTE}) no debería tener IVA, pero tiene $${iva}`,
        );
      }

      if (montoExento !== montoTotal && montoTotal !== 0) {
        warnings.push(
          `Monto exento ($${montoExento}) no coincide con monto total ($${montoTotal}) en DTE exento`,
        );
      }
    } else {
      // Afecta documents: neto + iva = total (with tolerance for rounding)
      const expectedTotal = montoNeto + iva + montoExento;
      const tolerance = 2; // Allow $2 rounding difference (SII rounding rules)

      if (Math.abs(expectedTotal - montoTotal) > tolerance) {
        errors.push(
          `Totales inconsistentes: neto($${montoNeto}) + IVA($${iva}) + exento($${montoExento}) = $${expectedTotal}, pero total es $${montoTotal}`,
        );
      }

      // Verify IVA rate if present
      if (tasaIva && tasaIva !== TASA_IVA && montoNeto > 0) {
        warnings.push(
          `Tasa de IVA inusual: ${tasaIva}% (esperado ${TASA_IVA}%)`,
        );
      }

      // Verify IVA amount matches neto * rate (with tolerance)
      if (montoNeto > 0 && iva > 0) {
        const expectedIva = Math.round(montoNeto * (TASA_IVA / 100));
        if (Math.abs(expectedIva - iva) > tolerance) {
          warnings.push(
            `IVA ($${iva}) no coincide con neto * ${TASA_IVA}% ($${expectedIva}). Puede ser un IVA especial o rounding`,
          );
        }
      }
    }
  }

  /**
   * Calculate a deadline date adding N business days, skipping weekends
   * and Chilean national holidays (feriados).
   */
  calculateDeadline(fromDate: Date, businessDays: number): Date {
    const result = new Date(fromDate);
    let daysAdded = 0;

    while (daysAdded < businessDays) {
      result.setDate(result.getDate() + 1);
      const dayOfWeek = result.getDay();

      // Skip Saturday (6) and Sunday (0)
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      // Skip Chilean national holidays
      if (this.holidaysService.isHoliday(result)) continue;

      daysAdded++;
    }

    return result;
  }

  /**
   * Normalize a RUT for comparison: remove dots, dashes, spaces.
   * Returns uppercase digits+dv, e.g. "12345678K"
   */
  private normalizeRut(rut: string): string {
    if (!rut) return '';
    return rut.replace(/[^0-9kK]/g, '').toUpperCase();
  }

  /**
   * Check if a RUT string has a valid Chilean RUT format.
   * Format: digits + dash + verification digit (or just digits+dv).
   * Does NOT validate the modulo-11 check digit here — only format.
   */
  private isValidRutFormat(rut: string): boolean {
    if (!rut) return false;
    const clean = this.normalizeRut(rut);

    // Must be 2-10 characters (body digits + 1 dv)
    if (clean.length < 2 || clean.length > 10) return false;

    const body = clean.slice(0, -1);
    const dv = clean.slice(-1);

    // Body must be all digits
    if (!/^\d+$/.test(body)) return false;

    // DV must be digit or K
    if (!/^[0-9K]$/.test(dv)) return false;

    return true;
  }
}
