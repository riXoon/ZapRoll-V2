import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Switch, Text, TextInput, useWindowDimensions, TouchableOpacity, View } from 'react-native';
import { NavigationProp, ParamListBase, useFocusEffect } from '@react-navigation/native';
import { styles as theme } from '../components/eventSettingsStyles';
import { SettingsHeading } from '../components/SettingsHeading';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Calendar, ChevronRight, Clock, LayoutDashboard, Users, Plus, Star, ClipboardCheck, Save, QrCode, MapPin, Pencil, Download, type LucideIcon } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { calendarDay, newEventRequestId, workspaceRequest } from '../lib/eventWorkspace';
import { type SelectedEvent, useEventSelection } from '../lib/eventSelection';

type Role = {
  id: string; name: string; registration_capacity: number; student_priority: boolean;
  registration_url: string | null; required_fields: string[];
  qr_url: string | null; registrations?: { count: number }[];
};
type Venue = { id: string; name: string; capacity: number; role_caps: Record<string, number> };
type Session = {
  id: string; title: string; venue_id: string; starts_at: string; ends_at: string;
  checkin_opens_at: string; walkins_open_at: string; capacity: number;
  reserved_students: number; role_caps: Record<string, number>; attendance_url: string | null; feedback_url: string | null;
  checkins?: { count: number }[];
  attendance_qr_url: string | null; feedback_qr_url: string | null;
};
type Person = { id: string; full_name: string; email: string; role_id: string; source: string };
type SettingsEvent = SelectedEvent & { pre_reg_manual?: boolean; pre_reg_open?: boolean };
type Workspace = { event: SettingsEvent; roles: Role[]; venues: Venue[]; sessions: Session[]; pre_registration_url?: string | null };
type Editor = { action: 'settings' | 'role' | 'venue' | 'session' | 'feedback'; values: Record<string, string>; priority?: boolean };
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

function Action({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return <TouchableOpacity accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled: !!disabled }}
    style={[theme.menuItem, { minHeight: 48 }, disabled && { opacity: 0.5 }]} onPress={onPress}>
    <Text style={[theme.menuItemTitle, { flex: 1 }]}>{title}</Text>
    <ChevronRight color="#64748b" size={18} />
  </TouchableOpacity>;
}

function Card({ title, icon, children, add, badge }: React.PropsWithChildren<{
  title: string; icon: LucideIcon; add?: { label: string; run: () => void; disabled?: boolean }; badge?: string;
}>) {
  const small = useWindowDimensions().width < 420;
  return <View style={[theme.card, small && { padding: 16 }]}>
    <View style={[theme.cardHeaderRow, { flexWrap: 'wrap', gap: 8 }]}>
      <SettingsHeading icon={icon} title={title} />
      {badge && <View style={[theme.statusBadge, theme.statusBadgeEdit]}>
        <Text style={[theme.statusBadgeText, { color: '#60a5fa' }]}>{badge.toUpperCase()}</Text>
      </View>}
      {add && <TouchableOpacity accessibilityLabel={add.label} accessibilityRole="button"
        accessibilityState={{ disabled: !!add.disabled }} disabled={add.disabled}
        style={[theme.addButton, add.disabled && { opacity: 0.45 }]} hitSlop={6} onPress={add.run}>
        <Plus color="#3b82f6" size={18} />
      </TouchableOpacity>}
    </View>
    {children}
  </View>;
}

function SaveSettings({ onPress, disabled, title = "Save Configuration" }: { onPress: () => void; disabled: boolean; title?: string }) {
  return <TouchableOpacity accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }}
    style={[theme.saveButton, disabled && theme.saveButtonDisabled]} onPress={onPress}>
    <Save color="white" size={18} /><Text style={theme.saveButtonText}>{title}</Text>
  </TouchableOpacity>;
}

function FormLink({ value, label, qr, onPress }: {
  value: string | null; label: string; qr: string | null; onPress: (url: string) => void;
}) {
  return <View style={[theme.roleRow, { gap: 8, marginVertical: 8 }]}>
    <Text style={[theme.input, { flex: 1, fontSize: 13 }]} numberOfLines={2}>{value || label}</Text>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={label + ' QR code'}
      accessibilityState={{ disabled: !qr }} disabled={!qr} onPress={() => qr && onPress(qr)}
      style={[theme.qrIconBtn, { backgroundColor: '#0f172a', borderRadius: 10, minHeight: 44, minWidth: 44 }]}>
      <QrCode size={20} color={qr ? '#60a5fa' : '#64748b'} />
    </TouchableOpacity>
  </View>;
}

const registration = StyleSheet.create({
  item: { gap: 10, marginBottom: 12 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  detail: { color: '#a8b7cc', fontSize: 13 },
  title: { color: '#f8fafc', fontSize: 16, fontWeight: '700' },
  iconButton: { minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'center' },
  quotas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quota: { color: '#cbd5e1', backgroundColor: '#1e293b', paddingVertical: 5, paddingHorizontal: 9, borderRadius: 8 },
  day: { color: '#93c5fd', marginLeft: 0, marginTop: 8, marginBottom: 10 },
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

function FormBuilderCard({ title, action, prompt, empty, choices, disabled }: {
  title: string; action: string; prompt: string; empty: string; disabled?: boolean;
  choices: { id: string; label: string; open: () => void }[];
}) {
  const [expanded, setExpanded] = useState(false);
  return <Card title={title} icon={Pencil}>
    {choices.length ? <>
      <Action title={action} disabled={disabled} onPress={() => setExpanded(value => !value)} />
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
};

export default function ScheduledEventSettings({ navigation, event, activeTab, showParticipants }: Props) {
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

  const setValue = (key: string, value: string) => {
    setEditor(current => current && ({ ...current, values: { ...current.values, [key]: value } }));
  };

  const roleCaps = (values: Record<string, string>) => Object.fromEntries(
    (selected?.roles || []).filter(role => values[`cap-${role.id}`])
      .map(role => [role.id, count(values[`cap-${role.id}`])]),
  );

  const save = (entry: Editor) => perform(async () => {
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
    if (action === 'venue') Object.assign(body, { name: v.name, capacity: count(v.capacity), role_caps: roleCaps(v) });
    if (action === 'session') Object.assign(body, {
      title: v.title, venue_id: v.venue_id, capacity: count(v.capacity), role_caps: roleCaps(v),
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
      setIdentityChanges({});
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
    if (action === 'publish') void change();
    else Alert.alert(`Archive ${name}?`, 'This closes registration, check-ins, and feedback. Reports remain available.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Archive', style: 'destructive', onPress: change },
    ]);
  };

  const showQr = (link: string, title: string, type?: string) => {
    if (!selected) return;
    navigation.navigate('QRGenerator', { url: link, title, eventName: selected.event.name, isOpen: true, type });
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
  const identity = {
    name: selected?.event.name || '', event_date: selected?.event.event_date || '',
    registration_opens_at: localDateTime(selected?.event.registration_opens_at ?? null, 'Asia/Manila'),
    pre_reg_deadline: localDateTime(selected?.event.pre_reg_deadline ?? null, 'Asia/Manila'),
    ...identityChanges,
  };
  const inlineRole = editor?.action === 'role' ? editor : null;
  const values: Record<string, string> = editor && !inlineRole ? editor.values : identity;
  const updateField = (key: string, value: string) => {
    if (editor && !inlineRole) setValue(key, value);
    else setIdentityChanges(current => ({ ...current, [key]: value }));
  };
  const field = (key: string, label: string, numeric = false) => <View key={key} style={theme.inputGroup}>
    <Text style={theme.label}>{label}</Text>
    <TextInput accessibilityLabel={label} style={[theme.input, !editable && theme.disabledInput]}
      editable={editable && !busy} keyboardType={numeric ? 'number-pad' : 'default'}
      value={values[key] || ''} onChangeText={value => updateField(key, value)} />
  </View>;
  const dateField = (key: string, label: string, mode: PickerMode = 'datetime', emptyLabel?: string) => {
    const value = values[key];
    const display = mode === 'time' && value?.startsWith(values.day + ' ') ? value.slice(11) : value;
    return <View style={theme.inputGroup}>
      <Text style={theme.label}>{label}</Text>
      <TouchableOpacity style={[theme.input, !editable && theme.disabledInput]} disabled={!editable || busy}
        accessibilityRole="button" accessibilityLabel={label} accessibilityValue={{ text: display || emptyLabel || 'Unset' }}
        onPress={() => setDatePicker({ key, mode })}>
        <Text style={{ color: display ? 'white' : '#94a3b8', fontSize: 16 }}>
          {display || emptyLabel || (mode === 'date' ? 'Select Date' : mode === 'time' ? 'Select Time' : 'Select Date and Time')}
        </Text>
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

  const savedRoles = selected?.roles ?? [];
  const current = selected?.event;
  const now = Date.now();
  const registrationOpen = !!current && editable && (current.pre_reg_manual ? !!current.pre_reg_open :
    current.lifecycle === 'active' && now >= Date.parse(current.registration_opens_at || '') && now < Date.parse(current.pre_reg_deadline || ''));
  const toggleRegistration = (open: boolean) => perform(async () => {
    const saved = await workspaceRequest<SettingsEvent>(`/${event.id}/actions/pre-reg-status`, { open });
    setSelected(workspace => workspace && ({ ...workspace, event: saved }));
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
      {isSetup && <Card title="Session Details" icon={Calendar}>
        {field('title', 'Session title')}
        <Text style={theme.label}>Venue</Text>
        {selected?.venues.map(venue => {
          const chosen = editor.values.venue_id === venue.id;
          return <TouchableOpacity key={venue.id} accessibilityRole="radio" accessibilityState={{ checked: chosen }}
            disabled={busy} style={[theme.roleCard, registration.choice, chosen && { borderColor: '#3b82f6' }]}
            onPress={() => !chosen && setEditor({ ...editor, values: {
              ...Object.fromEntries(Object.entries(editor.values).filter(([key]) => !key.startsWith('cap-'))),
              venue_id: venue.id, capacity: String(venue.capacity), ...capacityValues(venue.role_caps),
            } })}>
            <Text style={registration.title}>{chosen ? '✓  ' : ''}{venue.name}</Text>
          </TouchableOpacity>;
        })}
      </Card>}
      <Card title="Session Schedule" icon={Clock}>
        <Text style={[registration.detail, { marginBottom: 16 }]}>{dayLabel(editor.values.day)} · Manila time</Text>
        {dateField('starts_at', 'Session starts', 'time')}{dateField('ends_at', 'Session ends', 'time')}
        {dateField('checkin_opens_at', 'Check-in opens', 'time', 'At session start')}
        {dateField('walkins_open_at', 'Walk-ins open', 'time', 'No walk-ins during session')}
      </Card>
      {isSetup && <Card title="Session Capacity" icon={Users}>
        <Text style={theme.label}>Checked in: {selected?.sessions.find(session => session.id === editor.values.id)?.checkins?.[0]?.count ?? 0}</Text>
        {field('capacity', 'Total capacity', true)}
        {selected?.roles.map(role => field(`cap-${role.id}`, `${role.name} capacity`, true))}
        {field('reserved_students', 'Seats protected for pre-registered students', true)}
      </Card>}
      <Card title="Attendance Form" icon={QrCode}>{field('attendance_url', 'Attendance form URL (optional)')}</Card>
      <SaveSettings title="Save session" disabled={busy} onPress={() => save(editor)} />
      <Action title="Cancel" disabled={busy} onPress={() => setEditor(null)} />
    </> : editor?.action === 'feedback' ? <View style={styles.card}>
      <View style={theme.cardHeaderRow}><SettingsHeading icon={Star} title="Session feedback" /></View>
      {field('feedback_url', 'Optional feedback form URL')}
      <SaveSettings disabled={busy} onPress={() => save(editor)} />
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
      {selected.event.lifecycle === 'archived' && <Text style={styles.label}>This event is archived. Reports are read-only.</Text>}
      {(isSetup || activeTab === 'pre-reg') && <>
        {isSetup && <Card title="Event Identity" icon={LayoutDashboard} badge={selected.event.lifecycle}>
          {field('name', 'Event Name')}
          {dateField('event_date', 'Event Date', 'date')}
        </Card>}
        {!isSetup && <Card title="Execution Rules" icon={Clock}>
          <View style={theme.controlRow}>
            <View style={{ flex: 1 }}>
              <Text style={theme.controlLabel}>Pre-Registration Status</Text>
              <Text style={theme.controlSubtitle}>{registrationOpen ? 'Open' : 'Closed'} · {current?.pre_reg_manual ? 'Manual control' : 'Switch to open or close manually'}</Text>
            </View>
            <Switch accessibilityLabel="Pre-registration open" disabled={busy || !editable}
              value={registrationOpen} onValueChange={toggleRegistration} trackColor={{ false: '#334155', true: '#2563eb' }} />
          </View>
          {!current?.pre_reg_manual && <>
            {dateField('registration_opens_at', 'Pre-Registration Opens (Manila time)')}
            {dateField('pre_reg_deadline', 'Automatic Closing Deadline (Manila time)')}
          </>}
        </Card>}
        {editable && <SaveSettings disabled={busy || !Object.keys(identityChanges).length}
          onPress={() => save({ action: 'settings', values: identity })} />}
        {!isSetup && selected.pre_registration_url && <Card title="Pre-Registration Link" icon={QrCode}>
          <FormLink label="Pre-registration" value={selected.pre_registration_url}
            qr={editable ? selected.pre_registration_url : null} onPress={url => showQr(url, 'Pre-registration', 'pre-reg')} />
        </Card>}
        {!isSetup && editable && <FormBuilderCard title="Pre-Reg Form Builder" action="Design Pre-Registration Form"
          prompt="Choose a role" empty="Add a participant role in Setup to design its pre-registration form."
          disabled={busy || !!inlineRole}
          choices={savedRoles.map(role => ({
            id: role.id,
            label: role.name,
            open: () => navigation.navigate('EvaluationForm', {
              eventId: event.id, eventName: selected.event.name, roleId: role.id, roleName: role.name,
            }),
          }))} />}
        <Card title={isSetup ? "Role Quotas" : selected.pre_registration_url ? "Role Settings" : "Pre-Registration Forms"} icon={Users} add={editable && isSetup ? { label: 'Add participant role', disabled: !!inlineRole || busy,
          run: () => setEditor({ action: 'role', values: { id: newEventRequestId() } }) } : undefined}>
          {isSetup && <><View style={[theme.card, theme.preRegShortcut, { padding: 12, marginBottom: 16 }]}>
            <Text style={theme.controlLabel}>Registration Rules</Text>
            <Text style={theme.controlSubtitle}>Set how many people can pre-register once for the whole event, per role. Set day and venue limits separately in Event Days.</Text>
          </View>
          <View style={theme.summaryBox}>
            <View style={theme.summaryItem}><Text style={theme.summaryLabel}>ASSIGNED SLOTS</Text><Text style={theme.summaryValue}>{quotaTotal}</Text></View>
            <View style={theme.summaryDivider} />
            <View style={theme.summaryItem}><Text style={theme.summaryLabel}>AVAILABLE SLOTS</Text><Text style={[theme.summaryValue, { color: '#10b981' }]}>{usageKnown ? Math.max(0, quotaTotal - usedTotal) : '?'}</Text></View>
          </View>
          </>}
          {!roles.length && <Text style={theme.controlSubtitle}>{isSetup ? 'Use + to add the first role.' : 'Add participant roles in Setup first.'}</Text>}
          {roles.map(role => {
            const editing = !!inlineRole && (!role || role.id === inlineRole.values.id);
            const enabled = editable && !busy && (!inlineRole || editing);
            const entry: Editor = editing ? inlineRole : { action: 'role', priority: role?.student_priority, values: {
              id: role!.id, name: role!.name, registration_capacity: String(role!.registration_capacity),
              registration_url: role!.registration_url || '', required_fields: role!.required_fields.join(', '),
            } };
            const change = (key: string, value: string) => setEditor({ ...entry, values: { ...entry.values, [key]: value } });
            const input = (key: string, label: string, flex = 1) => <TextInput accessibilityLabel={label} placeholder={label}
              placeholderTextColor="#94a3b8" editable={enabled} style={[theme.input, { flex: key === 'required_fields' ? undefined : flex, minWidth: 0, fontSize: 14 }]}
              autoCapitalize={key === 'name' ? 'words' : 'none'} keyboardType={key === 'registration_capacity' ? 'number-pad' : key === 'registration_url' ? 'url' : 'default'}
              value={entry.values[key] || ''} onChangeText={value => change(key, value)} />;
            const limit = Number(entry.values.registration_capacity) || 0;
            const used = role ? role.registrations?.[0]?.count ?? (role.registrations ? 0 : null) : 0;
            const qr = editable && role?.registration_url === entry.values.registration_url && role?.qr_url;
            return <View key={entry.values.id} style={[theme.roleCard, { marginBottom: 12, gap: 10 }]}>
              {isSetup ? <><View style={[theme.roleRow, { gap: 8 }]}>{input('name', 'Role', 2)}{input('registration_capacity', 'Slots')}</View>
              <View>
                <View style={theme.usageHeader}><Text style={theme.usageLabel}>CAPACITY USAGE</Text>
                  <Text style={theme.usageRemaining}>{used === null ? '?' : Math.max(0, limit - used) + ' left'}</Text></View>
                <View style={theme.progressBarBg}><View style={[theme.progressBarFill, {
                  width: `${Math.min(100, (used ?? 0) / (limit || 1) * 100)}%`, backgroundColor: used && used >= limit ? '#ef4444' : '#10b981',
                }]} /></View>
                <Text style={theme.roleUsageStats}>{used ?? '?'} / {limit} registered</Text>
              </View>
              </> : <Text style={registration.title}>{role?.name}</Text>}
               {!isSetup && !selected.pre_registration_url && <View style={[theme.roleRow, { gap: 8 }]}>
                {input('registration_url', 'Registration Link (Optional)')}
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Pre-registration QR" disabled={!qr}
                  style={theme.qrIconBtn} onPress={() => qr && showQr(qr, role!.name)}><QrCode size={18} color={qr ? '#10b981' : '#64748b'} /></TouchableOpacity>
              </View>}
              {enabled && !editing && <Action title={isSetup ? "Role settings" : "Edit form settings"} onPress={() => setEditor(entry)} />}
              {editing && <>
                {!isSetup && input('required_fields', 'Required form field keys (comma-separated)')}
                {isSetup && <View style={styles.row}><Text style={[theme.controlSubtitle, { flex: 1 }]}>Eligible for protected student places</Text>
                  <Switch accessibilityLabel="Eligible for protected student places" disabled={!!role || busy}
                    value={!!entry.priority} onValueChange={priority => setEditor({ ...entry, priority })} /></View>}
                <Action title={isSetup ? "Save role" : "Save form settings"} disabled={busy || !entry.values.name?.trim() || !/^\d{1,9}$/.test(entry.values.registration_capacity || '')}
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
        {!isSetup && editable && <FormBuilderCard title="Attendance Form Builder" action="Design Attendance Form"
          prompt="Choose a session" empty="Add a session in Setup to design its attendance form."
          disabled={busy} choices={sessionFormChoices('attendance')} />}
        {isSetup && <Card title="Venues" icon={MapPin} add={editable ? { label: 'Add venue', disabled: busy || !!venueEditor || !selected.roles.length,
          run: () => setEditor({ action: 'venue', values: { id: newEventRequestId() } }) } : undefined}>
          {!venueRows.length && <Text style={registration.detail}>{!editable ? 'No venues configured.' : selected.roles.length
            ? 'Use + to add a venue and set its role capacities.' : 'Add participant roles above first.'}</Text>}
          {venueRows.map(venue => {
            if (venueEditor && (!venue || venue.id === venueEditor.values.id)) {
              return <View key={venueEditor.values.id} style={[theme.roleCard, registration.item]}>
                {field('name', 'Venue name')}{field('capacity', 'Total venue capacity', true)}
                <SettingsHeading icon={Users} title="Role capacities" />
                {selected.roles.map(role => field(`cap-${role.id}`, `${role.name} capacity`, true))}
                <View style={registration.line}>
                  <TouchableOpacity accessibilityRole="button" style={[registration.save, busy && { opacity: 0.5 }]}
                    disabled={busy} onPress={() => save(venueEditor)}><Text style={theme.saveButtonText}>Save venue</Text></TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button" style={registration.iconButton} disabled={busy} onPress={() => setEditor(null)}>
                    <Text style={registration.detail}>Cancel</Text></TouchableOpacity>
                </View>
              </View>;
            }
            if (!venue) return null;
            return <View key={venue.id} style={[theme.roleCard, registration.item]}>
              <View style={registration.line}><View style={registration.copy}>
                <Text style={registration.title}>{venue.name}</Text><Text style={registration.detail}>{venue.capacity} seats</Text>
              </View>
              {editable && <EditControl label={`Edit ${venue.name}`} disabled={busy || !!venueEditor} onPress={() => setEditor({ action: 'venue', values: {
                id: venue.id, name: venue.name, capacity: String(venue.capacity), ...capacityValues(venue.role_caps),
              } })} />}</View>
              <View style={registration.quotas}>{selected.roles.filter(role => role.id in venue.role_caps).map(role =>
                <Text key={role.id} style={registration.quota}>{role.name} · {venue.role_caps[role.id]}</Text>)}</View>
            </View>;
          })}
        </Card>}
        <Card title={isSetup ? "Event Days" : "Attendance Sessions"} icon={Calendar}>
          {!isSetup && !selected.sessions.length && <Text style={registration.detail}>Add sessions in Setup first.</Text>}
          {sessionDays.map((day, index) => {
            const sessions = selected.sessions.filter(session => localDateTime(session.starts_at, 'Asia/Manila').startsWith(day));
            if (!isSetup && !sessions.length) return null;
            return <View key={day} style={registration.item}>
              <Text accessibilityRole="header" style={[theme.sectionLabel, registration.day]}>
                Day {index + 1} · {dayLabel(day)}
              </Text>
              {!sessions.length && <Text style={registration.detail}>No sessions configured.</Text>}
              {sessions.map(session => {
                const start = localDateTime(session.starts_at, 'Asia/Manila');
                const end = localDateTime(session.ends_at, 'Asia/Manila');
                return (
                  <View key={session.id} style={[theme.roleCard, registration.item]}>
                    <View style={registration.line}><View style={registration.copy}>
                      <Text style={registration.title}>{session.title}</Text>
                      <Text style={registration.detail}>{selected.venues.find(venue => venue.id === session.venue_id)?.name}</Text>
                    </View>{editable && <EditControl label={`Edit ${session.title}`} disabled={busy || !!venueEditor} onPress={() => editSession(day, session)} />}</View>
                    <Text style={registration.detail}>{start.slice(11)} – {end.startsWith(day) ? end.slice(11) : end}</Text>
                    <Text style={theme.usageRemaining}>{session.checkins?.[0]?.count ?? 0} / {session.capacity} checked in</Text>
                    {editable && <FormLink label="Attendance form" value={session.attendance_url} qr={session.attendance_qr_url} onPress={url => showQr(url, session.title, 'session-attendance')} />}
                    {!isSetup && <ExportControl title="Export session attendance" disabled={busy} onPress={() => void share('attendance', session.id)} />}
                  </View>
                );
              })}
              {isSetup && editable && <Action title={`Add session to Day ${index + 1}`} disabled={busy || !!venueEditor || !selected.venues.length}
                onPress={() => editSession(day)} />}
            </View>;
          })}
          {isSetup && editable && <Action title="Add event day" disabled={busy || !!venueEditor}
            onPress={() => setDatePicker({ key: 'add-day', mode: 'date' })} />}
        </Card>
        {!isSetup && <Card title="Attendance Records" icon={ClipboardCheck}>
          <ExportControl title="Export all attendance" disabled={busy} onPress={() => void share('attendance')} />
        </Card>}
      </>}
      {activeTab === 'post-event' && <>
        {editable && <FormBuilderCard title="Eval Form Builder" action="Design Evaluation Form"
          prompt="Choose a session" empty="Add a session in Setup to design its evaluation form."
          choices={sessionFormChoices('evaluation')} />}
        <Card title="Evaluation Forms" icon={Star}>
        {!selected.sessions.length && <Text style={styles.label}>Add a session in Setup to configure its feedback form.</Text>}
        {selected.sessions.map(session => <View key={session.id} style={[theme.roleCard, { marginBottom: 12 }]}>
          <Text style={theme.controlLabel}>{session.title}</Text>
          <FormLink label="Optional feedback form" value={session.feedback_url} qr={editable ? session.feedback_qr_url : null} onPress={url => showQr(url, session.title + ' feedback')} />
          {editable && <Action title="Edit feedback link" onPress={() => setEditor({ action: 'feedback', values: {
            id: session.id, feedback_url: session.feedback_url || '',
          } })} />}
        </View>)}
        </Card>
        <Card title="Participant Data" icon={Users}>
        <Action title="Export feedback" disabled={busy} onPress={() => void share('feedback')} />
        </Card>
      </>}
      {selected.event.lifecycle === 'draft' && <Action title="Publish event" disabled={busy} onPress={() => setLifecycle('publish')} />}
      {selected.event.lifecycle === 'active' && <Action title="Archive event" disabled={busy} onPress={() => setLifecycle('archive')} />}
    </>}
      <DateTimePickerModal themeVariant="dark" isVisible={Boolean(datePicker)} mode={datePicker?.mode ?? 'date'} date={initialDate}
        onCancel={() => setDatePicker(null)} onConfirm={date => {
          if (!datePicker) return;
          setDatePicker(null);
          if (datePicker.key === 'add-day') {
            const day = calendarDay(date);
            if (!sessionDays.includes(day)) setAddedDays(current => [...current, day]);
            return;
          }
          const time = [date.getHours(), date.getMinutes()].map(value => String(value).padStart(2, '0')).join(':');
          const day = datePicker.mode === 'time' ? (pickedValue || values.day).slice(0, 10) : calendarDay(date);
          updateField(datePicker.key, datePicker.mode === 'date' ? day : `${day} ${time}`);
        }} />
  </>;
}
