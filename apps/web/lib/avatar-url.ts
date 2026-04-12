const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3017/api";

/**
 * Returns a stable, cacheable avatar URL for a user.
 * @param userId - User UUID
 * @param size - Max dimension in pixels (default 96 = 48px * 2x retina)
 */
export function getUserAvatarUrl(userId: string | undefined | null, size = 96): string | null {
  if (!userId) return null;
  return `${API_BASE}/avatars/${userId}?s=${size}`;
}
