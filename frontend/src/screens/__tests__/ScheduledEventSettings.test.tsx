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

test('Pre-Reg opens one form editor with all participant categories', async () => {
  const event = { id: 'school', name: 'Science Fair', event_date: '2026-12-01', timezone: 'Asia/Manila',
    event_mode: 'scheduled', lifecycle: 'draft', registration_opens_at: null, pre_reg_deadline: null } as const;
  const roles = ['Students', 'Faculty'].map(name => ({
    id: name.toLowerCase(), name, registration_capacity: 20, required_fields: [], student_priority: false,
  }));
  const navigate = jest.fn();
  jest.mocked(workspaceRequest).mockResolvedValueOnce({ event, roles, venues: [], sessions: [] });
  render(<ScheduledEventSettings event={event} navigation={{ navigate } as never} activeTab="pre-reg" />);
  expect(await screen.findByText('Pre-Registration Form')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Design Pre-Registration Form' }));
  expect(screen.queryByRole('button', { name: 'Faculty' })).toBeNull();
  expect(navigate).toHaveBeenCalledTimes(1);
  expect(navigate).toHaveBeenCalledWith('EvaluationForm', {
    eventId: 'school', eventName: 'Science Fair', formType: 'pre-registration',
    registrationRoles: [{ id: 'students', name: 'Students' }, { id: 'faculty', name: 'Faculty' }],
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
  expect(screen.getAllByLabelText(/QR code$/)).toHaveLength(1);
  expect(navigate).toHaveBeenCalledWith('QRGenerator', expect.objectContaining({ url }));
  fireEvent.press(screen.getByRole('button', { name: 'Design Pre-Registration Form' }));
  expect(navigate).toHaveBeenLastCalledWith('EvaluationForm', expect.objectContaining({
    eventId: 'summit', formType: 'pre-registration',
  }));
});

test('student-only pre-registration opens the Student template directly', async () => {
  const event = {
    id: 'summit', name: 'CCS Summit', event_date: '2026-12-02', timezone: 'Asia/Manila',
    event_mode: 'scheduled', lifecycle: 'active', registration_opens_at: null, pre_reg_deadline: null,
    student_pre_registration_only: true,
  } as const;
  const roles = ['Alumni', 'Student'].map(name => ({
    id: name.toLowerCase(), name, registration_capacity: 20, required_fields: [], student_priority: false,
  }));
  const navigate = jest.fn();
  jest.mocked(workspaceRequest).mockResolvedValueOnce({ event, roles, venues: [], sessions: [] });
  render(<ScheduledEventSettings event={event} navigation={{ navigate } as never} activeTab="pre-reg" />);

  fireEvent.press(await screen.findByRole('button', { name: 'Design Pre-Registration Form' }));
  expect(navigate).toHaveBeenCalledWith('EvaluationForm', expect.objectContaining({
    registrationRoles: [{ id: 'student', name: 'Student' }],
  }));
  expect(screen.queryByText('Alumni')).toBeNull();
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

test('Summit attendance shows one event QR and keeps session controls', async () => {
  const event = { id: 'summit', name: 'CCS Summit', event_date: '2026-12-02', timezone: 'Asia/Manila',
    event_mode: 'scheduled', lifecycle: 'active', registration_opens_at: null, pre_reg_deadline: null } as const;
  const path = '/api/event-workspace/summit/student-checkin';
  const sessions = ['Quiz Bee', 'Technical Competition'].map(title => ({
    id: title, title, starts_at: '2026-12-02T02:15:00Z', ends_at: '2026-12-02T09:00:00Z',
    attendance_open_override: null, attendance_url: 'https://old.example.edu/session',
    attendance_qr_url: 'https://old.example.edu/session',
  }));
  jest.mocked(workspaceRequest).mockResolvedValueOnce({
    event, roles: [], venues: [], sessions, central_attendance_path: path,
  });
  const navigate = jest.fn();
  render(<ScheduledEventSettings event={event} navigation={{ navigate } as never} activeTab="event-day" />);

  fireEvent.press(await screen.findByLabelText('Central student check-in QR code'));
  expect(screen.getAllByLabelText(/QR code$/)).toHaveLength(1);
  expect(screen.getByLabelText('Attendance for Quiz Bee')).toBeEnabled();
  expect(screen.getByLabelText('Attendance for Technical Competition')).toBeEnabled();
  expect(screen.queryByText('Design Attendance Form')).toBeNull();
  expect(navigate).toHaveBeenCalledWith('QRGenerator', expect.objectContaining({
    url: expect.stringContaining(path), type: 'student-checkin',
  }));
});

test('check-in shows the sessions for the selected day', async () => {
  const event = { id: 'summit', name: 'CCS Summit', event_date: '2040-12-02', timezone: 'Asia/Manila',
    event_mode: 'scheduled', lifecycle: 'draft', registration_opens_at: null, pre_reg_deadline: null } as const;
  const sessions = [{ id: 'day-one', title: 'Opening', starts_at: '2040-12-02T00:00:00Z', ends_at: '2040-12-02T01:00:00Z' },
    { id: 'day-two', title: 'Finale', starts_at: '2040-12-03T00:00:00Z', ends_at: '2040-12-03T01:00:00Z' }];
  jest.mocked(workspaceRequest).mockResolvedValueOnce({ event, roles: [], venues: [], sessions });
  render(<ScheduledEventSettings event={event} navigation={{} as never} activeTab="event-day" />);

  expect(await screen.findByText('Opening')).toBeTruthy();
  expect(screen.getByLabelText('Attendance for Opening')).toBeDisabled();
  expect(screen.getByText(/Manual controls require a backend update/)).toBeTruthy();
  expect(screen.queryByText('Finale')).toBeNull();
  fireEvent.press(screen.getAllByRole('tab')[1]);
  expect(screen.getByText('Finale')).toBeTruthy();
  expect(screen.queryByText('Opening')).toBeNull();
});

test('closes one attendance session and restores its scheduled window', async () => {
  const event = { id: 'school', name: 'Science Fair', event_date: '2026-12-01', timezone: 'Asia/Manila',
    event_mode: 'scheduled', lifecycle: 'active', registration_opens_at: null, pre_reg_deadline: null } as const;
  const session = { id: 'morning', venue_id: 'hall', title: 'Morning check-in', capacity: 20,
    starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + 3600000).toISOString(),
    checkin_opens_at: new Date(Date.now() - 3600000).toISOString(), attendance_open_override: null };
  jest.mocked(workspaceRequest).mockResolvedValueOnce({ event, roles: [], venues: [], sessions: [session] })
    .mockResolvedValueOnce({ id: session.id, attendance_open_override: false })
    .mockResolvedValueOnce({ id: session.id, attendance_open_override: null });
  render(<ScheduledEventSettings event={event} navigation={{} as never} activeTab="event-day" />);

  const toggle = await screen.findByLabelText('Attendance for Morning check-in');
  fireEvent(toggle, 'valueChange', false);
  expect(await screen.findByText('Closed · Manual control')).toBeTruthy();
  expect(workspaceRequest).toHaveBeenCalledWith('/school/actions/attendance-status', { id: 'morning', open: false });
  fireEvent.press(screen.getByText('Use schedule'));
  expect(await screen.findByText('Open · Follows schedule')).toBeTruthy();
  expect(workspaceRequest).toHaveBeenCalledWith('/school/actions/attendance-status', { id: 'morning', open: null });
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
  expect(screen.getByText('Event schedule')).toBeTruthy();
  expect(screen.getByDisplayValue('Science Fair')).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Total venue capacity'), '60');
  fireEvent.changeText(screen.getByLabelText('Students capacity'), '55');
  fireEvent.press(screen.getByText('Save venue'));
  expect(await screen.findByText('Students · 55')).toBeTruthy();
  expect(workspaceRequest).toHaveBeenCalledWith('/school/actions/venue', {
    id: 'hall', name: 'Main Hall', capacity: 60, role_caps: { student: 55 },
  });
});

test('student-only Setup shows venue capacity and keeps existing allocations when saved', async () => {
  const event = {
    id: 'summit', name: 'CCS Summit', event_date: '2026-12-02', timezone: 'Asia/Manila',
    event_mode: 'scheduled', lifecycle: 'active', registration_opens_at: null, pre_reg_deadline: null,
    student_pre_registration_only: true,
  } as const;
  const roles = ['Student', 'Alumni'].map(name => ({
    id: name.toLowerCase(), name, registration_capacity: 40, required_fields: [], student_priority: false,
    registrations: [{ count: 6 }],
  }));
  const venue = { id: 'hall', name: 'Auditorium', capacity: 50, role_caps: { student: 25, alumni: 10 } };
  const sessions = [
    { id: 'opening', title: 'Opening', venue_id: venue.id, capacity: 25, checkins: [{ count: 18 }],
      starts_at: '2026-12-02T00:00:00Z', ends_at: '2026-12-02T00:30:00Z' },
    { id: 'finale', title: 'Finale', venue_id: venue.id, capacity: 10, checkins: [{ count: 10 }],
      starts_at: '2026-12-02T01:00:00Z', ends_at: '2026-12-02T01:30:00Z' },
  ];
  const workspace = { event, roles, venues: [venue], sessions };
  jest.mocked(workspaceRequest).mockResolvedValueOnce(workspace).mockResolvedValueOnce({})
    .mockResolvedValueOnce({ ...workspace, venues: [{ ...venue, role_caps: { student: 30, alumni: 10 } }] });
  render(<ScheduledEventSettings event={event} navigation={{} as never} activeTab="setup" />);

  expect(await screen.findByText('Student quota')).toBeTruthy();
  expect(screen.queryByLabelText('Add role')).toBeNull();
  expect(screen.queryByText('Alumni')).toBeNull();
  expect(screen.getByText('35 allocated')).toBeTruthy();
  expect(screen.getByText('15 unallocated')).toBeTruthy();
  expect(screen.getByText('7 seats left')).toBeTruthy();
  expect(screen.getByText('Full')).toBeTruthy();

  fireEvent.press(screen.getByLabelText('Edit Auditorium'));
  expect(screen.queryByLabelText('Alumni capacity')).toBeNull();
  expect(screen.getByText('Up to 40 seats can be allocated to students.')).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Student capacity'), '10');
  fireEvent.changeText(screen.getByLabelText('Total venue capacity'), '20');
  expect(screen.getByText('In Event schedule, lower Opening from 25 to 20 seats or fewer before saving this venue.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Save venue' })).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText('Total venue capacity'), '50');
  fireEvent.changeText(screen.getByLabelText('Student capacity'), '41');
  expect(screen.getByText('Student capacity cannot exceed 40 seats.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Save venue' })).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText('Student capacity'), '30');
  fireEvent.press(screen.getByText('Save venue'));
  expect(await screen.findByText('40 allocated')).toBeTruthy();
  expect(workspaceRequest).toHaveBeenCalledWith('/summit/actions/venue', {
    id: 'hall', name: 'Auditorium', capacity: 50, role_caps: { student: 30, alumni: 10 },
  });
  fireEvent.press(screen.getByLabelText('Edit Opening'));
  expect(screen.getByLabelText('Student capacity')).toBeTruthy();
  expect(screen.queryByLabelText('Alumni capacity')).toBeNull();
});

test('reduces a student venue and its linked sessions in one Setup save', async () => {
  const event = {
    id: 'summit', name: 'CCS Summit', event_date: '2026-12-02', timezone: 'Asia/Manila',
    event_mode: 'scheduled', lifecycle: 'active', registration_opens_at: null, pre_reg_deadline: null,
    student_pre_registration_only: true,
  } as const;
  const venue = { id: 'hall', name: 'Seminar Room', capacity: 500, role_caps: { student: 249 } };
  const session = { id: 'workshop', title: 'Workshop', venue_id: venue.id, capacity: 500, role_caps: { student: 249 },
    starts_at: '2026-12-02T00:00:00Z', ends_at: '2026-12-02T01:00:00Z' };
  const workspace = {
    event, venues: [venue], sessions: [session],
    roles: [{ id: 'student', name: 'Student', registration_capacity: 249, student_priority: true, required_fields: [] }],
  };
  jest.mocked(workspaceRequest).mockResolvedValueOnce(workspace).mockResolvedValueOnce({})
    .mockResolvedValueOnce({
      ...workspace,
      venues: [{ ...venue, capacity: 100, role_caps: { student: 100 } }],
      sessions: [{ ...session, capacity: 100, role_caps: { student: 100 } }],
    });
  render(<ScheduledEventSettings event={event} navigation={{} as never} activeTab="setup" />);

  fireEvent.press(await screen.findByLabelText('Edit Seminar Room'));
  fireEvent.changeText(screen.getByLabelText('Total venue capacity'), '100');
  expect(screen.getByText(/Student allocation to 100 seats/)).toBeTruthy();
  expect(screen.getByText('Workshop · 500 → 100 seats')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Save venue and sessions' }));
  expect(await screen.findByText('100 seats total')).toBeTruthy();
  expect(workspaceRequest).toHaveBeenCalledWith('/summit/actions/venue', {
    id: 'hall', name: 'Seminar Room', capacity: 100, role_caps: { student: 100 },
    expected_venue: { name: venue.name, capacity: 500, role_caps: { student: 249 } },
    affected_sessions: { workshop: { capacity: 500, role_caps: { student: 249 } } },
  });
});

test('shared-capacity Setup edits a venue once and shows the inherited limit in each session', async () => {
  const event = {
    id: 'summit', name: 'CCS Summit', event_date: '2026-12-02', timezone: 'Asia/Manila',
    event_mode: 'scheduled', lifecycle: 'active', registration_opens_at: null, pre_reg_deadline: null,
    student_pre_registration_only: true, shared_venue_capacity: true,
  } as const;
  const venue = { id: 'hall', name: 'Auditorium', capacity: 500, role_caps: { student: 500 } };
  const sessions = ['Morning', 'Afternoon'].map((title, index) => ({
    id: title, title, venue_id: venue.id, capacity: 500, role_caps: { student: 500 }, reserved_students: 0,
    starts_at: `2026-12-02T0${index * 2}:00:00Z`, ends_at: `2026-12-02T0${index * 2 + 1}:00:00Z`,
  }));
  const workspace = {
    event, venues: [venue], sessions,
    roles: [{ id: 'student', name: 'Student', registration_capacity: 249, student_priority: true, required_fields: [] }],
  };
  const updated = {
    ...workspace,
    venues: [{ ...venue, capacity: 100, role_caps: { student: 100 } }],
    sessions: sessions.map(session => ({ ...session, capacity: 100, role_caps: { student: 100 } })),
  };
  jest.mocked(workspaceRequest).mockResolvedValueOnce(workspace).mockResolvedValueOnce({}).mockResolvedValue(updated);
  render(<ScheduledEventSettings event={event} navigation={{} as never} activeTab="setup" />);

  expect(await screen.findByText('Venues and sessions')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Edit Auditorium'));
  expect(screen.queryByLabelText('Student capacity')).toBeNull();
  fireEvent.changeText(screen.getByLabelText('Total venue capacity'), '100');
  fireEvent.press(screen.getByRole('button', { name: 'Save venue' }));
  expect(await screen.findByText('100 seats total')).toBeTruthy();
  expect(workspaceRequest).toHaveBeenCalledWith('/summit/actions/venue', {
    id: 'hall', name: 'Auditorium', capacity: 100, role_caps: { student: 100 },
  });
  for (const title of ['Morning', 'Afternoon']) {
    fireEvent.press(screen.getByLabelText(`Edit ${title}`));
    expect(screen.getByText('100 seats from Auditorium')).toBeTruthy();
    expect(screen.queryByLabelText('Total capacity')).toBeNull();
    expect(screen.queryByLabelText('Student capacity')).toBeNull();
    fireEvent.press(screen.getByText('Cancel'));
  }
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
  await screen.findByText('Event details');
  expect(screen.getByDisplayValue('Science Fair')).toBeTruthy();
  expect(screen.queryByLabelText('Pre-registration open')).toBeNull();
  fireEvent.changeText(screen.getByLabelText('Event Name'), 'Research Fair');
  fireEvent.press(screen.getByText('Save event details'));
  await waitFor(() => expect(workspaceRequest).toHaveBeenCalledWith('/school/actions/settings', {
    name: 'Research Fair', event_date: event.event_date, registration_opens_at: null, pre_reg_deadline: null,
  }));
  view.rerender(<ScheduledEventSettings {...props} activeTab="pre-reg" />);
  expect(screen.getByLabelText('Pre-registration open')).toBeTruthy();
  expect(screen.queryByText('Event details')).toBeNull();
  view.rerender(<ScheduledEventSettings {...props} activeTab="setup" />);
  expect(screen.getByLabelText('Add venue')).toBeDisabled();
  expect(screen.getByText('Add a venue before scheduling a session.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Add session to Day 1' })).toBeDisabled();
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
  fireEvent.press(await screen.findByRole('button', { name: 'Add role' }));
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
