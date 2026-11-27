import { eventPalette as palette } from '../components/eventPalette';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Calendar, Check, ChevronRight, Plus, Search } from 'lucide-react-native';
import { Button, Input } from '../components/ui';
import { calendarDay, newEventRequestId, workspaceRequest } from '../lib/eventWorkspace';
import { type SelectedEvent, useEventSelection } from '../lib/eventSelection';
import { styles } from '../components/eventSettingsStyles';
import { eventLayout } from '../components/eventLayout';

export default function EventWorkspaceScreen({ navigation }: any) {
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 350 || fontScale > 1.4;
  const { top } = useSafeAreaInsets();
  const { selectedEvent, selectEvent } = useEventSelection();
  const [events, setEvents] = useState<SelectedEvent[]>([]);
  const [archived, setArchived] = useState(false);
  const [query, setQuery] = useState('');
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
      .catch(cause => { if (current) setListError(cause instanceof Error ? cause.message : 'Could not load events.'); })
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

  const matchingEvents = events.filter(event => (event.lifecycle === 'archived') === archived);
  const search = query.trim().toLowerCase();
  const visibleEvents = matchingEvents.filter(event => event.name.toLowerCase().includes(search))
    .sort((left, right) => Number(right.id === selectedEvent?.id) - Number(left.id === selectedEvent?.id));
  const refresh = () => setRevision(value => value + 1);

  const openEvent = (event: SelectedEvent) => {
    selectEvent(event);
    if (event.lifecycle === 'draft') navigation.navigate('Config', { section: 'setup', showParticipants: false });
    else if (event.lifecycle === 'archived') navigation.navigate('Analytics');
    else navigation.navigate('Home');
  };

  return <View style={[styles.container, { paddingTop: top }]}>
    <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets
      refreshControl={draft ? undefined : <RefreshControl refreshing={loading && !!events.length} onRefresh={refresh} tintColor="#a9caff" />}
      contentContainerStyle={[eventLayout.frame, ui.page]}>
      <View style={ui.header}>
        <View style={ui.copy}>
          <Text accessibilityRole="header" style={eventLayout.title}>Events</Text>
        </View>
        {!draft && <TouchableOpacity accessibilityRole="button" onPress={() => { setError(''); setDraft({ id: newEventRequestId(), name: '', date: null }); }}
          style={ui.newEvent}>
          <Plus size={17} color="#fff" /><Text style={ui.newEventText}>New Event</Text>
        </TouchableOpacity>}
      </View>
      {draft ? <View style={[styles.card, ui.form]}>
        <Text accessibilityRole="header" style={[styles.cardTitle, ui.formTitle]}>New Event</Text>
        <Input label="Event name" placeholder="Enter event name" value={draft.name} autoCapitalize="words"
          editable={!saving} autoFocus onChangeText={name => setDraft(current => current && ({ ...current, name }))} />
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
        <View accessibilityRole="tablist" style={[styles.tabBar, ui.tabs]}>
          {[false, true].map(value => <TouchableOpacity key={String(value)} accessibilityRole="tab"
            accessibilityState={{ selected: archived === value }} onPress={() => setArchived(value)}
            style={[styles.tab, ui.tab, archived === value && ui.activeTab]}>
            <Text style={[styles.tabText, ui.tabText, archived === value && ui.activeTabText]}>{value ? 'Archived' : 'Current'}</Text>
          </TouchableOpacity>)}
        </View>
        {(events.length > 1 || query.length > 0) && <View style={ui.search}>
          <Search size={18} color="#a9caff" />
          <TextInput accessibilityLabel="Search events" placeholder="Search events" placeholderTextColor="#a5b4c8"
            value={query} onChangeText={setQuery} style={ui.searchInput} autoCorrect={false} returnKeyType="search" />
          {!!query && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} style={ui.clearSearch}>
            <Text style={ui.selectedLabel}>Clear</Text>
          </TouchableOpacity>}
        </View>}
        {!!listError && <View style={[styles.card, ui.errorBox]}>
              <Text accessibilityRole="alert" style={ui.error}>{listError}</Text>
              <Button title="Try again" variant="secondary" onPress={refresh} />
            </View>}
        {loading && !events.length ? <ActivityIndicator accessibilityLabel="Loading events" style={ui.empty} color="#60a5fa" /> :
          (visibleEvents.length > 0 || !listError) && <View style={[styles.card, ui.list]}>
            {visibleEvents.length ? visibleEvents.map((event, index) => {
              const date = new Date((event.event_date || '').slice(0, 10) + 'T12:00:00');
              const hasDate = Number.isFinite(date.getTime());
              const selected = selectedEvent?.id === event.id;
              const status = { draft: 'Draft', active: 'Published', archived: 'Archived' }[event.lifecycle];
              const metadata = [status, selected && 'Selected'].filter(Boolean).join(' · ');
              return <TouchableOpacity key={event.id} accessibilityRole="button"
                accessibilityState={{ selected }} accessibilityLabel={[event.name, hasDate && date.toLocaleDateString(), metadata].filter(Boolean).join(', ')}
                onPress={() => openEvent(event)} style={[ui.row, index > 0 && ui.divider, selected && ui.selectedRow]}>
                {!compact && hasDate && <View style={ui.dateTile}>
                  <Text style={ui.day}>{date.getDate()}</Text>
                  <Text style={ui.month}>{date.toLocaleDateString(undefined, { month: 'short' })}</Text>
                </View>}
                <View style={ui.copy}>
                  <Text style={ui.eventName}>{event.name}</Text>
                  <View style={ui.rowMeta}>
                    <Text style={[ui.badge, event.lifecycle === 'draft' ? ui.draft : event.lifecycle === 'active' ? ui.published : ui.archived]}>{status}</Text>
                    {hasDate && <Text style={ui.secondary}>{compact
                      ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                      : date.getFullYear()}</Text>}
                    {selected && <View style={ui.selection}><Check size={14} color={palette.blue.ink} /><Text style={ui.selectedLabel}>Selected</Text></View>}
                  </View>
                </View>
                <ChevronRight size={18} color={selected ? palette.blue.ink : palette.secondary} />
              </TouchableOpacity>;
            }) : <View style={ui.empty}>
              <View style={ui.emptyIcon}><Calendar size={22} color={palette.blue.ink} /></View>
              <Text style={styles.menuItemTitle}>{search && matchingEvents.length ? 'No events match your search.' : archived ? 'No archived events.' : 'No current events.'}</Text>
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
  page: { paddingBottom: 28 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 14, paddingBottom: 22, gap: 12 },
  newEvent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 48, gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, backgroundColor: palette.primary, maxWidth: '54%' },
  newEventText: { color: palette.text, flexShrink: 1, fontWeight: '700', fontSize: 14 },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  secondary: { color: '#a5b4c8', fontSize: 14 },
  tabs: { marginHorizontal: 0, marginBottom: 14 },
  tab: { minHeight: 48, justifyContent: 'center' },
  activeTab: { backgroundColor: palette.blue.surface },
  activeTabText: { color: palette.blue.ink },
  tabText: { color: '#a5b4c8', fontSize: 14, textAlign: 'center' },
  list: { padding: 0, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 82, padding: 14 },
  selectedRow: { backgroundColor: palette.blue.surface },
  eventName: { color: palette.text, fontSize: 16, fontWeight: '700' },
  selection: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  selectedLabel: { color: palette.blue.ink, fontSize: 13, fontWeight: '700' },
  rowMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  badge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, overflow: 'hidden', fontSize: 12, fontWeight: '700' },
  draft: { color: '#fde5a4', backgroundColor: '#483514' },
  published: { color: '#b6f4da', backgroundColor: '#143e35' },
  archived: { color: '#e0e9f8', backgroundColor: '#25364f' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, backgroundColor: palette.surface, borderColor: '#334155', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, marginBottom: 14 },
  searchInput: { flex: 1, color: '#f8fafc', fontSize: 15, minHeight: 48, paddingVertical: 7 },
  clearSearch: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#334155' },
  dateTile: { minWidth: 54, padding: 6, alignItems: 'center', backgroundColor: palette.canvas, borderRadius: 10 },
  month: { color: palette.blue.ink, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  day: { color: palette.text, fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  empty: { padding: 26, gap: 12, alignItems: 'center' },
  emptyIcon: { width: 46, height: 46, borderRadius: 12, backgroundColor: palette.blue.surface, alignItems: 'center', justifyContent: 'center' },
  form: { padding: 20 },
  formTitle: { marginBottom: 20 },
  label: { color: '#94a3b8', fontSize: 14, fontWeight: '500', marginBottom: 8, marginLeft: 4 },
  dateField: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, padding: 14,
    borderRadius: 16, backgroundColor: '#0f172a', borderColor: '#334155', borderWidth: 1 },
  fieldText: { color: '#e2e8f0', fontSize: 16 },
  actions: { gap: 10, marginTop: 24 },
  error: { color: '#fca5a5', fontSize: 14, marginVertical: 8 },
  errorBox: { padding: 14, marginBottom: 12 },
});
