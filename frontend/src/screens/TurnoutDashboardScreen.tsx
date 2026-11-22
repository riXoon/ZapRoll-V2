import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  RefreshControl,
  ActivityIndicator,
  Platform
} from 'react-native';
import { 
  ArrowLeft, 
  Activity, 
  UserCheck, 
  Users, 
  TrendingUp, 
  CheckCircle2, 
  Clock 
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { API_URL } from '../config/api';
import Animated, { FadeInDown, Layout, withRepeat, withTiming, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

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

export default function TurnoutDashboardScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [eventData, setEventData] = useState<any>(null);
  
  const fetchDashboardData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${API_URL}/api/events`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      
      const result = await response.json();
      if (result.status === 'success' && result.data.length > 0) {
        setEventData(result.data[0]);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Subscribe to real-time changes
    const subscription = supabase
      .channel('turnout-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance' },
        () => fetchDashboardData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const stats = eventData?.stats || { 
    total_registrations: 0, 
    total_attended: 0, 
    total_pending: 0,
    pre_reg_turnout: 0,
    walkin_turnout: 0
  };
  const roles = eventData?.event_quotas || [];
  const turnoutPercent = stats.total_registrations > 0 
    ? Math.round((stats.total_attended / stats.total_registrations) * 100) 
    : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft color="white" size={24} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Live Turnout</Text>
          <Text style={styles.headerSubtitle}>{eventData?.name || 'Event Analytics'}</Text>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDashboardData(); }} tintColor="#3b82f6" />
        }
      >
        {isLoading ? (
          <Animated.View entering={FadeInDown.delay(100)}>
            <SkeletonItem width="100%" height={280} borderRadius={24} style={{ marginBottom: 24 }} />
            <SkeletonItem width="100%" height={24} borderRadius={4} style={{ marginBottom: 16 }} />
            <SkeletonItem width="100%" height={80} borderRadius={16} style={{ marginBottom: 24 }} />
            <SkeletonItem width="100%" height={24} borderRadius={4} style={{ marginBottom: 16 }} />
            <SkeletonItem width="100%" height={100} borderRadius={16} style={{ marginBottom: 12 }} />
            <SkeletonItem width="100%" height={100} borderRadius={16} style={{ marginBottom: 12 }} />
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.delay(100)} layout={Layout.springify()}>
            {/* Main Turnout Ring/Card */}
          <View style={styles.mainStatsCard}>
            <View style={styles.turnoutRingContainer}>
              <View style={styles.turnoutInfo}>
                <Text style={styles.turnoutLargePercent}>{turnoutPercent}%</Text>
                <Text style={styles.turnoutSubtext}>Total Turnout</Text>
              </View>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Users color="#3b82f6" size={20} />
                <Text style={styles.statValue}>{stats.pre_reg_turnout}</Text>
                <Text style={styles.statLabel}>Pre-Registered</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <UserCheck color="#10b981" size={20} />
                <Text style={styles.statValue}>{stats.walkin_turnout}</Text>
                <Text style={styles.statLabel}>Walk-Ins</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Activity color="#f59e0b" size={20} />
                <Text style={styles.statValue}>{stats.total_attended}</Text>
                <Text style={styles.statLabel}>Total Present</Text>
              </View>
            </View>
          </View>

          {/* Turnout Composition */}
          <Text style={styles.sectionTitle}>Attendance by Registration Type</Text>
          <View style={styles.compositionCard}>
            <View style={styles.compositionHeader}>
              <View style={styles.compItem}>
                <View style={[styles.compIndicator, { backgroundColor: '#3b82f6' }]} />
                <Text style={styles.compLabel}>Pre-Registered ({stats.pre_reg_turnout})</Text>
              </View>
              <View style={styles.compItem}>
                <View style={[styles.compIndicator, { backgroundColor: '#10b981' }]} />
                <Text style={styles.compLabel}>Walk-Ins ({stats.walkin_turnout})</Text>
              </View>
            </View>
            <View style={styles.compositionBarBg}>
              <View 
                style={[
                  styles.compositionBarFill, 
                  { 
                    width: `${(stats.pre_reg_turnout / (stats.total_attended || 1)) * 100}%`,
                    backgroundColor: '#3b82f6'
                  }
                ]} 
              />
              <View 
                style={[
                  styles.compositionBarFill, 
                  { 
                    width: `${(stats.walkin_turnout / (stats.total_attended || 1)) * 100}%`,
                    backgroundColor: '#10b981'
                  }
                ]} 
              />
            </View>
          </View>

          {/* 4th Year Role Breakdown */}
          {(stats.poster_presenters_registered > 0 || stats.colloquium_presenters_registered > 0 || stats.colloquium_participants_registered > 0) && (
            <>
              <Text style={styles.sectionTitle}>Special Roles (4th Year)</Text>
              
              <View style={styles.roleGrid}>
                {/* Poster Presenter */}
                {stats.poster_presenters_registered > 0 && (
                  <View style={styles.roleStatCard}>
                    <Text style={styles.roleStatTitle}>Poster Presenter</Text>
                    <View style={styles.roleStatRow}>
                      <View>
                        <Text style={styles.roleStatValue}>{stats.poster_attended_count || 0}</Text>
                        <Text style={styles.roleStatLabel}>CLEARED</Text>
                      </View>
                      <View style={styles.roleStatDivider} />
                      <View>
                        <Text style={styles.roleStatValue}>{stats.poster_presenters_registered || 0}</Text>
                        <Text style={styles.roleStatLabel}>REGISTERED</Text>
                      </View>
                    </View>
                    <View style={styles.roleProgressBarBg}>
                      <View 
                        style={[
                          styles.roleProgressBarFill, 
                          { 
                            width: `${Math.min(100, ((stats.poster_attended_count || 0) / (stats.poster_presenters_registered || 1)) * 100)}%`,
                            backgroundColor: '#10b981'
                          }
                        ]} 
                      />
                    </View>
                  </View>
                )}

                {/* Colloquium Presenter */}
                {stats.colloquium_presenters_registered > 0 && (
                  <View style={styles.roleStatCard}>
                    <Text style={styles.roleStatTitle}>Colloquium Presenter</Text>
                    <View style={styles.roleStatRow}>
                      <View>
                        <Text style={styles.roleStatValue}>{stats.colloquium_presenters_attended || 0}</Text>
                        <Text style={styles.roleStatLabel}>PRESENT</Text>
                      </View>
                      <View style={styles.roleStatDivider} />
                      <View>
                        <Text style={styles.roleStatValue}>{stats.colloquium_presenters_registered || 0}</Text>
                        <Text style={styles.roleStatLabel}>REGISTERED</Text>
                      </View>
                    </View>
                    <View style={styles.roleProgressBarBg}>
                      <View 
                        style={[
                          styles.roleProgressBarFill, 
                          { 
                            width: `${Math.min(100, ((stats.colloquium_presenters_attended || 0) / (stats.colloquium_presenters_registered || 1)) * 100)}%`,
                            backgroundColor: '#3b82f6'
                          }
                        ]} 
                      />
                    </View>
                  </View>
                )}

                {/* Colloquium Participant */}
                {stats.colloquium_participants_registered > 0 && (
                  <View style={styles.roleStatCard}>
                    <Text style={styles.roleStatTitle}>Colloquium Participant</Text>
                    <View style={styles.roleStatRow}>
                      <View>
                        <Text style={styles.roleStatValue}>{stats.colloquium_participants_attended || 0}</Text>
                        <Text style={styles.roleStatLabel}>PRESENT</Text>
                      </View>
                      <View style={styles.roleStatDivider} />
                      <View>
                        <Text style={styles.roleStatValue}>{stats.colloquium_participants_registered || 0}</Text>
                        <Text style={styles.roleStatLabel}>REGISTERED</Text>
                      </View>
                    </View>
                    <View style={styles.roleProgressBarBg}>
                      <View 
                        style={[
                          styles.roleProgressBarFill, 
                          { 
                            width: `${Math.min(100, ((stats.colloquium_participants_attended || 0) / (stats.colloquium_participants_registered || 1)) * 100)}%`,
                            backgroundColor: '#8b5cf6'
                          }
                        ]} 
                      />
                    </View>
                  </View>
                )}
              </View>
            </>
          )}

          {/* Role Breakdown List */}
          <Text style={styles.sectionTitle}>Attendance by Participant Role</Text>
          {roles.map((role: any, index: number) => (
            <View key={role.id} style={styles.roleCard}>
              <View style={styles.roleHeader}>
                <View style={styles.roleNameContainer}>
                  <TrendingUp color="#3b82f6" size={16} />
                  <Text style={styles.roleName}>{role.name}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.roleRatio}>
                    {role.attended_count} <Text style={{ color: '#64748b', fontSize: 12, fontWeight: 'normal' }}>present</Text>
                  </Text>
                  <Text style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>
                    of {role.used_capacity} registered
                  </Text>
                </View>
              </View>
              
              <View style={styles.progressContainer}>
                <View style={styles.progressBarBg}>
                  <View 
                    style={[
                      styles.progressBarFill, 
                      { width: `${Math.min(100, (role.attended_count / (role.used_capacity || 1)) * 100)}%` }
                    ]} 
                  />
                </View>
                <Text style={styles.progressPercent}>
                  {role.used_capacity > 0 ? Math.round((role.attended_count / role.used_capacity) * 100) : 0}%
                </Text>
              </View>
            </View>
          ))}

          {/* Session Activity */}
          <Text style={styles.sectionTitle}>Scanning & Registration Activity</Text>
          <View style={styles.activityCard}>
             <View style={styles.activityItem}>
                <CheckCircle2 color="#3b82f6" size={18} />
                <Text style={styles.activityText}>Morning (AM) Scans</Text>
                <Text style={styles.activityCount}>{eventData?.student_am_count || 0}</Text>
             </View>
             <View style={styles.activityItem}>
                <CheckCircle2 color="#8b5cf6" size={18} />
                <Text style={styles.activityText}>Afternoon (PM) Scans</Text>
                <Text style={styles.activityCount}>{eventData?.student_pm_count || 0}</Text>
             </View>
             <View style={styles.activityItem}>
                <CheckCircle2 color="#10b981" size={18} />
                <Text style={styles.activityText}>Employee Registrations</Text>
                <Text style={styles.activityCount}>{eventData?.employee_reg_count || 0}</Text>
             </View>
          </View>
          
          <View style={{ height: 40 }} />
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617', // slate-950
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: {
    marginRight: 15,
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  mainStatsCard: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
  },
  turnoutRingContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 10,
    borderColor: '#1e293b',
    borderTopColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    // Add shadow for depth
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  turnoutInfo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  turnoutLargePercent: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  turnoutSubtext: {
    fontSize: 12,
    color: '#64748b',
  },
  statsGrid: {
    flexDirection: 'row',
    width: '100%',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#1e293b',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 30,
    marginBottom: 15,
  },
  roleCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  roleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  roleNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleName: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  roleRatio: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#1e293b',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  },
  progressPercent: {
    color: '#64748b',
    fontSize: 12,
    width: 35,
    textAlign: 'right',
  },
  activityCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  activityText: {
    flex: 1,
    color: '#94a3b8',
    fontSize: 14,
  },
  activityCount: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  compositionCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  compositionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  compItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  compLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
  compositionBarBg: {
    height: 12,
    backgroundColor: '#1e293b',
    borderRadius: 6,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  compositionBarFill: {
    height: '100%',
  },
  roleGrid: {
    gap: 12,
  },
  roleStatCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  roleStatTitle: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  roleStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  roleStatValue: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  roleStatLabel: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
  roleStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#1e293b',
  },
  roleProgressBarBg: {
    height: 6,
    backgroundColor: '#1e293b',
    borderRadius: 3,
    overflow: 'hidden',
  },
  roleProgressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
});
