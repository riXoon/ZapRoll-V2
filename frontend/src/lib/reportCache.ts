import AsyncStorage from '@react-native-async-storage/async-storage';

const reports = new Map<string, string>();
const MAX_ENTRIES = 8;
const MAX_ENTRY_LENGTH = 256_000;
let cleanup: Promise<void> | undefined;

export const reportCache = {
  getItem(key: string) {
    return reports.get(key) ?? null;
  },
  setItem(key: string, value: string) {
    reports.delete(key);
    if (value.length > MAX_ENTRY_LENGTH) return;
    const oldest = reports.keys().next().value;
    if (reports.size >= MAX_ENTRIES && oldest !== undefined) reports.delete(oldest);
    reports.set(key, value);
  },
};

export function removeOldReportCaches() {
  cleanup ??= (async () => {
    const keys = await AsyncStorage.getAllKeys();
    const reportKeys = keys.filter(key =>
      key === '@home_dashboard_cache' ||
      key === '@participant_registry_cache' || key.startsWith('@participant_registry_cache:') ||
      key === '@evaluation_analytics_cache' || key.startsWith('@evaluation_analytics_cache:') ||
      key.startsWith('@whitelist_cache_') || key.startsWith('@poster_whitelist_cache_'),
    );
    if (reportKeys.length) await AsyncStorage.multiRemove(reportKeys);
  })().catch(() => {});
  return cleanup;
}
