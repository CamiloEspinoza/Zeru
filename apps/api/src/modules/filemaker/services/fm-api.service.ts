import { Injectable, Logger } from '@nestjs/common';
import { FmAuthService } from './fm-auth.service';
import type {
  FmRecord,
  FmResponse,
  FmQueryOptions,
  FmFindQuery,
  FmLayout,
  FmLayoutMetadata,
  FmFieldMetadata,
  FmPortalMetadata,
  FmScript,
  FmScriptResult,
} from '@zeru/shared';

@Injectable()
export class FmApiService {
  private readonly logger = new Logger(FmApiService.name);

  constructor(private readonly auth: FmAuthService) {}

  // ── Private helpers ──

  private baseUrl(db: string): string {
    return `${this.auth.fmHost}/fmi/data/vLatest/databases/${encodeURIComponent(db)}`;
  }

  private async request<T>(
    db: string,
    path: string,
    options: { method: string; body?: unknown; retry?: boolean },
  ): Promise<T> {
    const token = await this.auth.getToken(db);
    const url = `${this.baseUrl(db)}${path}`;

    const response = await fetch(url, {
      method: options.method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    // Auto-refresh on 401
    if (response.status === 401 && options.retry !== false) {
      this.logger.warn(`FM 401 on ${options.method} ${path}, re-authenticating...`);
      this.auth.invalidateSession(db);
      return this.request<T>(db, path, { ...options, retry: false });
    }

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`FM API error ${response.status}: ${options.method} ${path} — ${text}`);
      throw new Error(`FileMaker API error: ${response.status} — ${text}`);
    }

    return response.json() as Promise<T>;
  }

  private normalizeRecords(raw: any): FmResponse {
    const data = raw.response?.data ?? [];
    const totalRecordCount = raw.response?.dataInfo?.totalRecordCount ?? data.length;

    const records: FmRecord[] = data.map((item: any) => ({
      recordId: item.recordId,
      modId: item.modId,
      fieldData: item.fieldData ?? {},
      portalData: item.portalData,
    }));

    return { records, totalRecordCount };
  }

  // ── Records ──

  async getRecords(db: string, layout: string, opts?: FmQueryOptions): Promise<FmResponse> {
    const params = new URLSearchParams();
    if (opts?.offset) params.set('_offset', String(opts.offset));
    if (opts?.limit) params.set('_limit', String(opts.limit));
    if (opts?.dateformats !== undefined) params.set('dateformats', String(opts.dateformats));
    if (opts?.sort) params.set('_sort', JSON.stringify(opts.sort));
    if (opts?.portals) params.set('portal', JSON.stringify(opts.portals));

    const qs = params.toString() ? `?${params.toString()}` : '';
    const raw = await this.request(db, `/layouts/${encodeURIComponent(layout)}/records${qs}`, {
      method: 'GET',
    });
    return this.normalizeRecords(raw);
  }

  async getRecord(db: string, layout: string, recordId: string): Promise<FmRecord> {
    const raw: any = await this.request(db, `/layouts/${encodeURIComponent(layout)}/records/${recordId}`, {
      method: 'GET',
    });
    const records = this.normalizeRecords(raw).records;
    return records[0];
  }

  async findRecords(db: string, layout: string, query: FmFindQuery[], opts?: FmQueryOptions): Promise<FmResponse> {
    const body: Record<string, unknown> = { query };
    if (opts?.offset) body.offset = String(opts.offset);
    if (opts?.limit) body.limit = String(opts.limit);
    if (opts?.sort) body.sort = opts.sort;
    if (opts?.dateformats !== undefined) body.dateformats = opts.dateformats;
    if (opts?.portals) body.portal = opts.portals;

    const raw = await this.request(db, `/layouts/${encodeURIComponent(layout)}/_find`, {
      method: 'POST',
      body,
    });
    return this.normalizeRecords(raw);
  }

  async createRecord(db: string, layout: string, fieldData: Record<string, unknown>): Promise<{ recordId: string }> {
    const raw: any = await this.request(db, `/layouts/${encodeURIComponent(layout)}/records`, {
      method: 'POST',
      body: { fieldData },
    });
    return { recordId: raw.response.recordId };
  }

  async updateRecord(
    db: string,
    layout: string,
    recordId: string,
    fieldData: Record<string, unknown>,
    modId?: string,
  ): Promise<void> {
    const body: Record<string, unknown> = { fieldData };
    if (modId) body.modId = modId;
    await this.request(db, `/layouts/${encodeURIComponent(layout)}/records/${recordId}`, {
      method: 'PATCH',
      body,
    });
  }

  async deleteRecord(db: string, layout: string, recordId: string): Promise<void> {
    await this.request(db, `/layouts/${encodeURIComponent(layout)}/records/${recordId}`, {
      method: 'DELETE',
    });
  }

  // ── Auto-paginated findAll ──

  async findAll(
    db: string,
    layout: string,
    query: FmFindQuery[],
    opts?: Omit<FmQueryOptions, 'offset' | 'limit'>,
  ): Promise<FmRecord[]> {
    const all: FmRecord[] = [];
    const batchSize = 100;
    let offset = 1;

    while (true) {
      const response = await this.findRecords(db, layout, query, {
        ...opts,
        offset,
        limit: batchSize,
        dateformats: opts?.dateformats ?? 2,
      });
      all.push(...response.records);
      if (all.length >= response.totalRecordCount || response.records.length < batchSize) {
        break;
      }
      offset += batchSize;
    }

    return all;
  }

  // ── Metadata ──

  async getDatabases(): Promise<string[]> {
    const url = `${this.auth.fmHost}/fmi/data/vLatest/databases`;
    const credentials = this.auth.getBasicAuthHeader();

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credentials}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`FM getDatabases error ${response.status}: ${text}`);
      throw new Error(`FileMaker getDatabases error: ${response.status}`);
    }

    const raw: any = await response.json();
    return (raw.response?.databases ?? []).map((d: any) => d.name);
  }

  async getLayouts(db: string): Promise<FmLayout[]> {
    const raw: any = await this.request(db, '/layouts', { method: 'GET' });
    return raw.response?.layouts ?? [];
  }

  async getLayoutMetadata(db: string, layout: string): Promise<FmLayoutMetadata> {
    const raw: any = await this.request(db, `/layouts/${encodeURIComponent(layout)}`, {
      method: 'GET',
    });
    const fields: FmFieldMetadata[] = (raw.response?.fieldMetaData ?? []).map((f: any) => ({
      name: f.name,
      type: f.type,
      result: f.result ?? '',
      global: f.global ?? false,
      autoEnter: f.autoEnter ?? false,
      fourDigitYear: f.fourDigitYear ?? false,
      maxRepeat: f.maxRepeat ?? 1,
      maxCharacters: f.maxCharacters ?? 0,
      notEmpty: f.notEmpty ?? false,
      numeric: f.numeric ?? false,
      repetitions: f.repetitions ?? 1,
      timeOfDay: f.timeOfDay ?? false,
    }));

    const portals: FmPortalMetadata[] = Object.entries(raw.response?.portalMetaData ?? {}).map(
      ([name, portalFields]: [string, any]) => ({
        name,
        fields: portalFields.map((f: any) => ({
          name: f.name,
          type: f.type,
          result: f.result ?? '',
          global: f.global ?? false,
          autoEnter: f.autoEnter ?? false,
          fourDigitYear: f.fourDigitYear ?? false,
          maxRepeat: f.maxRepeat ?? 1,
          maxCharacters: f.maxCharacters ?? 0,
          notEmpty: f.notEmpty ?? false,
          numeric: f.numeric ?? false,
          repetitions: f.repetitions ?? 1,
          timeOfDay: f.timeOfDay ?? false,
        })),
      }),
    );

    return { fields, portals };
  }

  async getScripts(db: string): Promise<FmScript[]> {
    const raw: any = await this.request(db, '/scripts', { method: 'GET' });
    return raw.response?.scripts ?? [];
  }

  // ── Scripts ──

  async runScript(db: string, layout: string, script: string, param?: string): Promise<FmScriptResult> {
    const params = new URLSearchParams();
    params.set('script', script);
    if (param) params.set('script.param', param);

    const raw: any = await this.request(
      db,
      `/layouts/${encodeURIComponent(layout)}/records?${params.toString()}`,
      { method: 'GET' },
    );

    return {
      scriptResult: raw.response?.scriptResult,
      scriptError: raw.response?.scriptError,
    };
  }
}
