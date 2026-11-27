import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Modal, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { FeedbackModal } from '../components/FeedbackModal';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Clock, 
  ChevronRight, 
  Activity,
  ArrowUpRight,
  Filter,
  FileDown,
  FileSpreadsheet,
  GraduationCap,
  Briefcase,
  X,
  LogOut,
  ChevronLeft
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeInRight, Layout, withRepeat, withTiming, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';
import { supabase } from '../lib/supabase';
import { API_URL } from '../config/api';
import { type ScheduledDashboard, workspaceRequest } from '../lib/eventWorkspace';
import { useIsFocused } from '@react-navigation/native';

const SkeletonItem = ({ width, height, borderRadius = 8, style }: any) => {
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
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

const AnalyticsScreen = ({ navigation, selectedEvent }: any) => {
  const scheduled = selectedEvent?.event_mode === 'scheduled';
  const [dashboard, setDashboard] = useState<ScheduledDashboard | null>(null);
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 420;
  const isExtraSmall = width < 370;
  
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [activeCategory, setActiveCategory] = useState<'Student' | 'Employee'>('Student');
  const [selectedYear, setSelectedYear] = useState('All');
  const [selectedDept, setSelectedDept] = useState('All');
  
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [event, setEvent] = useState<any>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [recentScans, setRecentScans] = useState<any[]>([]);

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

  const fetchAnalyticsData = async () => {
    try {
      if (scheduled) {
        const data = await workspaceRequest<ScheduledDashboard>(`/${selectedEvent.id}/dashboard`);
        setDashboard(data);
        setRecentScans(data.recent.map(scan => ({
          ...scan, status: 'In', time: new Date(scan.checkedInAt).toLocaleTimeString([], {
            timeZone: selectedEvent.timezone, hour: 'numeric', minute: '2-digit',
          }),
        })));
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // 1. Fetch Latest Event
      const path = selectedEvent ? `/api/events/${selectedEvent.id}` : '/api/events';
      const eventRes = await fetch(`${API_URL}${path}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const eventData = await eventRes.json();
      
      const activeEvent = selectedEvent ? eventData.data : eventData.data?.[0];
      if (eventData.status === 'success' && activeEvent) {
        setEvent(activeEvent);

        // 2. Fetch ALL registrations for this event to calculate breakdowns
        const { data: regs, error: regError } = await supabase
          .from('registrations')
          .select('*, quota:event_quotas(name)')
          .eq('event_id', activeEvent.id);
        
        if (regError) throw regError;
        setRegistrations(regs || []);

        // 3. Fetch Recent Scans (Join with registrations)
        const { data: scans, error: scanError } = await supabase
          .from('attendance')
          .select(`
            id, 
            am_scanned_at, 
            pm_scanned_at, 
            employee_scanned_at,
            registration:registrations!registration_id(full_name, metadata)
          `)
          .eq('event_id', activeEvent.id)
          .order('am_scanned_at', { ascending: false })
          .limit(10);
        
        if (scanError) throw scanError;
        
        const formattedScans = (scans || []).map(s => {
          const scanDate = new Date(s.am_scanned_at || s.pm_scanned_at || s.employee_scanned_at);
          // Handle the case where registration is an array (Supabase join result)
          const reg = Array.isArray(s.registration) ? s.registration[0] : s.registration;
          
          return {
            id: s.id,
            name: reg?.full_name || 'Unknown',
            role: reg?.metadata?.category || 'Participant',
            time: scanDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }),
            status: 'In'
          };
        });        
        setRecentScans(formattedScans);
      }
    } catch (error) {
      console.error('Analytics Fetch Error:', error);
      showAlert('Could not load analytics', error instanceof Error ? error.message : 'Please try again.', 'error');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  React.useEffect(() => {
    if (isFocused) {
      fetchAnalyticsData();
    }
  }, [isFocused]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAnalyticsData();
  };

  // Process Breakdown Data
  const getStudentBreakdown = () => {
    const students = registrations.filter(r => r.metadata?.category === 'student' || r.quota?.name === 'Student');
    
    if (selectedYear === '4th Year') {
      // 4th Year Specific Role Breakdown
      const fourthYears = students.filter(s => s.metadata?.yearLevel === '4th Year');
      const roles = ['Poster Presenter', 'Colloquium Presenter', 'Colloquium Participant'];
      const colors = ['#10b981', '#3b82f6', '#8b5cf6'];
      
      const hasRole = (studentRole: any, targetRole: string) => {
        if (!studentRole) return false;
        const normalizedTarget = targetRole.toLowerCase().trim();
        const checkSingle = (roleStr: string) => {
          const s = roleStr.toLowerCase().trim();
          if (s === normalizedTarget) return true;
          if (normalizedTarget.includes('poster') && s.includes('poster')) return true;
          if (normalizedTarget.includes('presenter') && s.includes('presenter') && !s.includes('poster') && !normalizedTarget.includes('poster')) return true;
          if (normalizedTarget.includes('participant') && s.includes('participant')) return true;
          return false;
        };
        if (Array.isArray(studentRole)) {
          return studentRole.some(r => checkSingle(String(r)));
        }
        return checkSingle(String(studentRole));
      };

      const counts = roles.map((role, idx) => ({
        label: role,
        count: fourthYears.filter(s => hasRole(s.metadata?.studentRole, role)).length,
        color: colors[idx]
      }));
      
      const total = fourthYears.length || 1;
      return counts.map(c => ({ ...c, val: Math.round((c.count / total) * 100) }));
    }

    const years = ['3rd Year', '4th Year'];
    const counts = years.map(year => ({
      label: year,
      count: students.filter(s => s.metadata?.yearLevel === year).length,
      color: year === '3rd Year' ? '#3b82f6' : '#60a5fa'
    }));
    
    const total = students.length || 1;
    return counts.map(c => ({ ...c, val: Math.round((c.count / total) * 100) }));
  };

  const getEmployeeBreakdown = () => {
    const employees = registrations.filter(r => r.metadata?.category === 'employee' || r.quota?.name === 'Employee');
    const depts = Array.from(new Set(employees.map(e => e.metadata?.department).filter(Boolean)));
    
    // If no departments found, show a default or placeholder
    if (depts.length === 0) return [{ label: 'General', val: 100, color: '#8b5cf6', count: employees.length }];

    const colors = ['#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#e9d5ff'];
    const counts = depts.map((dept: any, idx) => ({
      label: dept,
      count: employees.filter(e => e.metadata?.department === dept).length,
      color: colors[idx % colors.length]
    }));

    const total = employees.length || 1;
    return counts.map(c => ({ ...c, val: Math.round((c.count / total) * 100) }));
  };

  const studentBreakdown = getStudentBreakdown();
  const employeeBreakdown = getEmployeeBreakdown();

  // Dynamic Chips for Employees
  const employeeDepts = Array.from(new Set(registrations
    .filter(r => r.metadata?.category === 'employee' || r.quota?.name === 'Employee')
    .map(e => e.metadata?.department)
    .filter(Boolean))) as string[];
  const employeeChips = ['All', ...employeeDepts];

  // Filtered stats
  const getFilteredStats = () => {
    let filtered = registrations.filter(r => {
      const isRole = activeCategory === 'Student' 
        ? (r.metadata?.category === 'student' || r.quota?.name === 'Student')
        : (r.metadata?.category === 'employee' || r.quota?.name === 'Employee');
      
      if (!isRole) return false;

      if (activeCategory === 'Student' && selectedYear !== 'All') {
        return r.metadata?.yearLevel === selectedYear;
      }
      if (activeCategory === 'Employee' && selectedDept !== 'All') {
        return r.metadata?.department === selectedDept;
      }
      return true;
    });

    const total = filtered.length;
    // For participation, we check how many in this filtered set have an attendance record
    // We can check if they have any of the scanned_at fields or if their status is attended
    // Given the attendance table query in fetchAnalyticsData, we might need a more efficient way
    // But for now, let's use the registrations status if it's reliable, or count unique attendance IDs
    const attended = filtered.filter(r => r.status === 'attended').length;
    const participation = total > 0 ? Math.round((attended / total) * 100) : 0;

    return { total, participation };
  };

  const filteredStats = getFilteredStats();

  const handleExport = (format: string) => {
    showAlert(
      "Exporting Data",
      `Your ${activeCategory} analytics report is being generated as ${format}.`,
      "info"
    );
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
      {/* Header */}
      <View style={[styles.header, isSmallScreen && { paddingHorizontal: 16, paddingTop: 16 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={{ marginRight: 8, padding: 4 }}
          >
            <ChevronLeft color="white" size={24} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, isSmallScreen && { fontSize: 22 }]} numberOfLines={1}>Analytics</Text>
            <Text style={[styles.headerSubtitle, isSmallScreen && { fontSize: 12 }]}>{selectedEvent?.name ?? event?.name ?? 'Drill-down Reports'}</Text>
          </View>
        </View>
        <View style={[styles.headerActions, isExtraSmall && { gap: 8 }]}>
          <TouchableOpacity onPress={handleLogout} style={[styles.logoutBtn, isSmallScreen && { width: 36, height: 36 }]}>
            <LogOut color="#ef4444" size={isSmallScreen ? 18 : 20} />
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
        {isLoading && !refreshing ? (
          <Animated.View entering={FadeInDown.delay(100)}>
            <View style={[styles.categoryBar, isSmallScreen && { marginBottom: 16 }]}>
              <SkeletonItem width="48%" height={45} borderRadius={12} />
              <SkeletonItem width="48%" height={45} borderRadius={12} />
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
              <SkeletonItem width={70} height={35} borderRadius={20} />
              <SkeletonItem width={70} height={35} borderRadius={20} />
              <SkeletonItem width={70} height={35} borderRadius={20} />
            </View>
            <SkeletonItem width="100%" height={250} borderRadius={24} style={{ marginBottom: 24 }} />
            <View style={[styles.summaryRow, isExtraSmall && { flexDirection: 'column' }]}>
               <SkeletonItem width="47%" height={120} borderRadius={24} />
               <SkeletonItem width="47%" height={120} borderRadius={24} />
            </View>
          </Animated.View>
        ) : (
          <>
            {/* Category Switcher */}
        {!scheduled && <>
        <View style={[styles.categoryBar, isSmallScreen && { marginBottom: 16 }]}>
          <TouchableOpacity 
            onPress={() => setActiveCategory('Student')}
            style={[styles.catTab, activeCategory === 'Student' && styles.activeCatTab]}
          >
            <GraduationCap color={activeCategory === 'Student' ? 'white' : '#64748b'} size={isSmallScreen ? 16 : 18} />
            <Text style={[styles.catTabText, activeCategory === 'Student' && styles.activeCatTabText, isSmallScreen && { fontSize: 12 }]}>Students</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setActiveCategory('Employee')}
            style={[styles.catTab, activeCategory === 'Employee' && styles.activeCatTab]}
          >
            <Briefcase color={activeCategory === 'Employee' ? 'white' : '#64748b'} size={isSmallScreen ? 16 : 18} />
            <Text style={[styles.catTabText, activeCategory === 'Employee' && styles.activeCatTabText, isSmallScreen && { fontSize: 12 }]}>Employees</Text>
          </TouchableOpacity>
        </View>

        {/* Sub-Filters Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {activeCategory === 'Student' ? (
            ['All', '3rd Year', '4th Year'].map((y) => (
              <TouchableOpacity 
                key={y} 
                onPress={() => setSelectedYear(y)}
                style={[styles.chip, selectedYear === y && styles.activeChip]}
              >
                <Text style={[styles.chipText, selectedYear === y && styles.activeChipText]}>{y}</Text>
              </TouchableOpacity>
            ))
          ) : (
            employeeChips.map((d) => (
              <TouchableOpacity 
                key={d} 
                onPress={() => setSelectedDept(d)}
                style={[styles.chip, selectedDept === d && styles.activeChip]}
              >
                <Text style={[styles.chipText, selectedDept === d && styles.activeChipText]}>{d}</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
        </>}

        {/* Breakdown Chart */}
        <Animated.View layout={Layout.springify()} entering={FadeInDown.delay(100)} style={[styles.chartCard, isSmallScreen && { padding: 16 }]}>
          <View style={styles.chartHeader}>
            <Text style={[styles.chartTitle, isSmallScreen && { fontSize: 16 }]}>
              {scheduled ? 'Participant Breakdown' : `${activeCategory} ${selectedYear === '4th Year' ? 'Roles' : 'Breakdown'}`}
            </Text>
            <Text style={styles.chartSubTitle}>
              by {scheduled ? 'Event Role' : activeCategory === 'Student'
                ? (selectedYear === '4th Year' ? 'Student Role' : 'Year Level') 
                : 'Department'}
            </Text>
          </View>
          
          <View style={styles.barChartContainer}>
            {scheduled && !dashboard?.roles.length && <Text style={styles.chartSubTitle}>No roles configured yet.</Text>}
            {(scheduled ? dashboard?.roles.map(role => ({
              label: role.name, count: role.count, color: '#3b82f6',
              val: dashboard.participants ? Math.min(100, Math.round(role.count / dashboard.participants * 100)) : 0,
            })) ?? [] : activeCategory === 'Student' ? studentBreakdown : employeeBreakdown).map((item, idx) => (
              <View key={item.label} style={styles.chartRow}>
                <Text style={[styles.barLabel, isSmallScreen && { width: 110, fontSize: 10 }]} numberOfLines={1}>{item.label}</Text>
                <View style={styles.barBg}>
                  <Animated.View 
                    entering={FadeInRight.delay(200 + idx * 50)}
                    style={[styles.barFill, { width: `${item.val}%`, backgroundColor: item.color }]} 
                  />
                </View>
                <Text style={[styles.barValue, isSmallScreen && { width: 65, fontSize: 10 }]}>
                  {item.val}% ({item.count})
                </Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Stats Summary Cards */}
        <View style={[styles.summaryRow, isExtraSmall && { flexDirection: 'column' }]}>
          <View style={[styles.summaryCard, isSmallScreen && { padding: 16 }]}>
            <Text style={[styles.summaryLabel, isSmallScreen && { fontSize: 11 }]}>
              {scheduled ? 'Registrations' : activeCategory === 'Student' && selectedYear !== 'All' ? selectedYear :
               activeCategory === 'Employee' && selectedDept !== 'All' ? selectedDept : 
               `Total ${activeCategory}s`}
            </Text>
            <Text style={[styles.summaryValue, isSmallScreen && { fontSize: 24 }]}>{scheduled ? dashboard?.participants ?? 0 : filteredStats.total}</Text>
            <View style={styles.trendUp}>
              <Activity color="#3b82f6" size={12} />
              <Text style={[styles.trendText, { color: '#3b82f6' }]}>{scheduled ? 'All Roles' : 'Filtered View'}</Text>
            </View>
          </View>
          <View style={[styles.summaryCard, isSmallScreen && { padding: 16 }]}>
            <Text style={[styles.summaryLabel, isSmallScreen && { fontSize: 11 }]}>{scheduled ? 'Check-ins' : 'Participation'}</Text>
            <Text style={[styles.summaryValue, isSmallScreen && { fontSize: 24 }]}>{scheduled ? dashboard?.attendance ?? 0 : `${filteredStats.participation}%`}</Text>
            <View style={styles.trendUp}>
              <ArrowUpRight color="#10b981" size={12} />
              <Text style={styles.trendText}>{scheduled ? 'All Sessions' : 'In-Group'}</Text>
            </View>
          </View>
        </View>

        {scheduled && <Animated.View entering={FadeInDown.delay(125)} style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Attendance by Session</Text>
            <Text style={styles.chartSubTitle}>Check-ins and capacity</Text>
          </View>
          {!dashboard?.sessions.length && <Text style={styles.chartSubTitle}>No sessions configured yet.</Text>}
          {dashboard?.sessions.map(session => {
            const fill = Math.min(100, Math.round(session.count / session.capacity * 100));
            const day = new Date(session.startsAt).toLocaleDateString([], {
              timeZone: selectedEvent.timezone, month: 'short', day: 'numeric',
            });
            return <View key={session.id} style={{ marginBottom: 12 }}>
              <Text style={styles.chartSubTitle}>{session.title} · {day} · {session.venue}</Text>
              <View style={styles.chartRow}>
                <View style={styles.barBg}><View style={[styles.barFill, { width: `${fill}%`, backgroundColor: '#3b82f6' }]} /></View>
                <Text style={styles.barValue}>{session.count}/{session.capacity}</Text>
              </View>
            </View>;
          })}
        </Animated.View>}
        
        {/* Evaluation Insights Card */}
        <Animated.View entering={FadeInDown.delay(150)} style={styles.evaluationCard}>
          <View style={styles.evalIconContainer}>
            <Activity color="#8b5cf6" size={24} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.evalTitle}>{scheduled ? 'Session Feedback' : 'Evaluation Insights'}</Text>
            <Text style={styles.evalSub}>{scheduled ? `${dashboard?.feedback ?? 0} responses` : 'Sentiment analysis & feedback summary'}</Text>
          </View>
          <TouchableOpacity 
            onPress={() => scheduled
              ? navigation.navigate('Config', { section: 'post-event', showParticipants: false })
              : navigation.navigate('EvaluationAnalytics', { eventId: selectedEvent?.id })}
            style={styles.evalGoBtn}
          >
            <Text style={styles.evalGoText}>Explore</Text>
            <ChevronRight color="white" size={16} />
          </TouchableOpacity>
        </Animated.View>

        {/* Live Feed Section */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.feedSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Live Activity</Text>
            <TouchableOpacity 
              onPress={() => scheduled
                ? navigation.navigate('Config', { section: 'pre-reg', showParticipants: true })
                : navigation.navigate('ParticipantList', { eventId: selectedEvent?.id })}
              style={styles.viewDetailsBtn}
            >
              <Text style={styles.viewAll}>View Full List</Text>
              <ChevronRight color="#3b82f6" size={16} />
            </TouchableOpacity>
          </View>

          {recentScans.map((scan) => (
            <View key={scan.id} style={[styles.feedItem, isSmallScreen && { padding: 12 }]}>
              <View style={[styles.feedItemLeft, { flex: 1 }]}>
                <View style={[styles.avatar, isSmallScreen && { width: 36, height: 36 }]}>
                  <Text style={[styles.avatarText, isSmallScreen && { fontSize: 16 }]}>{scan.name[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.feedName, isSmallScreen && { fontSize: 14 }]} numberOfLines={1}>{scan.name}</Text>
                  <Text style={[styles.feedRole, isSmallScreen && { fontSize: 11 }]}>{scan.role} • {scan.time}</Text>
                </View>
              </View>
              <View style={[styles.statusBadge, isSmallScreen && { paddingHorizontal: 8, paddingVertical: 4 }]}>
                <Text style={[styles.statusText, isSmallScreen && { fontSize: 10 }]}>{scan.status}</Text>
              </View>
            </View>
          ))}
        </Animated.View>



        <View style={{ height: 100 }} />
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
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLogo: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  exportBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  logoutBtn: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  scrollView: {
    paddingHorizontal: 24,
  },
  categoryBar: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    padding: 6,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  catTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  activeCatTab: {
    backgroundColor: '#3b82f6',
  },
  catTabText: {
    color: '#64748b',
    fontWeight: 'bold',
    fontSize: 14,
  },
  activeCatTabText: {
    color: 'white',
  },
  chipScroll: {
    marginBottom: 24,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  activeChip: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderColor: '#3b82f6',
  },
  chipText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  activeChipText: {
    color: '#3b82f6',
  },
  chartCard: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 24,
  },
  chartHeader: {
    marginBottom: 24,
  },
  chartTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  chartSubTitle: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
  },
  barChartContainer: {
    gap: 20,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  barLabel: {
    color: '#94a3b8',
    fontSize: 12,
    width: 140, // Increased to accommodate longer role names
    fontWeight: '500',
  },
  barBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#020617',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  barValue: {
    color: 'white',
    fontSize: 12,
    width: 75,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  summaryLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  summaryValue: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  trendUp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: 'bold',
  },
  evaluationCard: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    gap: 16,
  },
  evalIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  evalTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  evalSub: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  evalGoBtn: {
    backgroundColor: '#8b5cf6',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 4,
  },
  evalGoText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  feedSection: {
    marginBottom: 32,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAll: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: 'bold',
  },
  feedItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  feedItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 44,
    height: 44,
    backgroundColor: '#1e293b',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  avatarText: {
    color: '#3b82f6',
    fontWeight: 'bold',
    fontSize: 18,
  },
  feedName: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  feedRole: {
    color: '#64748b',
    fontSize: 12,
  },
  statusBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: 'bold',
  },
  exportCta: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1e293b',
    flexDirection: 'column',
    gap: 20,
  },
  exportCtaInfo: {
    gap: 4,
  },
  exportCtaTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  exportCtaSub: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 20,
  },
  mainExportBtn: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
  },
  mainExportBtnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default AnalyticsScreen;
