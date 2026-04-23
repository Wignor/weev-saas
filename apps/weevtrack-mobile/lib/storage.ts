import AsyncStorage from '@react-native-async-storage/async-storage';

export interface StoredUser {
  id: number;
  name: string;
  email: string;
  administrator: boolean;
}

export async function saveSession(sessionId: string, user: StoredUser) {
  await Promise.all([
    AsyncStorage.setItem('wt_session', sessionId),
    AsyncStorage.setItem('wt_user', JSON.stringify(user)),
  ]);
}

export async function getSession(): Promise<string | null> {
  return AsyncStorage.getItem('wt_session');
}

export async function getStoredUser(): Promise<StoredUser | null> {
  const raw = await AsyncStorage.getItem('wt_user');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function clearSession() {
  await Promise.all([
    AsyncStorage.removeItem('wt_session'),
    AsyncStorage.removeItem('wt_user'),
  ]);
}
