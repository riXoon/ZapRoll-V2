/// <reference types="jest" />

import React from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import EventWorkspaceScreen from '../EventWorkspaceScreen';
import { useEventSelection } from '../../lib/eventSelection';
import { workspaceRequest } from '../../lib/eventWorkspace';

jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0 }) }));
jest.mock('lucide-react-native', () => ({ Calendar: () => null, Check: () => null, ChevronRight: () => null, Plus: () => null, Search: () => null }));
jest.mock('../../lib/eventSelection', () => ({ useEventSelection: jest.fn() }));
jest.mock('../../lib/eventWorkspace', () => ({
  calendarDay: () => '2026-12-01',
  newEventRequestId: () => 'event-request-id',
  workspaceRequest: jest.fn(),
}));
jest.mock('react-native-modal-datetime-picker', () => {
  const { Pressable, Text } = require('react-native');
  return ({ isVisible, onConfirm }: any) => isVisible ? (
    <Pressable onPress={() => onConfirm(new Date(2026, 11, 1))}><Text>Confirm test date</Text></Pressable>
  ) : null;
});

test.each([[320, 2], [390, 1], [768, 1]])('opens the selected archive at width %i and font scale %i', async (width, fontScale) => {
  const dimensions = jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({ width, height: 800, scale: 2, fontScale });
  try {
    jest.mocked(useFocusEffect).mockImplementation(callback => React.useEffect(callback, [callback]));
    const event = { id: 'synergy', name: 'Synergy School Research Symposium', lifecycle: 'archived', event_date: '2026-03-10' };
    const selectEvent = jest.fn();
    const navigate = jest.fn();
    jest.mocked(useEventSelection).mockReturnValue({ selectedEvent: null, selectEvent });
    jest.mocked(workspaceRequest).mockResolvedValue([event]);
    render(<EventWorkspaceScreen navigation={{ navigate }} />);
    await screen.findByText('No current events.');
    fireEvent.press(screen.getByRole('tab', { name: 'Archived' }));
    const tile = screen.queryByText('10');
    if (width === 320) expect(tile).toBeNull();
    else expect(tile).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: /Synergy School Research Symposium/ }));
    expect(selectEvent).toHaveBeenCalledWith(event);
    expect(navigate).toHaveBeenCalledWith('Analytics');
  } finally {
    dimensions.mockRestore();
    jest.mocked(useFocusEffect).mockReset();
  }
});

test('searches current events without changing the selected event', async () => {
  jest.mocked(useFocusEffect).mockImplementation(callback => React.useEffect(callback, [callback]));
  const selectedEvent = {
    id: 'summit', name: 'CCS Summit', lifecycle: 'active', event_mode: 'scheduled', event_date: '2026-12-02',
    timezone: 'Asia/Manila', registration_opens_at: null, pre_reg_deadline: null,
  } as const;
  const selectEvent = jest.fn();
  jest.mocked(useEventSelection).mockReturnValue({ selectedEvent, selectEvent });
  jest.mocked(workspaceRequest).mockResolvedValue([selectedEvent, { ...selectedEvent, id: 'science', name: 'Science Fair' }]);
  try {
    render(<EventWorkspaceScreen navigation={{ navigate: jest.fn() }} />);
    fireEvent.changeText(await screen.findByLabelText('Search events'), 'science');
    expect(screen.getByText('Science Fair')).toBeTruthy();
    expect(screen.queryByText('CCS Summit')).toBeNull();
    expect(selectEvent).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByLabelText('Search events'), 'unknown');
    fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByText('CCS Summit')).toBeTruthy();
  } finally {
    jest.mocked(useFocusEffect).mockReset();
  }
});

test('creating an event sends only the name and date and opens Event Setup', async () => {
  const selectEvent = jest.fn();
  const navigate = jest.fn();
  const created = { id: 'new-event', name: 'Research Week', event_date: '2026-12-01', lifecycle: 'draft' };
  jest.mocked(useEventSelection).mockReturnValue({ selectedEvent: null, selectEvent });
  jest.mocked(workspaceRequest).mockResolvedValue(created);

  render(<EventWorkspaceScreen navigation={{ navigate }} />);
  fireEvent.press(screen.getByText('New Event'));
  fireEvent.changeText(screen.getByPlaceholderText('Enter event name'), 'Research Week');
  fireEvent.press(screen.getByText('Choose an event date'));
  fireEvent.press(screen.getByText('Confirm test date'));
  fireEvent.press(screen.getByText('Create Event'));

  await waitFor(() => expect(navigate).toHaveBeenCalledWith('Config', { section: 'setup', showParticipants: false }));
  expect(workspaceRequest).toHaveBeenCalledWith('', {
    id: 'event-request-id', name: 'Research Week', event_date: '2026-12-01',
  });
  expect(selectEvent).toHaveBeenCalledWith(created);
});
