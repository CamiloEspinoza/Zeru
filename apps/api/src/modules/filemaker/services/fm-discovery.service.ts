import { Injectable } from '@nestjs/common';
import { FmApiService } from './fm-api.service';
import { FmAuthService } from './fm-auth.service';
import type {
  FmLayout,
  FmLayoutMetadata,
  FmResponse,
  FmFindQuery,
  FmQueryOptions,
  FmScript,
  FmConnectionStatus,
} from '@zeru/shared';

@Injectable()
export class FmDiscoveryService {
  constructor(
    private readonly api: FmApiService,
    private readonly auth: FmAuthService,
  ) {}

  async testConnection(database: string): Promise<FmConnectionStatus> {
    const connected = await this.auth.testConnection(database);
    return {
      connected,
      host: this.auth.fmHost,
      database,
      lastChecked: new Date().toISOString(),
      error: connected ? undefined : 'Could not establish session',
    };
  }

  async listDatabases(): Promise<string[]> {
    return this.api.getDatabases();
  }

  async listLayouts(database: string): Promise<FmLayout[]> {
    return this.api.getLayouts(database);
  }

  async getLayoutFields(database: string, layout: string): Promise<FmLayoutMetadata> {
    return this.api.getLayoutMetadata(database, layout);
  }

  async sampleRecords(database: string, layout: string, limit = 10): Promise<FmResponse> {
    return this.api.getRecords(database, layout, { limit, dateformats: 2 });
  }

  async searchRecords(
    database: string,
    layout: string,
    query: FmFindQuery[],
    opts?: FmQueryOptions,
  ): Promise<FmResponse> {
    return this.api.findRecords(database, layout, query, { ...opts, dateformats: opts?.dateformats ?? 2 });
  }

  async listScripts(database: string): Promise<FmScript[]> {
    return this.api.getScripts(database);
  }
}
