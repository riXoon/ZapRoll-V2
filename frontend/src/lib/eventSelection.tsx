import React, { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SelectedEvent = {
  id: string;
  name: string;
  event_date: string;
  timezone: string;
  lifecycle: 'draft' | 'active' | 'archived';
  event_mode: 'legacy' | 'scheduled';
  registration_opens_at: string | null;
  pre_reg_deadline: string | null;
};

const EventSelection = createContext<{
  selectedEvent: SelectedEvent | null;
  selectEvent: (event: SelectedEvent) => void;
}>({ selectedEvent: null, selectEvent: () => {} });

export function EventSelectionProvider({ children, userId }: React.PropsWithChildren<{ userId: string }>) {
  const [selectedEvent, setSelectedEvent] = useState<SelectedEvent | null>(null);
  const [restoring, setRestoring] = useState(true);
  const selectionKey = `@zaproll_selected_event:${process.env.EXPO_PUBLIC_SUPABASE_URL}:${userId}`;

  useEffect(() => {
    let current = true;
    AsyncStorage.getItem(selectionKey).then(value => {
      const event = value && JSON.parse(value);
      if (current && event?.id && ['legacy', 'scheduled'].includes(event.event_mode)) setSelectedEvent(event);
    }).catch(() => {}).finally(() => { if (current) setRestoring(false); });
    return () => { current = false; };
  }, [selectionKey]);

  const selectEvent = (event: SelectedEvent) => {
    const { id, name, event_date, timezone, lifecycle, event_mode, registration_opens_at, pre_reg_deadline } = event;
    const selection = { id, name, event_date, timezone, lifecycle, event_mode, registration_opens_at, pre_reg_deadline };
    setSelectedEvent(selection);
    void AsyncStorage.setItem(selectionKey, JSON.stringify(selection)).catch(() => {});
  };

  if (restoring) return <View style={{ flex: 1, backgroundColor: '#020617', justifyContent: 'center' }}>
    <ActivityIndicator color="#3b82f6" />
  </View>;
  return <EventSelection.Provider value={{ selectedEvent, selectEvent }}>{children}</EventSelection.Provider>;
}

export const useEventSelection = () => useContext(EventSelection);
