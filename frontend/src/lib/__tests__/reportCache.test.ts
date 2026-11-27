/// <reference types="jest" />

import AsyncStorage from '@react-native-async-storage/async-storage';
import { removeOldReportCaches, reportCache } from '../reportCache';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getAllKeys: jest.fn(),
  multiRemove: jest.fn(),
}));

test('removes old report data once while preserving the Supabase session and other local data', async () => {
  const reportKeys = [
    '@home_dashboard_cache', '@participant_registry_cache:user:event',
    '@evaluation_analytics_cache:user:event', '@whitelist_cache_event',
    '@poster_whitelist_cache_event',
  ];
  jest.mocked(AsyncStorage.getAllKeys).mockResolvedValue([
    ...reportKeys, 'sb-project-auth-token', 'other-local-data',
  ]);

  await Promise.all([removeOldReportCaches(), removeOldReportCaches()]);

  expect(AsyncStorage.getAllKeys).toHaveBeenCalledTimes(1);
  expect(AsyncStorage.multiRemove).toHaveBeenCalledWith(reportKeys);
});

test('does not retain oversized reports or write reports to SQLite', () => {
  reportCache.setItem('example', 'small');
  expect(reportCache.getItem('example')).toBe('small');
  reportCache.setItem('example', 'x'.repeat(256_001));
  expect(reportCache.getItem('example')).toBeNull();
});
