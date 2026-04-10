import {
  str,
  parseNum,
  parseDate,
  parseFmDateTime,
  isYes,
  safeParseInt,
  encodeS3Path,
  parsePeriod,
} from './helpers';

describe('Transformer Helpers', () => {
  describe('str()', () => {
    it('returns empty string for null', () => {
      expect(str(null)).toBe('');
    });
    it('returns empty string for undefined', () => {
      expect(str(undefined)).toBe('');
    });
    it('trims whitespace', () => {
      expect(str('  hello  ')).toBe('hello');
    });
    it('converts number to string', () => {
      expect(str(42)).toBe('42');
    });
    it('returns empty string for empty string', () => {
      expect(str('')).toBe('');
    });
  });

  describe('parseNum()', () => {
    it('parses integer string', () => {
      expect(parseNum('42')).toBe(42);
    });
    it('parses decimal string', () => {
      expect(parseNum('1234.56')).toBe(1234.56);
    });
    it('strips non-numeric chars', () => {
      expect(parseNum('$1,234.56')).toBe(1234.56);
    });
    it('returns 0 for empty', () => {
      expect(parseNum('')).toBe(0);
    });
    it('returns 0 for null', () => {
      expect(parseNum(null)).toBe(0);
    });
    it('handles negative numbers', () => {
      expect(parseNum('-500')).toBe(-500);
    });
    it('returns 0 for pure text', () => {
      expect(parseNum('abc')).toBe(0);
    });
  });

  describe('safeParseInt()', () => {
    it('parses integer', () => {
      expect(safeParseInt('42')).toBe(42);
    });
    it('rounds decimal', () => {
      expect(safeParseInt('42.7')).toBe(43);
    });
    it('returns null for empty', () => {
      expect(safeParseInt('')).toBeNull();
    });
    it('returns null for null', () => {
      expect(safeParseInt(null)).toBeNull();
    });
    it('strips non-numeric chars', () => {
      expect(safeParseInt('42 años')).toBe(42);
    });
  });

  describe('parseDate()', () => {
    it('parses ISO date', () => {
      const result = parseDate('2026-03-15');
      expect(result).toBeInstanceOf(Date);
      expect(result!.getFullYear()).toBe(2026);
    });
    it('parses FM date format MM/DD/YYYY', () => {
      const result = parseDate('03/15/2026');
      expect(result).toBeInstanceOf(Date);
      expect(result!.getFullYear()).toBe(2026);
      expect(result!.getMonth()).toBe(2); // March = 2
      expect(result!.getDate()).toBe(15);
    });
    it('returns null for empty string', () => {
      expect(parseDate('')).toBeNull();
    });
    it('returns null for invalid date', () => {
      expect(parseDate('not-a-date')).toBeNull();
    });
    it('returns null for null', () => {
      expect(parseDate(null as unknown as string)).toBeNull();
    });
  });

  describe('parseFmDateTime()', () => {
    it('combines date and time strings', () => {
      const result = parseFmDateTime('03/15/2026', '14:30:00');
      expect(result).toBeInstanceOf(Date);
      expect(result!.getHours()).toBe(14);
      expect(result!.getMinutes()).toBe(30);
    });
    it('returns date-only when time is empty', () => {
      const result = parseFmDateTime('03/15/2026', '');
      expect(result).toBeInstanceOf(Date);
    });
    it('returns null when date is empty', () => {
      expect(parseFmDateTime('', '14:30:00')).toBeNull();
    });
  });

  describe('isYes()', () => {
    it('returns true for "Si"', () => {
      expect(isYes('Si')).toBe(true);
    });
    it('returns true for "SI"', () => {
      expect(isYes('SI')).toBe(true);
    });
    it('returns true for "Sí"', () => {
      expect(isYes('Sí')).toBe(true);
    });
    it('returns false for "No"', () => {
      expect(isYes('No')).toBe(false);
    });
    it('returns false for empty', () => {
      expect(isYes('')).toBe(false);
    });
  });

  describe('encodeS3Path()', () => {
    it('URL-encodes Ñ', () => {
      expect(encodeS3Path('PEÑALOLEN')).toBe('PE%C3%91ALOLEN');
    });
    it('URL-encodes ñ', () => {
      expect(encodeS3Path('peñalolen')).toBe('pe%C3%B1alolen');
    });
    it('preserves forward slashes', () => {
      expect(encodeS3Path('Biopsias/test/2026')).toBe('Biopsias/test/2026');
    });
    it('encodes spaces', () => {
      expect(encodeS3Path('my folder/file')).toBe('my%20folder/file');
    });
    it('handles combined special chars', () => {
      const result = encodeS3Path('Biopsias/PEÑALOLEN/2026/03/12345.pdf');
      expect(result).toBe('Biopsias/PE%C3%91ALOLEN/2026/03/12345.pdf');
    });
  });

  describe('parsePeriod()', () => {
    it('parses "Enero 2025"', () => {
      const result = parsePeriod('Enero 2025');
      expect(result).toBeInstanceOf(Date);
      expect(result!.getFullYear()).toBe(2025);
      expect(result!.getMonth()).toBe(0); // January
    });
    it('parses "1-2025"', () => {
      const result = parsePeriod('1-2025');
      expect(result).toBeInstanceOf(Date);
      expect(result!.getFullYear()).toBe(2025);
      expect(result!.getMonth()).toBe(0);
    });
    it('parses "Diciembre 2024"', () => {
      const result = parsePeriod('Diciembre 2024');
      expect(result).toBeInstanceOf(Date);
      expect(result!.getFullYear()).toBe(2024);
      expect(result!.getMonth()).toBe(11);
    });
    it('parses "12-2024"', () => {
      const result = parsePeriod('12-2024');
      expect(result).toBeInstanceOf(Date);
      expect(result!.getMonth()).toBe(11);
    });
    it('returns null for garbage', () => {
      expect(parsePeriod('not a period')).toBeNull();
    });
    it('returns null for empty string', () => {
      expect(parsePeriod('')).toBeNull();
    });
  });
});
