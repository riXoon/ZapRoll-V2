import { eventPalette as palette } from '../components/eventPalette';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, CalendarDays, ChevronRight, ClipboardCheck, LogOut, Star, UserPlus, Users, type LucideIcon } from 'lucide-react-native';
import { BrandMark, EventBanner, eventLayout } from '../components/eventLayout';
import { supabase } from '../lib/supabase';
import { workspaceRequest, type ScheduledDashboard } from '../lib/eventWorkspace';
import type { SelectedEvent } from '../lib/eventSelection';

type Session = ScheduledDashboard['sessions'][number];
type OverviewProps = { navigation: NavigationProp<ParamListBase>; event: SelectedEvent; mode: 'home' | 'analytics' };

function dateKey(date: string, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(date));
  return ['year', 'month', 'day'].map(part => parts.find(value => value.type === part)?.value).join('-');
}

function dateLabel(day: string) {
  return new Date(day + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function Section({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>;
}

function LinkRow({ icon: Icon, title, onPress, tone = palette.blue }: { icon: LucideIcon; title: string; onPress: () => void; tone?: { ink: string; surface: string } }) {
  return <TouchableOpacity accessibilityRole="button" onPress={onPress} style={styles.link}>
    <View style={[styles.iconTile, { backgroundColor: tone.surface }]}><Icon size={19} color={tone.ink} /></View>
    <Text style={styles.linkTitle}>{title}</Text>
    <ChevronRight size={16} color={palette.secondary} />
  </TouchableOpacity>;
}

function SessionRows({ sessions, timezone, showDate = true }: { sessions: Session[]; timezone: string; showDate?: boolean }) {
  const time = new Intl.DateTimeFormat(undefined, { timeZone: timezone, hour: 'numeric', minute: '2-digit' });
  return <>
    {sessions.map(session => {
      const filled = session.capacity > 0 ? Math.min(100, Math.round(session.count / session.capacity * 100)) : 0;
      return <View key={session.id} style={styles.session}>
        <Text style={styles.rowTitle}>{session.title}</Text>
        <Text style={styles.body}>{[showDate && dateLabel(dateKey(session.startsAt, timezone)), time.format(new Date(session.startsAt)), session.venue].filter(Boolean).join(' · ')}</Text>
        <View style={styles.sessionStats}>
          <View style={styles.progress}><View style={[styles.fill, { width: `${filled}%` }]} /></View>
          <Text style={styles.count}>{session.count} / {session.capacity} check-ins</Text>
        </View>
      </View>;
    })}
  </>;
}

function FilterChoices<T extends string>({ label, options, selected, onSelect }: {
  label: string; options: { key: T | null; label: string }[]; selected: T | null; onSelect: (selection: T | null) => void;
}) {
  return <View style={styles.filter}>
    <Text style={styles.filterLabel}>{label}</Text>
    <View accessibilityRole="tablist" accessibilityLabel={label} style={styles.choices}>
      {options.map(option => {
        const active = option.key === selected;
        return <TouchableOpacity key={option.key ?? 'all'} accessibilityRole="tab" accessibilityState={{ selected: active }}
          onPress={() => onSelect(option.key)} style={[styles.choice, active && styles.choiceSelected]}>
          <Text style={[styles.choiceText, active && styles.choiceTextSelected]}>{option.label}</Text>
        </TouchableOpacity>;
      })}
    </View>
  </View>;
}

export default function EventOverviewScreen({ navigation, event, mode }: OverviewProps) {
  const { top } = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const [dashboard, setDashboard] = useState<ScheduledDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [day, setDay] = useState<string | null>(null);
  const [venue, setVenue] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    let current = true;
    setLoading(true);
    setError('');
    workspaceRequest<ScheduledDashboard>(`/${event.id}/dashboard`)
      .then(data => { if (current) setDashboard(data); })
      .catch(() => { if (current) setError('Could not load event totals.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [event.id, attempt]));

  const retry = () => setAttempt(value => value + 1);
  const showSettings = (section: 'setup' | 'pre-reg' | 'event-day' | 'post-event', showParticipants = false) =>
    navigation.navigate('Config', { section, showParticipants });
  const showReports = () => navigation.navigate('Analytics');
  const changeEvent = () => navigation.navigate('Events');
  const stackTiles = width < 340 || fontScale > 1.45;
  const wideTiles = width >= 680 && fontScale <= 1.15;
  const home = mode === 'home';
  const draft = event.lifecycle === 'draft';
  const archived = event.lifecycle === 'archived';
  const primary = draft ? 'Continue setup' : archived ? 'View reports' : 'Manage check-in';
  const signOut = () => Alert.alert('Sign out?', undefined, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', onPress: async () => {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) Alert.alert('Could not sign out', signOutError.message);
    } },
  ]);

  const sessions = dashboard?.sessions ?? [];
  const sessionDay = (session: Session) => dateKey(session.startsAt, event.timezone);
  const days = [...new Set(sessions.map(sessionDay))].sort();
  const currentDay = dateKey(new Date().toISOString(), event.timezone);
  const upcomingDay = days.find(value => value >= currentDay);
  const nextDay = upcomingDay ?? days.at(-1);
  const daySessions = sessions.filter(session => sessionDay(session) === nextDay)
    .sort((first, second) => Date.parse(first.startsAt) - Date.parse(second.startsAt));
  const scheduleTitle = nextDay === currentDay ? 'Today’s sessions' : upcomingDay ? 'Upcoming sessions' : nextDay ? 'Most recent sessions' : 'Sessions';
  const venues = [...new Set(sessions.map(session => session.venue).filter(Boolean))].sort();
  const selectedDay = day && days.includes(day) ? day : null;
  const selectedVenue = venue && venues.includes(venue) ? venue : null;
  const filteredSessions = sessions.filter(session =>
    (!selectedDay || sessionDay(session) === selectedDay) && (!selectedVenue || session.venue === selectedVenue));
  const metrics = [
    { label: 'Pre-registered', count: dashboard?.preRegistered, tone: palette.emerald },
    { label: 'Total registrations', count: dashboard?.participants, tone: palette.blue },
    { label: 'Session check-ins', count: dashboard?.attendance, tone: palette.amber },
    { label: 'Feedback responses', count: dashboard?.feedback, tone: palette.violet },
  ];

  return <View style={[styles.page, { paddingTop: top }]}>
    <ScrollView contentContainerStyle={[eventLayout.frame, styles.content]} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading && !!dashboard} onRefresh={retry} tintColor="#a9caff" />}>
      <View style={styles.header}>
        {home ? <BrandMark /> : <Text accessibilityRole="header" style={eventLayout.title}>Analytics</Text>}
        {home && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Sign out"
          style={eventLayout.iconButton} onPress={signOut}>
          <LogOut size={19} color={palette.secondary} />
        </TouchableOpacity>}
      </View>

      <EventBanner>
        <View style={styles.eventMeta}>
          <View style={styles.date}>
            <CalendarDays size={16} color={palette.blue.ink} />
            <Text style={styles.dateText}>{dateLabel(event.event_date)}</Text>
          </View>
          <Text style={[styles.badge, draft ? styles.draft : archived ? styles.archived : styles.published]}>
            {draft ? 'Draft' : archived ? 'Archived' : 'Published'}
          </Text>
        </View>
        <Text accessibilityRole="header" style={eventLayout.title}>{event.name}</Text>
        {home && <TouchableOpacity accessibilityRole="button" onPress={draft ? () => showSettings('setup') : archived ? showReports : () => showSettings('event-day')}
          style={styles.primary}>
          <Text style={styles.primaryText}>{primary}</Text><ArrowRight size={19} color={palette.text} />
        </TouchableOpacity>}
        <TouchableOpacity accessibilityRole="button" style={[styles.changeEvent, styles.bannerLink]} onPress={changeEvent}>
          <Text style={styles.heroLink}>Change event</Text><ChevronRight size={16} color={palette.blue.ink} />
        </TouchableOpacity>
      </EventBanner>

      <Section title="Event totals">
        {loading && !dashboard && <ActivityIndicator accessibilityLabel="Loading event totals" color="#a9caff" />}
        {!!error && <View style={styles.errorBox}>
          <Text accessibilityRole="alert" style={styles.error}>{error}{dashboard ? ' Showing the last loaded totals.' : ''}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={retry} style={styles.changeEvent}><Text style={styles.changeText}>Try again</Text></TouchableOpacity>
        </View>}
        {!!dashboard && <View style={styles.metrics}>
          {metrics.map(metric => <View key={metric.label} style={[eventLayout.panel, styles.metric, wideTiles && styles.metricQuarter, stackTiles && styles.metricWide]}>
            <View style={[styles.metricAccent, { backgroundColor: metric.tone.ink }]} />
            <Text style={styles.metricValue}>{metric.count?.toLocaleString()}</Text>
            <Text style={styles.metricLabel}>{metric.label}</Text>
          </View>)}
        </View>}
      </Section>

      {home && <>
        <Section title="Event tools">
          <View style={[eventLayout.panel, styles.toolList]}>
            {!archived && <LinkRow icon={UserPlus} tone={palette.emerald} title="Pre-registration" onPress={() => showSettings('pre-reg')} />}
            {draft && <LinkRow icon={ClipboardCheck} tone={palette.amber} title="Session check-in" onPress={() => showSettings('event-day')} />}
            <LinkRow icon={Users} title="Participant records" onPress={() => showSettings('pre-reg', true)} />
            <LinkRow icon={Star} tone={palette.violet} title={archived ? 'Feedback exports' : 'Feedback forms'} onPress={() => showSettings('post-event')} />
          </View>
        </Section>
        {!!dashboard && !archived && <Section title={scheduleTitle}>
          {nextDay ? <>
            <Text style={styles.body}>{dateLabel(nextDay)}</Text>
            <SessionRows sessions={daySessions.slice(0, 3)} timezone={event.timezone} showDate={false} />
            {daySessions.length > 3 && <LinkRow icon={CalendarDays} tone={palette.amber} title="View all sessions" onPress={() => showSettings('event-day')} />}
          </> : <Text style={styles.body}>No sessions have been scheduled.</Text>}
        </Section>}
      </>}

      {!!dashboard && !home && <>
        <Section title="Attendance by session">
          {days.length > 1 && <FilterChoices label="Day" options={[{ key: null, label: 'All days' }, ...days.map(value => ({ key: value, label: dateLabel(value) }))]}
            selected={selectedDay} onSelect={setDay} />}
          {venues.length > 1 && <FilterChoices label="Venue" options={[{ key: null, label: 'All venues' }, ...venues.map(value => ({ key: value, label: value }))]}
            selected={selectedVenue} onSelect={setVenue} />}
          {filteredSessions.length ? <SessionRows sessions={filteredSessions} timezone={event.timezone} />
            : <Text style={styles.body}>{sessions.length ? 'No sessions match these filters.' : 'No sessions have been scheduled.'}</Text>}
        </Section>
        <Section title="Registrations by role">
          {dashboard.roles.map(role => <View key={role.id} style={styles.dataRow}>
            <Text style={[styles.rowTitle, styles.grow]}>{role.name}</Text>
            <Text style={styles.count}>{role.count.toLocaleString()}</Text>
          </View>)}
          {!dashboard.roles.length && <Text style={styles.body}>No participant roles have been added.</Text>}
          <LinkRow icon={Users} title="Participant records and exports" onPress={() => showSettings('pre-reg', true)} />
        </Section>
        <Section title="Recent check-ins">
          {dashboard.recent.map(scan => <View key={scan.id} style={styles.dataRow}>
            <View style={styles.grow}><Text style={styles.rowTitle}>{scan.name}</Text><Text style={styles.body}>{scan.role}</Text></View>
            <Text style={styles.count}>{new Date(scan.checkedInAt).toLocaleTimeString(undefined, { timeZone: event.timezone, hour: 'numeric', minute: '2-digit' })}</Text>
          </View>)}
          {!dashboard.recent.length && <Text style={styles.body}>No check-ins recorded yet.</Text>}
          <LinkRow icon={ClipboardCheck} tone={palette.amber} title="Attendance exports" onPress={() => showSettings('event-day')} />
          <LinkRow icon={Star} tone={palette.violet} title="Feedback exports" onPress={() => showSettings('post-event')} />
        </Section>
      </>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.canvas },
  content: { paddingTop: 12, paddingBottom: 28, gap: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 48 },
  eventMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  date: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  badge: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden', fontWeight: '700', fontSize: 12 },
  draft: { backgroundColor: '#483514', color: '#fde5a4' },
  archived: { backgroundColor: '#25364f', color: '#e0e9f8' },
  published: { backgroundColor: '#143e35', color: '#b6f4da' },
  dateText: { flexShrink: 1, color: palette.secondary, fontSize: 14, fontWeight: '600' },
  heroLink: { color: palette.blue.ink, fontSize: 14, fontWeight: '700' },
  changeEvent: { minHeight: 48, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4 },
  bannerLink: { marginVertical: -8 },
  changeText: { color: '#bfdbfe', fontSize: 14, fontWeight: '700' },
  primary: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, gap: 8, backgroundColor: palette.primary, borderRadius: 12 },
  primaryText: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '700' },
  section: { gap: 12, marginTop: 6 },
  sectionTitle: eventLayout.sectionTitle,
  link: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  toolList: { paddingHorizontal: 14, paddingVertical: 4 },
  iconTile: { backgroundColor: '#203659', width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  linkTitle: { flex: 1, color: '#eaf2ff', fontSize: 15, fontWeight: '600' },
  body: eventLayout.body,
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { flexBasis: '46%', flexGrow: 1, padding: 14, gap: 4 },
  metricAccent: { width: 16, height: 3, borderRadius: 2, marginBottom: 4 },
  metricLabel: { color: palette.secondary, fontSize: 14 },
  metricWide: { flexBasis: '100%' },
  metricQuarter: { flexBasis: '22%' },
  metricValue: { color: palette.text, fontWeight: '700', fontSize: 32, letterSpacing: -0.7, fontVariant: ['tabular-nums'] },
  errorBox: { padding: 10, borderRadius: 10, backgroundColor: '#2f202e' },
  error: { color: '#fecaca', fontSize: 14 },
  session: { paddingVertical: 8, gap: 6, borderBottomColor: '#30415c', borderBottomWidth: StyleSheet.hairlineWidth },
  rowTitle: { color: '#eaf2ff', fontWeight: '600', fontSize: 15 },
  count: { color: '#bfdbfe', fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  sessionStats: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: 6 },
  progress: { flex: 1, minWidth: 54, height: 5, borderRadius: 3, backgroundColor: '#293a53', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: palette.amber.ink, borderRadius: 3 },
  filter: { gap: 5 },
  filterLabel: { color: '#b3c3d8', fontSize: 13, fontWeight: '600' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  choice: { minHeight: 44, justifyContent: 'center', maxWidth: '100%', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, borderColor: '#384a66', borderWidth: 1 },
  choiceSelected: { backgroundColor: '#203659', borderColor: '#85abee' },
  choiceText: { color: '#b3c3d8', fontSize: 13, fontWeight: '600' },
  choiceTextSelected: { color: '#eff6ff' },
  grow: { flex: 1, minWidth: 0, gap: 3 },
  dataRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 42, paddingVertical: 5, borderBottomColor: '#30415c', borderBottomWidth: StyleSheet.hairlineWidth },
});
