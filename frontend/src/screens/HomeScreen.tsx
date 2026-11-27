import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, Image, RefreshControl } from 'react-native';
import { reportCache } from '../lib/reportCache';
import { FeedbackModal } from '../components/FeedbackModal';
import {
  Home as HomeIcon,
  Settings,
  Camera,
  Bell,
  Calendar,
  Users,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Activity,
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
import { type ScheduledDashboard, workspaceRequest } from '../lib/eventWorkspace';
import { scale, verticalScale, moderateScale } from '../utils/responsive';

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
  const scheduled = selectedEvent?.event_mode === 'scheduled';
  const [scheduledDashboard, setScheduledDashboard] = useState<ScheduledDashboard | null>(null);
  const insets = useSafeAreaInsets();
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
      if (scheduled) {
        const dashboard = await workspaceRequest<ScheduledDashboard>(`/${selectedEvent.id}/dashboard`);
        setScheduledDashboard(dashboard);
        setEvents([selectedEvent]);
        setStats(previous => ({ ...previous, totalPreReg: dashboard.preRegistered, checkedIn: dashboard.attendance }));
        return;
      }
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

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

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
      {/* Top Header with Greeting */}
      <View style={styles.header}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: scale(16) }}>
          <Image 
            source={scheduled ? require('../../assets/icon.png') : require('../../assets/Synergy-01.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{getTimeGreeting()},</Text>
            <Text style={styles.userName} numberOfLines={1}>{selectedEvent?.name ?? events[0]?.name ?? 'System Admin'}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: scale(12) }}>
          <TouchableOpacity 
            style={styles.logoutBtn}
            onPress={handleLogout}
          >
            <LogOut color="#ef4444" size={moderateScale(22)} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
      >
        {loading && events.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(100)}>
            <View style={styles.statsContainer}>
              <SkeletonItem width="48%" height={scale(140)} borderRadius={moderateScale(24)} />
              <SkeletonItem width="48%" height={scale(140)} borderRadius={moderateScale(24)} />
            </View>
            <SkeletonItem width="100%" height={verticalScale(180)} borderRadius={moderateScale(24)} style={{ marginBottom: verticalScale(32) }} />
            <SkeletonItem width="100%" height={verticalScale(90)} borderRadius={moderateScale(24)} style={{ marginBottom: verticalScale(24) }} />
            <View style={{ marginBottom: verticalScale(24) }}>
              <SkeletonItem width="30%" height={verticalScale(20)} borderRadius={moderateScale(4)} style={{ marginBottom: verticalScale(16) }} />
              <View style={styles.menuGrid}>
                <SkeletonItem width="31%" height={verticalScale(120)} borderRadius={moderateScale(24)} />
                <SkeletonItem width="31%" height={verticalScale(120)} borderRadius={moderateScale(24)} />
                <SkeletonItem width="31%" height={verticalScale(120)} borderRadius={moderateScale(24)} />
              </View>
            </View>
          </Animated.View>
        ) : (
          <>
            {/* Quick Stats Grid */}
            <Animated.View entering={FadeInDown.delay(100)} style={styles.statsContainer}>
              <View style={[styles.statCard, { backgroundColor: '#064e3b' }]}>
                <View style={styles.statIconBox}>
                  <Users color="#34d399" size={moderateScale(28)} />
                </View>
                <View>
                  <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{stats.totalPreReg}</Text>
                  <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>Total Pre-Reg</Text>
                </View>
              </View>

              <View style={[styles.statCard, { backgroundColor: '#451a03' }]}>
                <View style={styles.statIconBox}>
                  <UserCheck color="#fbbf24" size={moderateScale(28)} />
                </View>
                <View>
                  <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{stats.checkedIn}</Text>
                  <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>{scheduled ? 'Check-ins' : 'Attendance'}</Text>
                </View>
              </View>
            </Animated.View>

        {/* Analytics Overview Section */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.analyticsSection}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TrendingUp color="#3b82f6" size={moderateScale(20)} />
              <Text style={styles.sectionTitle}>Analytics Pulse</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Analytics')}>
              <Text style={styles.viewAll}>View Details</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.analyticsCard}>
            {scheduled ? <>
              {scheduledDashboard?.sessions.slice(0, 3).map(session => {
                const percent = Math.min(100, Math.round(session.count / session.capacity * 100));
                return <View key={session.id} style={styles.progressSection}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressLabel}>{session.title}</Text>
                    <Text style={styles.progressPercent}>{percent}%</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
                  </View>
                  <Text style={styles.progressSubtext}>{session.venue} · {session.count} / {session.capacity} checked in</Text>
                </View>;
              })}
              {!scheduledDashboard?.sessions.length && <Text style={styles.progressSubtext}>No sessions configured yet.</Text>}
            </> : <>
            {/* AM Session Venue Capacity Fill */}
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>AM Session Venue Capacity Fill</Text>
                <Text style={styles.progressPercent}>{stats.amCapacityFill}%</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${stats.amCapacityFill}%` }]} />
              </View>
              <Text style={styles.progressSubtext}>{stats.amOccupied} / {stats.venueCapacity} slots occupied</Text>
            </View>

            <View style={styles.divider} />

            {/* PM Session Venue Capacity Fill */}
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>PM Session Venue Capacity Fill</Text>
                <Text style={[styles.progressPercent, { color: '#8b5cf6' }]}>{stats.pmCapacityFill}%</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${stats.pmCapacityFill}%`, backgroundColor: '#8b5cf6' }]} />
              </View>
              <Text style={styles.progressSubtext}>{stats.pmOccupied} / {stats.venueCapacity} slots occupied</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.attendanceGrid}>
              <View style={styles.gridCard}>
                <View style={[styles.gridIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.08)' }]}>
                  <UserCheck color="#10b981" size={moderateScale(18)} />
                </View>
                <View style={styles.gridCardContent}>
                  <Text style={styles.gridCardVal}>{stats.checkedIn}</Text>
                  <Text style={styles.gridCardLabel}>Checked-in</Text>
                </View>
              </View>

              <View style={styles.gridCard}>
                <View style={[styles.gridIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.08)' }]}>
                  <Star color="#f59e0b" size={moderateScale(16)} fill="#f59e0b" />
                </View>
                <View style={styles.gridCardContent}>
                  <Text style={styles.gridCardVal}>{evalStats.avgRating}</Text>
                  <Text style={styles.gridCardLabel}>Sentiment</Text>
                </View>
              </View>
            </View>
            </>}
          </View>
        </Animated.View>

        {/* Dedicated Evaluation Card */}
        {!scheduled && <Animated.View entering={FadeInDown.delay(250)} style={[styles.analyticsSection, { marginTop: verticalScale(16) }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Star color="#8b5cf6" size={moderateScale(20)} />
              <Text style={[styles.sectionTitle, { color: '#8b5cf6' }]}>Evaluation Pulse</Text>
            </View>
            <TouchableOpacity 
              onPress={() => {
                if (events && events.length > 0) {
                  navigation.navigate('EvaluationAnalytics', { eventId: events[0].id });
                }
              }}
            >
              <Text style={[styles.viewAll, { color: '#8b5cf6' }]}>View Insights</Text>
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
                  <Text style={styles.gridCardLabel}>AM Evals</Text>
                </View>
              </View>

              <View style={[styles.gridCard, { backgroundColor: '#0f172a', borderColor: 'rgba(139, 92, 246, 0.15)' }]}>
                <View style={[styles.gridIconBox, { backgroundColor: 'rgba(139, 92, 246, 0.08)' }]}>
                  <Edit3 color="#8b5cf6" size={moderateScale(18)} />
                </View>
                <View style={styles.gridCardContent}>
                  <Text style={styles.gridCardVal}>{evalStats.pmTotal}</Text>
                  <Text style={styles.gridCardLabel}>PM Evals</Text>
                </View>
              </View>
            </View>
          </View>
        </Animated.View>}

        {/* Featured Action Card */}
        <Animated.View entering={FadeInDown.delay(300)}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Config', { section: scheduled ? 'setup' : 'pre-reg', showParticipants: false })}
            style={styles.featuredCard}
          >
            <View style={styles.featuredContent}>
              <View style={styles.featuredIconBox}>
                <Sparkles color="white" size={moderateScale(24)} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featuredTitle}>Configure Events</Text>
                <Text style={styles.featuredSubtitle}>Set up rules, roles and registration windows.</Text>
              </View>
              <ArrowRight color="white" size={moderateScale(20)} />
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Quick Access Menu */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Quick Access</Text>
          <View style={styles.menuGrid}>
            <TouchableOpacity
              onPress={() => scheduled
                ? navigation.navigate('Config', { section: 'pre-reg', showParticipants: true })
                : navigation.navigate('ParticipantList', { eventId: selectedEvent?.id })}
              style={styles.menuBtn}
            >
              <View style={[styles.menuIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                <Users color="#3b82f6" size={moderateScale(24)} />
              </View>
              <Text style={styles.menuBtnText}>Registry</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => scheduled
                ? navigation.navigate('Config', { section: 'post-event', showParticipants: false })
                : navigation.navigate('EvaluationForm', { eventId: events[0]?.id })}
              style={styles.menuBtn}
            >
              <View style={[styles.menuIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <Edit3 color="#10b981" size={moderateScale(24)} />
              </View>
              <Text style={styles.menuBtnText}>{scheduled ? 'Feedback Forms' : 'Form Builder'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => scheduled ? navigation.navigate('Analytics')
                : navigation.navigate('EvaluationAnalytics', { eventId: selectedEvent?.id })}
              style={styles.menuBtn}
            >
              <View style={[styles.menuIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                <BarChart3 color="#f59e0b" size={moderateScale(24)} />
              </View>
              <Text style={styles.menuBtnText}>Insights</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: verticalScale(100) }} />
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
    backgroundColor: '#020617',
  },
  header: {
    paddingHorizontal: scale(24),
    paddingTop: verticalScale(24),
    paddingBottom: verticalScale(20),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    color: '#94a3b8',
    fontSize: moderateScale(16),
    fontWeight: '500',
  },
  userName: {
    color: 'white',
    fontSize: moderateScale(22),
    fontWeight: 'bold',
  },
  headerLogo: {
    width: scale(50),
    height: scale(50),
  },
  notificationBtn: {
    width: scale(50),
    height: scale(50),
    borderRadius: moderateScale(25),
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  logoutBtn: {
    width: scale(50),
    height: scale(50),
    borderRadius: moderateScale(15),
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  notifDot: {
    position: 'absolute',
    top: verticalScale(14),
    right: scale(14),
    width: scale(10),
    height: scale(10),
    borderRadius: moderateScale(5),
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#0f172a',
  },
  scrollView: {
    paddingHorizontal: scale(24),
  },
  statsContainer: {
    flexDirection: 'row',
    gap: scale(16),
    marginBottom: verticalScale(32),
  },
  statCard: {
    flex: 1,
    padding: scale(16),
    borderRadius: moderateScale(24),
    justifyContent: 'space-between',
    minHeight: scale(140),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statIconBox: {
    width: scale(48),
    height: scale(48),
    borderRadius: moderateScale(16),
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: scale(8),
  },
  statValue: {
    color: 'white',
    fontSize: moderateScale(32),
    fontWeight: 'bold',
  },
  statLabel: {
    color: 'white',
    opacity: 0.7,
    fontSize: moderateScale(14),
    fontWeight: '600',
    marginTop: 4,
  },
  analyticsSection: {
    marginBottom: verticalScale(32),
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(16),
    paddingHorizontal: scale(4),
  },
  sectionTitle: {
    color: '#64748b',
    fontSize: moderateScale(14),
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: scale(8),
  },
  viewAll: {
    color: '#3b82f6',
    fontSize: moderateScale(13),
    fontWeight: '600',
  },
  analyticsCard: {
    backgroundColor: '#0f172a',
    borderRadius: moderateScale(24),
    padding: scale(24),
    borderWidth: 1,
    borderColor: '#1e293b',
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
    color: '#64748b',
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
    backgroundColor: '#2563eb',
    borderRadius: moderateScale(24),
    padding: scale(24),
    marginBottom: verticalScale(32),
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: verticalScale(8) },
    shadowOpacity: 0.4,
    shadowRadius: moderateScale(16),
    elevation: 8,
  },
  featuredContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(16),
  },
  featuredIconBox: {
    width: scale(50),
    height: scale(50),
    borderRadius: moderateScale(15),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredTitle: {
    color: 'white',
    fontSize: moderateScale(18),
    fontWeight: 'bold',
    marginBottom: verticalScale(4),
  },
  featuredSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: moderateScale(13),
    lineHeight: moderateScale(18),
  },
  menuSection: {
    marginBottom: verticalScale(24),
  },
  menuGrid: {
    flexDirection: 'row',
    gap: scale(16),
  },
  menuBtn: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: moderateScale(24),
    padding: scale(20),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  menuIconBox: {
    width: scale(54),
    height: scale(54),
    borderRadius: moderateScale(18),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(12),
  },
  menuBtnText: {
    color: 'white',
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
});

export default HomeScreen;
