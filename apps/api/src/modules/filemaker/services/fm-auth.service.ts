import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface FmSession {
  token: string;
  obtainedAt: number;
}

@Injectable()
export class FmAuthService {
  private readonly logger = new Logger(FmAuthService.name);
  private readonly sessions = new Map<string, FmSession>();
  private readonly host: string;
  private readonly username: string;
  private readonly password: string;

  constructor(private readonly config: ConfigService) {
    this.host = this.config.getOrThrow<string>('FM_HOST');
    this.username = this.config.getOrThrow<string>('FM_USERNAME');
    this.password = this.config.getOrThrow<string>('FM_PASSWORD');
  }

  get fmHost(): string {
    return this.host;
  }

  getBasicAuthHeader(): string {
    return Buffer.from(`${this.username}:${this.password}`).toString('base64');
  }

  async getToken(database: string): Promise<string> {
    const existing = this.sessions.get(database);
    if (existing) {
      return existing.token;
    }
    return this.login(database);
  }

  async login(database: string): Promise<string> {
    const url = `${this.host}/fmi/data/vLatest/databases/${encodeURIComponent(database)}/sessions`;
    const credentials = Buffer.from(`${this.username}:${this.password}`).toString('base64');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credentials}`,
      },
      body: '{}',
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`FM login failed for ${database}: ${response.status} ${text}`);
      throw new Error(`FileMaker login failed: ${response.status}`);
    }

    const data = await response.json();
    const token = data.response.token as string;

    this.sessions.set(database, { token, obtainedAt: Date.now() });
    this.logger.log(`FM session opened for database: ${database}`);
    return token;
  }

  async logout(database: string): Promise<void> {
    const session = this.sessions.get(database);
    if (!session) return;

    try {
      const url = `${this.host}/fmi/data/vLatest/databases/${encodeURIComponent(database)}/sessions/${session.token}`;
      await fetch(url, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
      this.logger.log(`FM session closed for database: ${database}`);
    } catch (error) {
      this.logger.warn(`FM logout error for ${database}: ${error}`);
    } finally {
      this.sessions.delete(database);
    }
  }

  /**
   * Clear the cached token immediately and fire-and-forget a DELETE /sessions
   * to FM so the slot is released server-side. Without the DELETE, repeated
   * re-authentication (e.g. on 401 retries) stacks up zombie sessions until
   * FM returns error 812 "Exceeded host's capacity".
   */
  invalidateSession(database: string): void {
    const session = this.sessions.get(database);
    this.sessions.delete(database);
    if (!session) return;
    void this.attemptRemoteLogout(database, session.token);
  }

  private async attemptRemoteLogout(database: string, token: string): Promise<void> {
    try {
      const url = `${this.host}/fmi/data/vLatest/databases/${encodeURIComponent(database)}/sessions/${token}`;
      await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
    } catch (err) {
      // Best-effort: if the token is already expired or the network is down,
      // we still succeed (the cache is cleared). Log at debug only.
      this.logger.debug(`FM remote logout failed for ${database}: ${err}`);
    }
  }

  async testConnection(database: string): Promise<boolean> {
    try {
      await this.login(database);
      await this.logout(database);
      return true;
    } catch {
      return false;
    }
  }
}
