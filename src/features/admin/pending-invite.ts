import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_KEY = 'comethical.pendingAdminInvite';

/** Remembers an invite opened while signed out, so it can be accepted right after signing in. */
export const pendingInvite = {
  save: (code: string) => AsyncStorage.setItem(PENDING_KEY, code).catch(() => undefined),
  peek: () => AsyncStorage.getItem(PENDING_KEY).catch(() => null),
  clear: () => AsyncStorage.removeItem(PENDING_KEY).catch(() => undefined),
};
