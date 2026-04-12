const API_URL = process.env.API_URL ?? 'http://localhost:3017/api';

/**
 * Builds the stable proxy URL for a user's avatar.
 * Returns null if the user has no avatar (no PersonProfile with avatarS3Key).
 * This URL is deterministic and cacheable.
 */
export function buildAvatarProxyUrl(userId: string, avatarS3Key: string | null | undefined): string | null {
  if (!avatarS3Key) return null;
  return `${API_URL}/avatars/${userId}?s=96`;
}
