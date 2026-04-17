import { Injectable, Logger } from '@nestjs/common';
import { FmApiService } from '../../filemaker/services/fm-api.service';
import type { FmSourceType, ExamChargeSourceType } from '../../filemaker/transformers/types';

export interface SourceStats {
  source: string;
  totalRecords: number;
  database: string;
  layout: string;
}

interface DateFilter {
  dateFrom: Date;
  dateTo: Date;
}

/** FM database/layout configuration per source */
const SOURCE_CONFIG: Record<string, { database: string; layout: string; dateField: string }> = {
  BIOPSIAS: {
    database: 'BIOPSIAS',
    layout: 'Validación Final*',
    dateField: 'FECHA VALIDACIÓN',
  },
  BIOPSIASRESPALDO: {
    database: 'BIOPSIASRESPALDO',
    layout: 'Validación Final*',
    dateField: 'FECHA VALIDACIÓN',
  },
  PAPANICOLAOU: { database: 'PAPANICOLAOU', layout: 'INGRESO', dateField: 'FECHA' },
  PAPANICOLAOUHISTORICO: {
    database: 'PAPANICOLAOUHISTORICO',
    layout: 'INGRESO',
    dateField: 'FECHA',
  },
};

const CHARGE_CONFIG: Record<string, { database: string; layout: string }> = {
  BIOPSIAS_INGRESOS: { database: 'BIOPSIAS', layout: 'Biopsias_Ingresos*' },
  PAP_INGRESOS: { database: 'BIOPSIAS', layout: 'PAP_ingresos*' },
};

const TRACEABILITY_CONFIG: Record<string, { database: string; layout: string }> = {
  BIOPSIAS: { database: 'BIOPSIAS', layout: 'TRAZA' },
  BIOPSIASRESPALDO: { database: 'BIOPSIASRESPALDO', layout: 'TRAZA' },
};

@Injectable()
export class FmRangeResolverService {
  private readonly logger = new Logger(FmRangeResolverService.name);

  constructor(private readonly fmApi: FmApiService) {}

  /**
   * Get total record count for an exam source, optionally filtered by date.
   */
  async getSourceStats(source: FmSourceType, dateFilter?: DateFilter): Promise<SourceStats> {
    const config = SOURCE_CONFIG[source];
    if (!config) throw new Error(`Unknown source: ${source}`);

    try {
      if (dateFilter) {
        const rangeStr = this.formatFmDateRange(dateFilter.dateFrom, dateFilter.dateTo);
        this.logger.log(`[${source}] Querying FM _find: field="${config.dateField}" range="${rangeStr}"`);
        const response = await this.fmApi.findRecords(
          config.database,
          config.layout,
          [{ [config.dateField]: rangeStr }],
          { limit: 1, dateformats: 2 },
        );
        this.logger.log(`[${source}] FM _find returned totalRecordCount=${response.totalRecordCount}`);
        return {
          source,
          totalRecords: response.totalRecordCount,
          database: config.database,
          layout: config.layout,
        };
      }

      const response = await this.fmApi.getRecords(config.database, config.layout, {
        limit: 1,
        dateformats: 2,
      });
      return {
        source,
        totalRecords: response.totalRecordCount,
        database: config.database,
        layout: config.layout,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      // FM error 401 = "No records match" — not a real error
      if (msg.includes('error 401') || msg.includes('No records match')) {
        this.logger.log(`No records found for ${source} with given filter`);
        return { source, totalRecords: 0, database: config.database, layout: config.layout };
      }
      throw error;
    }
  }

  /**
   * Get total record count for charge source.
   */
  async getChargeStats(source: ExamChargeSourceType): Promise<SourceStats> {
    const config = CHARGE_CONFIG[source];
    if (!config) throw new Error(`Unknown charge source: ${source}`);

    const response = await this.fmApi.getRecords(config.database, config.layout, {
      limit: 1,
      dateformats: 2,
    });
    return {
      source,
      totalRecords: response.totalRecordCount,
      database: config.database,
      layout: config.layout,
    };
  }

  /**
   * Get traceability record count for a biopsy source.
   */
  async getTraceabilityStats(
    source: 'BIOPSIAS' | 'BIOPSIASRESPALDO',
    dateFilter?: DateFilter,
  ): Promise<SourceStats> {
    const config = TRACEABILITY_CONFIG[source];
    if (!config) throw new Error(`Unknown traceability source: ${source}`);

    try {
      if (dateFilter) {
        const rangeStr = this.formatFmDateRange(dateFilter.dateFrom, dateFilter.dateTo);
        // Use the same date field as the workflow handler for consistency
        const response = await this.fmApi.findRecords(
          config.database,
          config.layout,
          [{ 'Trazabilidad::Fecha_Macroscopía': rangeStr }],
          { limit: 1, dateformats: 2 },
        );
        return {
          source,
          totalRecords: response.totalRecordCount,
          database: config.database,
          layout: config.layout,
        };
      }

      const response = await this.fmApi.getRecords(config.database, config.layout, {
        limit: 1,
        dateformats: 2,
      });
      return {
        source,
        totalRecords: response.totalRecordCount,
        database: config.database,
        layout: config.layout,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('error 401') || msg.includes('No records match')) {
        return { source, totalRecords: 0, database: config.database, layout: config.layout };
      }
      throw error;
    }
  }

  /**
   * Get liquidation record count.
   */
  async getLiquidationStats(): Promise<SourceStats> {
    const response = await this.fmApi.getRecords('BIOPSIAS', 'Liquidaciones', {
      limit: 1,
      dateformats: 2,
    });
    return {
      source: 'LIQUIDACIONES',
      totalRecords: response.totalRecordCount,
      database: 'BIOPSIAS',
      layout: 'Liquidaciones',
    };
  }

  /**
   * Format a date range for FM find query: "MM/DD/YYYY...MM/DD/YYYY"
   */
  private formatFmDateRange(from: Date, to: Date): string {
    const fmt = (d: Date) =>
      `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}/${d.getUTCFullYear()}`;
    return `${fmt(from)}...${fmt(to)}`;
  }
}
