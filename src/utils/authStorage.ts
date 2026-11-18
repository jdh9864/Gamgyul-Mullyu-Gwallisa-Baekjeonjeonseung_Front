export interface AuthUser {
  token: string;
  userId: string;
  email: string;
  name: string;
}

const KEYS = {
  TOKEN: 'token',
  USER_ID: 'userId',
  EMAIL: 'userEmail',
  NAME: 'userName',
} as const;

export function saveAuthUser(user: AuthUser): void {
  localStorage.setItem(KEYS.TOKEN, user.token);
  localStorage.setItem(KEYS.USER_ID, user.userId);
  localStorage.setItem(KEYS.EMAIL, user.email);
  localStorage.setItem(KEYS.NAME, user.name);
}

export function getAuthUser(): AuthUser | null {
  const token = localStorage.getItem(KEYS.TOKEN);
  const userId = localStorage.getItem(KEYS.USER_ID);
  if (!token || !userId) {
    return null;
  }
  return {
    token,
    userId,
    email: localStorage.getItem(KEYS.EMAIL) ?? '',
    name: localStorage.getItem(KEYS.NAME) ?? '사용자',
  };
}

export function clearAuthUser(): void {
  localStorage.removeItem(KEYS.TOKEN);
  localStorage.removeItem(KEYS.USER_ID);
  localStorage.removeItem(KEYS.EMAIL);
  localStorage.removeItem(KEYS.NAME);
}

export function isAuthenticated(): boolean {
  return getAuthUser() !== null;
}