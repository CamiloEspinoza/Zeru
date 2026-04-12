const API_BASE =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3017/api")
    : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3017/api");

/**
 * Returns a stable, cacheable avatar URL for a user.
 * Uses the /api/avatars/:userId proxy endpoint which:
 * - Has a fixed URL (browser can cache it)
 * - Sets Cache-Control headers (1h cache + immutable)
 * - Internally resolves the S3 image from PersonProfile
 */
export function getUserAvatarUrl(userId: string | undefined | null): string | null {
  if (!userId) return null;
  return `${API_BASE}/avatars/${userId}`;
}
