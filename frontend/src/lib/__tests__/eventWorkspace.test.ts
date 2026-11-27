/// <reference types="jest" />
import { workspaceRequest } from '../eventWorkspace';
import { supabase } from '../supabase';

jest.mock('../../config/api', () => ({ API_URL: 'https://api.example.test' }));
jest.mock('../supabase', () => ({ supabase: { auth: { getSession: jest.fn(), refreshSession: jest.fn() } } }));

const request = jest.fn();
const originalFetch = globalThis.fetch;
const auth = supabase.auth;

beforeEach(() => {
  jest.resetAllMocks();
  globalThis.fetch = request;
  jest.mocked(auth.getSession).mockResolvedValue({
    data: { session: { access_token: 'old-token', user: { id: 'admin' } } as never },
    error: null,
  });
});

afterEach(() => { globalThis.fetch = originalFetch; });

test('retries an event save once after the middleware rejects its access token', async () => {
  request.mockResolvedValueOnce({ status: 401, json: async () => ({ code: 'invalid_access_token' }) })
    .mockResolvedValueOnce({ status: 200, ok: true, headers: new Headers(), json: async () => ({ data: 'saved' }) });
  jest.mocked(auth.refreshSession).mockResolvedValue({
    data: { session: { access_token: 'fresh-token', user: { id: 'admin' } } as never, user: null },
    error: null,
  });
  await expect(workspaceRequest('/example', { name: 'Example' })).resolves.toBe('saved');
  expect(request).toHaveBeenCalledTimes(2);
  expect(request.mock.calls[1][1]).toMatchObject({
    method: 'POST', headers: { Authorization: 'Bearer fresh-token' }, body: '{"name":"Example"}',
  });
});

test('does not refresh or replay a request when the sign-in service is unavailable', async () => {
  request.mockResolvedValue({ status: 503, ok: false, json: async () => ({
    code: 'auth_unavailable', message: 'Could not reach the sign-in service.',
  }) });
  await expect(workspaceRequest()).rejects.toThrow('Could not reach the sign-in service.');
  expect(auth.refreshSession).not.toHaveBeenCalled();
  expect(request).toHaveBeenCalledTimes(1);
});
