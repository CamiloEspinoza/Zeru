import { Injectable, Logger } from '@nestjs/common';

/**
 * In-memory sliding-window rate limiter for the SII Boleta REST API.
 *
 * The SII enforces a limit of 600 requests per hour per certificate/RUT.
 * This service uses a simple timestamp array (sliding window) to track
 * requests and prevent exceeding the limit.
 *
 * For a single-instance deployment this is sufficient. If multiple instances
 * share the same certificate, consider migrating to a Redis-based approach.
 */
@Injectable()
export class SiiRateLimiterService {
  private readonly logger = new Logger(SiiRateLimiterService.name);

  private timestamps: number[] = [];
  private readonly maxRequests = 600;
  private readonly windowMs = 60 * 60 * 1000; // 1 hour

  /**
   * Acquire a request token. Throws if the rate limit has been reached.
   *
   * Call this before every SII Boleta REST API request.
   */
  async acquire(): Promise<void> {
    const now = Date.now();

    // Prune timestamps outside the sliding window
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);

    if (this.timestamps.length >= this.maxRequests) {
      const oldestInWindow = this.timestamps[0];
      const waitMs = this.windowMs - (now - oldestInWindow);
      const waitSec = Math.ceil(waitMs / 1000);

      this.logger.warn(
        `SII rate limit reached (${this.maxRequests}/hour). Retry after ${waitSec}s`,
      );

      throw new Error(
        `Limite de tasa SII alcanzado (${this.maxRequests} solicitudes/hora). Reintente en ${waitSec}s.`,
      );
    }

    this.timestamps.push(now);
  }

  /**
   * Returns the number of remaining request tokens in the current window.
   * Useful for monitoring and dashboard display.
   */
  getRemainingTokens(): number {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);
    return Math.max(0, this.maxRequests - this.timestamps.length);
  }

  /**
   * Returns the number of requests made in the current window.
   */
  getUsedTokens(): number {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);
    return this.timestamps.length;
  }
}
