/// <reference types="jest" />

import React from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import EventWorkspaceScreen from '../EventWorkspaceScreen';
import { useEventSelection } from '../../lib/eventSelection';
import { workspaceRequest } from '../../lib/eventWorkspace';

jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0 }) }));
jest.mock('lucide-react-native', () => ({ Calendar: () => null, ChevronRight: () => null }));
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
    expect(navigate).toHaveBeenCalledWith('Home');
  } finally {
    dimensions.mockRestore();
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
