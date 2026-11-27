import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, FlatList, ScrollView, ActivityIndicator, RefreshControl, useWindowDimensions, Modal } from 'react-native';
import { reportCache } from '../lib/reportCache';
import { FeedbackModal } from '../components/FeedbackModal';
import { 
  ArrowLeft, 
  Search, 
  FileDown, 
  FileSpreadsheet, 
  Filter,
  GraduationCap,
  Briefcase,
  Users,
  ChevronDown,
  UserPlus,
  X,
  Check,
  Download,
  FileText,
  Table as TableIcon
} from 'lucide-react-native';
import { exportRegistryToPDF, exportRegistryToExcel } from '../utils/exportUtils';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { API_URL } from '../config/api';
import { useIsFocused } from '@react-navigation/native';

const CACHE_KEY = '@participant_registry_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function loadRegistryRows<T>(loadPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await loadPage(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}

const getDisplayRole = (item: any) => {
  const baseRole = item.role || 'Participant';
  if (baseRole.toLowerCase() === 'student') {
    const studentRole = item.metadata?.studentRole;
    if (studentRole) {
      if (Array.isArray(studentRole)) {
        return `Student • ${studentRole.join(', ')}`;
      }
      return `Student • ${studentRole}`;
    }
  }
  return baseRole;
};

const ParticipantRow = React.memo(({ 
  item, 
  activeTab, 
  selectedStudentType, 
  isSmallScreen, 
  styles, 
  onCheckIn 
}: any) => {
  return (
    <View style={[styles.tableRow, isSmallScreen && { paddingVertical: 12 }]}>
      <View style={[styles.column, { flex: isSmallScreen ? 1.5 : 2 }]}>
        <Text style={[styles.nameText, isSmallScreen && { fontSize: 13 }]} numberOfLines={1}>{item.full_name}</Text>
        <Text style={[styles.roleText, isSmallScreen && { fontSize: 10 }]}>{getDisplayRole(item)}</Text>
      </View>
  
      {(activeTab === 'All' || (activeTab === 'Student' && selectedStudentType !== 'Poster Presenter')) && (
        <>
          <View style={[styles.column, { flex: isSmallScreen ? 0.6 : 0.8 }]}>
            <Text style={[styles.detailsText, isSmallScreen && { fontSize: 11 }]}>{item.year}</Text>
          </View>
          <View style={[styles.column, { flex: isSmallScreen ? 1 : 1.2 }]}>
            <Text style={[styles.detailsText, isSmallScreen && { fontSize: 11 }]} numberOfLines={1}>{item.section}</Text>
          </View>
          <View style={[styles.column, { flex: isSmallScreen ? 1 : 1.2 }]}>
            <Text style={[styles.detailsText, isSmallScreen && { fontSize: 11 }]} numberOfLines={1}>
              {activeTab === 'Student' ? item.studentId : item.extraInfo}
            </Text>
          </View>
        </>
      )}
  
      {activeTab === 'Employee' && (
        <View style={[styles.column, { flex: 2 }]}>
          <Text style={[styles.detailsText, isSmallScreen && { fontSize: 11 }]} numberOfLines={1}>{item.department}</Text>
        </View>
      )}
  
      {activeTab === 'Guest' && (
        <View style={[styles.column, { flex: 2 }]}>
          <Text style={[styles.detailsText, isSmallScreen && { fontSize: 11 }]} numberOfLines={1}>{item.guestCategory}</Text>
        </View>
      )}

      {activeTab === 'Student' && selectedStudentType === 'Poster Presenter' && (
        <>
          <View style={[styles.column, { flex: isSmallScreen ? 1 : 1.2 }]}>
            <Text style={[styles.detailsText, isSmallScreen && { fontSize: 11 }]} numberOfLines={1}>{item.section}</Text>
          </View>
          <View style={[styles.column, { flex: isSmallScreen ? 1 : 1.2 }]}>
            <Text style={[styles.detailsText, isSmallScreen && { fontSize: 11 }]} numberOfLines={1}>{item.metadata?.groupNumber || '-'}</Text>
          </View>
        </>
      )}
  
      <View style={[styles.column, { flex: isSmallScreen ? 0.8 : 1, alignItems: 'flex-end' }]}>
        {item.status === 'In' ? (
          <View style={[styles.statusBadge, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }, isSmallScreen && { paddingHorizontal: 6, paddingVertical: 3 }]}>
            <Text style={[styles.statusText, { color: '#10b981' }, isSmallScreen && { fontSize: 9 }]}>{isSmallScreen ? 'Scanned' : 'Scanned In'}</Text>
          </View>
        ) : onCheckIn ? (
          <TouchableOpacity 
            onPress={() => onCheckIn(item)}
            style={[styles.manualCheckBtn, isSmallScreen && { paddingHorizontal: 8, paddingVertical: 4 }]}
          >
            <Text style={[styles.manualCheckText, isSmallScreen && { fontSize: 9 }]}>Check-In</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.detailsText}>Pending</Text>
        )}
      </View>
    </View>
  );
});

// Memoized List Component to prevent unnecessary flat list rebuilds
const RegistryListView = React.memo(({
  data,
  tabRole,
  selectedStudentType,
  isSmallScreen,
  onCheckIn,
  refreshing,
  onRefresh,
  isLoading,
  renderSkeletonRow,
  styles
}: any) => {
  const renderItem = React.useCallback(({ item }: { item: any }) => (
    <ParticipantRow 
      item={item} 
      activeTab={tabRole} 
      selectedStudentType={selectedStudentType}
      isSmallScreen={isSmallScreen}
      styles={styles}
      onCheckIn={onCheckIn}
    />
  ), [tabRole, selectedStudentType, isSmallScreen, onCheckIn, styles]);

  return (
    <FlatList
      data={isLoading && !refreshing ? Array(10).fill({}) : data}
      renderItem={isLoading && !refreshing ? renderSkeletonRow : renderItem}
      keyExtractor={(item, index) => isLoading && !refreshing ? `skeleton-${index}` : item.id}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
      }
      initialNumToRender={15}
      maxToRenderPerBatch={10}
      windowSize={11}
      removeClippedSubviews={true}
      ListEmptyComponent={
        !isLoading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No results found for these filters.</Text>
          </View>
        ) : null
      }
    />
  );
});

const ParticipantListScreen = ({ navigation, route }: any) => {
  const requestedEventId = route.params?.eventId;
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 420;
  const isExtraSmall = width < 370;
  
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [activeTab, setActiveTab] = useState<'All' | 'Student' | 'Employee' | 'Guest'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [localSearchQuery, setLocalSearchQuery] = useState('');

  // Lazy loading states for tabs
  const [studentMounted, setStudentMounted] = useState(false);
  const [employeeMounted, setEmployeeMounted] = useState(false);
  const [guestMounted, setGuestMounted] = useState(false);

  React.useEffect(() => {
    if (activeTab === 'Student') setStudentMounted(true);
    if (activeTab === 'Employee') setEmployeeMounted(true);
    if (activeTab === 'Guest') setGuestMounted(true);
  }, [activeTab]);

  // Debounced search logic to maintain 60 FPS typing speed
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(localSearchQuery);
    }, 180);

    return () => clearTimeout(handler);
  }, [localSearchQuery]);

  // Sync back search query changes (e.g. on external resets)
  React.useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  const [isExporting, setIsExporting] = useState(false);

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

  const showAlert = React.useCallback((title: string, message: string, type: 'success' | 'error' | 'info' | 'confirm' = 'info', onConfirm?: () => void) => {
    setFeedbackConfig({ title, message, type, onConfirm });
    setFeedbackVisible(true);
  }, []);
  
  // Status Filter
  const [selectedStatus, setSelectedStatus] = useState('All Statuses');
  
  // Student Filters
  const [selectedYear, setSelectedYear] = useState('All Years');
  const [selectedSection, setSelectedSection] = useState('All Sections');
  const [selectedStudentType, setSelectedStudentType] = useState('All Types');
  const [selectedColloquiumType, setSelectedColloquiumType] = useState('All Roles');
  
  // Employee Filters
  const [selectedDept, setSelectedDept] = useState('All Depts');

  // Selection Modal State
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [filterSearchQuery, setFilterSearchQuery] = useState('');
  const [filterModalData, setFilterModalData] = useState({
    title: '',
    options: [] as string[],
    current: '',
    setter: (v: string) => {}
  });

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeEvent, setActiveEvent] = useState<any>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);

  const fetchData = async (forceRefresh = false) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const cacheKey = `${CACHE_KEY}:${session.user.id}:${requestedEventId || 'legacy'}`;
      // 1. Check Cache
      if (!requestedEventId && !forceRefresh) {
        try {
          const cached = JSON.parse(reportCache.getItem(cacheKey) ?? 'null');
          if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            setActiveEvent(cached.event);
            setRegistrations(cached.regs || []);
            setAttendance(cached.att || []);
            return;
          }
        } catch {
          // A full or unreadable local cache must not block live records.
        }
      }

      // 2. Fetch Latest Event
      const eventPath = requestedEventId ? `/api/events/${encodeURIComponent(requestedEventId)}` : '/api/events';
      const eventRes = await fetch(`${API_URL}${eventPath}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const eventData = await eventRes.json();
      if (!eventRes.ok || eventData.status !== 'success') {
        throw new Error(eventData.message || 'The event could not be loaded.');
      }
      const event = requestedEventId ? eventData.data : eventData.data[0];
      if (event) {

        const [regs, att] = await Promise.all([
          loadRegistryRows((from, to) => supabase
            .from('registrations')
            .select('*, quota:event_quotas(name)')
            .eq('event_id', event.id)
            .order('id')
            .range(from, to)),
          loadRegistryRows((from, to) => supabase
            .from('attendance')
            .select('*')
            .eq('event_id', event.id)
            .order('id')
            .range(from, to)),
        ]);
        const eventSummary = { id: event.id, name: event.name, lifecycle: event.lifecycle };
        setActiveEvent(eventSummary);
        setRegistrations(regs);
        setAttendance(att);

        if (!requestedEventId) {
          reportCache.setItem(cacheKey, JSON.stringify({
            timestamp: Date.now(), event: eventSummary, regs, att,
          }));
        }
      } else {
        setActiveEvent(null);
        setRegistrations([]);
        setAttendance([]);
      }
    } catch (error) {
      console.error('Participant Registry Fetch Error:', error);
      showAlert('Could not load participant records', error instanceof Error ? error.message : 'Please try again.', 'error');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  React.useEffect(() => {
    if (isFocused) {
      fetchData();
    }
  }, [isFocused, requestedEventId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(true); // Force refresh ignores cache
  };

  // Dynamic Filter Options
  const years = useMemo(() => {
    const set = new Set(registrations
      .filter(r => (r.metadata?.category === 'student' || r.quota?.name === 'Student'))
      .map(r => {
        const val = r.metadata?.yearLevel || r.metadata?.year;
        return typeof val === 'string' ? val.trim() : val;
      })
      .filter(Boolean));
    return ['All Years', ...Array.from(set)].sort();
  }, [registrations]);

  const departments = useMemo(() => {
    const set = new Set(registrations
      .filter(r => (r.metadata?.category === 'employee' || r.quota?.name === 'Employee'))
      .map(r => r.metadata?.department?.trim())
      .filter(Boolean));
    return ['All Depts', ...Array.from(set)].sort();
  }, [registrations]);

  const attendanceSet = useMemo(() => new Set(attendance.map(a => a.registration_id)), [attendance]);

  const processedRegistrations = useMemo(() => {
    return registrations.map(reg => {
      const isAttended = attendanceSet.has(reg.id);
      const role = reg.metadata?.category || reg.quota?.name || 'Participant';
      const isStudent = role.toLowerCase().includes('student');
      const isEmployee = role.toLowerCase().includes('employee');
      const isGuest = role.toLowerCase().includes('guest');

      // Format Year & Section (e.g. "3rd Year - SBIT-3G")
      const yr = reg.metadata?.yearLevel || reg.metadata?.year || '';
      const sec = reg.metadata?.section || reg.metadata?.yearSection || '';
      const yearSec = isStudent ? `${yr} - ${sec}`.trim() : '-';

      return {
        ...reg,
        status: isAttended ? 'In' : 'Pending',
        role,
        yearSection: yearSec.startsWith('-') ? yearSec.substring(2) : (yearSec.endsWith('-') ? yearSec.slice(0, -2) : yearSec) || '-',
        studentId: reg.metadata?.studentId || '-',
        department: reg.metadata?.department || '-',
        guestCategory: reg.metadata?.guestType || '-',
        extraInfo: isStudent ? reg.metadata?.studentId : 
                   isEmployee ? reg.metadata?.department :
                   isGuest ? reg.metadata?.guestType : '-',
        year: (reg.metadata?.yearLevel || reg.metadata?.year || '').trim() || '-',
        section: (reg.metadata?.section || reg.metadata?.yearSection || '').trim() || '-',
        dept: reg.metadata?.department?.trim() || '-'
      };
    });
  }, [registrations, attendanceSet]);

  const sections = useMemo(() => {
    const set = new Set<string>();
    processedRegistrations.forEach(p => {
      const isStudent = p.role === 'student' || p.role === 'Student';
      if (!isStudent) return;

      // Filter by Year
      if (selectedYear !== 'All Years' && p.year !== selectedYear) return;

      // Filter by Student Type (Poster Presenter / Colloquium) if selectedYear is 4th Year
      if (selectedYear === '4th Year' && selectedStudentType !== 'All Types') {
        const role = p.metadata?.studentRole;
        const hasRole = (targetRole: string) => {
          if (!role) return false;
          const normalizedTarget = targetRole.toLowerCase().trim();
          const checkSingle = (roleStr: string) => {
            const s = roleStr.toLowerCase().trim();
            if (s === normalizedTarget) return true;
            if (normalizedTarget.includes('poster') && s.includes('poster')) return true;
            if (normalizedTarget.includes('presenter') && s.includes('presenter') && !s.includes('poster') && !normalizedTarget.includes('poster')) return true;
            if (normalizedTarget.includes('participant') && s.includes('participant')) return true;
            return false;
          };
          if (Array.isArray(role)) {
            return role.some(r => checkSingle(String(r)));
          }
          return checkSingle(String(role));
        };

        const isPoster = hasRole('Poster Presenter');
        const isColloquiumPresenter = hasRole('Colloquium Presenter');
        const isColloquiumParticipant = hasRole('Colloquium Participant');
        const isColloquium = isColloquiumPresenter || isColloquiumParticipant;

        if (selectedStudentType === 'Poster Presenter' && !isPoster) return;
        if (selectedStudentType === 'Colloquium') {
          if (selectedColloquiumType === 'All Roles' && !isColloquium) return;
          if (selectedColloquiumType === 'Colloquium Presenter' && !isColloquiumPresenter) return;
          if (selectedColloquiumType === 'Colloquium Participant' && !isColloquiumParticipant) return;
        }
      }

      if (p.section && p.section !== '-') {
        set.add(p.section);
      }
    });

    return ['All Sections', ...Array.from(set)].sort();
  }, [processedRegistrations, selectedYear, selectedStudentType, selectedColloquiumType]);

  React.useEffect(() => {
    if (selectedSection !== 'All Sections' && !sections.includes(selectedSection)) {
      setSelectedSection('All Sections');
    }
  }, [sections, selectedSection]);

  // Tab-specific isolated filters
  const filteredAll = useMemo(() => {
    return processedRegistrations.filter(p => {
      const matchesSearch = p.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (p.email && p.email.toLowerCase().includes(searchQuery.toLowerCase()));
      
      let matchesStatus = true;
      if (selectedStatus === 'Pre-Registered') {
        matchesStatus = p.status === 'Pending';
      } else if (selectedStatus === 'Checked-in') {
        matchesStatus = p.status === 'In';
      } else if (selectedStatus === 'Walk-in') {
        matchesStatus = p.reg_type === 'walk-in';
      }
      return matchesSearch && matchesStatus;
    });
  }, [processedRegistrations, searchQuery, selectedStatus]);

  const filteredStudent = useMemo(() => {
    return processedRegistrations.filter(p => {
      const isStudent = p.role === 'student' || p.role === 'Student';
      if (!isStudent) return false;

      const matchesSearch = p.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (p.email && p.email.toLowerCase().includes(searchQuery.toLowerCase()));
      
      let matchesStatus = true;
      if (selectedStatus === 'Pre-Registered') {
        matchesStatus = p.status === 'Pending';
      } else if (selectedStatus === 'Checked-in') {
        matchesStatus = p.status === 'In';
      } else if (selectedStatus === 'Walk-in') {
        matchesStatus = p.reg_type === 'walk-in';
      }
      
      let matchesSub = true;
      if (selectedYear !== 'All Years') matchesSub = matchesSub && p.year === selectedYear;
      if (selectedSection !== 'All Sections') matchesSub = matchesSub && p.section === selectedSection;
      
      if (selectedYear === '4th Year' && selectedStudentType !== 'All Types') {
        const role = p.metadata?.studentRole;
        const hasRole = (targetRole: string) => {
          if (!role) return false;
          const normalizedTarget = targetRole.toLowerCase().trim();
          const checkSingle = (roleStr: string) => {
            const s = roleStr.toLowerCase().trim();
            if (s === normalizedTarget) return true;
            if (normalizedTarget.includes('poster') && s.includes('poster')) return true;
            if (normalizedTarget.includes('presenter') && s.includes('presenter') && !s.includes('poster') && !normalizedTarget.includes('poster')) return true;
            if (normalizedTarget.includes('participant') && s.includes('participant')) return true;
            return false;
          };
          if (Array.isArray(role)) {
            return role.some(r => checkSingle(String(r)));
          }
          return checkSingle(String(role));
        };

        const isPoster = hasRole('Poster Presenter');
        const isColloquiumPresenter = hasRole('Colloquium Presenter');
        const isColloquiumParticipant = hasRole('Colloquium Participant');
        const isColloquium = isColloquiumPresenter || isColloquiumParticipant;

        if (selectedStudentType === 'Poster Presenter') {
          matchesSub = matchesSub && isPoster;
        } else if (selectedStudentType === 'Colloquium') {
          if (selectedColloquiumType === 'All Roles') {
            matchesSub = matchesSub && isColloquium;
          } else if (selectedColloquiumType === 'Colloquium Presenter') {
            matchesSub = matchesSub && isColloquiumPresenter;
          } else if (selectedColloquiumType === 'Colloquium Participant') {
            matchesSub = matchesSub && isColloquiumParticipant;
          }
        }
      }

      return matchesSearch && matchesStatus && matchesSub;
    });
  }, [processedRegistrations, searchQuery, selectedStatus, selectedYear, selectedSection, selectedStudentType, selectedColloquiumType]);

  const filteredEmployee = useMemo(() => {
    return processedRegistrations.filter(p => {
      const isEmployee = p.role === 'employee' || p.role === 'Employee';
      if (!isEmployee) return false;

      const matchesSearch = p.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (p.email && p.email.toLowerCase().includes(searchQuery.toLowerCase()));
      
      let matchesStatus = true;
      if (selectedStatus === 'Pre-Registered') {
        matchesStatus = p.status === 'Pending';
      } else if (selectedStatus === 'Checked-in') {
        matchesStatus = p.status === 'In';
      } else if (selectedStatus === 'Walk-in') {
        matchesStatus = p.reg_type === 'walk-in';
      }
      
      let matchesSub = true;
      if (selectedDept !== 'All Depts') matchesSub = matchesSub && p.dept === selectedDept;

      return matchesSearch && matchesStatus && matchesSub;
    });
  }, [processedRegistrations, searchQuery, selectedStatus, selectedDept]);

  const filteredGuest = useMemo(() => {
    return processedRegistrations.filter(p => {
      const isGuest = p.role === 'guest' || p.role === 'Guest';
      if (!isGuest) return false;

      const matchesSearch = p.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (p.email && p.email.toLowerCase().includes(searchQuery.toLowerCase()));
      
      let matchesStatus = true;
      if (selectedStatus === 'Pre-Registered') {
        matchesStatus = p.status === 'Pending';
      } else if (selectedStatus === 'Checked-in') {
        matchesStatus = p.status === 'In';
      } else if (selectedStatus === 'Walk-in') {
        matchesStatus = p.reg_type === 'walk-in';
      }

      return matchesSearch && matchesStatus;
    });
  }, [processedRegistrations, searchQuery, selectedStatus]);

  // Keep filteredData definition for 100% backward compatibility
  const filteredData = useMemo(() => {
    if (activeTab === 'All') return filteredAll;
    if (activeTab === 'Student') return filteredStudent;
    if (activeTab === 'Employee') return filteredEmployee;
    return filteredGuest;
  }, [activeTab, filteredAll, filteredStudent, filteredEmployee, filteredGuest]);

  const filteredLength = filteredData.length;

  const scannedCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < filteredLength; i++) {
      if (filteredData[i].status === 'In') {
        count++;
      }
    }
    return count;
  }, [filteredData, filteredLength]);

  const showPicker = (title: string, options: string[], current: string, setter: (v: string) => void) => {
    setFilterModalData({ title, options, current, setter });
    setFilterSearchQuery('');
    setIsFilterModalVisible(true);
  };

  const handleExport = async (format: string) => {
    if (filteredData.length === 0) {
      showAlert("No Data", "There are no records to export for the current filters.", "info");
      return;
    }

    try {
      setIsExporting(true);
      const eventName = activeEvent?.name || 'Event';
      if (format === 'PDF') {
        await exportRegistryToPDF(filteredData, eventName, activeTab);
      } else {
        await exportRegistryToExcel(filteredData, eventName, activeTab);
      }
      
      showAlert(
        "Export Successful", 
        "To download this to your phone, please select 'Save to Files' or 'Save to Device' from the share menu.", 
        "success"
      );
    } catch (error: any) {
      console.error('Export Error:', error);
      showAlert("Export Failed", error.message || "An unexpected error occurred during export.", "error");
    } finally {
      setIsExporting(false);
    }
  };

  const handleCheckIn = React.useCallback((item: any) => {
    showAlert("Manual Check-In", `Mark ${item.full_name} as attended?`, "confirm", () => {
      // Implementation for manual check-in would go here if needed
    });
  }, [showAlert]);



  const renderSkeletonRow = ({ index }: { index: number }) => (
    <View style={[styles.tableRow, isSmallScreen && { paddingVertical: 12 }]}>
      <View style={[styles.column, { flex: isSmallScreen ? 1.5 : 2 }]}>
        <View style={styles.skeletonTextLarge} />
        <View style={styles.skeletonTextSmall} />
      </View>
      <View style={[styles.column, { flex: isSmallScreen ? 0.6 : 0.8 }]}>
        <View style={styles.skeletonTextMedium} />
      </View>
      <View style={[styles.column, { flex: isSmallScreen ? 1 : 1.2 }]}>
        <View style={styles.skeletonTextMedium} />
      </View>
      <View style={[styles.column, { flex: isSmallScreen ? 1 : 1.2 }]}>
        <View style={styles.skeletonTextMedium} />
      </View>
      <View style={[styles.column, { flex: isSmallScreen ? 0.8 : 1, alignItems: 'flex-end' }]}>
        <View style={styles.skeletonBadge} />
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, isSmallScreen && { paddingHorizontal: 16, paddingTop: 16 }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, isSmallScreen && { width: 32, height: 32, marginRight: 10 }]}>
            <ArrowLeft color="white" size={isSmallScreen ? 16 : 18} />
          </TouchableOpacity>
          <View style={{ flexShrink: 1 }}>
            <Text style={[styles.headerTitle, isSmallScreen && { fontSize: 16 }]} numberOfLines={1}>Participant Registry</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            onPress={() => handleExport('Excel')} 
            disabled={isExporting}
            style={[
              styles.exportTab, 
              isSmallScreen && { paddingHorizontal: 8, paddingVertical: 6, gap: 6 },
              { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)' }
            ]}
          >
            <FileSpreadsheet color="#10b981" size={isSmallScreen ? 12 : 14} />
            <Text style={[styles.exportTabText, isSmallScreen && { fontSize: 10 }, { color: '#10b981' }]}>Excel</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => handleExport('PDF')} 
            disabled={isExporting}
            style={[
              styles.exportTab, 
              isSmallScreen && { paddingHorizontal: 8, paddingVertical: 6, gap: 6 },
              { backgroundColor: 'rgba(129, 140, 248, 0.1)', borderColor: 'rgba(129, 140, 248, 0.2)' }
            ]}
          >
            <FileDown color="#818cf8" size={isSmallScreen ? 12 : 14} />
            <Text style={[styles.exportTabText, isSmallScreen && { fontSize: 10 }, { color: '#818cf8' }]}>PDF</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Role Switcher Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={{ flexGrow: 0, minHeight: isSmallScreen ? 44 : 48, marginBottom: 16 }}
        contentContainerStyle={[styles.tabContainer, { marginBottom: 0, alignItems: 'center' }, isSmallScreen && { paddingHorizontal: 16 }]}
      >
        {(['All', 'Student', 'Employee', 'Guest'] as const).map((tab) => (
          <TouchableOpacity 
            key={tab} 
            onPress={() => setActiveTab(tab)}
            style={[styles.tab, activeTab === tab && styles.activeTab, isSmallScreen && { paddingHorizontal: 12, paddingVertical: 6 }]}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText, isSmallScreen && { fontSize: 12 }]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Contextual Filters */}
      <View style={[styles.filterSection, isSmallScreen && { paddingHorizontal: 16 }]}>
        <View style={[styles.searchBar, isSmallScreen && { paddingHorizontal: 12 }]}>
          <Search color="#64748b" size={16} />
          <TextInput 
            placeholder="Search participants..."
            placeholderTextColor="#64748b"
            style={[styles.searchInput, isSmallScreen && { paddingVertical: 8, fontSize: 13 }]}
            value={localSearchQuery}
            onChangeText={setLocalSearchQuery}
          />
        </View>

        {/* Global Status Filter */}
        <View style={[styles.subFilterRow, { marginBottom: 12 }]}>
          <TouchableOpacity 
            onPress={() => showPicker("Select Status", ['All Statuses', 'Pre-Registered', 'Checked-in', 'Walk-in'], selectedStatus, setSelectedStatus)}
            style={[styles.dropdown, selectedStatus !== 'All Statuses' && styles.dropdownActive, { flex: 1 }]}
          >
            <View style={styles.dropdownLeft}>
              <Filter size={12} color={selectedStatus !== 'All Statuses' ? '#3b82f6' : '#64748b'} />
              <Text style={[styles.dropdownText, selectedStatus !== 'All Statuses' && styles.dropdownTextActive]}>{selectedStatus}</Text>
            </View>
            <ChevronDown color={selectedStatus !== 'All Statuses' ? '#3b82f6' : '#64748b'} size={14} />
          </TouchableOpacity>
        </View>

        {activeTab === 'Student' && (
          <View style={{ gap: 12 }}>
            <View style={styles.subFilterRow}>
              <TouchableOpacity 
                onPress={() => showPicker("Select Year Level", years, selectedYear, setSelectedYear)}
                style={[styles.dropdown, selectedYear !== 'All Years' && styles.dropdownActive]}
              >
                <View style={styles.dropdownLeft}>
                  <Filter size={12} color={selectedYear !== 'All Years' ? '#3b82f6' : '#64748b'} />
                  <Text style={[styles.dropdownText, selectedYear !== 'All Years' && styles.dropdownTextActive]}>{selectedYear}</Text>
                </View>
                <ChevronDown color={selectedYear !== 'All Years' ? '#3b82f6' : '#64748b'} size={14} />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => showPicker("Select Section", sections, selectedSection, setSelectedSection)}
                style={[styles.dropdown, selectedSection !== 'All Sections' && styles.dropdownActive]}
              >
                <View style={styles.dropdownLeft}>
                  <Filter size={12} color={selectedSection !== 'All Sections' ? '#3b82f6' : '#64748b'} />
                  <Text style={[styles.dropdownText, selectedSection !== 'All Sections' && styles.dropdownTextActive]}>{selectedSection}</Text>
                </View>
                <ChevronDown color={selectedSection !== 'All Sections' ? '#3b82f6' : '#64748b'} size={14} />
              </TouchableOpacity>
            </View>

            {selectedYear === '4th Year' && (
              <View style={{ gap: 12 }}>
                <Animated.View entering={FadeInDown.duration(300)} style={styles.subFilterRow}>
                  <TouchableOpacity 
                    onPress={() => {
                      showPicker("Select Role Type", ['All Types', 'Poster Presenter', 'Colloquium'], selectedStudentType, (val) => {
                        setSelectedStudentType(val);
                        setSelectedColloquiumType('All Roles'); // Reset nested filter
                      });
                    }}
                    style={[styles.dropdown, selectedStudentType !== 'All Types' && styles.dropdownActive, { flex: 1 }]}
                  >
                    <View style={styles.dropdownLeft}>
                      <GraduationCap size={14} color={selectedStudentType !== 'All Types' ? '#3b82f6' : '#64748b'} />
                      <Text style={[styles.dropdownText, selectedStudentType !== 'All Types' && styles.dropdownTextActive]}>{selectedStudentType}</Text>
                    </View>
                    <ChevronDown color={selectedStudentType !== 'All Types' ? '#3b82f6' : '#64748b'} size={14} />
                  </TouchableOpacity>
                </Animated.View>

                {selectedStudentType === 'Colloquium' && (
                  <Animated.View entering={FadeInDown.duration(300)} style={styles.subFilterRow}>
                    <TouchableOpacity 
                      onPress={() => showPicker("Select Colloquium Role", ['All Roles', 'Colloquium Presenter', 'Colloquium Participant'], selectedColloquiumType, setSelectedColloquiumType)}
                      style={[styles.dropdown, selectedColloquiumType !== 'All Roles' && styles.dropdownActive, { flex: 1 }]}
                    >
                      <View style={styles.dropdownLeft}>
                        <Users size={14} color={selectedColloquiumType !== 'All Roles' ? '#8b5cf6' : '#64748b'} />
                        <Text style={[styles.dropdownText, selectedColloquiumType !== 'All Roles' && styles.dropdownTextActive]}>{selectedColloquiumType}</Text>
                      </View>
                      <ChevronDown color={selectedColloquiumType !== 'All Roles' ? '#8b5cf6' : '#64748b'} size={14} />
                    </TouchableOpacity>
                  </Animated.View>
                )}
              </View>
            )}
          </View>
        )}

        {activeTab === 'Employee' && (
          <View style={styles.subFilterRow}>
            <TouchableOpacity 
              onPress={() => showPicker("Select Department", departments, selectedDept, setSelectedDept)}
              style={[styles.dropdown, selectedDept !== 'All Depts' && styles.dropdownActive]}
            >
              <View style={styles.dropdownLeft}>
                <Filter size={12} color={selectedDept !== 'All Depts' ? '#3b82f6' : '#64748b'} />
                <Text style={[styles.dropdownText, selectedDept !== 'All Depts' && styles.dropdownTextActive]}>{selectedDept}</Text>
              </View>
              <ChevronDown color={selectedDept !== 'All Depts' ? '#3b82f6' : '#64748b'} size={14} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Table Header */}
      <View style={[styles.tableHeader, isSmallScreen && { paddingHorizontal: 16 }]}>
        <Text style={[styles.columnHeader, { flex: isSmallScreen ? 1.5 : 2 }]}>NAME & ROLE</Text>
        
        {activeTab === 'All' && (
          <>
            <Text style={[styles.columnHeader, { flex: isSmallScreen ? 0.6 : 0.8 }]}>YR</Text>
            <Text style={[styles.columnHeader, { flex: isSmallScreen ? 1 : 1.2 }]}>SEC</Text>
            <Text style={[styles.columnHeader, { flex: isSmallScreen ? 1 : 1.2 }]}>INFO</Text>
          </>
        )}
        
        {activeTab === 'Student' && selectedStudentType !== 'Poster Presenter' && (
          <>
            <Text style={[styles.columnHeader, { flex: isSmallScreen ? 0.6 : 0.8 }]}>YEAR</Text>
            <Text style={[styles.columnHeader, { flex: isSmallScreen ? 1 : 1.2 }]}>SECTION</Text>
            <Text style={[styles.columnHeader, { flex: isSmallScreen ? 1 : 1.2 }]}>STUDENT ID</Text>
          </>
        )}
        
        {activeTab === 'Employee' && (
          <Text style={[styles.columnHeader, { flex: 2 }]}>DEPARTMENT</Text>
        )}
        
        {activeTab === 'Guest' && (
          <Text style={[styles.columnHeader, { flex: 2 }]}>CATEGORY</Text>
        )}

        {activeTab === 'Student' && selectedStudentType === 'Poster Presenter' && (
          <>
            <Text style={[styles.columnHeader, { flex: isSmallScreen ? 1 : 1.2 }]}>SECTION</Text>
            <Text style={[styles.columnHeader, { flex: isSmallScreen ? 1 : 1.2 }]}>GROUP</Text>
          </>
        )}

        <Text style={[styles.columnHeader, { flex: isSmallScreen ? 0.8 : 1, textAlign: 'right' }]}>STATUS</Text>
      </View>

      {/* Table List */}
      <View style={{ flex: 1 }}>
        <View style={[styles.tabContentContainer, activeTab !== 'All' && styles.hiddenContent]}>
          <RegistryListView 
            data={filteredAll}
            tabRole="All"
            selectedStudentType={selectedStudentType}
            isSmallScreen={isSmallScreen}
            onCheckIn={activeEvent?.lifecycle === 'archived' ? undefined : handleCheckIn}
            refreshing={refreshing}
            onRefresh={onRefresh}
            isLoading={isLoading}
            renderSkeletonRow={renderSkeletonRow}
            styles={styles}
          />
        </View>
        
        {studentMounted && (
          <View style={[styles.tabContentContainer, activeTab !== 'Student' && styles.hiddenContent]}>
            <RegistryListView 
              data={filteredStudent}
              tabRole="Student"
              selectedStudentType={selectedStudentType}
              isSmallScreen={isSmallScreen}
              onCheckIn={activeEvent?.lifecycle === 'archived' ? undefined : handleCheckIn}
              refreshing={refreshing}
              onRefresh={onRefresh}
              isLoading={isLoading}
              renderSkeletonRow={renderSkeletonRow}
              styles={styles}
            />
          </View>
        )}

        {employeeMounted && (
          <View style={[styles.tabContentContainer, activeTab !== 'Employee' && styles.hiddenContent]}>
            <RegistryListView 
              data={filteredEmployee}
              tabRole="Employee"
              selectedStudentType={selectedStudentType}
              isSmallScreen={isSmallScreen}
              onCheckIn={activeEvent?.lifecycle === 'archived' ? undefined : handleCheckIn}
              refreshing={refreshing}
              onRefresh={onRefresh}
              isLoading={isLoading}
              renderSkeletonRow={renderSkeletonRow}
              styles={styles}
            />
          </View>
        )}

        {guestMounted && (
          <View style={[styles.tabContentContainer, activeTab !== 'Guest' && styles.hiddenContent]}>
            <RegistryListView 
              data={filteredGuest}
              tabRole="Guest"
              selectedStudentType={selectedStudentType}
              isSmallScreen={isSmallScreen}
              onCheckIn={activeEvent?.lifecycle === 'archived' ? undefined : handleCheckIn}
              refreshing={refreshing}
              onRefresh={onRefresh}
              isLoading={isLoading}
              renderSkeletonRow={renderSkeletonRow}
              styles={styles}
            />
          </View>
        )}
      </View>

      {/* Simple Result Summary Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }, isSmallScreen && { padding: 12 }]}>
        <View style={styles.footerInfo}>
          <Text style={[styles.footerCount, isSmallScreen && { fontSize: 16 }]}>{filteredLength}</Text>
          <Text style={[styles.footerLabel, isSmallScreen && { fontSize: 9 }]}>Participants Listed</Text>
        </View>
        <View style={styles.footerStatus}>
          <Text style={styles.footerStatusText}>
            {scannedCount} Scanned
          </Text>
        </View>
      </View>
  
      {/* Selection Modal */}
      <Modal
        visible={isFilterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{filterModalData.title}</Text>
                <Text style={styles.modalSubtitle}>Choose one from the list</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setIsFilterModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <X color="#64748b" size={20} />
              </TouchableOpacity>
            </View>
  
            <View style={styles.modalSearchContainer}>
              <Search color="#64748b" size={16} />
              <TextInput 
                placeholder="Search options..."
                placeholderTextColor="#64748b"
                style={styles.modalSearchInput}
                value={filterSearchQuery}
                onChangeText={setFilterSearchQuery}
              />
              {filterSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setFilterSearchQuery('')}>
                  <X color="#64748b" size={16} />
                </TouchableOpacity>
              )}
            </View>
  
            <FlatList
              data={filterModalData.options.filter(opt => 
                opt.toLowerCase().includes(filterSearchQuery.toLowerCase())
              )}
              keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  onPress={() => {
                    filterModalData.setter(item);
                    setIsFilterModalVisible(false);
                  }}
                  style={[
                    styles.optionItem,
                    item === filterModalData.current && styles.optionItemActive
                  ]}
                >
                  <Text style={[
                    styles.optionText,
                    item === filterModalData.current && styles.optionTextActive,
                    { flex: 1 }
                  ]}>{item}</Text>
                  {item === filterModalData.current && (
                    <Check color="#3b82f6" size={18} />
                  )}
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.modalListContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.modalEmptyState}>
                  <Text style={styles.modalEmptyText}>No matching options found</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

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
  tabContentContainer: {
    flex: 1,
  },
  hiddenContent: {
    display: 'none',
  },
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    marginRight: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 16,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  activeTab: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  tabText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: 'bold',
  },
  activeTabText: {
    color: 'white',
  },
  filterSection: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: 'white',
    fontSize: 14,
    paddingVertical: 12,
    marginLeft: 10,
  },
  subFilterRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dropdown: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  dropdownActive: {
    borderColor: 'rgba(59, 130, 246, 0.5)',
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
  },
  dropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  dropdownText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  dropdownTextActive: {
    color: 'white',
    fontWeight: 'bold',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#1e293b',
  },
  columnHeader: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#64748b',
    letterSpacing: 1,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#0f172a',
  },
  column: {
    justifyContent: 'center',
  },
  nameText: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  roleText: {
    color: '#3b82f6',
    fontSize: 11,
    fontWeight: 'bold',
  },
  detailsText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 4,
  },
  skeletonTextLarge: {
    width: '70%',
    height: 16,
    backgroundColor: '#1e293b',
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonTextMedium: {
    width: '60%',
    height: 14,
    backgroundColor: '#1e293b',
    borderRadius: 4,
  },
  skeletonTextSmall: {
    width: '40%',
    height: 12,
    backgroundColor: '#1e293b',
    borderRadius: 4,
  },
  skeletonBadge: {
    width: 60,
    height: 24,
    backgroundColor: '#1e293b',
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  timeText: {
    color: '#64748b',
    fontSize: 11,
  },
  emptyState: {
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 15,
  },
  footer: {
    backgroundColor: '#0f172a',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#1e293b',
  },
  footerInfo: {
    alignItems: 'flex-start',
  },
  footerCount: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  footerLabel: {
    color: '#64748b',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  footerStatus: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  footerStatusText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: 'bold',
  },
  topExportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    gap: 12,
  },
  exportLabel: {
    color: '#475569',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  exportActions: {
    flexDirection: 'row',
    gap: 8,
  },
  miniExportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  miniExportText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  manualCheckBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 4,
  },
  manualCheckText: {
    color: '#3b82f6',
    fontSize: 11,
    fontWeight: 'bold',
  },
  quickAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  quickAddText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  exportTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  exportTabText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: '80%',
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    backgroundColor: '#1e293b',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#020617',
    borderRadius: 16,
    marginHorizontal: 24,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 16,
  },
  modalSearchInput: {
    flex: 1,
    color: 'white',
    fontSize: 14,
    paddingVertical: 12,
    marginLeft: 10,
  },
  modalListContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  optionItemActive: {
    borderBottomColor: '#3b82f6',
  },
  optionText: {
    fontSize: 16,
    color: '#94a3b8',
  },
  optionTextActive: {
    color: 'white',
    fontWeight: 'bold',
  },
  modalEmptyState: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  modalEmptyText: {
    color: '#64748b',
    fontSize: 15,
  }
});

export default ParticipantListScreen;
