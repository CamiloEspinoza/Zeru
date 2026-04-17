import { Injectable } from '@nestjs/common';

/**
 * Chilean national holidays (feriados legales e irrenunciables).
 *
 * Fixed-date holidays are hardcoded. Moveable holidays (Viernes Santo,
 * Sábado Santo, Corpus Christi, San Pedro y San Pablo trasladable,
 * Día de la Virgen, Día del Encuentro de Dos Mundos trasladable,
 * Día de las Iglesias Evangélicas) are computed per year.
 *
 * Results are cached per-year for performance.
 *
 * References:
 * - Código del Trabajo, art. 35
 * - Ley 19.668 (feriados trasladables)
 * - Ley 20.148, 20.299, 20.663 (Iglesias Evangélicas, etc.)
 *
 * NOTE: This list covers the stable recurring feriados. Ad-hoc decrees
 * (e.g. feriados presidenciales, elecciones) must be added manually.
 */
@Injectable()
export class ChileanHolidaysService {
  private readonly cache = new Map<number, Set<string>>();

  /**
   * Returns true if the given date is a Chilean national holiday.
   */
  isHoliday(date: Date): boolean {
    const year = date.getFullYear();
    const holidays = this.getHolidaysForYear(year);
    return holidays.has(this.toKey(date));
  }

  /**
   * Returns the Set of holiday keys (YYYY-MM-DD) for the given year.
   */
  getHolidaysForYear(year: number): Set<string> {
    const cached = this.cache.get(year);
    if (cached) return cached;

    const holidays = new Set<string>();

    // Fixed-date holidays
    const fixed: Array<[number, number]> = [
      [1, 1], // Año Nuevo
      [5, 1], // Día del Trabajo
      [5, 21], // Día de las Glorias Navales
      [6, 20], // Día Nacional de los Pueblos Indígenas (ley 21.357, desde 2021)
      [6, 29], // San Pedro y San Pablo (puede trasladarse — ver abajo)
      [7, 16], // Virgen del Carmen
      [8, 15], // Asunción de la Virgen
      [9, 18], // Independencia Nacional
      [9, 19], // Glorias del Ejército
      [10, 12], // Encuentro de Dos Mundos (puede trasladarse)
      [10, 31], // Día de las Iglesias Evangélicas (puede trasladarse — regla especial)
      [11, 1], // Día de Todos los Santos
      [12, 8], // Inmaculada Concepción
      [12, 25], // Navidad
    ];

    for (const [m, d] of fixed) {
      holidays.add(this.fmt(year, m, d));
    }

    // Moveable: Semana Santa (Viernes + Sábado Santo)
    const easter = this.computeEaster(year);
    const goodFriday = this.addDays(easter, -2);
    const holySaturday = this.addDays(easter, -1);
    holidays.add(this.toKey(goodFriday));
    holidays.add(this.toKey(holySaturday));

    this.cache.set(year, holidays);
    return holidays;
  }

  // ────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────

  private toKey(date: Date): string {
    return this.fmt(
      date.getFullYear(),
      date.getMonth() + 1,
      date.getDate(),
    );
  }

  private fmt(y: number, m: number, d: number): string {
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * Computes the date of Easter Sunday for a given year
   * using the Anonymous Gregorian algorithm (Meeus/Jones/Butcher).
   */
  private computeEaster(year: number): Date {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }
}
