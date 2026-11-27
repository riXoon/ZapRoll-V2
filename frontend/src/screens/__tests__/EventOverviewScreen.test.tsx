/// <reference types="jest" />
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import EventOverviewScreen from '../EventOverviewScreen';
import { type ScheduledDashboard, workspaceRequest } from '../../lib/eventWorkspace';
import type { SelectedEvent } from '../../lib/eventSelection';
import { eventPalette } from '../../components/eventPalette';

// NativeWind skips component interop in Jest unless it is enabled explicitly.
const { setupAllComponents } = require('react-native-css-interop/test');
setupAllComponents();

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0 }) }));
jest.mock('../../lib/eventWorkspace', () => ({ workspaceRequest: jest.fn() }));
jest.mock('../../lib/supabase', () => ({ supabase: { auth: { signOut: jest.fn() } } }));
jest.mock('lucide-react-native', () => Object.fromEntries(
  ['ArrowRight', 'BarChart3', 'CalendarDays', 'ChevronRight', 'ClipboardCheck', 'LogOut', 'Star', 'UserPlus', 'Users']
    .map(name => [name, () => null]),
));

const event: SelectedEvent = {
  id: 'summit', name: 'CCS Summit', event_date: '2026-12-02', timezone: 'Asia/Manila',
  lifecycle: 'draft', event_mode: 'scheduled', registration_opens_at: null, pre_reg_deadline: null,
};
const dashboard: ScheduledDashboard = {
  preRegistered: 12, participants: 14, attendance: 8, feedback: 2, roles: [], recent: [],
  sessions: [
    { id: 'opening', title: 'Opening session', venue: 'Auditorium', startsAt: '2026-12-02T01:00:00Z', capacity: 40, count: 8 },
    { id: 'lab', title: 'Lab workshop', venue: 'Lab', startsAt: '2026-12-03T01:00:00Z', capacity: 20, count: 0 },
  ],
};

beforeEach(() => jest.mocked(workspaceRequest).mockReset());

test('native Home controls retain their colors and horizontal layout', async () => {
  jest.mocked(workspaceRequest).mockResolvedValue(dashboard);
  render(<EventOverviewScreen event={event} navigation={{} as never} mode="home" />);
  await screen.findByText('Total registrations');

  expect(screen.getByRole('button', { name: 'Continue setup' })).toHaveStyle({
    backgroundColor: eventPalette.primary, flexDirection: 'row', alignItems: 'center',
  });
  expect(screen.getByRole('button', { name: 'Change event' })).toHaveStyle({
    flexDirection: 'row', alignItems: 'center',
  });
  expect(screen.getByRole('button', { name: 'Sign out' })).toHaveStyle({
    backgroundColor: eventPalette.surface, justifyContent: 'center',
  });
  expect(screen.getByRole('button', { name: 'Pre-registration' })).toHaveStyle({
    flexDirection: 'row', alignItems: 'center',
  });
});

test.each([
  ['draft', 'Continue setup', ['Config', { section: 'setup', showParticipants: false }]],
  ['active', 'Manage check-in', ['Config', { section: 'event-day', showParticipants: false }]],
  ['archived', 'View reports', ['Analytics']],
] as const)('Home shows the primary action for a %s event', async (lifecycle, label, destination) => {
  jest.mocked(workspaceRequest).mockResolvedValue(dashboard);
  const navigate = jest.fn();
  render(<EventOverviewScreen event={{ ...event, lifecycle }} navigation={{ navigate } as never} mode="home" />);
  await screen.findByText('Total registrations');
  fireEvent.press(screen.getByRole('button', { name: label }));
  expect(navigate).toHaveBeenCalledWith(...destination);
});

test('attendance filters change the session list while keeping event totals visible', async () => {
  jest.mocked(workspaceRequest).mockResolvedValue(dashboard);
  render(<EventOverviewScreen event={event} navigation={{} as never} mode="analytics" />);
  expect(await screen.findByText('Lab workshop')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Attendance exports' })).toHaveStyle({
    flexDirection: 'row', alignItems: 'center',
  });
  fireEvent.press(screen.getByRole('tab', { name: 'Auditorium' }));
  expect(screen.queryByText('Lab workshop')).toBeNull();
  expect(screen.getByText('Opening session')).toBeTruthy();
  expect(screen.getByText('Total registrations')).toBeTruthy();
  fireEvent.press(screen.getByRole('tab', { name: 'All venues' }));
  expect(screen.getByText('Lab workshop')).toBeTruthy();
});

test('a failed dashboard load shows an inline retry and recovers', async () => {
  jest.mocked(workspaceRequest).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(dashboard);
  render(<EventOverviewScreen event={event} navigation={{} as never} mode="home" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load event totals.');
  expect(screen.queryByText('Total registrations')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('Total registrations')).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
});

test('Home previews three sessions in time order and opens the full check-in schedule', async () => {
  const sessions = [4, 2, 3, 1].map(hour => ({
    ...dashboard.sessions[0], id: String(hour), title: 'Session ' + hour,
    startsAt: new Date(Date.UTC(2026, 11, 2, hour)).toISOString(),
  }));
  jest.mocked(workspaceRequest).mockResolvedValue({ ...dashboard, sessions });
  const navigate = jest.fn();
  render(<EventOverviewScreen event={event} navigation={{ navigate } as never} mode="home" />);

  const showSchedule = await screen.findByRole('button', { name: 'View all sessions' });
  expect(screen.getAllByText(/^Session [123]$/).map(session => session.props.children))
    .toEqual(['Session 1', 'Session 2', 'Session 3']);
  expect(screen.queryByText('Session 4')).toBeNull();
  fireEvent.press(showSchedule);
  expect(navigate).toHaveBeenCalledWith('Config', { section: 'event-day', showParticipants: false });
});
