import { eventPalette as palette } from '../components/eventPalette';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { NavigationProp, ParamListBase, useFocusEffect } from '@react-navigation/native';
import { styles as theme } from '../components/eventSettingsStyles';
import { SettingsHeading } from '../components/SettingsHeading';
import { eventLayout } from '../components/eventLayout';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Calendar, ChevronRight, Clock, LayoutDashboard, Users, Plus, Star, ClipboardCheck, Save, QrCode, MapPin, Pencil, Download, type LucideIcon } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { calendarDay, newEventRequestId, workspaceRequest } from '../lib/eventWorkspace';
import { type SelectedEvent, useEventSelection } from '../lib/eventSelection';
import { API_URL } from '../config/api';

type Role = {
  id: string; name: string; registration_capacity: number; student_priority: boolean;
  registration_url: string | null; required_fields: string[];
  registrations?: { count: number }[];
};
type Venue = { id: string; name: string; capacity: number; role_caps: Record<string, number> };
type Session = {
  id: string; title: string; venue_id: string; starts_at: string; ends_at: string;
  checkin_opens_at: string; walkins_open_at: string; capacity: number;
  reserved_students: number; role_caps: Record<string, number>; attendance_url: string | null; feedback_url: string | null;
  attendance_open_override?: boolean | null;
  checkins?: { count: number }[];
  attendance_qr_url: string | null; feedback_qr_url: string | null;
};
type Person = { id: string; full_name: string; email: string; role_id: string; source: string };
type SettingsEvent = SelectedEvent & {
  pre_reg_manual?: boolean; pre_reg_open?: boolean; student_pre_registration_only?: boolean;
  shared_venue_capacity?: boolean;
};
type Workspace = {
  event: SettingsEvent; roles: Role[]; venues: Venue[]; sessions: Session[];
  pre_registration_url?: string | null; central_attendance_path?: string;
};
type Editor = { action: 'settings' | 'role' | 'venue' | 'session' | 'feedback'; values: Record<string, string>; priority?: boolean };
type VenueResize = {
  role_caps: Venue['role_caps'];
  expected_venue: Omit<Venue, 'id'>;
  affected_sessions: Record<string, Pick<Session, 'capacity' | 'role_caps'>>;
};
type PickerMode = 'date' | 'datetime' | 'time';

function dayLabel(day: string) {
  return new Date(day + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function localDateTime(value: string | null, timezone: string) {
  if (!value) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const date = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${date.year}-${date.month}-${date.day} ${date.hour}:${date.minute}`;
}

function manilaInstant(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value)) {
    throw new Error('Enter date and time as YYYY-MM-DD HH:MM (Manila time).');
  }
  const date = new Date(value.replace(' ', 'T') + ':00+08:00');
  if (!Number.isFinite(date.getTime()) || localDateTime(date.toISOString(), 'Asia/Manila') !== value) {
    throw new Error('Enter a valid date and time.');
  }
  return date.toISOString();
}

function count(value?: string) {
  if (!value || !/^\d{1,9}$/.test(value)) throw new Error('Enter whole numbers for all capacity fields.');
  return Number(value);
}

function Action({ title, onPress, disabled, expanded, add }: { title: string; onPress: () => void; disabled?: boolean; expanded?: boolean; add?: boolean }) {
  return <TouchableOpacity accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled: !!disabled }}
    style={[registration.action, add && setupStyles.scheduleAdd, disabled && registration.inactive]} onPress={onPress} aria-expanded={expanded}>
    {add && <Plus color={palette.blue.ink} size={17} />}
    <Text style={registration.actionText}>{title}</Text>
    {!add && <ChevronRight color="#a0b4ce" size={17} style={expanded ? { transform: [{ rotate: '90deg' }] } : undefined} />}
  </TouchableOpacity>;
}

function Card({ title, icon: Icon, children, add, tone = palette.blue, setup }: React.PropsWithChildren<{
  title: string; icon: LucideIcon; tone?: { ink: string; surface: string }; add?: { label: string; run: () => void; disabled?: boolean };
  setup?: boolean;
}>) {
  return <View style={[registration.card, setup && setupStyles.card]}>
    <View style={registration.cardHeader}>
      <View style={[registration.heading, setup && setupStyles.heading]}>
        <View style={[registration.headingIcon, { backgroundColor: tone.surface }]}><Icon color={tone.ink} size={17} /></View>
        <Text accessibilityRole="header" style={[registration.headingText, setup && eventLayout.sectionTitle]}>{title}</Text>
      </View>
      {add && <TouchableOpacity accessibilityLabel={add.label} accessibilityRole="button"
        accessibilityState={{ disabled: !!add.disabled }} disabled={add.disabled}
        style={[registration.addButton, setup && setupStyles.addButton, add.disabled && registration.inactive]} onPress={add.run}>
        <Plus color="#bfdbfe" size={16} />
        <Text style={registration.addText}>{add.label}</Text>
      </TouchableOpacity>}
    </View>
    {children}
  </View>;
}

function SetupEmpty({ children }: React.PropsWithChildren) {
  return <View style={setupStyles.empty}><Text style={setupStyles.description}>{children}</Text></View>;
}

const setupStyles = StyleSheet.create({
  card: { ...eventLayout.panel, padding: 16, marginBottom: 16 },
  heading: { flexBasis: 142 },
  description: { color: palette.secondary, fontSize: 14, lineHeight: 20 },
  addButton: { minHeight: 48, maxWidth: '100%', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: palette.blue.surface },
  empty: { padding: 12, borderRadius: 12, backgroundColor: palette.canvas },
  quotaSummary: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  quotaCell: { flexGrow: 1, flexBasis: 105, minWidth: 0, padding: 12, gap: 3, backgroundColor: palette.canvas, borderRadius: 12 },
  quotaNumber: { color: palette.text, fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
  dateInput: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateValue: { flex: 1 },
  row: { minHeight: 60, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.edge },
  venue: { gap: 12, paddingVertical: 16 },
  capacitySummary: { gap: 6 },
  capacityTrack: { height: 7, backgroundColor: palette.edge, borderRadius: 6, overflow: 'hidden' },
  capacityFill: { height: '100%', borderRadius: 6 },
  venueSessions: { gap: 12, padding: 12, borderRadius: 10, backgroundColor: palette.canvas },
  editor: { gap: 12, padding: 12, backgroundColor: palette.canvas, borderRadius: 12, borderWidth: 1, borderColor: palette.blue.edge },
  dayTitle: { ...eventLayout.sectionTitle, fontSize: 16 },
  daySelected: { borderColor: palette.blue.edge, backgroundColor: palette.blue.surface },
  scheduleAdd: { marginBottom: 0, backgroundColor: palette.blue.surface, paddingVertical: 8 },
  session: { padding: 12, borderRadius: 12, backgroundColor: palette.canvas, gap: 8 },
  sessionMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  status: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, overflow: 'hidden', fontSize: 14, fontWeight: '700', marginBottom: 10 },
});

function CapacityMeter({ used, total, color }: { used: number; total: number; color: string }) {
  const percentage = total > 0 ? Math.min(100, used / total * 100) : 0;
  return <View style={setupStyles.capacityTrack}>
    <View style={[setupStyles.capacityFill, { backgroundColor: color, width: `${percentage}%` }]} />
  </View>;
}

function SaveSettings({ onPress, disabled, title }: { onPress: () => void; disabled: boolean; title: string }) {
  return <TouchableOpacity accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }}
    style={[registration.primary, disabled && registration.inactive]} onPress={onPress}>
    <Save color="white" size={17} /><Text style={registration.primaryText}>{title}</Text>
  </TouchableOpacity>;
}

function FormLink({ value, label, qr, onPress }: {
  value: string | null; label: string; qr: string | null; onPress: (url: string) => void;
}) {
  if (!value) return <Text style={registration.detail}>No form link added</Text>;
  return qr ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={label + ' QR code'}
    onPress={() => onPress(qr)} style={registration.qrAction}>
    <QrCode size={18} color="#bfdbfe" />
    <Text style={registration.addText}>Show QR &amp; link</Text>
  </TouchableOpacity> : <Text selectable style={registration.detail}>{value}</Text>;
}

const registration = StyleSheet.create({
  card: { backgroundColor: palette.surface, borderColor: '#273750', borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 14 },
  cardHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  heading: { flexDirection: 'row', flex: 1, minWidth: 136, alignItems: 'center', gap: 9 },
  headingIcon: { padding: 7, borderRadius: 9, backgroundColor: '#1c3150' },
  headingText: { flexShrink: 1, color: '#f8fafc', fontSize: 17, fontWeight: '700' },
  item: { gap: 10, marginBottom: 12 },
  panel: { padding: 12, backgroundColor: '#0b1424', borderColor: '#24354e', borderWidth: 1, borderRadius: 12 },
  compactRow: { minHeight: 58, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2c3c54' },
  action: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#17253a', marginBottom: 6 },
  actionText: { flex: 1, color: '#eff6ff', fontSize: 14, fontWeight: '600' },
  inactive: { opacity: 0.5 },
  addButton: { minHeight: 44, alignItems: 'center', flexDirection: 'row', gap: 5, paddingHorizontal: 8 },
  addText: { color: '#bfdbfe', fontSize: 13, fontWeight: '700', flexShrink: 1 },
  primary: { marginTop: 8, minHeight: 48, paddingHorizontal: 15, paddingVertical: 9, borderRadius: 11, backgroundColor: '#245dc2', flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#ffffff', fontSize: 15, fontWeight: '700', flexShrink: 1 },
  qrAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, backgroundColor: '#203659', paddingHorizontal: 12, borderRadius: 10 },
  statusRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10 },
  status: { color: '#e2e8f0', fontSize: 15, fontWeight: '700' },
  open: { color: '#86efac' },
  closed: { color: '#fcd796' },
  dayPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  dayButton: { minHeight: 44, paddingHorizontal: 10, paddingVertical: 8, justifyContent: 'center', borderWidth: 1, borderColor: '#344560', borderRadius: 9 },
  selectedDay: { borderColor: palette.amber.edge, backgroundColor: palette.amber.surface },
  notice: { padding: 12, borderRadius: 10, backgroundColor: '#19283d', marginBottom: 12, color: '#d3deec', fontSize: 14 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  detail: { color: '#a8b7cc', fontSize: 13 },
  title: { color: '#f8fafc', fontSize: 16, fontWeight: '700' },
  iconButton: { minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'center' },
  quotas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quota: { color: '#cbd5e1', backgroundColor: '#1e293b', paddingVertical: 5, paddingHorizontal: 9, borderRadius: 8 },
  day: { color: '#bfdbfe', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  save: { flex: 1, minHeight: 48, borderRadius: 12, padding: 10, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
  choice: { minHeight: 48, justifyContent: 'center', marginBottom: 6 },
});

function EditControl({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} disabled={disabled}
    style={[registration.iconButton, disabled && { opacity: 0.45 }]} onPress={onPress}>
    <Pencil size={18} color="#60a5fa" />
  </TouchableOpacity>;
}

function ExportControl({ title, disabled, onPress }: { title: string; disabled: boolean; onPress: () => void }) {
  return <TouchableOpacity style={[registration.line, { minHeight: 48 }]} accessibilityRole="button" disabled={disabled} onPress={onPress}>
    <Download size={18} color="#60a5fa" /><Text style={[registration.copy, registration.detail]}>{title}</Text>
    <ChevronRight color="#94a3b8" size={16} />
  </TouchableOpacity>;
}

function FormBuilderCard({ title, tone, action, prompt, empty, choices, disabled }: {
  tone: { ink: string; surface: string };
  title: string; action: string; prompt: string; empty: string; disabled?: boolean;
  choices: { id: string; label: string; open: () => void }[];
}) {
  const [expanded, setExpanded] = useState(false);
  return <Card title={title} tone={tone} icon={Pencil}>
    {choices.length ? <>
      <Action title={action} disabled={disabled} expanded={expanded} onPress={() => setExpanded(value => !value)} />
      {expanded && <>
        <Text style={[registration.detail, { marginBottom: 12 }]}>{prompt}</Text>
        {choices.map(choice => <Action key={choice.id} title={choice.label} disabled={disabled}
          onPress={() => {
            setExpanded(false);
            choice.open();
          }} />)}
      </>}
    </> : <Text style={registration.detail}>{empty}</Text>}
  </Card>;
}

type Props = {
  navigation: NavigationProp<ParamListBase>;
  event: SelectedEvent;
  activeTab: 'setup' | 'pre-reg' | 'event-day' | 'post-event';
  showParticipants?: boolean;
  scrollToTop?: () => void;
};

export default function ScheduledEventSettings({ navigation, event, activeTab, showParticipants, scrollToTop }: Props) {
  const { selectEvent } = useEventSelection();
  const isSetup = activeTab === 'setup';
  const styles = {
    section: theme.cardTitle, card: theme.card, label: theme.label, buttonText: theme.menuItemTitle,
    error: { color: '#fca5a5', paddingVertical: 8 },
    row: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  };
  const [selected, setSelected] = useState<Workspace | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [identityChanges, setIdentityChanges] = useState<Record<string, string>>({});
  const [datePicker, setDatePicker] = useState<{ key: string; mode: PickerMode } | null>(null);
  const [addedDays, setAddedDays] = useState<string[]>([]);
  const [chosenDay, setChosenDay] = useState<string | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [participants, setParticipants] = useState<{ people: Person[]; next: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const operation = useRef(false);

  const perform = useCallback(async (task: () => Promise<void>) => {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The request failed.');
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setSelected(await workspaceRequest<Workspace>(`/${event.id}`));
  }, [event.id]);

  const loadParticipants = useCallback((after?: string) => perform(async () => {
    const [page] = await Promise.all([
      workspaceRequest<{ people: Person[]; next: string | null }>(
        `/${event.id}/participants${after ? `?after=${after}` : ''}`,
      ),
      after ? Promise.resolve() : refresh(),
    ]);
    setParticipants(current => ({ people: [...(after && current ? current.people : []), ...page.people], next: page.next }));
  }), [event.id, perform, refresh]);

  useFocusEffect(useCallback(() => {
    if (showParticipants) {
      void loadParticipants();
    } else {
      void perform(refresh);
    }
  }, [loadParticipants, perform, refresh, showParticipants]));

  React.useEffect(() => {
    setEditor(null);
    setDatePicker(null);
    if (!showParticipants) setParticipants(null);
  }, [activeTab, showParticipants]);
  const panel = editor?.action === 'session' || editor?.action === 'feedback' ? editor.action : participants ? 'participants' : null;
  React.useEffect(() => {
    if (panel) scrollToTop?.();
  }, [panel, scrollToTop]);

  const setValue = (key: string, value: string) => {
    setEditor(current => current && ({ ...current, values: { ...current.values, [key]: value } }));
  };

  const roleCaps = (values: Record<string, string>) => Object.fromEntries(
    (selected?.roles || []).filter(role => values[`cap-${role.id}`])
      .map(role => [role.id, count(values[`cap-${role.id}`])]),
  );

  const save = (entry: Editor, resize?: VenueResize) => perform(async () => {
    const { values: v, action } = entry;
    if (!selected) return;
    const body: Record<string, unknown> = { id: v.id || undefined };
    if (action === 'settings') Object.assign(body, {
      name: v.name, event_date: v.event_date,
      registration_opens_at: v.registration_opens_at ? manilaInstant(v.registration_opens_at) : null,
      pre_reg_deadline: v.pre_reg_deadline ? manilaInstant(v.pre_reg_deadline) : null,
    });
    if (action === 'role') Object.assign(body, {
      name: v.name, student_priority: Boolean(entry.priority), registration_capacity: count(v.registration_capacity),
      registration_url: selected.pre_registration_url || v.registration_url,
      required_fields: (v.required_fields || '').split(',').map(value => value.trim()).filter(Boolean),
    });
    if (action === 'venue') Object.assign(body, { name: v.name, capacity: count(v.capacity) },
      resize ?? { role_caps: roleCaps(v) });
    if (action === 'session') Object.assign(body, {
      title: v.title, venue_id: v.venue_id,
      ...(!selected.event.shared_venue_capacity && { capacity: count(v.capacity), role_caps: roleCaps(v) }),
      starts_at: manilaInstant(v.starts_at), ends_at: manilaInstant(v.ends_at),
      checkin_opens_at: manilaInstant(v.checkin_opens_at || v.starts_at),
      walkins_open_at: manilaInstant(v.walkins_open_at || v.ends_at),
      reserved_students: count(v.reserved_students), attendance_url: v.attendance_url, feedback_url: v.feedback_url,
    });
    if (action === 'feedback') body.feedback_url = v.feedback_url;
    const saved = await workspaceRequest<SelectedEvent>(`/${selected.event.id}/actions/${action === 'feedback' ? 'feedback-link' : action}`, body);
    if (action === 'settings') {
      selectEvent(saved);
      setSelected({ ...selected, event: saved });
      setIdentityChanges(pending => Object.fromEntries(Object.entries(pending).filter(([key, value]) => v[key] !== value)));
    }
    await refresh();
    if (action !== 'settings') setEditor(null);
  });

  const setLifecycle = (action: 'publish' | 'archive') => {
    if (!selected) return;
    const { id, name } = selected.event;
    const change = () => perform(async () => {
      const saved = await workspaceRequest<SelectedEvent>(`/${id}/actions/${action}`, {});
      selectEvent(saved);
      await refresh();
    });
    if (action === 'publish') {
      Alert.alert(`Publish ${name}?`, 'Check-in and feedback links will follow the event’s current settings.', [
        { text: 'Cancel', style: 'cancel' }, { text: 'Publish', onPress: change },
      ]);
    } else Alert.alert(`Archive ${name}?`, 'This closes registration, check-ins, and feedback. Reports remain available.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Archive', style: 'destructive', onPress: change },
    ]);
  };

  const showQr = (link: string, title: string, type?: string) => {
    if (!selected) return;
    navigation.navigate('QRGenerator', { url: link, title, eventName: selected.event.name, eventMode: 'scheduled', isOpen: true, type });
  };

  const sessionFormChoices = (formType: 'attendance' | 'evaluation') => selected?.sessions.map(session => {
    const venue = selected.venues.find(item => item.id === session.venue_id)?.name;
    const slot = localDateTime(session.starts_at, selected.event.timezone);
    const label = [session.title, venue, slot].filter(Boolean).join(' · ');
    return {
      id: session.id,
      label,
      open: () => navigation.navigate('EvaluationForm', {
        eventId: event.id, eventName: event.name, sessionId: session.id, sessionTitle: label, formType,
      }),
    };
  }) ?? [];

  const share = (kind: 'participants' | 'attendance' | 'feedback' | 'student-colleges', sessionId?: string) => perform(async () => {
    if (!selected) return;
    const id = selected.event.id;
    const csv = await workspaceRequest<string>(`/${id}/report/${kind}${sessionId ? `?sessionId=${sessionId}` : ''}`);
    if (!FileSystem.cacheDirectory || !(await Sharing.isAvailableAsync())) throw new Error('File sharing is unavailable on this device.');
    const uri = `${FileSystem.cacheDirectory}zaproll-${kind}-${id}${sessionId ? `-${sessionId}` : ''}.csv`;
    await FileSystem.writeAsStringAsync(uri, csv);
    await Sharing.shareAsync(uri, { mimeType: 'text/csv' });
  });

  const capacityValues = (caps: Record<string, number>) => Object.fromEntries(Object.entries(caps).map(([id, value]) => [`cap-${id}`, String(value)]));
  const editSession = (day: string, session?: Session) => setEditor({
    action: 'session',
    values: {
      id: session?.id || newEventRequestId(), day, title: session?.title || '', venue_id: session?.venue_id || '',
      capacity: session ? String(session.capacity) : '', reserved_students: String(session?.reserved_students ?? 0),
      attendance_url: session?.attendance_url || '', feedback_url: session?.feedback_url || '',
      ...Object.fromEntries(['starts_at', 'ends_at', 'checkin_opens_at', 'walkins_open_at'].map(key => [
        key, session ? localDateTime(session[key as keyof Session] as string, 'Asia/Manila') : '',
      ])),
      ...capacityValues(session?.role_caps || {}),
    },
  });
  const editable = selected?.event.lifecycle !== 'archived';
  const centralAttendanceUrl = selected?.central_attendance_path
    ? API_URL.replace(/\/$/, '') + selected.central_attendance_path : null;
  const savedIdentity = {
    name: selected?.event.name || '', event_date: selected?.event.event_date || '',
    registration_opens_at: localDateTime(selected?.event.registration_opens_at ?? null, 'Asia/Manila'),
    pre_reg_deadline: localDateTime(selected?.event.pre_reg_deadline ?? null, 'Asia/Manila'),
  };
  const identity = { ...savedIdentity, ...identityChanges };
  const detailsChanged = identity.name !== savedIdentity.name || identity.event_date !== savedIdentity.event_date;
  const scheduleChanged = identity.registration_opens_at !== savedIdentity.registration_opens_at || identity.pre_reg_deadline !== savedIdentity.pre_reg_deadline;
  const inlineRole = editor?.action === 'role' ? editor : null;
  const values: Record<string, string> = editor && !inlineRole ? editor.values : identity;
  const updateField = (key: string, value: string) => {
    if (editor && !inlineRole) setValue(key, value);
    else setIdentityChanges(current => ({ ...current, [key]: value }));
  };
  const field = (key: string, label: string, numeric = false, eventDetail = false) => <View key={key} style={theme.inputGroup}>
    <Text style={theme.label}>{label}</Text>
    <TextInput accessibilityLabel={label} style={[theme.input, !editable && theme.disabledInput]}
      multiline={eventDetail} submitBehavior={eventDetail ? 'blurAndSubmit' : undefined}
      editable={editable && !busy && !(eventDetail && editor)} keyboardType={numeric ? 'number-pad' : 'default'}
      value={(eventDetail ? identity.name : values[key]) || ''}
      onChangeText={value => updateField(key, eventDetail ? value.replace(/[\r\n]+/g, ' ') : value)} />
  </View>;
  const dateField = (key: string, label: string, mode: PickerMode = 'datetime', emptyLabel?: string) => {
    const eventDateField = key === 'event_date';
    const value = eventDateField ? identity.event_date : values[key];
    const display = mode === 'time' && value?.startsWith(values.day + ' ') ? value.slice(11) : value;
    const prettyDate = isSetup && eventDateField && display ? dayLabel(display) : display;
    return <View style={theme.inputGroup}>
      <Text style={theme.label}>{label}</Text>
      <TouchableOpacity style={[theme.input, isSetup && setupStyles.dateInput, !editable && theme.disabledInput]} disabled={!editable || busy || (eventDateField && !!editor)}
        accessibilityRole="button" accessibilityLabel={label} accessibilityValue={{ text: prettyDate || emptyLabel || 'Unset' }}
        onPress={() => setDatePicker({ key, mode })}>
        {isSetup && (mode === 'time' ? <Clock size={17} color={palette.blue.ink} /> : <Calendar size={17} color={palette.blue.ink} />)}
        <Text style={[isSetup && setupStyles.dateValue, { color: display ? palette.text : '#94a3b8', fontSize: 16 }]}>
          {prettyDate || emptyLabel || (mode === 'date' ? 'Select Date' : mode === 'time' ? 'Select Time' : 'Select Date and Time')}
        </Text>
        {isSetup && editable && <ChevronRight size={16} color={palette.secondary} />}
      </TouchableOpacity>
    </View>;
  };
  const pickedValue = datePicker && values[datePicker.key];
  const sessionDays = [...new Set([
    selected?.event.event_date, ...addedDays,
    ...(selected?.sessions.map(session => localDateTime(session.starts_at, 'Asia/Manila').slice(0, 10)) ?? []),
  ].filter((day): day is string => !!day))].sort();
  const nextDay = new Date((sessionDays.at(-1) || calendarDay(new Date())) + 'T12:00:00');
  nextDay.setDate(nextDay.getDate() + 1);
  const initialDate = datePicker?.key === 'add-day' ? nextDay : pickedValue
    ? new Date(pickedValue.includes(' ') ? pickedValue.replace(' ', 'T') : `${pickedValue}T12:00:00`)
    : new Date();

  const venueEditor = editor?.action === 'venue' ? editor : null;
  const venueRows: (Venue | null)[] = [...(selected?.venues ?? [])];
  if (venueEditor && !venueRows.some(venue => venue?.id === venueEditor.values.id)) venueRows.push(null);

  const studentOnly = selected?.event.student_pre_registration_only === true;
  const sharedVenueCapacity = selected?.event.shared_venue_capacity === true;
  const sessionVenue = selected?.venues.find(venue => venue.id === editor?.values.venue_id);
  const savedRoles = (selected?.roles ?? []).filter(role => !studentOnly || role.name.trim().toLowerCase() === 'student');
  const hiddenRoles = studentOnly ? (selected?.roles ?? []).filter(role => !savedRoles.includes(role)) : [];
  const otherAllocated = hiddenRoles.reduce((sum, role) => sum + Number(values[`cap-${role.id}`] || 0), 0);
  const current = selected?.event;
  const now = Date.now();
  const sessionsByDay = new Map<string, Session[]>();
  const sessionsByVenue = new Map<string, Session[]>();
  for (const session of selected?.sessions ?? []) {
    const day = localDateTime(session.starts_at, 'Asia/Manila').slice(0, 10);
    const group = sessionsByDay.get(day) || [];
    group.push(session);
    sessionsByDay.set(day, group);
    const venueSessions = sessionsByVenue.get(session.venue_id) ?? [];
    venueSessions.push(session);
    sessionsByVenue.set(session.venue_id, venueSessions);
  }
  const visibleDays = isSetup ? sessionDays : sessionDays.filter(day => sessionsByDay.has(day));
  const today = localDateTime(new Date(now).toISOString(), 'Asia/Manila').slice(0, 10);
  const activeDay = chosenDay && visibleDays.includes(chosenDay) ? chosenDay
    : !isSetup && visibleDays.includes(today) ? today : visibleDays[0];
  const visibleSessions = activeDay ? sessionsByDay.get(activeDay) ?? [] : [];
  const registrationOpen = !!current && editable && (current.pre_reg_manual ? !!current.pre_reg_open :
    current.lifecycle === 'active' && now >= Date.parse(current.registration_opens_at || '') && now < Date.parse(current.pre_reg_deadline || ''));
  const toggleRegistration = (open: boolean) => perform(async () => {
    const saved = await workspaceRequest<SettingsEvent>(`/${event.id}/actions/pre-reg-status`, { open });
    setSelected(workspace => workspace && ({ ...workspace, event: saved }));
  });
  const setAttendanceStatus = (id: string, open: boolean | null) => perform(async () => {
    const saved = await workspaceRequest<{ id: string; attendance_open_override: boolean | null }>(
      `/${event.id}/actions/attendance-status`, { id, open },
    );
    setSelected(workspace => workspace && ({
      ...workspace,
      sessions: workspace.sessions.map(session => session.id === saved.id ? { ...session, ...saved } : session),
    }));
  });
  const roles: (Role | undefined)[] = [...savedRoles];
  if (inlineRole && !savedRoles.some(role => role.id === inlineRole.values.id)) roles.push(undefined);
  const quotaTotal = roles.reduce((total, role) => total + (inlineRole && (!role || inlineRole.values.id === role.id)
    ? Number(inlineRole.values.registration_capacity) || 0 : role?.registration_capacity || 0), 0);
  const usageKnown = savedRoles.every(role => role.registrations !== undefined);
  const usedTotal = savedRoles.reduce((total, role) => total + (role.registrations?.[0]?.count ?? 0), 0);

  return <>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {busy && <ActivityIndicator color="#60a5fa" />}
    {editor?.action === 'session' ? <>
      {isSetup && <Card setup title="Session details" icon={Calendar}>
        {field('title', 'Session title')}
        <Text style={theme.label}>Venue</Text>
        {selected?.venues.map(venue => {
          const chosen = editor.values.venue_id === venue.id;
          return <TouchableOpacity key={venue.id} accessibilityRole="radio" accessibilityState={{ checked: chosen }}
            disabled={busy} style={[theme.roleCard, registration.choice, chosen && { borderColor: '#3b82f6' }]}
            onPress={() => !chosen && setEditor({ ...editor, values: {
              ...Object.fromEntries(Object.entries(editor.values).filter(([key]) => !key.startsWith('cap-'))),
              venue_id: venue.id, capacity: String(venue.capacity),
              ...capacityValues(Object.fromEntries(savedRoles.filter(role => role.id in venue.role_caps)
                .map(role => [role.id, venue.role_caps[role.id]]))),
            } })}>
            <Text style={registration.title}>{chosen ? '✓  ' : ''}{venue.name}</Text>
          </TouchableOpacity>;
        })}
      </Card>}
      <Card setup={isSetup} title={isSetup ? 'Session schedule' : 'Session Schedule'} icon={Clock}>
        <Text style={[registration.detail, { marginBottom: 16 }]}>{dayLabel(editor.values.day)} · Manila time</Text>
        {dateField('starts_at', 'Session starts', 'time')}{dateField('ends_at', 'Session ends', 'time')}
        {dateField('checkin_opens_at', 'Check-in opens', 'time', 'At session start')}
        {dateField('walkins_open_at', 'Walk-ins open', 'time', 'No walk-ins during session')}
      </Card>
      {isSetup && <Card setup title={sharedVenueCapacity ? 'Session seating' : 'Session capacity'} icon={Users} tone={palette.emerald}>
        <Text style={theme.label}>Checked in: {selected?.sessions.find(session => session.id === editor.values.id)?.checkins?.[0]?.count ?? 0}</Text>
        {sharedVenueCapacity ? <Text style={registration.detail}>
          {sessionVenue ? `${sessionVenue.capacity.toLocaleString()} seats from ${sessionVenue.name}` : 'Choose a venue to set the seat limit.'}
        </Text> : <>
          {field('capacity', 'Total capacity', true)}
          {savedRoles.map(role => field(`cap-${role.id}`, `${role.name} capacity`, true))}
          {otherAllocated > 0 && <Text style={registration.detail}>{otherAllocated} seats in existing allocations</Text>}
        </>}
        {field('reserved_students', 'Seats protected for pre-registered students', true)}
      </Card>}
      {!centralAttendanceUrl && <Card setup={isSetup} title={isSetup ? 'Attendance form' : 'Attendance Form'} icon={QrCode}>{field('attendance_url', 'Attendance form URL (optional)')}</Card>}
      <SaveSettings title="Save session" disabled={busy || (sharedVenueCapacity && !sessionVenue)} onPress={() => save(editor)} />
      <Action title="Cancel" disabled={busy} onPress={() => setEditor(null)} />
    </> : editor?.action === 'feedback' ? <View style={styles.card}>
      <View style={theme.cardHeaderRow}><SettingsHeading icon={Star} title="Session feedback" /></View>
      {field('feedback_url', 'Optional feedback form URL')}
       <SaveSettings title="Save feedback link" disabled={busy} onPress={() => save(editor)} />
      <Action title="Cancel" disabled={busy} onPress={() => setEditor(null)} />
    </View> : participants && activeTab === 'pre-reg' ? <View style={styles.card}>
      <Action title="Back to event" disabled={busy} onPress={() => {
        setParticipants(null);
        navigation.setParams({ showParticipants: false });
      }} />
      <Text style={styles.section}>Participant records</Text>
      {participants.people.map(person => <View key={person.id} style={styles.card}>
        <Text style={styles.buttonText}>{person.full_name}</Text>
        <Text style={styles.label}>{person.email}</Text>
        <Text style={styles.label}>{selected?.roles.find(role => role.id === person.role_id)?.name} · {person.source}</Text>
      </View>)}
      {!participants.people.length && <Text style={styles.label}>No registrations yet.</Text>}
      {participants.next && <Action title="Load more" disabled={busy} onPress={() => void loadParticipants(participants.next!)} />}
    </View> : !selected ? (
      !busy && <Action title="Retry loading event settings" onPress={() => void perform(refresh)} />
    ) : <>
      {selected.event.lifecycle === 'archived' && <Text style={registration.notice}>Archived event. Participant records and exports are available here.</Text>}
      {(isSetup || activeTab === 'pre-reg') && <>
        {isSetup && <Card setup title="Event details" icon={LayoutDashboard}>
          {field('name', 'Event Name', false, true)}
          {dateField('event_date', 'Event Date', 'date')}
          {editable && detailsChanged && <SaveSettings title="Save event details" disabled={busy || !!editor}
            onPress={() => save({ action: 'settings', values: { ...savedIdentity, name: identity.name, event_date: identity.event_date } })} />}
        </Card>}
        {!isSetup && <Card tone={palette.emerald} title="Pre-registration status" icon={Clock}>
          <View style={registration.statusRow}>
            <View style={registration.copy}>
              <Text style={[registration.status, registrationOpen ? registration.open : registration.closed]}>{registrationOpen ? 'Open' : 'Closed'}</Text>
              <Text style={registration.detail}>{current?.pre_reg_manual ? 'Controlled manually' : 'Follows the registration schedule'}</Text>
            </View>
            <Switch accessibilityLabel="Pre-registration open" disabled={busy || !editable}
              value={registrationOpen} onValueChange={toggleRegistration} trackColor={{ false: '#334155', true: palette.emerald.edge }} />
          </View>
          {!current?.pre_reg_manual && <Action title="Registration schedule" expanded={showSchedule} disabled={busy}
            onPress={() => setShowSchedule(value => !value)} />}
          {!current?.pre_reg_manual && showSchedule && <View style={registration.panel}>
            {dateField('registration_opens_at', 'Opens (Manila time)')}
            {dateField('pre_reg_deadline', 'Closes (Manila time)')}
            {editable && <SaveSettings title="Save registration schedule" disabled={busy || !scheduleChanged}
              onPress={() => save({ action: 'settings', values: {
                ...savedIdentity, registration_opens_at: identity.registration_opens_at, pre_reg_deadline: identity.pre_reg_deadline,
              } })} />}
          </View>}
        </Card>}
        {!isSetup && (editable || selected.pre_registration_url) && <Card tone={palette.emerald} title="Pre-Registration Form" icon={Pencil}>
          {selected.pre_registration_url && <FormLink label="Pre-registration" value={selected.pre_registration_url}
            qr={editable ? selected.pre_registration_url : null} onPress={url => showQr(url, 'Pre-registration', 'pre-reg')} />}
          {editable && (savedRoles.length ? <Action title="Design Pre-Registration Form" disabled={busy || !!inlineRole}
            onPress={() => navigation.navigate('EvaluationForm', {
              eventId: event.id, eventName: selected.event.name, formType: 'pre-registration',
              registrationRoles: savedRoles.map(({ id, name }) => ({ id, name })),
            })} /> : <Text style={registration.detail}>Add a participant role in Setup to design the pre-registration form.</Text>)}
        </Card>}
        <Card setup={isSetup} tone={isSetup ? palette.emerald : palette.blue} title={isSetup ? studentOnly ? "Student quota" : "Role quotas" : studentOnly ? "Student registration settings" : "Role settings"} icon={Users} add={editable && isSetup && !studentOnly ? { label: 'Add role', disabled: !!editor || busy,
          run: () => setEditor({ action: 'role', values: { id: newEventRequestId() } }) } : undefined}>
          {isSetup && !!roles.length && <View style={setupStyles.quotaSummary}>
            <View style={setupStyles.quotaCell}><Text style={setupStyles.quotaNumber}>{quotaTotal.toLocaleString()}</Text><Text style={setupStyles.description}>Total slots</Text></View>
            <View style={setupStyles.quotaCell}><Text style={[setupStyles.quotaNumber, { color: palette.emerald.ink }]}>{usageKnown ? Math.max(0, quotaTotal - usedTotal).toLocaleString() : '—'}</Text><Text style={setupStyles.description}>Available</Text></View>
          </View>}
          {!roles.length && (studentOnly ? <SetupEmpty>Student registration is unavailable.</SetupEmpty> : isSetup ? <SetupEmpty>Add a participant role to allocate pre-registration slots.</SetupEmpty>
            : <Text style={registration.detail}>Add participant roles in Setup first.</Text>)}
          {roles.map(role => {
            const editing = !!inlineRole && (!role || role.id === inlineRole.values.id);
            const enabled = editable && !busy && (!editor || editing);
            const entry: Editor = editing ? inlineRole : { action: 'role', priority: role?.student_priority, values: {
              id: role!.id, name: role!.name, registration_capacity: String(role!.registration_capacity),
              registration_url: role!.registration_url || '', required_fields: role!.required_fields.join(', '),
            } };
            const change = (key: string, value: string) => setEditor({ ...entry, values: { ...entry.values, [key]: value } });
            const input = (key: string, label: string) => <TextInput accessibilityLabel={label} placeholder={label}
              placeholderTextColor="#94a3b8" editable={editing && enabled} style={[theme.input, { minWidth: 0, fontSize: 14 }]}
              autoCapitalize={key === 'name' ? 'words' : 'none'} keyboardType={key === 'registration_capacity' ? 'number-pad' : 'default'}
              value={entry.values[key] || ''} onChangeText={value => change(key, value)} />;
            const limit = Number(entry.values.registration_capacity) || 0;
            const used = role ? role.registrations?.[0]?.count ?? (role.registrations ? 0 : null) : 0;
            return <View key={entry.values.id} style={editing
              ? [registration.panel, registration.item, isSetup && setupStyles.editor]
              : isSetup ? setupStyles.row : registration.compactRow}>
              <View style={registration.line}>
                <View style={registration.copy}>
                  {!isSetup || !editing ? <Text style={registration.title}>{role?.name}</Text> : null}
                  {isSetup && !editing && <Text style={registration.detail}>{used ?? '—'} / {limit} registered</Text>}
                </View>
                {isSetup && !editing && used !== null && <Text style={[registration.detail, registration.open]}>{Math.max(0, limit - used)} left</Text>}
                {editable && !editing && role && <EditControl label={isSetup ? `Edit ${role.name} quota` : `Edit ${role.name} form settings`}
                  disabled={!enabled} onPress={() => setEditor(entry)} />}
              </View>
              {editing && <>
                {isSetup && <View style={[theme.roleRow, { gap: 8 }]}>
                  {!studentOnly && <View style={{ flex: 2 }}><Text style={theme.label}>Role</Text>{input('name', 'Role')}</View>}
                  <View style={{ flex: 1 }}><Text style={theme.label}>Slots</Text>{input('registration_capacity', 'Slots')}</View>
                </View>}
                {!isSetup && input('required_fields', 'Required form field keys (comma-separated)')}
                {isSetup && !studentOnly && <View style={styles.row}><Text style={[theme.controlSubtitle, { flex: 1 }]}>Eligible for protected student places</Text>
                  <Switch accessibilityLabel="Eligible for protected student places" disabled={!!role || busy}
                    value={!!entry.priority} onValueChange={priority => setEditor({ ...entry, priority })} /></View>}
                <SaveSettings title={isSetup ? studentOnly ? "Save student quota" : "Save role" : "Save form settings"} disabled={busy || !entry.values.name?.trim() || !/^\d{1,9}$/.test(entry.values.registration_capacity || '')}
                  onPress={() => save(entry)} />
                <Action title="Cancel" disabled={busy} onPress={() => setEditor(null)} />
              </>}
            </View>;
          })}
        </Card>
        {!isSetup && <Card title="Participant Data" icon={Users}>
        <Action title="View participant records" disabled={busy} onPress={() => void loadParticipants()} />
        <Action title="Export participant records" disabled={busy} onPress={() => void share('participants')} />
         {selected.roles.some(role => role.name.trim().toLowerCase() === 'student') &&
           <Action title="Export student counts by college" disabled={busy} onPress={() => void share('student-colleges')} />}
        </Card>}
      </>}
      {(isSetup || activeTab === 'event-day') && <>
        {isSetup && <Card setup title={sharedVenueCapacity ? 'Venues and sessions' : 'Venue capacity'} icon={MapPin} tone={palette.violet} add={editable ? { label: 'Add venue', disabled: busy || !!editor || !savedRoles.length,
          run: () => setEditor({ action: 'venue', values: { id: newEventRequestId() } }) } : undefined}>
          {!venueRows.length && <SetupEmpty>{!editable ? 'No venues configured.' : savedRoles.length
            ? 'Add a venue to set its capacity.' : studentOnly ? 'Student registration is unavailable.' : 'Add a participant role before adding a venue.'}</SetupEmpty>}
          {venueRows.map(venue => {
            if (venueEditor && (!venue || venue.id === venueEditor.values.id)) {
              const total = Number(venueEditor.values.capacity);
              const studentLimit = Math.max(0, total - otherAllocated);
              const studentSeats = savedRoles.reduce((sum, role) => sum + Number(venueEditor.values[`cap-${role.id}`] || 0), 0);
              const studentId = studentOnly && savedRoles.length === 1 ? savedRoles[0].id : undefined;
              const allStudentSeats = sharedVenueCapacity && studentId && otherAllocated === 0
                && (!venue || venue.role_caps[studentId] === venue.capacity);
              const exceedsCapacity = !allStudentSeats && studentOnly && total > 0 && studentSeats > studentLimit;
              const affected = total > 0
                ? (sessionsByVenue.get(venueEditor.values.id) ?? []).filter(session => session.capacity > total) : [];
              const canResize = !sharedVenueCapacity && venue && studentId && otherAllocated === 0 && studentSeats > 0
                && /^\d{1,9}$/.test(venueEditor.values[`cap-${studentId}`] || '')
                && /^\d{1,9}$/.test(venueEditor.values.capacity)
                && affected.length > 0 && affected.every(session =>
                  Object.keys(session.role_caps ?? {}).length === 1 && (session.role_caps[studentId] ?? 0) > 0);
              const studentTarget = Math.min(studentSeats, studentLimit);
              const resize: VenueResize | undefined = canResize ? {
                role_caps: { [studentId]: studentTarget },
                expected_venue: { name: venue.name, capacity: venue.capacity, role_caps: venue.role_caps },
                affected_sessions: Object.fromEntries(affected.map(({ id, capacity, role_caps }) => [id, { capacity, role_caps }])),
              } : undefined;
              const largerSession = affected[0];
              const cannotSave = busy || (!resize && (exceedsCapacity || (!sharedVenueCapacity && !!largerSession)));
              return <View key={venueEditor.values.id} style={setupStyles.editor}>
                {field('name', 'Venue name')}{field('capacity', 'Total venue capacity', true)}
                {!studentOnly && <SettingsHeading icon={Users} title="Role capacities" />}
                {!allStudentSeats && savedRoles.map(role => field(`cap-${role.id}`, `${role.name} capacity`, true))}
                {otherAllocated > 0 && <Text style={registration.detail}>{otherAllocated} seats in existing allocations</Text>}
                {sharedVenueCapacity && <Text style={registration.detail}>
                  {allStudentSeats ? 'Each session in this venue uses this seat limit for students.' : 'Each session in this venue uses these seat and role limits.'}
                </Text>}
                {studentOnly && total > 0 && !resize && !allStudentSeats && <Text accessibilityRole={exceedsCapacity ? 'alert' : undefined}
                  style={exceedsCapacity ? styles.error : registration.detail}>
                  {exceedsCapacity ? `Student capacity cannot exceed ${studentLimit.toLocaleString()} seats.`
                    : `Up to ${studentLimit.toLocaleString()} seats can be allocated to students.`}
                </Text>}
                {resize && <View style={setupStyles.capacitySummary}>
                  <Text style={registration.detail}>Saving will set the venue’s Student allocation to {studentTarget.toLocaleString()} seats and lower these session limits.</Text>
                  {affected.map(session => <Text key={session.id} style={registration.detail}>
                    {session.title} · {session.capacity.toLocaleString()} → {total.toLocaleString()} seats
                  </Text>)}
                </View>}
                {largerSession && !resize && !sharedVenueCapacity && <Text accessibilityRole="alert" style={styles.error}>
                  In Event schedule, lower {largerSession.title} from {largerSession.capacity.toLocaleString()} to {total.toLocaleString()} seats or fewer before saving this venue.
                </Text>}
                <View style={registration.line}>
                  <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: cannotSave }}
                    style={[registration.save, cannotSave && registration.inactive]}
                    disabled={cannotSave} onPress={() => save(allStudentSeats ? {
                      ...venueEditor, values: { ...venueEditor.values, [`cap-${studentId}`]: venueEditor.values.capacity },
                    } : venueEditor, resize)}>
                    <Text style={theme.saveButtonText}>{resize ? 'Save venue and sessions' : 'Save venue'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button" style={registration.iconButton} disabled={busy} onPress={() => setEditor(null)}>
                    <Text style={registration.detail}>Cancel</Text></TouchableOpacity>
                </View>
              </View>;
            }
            if (!venue) return null;
            const allocated = Object.values(venue.role_caps).reduce((sum, seats) => sum + seats, 0);
            const held = hiddenRoles.reduce((sum, role) => sum + (venue.role_caps[role.id] ?? 0), 0);
            const sessions = sessionsByVenue.get(venue.id) ?? [];
            return <View key={venue.id} style={[setupStyles.row, setupStyles.venue]}>
              <View style={registration.line}><View style={registration.copy}>
                <Text style={registration.title}>{venue.name}</Text>
                <Text style={registration.detail}>{venue.capacity.toLocaleString()} seats total</Text>
              </View>
              {editable && <EditControl label={`Edit ${venue.name}`} disabled={busy || !!editor} onPress={() => setEditor({ action: 'venue', values: {
                id: venue.id, name: venue.name, capacity: String(venue.capacity), ...capacityValues(venue.role_caps),
              } })} />}</View>
              <View style={setupStyles.capacitySummary}>
                <View style={registration.quotas}>
                  <Text style={registration.detail}>{allocated.toLocaleString()} allocated</Text>
                  <Text style={registration.detail}>{Math.max(0, venue.capacity - allocated).toLocaleString()} unallocated</Text>
                </View>
                <CapacityMeter used={allocated} total={venue.capacity} color={palette.violet.ink} />
              </View>
              <View style={registration.quotas}>
                {savedRoles.filter(role => role.id in venue.role_caps).map(role =>
                  <Text key={role.id} style={registration.quota}>{role.name} · {venue.role_caps[role.id]}</Text>)}
                {held > 0 && <Text style={registration.quota}>Existing allocations · {held}</Text>}
              </View>
              {sessions.length > 0 && <View style={setupStyles.venueSessions}>
                {sessions.map(session => {
                  const checkedIn = session.checkins?.[0]?.count ?? (session.checkins ? 0 : null);
                  const full = checkedIn !== null && checkedIn >= session.capacity;
                  const date = localDateTime(session.starts_at, 'Asia/Manila');
                  return <View key={session.id} style={setupStyles.capacitySummary}>
                    <View style={registration.line}>
                      <Text style={[registration.title, registration.copy]}>{session.title}</Text>
                      {sharedVenueCapacity && editable && <EditControl label={`Edit ${session.title}`}
                        disabled={busy || !!editor} onPress={() => editSession(date.slice(0, 10), session)} />}
                    </View>
                    <Text style={registration.detail}>{dayLabel(date.slice(0, 10))} · {date.slice(11)}</Text>
                    {checkedIn === null ? <Text style={registration.detail}>{session.capacity.toLocaleString()} session seats</Text> : <>
                      <View style={registration.quotas}>
                        <Text style={registration.detail}>{checkedIn} / {session.capacity} checked in</Text>
                        <Text style={[registration.detail, { color: full ? palette.amber.ink : palette.emerald.ink }]}>
                          {full ? 'Full' : `${session.capacity - checkedIn} seats left`}
                        </Text>
                      </View>
                      <CapacityMeter used={checkedIn} total={session.capacity} color={full ? palette.amber.ink : palette.emerald.ink} />
                    </>}
                  </View>;
                })}
              </View>}
            </View>;
          })}
        </Card>}
        {!isSetup && centralAttendanceUrl && <Card tone={palette.amber} title="Central student check-in" icon={QrCode}>
          <Text style={registration.detail}>Use this QR at the attendance desk on every event day.</Text>
          <FormLink label="Central student check-in" value={centralAttendanceUrl} qr={centralAttendanceUrl}
            onPress={url => showQr(url, 'Central student check-in', 'student-checkin')} />
        </Card>}
        <Card setup={isSetup} tone={palette.amber} title={isSetup ? "Event schedule" : "Attendance sessions"} icon={Calendar}>
          {!isSetup && !selected.sessions.length && <Text style={registration.detail}>Add sessions in Setup first.</Text>}
          {visibleDays.length > 1 && <View accessibilityRole="tablist" style={registration.dayPicker}>
            {visibleDays.map(day => <TouchableOpacity key={day} accessibilityRole="tab"
              accessibilityLabel={dayLabel(day)} accessibilityState={{ selected: day === activeDay }}
              style={[registration.dayButton, day === activeDay && (isSetup ? setupStyles.daySelected : registration.selectedDay)]}
              onPress={() => setChosenDay(day)}>
              <Text style={[registration.addText, day === activeDay && !isSetup && { color: palette.amber.ink }]}>{new Date(day + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
            </TouchableOpacity>)}
          </View>}
          {activeDay && <View style={registration.item}>
              <Text accessibilityRole="header" style={isSetup ? setupStyles.dayTitle : registration.day}>{dayLabel(activeDay)}</Text>
              {!visibleSessions.length && (isSetup ? <SetupEmpty>{!editable ? 'No sessions on this day.' : selected.venues.length
                ? 'No sessions on this day yet.' : 'Add a venue before scheduling a session.'}</SetupEmpty>
                : <Text style={registration.detail}>No sessions configured.</Text>)}
              {visibleSessions.map(session => {
                const start = localDateTime(session.starts_at, 'Asia/Manila');
                const end = localDateTime(session.ends_at, 'Asia/Manila');
                 const manualAttendance = session.attendance_open_override != null;
                 const attendanceOpen = session.attendance_open_override ?? (
                   selected.event.lifecycle === 'active' && now >= Date.parse(session.checkin_opens_at) && now < Date.parse(session.ends_at)
                 );
                return (
                  <View key={session.id} style={isSetup ? setupStyles.session : [registration.panel, registration.item]}>
                    <View style={registration.line}><View style={registration.copy}>
                      <Text style={registration.title}>{session.title}</Text>
                      <Text style={registration.detail}>{selected.venues.find(venue => venue.id === session.venue_id)?.name}</Text>
                    </View>{isSetup && !sharedVenueCapacity && editable && <EditControl label={`Edit ${session.title}`} disabled={busy || !!editor} onPress={() => editSession(activeDay, session)} />}</View>
                    {isSetup ? <View style={setupStyles.sessionMeta}>
                      <Clock size={15} color={palette.amber.ink} />
                      <Text style={registration.detail}>{start.slice(11)} – {end.startsWith(activeDay) ? end.slice(11) : end} · Manila time</Text>
                      <Text style={registration.quota}>{session.checkins?.[0]?.count ?? 0} / {session.capacity} checked in</Text>
                    </View> : <>
                      <Text style={registration.detail}>{start.slice(11)} – {end.startsWith(activeDay) ? end.slice(11) : end}</Text>
                      <Text style={theme.usageRemaining}>{session.checkins?.[0]?.count ?? 0} / {session.capacity} checked in</Text>
                    </>}
                     {!isSetup && editable && <>
                       <View style={registration.statusRow}>
                         <View style={registration.copy}>
                           <Text style={theme.controlLabel}>Attendance</Text>
                           <Text style={[registration.detail, attendanceOpen ? registration.open : registration.closed]}>
                             {selected.event.lifecycle === 'draft' && attendanceOpen ? 'Opens when published' : attendanceOpen ? 'Open' : 'Closed'}
                             {' · '}{manualAttendance ? 'Manual control' : 'Follows schedule'}
                           </Text>
                         </View>
                         <Switch accessibilityLabel={`Attendance for ${session.title}`}
                           accessibilityState={{ disabled: busy || session.attendance_open_override === undefined, checked: attendanceOpen }}
                           disabled={busy || session.attendance_open_override === undefined}
                           value={attendanceOpen} onValueChange={open => setAttendanceStatus(session.id, open)}
                           trackColor={{ false: '#334155', true: palette.emerald.edge }} />
                       </View>
                       {session.attendance_open_override === undefined && <Text style={registration.detail}>This session follows its schedule. Manual controls require a backend update.</Text>}
                       {manualAttendance && <Action title="Use schedule" disabled={busy} onPress={() => setAttendanceStatus(session.id, null)} />}
                     </>}
                    {editable && !centralAttendanceUrl && <FormLink label="Attendance form" value={session.attendance_url} qr={session.attendance_qr_url} onPress={url => showQr(url, session.title, 'session-attendance')} />}
                    {!isSetup && <ExportControl title="Export session attendance" disabled={busy} onPress={() => void share('attendance', session.id)} />}
                  </View>
                );
              })}
              {isSetup && editable && <Action add title={`Add session to Day ${sessionDays.indexOf(activeDay) + 1}`} disabled={busy || !!editor || !selected.venues.length}
                onPress={() => editSession(activeDay)} />}
            </View>}
          {isSetup && editable && <Action add title="Add event day" disabled={busy || !!editor}
            onPress={() => setDatePicker({ key: 'add-day', mode: 'date' })} />}
        </Card>
        {!isSetup && editable && !centralAttendanceUrl && <FormBuilderCard tone={palette.amber} title="Attendance Form Builder" action="Design Attendance Form"
          prompt="Choose a session" empty="Add a session in Setup to design its attendance form."
          disabled={busy} choices={sessionFormChoices('attendance')} />}
        {!isSetup && <Card tone={palette.amber} title="Attendance Records" icon={ClipboardCheck}>
          <ExportControl title="Export all attendance" disabled={busy} onPress={() => void share('attendance')} />
        </Card>}
      </>}
      {activeTab === 'post-event' && <>
        {editable && <FormBuilderCard tone={palette.violet} title="Eval Form Builder" action="Design Evaluation Form"
          prompt="Choose a session" empty="Add a session in Setup to design its evaluation form."
          choices={sessionFormChoices('evaluation')} />}
        <Card tone={palette.violet} title="Evaluation Forms" icon={Star}>
        {!selected.sessions.length && <Text style={styles.label}>Add a session in Setup to configure its feedback form.</Text>}
        {selected.sessions.map(session => <View key={session.id} style={[registration.compactRow, registration.item]}>
          <Text style={theme.controlLabel}>{session.title}</Text>
          <FormLink label="Optional feedback form" value={session.feedback_url} qr={editable ? session.feedback_qr_url : null} onPress={url => showQr(url, session.title + ' feedback', 'session-eval')} />
          {editable && <Action title="Edit feedback link" onPress={() => setEditor({ action: 'feedback', values: {
            id: session.id, feedback_url: session.feedback_url || '',
          } })} />}
        </View>)}
        </Card>
        <Card tone={palette.violet} title="Feedback responses" icon={Download}>
        <Action title="Export feedback" disabled={busy} onPress={() => void share('feedback')} />
        </Card>
      </>}
      {isSetup && editable && <Card setup title="Event status" icon={ClipboardCheck}>
        <Text style={[setupStyles.status, selected.event.lifecycle === 'draft'
          ? { color: palette.amber.ink, backgroundColor: palette.amber.surface }
          : { color: palette.emerald.ink, backgroundColor: palette.emerald.surface }]}>
          {selected.event.lifecycle === 'draft' ? 'Draft' : 'Published'}
        </Text>
        {selected.event.lifecycle === 'draft'
          ? <><Text style={setupStyles.description}>Publishing makes the scheduled check-in and feedback forms available during their windows.</Text>
            <SaveSettings title="Publish event" disabled={busy || !!editor} onPress={() => setLifecycle('publish')} /></>
          : <Action title="Archive event" disabled={busy || !!editor} onPress={() => setLifecycle('archive')} />}
      </Card>}
    </>}
      <DateTimePickerModal themeVariant="dark" isVisible={Boolean(datePicker)} mode={datePicker?.mode ?? 'date'} date={initialDate}
        onCancel={() => setDatePicker(null)} onConfirm={date => {
          if (!datePicker) return;
          setDatePicker(null);
          if (datePicker.key === 'add-day') {
            const day = calendarDay(date);
            if (!sessionDays.includes(day)) setAddedDays(current => [...current, day]);
            setChosenDay(day);
            return;
          }
          const time = [date.getHours(), date.getMinutes()].map(value => String(value).padStart(2, '0')).join(':');
          const day = datePicker.mode === 'time' ? (pickedValue || values.day).slice(0, 10) : calendarDay(date);
          updateField(datePicker.key, datePicker.mode === 'date' ? day : `${day} ${time}`);
        }} />
  </>;
}
