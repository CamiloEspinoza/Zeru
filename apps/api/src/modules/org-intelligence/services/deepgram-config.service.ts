import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Provides the Deepgram API key for a given tenant.
 *
 * Current strategy (simplest viable):
 *  1. Fall back to the DEEPGRAM_API_KEY environment variable.
 *  2. Per-tenant encrypted keys can be added later following the
 *     GeminiConfig / AiProviderConfig pattern (separate Prisma model).
 */
@Injectable()
export class DeepgramConfigService {
  private readonly logger = new Logger(DeepgramConfigService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Resolve a Deepgram API key for the given tenant.
   *
   * Resolution order:
   *  1. Environment variable DEEPGRAM_API_KEY (shared across tenants for now)
   *
   * @throws Error if no key can be resolved
   */
  async getApiKey(tenantId: string): Promise<string> {
    // --- ENV fallback (shared key) ---
    const envKey = this.config.get<string>('DEEPGRAM_API_KEY');
    if (envKey) {
      this.logger.debug(
        `Using env DEEPGRAM_API_KEY for tenant ${tenantId}`,
      );
      return envKey;
    }

    throw new Error(
      `No Deepgram API key configured for tenant ${tenantId}. ` +
        'Set the DEEPGRAM_API_KEY environment variable.',
    );
  }
}
