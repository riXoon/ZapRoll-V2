import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, useWindowDimensions } from 'react-native';
import { reportCache } from '../lib/reportCache';
import { FeedbackModal } from '../components/FeedbackModal';
import {
  Settings,
  CalendarDays,
  ChevronRight,
  Users,
  ArrowRight,
  TrendingUp,
  Edit3,
  LogOut,
  Star,
  BarChart3,
  UserCheck
} from 'lucide-react-native';
import Animated, { FadeInDown, withRepeat, withTiming, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { API_URL } from '../config/api';
import { scale, verticalScale, moderateScale } from '../utils/responsive';
import { BrandMark, EventBanner, eventLayout } from '../components/eventLayout';
import { eventPalette as palette } from '../components/eventPalette';

const SkeletonItem = ({ width, height, borderRadius = 8, style }: any) => {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 800 }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[
      { width, height, borderRadius, backgroundColor: '#1e293b' },
      animatedStyle,
      style
    ]} />
  );
};

const CACHE_KEY = '@home_dashboard_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const HomeScreen = ({ navigation, selectedEvent }: any) => {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const stackStats = width < 350 || fontScale > 1.45;
  const isFocused = useIsFocused();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Feedback Modal State
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackConfig, setFeedbackConfig] = useState<{
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'confirm';
    onConfirm?: () => void;
  }>({
    title: '',
    message: '',
    type: 'info'
  });

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' | 'confirm' = 'info', onConfirm?: () => void) => {
    setFeedbackConfig({ title, message, type, onConfirm });
    setFeedbackVisible(true);
  };
  const [stats, setStats] = useState({
    activeEvents: 0,
    totalPreReg: 0,
    totalRegistrations: 0,
    venueCapacity: 0,
    capacityFill: 0,
    checkedIn: 0,
    expected: 0,
    amOccupied: 0,
    amCapacityFill: 0,
    pmOccupied: 0,
    pmCapacityFill: 0
  });
  const [evalStats, setEvalStats] = useState({
    total: 0,
    amTotal: 0,
    pmTotal: 0,
    avgRating: 0
  });

  const fetchDashboardData = async (forceRefresh = false) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const cacheKey = `${CACHE_KEY}:${session.user.id}:${selectedEvent?.id ?? 'default'}`;
      if (!forceRefresh) {
        const cachedStr = reportCache.getItem(cacheKey);
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          if (Date.now() - cached.timestamp < CACHE_TTL) {
            setEvents(cached.events);
            setStats({
              ...cached.stats,
              amOccupied: cached.stats?.amOccupied || 0,
              amCapacityFill: cached.stats?.amCapacityFill || 0,
              pmOccupied: cached.stats?.pmOccupied || 0,
              pmCapacityFill: cached.stats?.pmCapacityFill || 0
            });
            setEvalStats(cached.evalStats || { total: 0, amTotal: 0, pmTotal: 0, avgRating: 0 });
            setLoading(false);
            setRefreshing(false);
            return;
          }
        }
      }

      if (!refreshing) setLoading(true);

      const path = selectedEvent ? `/api/events/${selectedEvent.id}` : '/api/events';
      const response = await fetch(`${API_URL}${path}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      const result = await response.json();

      if (result.status === 'success') {
        const fetchedEvents = selectedEvent ? [result.data] : result.data;
        setEvents(fetchedEvents);
        
        if (fetchedEvents.length > 0) {
          // Use the latest event's stats
          const latestStats = fetchedEvents[0].stats;
          const capacity = fetchedEvents[0].total_capacity || 1; // avoid div by 0

          const eventQuotas = fetchedEvents[0].event_quotas || [];
          const occupiedSlots = eventQuotas.length > 0
            ? eventQuotas.reduce((sum: number, q: any) => {
                if ((q.name || '').toLowerCase().includes('poster presenter')) return sum;
                return sum + (q.used_capacity || 0);
              }, 0)
            : (latestStats.colloquium_registered || latestStats.total_registrations || 0);

          const attendance = fetchedEvents[0].attendance || [];
          const isPoster = (a: any) => {
            const regObj = Array.isArray(a.registrations) ? a.registrations[0] : a.registrations;
            const rawRole = regObj?.metadata?.studentRole;
            if (!rawRole) return false;
            if (Array.isArray(rawRole)) {
              const hasPoster = rawRole.some(r => String(r).toLowerCase().includes('poster presenter'));
              const hasColloquium = rawRole.some(r => {
                const s = String(r).toLowerCase();
                return s.includes('colloquium presenter') || s.includes('colloquium participant');
              });
              return hasPoster && !hasColloquium;
            }
            const roleStr = String(rawRole).toLowerCase();
            return roleStr.includes('poster presenter') && !roleStr.includes('colloquium');
          };

          const amOccupied = attendance.filter((a: any) => a.am_scanned_at && !isPoster(a)).length;
          const pmOccupied = attendance.filter((a: any) => a.pm_scanned_at && !isPoster(a)).length;

          setStats({
            activeEvents: fetchedEvents.length,
            totalPreReg: latestStats.total_pre_reg || 0,
            totalRegistrations: occupiedSlots,
            venueCapacity: capacity,
            capacityFill: Math.round((occupiedSlots / capacity) * 100),
            checkedIn: latestStats.total_attended,
            expected: latestStats.total_pending,
            amOccupied,
            amCapacityFill: Math.round((amOccupied / capacity) * 100),
            pmOccupied,
            pmCapacityFill: Math.round((pmOccupied / capacity) * 100)
          });

          // Fetch Evaluation Stats
          const { data: evalData, error: evalError } = await supabase
            .from('v_evaluation_analytics')
            .select('*')
            .eq('event_id', fetchedEvents[0].id);
          
          if (!evalError && evalData) {
            let totalRating = 0;
            let ratingCount = 0;
            let evalCount = 0;
            let amEvalCount = 0;
            let pmEvalCount = 0;

            evalData.forEach(r => {
              const amRes = r.am_eval_responses || {};
              const pmRes = r.pm_eval_responses || {};
              
              if (r.am_eval_submitted_at) {
                evalCount++;
                amEvalCount++;
              }
              if (r.pm_eval_submitted_at) {
                evalCount++;
                pmEvalCount++;
              }

              // Simple heuristic to find rating values (1-5)
              Object.values(amRes).forEach((val: any) => {
                if (typeof val === 'string' && !isNaN(parseInt(val))) {
                  const n = parseInt(val);
                  if (n >= 1 && n <= 5) {
                    totalRating += n;
                    ratingCount++;
                  }
                }
              });
              Object.values(pmRes).forEach((val: any) => {
                if (typeof val === 'string' && !isNaN(parseInt(val))) {
                  const n = parseInt(val);
                  if (n >= 1 && n <= 5) {
                    totalRating += n;
                    ratingCount++;
                  }
                }
              });
            });

            setEvalStats({
              total: evalCount,
              amTotal: amEvalCount,
              pmTotal: pmEvalCount,
              avgRating: ratingCount > 0 ? parseFloat((totalRating / ratingCount).toFixed(1)) : 0
            });

            const eventQuotas = fetchedEvents[0].event_quotas || [];
            const occupiedSlots = eventQuotas.length > 0
              ? eventQuotas.reduce((sum: number, q: any) => {
                  if ((q.name || '').toLowerCase().includes('poster presenter')) return sum;
                  return sum + (q.used_capacity || 0);
                }, 0)
              : (latestStats.colloquium_registered || latestStats.total_registrations || 0);

            const attendance = fetchedEvents[0].attendance || [];
            const isPoster = (a: any) => {
              const regObj = Array.isArray(a.registrations) ? a.registrations[0] : a.registrations;
              const rawRole = regObj?.metadata?.studentRole;
              if (!rawRole) return false;
              if (Array.isArray(rawRole)) {
                const hasPoster = rawRole.some(r => String(r).toLowerCase().includes('poster presenter'));
                const hasColloquium = rawRole.some(r => {
                  const s = String(r).toLowerCase();
                  return s.includes('colloquium presenter') || s.includes('colloquium participant');
                });
                return hasPoster && !hasColloquium;
              }
              const roleStr = String(rawRole).toLowerCase();
              return roleStr.includes('poster presenter') && !roleStr.includes('colloquium');
            };

            const amOccupied = attendance.filter((a: any) => a.am_scanned_at && !isPoster(a)).length;
            const pmOccupied = attendance.filter((a: any) => a.pm_scanned_at && !isPoster(a)).length;

            reportCache.setItem(cacheKey, JSON.stringify({
              timestamp: Date.now(),
              events: fetchedEvents,
              stats: {
                activeEvents: fetchedEvents.length,
                totalPreReg: latestStats.total_pre_reg || 0,
                totalRegistrations: occupiedSlots,
                venueCapacity: capacity,
                capacityFill: Math.round((occupiedSlots / capacity) * 100),
                checkedIn: latestStats.total_attended,
                expected: latestStats.total_pending,
                amOccupied,
                amCapacityFill: Math.round((amOccupied / capacity) * 100),
                pmOccupied,
                pmCapacityFill: Math.round((pmOccupied / capacity) * 100)
              },
              evalStats: {
                total: evalCount,
                amTotal: amEvalCount,
                pmTotal: pmEvalCount,
                avgRating: ratingCount > 0 ? parseFloat((totalRating / ratingCount).toFixed(1)) : 0
              }
            }));
          }
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      showAlert('Could not load event data', error instanceof Error ? error.message : 'Please try again.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData(true);
  };

  React.useEffect(() => {
    if (isFocused) {
      fetchDashboardData();
    }
  }, [isFocused]);

  const handleLogout = async () => {
    showAlert(
      'Sign Out',
      'Are you sure you want to sign out?',
      'confirm',
      async () => {
        const { error } = await supabase.auth.signOut();
        if (error) showAlert('Error', error.message, 'error');
      }
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView 
        contentContainerStyle={[eventLayout.frame, styles.content]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
      >
        <View style={styles.header}>
          <BrandMark />
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Sign out"
            style={eventLayout.iconButton} onPress={handleLogout}>
            <LogOut color={palette.secondary} size={19} />
          </TouchableOpacity>
        </View>
        <View style={styles.bannerSpacing}>
          <EventBanner>
            <CalendarDays size={20} color={palette.blue.ink} />
            <Text accessibilityRole="header" style={eventLayout.title}>{selectedEvent?.name ?? events[0]?.name ?? 'Event overview'}</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Config', { section: 'pre-reg', showParticipants: false })}
              accessibilityRole="button"
              style={styles.featuredCard}
            >
              <Settings color={palette.text} size={19} />
              <Text style={styles.featuredTitle}>Event settings</Text>
              <ArrowRight color={palette.text} size={19} />
            </TouchableOpacity>
            {!!selectedEvent && <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('Events')} style={styles.changeEvent}>
              <Text style={styles.viewAll}>Change event</Text>
              <ChevronRight color={palette.blue.ink} size={16} />
            </TouchableOpacity>}
          </EventBanner>
        </View>

        {loading && events.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(100)}>
            <View style={[styles.statsContainer, stackStats && styles.stacked]}>
              <SkeletonItem width={stackStats ? '100%' : '48%'} height={120} borderRadius={18} />
              <SkeletonItem width={stackStats ? '100%' : '48%'} height={120} borderRadius={18} />
            </View>
            <SkeletonItem width="100%" height={112} borderRadius={18} style={{ marginBottom: 24 }} />
            <SkeletonItem width="100%" height={180} borderRadius={18} />
          </Animated.View>
        ) : (
          <>
            {/* Quick Stats Grid */}
            <Text accessibilityRole="header" style={[eventLayout.sectionTitle, styles.statsTitle]}>Event totals</Text>
            <Animated.View entering={FadeInDown.delay(100)} style={[styles.statsContainer, stackStats && styles.stacked]}>
              <View style={[eventLayout.panel, styles.statCard]}>
                <View style={[styles.statIconBox, { backgroundColor: palette.emerald.surface }]}>
                  <Users color={palette.emerald.ink} size={18} />
                </View>
                <View>
                  <Text style={styles.statValue}>{stats.totalPreReg}</Text>
                  <Text style={styles.statLabel}>Pre-registered</Text>
                </View>
              </View>

              <View style={[eventLayout.panel, styles.statCard]}>
                <View style={[styles.statIconBox, { backgroundColor: palette.amber.surface }]}>
                  <UserCheck color={palette.amber.ink} size={18} />
                </View>
                <View>
                  <Text style={styles.statValue}>{stats.checkedIn}</Text>
                  <Text style={styles.statLabel}>Attendance</Text>
                </View>
              </View>
            </Animated.View>

        {/* Quick Access Menu */}
        <View style={styles.menuSection}>
          <Text accessibilityRole="header" style={[eventLayout.sectionTitle, styles.statsTitle]}>Event tools</Text>
          <View style={styles.menuGrid}>
            <TouchableOpacity
              onPress={() => navigation.navigate('ParticipantList', { eventId: selectedEvent?.id })}
              style={styles.menuBtn} accessibilityRole="button"
            >
              <View style={[styles.menuIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                <Users color="#3b82f6" size={moderateScale(24)} />
              </View>
              <Text style={styles.menuBtnText}>Participants</Text>
              <ChevronRight color={palette.secondary} size={16} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('EvaluationForm', { eventId: events[0]?.id })}
              style={styles.menuBtn} accessibilityRole="button"
            >
              <View style={[styles.menuIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <Edit3 color="#10b981" size={moderateScale(24)} />
              </View>
              <Text style={styles.menuBtnText}>Form Builder</Text>
              <ChevronRight color={palette.secondary} size={16} />
            </TouchableOpacity>

          </View>
        </View>

        {/* Analytics Overview Section */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.analyticsSection}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TrendingUp color="#3b82f6" size={moderateScale(20)} />
              <Text style={styles.sectionTitle}>Attendance overview</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Analytics')}>
              <Text style={styles.viewAll}>View analytics</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.analyticsCard}>
            {/* Morning session */}
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Morning session</Text>
                <Text style={styles.progressPercent}>{stats.amCapacityFill}%</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${stats.amCapacityFill}%` }]} />
              </View>
              <Text style={styles.progressSubtext}>{stats.amOccupied} / {stats.venueCapacity} slots occupied</Text>
            </View>

            <View style={styles.divider} />

            {/* Afternoon session */}
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Afternoon session</Text>
                <Text style={[styles.progressPercent, { color: '#8b5cf6' }]}>{stats.pmCapacityFill}%</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${stats.pmCapacityFill}%`, backgroundColor: '#8b5cf6' }]} />
              </View>
              <Text style={styles.progressSubtext}>{stats.pmOccupied} / {stats.venueCapacity} slots occupied</Text>
            </View>

          </View>
        </Animated.View>

        {/* Dedicated Evaluation Card */}
        <Animated.View entering={FadeInDown.delay(250)} style={[styles.analyticsSection, { marginTop: verticalScale(16) }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Star color="#8b5cf6" size={moderateScale(20)} />
              <Text style={styles.sectionTitle}>Feedback</Text>
            </View>
            <TouchableOpacity 
              onPress={() => {
                if (events && events.length > 0) {
                  navigation.navigate('EvaluationAnalytics', { eventId: events[0].id });
                }
              }}
            >
              <Text style={[styles.viewAll, { color: palette.violet.ink }]}>View responses</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.analyticsCard, { borderColor: 'rgba(139, 92, 246, 0.15)' }]}>
            <View style={styles.attendanceGrid}>
              <View style={[styles.gridCard, { backgroundColor: '#0f172a', borderColor: 'rgba(59, 130, 246, 0.15)' }]}>
                <View style={[styles.gridIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.08)' }]}>
                  <BarChart3 color="#3b82f6" size={moderateScale(18)} />
                </View>
                <View style={styles.gridCardContent}>
                  <Text style={styles.gridCardVal}>{evalStats.amTotal}</Text>
                  <Text style={styles.gridCardLabel}>AM responses</Text>
                </View>
              </View>

              <View style={[styles.gridCard, { backgroundColor: '#0f172a', borderColor: 'rgba(139, 92, 246, 0.15)' }]}>
                <View style={[styles.gridIconBox, { backgroundColor: 'rgba(139, 92, 246, 0.08)' }]}>
                  <Edit3 color="#8b5cf6" size={moderateScale(18)} />
                </View>
                <View style={styles.gridCardContent}>
                  <Text style={styles.gridCardVal}>{evalStats.pmTotal}</Text>
                  <Text style={styles.gridCardLabel}>PM responses</Text>
                </View>
              </View>
            </View>
            <Text style={styles.progressSubtext}>Average rating {evalStats.avgRating}</Text>
          </View>
        </Animated.View>

        <View style={{ height: verticalScale(24) }} />
          </>
        )}
      </ScrollView>

      <FeedbackModal
        visible={feedbackVisible}
        title={feedbackConfig.title}
        message={feedbackConfig.message}
        type={feedbackConfig.type}
        onConfirm={feedbackConfig.onConfirm}
        onClose={() => setFeedbackVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  content: { paddingTop: 12, paddingBottom: 24 },
  header: {
    marginBottom: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerSpacing: { marginBottom: 24 },
  changeEvent: { minHeight: 48, marginVertical: -8, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4 },
  statsTitle: { marginBottom: 12 },
  stacked: { flexDirection: 'column' },
  statsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: 0,
    padding: 14,
    gap: 7,
  },
  statIconBox: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    color: palette.text,
    fontSize: 32,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: palette.secondary,
    fontSize: 14,
    marginTop: 4,
  },
  analyticsSection: {
    marginBottom: verticalScale(32),
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(16),
    paddingHorizontal: scale(4),
  },
  sectionTitle: {
    ...eventLayout.sectionTitle,
    marginLeft: scale(8),
  },
  viewAll: {
    color: palette.blue.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  analyticsCard: {
    ...eventLayout.panel,
    padding: 16,
  },
  progressSection: {
    marginBottom: verticalScale(20),
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(12),
  },
  progressLabel: {
    color: 'white',
    fontSize: moderateScale(15),
    fontWeight: '600',
  },
  progressPercent: {
    color: '#3b82f6',
    fontSize: moderateScale(15),
    fontWeight: 'bold',
  },
  progressBarBg: {
    height: verticalScale(8),
    backgroundColor: '#020617',
    borderRadius: moderateScale(4),
    overflow: 'hidden',
    marginBottom: verticalScale(10),
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: moderateScale(4),
  },
  progressSubtext: {
    color: palette.secondary,
    fontSize: moderateScale(12),
  },
  divider: {
    height: 1,
    backgroundColor: '#1e293b',
    marginVertical: verticalScale(4),
    marginBottom: verticalScale(20),
  },
  attendanceGrid: {
    flexDirection: 'row',
    gap: scale(12),
    alignItems: 'center',
  },
  gridCard: {
    flex: 1,
    backgroundColor: '#0b1329',
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderRadius: moderateScale(16),
    padding: scale(12),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
  },
  gridIconBox: {
    width: scale(36),
    height: scale(36),
    borderRadius: moderateScale(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCardContent: {
    flex: 1,
  },
  gridCardVal: {
    color: 'white',
    fontSize: moderateScale(16),
    fontWeight: 'bold',
  },
  gridCardLabel: {
    color: '#94a3b8',
    fontSize: moderateScale(11),
    marginTop: 2,
    fontWeight: '600',
  },
  featuredCard: {
    backgroundColor: palette.primary,
    borderRadius: 12,
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featuredTitle: {
    flex: 1,
    color: palette.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  menuSection: {
    marginBottom: verticalScale(24),
  },
  menuGrid: {
    ...eventLayout.panel,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  menuBtn: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 12,
  },
  menuIconBox: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBtnText: {
    flex: 1,
    color: palette.text,
    fontSize: 15,
    fontWeight: '600',
  },
});

export default HomeScreen;
