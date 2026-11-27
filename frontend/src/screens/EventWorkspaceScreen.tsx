import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Image, Keyboard, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Calendar, ChevronRight } from 'lucide-react-native';
import { Button, Input } from '../components/ui';
import { calendarDay, newEventRequestId, workspaceRequest } from '../lib/eventWorkspace';
import { type SelectedEvent, useEventSelection } from '../lib/eventSelection';
import { styles } from '../components/eventSettingsStyles';

export default function EventWorkspaceScreen({ navigation }: any) {
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 350 || fontScale > 1.4;
  const { top } = useSafeAreaInsets();
  const { selectedEvent, selectEvent } = useEventSelection();
  const [events, setEvents] = useState<SelectedEvent[]>([]);
  const [archived, setArchived] = useState(false);
  const [draft, setDraft] = useState<{ id: string; name: string; date: Date | null } | null>(null);
  const [datePicker, setDatePicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);
  const [listError, setListError] = useState('');
  const [error, setError] = useState('');
  const savingRef = useRef(false);

  useFocusEffect(useCallback(() => {
    let current = true;
    setLoading(true);
    setListError('');
    workspaceRequest<SelectedEvent[]>()
      .then(rows => { if (current) { setEvents(rows); } })
      .catch(cause => { if (current) setListError(cause.message || 'Could not load events.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [revision]));

  const create = async () => {
    if (savingRef.current || !draft?.date || !draft.name.trim()) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      const event = await workspaceRequest<SelectedEvent>('', {
        id: draft.id, name: draft.name.trim(), event_date: calendarDay(draft.date),
      });
      selectEvent(event);
      setDraft(null);
      navigation.navigate('Config', { section: 'setup', showParticipants: false });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the event.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const visibleEvents = events.filter(event => (event.lifecycle === 'archived') === archived);

  const openEvent = (event: SelectedEvent) => {
    selectEvent(event);
    if (event.lifecycle === 'draft') navigation.navigate('Config', { section: 'setup', showParticipants: false });
    else navigation.navigate('Home');
  };

  return <View style={[styles.container, { paddingTop: top }]}>
    <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets
      contentContainerStyle={[ui.page, { paddingHorizontal: width < 370 ? 16 : 24 }]}>
      <View style={ui.header}>
        <Image source={require('../../assets/icon.png')} style={styles.headerLogo} resizeMode="contain" />
        <View style={ui.copy}>
          <Text accessibilityRole="header" style={styles.headerTitle}>Events</Text>
          {selectedEvent && <Text style={ui.secondary}>Selected: {selectedEvent.name}</Text>}
        </View>
      </View>
      {draft ? <View style={[styles.card, ui.form]}>
        <Text accessibilityRole="header" style={[styles.cardTitle, ui.formTitle]}>New Event</Text>
        <Input label="Event name" placeholder="Enter event name" value={draft.name} autoCapitalize="words"
          editable={!saving} onChangeText={name => setDraft(current => current && ({ ...current, name }))} />
        <Text style={ui.label}>Event date</Text>
        <TouchableOpacity style={ui.dateField} disabled={saving}
          onPress={() => { Keyboard.dismiss(); setDatePicker(true); }} accessibilityRole="button"
          accessibilityLabel={`Event date, ${draft.date ? draft.date.toLocaleDateString() : 'choose a date'}`}>
          <Calendar size={20} color="#93c5fd" />
          <Text style={[ui.copy, ui.fieldText]}>{draft.date ? draft.date.toLocaleDateString(undefined, {
            month: 'long', day: 'numeric', year: 'numeric',
          }) : 'Choose an event date'}</Text>
          <ChevronRight size={18} color="#94a3b8" />
        </TouchableOpacity>
        {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
        <View style={ui.actions}>
          <Button title={saving ? 'Creating…' : 'Create Event'} disabled={saving || !draft.date || !draft.name.trim()} onPress={create} />
          <Button title="Cancel" variant="secondary" disabled={saving} onPress={() => { setDraft(null); setError(''); }} />
        </View>
      </View> : <>
        <Button title="New Event" onPress={() => { setError(''); setDraft({ id: newEventRequestId(), name: '', date: null }); }} />
        <View style={[styles.tabBar, ui.tabs]}>
          {[false, true].map(value => <TouchableOpacity key={String(value)} accessibilityRole="tab"
            accessibilityState={{ selected: archived === value }} onPress={() => setArchived(value)}
            style={[styles.tab, ui.tab, archived === value && styles.activeTab]}>
            <Text style={[styles.tabText, ui.tabText, archived === value && styles.activeTabText]}>{value ? 'Archived' : 'Current'}</Text>
          </TouchableOpacity>)}
        </View>
        {loading ? <ActivityIndicator accessibilityLabel="Loading events" style={ui.empty} color="#60a5fa" /> :
          <View style={[styles.card, ui.list]}>
            {listError ? <View style={ui.empty}>
              <Text accessibilityRole="alert" style={ui.error}>{listError}</Text>
              <Button title="Try again" variant="secondary" onPress={() => setRevision(value => value + 1)} />
            </View> : visibleEvents.length ? visibleEvents.map((event, index) => {
              const date = new Date((event.event_date || '').slice(0, 10) + 'T12:00:00');
              const hasDate = Number.isFinite(date.getTime());
              const selected = selectedEvent?.id === event.id;
              const status = { draft: 'Draft', active: 'Active', archived: 'Archived' }[event.lifecycle];
              const metadata = [status, selected && 'Selected'].filter(Boolean).join(' · ');
              return <TouchableOpacity key={event.id} accessibilityRole="button"
                accessibilityState={{ selected }} accessibilityLabel={[event.name, hasDate && date.toLocaleDateString(), metadata].filter(Boolean).join(', ')}
                onPress={() => openEvent(event)} style={[ui.row, index > 0 && ui.divider]}>
                {!compact && hasDate && <View style={ui.dateTile}>
                  <Text style={ui.month}>{date.toLocaleDateString(undefined, { month: 'short' })}</Text>
                  <Text style={ui.day}>{date.getDate()}</Text>
                </View>}
                <View style={ui.copy}>
                  <Text style={styles.menuItemTitle}>{event.name}</Text>
                  <Text style={ui.secondary}>{[hasDate && (compact ? date.toLocaleDateString() : date.getFullYear()), metadata].filter(Boolean).join(' · ')}</Text>
                </View>
                <ChevronRight size={18} color="#94a3b8" />
              </TouchableOpacity>;
            }) : <View style={ui.empty}>
              <Calendar size={24} color="#93c5fd" />
              <Text style={styles.menuItemTitle}>{archived ? 'No archived events.' : 'No current events.'}</Text>
            </View>}
          </View>}
      </>}
    </ScrollView>
    <DateTimePickerModal isVisible={datePicker} mode="date" date={draft?.date ?? new Date()}
      onConfirm={date => { setDatePicker(false); setDraft(current => current && ({ ...current, date })); }}
      onCancel={() => setDatePicker(false)} />
  </View>;
}

const ui = StyleSheet.create({
  page: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingBottom: 28 },
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 24 },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  secondary: { color: '#a5b4c8', fontSize: 14 },
  tabs: { marginTop: 20, marginHorizontal: 0, marginBottom: 16 },
  tab: { minHeight: 48, justifyContent: 'center' },
  tabText: { color: '#a5b4c8', fontSize: 14, textAlign: 'center' },
  list: { padding: 0, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 72, padding: 16 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#334155' },
  dateTile: { minWidth: 54, padding: 6, alignItems: 'center', backgroundColor: '#172b49', borderRadius: 12 },
  month: { color: '#bfdbfe', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  day: { color: '#eff6ff', fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  empty: { padding: 20, gap: 14, alignItems: 'stretch' },
  form: { padding: 20 },
  formTitle: { marginBottom: 20 },
  label: { color: '#94a3b8', fontSize: 14, fontWeight: '500', marginBottom: 8, marginLeft: 4 },
  dateField: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, padding: 14,
    borderRadius: 16, backgroundColor: '#0f172a', borderColor: '#334155', borderWidth: 1 },
  fieldText: { color: '#e2e8f0', fontSize: 16 },
  actions: { gap: 10, marginTop: 24 },
  error: { color: '#fca5a5', fontSize: 14, marginVertical: 8 },
});
