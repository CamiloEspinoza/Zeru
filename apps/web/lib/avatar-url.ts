/**
 * Returns a stable, cacheable avatar URL for a user.
 * Uses the /api/avatars/:userId proxy endpoint which:
 * - Has a fixed URL (browser can cache it)
 * - Sets Cache-Control headers (1h cache + stale-while-revalidate)
 * - Internally resolves the S3 presigned URL from PersonProfile
 */
export function getUserAvatarUrl(userId: string | undefined | null): string | null {
  if (!userId) return null;
  return `/api/avatars/${userId}`;
}
