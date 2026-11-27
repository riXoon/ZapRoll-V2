/// <reference types="jest" />
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ScheduledEventSettings from '../ScheduledEventSettings';
import { workspaceRequest } from '../../lib/eventWorkspace';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));
jest.mock('../../lib/eventWorkspace', () => ({
  workspaceRequest: jest.fn(), newEventRequestId: () => 'role-id',
  calendarDay: (date: Date) => [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map(value => String(value).padStart(2, '0')).join('-'),
}));
jest.mock('../../lib/eventSelection', () => ({ useEventSelection: () => ({ selectEvent: jest.fn() }) }));
jest.mock('react-native-modal-datetime-picker', () => {
  const { Pressable, Text } = require('react-native');
  return ({ isVisible, mode, date, onConfirm }: {
    isVisible: boolean; mode: string; date: Date; onConfirm: (date: Date) => void;
  }) => isVisible ? <>
    <Pressable onPress={() => onConfirm(mode === 'date' ? date : new Date(2040, 0, 1, 8, 0))}>
      <Text>{mode} picker</Text>
    </Pressable>
    {mode === 'time' && <Pressable onPress={() => onConfirm(new Date(2040, 0, 1, 8, 30))}>
      <Text>Choose 08:30</Text>
    </Pressable>}
  </> : null;
});
jest.mock('expo-sharing', () => ({}));
jest.mock('lucide-react-native', () => Object.fromEntries(
  ['Calendar', 'ChevronRight', 'Clock', 'LayoutDashboard', 'Users', 'Plus', 'Star', 'ClipboardCheck', 'Save', 'QrCode', 'MapPin', 'Pencil', 'Download']
    .map(name => [name, () => null]),
));
jest.mock('expo-file-system/legacy', () => ({}));

test('Pre-Reg builder opens the selected role from the standalone builder card', async () => {
  const event = { id: 'school', name: 'Science Fair', event_date: '2026-12-01', timezone: 'Asia/Manila',
    event_mode: 'scheduled', lifecycle: 'draft', registration_opens_at: null, pre_reg_deadline: null } as const;
  const roles = ['Students', 'Faculty'].map(name => ({
    id: name.toLowerCase(), name, registration_capacity: 20, required_fields: [], student_priority: false,
  }));
  const navigate = jest.fn();
  jest.mocked(workspaceRequest).mockResolvedValueOnce({ event, roles, venues: [], sessions: [] });
  render(<ScheduledEventSettings event={event} navigation={{ navigate } as never} activeTab="pre-reg" />);
  expect(await screen.findByText('Pre-Reg Form Builder')).toBeTruthy();
  expect(screen.queryByText('Choose a role')).toBeNull();
  fireEvent.press(screen.getByText('Design Pre-Registration Form'));
  fireEvent.press(screen.getByRole('button', { name: 'Faculty' }));
  expect(navigate).toHaveBeenCalledWith('EvaluationForm', {
    eventId: 'school', eventName: 'Science Fair', roleId: 'faculty', roleName: 'Faculty',
  });
});

test('pre-registration shows one QR when the event has a shared form link', async () => {
  const event = { id: 'summit', name: 'CCS Summit', event_date: '2026-12-02', timezone: 'Asia/Manila',
    event_mode: 'scheduled', lifecycle: 'draft', registration_opens_at: null, pre_reg_deadline: null } as const;
  const url = 'https://forms.example.edu/forms/summit?type=pre-registration';
  const roles = ['Student', 'Alumni'].map(name => ({
    id: name.toLowerCase(), name, registration_capacity: 20, required_fields: [], student_priority: false,
    registration_url: url, qr_url: null,
  }));
  jest.mocked(workspaceRequest).mockResolvedValue({ event, roles, venues: [], sessions: [], pre_registration_url: url });
  const navigate = jest.fn();
  render(<ScheduledEventSettings event={event} navigation={{ navigate } as never} activeTab="pre-reg" />);

  fireEvent.press(await screen.findByLabelText('Pre-registration QR code'));
  expect(screen.queryByLabelText('Pre-registration QR')).toBeNull();
  expect(navigate).toHaveBeenCalledWith('QRGenerator', expect.objectContaining({ url }));
});

test('Registration builder opens the selected session in attendance mode', async () => {
  const event = { id: 'school', name: 'Science Fair', event_date: '2026-12-01', timezone: 'Asia/Manila',
    event_mode: 'scheduled', lifecycle: 'draft', registration_opens_at: null, pre_reg_deadline: null } as const;
  const navigate = jest.fn();
  const session = { id: 'morning', venue_id: 'hall', title: 'Morning check-in', capacity: 20,
    starts_at: '2026-12-01T00:00:00Z', ends_at: '2026-12-01T00:30:00Z' };
  jest.mocked(workspaceRequest).mockResolvedValueOnce({
    event, roles: [], venues: [{ id: 'hall', name: 'Auditorium' }], sessions: [session],
  });
  render(<ScheduledEventSettings event={event} navigation={{ navigate } as never} activeTab="event-day" />);
  fireEvent.press(await screen.findByText('Design Attendance Form'));
  fireEvent.press(screen.getByRole('button', { name: /Morning check-in.*Auditorium/ }));
  expect(navigate).toHaveBeenCalledWith('EvaluationForm', expect.objectContaining({
    eventId: 'school', sessionId: 'morning', formType: 'attendance',
  }));
});

test('edits a venue inline and saves its role limits for the selected event', async () => {
  const event = { id: 'school', name: 'Science Fair', event_date: '2026-12-01', timezone: 'Asia/Manila',
    event_mode: 'scheduled', lifecycle: 'draft', registration_opens_at: null, pre_reg_deadline: null } as const;
  const venue = { id: 'hall', name: 'Main Hall', capacity: 50, role_caps: { student: 40 } };
  const workspace = { event, venues: [venue], roles: [{ id: 'student', name: 'Students', registration_capacity: 40, required_fields: [], student_priority: false }], sessions: [] };
  jest.mocked(workspaceRequest).mockResolvedValueOnce(workspace).mockResolvedValueOnce({})
    .mockResolvedValue({ ...workspace, venues: [{ ...venue, capacity: 60, role_caps: { student: 55 } }] });
  render(<ScheduledEventSettings event={event} navigation={{} as never} activeTab="setup" />);
  fireEvent.press(await screen.findByLabelText('Edit Main Hall'));
  expect(screen.getByText('Event Days')).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Total venue capacity'), '60');
  fireEvent.changeText(screen.getByLabelText('Students capacity'), '55');
  fireEvent.press(screen.getByText('Save venue'));
  expect(await screen.findByText('Students · 55')).toBeTruthy();
  expect(workspaceRequest).toHaveBeenCalledWith('/school/actions/venue', {
    id: 'hall', name: 'Main Hall', capacity: 60, role_caps: { student: 55 },
  });
});

test('adds a second event day and saves a session using only time pickers', async () => {
  const event = { id: 'school', name: 'Science Fair', event_date: '2026-12-01', timezone: 'Asia/Manila',
    event_mode: 'scheduled', lifecycle: 'draft', registration_opens_at: null, pre_reg_deadline: null } as const;
  const venue = { id: 'hall', name: 'Auditorium', capacity: 50, role_caps: { student: 40 } };
  const workspace = { event, venues: [venue], roles: [{ id: 'student', name: 'Students', registration_capacity: 40, required_fields: [], student_priority: false }], sessions: [] };
  jest.mocked(workspaceRequest).mockResolvedValueOnce(workspace).mockResolvedValueOnce({}).mockResolvedValue(workspace);
  render(<ScheduledEventSettings event={event} navigation={{} as never} activeTab="setup" />);
  fireEvent.press(await screen.findByText('Add event day'));
  fireEvent.press(screen.getByText('date picker'));
  fireEvent.press(screen.getByText('Add session to Day 2'));
  fireEvent.changeText(screen.getByLabelText('Session title'), 'Auditorium Registration');
  fireEvent.press(screen.getByRole('radio', { name: 'Auditorium' }));
  fireEvent.press(screen.getByLabelText('Session starts'));
  fireEvent.press(screen.getByText('time picker'));
  fireEvent.press(screen.getByLabelText('Session ends'));
  fireEvent.press(screen.getByText('Choose 08:30'));
  fireEvent.press(screen.getByText('Save session'));
  await waitFor(() => expect(workspaceRequest).toHaveBeenCalledWith('/school/actions/session', expect.objectContaining({
    venue_id: 'hall', starts_at: '2026-12-02T00:00:00.000Z', ends_at: '2026-12-02T00:30:00.000Z',
    checkin_opens_at: '2026-12-02T00:00:00.000Z', walkins_open_at: '2026-12-02T00:30:00.000Z',
    attendance_url: '',
  })));
});

test('a draft opens with inline identity settings and empty event-specific configuration', async () => {
  const event = { id: 'school', name: 'Science Fair', event_date: '2026-12-01', timezone: 'Asia/Manila',
    event_mode: 'scheduled', lifecycle: 'draft', registration_opens_at: null, pre_reg_deadline: null } as const;
  const workspace = { event, roles: [], venues: [], sessions: [] };
  jest.mocked(workspaceRequest).mockResolvedValueOnce(workspace)
    .mockResolvedValueOnce({ ...event, name: 'Research Fair' }).mockResolvedValue(workspace);
  const props = { event, navigation: {} as never };
  const view = render(<ScheduledEventSettings {...props} activeTab="setup" />);
  await screen.findByText('Event Identity');
  expect(screen.getByDisplayValue('Science Fair')).toBeTruthy();
  expect(screen.queryByLabelText('Pre-registration open')).toBeNull();
  fireEvent.changeText(screen.getByLabelText('Event Name'), 'Research Fair');
  fireEvent.press(screen.getByText('Save Configuration'));
  await waitFor(() => expect(workspaceRequest).toHaveBeenCalledWith('/school/actions/settings', {
    name: 'Research Fair', event_date: event.event_date, registration_opens_at: null, pre_reg_deadline: null,
  }));
  view.rerender(<ScheduledEventSettings {...props} activeTab="pre-reg" />);
  expect(screen.getByLabelText('Pre-registration open')).toBeTruthy();
  expect(screen.queryByText('Event Identity')).toBeNull();
  view.rerender(<ScheduledEventSettings {...props} activeTab="setup" />);
  expect(screen.getByLabelText('Add venue')).toBeDisabled();
  expect(screen.getByText('No sessions configured.')).toBeTruthy();
  view.rerender(<ScheduledEventSettings {...props} activeTab="post-event" />);
  expect(screen.getByText('Evaluation Forms')).toBeTruthy();
});

test('adds a quota inline, preserves the event identity, and shows pre-registration usage', async () => {
  const event = { id: 'school', name: 'Science Fair', event_date: '2026-12-01', timezone: 'Asia/Manila',
    event_mode: 'scheduled', lifecycle: 'draft', registration_opens_at: null, pre_reg_deadline: null } as const;
  const workspace = { event, roles: [], venues: [], sessions: [] };
  const role = { id: 'role-id', name: 'Faculty', registration_capacity: 20, registration_url: null,
    required_fields: [], student_priority: false, registrations: [{ count: 3 }] };
  jest.mocked(workspaceRequest).mockResolvedValueOnce(workspace).mockResolvedValueOnce(role)
    .mockResolvedValue({ ...workspace, roles: [role] });
  render(<ScheduledEventSettings event={event} navigation={{} as never} activeTab="setup" />);
  fireEvent.press(await screen.findByLabelText('Add participant role'));
  fireEvent.changeText(screen.getByLabelText('Role'), 'Faculty');
  fireEvent.changeText(screen.getByLabelText('Slots'), '20');
  expect(screen.getByDisplayValue('Science Fair')).toBeTruthy();
  fireEvent.press(screen.getByText('Save role'));
  expect(await screen.findByText('17 left')).toBeTruthy();
  expect(workspaceRequest).toHaveBeenCalledWith('/school/actions/role', {
    id: 'role-id', name: 'Faculty', registration_capacity: 20, required_fields: [], student_priority: false,
    registration_url: undefined,
  });
});
