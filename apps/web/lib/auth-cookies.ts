const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 días

export function setAuthCookie(token: string) {
  document.cookie = `access_token=${token}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function clearAuthCookie() {
  document.cookie = "access_token=; path=/; max-age=0; SameSite=Lax";
}
