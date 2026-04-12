const API_URL = process.env.API_URL ?? 'http://localhost:3017/api';

/**
 * Builds the stable proxy URL for a user's avatar (via linked PersonProfile).
 * Returns null if the user has no avatar.
 */
export function buildAvatarProxyUrl(userId: string, avatarS3Key: string | null | undefined): string | null {
  if (!avatarS3Key) return null;
  return `${API_URL}/avatars/${userId}?s=96`;
}

/**
 * Builds the stable proxy URL for a person's avatar (direct by personId).
 * Returns null if the person has no avatar.
 */
export function buildPersonAvatarProxyUrl(personId: string, avatarS3Key: string | null | undefined): string | null {
  if (!avatarS3Key) return null;
  return `${API_URL}/avatars/person/${personId}?s=96`;
}
