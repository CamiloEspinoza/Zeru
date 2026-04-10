import type { FmRecord, FmFindQuery } from '@zeru/shared';

export interface FmTransformer<TZeru, TFmCreate = Record<string, unknown>> {
  readonly database: string;
  readonly layouts: { primary: string; related?: string[] };

  fromFm(record: FmRecord): TZeru;
  toFm(data: TZeru): TFmCreate;
  buildFmQuery?(filters: Record<string, unknown>): FmFindQuery[];
}
