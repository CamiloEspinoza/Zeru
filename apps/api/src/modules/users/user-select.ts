import { buildAvatarProxyUrl } from './avatar-url.helper';

/** Standard Prisma select for user data with avatar resolution */
export const USER_SUMMARY_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  avatarUrl: true,
  personProfiles: {
    where: { deletedAt: null },
    select: { avatarS3Key: true },
    take: 1,
  },
} as const;

/** Maps a raw Prisma user (with personProfiles) to a clean DTO with resolved avatarUrl */
export function mapUserWithAvatar<T extends {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string | null;
  personProfiles?: Array<{ avatarS3Key: string | null }>;
}>(user: T): Omit<T, 'personProfiles'> & { avatarUrl: string | null } {
  const { personProfiles, ...rest } = user;
  const avatarS3Key = personProfiles?.[0]?.avatarS3Key;
  return {
    ...rest,
    avatarUrl: buildAvatarProxyUrl(user.id, avatarS3Key),
  };
}
