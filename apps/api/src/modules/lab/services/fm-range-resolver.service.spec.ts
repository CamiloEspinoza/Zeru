import { Test } from '@nestjs/testing';
import { FmRangeResolverService } from './fm-range-resolver.service';
import { FmApiService } from '../../filemaker/services/fm-api.service';

describe('FmRangeResolverService', () => {
  let service: FmRangeResolverService;
  let fmApi: jest.Mocked<FmApiService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        FmRangeResolverService,
        {
          provide: FmApiService,
          useValue: {
            findRecords: jest.fn(),
            getRecords: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(FmRangeResolverService);
    fmApi = module.get(FmApiService);
  });

  describe('getSourceStats', () => {
    it('returns total record count for BIOPSIAS without date filter', async () => {
      fmApi.getRecords.mockResolvedValue({
        records: [],
        totalRecordCount: 1297449,
      });

      const stats = await service.getSourceStats('BIOPSIAS');

      expect(stats.source).toBe('BIOPSIAS');
      expect(stats.totalRecords).toBe(1297449);
      expect(fmApi.getRecords).toHaveBeenCalledWith('BIOPSIAS', 'Validación Final*', {
        limit: 1,
        dateformats: 2,
      });
    });

    it('returns filtered count for BIOPSIAS with date range', async () => {
      fmApi.findRecords.mockResolvedValue({
        records: [],
        totalRecordCount: 3542,
      });

      const stats = await service.getSourceStats('BIOPSIAS', {
        dateFrom: new Date('2026-03-01'),
        dateTo: new Date('2026-03-31'),
      });

      expect(stats.totalRecords).toBe(3542);
      expect(fmApi.findRecords).toHaveBeenCalledWith(
        'BIOPSIAS',
        'Validación Final*',
        [{ 'FECHA VALIDACIÓN': '03/01/2026...03/31/2026' }],
        { limit: 1, dateformats: 2 },
      );
    });

    it('returns filtered count for PAPANICOLAOU with date range', async () => {
      fmApi.findRecords.mockResolvedValue({
        records: [],
        totalRecordCount: 7200,
      });

      const stats = await service.getSourceStats('PAPANICOLAOU', {
        dateFrom: new Date('2026-03-01'),
        dateTo: new Date('2026-03-31'),
      });

      expect(stats.totalRecords).toBe(7200);
      expect(fmApi.findRecords).toHaveBeenCalledWith(
        'PAPANICOLAOU',
        'INGRESO',
        [{ FECHA: '03/01/2026...03/31/2026' }],
        { limit: 1, dateformats: 2 },
      );
    });

    it('returns zero for FM 401 error (no records found)', async () => {
      fmApi.findRecords.mockRejectedValue(
        new Error('FileMaker error 401: No records match the request'),
      );

      const stats = await service.getSourceStats('BIOPSIAS', {
        dateFrom: new Date('1990-01-01'),
        dateTo: new Date('1990-01-31'),
      });

      expect(stats.totalRecords).toBe(0);
    });
  });

  describe('getChargeStats', () => {
    it('returns biopsy charge count', async () => {
      fmApi.getRecords.mockResolvedValue({
        records: [],
        totalRecordCount: 140068,
      });

      const stats = await service.getChargeStats('BIOPSIAS_INGRESOS');

      expect(stats.totalRecords).toBe(140068);
    });
  });

  describe('getLiquidationStats', () => {
    it('returns liquidation count', async () => {
      fmApi.getRecords.mockResolvedValue({
        records: [],
        totalRecordCount: 2643,
      });

      const stats = await service.getLiquidationStats();

      expect(stats.totalRecords).toBe(2643);
    });
  });
});
