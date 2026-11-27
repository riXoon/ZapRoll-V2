import { API_URL } from '../config/api';
import { supabase } from './supabase';
import { isAuthRetryableFetchError } from '@supabase/supabase-js';

let refreshInFlight: ReturnType<typeof supabase.auth.refreshSession> | undefined;

export async function workspaceRequest<T>(path = '', body?: object): Promise<T> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (isAuthRetryableFetchError(error)) throw new Error('Could not reach the sign-in service. Try again in a moment.');
  if (!session) throw new Error('Sign in to manage events.');
  const send = (token: string) => fetch(`${API_URL}/api/event-workspace${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(body && { 'Content-Type': 'application/json' }) },
    body: body && JSON.stringify(body),
  });
  let response = await send(session.access_token);
  if (response.status === 401) {
    const rejected = await response.json().catch(() => null);
    // The auth middleware rejected the request before calling the route.
    if (rejected?.code !== 'invalid_access_token') throw new Error(rejected?.message || 'Sign in to manage events.');
    const { data: { session: current }, error: currentError } = await supabase.auth.getSession();
    if (isAuthRetryableFetchError(currentError)) throw new Error('Could not reach the sign-in service. Try again in a moment.');
    if (!current || current.user.id !== session.user.id) throw new Error('Your session expired. Sign in again.');
    let token = current.access_token;
    if (token === session.access_token) {
      refreshInFlight ??= supabase.auth.refreshSession().finally(() => { refreshInFlight = undefined; });
      const { data: refreshed, error: refreshError } = await refreshInFlight;
      if (isAuthRetryableFetchError(refreshError)) throw new Error('Could not reach the sign-in service. Try again in a moment.');
      if (!refreshed.session || refreshed.session.user.id !== session.user.id) throw new Error('Your session expired. Sign in again.');
      token = refreshed.session.access_token;
    }
    response = await send(token);
  }
  if (response.ok && response.headers.get('content-type')?.includes('text/csv')) return await response.text() as T;
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.message || 'The event service is unavailable.');
  return result.data;
}

// A request identifier deduplicates a retry. It is unrelated to authentication.
export function newEventRequestId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const digit = Math.floor(Math.random() * 16);
    return (char === 'x' ? digit : (digit & 3) | 8).toString(16);
  });
}

export function calendarDay(date: Date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map(part => String(part).padStart(2, '0')).join('-');
}

export type ScheduledDashboard = {
  preRegistered: number;
  participants: number;
  attendance: number;
  feedback: number;
  roles: { id: string; name: string; count: number }[];
  sessions: { id: string; title: string; venue: string; startsAt: string; capacity: number; count: number }[];
  recent: { id: string; name: string; role: string; checkedInAt: string }[];
};
