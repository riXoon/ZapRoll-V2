import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Platform, 
  KeyboardAvoidingView,
  ActivityIndicator,
  RefreshControl,
  Switch,
  Image,
  Modal,
  useWindowDimensions
} from 'react-native';
import { 
  Settings, 
  Users, 
  Calendar, 
  Plus, 
  Trash2, 
  ChevronRight,
  LayoutDashboard,
  QrCode,
  Globe,
  Sun,
  Moon,
  Clock,
  Lock,
  Unlock,
  Edit3,
  CheckCircle,
  UserPlus,
  ClipboardCheck,
  Star,
  Award,
  Briefcase,
  Save,
  Activity,
  UserCheck,
  TrendingUp,
  ArrowRight,
  LogOut,
  Info,
  ShieldCheck
} from 'lucide-react-native';
import Animated, { FadeInDown, Layout, withRepeat, withTiming, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { supabase } from '../lib/supabase';
import { API_URL } from '../config/api';
import { FeedbackModal } from '../components/FeedbackModal';

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

const AdminScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  
  // Responsive Breakpoints
  const isSmallScreen = screenWidth < 420;
  const isExtraSmall = screenWidth < 370;

  const [activeTab, setActiveTab] = useState<'pre-reg' | 'event-day' | 'post-event'>('pre-reg');
  const [isLocked, setIsLocked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [eventId, setEventId] = useState<string | null>(null);
  
  // State for Event Settings
  const [eventName, setEventName] = useState('Synergy 2026');
  const [venue, setVenue] = useState('Auditorium');
  const [totalCapacity, setTotalCapacity] = useState('500');
  const [eventDate, setEventDate] = useState(new Date('2026-05-20'));
  const [preRegOpen, setPreRegOpen] = useState(true);
  const [preRegDeadline, setPreRegDeadline] = useState(new Date());
  const [stats, setStats] = useState({ total_registrations: 0, total_pre_reg: 0, total_attended: 0, total_pending: 0, colloquium_registered: 0, poster_presenters_registered: 0 });
  const [evalStats, setEvalStats] = useState({ total: 0, amTotal: 0, pmTotal: 0, avgRating: 0 });
  
  // State for Evaluation Links
  const [amEvalLink, setAmEvalLink] = useState('');
  const [pmEvalLink, setPmEvalLink] = useState('');
  const [posterClearanceLink, setPosterClearanceLink] = useState('');
  const [evaluationBaseUrl, setEvaluationBaseUrl] = useState('');
  const [isAmEvalOpen, setIsAmEvalOpen] = useState(false);
  const [isPmEvalOpen, setIsPmEvalOpen] = useState(false);
  const [isPosterClearanceOpen, setIsPosterClearanceOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [bulkIdInput, setBulkIdInput] = useState('');
  const [showEvalSessionModal, setShowEvalSessionModal] = useState(false);
  
  // Registration Links and Counters for Event Day
  const [studentAmLink, setStudentAmLink] = useState('');
  const [studentPmLink, setStudentPmLink] = useState('');
  const [employeeRegLink, setEmployeeRegLink] = useState('');
  const [guestRegLink, setGuestRegLink] = useState('');
  const [studentAmCount, setStudentAmCount] = useState(0);
  const [studentPmCount, setStudentPmCount] = useState(0);
  const [employeeRegCount, setEmployeeRegCount] = useState(0);
  const [guestRegCount, setGuestRegCount] = useState(0);
  const [posterAttendanceLink, setPosterAttendanceLink] = useState('');
  const [isPosterAttendanceOpen, setIsPosterAttendanceOpen] = useState(false);
  const [posterAttendanceCount, setPosterAttendanceCount] = useState(0);

  // Feedback Modal State
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackConfig, setFeedbackConfig] = useState<{
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'confirm';
    onConfirm?: () => void;
    confirmLabel?: string;
  }>({
    title: '',
    message: '',
    type: 'info'
  });

  const showAlert = (
    title: string, 
    message: string, 
    type: 'success' | 'error' | 'info' | 'confirm' = 'info',
    onConfirm?: () => void,
    confirmLabel?: string
  ) => {
    setFeedbackConfig({ title, message, type, onConfirm, confirmLabel });
    setFeedbackVisible(true);
  };

  // State for Session Status (Kill Switch)
  const [isStudentAmOpen, setIsStudentAmOpen] = useState(false);
  const [isStudentPmOpen, setIsStudentPmOpen] = useState(false);
  const [isEmployeeRegOpen, setIsEmployeeRegOpen] = useState(false);
  const [isGuestRegOpen, setIsGuestRegOpen] = useState(false);
  const [isWalkinRegOpen, setIsWalkinRegOpen] = useState(false);
  
  // State for Roles
  const [roles, setRoles] = useState([
    { id: '1', name: 'Student', capacity: '350', registration_url: '', used_capacity: 0, is_open: true },
    { id: '2', name: 'Employee', capacity: '100', registration_url: '', used_capacity: 0, is_open: true },
    { id: '3', name: 'Guest', capacity: '50', registration_url: '', used_capacity: 0, is_open: true },
  ]);

  const addRole = () => {
    const newId = (roles.length + 1).toString();
    setRoles([...roles, { id: newId, name: 'New Role', capacity: '0', registration_url: '', used_capacity: 0, is_open: true }]);
  };

  const removeRole = (id: string) => {
    setRoles(roles.filter(role => role.id !== id));
  };

  const updateRole = (id: string, name: string, capacity: string, registration_url: string = '', used_capacity: number = 0, is_open: boolean = true) => {
    setRoles(roles.map(role => role.id === id ? { ...role, name, capacity, registration_url, used_capacity, is_open } : role));
  };

  // Capacity Computations
  const totalAssigned = roles.reduce((sum, role) => {
    // Exclude roles that have "Poster Presenter" in the name from the main venue capacity count
    if (role.name.toLowerCase().includes('poster presenter')) return sum;
    return sum + (parseInt(role.capacity) || 0);
  }, 0);
  const totalVenue = parseInt(totalCapacity) || 0;
  const remainingSlots = totalVenue - totalAssigned;
  const isOverCapacity = remainingSlots < 0;

  const handleSaveEvent = async () => {
    try {
      setIsSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        showAlert('Error', 'You must be logged in to save events.', 'error');
        return;
      }

      if (!(eventDate instanceof Date) || isNaN(eventDate.getTime())) {
        showAlert('Error', 'Please select a valid event date.', 'error');
        return;
      }

      const eventData = {
        name: eventName,
        venue: venue,
        event_date: eventDate.toISOString(),
        total_capacity: parseInt(totalCapacity) || 0,
        quotas: roles.map(role => ({
          id: role.id,
          name: role.name,
          capacity: parseInt(role.capacity),
          registration_url: role.registration_url,
          is_open: role.is_open
        })),
        pre_reg_open: preRegOpen,
        pre_reg_deadline: preRegDeadline.toISOString(),
        is_locked: isLocked
      };

      const url = eventId ? `${API_URL}/api/events/${eventId}` : `${API_URL}/api/events`;
      const method = eventId ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(eventData)
      });

      const result = await response.json();

      if (result.status === 'success') {
        const savedEvent = result.data;
        if (!eventId && savedEvent.id) {
          setEventId(savedEvent.id);
        }
        setStats(savedEvent.stats || { total_registrations: 0, total_attended: 0, total_pending: 0 });
        
        // IMPORTANT: Sync local roles with database UUIDs
        if (savedEvent.event_quotas && savedEvent.event_quotas.length > 0) {
          setRoles(savedEvent.event_quotas.map((q: any) => ({
            id: q.id,
            name: q.name || q.role_name || '',
            capacity: q.capacity.toString(),
            registration_url: q.registration_url || '',
            used_capacity: q.used_capacity || 0,
            is_open: q.is_open !== undefined ? q.is_open : true
          })));
        }

        showAlert('Success', `Event Settings ${eventId ? 'updated' : 'saved'} successfully!`, 'success');
        setIsLocked(true);
      } else {
        throw new Error(result.message || 'Failed to save event');
      }
  } catch (err: any) {
    showAlert('Error', err.message, 'error');
  } finally {
    setIsSaving(false);
  }
};

const handleSaveRegistrationSettings = async () => {
  if (!eventId) return;
  
  try {
    setIsSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      showAlert('Error', 'You must be logged in to save settings.', 'error');
      return;
    }

    const response = await fetch(`${API_URL}/api/events/${eventId}/registration-settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        student_am_link: studentAmLink,
        student_pm_link: studentPmLink,
        employee_reg_link: employeeRegLink,
        guest_reg_link: guestRegLink,
        student_am_open: isStudentAmOpen,
        student_pm_open: isStudentPmOpen,
        employee_reg_open: isEmployeeRegOpen,
        guest_reg_open: isGuestRegOpen,
        am_eval_link: amEvalLink,
        pm_eval_link: pmEvalLink,
        is_am_eval_open: isAmEvalOpen,
        is_pm_eval_open: isPmEvalOpen,
        poster_clearance_link: posterClearanceLink,
        poster_clearance_open: isPosterClearanceOpen,
        poster_attendance_link: posterAttendanceLink,
        poster_attendance_open: isPosterAttendanceOpen
      })
    });

    // Also update evaluation_base_url on the event itself
    await fetch(`${API_URL}/api/events/${eventId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ evaluation_base_url: evaluationBaseUrl })
    });

    const result = await response.json();

    if (result.status === 'success') {
      showAlert('Success', 'Registration settings updated successfully!', 'success');
    } else {
      throw new Error(result.message || 'Failed to update settings');
    }
  } catch (err: any) {
    showAlert('Error', err.message, 'error');
  } finally {
    setIsSaving(false);
  }
};

const handleToggleSessionStatus = async (type: string, newValue: boolean) => {
  if (!eventId) return;
  
  // Optimistic UI update
  if (type === 'am-reg' || type === 'poster-attendance') {
    setIsStudentAmOpen(newValue);
    setIsPosterAttendanceOpen(newValue);
  } else {
    if (type === 'pm-reg') setIsStudentPmOpen(newValue);
    if (type === 'employee-reg') setIsEmployeeRegOpen(newValue);
    if (type === 'walkin-guest') setIsGuestRegOpen(newValue);
    if (type === 'walkin-reg') setIsWalkinRegOpen(newValue);
    if (type === 'poster-clearance') setIsPosterClearanceOpen(newValue);
    if (type === 'am-eval') setIsAmEvalOpen(newValue);
    if (type === 'pm-eval') setIsPmEvalOpen(newValue);
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    if (type === 'am-reg' || type === 'poster-attendance') {
      // Toggle both sessions to the same value in parallel
      const typesToToggle = ['am-reg', 'poster-attendance'];
      await Promise.all(typesToToggle.map(async (t) => {
        const response = await fetch(`${API_URL}/api/events/${eventId}/sessions/${t}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ is_open: newValue })
        });
        const result = await response.json();
        if (result.status !== 'success') {
          throw new Error(result.message || `Failed to update status for ${t}`);
        }
      }));
    } else {
      const response = await fetch(`${API_URL}/api/events/${eventId}/sessions/${type}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ is_open: newValue })
      });

      const result = await response.json();
      if (result.status !== 'success') {
        throw new Error(result.message || 'Failed to update status');
      }
    }
  } catch (err: any) {
    showAlert('Error', err.message, 'error');
    // Revert UI on failure
    if (type === 'am-reg' || type === 'poster-attendance') {
      setIsStudentAmOpen(!newValue);
      setIsPosterAttendanceOpen(!newValue);
    } else {
      if (type === 'pm-reg') setIsStudentPmOpen(!newValue);
      if (type === 'employee-reg') setIsEmployeeRegOpen(!newValue);
      if (type === 'walkin-guest') setIsGuestRegOpen(!newValue);
      if (type === 'walkin-reg') setIsWalkinRegOpen(!newValue);
      if (type === 'poster-clearance') setIsPosterClearanceOpen(!newValue);
      if (type === 'am-eval') setIsAmEvalOpen(!newValue);
      if (type === 'pm-eval') setIsPmEvalOpen(!newValue);
    }
  }
};

const handleToggleLockStatus = async (newValue: boolean) => {
  setIsLocked(newValue);
  if (!eventId) return;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const response = await fetch(`${API_URL}/api/events/${eventId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ is_locked: newValue })
    });

    const result = await response.json();
    if (result.status !== 'success') throw new Error(result.message);
  } catch (err: any) {
    showAlert('Error', 'Failed to update lock status', 'error');
    setIsLocked(!newValue);
  }
};

const handleTogglePreRegStatus = async (newValue: boolean) => {
  setPreRegOpen(newValue);
  if (!eventId) return;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const response = await fetch(`${API_URL}/api/events/${eventId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ pre_reg_open: newValue })
    });

    const result = await response.json();
    if (result.status !== 'success') throw new Error(result.message);
  } catch (err: any) {
    showAlert('Error', 'Failed to update pre-registration status', 'error');
    setPreRegOpen(!newValue);
  }
};

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchInitialData().finally(() => setRefreshing(false));
  }, []);

  const fetchInitialData = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsLoading(false);
        return;
      }

      console.log('Fetching event data from:', `${API_URL}/api/events`);
      const response = await fetch(`${API_URL}/api/events`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      
      if (!response.ok) throw new Error('Network response was not ok');
      
      const result = await response.json();

      if (result.status === 'success' && result.data.length > 0) {
        const latestEvent = result.data[0];
        console.log('Syncing existing event:', latestEvent.id);
        
        setEventId(latestEvent.id);
        setIsLocked(latestEvent.is_locked || false);
        setEventName(latestEvent.name);
        setVenue(latestEvent.venue);
        setTotalCapacity(latestEvent.total_capacity.toString());
        setEventDate(new Date(latestEvent.event_date));
        setPreRegOpen(latestEvent.pre_reg_open !== undefined ? latestEvent.pre_reg_open : true);
        setPreRegDeadline(latestEvent.pre_reg_deadline ? new Date(latestEvent.pre_reg_deadline) : new Date());
        setEvaluationBaseUrl(latestEvent.evaluation_base_url || '');
        
        // Map Normalized Sessions
        const amSession = (latestEvent.sessions || []).find((s: any) => s.session_type === 'am-reg');
        const pmSession = (latestEvent.sessions || []).find((s: any) => s.session_type === 'pm-reg');
        const empSession = (latestEvent.sessions || []).find((s: any) => s.session_type === 'employee-reg');
        const guestSession = (latestEvent.sessions || []).find((s: any) => s.session_type === 'walkin-guest');
        const walkinSession = (latestEvent.sessions || []).find((s: any) => s.session_type === 'walkin-reg');
        const posterAttendanceSession = (latestEvent.sessions || []).find((s: any) => s.session_type === 'poster-attendance');

        // Map Post-Event Settings (New Table)
        const amEval = (latestEvent.post_event_settings || []).find((s: any) => s.session_type === 'am-eval');
        const pmEval = (latestEvent.post_event_settings || []).find((s: any) => s.session_type === 'pm-eval');
        const posterClearance = (latestEvent.post_event_settings || []).find((s: any) => s.session_type === 'poster-clearance');

        setStudentAmLink(amSession?.registration_link || '');
        setStudentPmLink(pmSession?.registration_link || '');
        setEmployeeRegLink(empSession?.registration_link || '');
        setGuestRegLink(guestSession?.registration_link || '');
        setPosterAttendanceLink(posterAttendanceSession?.registration_link || '');
        
        setAmEvalLink(amEval?.registration_link || '');
        setPmEvalLink(pmEval?.registration_link || '');
        setPosterClearanceLink(posterClearance?.registration_link || '');
        
        setIsStudentAmOpen(amSession?.is_open || false);
        setIsStudentPmOpen(pmSession?.is_open || false);
        setIsEmployeeRegOpen(empSession?.is_open || false);
        setIsGuestRegOpen(guestSession?.is_open || false);
        setIsWalkinRegOpen(walkinSession?.is_open || false);
        setIsPosterAttendanceOpen(posterAttendanceSession?.is_open || false);

        setIsAmEvalOpen(amEval?.is_open || false);
        setIsPmEvalOpen(pmEval?.is_open || false);
        setIsPosterClearanceOpen(posterClearance?.is_open || false);

        setStudentAmCount(latestEvent.student_am_count || 0);
        setStudentPmCount(latestEvent.student_pm_count || 0);
        setEmployeeRegCount(latestEvent.employee_reg_count || 0);
        setGuestRegCount(latestEvent.guest_reg_count || 0);
        setPosterAttendanceCount(latestEvent.stats?.poster_attended_count || 0);
        setStats(latestEvent.stats || { total_registrations: 0, total_pre_reg: 0, total_attended: 0, total_pending: 0, colloquium_registered: 0, poster_presenters_registered: 0 });
        
        // Fetch Evaluation Stats
        const { data: evalData, error: evalError } = await supabase
          .from('v_evaluation_analytics')
          .select('*')
          .eq('event_id', latestEvent.id);
        
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
        }

        if (latestEvent.event_quotas && latestEvent.event_quotas.length > 0) {
          setRoles(latestEvent.event_quotas.map((q: any) => ({
            id: q.id || q.quota_id,
            name: q.name || q.quota_name,
            capacity: q.capacity.toString(),
            registration_url: q.registration_url || '',
            used_capacity: q.used_capacity || 0,
            attended_count: q.attended_count || 0,
            is_open: q.is_open !== undefined ? q.is_open : true
          })));
        }
        
        setIsLocked(true);
      } else {
        console.log('No existing event found, starting fresh.');
        setIsLocked(false);
      }
    } catch (error) {
      console.error('Error fetching initial data:', error);
      showAlert('Sync Error', 'Could not connect to the server. Please check your network.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const [isEventDatePickerVisible, setEventDatePickerVisibility] = useState(false);
  const [isDeadlinePickerVisible, setDeadlinePickerVisibility] = useState(false);

  const isLockedRef = useRef(isLocked);
  useEffect(() => {
    isLockedRef.current = isLocked;
  }, [isLocked]);

  useEffect(() => {
    fetchInitialData();

    // 🚀 Enable Real-Time Sync
    const subscription = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*', 
          schema: 'public',
          table: 'registrations'
        },
        (payload) => {
          // Only refresh if we are NOT in edit mode (locked)
          if (isLockedRef.current) {
            console.log('Real-time registration update detected!', payload);
            fetchInitialData();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE', 
          schema: 'public',
          table: 'events'
        },
        (payload) => {
          // Only refresh if we are NOT in edit mode (locked)
          if (isLockedRef.current) {
            console.log('Real-time event update detected!', payload);
            fetchInitialData();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*', 
          schema: 'public',
          table: 'attendance'
        },
        (payload) => {
          // Only refresh if we are NOT in edit mode (locked)
          if (isLockedRef.current) {
            console.log('Real-time attendance update detected!', payload);
            fetchInitialData();
          }
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  // Picker Handlers
  const handleEventDateConfirm = (date: Date) => {
    setEventDate(date);
    setEventDatePickerVisibility(false);
  };

  const handleDeadlineConfirm = (date: Date) => {
    setPreRegDeadline(date);
    setDeadlinePickerVisibility(false);
  };

  const handleLogout = async () => {
    showAlert(
      'Sign Out',
      'Are you sure you want to sign out from the admin session?',
      'confirm',
      async () => {
        const { error } = await supabase.auth.signOut();
        if (error) showAlert('Error', error.message, 'error');
      },
      'Sign Out'
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, isSmallScreen && { paddingHorizontal: 16 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Image 
            source={require('../../assets/Synergy-01.png')} 
            style={[styles.headerLogo, isSmallScreen && { width: 32, height: 32 }]}
            resizeMode="contain"
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, isSmallScreen && { fontSize: 20 }]} numberOfLines={1}>Event Settings</Text>
            <Text style={[styles.headerSubtitle, isSmallScreen && { fontSize: 12 }]} numberOfLines={1}>System administration</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: isSmallScreen ? 8 : 12 }}>
          <TouchableOpacity 
            style={[styles.logoutButton, isSmallScreen && { width: 40, height: 40 }]}
            onPress={handleLogout}
          >
            <LogOut color="#ef4444" size={isSmallScreen ? 18 : 22} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Switcher */}
      <View style={[styles.tabBar, isSmallScreen && { marginHorizontal: 16, padding: 4 }]}>
        <TouchableOpacity 
          onPress={() => setActiveTab('pre-reg')}
          style={[styles.tab, activeTab === 'pre-reg' && styles.activeTab, isSmallScreen && { paddingVertical: 8 }]}
        >
          <Text style={[styles.tabText, activeTab === 'pre-reg' && styles.activeTabText, isSmallScreen && { fontSize: 11 }]}>Pre-Reg</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setActiveTab('event-day')}
          style={[styles.tab, activeTab === 'event-day' && styles.activeTab, isSmallScreen && { paddingVertical: 8 }]}
        >
          <Text style={[styles.tabText, activeTab === 'event-day' && styles.activeTabText, isSmallScreen && { fontSize: 11 }]}>Registration</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setActiveTab('post-event')}
          style={[styles.tab, activeTab === 'post-event' && styles.activeTab, isSmallScreen && { paddingVertical: 8 }]}
        >
          <Text style={[styles.tabText, activeTab === 'post-event' && styles.activeTabText, isSmallScreen && { fontSize: 11 }]}>Post-Event</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={[styles.scrollView, isSmallScreen && { paddingHorizontal: 16 }]} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor="#3b82f6"
            colors={["#3b82f6"]}
          />
        }
      >
        {isLoading && !refreshing ? (
          <Animated.View entering={FadeInDown.delay(100)}>
            <SkeletonItem width="100%" height={300} borderRadius={24} style={{ marginBottom: 24, marginTop: 16 }} />
            <SkeletonItem width="100%" height={200} borderRadius={24} style={{ marginBottom: 24 }} />
            <SkeletonItem width="100%" height={200} borderRadius={24} style={{ marginBottom: 24 }} />
          </Animated.View>
        ) : (
          <>
            {activeTab === 'pre-reg' && (
          /* PHASE 1: PRE-REGISTRATION TAB */
          <Animated.View>
            {/* Event Details Card */}
            <View style={[styles.card, isSmallScreen && { padding: 16 }]}>
              <View style={[styles.cardHeaderRow, isExtraSmall && { flexDirection: 'column', alignItems: 'flex-start', gap: 12 }]}>
                <View style={styles.cardHeaderLeft}>
                  <LayoutDashboard color="#3b82f6" size={isSmallScreen ? 18 : 20} />
                  <Text style={[styles.cardTitle, isSmallScreen && { fontSize: 16 }]}>Event Identity</Text>
                </View>
                
                <View style={[styles.headerActions, isExtraSmall && { width: '100%', justifyContent: 'space-between' }]}>
                  {/* Current Status Badge */}
                  <View style={[styles.statusBadge, isLocked ? styles.statusBadgeLocked : styles.statusBadgeEdit, isSmallScreen && { paddingHorizontal: 8 }]}>
                    <View style={[styles.statusDot, { backgroundColor: isLocked ? '#10b981' : '#3b82f6' }]} />
                    <Text style={[styles.statusBadgeText, { color: isLocked ? '#10b981' : '#3b82f6' }, isSmallScreen && { fontSize: 9 }]}>
                      {isLocked ? 'FINALIZED' : 'DRAFT'}
                    </Text>
                  </View>

                  {/* Action Button */}
                  <TouchableOpacity 
                    onPress={() => handleToggleLockStatus(!isLocked)}
                    style={[styles.actionToggle, isLocked ? styles.actionToggleUnlock : styles.actionToggleLock, isSmallScreen && { paddingHorizontal: 8 }]}
                  >
                    {isLocked ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Unlock color="#3b82f6" size={isSmallScreen ? 12 : 14} />
                        <Text style={[styles.actionToggleTextBlue, isSmallScreen && { fontSize: 11 }]}>Unlock</Text>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Lock color="#10b981" size={isSmallScreen ? 12 : 14} />
                        <Text style={[styles.actionToggleTextGreen, isSmallScreen && { fontSize: 11 }]}>Lock</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Event Name</Text>
                <TextInput 
                  style={[styles.input, isLocked && styles.disabledInput]} 
                  value={eventName} 
                  onChangeText={setEventName} 
                  editable={!isLocked}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Venue</Text>
                <TextInput 
                  style={[styles.input, isLocked && styles.disabledInput]} 
                  value={venue} 
                  onChangeText={setVenue} 
                  editable={!isLocked}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Event Date</Text>
                <TouchableOpacity 
                  onPress={() => setEventDatePickerVisibility(true)}
                  disabled={isLocked}
                  style={[styles.input, isLocked && styles.disabledInput, { justifyContent: 'center' }]}
                >
                  <Text style={{ color: isLocked ? '#475569' : 'white', fontSize: 16 }}>
                    {eventDate instanceof Date && !isNaN(eventDate.getTime()) 
                      ? eventDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                      : 'Select Date'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Total Venue Capacity</Text>
                <TextInput 
                  style={[styles.input, isLocked && styles.disabledInput]} 
                  value={totalCapacity} 
                  onChangeText={setTotalCapacity} 
                  keyboardType="numeric" 
                  editable={!isLocked}
                />
              </View>
            </View>

            {/* PRE-REGISTRATION EXECUTION RULES */}
            <View style={[styles.card, isSmallScreen && { padding: 16 }]}>
              <View style={[styles.cardHeaderRow, isExtraSmall && { flexDirection: 'column', alignItems: 'flex-start', gap: 12 }]}>
                <View style={styles.cardHeaderLeft}>
                  <Clock color="#3b82f6" size={isSmallScreen ? 18 : 20} />
                  <Text style={[styles.cardTitle, isSmallScreen && { fontSize: 16 }]}>Execution Rules</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: preRegOpen ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }, isSmallScreen && { paddingHorizontal: 8 }]}>
                  <Text style={[styles.statusBadgeText, { color: preRegOpen ? '#10b981' : '#ef4444' }, isSmallScreen && { fontSize: 9 }]}>
                    {preRegOpen ? 'OPEN' : 'CLOSED'}
                  </Text>
                </View>
              </View>

              <View style={[styles.controlRow, isSmallScreen && { padding: 12 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.controlLabel, isSmallScreen && { fontSize: 13 }]}>Pre-Registration Status</Text>
                  <Text style={[styles.controlSubtitle, isSmallScreen && { fontSize: 11 }]}>Manual open/close status</Text>
                </View>
                <Switch
                  value={preRegOpen}
                  onValueChange={handleTogglePreRegStatus}
                  trackColor={{ false: "#1e293b", true: "#3b82f6" }}
                  thumbColor={preRegOpen ? "#ffffff" : "#64748b"}
                  style={Platform.OS === 'ios' ? { transform: [{ scale: isSmallScreen ? 0.8 : 1 }] } : {}}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Automatic Closing Deadline</Text>
                <TouchableOpacity 
                  onPress={() => setDeadlinePickerVisibility(true)}
                  style={[styles.input, { justifyContent: 'center' }, isSmallScreen && { paddingVertical: 10 }]}
                >
                  <Text style={{ color: 'white', fontSize: isSmallScreen ? 14 : 16 }}>
                    {preRegDeadline instanceof Date && !isNaN(preRegDeadline.getTime()) 
                      ? `${preRegDeadline.toLocaleDateString()} at ${preRegDeadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : 'Select Deadline'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Logic Notice */}
              <View style={styles.rulesInfoBox}>
                <Info color="#3b82f6" size={16} />
                <Text style={styles.rulesInfoText}>
                  Logic: Deadline will only trigger if capacity is full. If not full, pre-registration remains open.
                </Text>
              </View>
            </View>


            {/* DateTime Pickers */}
            <DateTimePickerModal
              isVisible={isEventDatePickerVisible}
              mode="date"
              onConfirm = {handleEventDateConfirm}
              onCancel={() => setEventDatePickerVisibility(false)}
              themeVariant="dark"
            />

            <DateTimePickerModal
              isVisible={isDeadlinePickerVisible}
              mode="datetime"
              onConfirm={handleDeadlineConfirm}
              onCancel={() => setDeadlinePickerVisibility(false)}
              themeVariant="dark"
            />

            {/* Live Pre-Reg Analytics Shortcut Card */}
            <TouchableOpacity 
              onPress={() => navigation.navigate('TurnoutDashboard')}
              style={[styles.card, { backgroundColor: 'rgba(59, 130, 246, 0.05)', borderColor: 'rgba(59, 130, 246, 0.2)', marginBottom: 20, padding: isSmallScreen ? 16 : 24 }]}
            >
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <TrendingUp color="#3b82f6" size={isSmallScreen ? 18 : 20} />
                  <Text style={[styles.cardTitle, isSmallScreen && { fontSize: 16 }]}>Live Pre-Reg Analytics</Text>
                </View>
                <ArrowRight color="#3b82f6" size={isSmallScreen ? 18 : 20} />
              </View>
              
              <View style={[styles.analyticsPreview, { backgroundColor: 'transparent', padding: 0, marginTop: 12 }]}>
                <View style={styles.previewItem}>
                  <Text style={[styles.previewValue, { color: 'white' }, isSmallScreen && { fontSize: 18 }]}>
                    {stats.total_pre_reg || 0}
                  </Text>
                  <Text style={[styles.previewLabel, isSmallScreen && { fontSize: 8 }]}>PRE-REG</Text>
                </View>
                <View style={styles.previewDivider} />
                <View style={styles.previewItem}>
                  <Text style={[styles.previewValue, { color: 'white' }, isSmallScreen && { fontSize: 18 }]}>
                    {Math.max(0, Math.ceil((new Date(preRegDeadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))}
                  </Text>
                  <Text style={[styles.previewLabel, isSmallScreen && { fontSize: 8 }]}>DAYS LEFT</Text>
                </View>
                <View style={styles.previewDivider} />
                <View style={styles.previewItem}>
                  <Text style={[styles.previewValue, { color: '#3b82f6' }, isSmallScreen && { fontSize: 18 }]}>
                    {Math.min(100, Math.round(((stats.total_pre_reg || 0) / (parseInt(totalCapacity) || 1)) * 100))}%
                  </Text>
                  <Text style={[styles.previewLabel, isSmallScreen && { fontSize: 8 }]}>FILL RATE</Text>
                </View>
              </View>
              
              {/* Role Quick Breakdown */}
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                <View style={{ flex: 1, backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: 8, borderRadius: 10 }}>
                  <Text style={{ color: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}>COLLOQUIUM</Text>
                  <Text style={{ color: 'white', fontSize: 14, fontWeight: 'bold' }}>{stats.colloquium_registered || 0}</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: 8, borderRadius: 10 }}>
                  <Text style={{ color: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}>POSTERS</Text>
                  <Text style={{ color: 'white', fontSize: 14, fontWeight: 'bold' }}>{stats.poster_presenters_registered || 0}</Text>
                </View>
              </View>
              
              <Text style={[styles.analyticsTapText, { color: '#3b82f6', marginTop: 12 }, isSmallScreen && { fontSize: 11 }]}>Tap to view detailed breakdown →</Text>
            </TouchableOpacity>

            {/* Role Capacities Card */}
            <View style={[styles.card, isSmallScreen && { padding: 16 }]}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <Users color="#3b82f6" size={isSmallScreen ? 18 : 20} />
                  <Text style={[styles.cardTitle, isSmallScreen && { fontSize: 16 }]}>Role Quotas</Text>
                </View>
                {!isLocked && (
                  <TouchableOpacity onPress={addRole} style={[styles.addButton, isSmallScreen && { width: 32, height: 32 }]}>
                    <Plus color="#3b82f6" size={isSmallScreen ? 16 : 18} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Overall Event Progress Card (Static for design consistency) */}
              <View style={[styles.card, styles.preRegShortcut, { marginBottom: 16 }, isSmallScreen && { padding: 12 }]}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardHeaderLeft}>
                    <Info color="#3b82f6" size={isSmallScreen ? 18 : 20} />
                    <Text style={[styles.cardTitle, isSmallScreen && { fontSize: 15 }]}>Registration Rules</Text>
                  </View>
                </View>
                <Text style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>
                  Define the maximum capacity for each student role. These quotas ensure the venue is not overbooked.
                </Text>
              </View>

              {/* Capacity Computation Summary */}
              <View style={[styles.summaryBox, isOverCapacity && styles.summaryBoxError, isSmallScreen && { padding: 12 }]}>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryLabel, isSmallScreen && { fontSize: 8 }]}>TOTAL ROLES ASSIGNED</Text>
                  <Text style={[styles.summaryValue, isSmallScreen && { fontSize: 16 }]}>{totalAssigned}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryLabel, isSmallScreen && { fontSize: 8 }]}>UNALLOCATED SLOTS</Text>
                  <Text style={[styles.summaryValue, isOverCapacity ? { color: '#ef4444' } : { color: '#10b981' }, isSmallScreen && { fontSize: 16 }]}>
                    {remainingSlots}
                  </Text>
                </View>
              </View>

              {roles.map((role) => (
                <View key={role.id} style={[styles.roleCard, { marginBottom: 12 }, isSmallScreen && { padding: 10 }]}>
                  <View style={[styles.roleRow, isSmallScreen && { flexWrap: 'wrap' }]}>
                    <TextInput 
                      style={[
                        styles.input, 
                        { flex: isSmallScreen ? 0 : 2, width: isSmallScreen ? '65%' : 'auto', marginRight: 8, fontSize: isSmallScreen ? 14 : 16 }, 
                        isLocked && styles.disabledInput
                      ]} 
                      value={role.name} 
                      onChangeText={(text) => updateRole(role.id, text, role.capacity, role.registration_url, role.used_capacity)} 
                      editable={!isLocked}
                      placeholder="Role"
                    />
                    <TextInput 
                      style={[
                        styles.input, 
                        { flex: isSmallScreen ? 0 : 1, width: isSmallScreen ? '30%' : 'auto', marginRight: isSmallScreen ? 0 : 8, fontSize: isSmallScreen ? 14 : 16 }, 
                        isLocked && styles.disabledInput
                      ]} 
                      value={role.capacity} 
                      onChangeText={(text) => updateRole(role.id, role.name, text, role.registration_url, role.used_capacity)} 
                      keyboardType="numeric" 
                      editable={!isLocked}
                      placeholder="Slots"
                    />
                    <View style={[styles.usageInfo, isSmallScreen && { flex: 0, width: '100%', marginLeft: 0, marginTop: 12 }]}>
                      <View style={styles.usageHeader}>
                        <Text style={styles.usageLabel}>CAPACITY USAGE</Text>
                        <Text style={[styles.usageRemaining, parseInt(role.capacity) - role.used_capacity <= 5 && { color: '#ef4444' }]}>
                          {Math.max(0, parseInt(role.capacity) - role.used_capacity)} left
                        </Text>
                      </View>
                      <View style={styles.progressBarBg}>
                        <View 
                          style={[
                            styles.progressBarFill, 
                            { 
                              width: `${Math.min(100, (role.used_capacity / (parseInt(role.capacity) || 1)) * 100)}%`,
                              backgroundColor: (role.used_capacity / (parseInt(role.capacity) || 1)) >= 0.9 ? '#ef4444' : '#10b981'
                            }
                          ]} 
                        />
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[styles.roleUsageStats, { flex: 1, textAlign: 'left' }]}>
                          {role.used_capacity} / {role.capacity} registered
                        </Text>
                        {!isLocked && (
                          <TouchableOpacity onPress={() => removeRole(role.id)} style={[styles.deleteBtn, { height: 30, width: 30 }]}>
                            <Trash2 color="#ef4444" size={18} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                  
                  <View style={[styles.roleRow, { marginTop: 8 }]}>
                    <TextInput 
                      style={[styles.input, { flex: 1, marginRight: 8, fontSize: 12, paddingVertical: 8 }, isLocked && styles.disabledInput]} 
                      value={role.registration_url} 
                      onChangeText={(text) => updateRole(role.id, role.name, role.capacity, text, role.used_capacity)} 
                      placeholder="Registration Link (Optional)"
                      editable={!isLocked}
                    />
                    <TouchableOpacity 
                      onPress={() => {
                        const baseUrl = role.registration_url;
                        const finalUrl = baseUrl 
                          ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}quota_id=${role.id}`
                          : null;

                        // Determine dynamic type based on pre-reg role name
                        const roleLower = (role.name || '').toLowerCase();
                        let resolvedType = role.registration_url ? 'external-reg' : 'pre-reg';
                        if (roleLower.includes('employee') || roleLower.includes('faculty') || roleLower.includes('staff')) {
                          resolvedType = 'pre-reg-employee';
                        } else if (roleLower.includes('guest') || roleLower.includes('speaker') || roleLower.includes('visitor') || roleLower.includes('external')) {
                          resolvedType = 'pre-reg-guest';
                        }

                        navigation.navigate('QRGenerator', { 
                          roleName: role.name, 
                          url: finalUrl,
                          type: resolvedType,
                          isPreReg: true,
                          showControls: !role.registration_url,
                          capacity: role.capacity,
                          eventName,
                          venue,
                          eventDate: eventDate.toLocaleDateString(),
                          isOpen: isLocked
                        });
                      }}
                      style={[
                        styles.qrIconBtn, 
                        { 
                          width: 36, 
                          height: 36, 
                          backgroundColor: (() => {
                            if (role.registration_url) return 'rgba(16, 185, 129, 0.1)';
                            const roleLower = (role.name || '').toLowerCase();
                            if (roleLower.includes('employee') || roleLower.includes('faculty') || roleLower.includes('staff')) {
                              return 'rgba(16, 185, 129, 0.1)';
                            }
                            if (roleLower.includes('guest') || roleLower.includes('speaker') || roleLower.includes('visitor') || roleLower.includes('external')) {
                              return 'rgba(245, 158, 11, 0.1)';
                            }
                            return 'rgba(59, 130, 246, 0.1)';
                          })()
                        }
                      ]}
                    >
                      <QrCode 
                        color={(() => {
                          if (role.registration_url) return '#10b981';
                          const roleLower = (role.name || '').toLowerCase();
                          if (roleLower.includes('employee') || roleLower.includes('faculty') || roleLower.includes('staff')) {
                            return '#10b981';
                          }
                          if (roleLower.includes('guest') || roleLower.includes('speaker') || roleLower.includes('visitor') || roleLower.includes('external')) {
                            return '#f59e0b';
                          }
                          return '#3b82f6';
                        })()} 
                        size={18} 
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>

            {/* Save Button */}
            {!isLocked && (
              <TouchableOpacity 
                onPress={handleSaveEvent}
                style={[styles.saveButton, isSaving && styles.saveButtonDisabled, isSmallScreen && { paddingVertical: 14, borderRadius: 14 }]}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <ClipboardCheck color="white" size={isSmallScreen ? 18 : 20} />
                    <Text style={[styles.saveButtonText, isSmallScreen && { fontSize: 14 }]}>Save Configuration</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </Animated.View>
        )}

        {activeTab === 'event-day' && (
          /* PHASE 2: EVENT DAY REGISTRATION TAB */
          <Animated.View>
            
            {/* Live Analytics Shortcut Card */}
            {/* Live Analytics Shortcut Card */}
            <TouchableOpacity 
              onPress={() => navigation.navigate('TurnoutDashboard')}
              style={[styles.card, styles.analyticsShortcut, isSmallScreen && { padding: 16 }]}
            >
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <TrendingUp color="#10b981" size={isSmallScreen ? 18 : 20} />
                  <Text style={[styles.cardTitle, isSmallScreen && { fontSize: 16 }]}>Live Event Analytics</Text>
                </View>
                <ArrowRight color="#10b981" size={isSmallScreen ? 18 : 20} />
              </View>
              <View style={[styles.analyticsPreview, isSmallScreen && { padding: 12, marginTop: 12 }]}>
                <View style={styles.previewItem}>
                  <Text style={[styles.previewValue, isSmallScreen && { fontSize: 18 }]}>{stats.total_attended}</Text>
                  <Text style={[styles.previewLabel, isSmallScreen && { fontSize: 8 }]}>ARRIVED</Text>
                </View>
                <View style={styles.previewDivider} />
                <View style={styles.previewItem}>
                  <Text style={[styles.previewValue, isSmallScreen && { fontSize: 18 }]}>
                    {stats.total_registrations > 0 ? Math.round((stats.total_attended / stats.total_registrations) * 100) : 0}%
                  </Text>
                  <Text style={[styles.previewLabel, isSmallScreen && { fontSize: 8 }]}>TURNOUT</Text>
                </View>
                <View style={styles.previewDivider} />
                <View style={styles.previewItem}>
                  <Text style={[styles.previewValue, isSmallScreen && { fontSize: 18 }]}>{stats.total_pending}</Text>
                  <Text style={[styles.previewLabel, isSmallScreen && { fontSize: 8 }]}>PENDING</Text>
                </View>
              </View>
              <Text style={[styles.analyticsTapText, isSmallScreen && { fontSize: 11 }]}>Tap to view detailed breakdown →</Text>
            </TouchableOpacity>

            {/* Session QRs Section */}
            <Text style={styles.sectionLabel}>Event Day QR Outputs</Text>
            
            {/* Student AM Session Card */}
            <View style={[styles.roleCard, { marginBottom: 16, borderColor: 'rgba(59, 130, 246, 0.2)' }, isSmallScreen && { padding: 12 }]}>
              <View style={[styles.cardHeaderRow, isExtraSmall && { flexDirection: 'column', alignItems: 'flex-start', gap: 10 }]}>
                <View style={styles.cardHeaderLeft}>
                  <Sun color="#3b82f6" size={isSmallScreen ? 16 : 18} />
                  <Text style={[styles.cardTitle, isSmallScreen && { fontSize: 15 }]}>Student AM Session</Text>
                </View>
                <View style={[styles.cardHeaderRight, isExtraSmall && { width: '100%', justifyContent: 'space-between' }]}>
                  <View style={[styles.statusBadge, { backgroundColor: isLocked ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)', marginRight: isExtraSmall ? 0 : 10 }, isSmallScreen && { paddingHorizontal: 6 }]}>
                    <Text style={[styles.statusBadgeText, { color: isLocked ? '#10b981' : '#3b82f6' }, isSmallScreen && { fontSize: 9 }]}>
                      {studentAmCount} SCANS
                    </Text>
                  </View>
                  <Switch
                    value={isStudentAmOpen}
                    onValueChange={(val) => handleToggleSessionStatus('am-reg', val)}
                    trackColor={{ false: "#1e293b", true: "#3b82f6" }}
                    thumbColor={isStudentAmOpen ? "#ffffff" : "#64748b"}
                    style={Platform.OS === 'ios' ? { transform: [{ scale: isSmallScreen ? 0.8 : 0.9 }] } : {}}
                  />
                </View>
              </View>

              <View style={[styles.roleRow, { marginTop: 8 }]}>
                <TextInput 
                  style={[styles.input, { flex: 1, marginRight: 8, fontSize: 11, paddingVertical: 8 }]} 
                  value={studentAmLink} 
                  onChangeText={setStudentAmLink} 
                  placeholder="Paste Student AM Form Link"
                  placeholderTextColor="#475569"
                />
                <TouchableOpacity 
                  onPress={() => navigation.navigate('QRGenerator', { 
                    roleName: 'Student AM Session', 
                    url: studentAmLink,
                    isWalkIn: false,
                    showControls: true,
                    type: 'am-reg',
                    eventName,
                    venue,
                    eventDate: eventDate.toLocaleDateString(),
                    isOpen: isLocked
                  })}
                  disabled={!studentAmLink}
                  style={[styles.qrIconBtn, { width: 36, height: 36, backgroundColor: studentAmLink ? 'rgba(59, 130, 246, 0.1)' : 'rgba(30, 41, 59, 0.5)', opacity: studentAmLink ? 1 : 0.5 }]}
                >
                  <QrCode color={studentAmLink ? "#3b82f6" : "#64748b"} size={18} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Student PM Session Card */}
            <View style={[styles.roleCard, { marginBottom: 16, borderColor: 'rgba(139, 92, 246, 0.2)' }, isSmallScreen && { padding: 12 }]}>
              <View style={[styles.cardHeaderRow, isExtraSmall && { flexDirection: 'column', alignItems: 'flex-start', gap: 10 }]}>
                <View style={styles.cardHeaderLeft}>
                  <Moon color="#8b5cf6" size={isSmallScreen ? 16 : 18} />
                  <Text style={[styles.cardTitle, isSmallScreen && { fontSize: 15 }]}>Student PM Session</Text>
                </View>
                <View style={[styles.cardHeaderRight, isExtraSmall && { width: '100%', justifyContent: 'space-between' }]}>
                  <View style={[styles.statusBadge, { backgroundColor: isLocked ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)', marginRight: isExtraSmall ? 0 : 10 }, isSmallScreen && { paddingHorizontal: 6 }]}>
                    <Text style={[styles.statusBadgeText, { color: isLocked ? '#10b981' : '#3b82f6' }, isSmallScreen && { fontSize: 9 }]}>
                      {studentPmCount} SCANS
                    </Text>
                  </View>
                  <Switch
                    value={isStudentPmOpen}
                    onValueChange={(val) => handleToggleSessionStatus('pm-reg', val)}
                    trackColor={{ false: "#1e293b", true: "#8b5cf6" }}
                    thumbColor={isStudentPmOpen ? "#ffffff" : "#64748b"}
                    style={Platform.OS === 'ios' ? { transform: [{ scale: isSmallScreen ? 0.8 : 0.9 }] } : {}}
                  />
                </View>
              </View>

              <View style={[styles.roleRow, { marginTop: 8 }]}>
                <TextInput 
                  style={[styles.input, { flex: 1, marginRight: 8, fontSize: 11, paddingVertical: 8 }]} 
                  value={studentPmLink} 
                  onChangeText={setStudentPmLink} 
                  placeholder="Paste Student PM Form Link"
                  placeholderTextColor="#475569"
                />
                <TouchableOpacity 
                  onPress={() => navigation.navigate('QRGenerator', { 
                    roleName: 'Student PM Session', 
                    url: studentPmLink,
                    isWalkIn: false,
                    showControls: true,
                    type: 'pm-reg',
                    eventName,
                    venue,
                    eventDate: eventDate.toLocaleDateString(),
                    isOpen: isLocked
                  })}
                  disabled={!studentPmLink}
                  style={[styles.qrIconBtn, { width: 36, height: 36, backgroundColor: studentPmLink ? 'rgba(139, 92, 246, 0.1)' : 'rgba(30, 41, 59, 0.5)', opacity: studentPmLink ? 1 : 0.5 }]}
                >
                  <QrCode color={studentPmLink ? "#8b5cf6" : "#64748b"} size={18} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Employee Registration Card */}
            <View style={[styles.roleCard, { marginBottom: 16, borderColor: 'rgba(16, 185, 129, 0.2)' }, isSmallScreen && { padding: 12 }]}>
              <View style={[styles.cardHeaderRow, isExtraSmall && { flexDirection: 'column', alignItems: 'flex-start', gap: 10 }]}>
                <View style={styles.cardHeaderLeft}>
                  <Briefcase color="#10b981" size={isSmallScreen ? 16 : 18} />
                  <Text style={[styles.cardTitle, isSmallScreen && { fontSize: 15 }]}>Employee Registration</Text>
                </View>
                <View style={[styles.cardHeaderRight, isExtraSmall && { width: '100%', justifyContent: 'space-between' }]}>
                  <View style={[styles.statusBadge, { backgroundColor: isLocked ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)', marginRight: isExtraSmall ? 0 : 10 }, isSmallScreen && { paddingHorizontal: 6 }]}>
                    <Text style={[styles.statusBadgeText, { color: isLocked ? '#10b981' : '#3b82f6' }, isSmallScreen && { fontSize: 9 }]}>
                      {employeeRegCount} SCANS
                    </Text>
                  </View>
                  <Switch
                    value={isEmployeeRegOpen}
                    onValueChange={(val) => handleToggleSessionStatus('employee-reg', val)}
                    trackColor={{ false: "#1e293b", true: "#10b981" }}
                    thumbColor={isEmployeeRegOpen ? "#ffffff" : "#64748b"}
                    style={Platform.OS === 'ios' ? { transform: [{ scale: isSmallScreen ? 0.8 : 0.9 }] } : {}}
                  />
                </View>
              </View>

              <View style={[styles.roleRow, { marginTop: 8 }]}>
                <TextInput 
                  style={[styles.input, { flex: 1, marginRight: 8, fontSize: 11, paddingVertical: 8 }]} 
                  value={employeeRegLink} 
                  onChangeText={setEmployeeRegLink} 
                  placeholder="Paste Employee Registration Link"
                  placeholderTextColor="#475569"
                />
                <TouchableOpacity 
                  onPress={() => navigation.navigate('QRGenerator', { 
                    roleName: 'Employee Registration', 
                    url: employeeRegLink,
                    isWalkIn: false,
                    showControls: true,
                    type: 'employee-reg',
                    eventName,
                    venue,
                    eventDate: eventDate.toLocaleDateString(),
                    isOpen: isLocked
                  })}
                  disabled={!employeeRegLink}
                  style={[styles.qrIconBtn, { width: 36, height: 36, backgroundColor: employeeRegLink ? 'rgba(16, 185, 129, 0.1)' : 'rgba(30, 41, 59, 0.5)', opacity: employeeRegLink ? 1 : 0.5 }]}
                >
                  <QrCode color={employeeRegLink ? "#10b981" : "#64748b"} size={18} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Guest Registration Card */}
            <View style={[styles.roleCard, { marginBottom: 16, borderColor: 'rgba(245, 158, 11, 0.2)' }, isSmallScreen && { padding: 12 }]}>
              <View style={[styles.cardHeaderRow, isExtraSmall && { flexDirection: 'column', alignItems: 'flex-start', gap: 10 }]}>
                <View style={styles.cardHeaderLeft}>
                  <Users color="#f59e0b" size={isSmallScreen ? 16 : 18} />
                  <Text style={[styles.cardTitle, isSmallScreen && { fontSize: 15 }]}>Guest Registration</Text>
                </View>
                <View style={[styles.cardHeaderRight, isExtraSmall && { width: '100%', justifyContent: 'space-between' }]}>
                  <View style={[styles.statusBadge, { backgroundColor: isLocked ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)', marginRight: isExtraSmall ? 0 : 10 }, isSmallScreen && { paddingHorizontal: 6 }]}>
                    <Text style={[styles.statusBadgeText, { color: isLocked ? '#10b981' : '#3b82f6' }, isSmallScreen && { fontSize: 9 }]}>
                      {guestRegCount} SCANS
                    </Text>
                  </View>
                  <Switch
                    value={isGuestRegOpen}
                    onValueChange={(val) => handleToggleSessionStatus('walkin-guest', val)}
                    trackColor={{ false: "#1e293b", true: "#f59e0b" }}
                    thumbColor={isGuestRegOpen ? "#ffffff" : "#64748b"}
                    style={Platform.OS === 'ios' ? { transform: [{ scale: isSmallScreen ? 0.8 : 0.9 }] } : {}}
                  />
                </View>
              </View>

              <View style={[styles.roleRow, { marginTop: 8 }]}>
                <TextInput 
                  style={[styles.input, { flex: 1, marginRight: 8, fontSize: 11, paddingVertical: 8 }]} 
                  value={guestRegLink} 
                  onChangeText={setGuestRegLink} 
                  placeholder="Paste Guest Registration Link"
                  placeholderTextColor="#475569"
                />
                <TouchableOpacity 
                  onPress={() => navigation.navigate('QRGenerator', { 
                    roleName: 'Guest Registration', 
                    url: guestRegLink,
                    isWalkIn: false,
                    showControls: true,
                    type: 'walkin-guest',
                    eventName,
                    venue,
                    eventDate: eventDate.toLocaleDateString(),
                    isOpen: isLocked
                  })}
                  disabled={!guestRegLink}
                  style={[styles.qrIconBtn, { width: 36, height: 36, backgroundColor: guestRegLink ? 'rgba(245, 158, 11, 0.1)' : 'rgba(30, 41, 59, 0.5)', opacity: guestRegLink ? 1 : 0.5 }]}
                >
                  <QrCode color={guestRegLink ? "#f59e0b" : "#64748b"} size={18} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Poster Attendance Card */}
            <View style={[styles.roleCard, { marginBottom: 16, borderColor: 'rgba(236, 72, 153, 0.2)' }, isSmallScreen && { padding: 12 }]}>
              <View style={[styles.cardHeaderRow, isExtraSmall && { flexDirection: 'column', alignItems: 'flex-start', gap: 10 }]}>
                <View style={styles.cardHeaderLeft}>
                  <Award color="#ec4899" size={isSmallScreen ? 16 : 18} />
                  <Text style={[styles.cardTitle, isSmallScreen && { fontSize: 15 }]}>Poster Attendance</Text>
                </View>
                <View style={[styles.cardHeaderRight, isExtraSmall && { width: '100%', justifyContent: 'space-between' }]}>
                  <View style={[styles.statusBadge, { backgroundColor: isLocked ? 'rgba(16, 185, 129, 0.1)' : 'rgba(236, 72, 153, 0.1)', marginRight: isExtraSmall ? 0 : 10 }, isSmallScreen && { paddingHorizontal: 6 }]}>
                    <Text style={[styles.statusBadgeText, { color: isLocked ? '#10b981' : '#ec4899' }, isSmallScreen && { fontSize: 9 }]}>
                      {posterAttendanceCount} SCANS
                    </Text>
                  </View>
                  <Switch
                    value={isPosterAttendanceOpen}
                    onValueChange={(val) => handleToggleSessionStatus('poster-attendance', val)}
                    trackColor={{ false: "#1e293b", true: "#ec4899" }}
                    thumbColor={isPosterAttendanceOpen ? "#ffffff" : "#64748b"}
                    style={Platform.OS === 'ios' ? { transform: [{ scale: isSmallScreen ? 0.8 : 0.9 }] } : {}}
                  />
                </View>
              </View>

              <View style={[styles.roleRow, { marginTop: 8 }]}>
                <TextInput 
                  style={[styles.input, { flex: 1, marginRight: 8, fontSize: 11, paddingVertical: 8 }]} 
                  value={posterAttendanceLink} 
                  onChangeText={setPosterAttendanceLink} 
                  placeholder="Paste Poster Attendance Link"
                  placeholderTextColor="#475569"
                />
                <TouchableOpacity 
                  onPress={() => navigation.navigate('QRGenerator', { 
                    roleName: 'Poster Attendance', 
                    url: posterAttendanceLink,
                    isWalkIn: false,
                    showControls: true,
                    type: 'poster-attendance',
                    eventName,
                    venue,
                    eventDate: eventDate.toLocaleDateString(),
                    isOpen: isLocked
                  })}
                  disabled={!posterAttendanceLink}
                  style={[styles.qrIconBtn, { width: 36, height: 36, backgroundColor: posterAttendanceLink ? 'rgba(236, 72, 153, 0.1)' : 'rgba(30, 41, 59, 0.5)', opacity: posterAttendanceLink ? 1 : 0.5 }]}
                >
                  <QrCode color={posterAttendanceLink ? "#ec4899" : "#64748b"} size={18} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Public Walk-in Setup Section */}
            <Text style={[styles.sectionLabel, { marginTop: 12 }]}>Walk-In Management</Text>
            <TouchableOpacity 
              onPress={() => navigation.navigate('WalkInConfig')}
              style={styles.menuItem}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIcon, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                  <QrCode color="#f59e0b" size={20} />
                </View>
                <View>
                  <Text style={styles.menuItemTitle}>Public Walk-in Setup</Text>
                  <Text style={styles.menuItemSubtitle}>Configure Student, Employee & Guest links</Text>
                </View>
              </View>
              <ChevronRight color="#f59e0b" size={20} />
            </TouchableOpacity>

            {/* Manual Entry Section */}
            <Text style={[styles.sectionLabel, { marginTop: 12 }]}>Staff Manual Entry</Text>
            <TouchableOpacity 
              onPress={() => navigation.navigate('WalkInSelection')}
              style={styles.menuItem}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                  <UserPlus color="#10b981" size={20} />
                </View>
                <View>
                  <Text style={styles.menuItemTitle}>Manual Walk-In Registration</Text>
                  <Text style={styles.menuItemSubtitle}>Register participants without internet</Text>
                </View>
              </View>
              <ChevronRight color="#10b981" size={20} />
            </TouchableOpacity>

            {/* Save Settings Button */}
            <TouchableOpacity 
              style={[styles.saveButton, { marginTop: 24, backgroundColor: '#0f172a' }]}
              onPress={handleSaveRegistrationSettings}
              disabled={isSaving || !eventId}
            >
              {isSaving ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Save color="white" size={20} />
                  <Text style={styles.saveButtonText}>Save Registration Settings</Text>
                </>
              )}
            </TouchableOpacity>

          </Animated.View>
        )}

        {activeTab === 'post-event' && (
          /* PHASE 3: POST-EVENT TAB */
          <Animated.View entering={FadeInDown.duration(400)}>
            
            {/* Live Evaluation Analytics Shortcut Card */}
            <TouchableOpacity 
              onPress={() => navigation.navigate('EvaluationAnalytics', { eventId })}
              style={[styles.card, { backgroundColor: 'rgba(139, 92, 246, 0.05)', borderColor: 'rgba(139, 92, 246, 0.2)', marginBottom: 20, padding: isSmallScreen ? 16 : 24 }]}
            >
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <Star color="#8b5cf6" size={isSmallScreen ? 18 : 20} />
                  <Text style={[styles.cardTitle, isSmallScreen && { fontSize: 16 }]}>Evaluation Pulse</Text>
                </View>
                <ArrowRight color="#8b5cf6" size={isSmallScreen ? 18 : 20} />
              </View>
              
              <View style={[styles.analyticsPreview, { backgroundColor: 'transparent', padding: 0, marginTop: 12 }]}>
                <View style={styles.previewItem}>
                  <Text style={[styles.previewValue, { color: '#3b82f6' }, isSmallScreen && { fontSize: 18 }]}>
                    {evalStats.amTotal}
                  </Text>
                  <Text style={[styles.previewLabel, isSmallScreen && { fontSize: 8 }]}>AM RESPONSES</Text>
                </View>
                <View style={styles.previewDivider} />
                <View style={styles.previewItem}>
                  <Text style={[styles.previewValue, { color: '#8b5cf6' }, isSmallScreen && { fontSize: 18 }]}>
                    {evalStats.pmTotal}
                  </Text>
                  <Text style={[styles.previewLabel, isSmallScreen && { fontSize: 8 }]}>PM RESPONSES</Text>
                </View>
                <View style={styles.previewDivider} />
                <View style={styles.previewItem}>
                  <Text style={[styles.previewValue, { color: '#fbbf24' }, isSmallScreen && { fontSize: 18 }]}>
                    {evalStats.avgRating}
                  </Text>
                  <Text style={[styles.previewLabel, isSmallScreen && { fontSize: 8 }]}>AVG RATING</Text>
                </View>
                <View style={styles.previewDivider} />
                <View style={styles.previewItem}>
                  <Text style={[styles.previewValue, { color: '#10b981' }, isSmallScreen && { fontSize: 18 }]}>
                    {Math.round((evalStats.total / (stats.total_attended || 1)) * 100)}%
                  </Text>
                  <Text style={[styles.previewLabel, isSmallScreen && { fontSize: 8 }]}>ENGAGEMENT</Text>
                </View>
              </View>
              
              <Text style={[styles.analyticsTapText, { color: '#8b5cf6', marginTop: 12 }, isSmallScreen && { fontSize: 11 }]}>Tap to view detailed insights →</Text>
            </TouchableOpacity>
            <View style={[styles.card, isSmallScreen && { padding: 16 }]}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <ClipboardCheck color="#10b981" size={isSmallScreen ? 18 : 20} />
                  <Text style={[styles.cardTitle, isSmallScreen && { fontSize: 16 }]}>Participant Data</Text>
                </View>
              </View>

              <TouchableOpacity 
                onPress={() => navigation.navigate('Whitelist', { eventId })}
                style={[styles.menuItem, isSmallScreen && { padding: 12 }, { marginBottom: 0 }]}
              >
                <View style={styles.menuItemLeft}>
                  <View style={[styles.menuIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }, isSmallScreen && { width: 36, height: 36, marginRight: 12 }]}>
                    <Users color="#10b981" size={isSmallScreen ? 18 : 20} />
                  </View>
                  <View>
                    <Text style={[styles.menuItemTitle, isSmallScreen && { fontSize: 14 }]}>Certificate Whitelist</Text>
                    <Text style={[styles.menuItemSubtitle, isSmallScreen && { fontSize: 11 }]}>View eligible participants</Text>
                  </View>
                </View>
                <ChevronRight color="#10b981" size={isSmallScreen ? 18 : 20} />
              </TouchableOpacity>

              {/* Poster Clearance Whitelist */}
              <TouchableOpacity 
                onPress={() => navigation.navigate('PosterWhitelist', { eventId })}
                style={[styles.menuItem, isSmallScreen && { padding: 12 }, { marginBottom: 0, marginTop: 12, borderTopWidth: 1, borderTopColor: '#0f172a', paddingTop: 12 }]}
              >
                <View style={styles.menuItemLeft}>
                  <View style={[styles.menuIcon, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }, isSmallScreen && { width: 36, height: 36, marginRight: 12 }]}>
                    <Award color="#3b82f6" size={isSmallScreen ? 18 : 20} />
                  </View>
                  <View>
                    <Text style={[styles.menuItemTitle, isSmallScreen && { fontSize: 14 }]}>Poster Cleared Whitelist</Text>
                    <Text style={[styles.menuItemSubtitle, isSmallScreen && { fontSize: 11 }]}>View cleared poster presenters</Text>
                  </View>
                </View>
                <ChevronRight color="#3b82f6" size={isSmallScreen ? 18 : 20} />
              </TouchableOpacity>
            </View>

            {/* Evaluation Form Design */}
            <View style={[styles.card, isSmallScreen && { padding: 16 }]}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <Edit3 color="#3b82f6" size={isSmallScreen ? 18 : 20} />
                  <Text style={[styles.cardTitle, isSmallScreen && { fontSize: 16 }]}>Eval Form Builder</Text>
                </View>
              </View>
              
              <TouchableOpacity 
                onPress={() => setShowEvalSessionModal(true)}
                style={[styles.menuItem, isSmallScreen && { padding: 12 }]}
              >
                <View style={styles.menuItemLeft}>
                  <View style={[styles.menuIcon, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }, isSmallScreen && { width: 36, height: 36, marginRight: 12 }]}>
                    <Plus color="#3b82f6" size={isSmallScreen ? 18 : 20} />
                  </View>
                  <View>
                    <Text style={[styles.menuItemTitle, isSmallScreen && { fontSize: 14 }]}>Design Evaluation Form</Text>
                    <Text style={[styles.menuItemSubtitle, isSmallScreen && { fontSize: 11 }]}>Create questions</Text>
                  </View>
                </View>
                <ChevronRight color="#3b82f6" size={isSmallScreen ? 18 : 20} />
              </TouchableOpacity>
            </View>

            {/* Evaluation Session Selection Modal */}
            <Modal
              visible={showEvalSessionModal}
              transparent
              animationType="fade"
              onRequestClose={() => setShowEvalSessionModal(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Choose Session</Text>
                  <Text style={styles.modalSubtitle}>Which evaluation form would you like to design?</Text>
                  
                  <View style={styles.sessionGrid}>
                    <TouchableOpacity 
                      style={styles.sessionChoice}
                      onPress={() => {
                        setShowEvalSessionModal(false);
                        navigation.navigate('EvaluationForm', { eventId, sessionType: 'am-eval' });
                      }}
                    >
                      <View style={[styles.sessionIcon, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                        <Sun color="#3b82f6" size={24} />
                      </View>
                      <Text style={styles.sessionName}>AM Session</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.sessionChoice}
                      onPress={() => {
                        setShowEvalSessionModal(false);
                        navigation.navigate('EvaluationForm', { eventId, sessionType: 'pm-eval' });
                      }}
                    >
                      <View style={[styles.sessionIcon, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                        <Moon color="#8b5cf6" size={24} />
                      </View>
                      <Text style={styles.sessionName}>PM Session</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity 
                    style={styles.cancelModalBtn}
                    onPress={() => setShowEvalSessionModal(false)}
                  >
                    <Text style={styles.cancelModalBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>


            {/* Link Configuration Card */}
            <View style={[styles.card, isSmallScreen && { padding: 16 }]}>
              <View style={[styles.cardHeaderRow, isExtraSmall && { flexDirection: 'column', alignItems: 'flex-start', gap: 10 }]}>
                <View style={styles.cardHeaderLeft}>
                  <Sun color={isAmEvalOpen ? "#3b82f6" : "#64748b"} size={isSmallScreen ? 18 : 20} />
                  <Text style={[styles.cardTitle, isSmallScreen && { fontSize: 16 }]}>AM Evaluation</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: isAmEvalOpen ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }, isSmallScreen && { paddingHorizontal: 8 }]}>
                  <Text style={[styles.statusBadgeText, { color: isAmEvalOpen ? '#10b981' : '#ef4444' }, isSmallScreen && { fontSize: 9 }]}>
                    {isAmEvalOpen ? 'OPEN' : 'CLOSED'}
                  </Text>
                </View>
              </View>

              <View style={[styles.controlRow, isSmallScreen && { padding: 12 }]}>
                <View>
                  <Text style={[styles.controlLabel, isSmallScreen && { fontSize: 13 }]}>Accept Submissions</Text>
                  <Text style={[styles.controlSubtitle, isSmallScreen && { fontSize: 11 }]}>Manual open/close</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => handleToggleSessionStatus('am-eval', !isAmEvalOpen)}
                  style={[styles.toggleBtn, { backgroundColor: isAmEvalOpen ? '#3b82f6' : '#1e293b' }, isSmallScreen && { width: 36, height: 20 }]}
                >
                  <View style={[styles.toggleCircle, { transform: [{ translateX: isAmEvalOpen ? (isSmallScreen ? 16 : 20) : 0 }], width: isSmallScreen ? 16 : 20, height: isSmallScreen ? 16 : 20 }]} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Paste Evaluation URL</Text>
                <TextInput 
                  style={[styles.input, isSmallScreen && { fontSize: 13, paddingVertical: 10 }]} 
                  value={amEvalLink} 
                  onChangeText={setAmEvalLink} 
                  placeholder="https://yourschool.edu/eval?session=am"
                />
              </View>

              <TouchableOpacity 
                onPress={() => {
                  const finalUrl = amEvalLink || (evaluationBaseUrl 
                    ? `${evaluationBaseUrl}${evaluationBaseUrl.includes('?') ? '&' : '?'}eventId=${eventId}&session=am-eval`
                    : null);
                  
                  navigation.navigate('QRGenerator', { 
                    roleName: 'AM Evaluation', 
                    url: finalUrl,
                    isOpen: isAmEvalOpen,
                    type: 'am-eval',
                    eventName,
                    venue,
                    eventDate: eventDate.toLocaleDateString()
                  });
                }}
                disabled={!amEvalLink && !evaluationBaseUrl}
                style={[styles.menuItem, { borderBottomWidth: 0, marginBottom: 0, opacity: (amEvalLink || evaluationBaseUrl) ? 1 : 0.4 }, isSmallScreen && { padding: 12 }]}
              >
                <View style={styles.menuItemLeft}>
                  <View style={[styles.menuIcon, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }, isSmallScreen && { width: 36, height: 36, marginRight: 12 }]}>
                    <QrCode color="#3b82f6" size={isSmallScreen ? 18 : 20} />
                  </View>
                  <View>
                    <Text style={[styles.menuItemTitle, isSmallScreen && { fontSize: 14 }]}>Generate AM QR</Text>
                    <Text style={[styles.menuItemSubtitle, isSmallScreen && { fontSize: 11 }]}>Link must be provided</Text>
                  </View>
                </View>
                <ChevronRight color="#3b82f6" size={isSmallScreen ? 18 : 20} />
              </TouchableOpacity>
            </View>

            <View style={[styles.card, isSmallScreen && { padding: 16 }]}>
              <View style={[styles.cardHeaderRow, isExtraSmall && { flexDirection: 'column', alignItems: 'flex-start', gap: 10 }]}>
                <View style={styles.cardHeaderLeft}>
                  <Moon color={isPmEvalOpen ? "#8b5cf6" : "#64748b"} size={isSmallScreen ? 18 : 20} />
                  <Text style={[styles.cardTitle, isSmallScreen && { fontSize: 16 }]}>PM Evaluation</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: isPmEvalOpen ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }, isSmallScreen && { paddingHorizontal: 8 }]}>
                  <Text style={[styles.statusBadgeText, { color: isPmEvalOpen ? '#10b981' : '#ef4444' }, isSmallScreen && { fontSize: 9 }]}>
                    {isPmEvalOpen ? 'OPEN' : 'CLOSED'}
                  </Text>
                </View>
              </View>

              <View style={[styles.controlRow, isSmallScreen && { padding: 12 }]}>
                <View>
                  <Text style={[styles.controlLabel, isSmallScreen && { fontSize: 13 }]}>Accept Submissions</Text>
                  <Text style={[styles.controlSubtitle, isSmallScreen && { fontSize: 11 }]}>Manual open/close</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => handleToggleSessionStatus('pm-eval', !isPmEvalOpen)}
                  style={[styles.toggleBtn, { backgroundColor: isPmEvalOpen ? '#8b5cf6' : '#1e293b' }, isSmallScreen && { width: 36, height: 20 }]}
                >
                  <View style={[styles.toggleCircle, { transform: [{ translateX: isPmEvalOpen ? (isSmallScreen ? 16 : 20) : 0 }], width: isSmallScreen ? 16 : 20, height: isSmallScreen ? 16 : 20 }]} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Paste Evaluation URL</Text>
                <TextInput 
                  style={[styles.input, isSmallScreen && { fontSize: 13, paddingVertical: 10 }]} 
                  value={pmEvalLink} 
                  onChangeText={setPmEvalLink} 
                  placeholder="https://yourschool.edu/eval?session=pm"
                />
              </View>

              <TouchableOpacity 
                onPress={() => {
                  const finalUrl = pmEvalLink || (evaluationBaseUrl 
                    ? `${evaluationBaseUrl}${evaluationBaseUrl.includes('?') ? '&' : '?'}eventId=${eventId}&session=pm-eval`
                    : null);
                  
                  navigation.navigate('QRGenerator', { 
                    roleName: 'PM Evaluation', 
                    url: finalUrl,
                    isOpen: isPmEvalOpen,
                    type: 'pm-eval',
                    eventName,
                    venue,
                    eventDate: eventDate.toLocaleDateString()
                  });
                }}
                disabled={!pmEvalLink && !evaluationBaseUrl}
                style={[styles.menuItem, { borderBottomWidth: 0, marginBottom: 0, opacity: (pmEvalLink || evaluationBaseUrl) ? 1 : 0.4 }, isSmallScreen && { padding: 12 }]}
              >
                <View style={styles.menuItemLeft}>
                  <View style={[styles.menuIcon, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }, isSmallScreen && { width: 36, height: 36, marginRight: 12 }]}>
                    <QrCode color="#8b5cf6" size={isSmallScreen ? 18 : 20} />
                  </View>
                  <View>
                    <Text style={[styles.menuItemTitle, isSmallScreen && { fontSize: 14 }]}>Generate PM QR</Text>
                    <Text style={[styles.menuItemSubtitle, isSmallScreen && { fontSize: 11 }]}>Link must be provided</Text>
                  </View>
                </View>
                <ChevronRight color="#8b5cf6" size={isSmallScreen ? 18 : 20} />
              </TouchableOpacity>
            </View>

            {/* Poster Participant Clearance QR */}
            <View style={[styles.card, { borderColor: 'rgba(236, 72, 153, 0.2)' }, isSmallScreen && { padding: 16 }]}>
              <View style={[styles.cardHeaderRow, isExtraSmall && { flexDirection: 'column', alignItems: 'flex-start', gap: 10 }]}>
                <View style={styles.cardHeaderLeft}>
                  <Award color={isPosterClearanceOpen ? "#ec4899" : "#64748b"} size={isSmallScreen ? 18 : 20} />
                  <Text style={[styles.cardTitle, isSmallScreen && { fontSize: 16 }]}>Poster Clearance</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: isPosterClearanceOpen ? 'rgba(236, 72, 153, 0.1)' : 'rgba(239, 68, 68, 0.1)' }, isSmallScreen && { paddingHorizontal: 8 }]}>
                  <Text style={[styles.statusBadgeText, { color: isPosterClearanceOpen ? '#ec4899' : '#ef4444' }, isSmallScreen && { fontSize: 9 }]}>
                    {isPosterClearanceOpen ? 'OPEN' : 'CLOSED'}
                  </Text>
                </View>
              </View>

              <View style={[styles.controlRow, isSmallScreen && { padding: 12 }]}>
                <View>
                  <Text style={[styles.controlLabel, isSmallScreen && { fontSize: 13 }]}>Accept Clearance Scans</Text>
                  <Text style={[styles.controlSubtitle, isSmallScreen && { fontSize: 11 }]}>Poster Certificates</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => handleToggleSessionStatus('poster-clearance', !isPosterClearanceOpen)}
                  style={[styles.toggleBtn, { backgroundColor: isPosterClearanceOpen ? '#ec4899' : '#1e293b' }, isSmallScreen && { width: 36, height: 20 }]}
                >
                  <View style={[styles.toggleCircle, { transform: [{ translateX: isPosterClearanceOpen ? (isSmallScreen ? 16 : 20) : 0 }], width: isSmallScreen ? 16 : 20, height: isSmallScreen ? 16 : 20 }]} />
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Poster Clearance URL</Text>
                <TextInput 
                  style={[styles.input, isSmallScreen && { fontSize: 13, paddingVertical: 10 }]} 
                  value={posterClearanceLink} 
                  onChangeText={setPosterClearanceLink} 
                  placeholder="https://yourschool.edu/poster-clearance"
                  placeholderTextColor="#475569"
                />
              </View>

              <TouchableOpacity 
                onPress={() => {
                  const finalUrl = posterClearanceLink || (evaluationBaseUrl 
                    ? `${evaluationBaseUrl}${evaluationBaseUrl.includes('?') ? '&' : '?'}eventId=${eventId}&session=poster_clearance`
                    : null);
                  
                  navigation.navigate('QRGenerator', { 
                    roleName: 'Poster Clearance', 
                    url: finalUrl,
                    isOpen: isPosterClearanceOpen,
                    type: 'poster-clearance',
                    eventName,
                    venue,
                    eventDate: eventDate.toLocaleDateString(),
                    showControls: true
                  });
                }}
                disabled={!posterClearanceLink && !evaluationBaseUrl}
                style={[styles.menuItem, { borderBottomWidth: 0, marginBottom: 0, opacity: (posterClearanceLink || evaluationBaseUrl) ? 1 : 0.4 }, isSmallScreen && { padding: 12 }]}
              >
                <View style={styles.menuItemLeft}>
                  <View style={[styles.menuIcon, { backgroundColor: 'rgba(236, 72, 153, 0.1)' }, isSmallScreen && { width: 36, height: 36, marginRight: 12 }]}>
                    <QrCode color="#ec4899" size={isSmallScreen ? 18 : 20} />
                  </View>
                  <View>
                    <Text style={[styles.menuItemTitle, isSmallScreen && { fontSize: 14 }]}>Generate Clearance QR</Text>
                    <Text style={[styles.menuItemSubtitle, isSmallScreen && { fontSize: 11 }]}>Link must be provided</Text>
                  </View>
                </View>
                <ChevronRight color="#ec4899" size={isSmallScreen ? 18 : 20} />
              </TouchableOpacity>
            </View>

            {/* Save Post-Event Settings Button */}
            <TouchableOpacity 
              style={[styles.saveButton, { marginTop: 24, backgroundColor: '#0f172a' }, isSmallScreen && { paddingVertical: 14, borderRadius: 14 }]}
              onPress={handleSaveRegistrationSettings}
              disabled={isSaving || !eventId}
            >
              {isSaving ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Save color="white" size={isSmallScreen ? 18 : 20} />
                  <Text style={[styles.saveButtonText, isSmallScreen && { fontSize: 14 }]}>Save Post-Event Settings</Text>
                </>
              )}
            </TouchableOpacity>

          </Animated.View>
        )}

        <View style={styles.footerCredits}>
          <Text style={styles.devLabel}>ZapRoll Developed by:</Text>
          <Text style={styles.devNames}>Adrian Frivaldo • Erickson Guhilde</Text>
        </View>

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
        confirmLabel={feedbackConfig.confirmLabel}
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
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  usageStats: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 6,
  },
  analyticsShortcut: {
    borderColor: 'rgba(16, 185, 129, 0.3)',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  preRegShortcut: {
    borderColor: 'rgba(59, 130, 246, 0.3)',
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
  },
  analyticsPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    padding: 16,
    borderRadius: 12,
  },
  previewItem: {
    alignItems: 'center',
    flex: 1,
  },
  previewValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  previewLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#64748b',
    marginTop: 4,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  previewDivider: {
    width: 1,
    height: 25,
    backgroundColor: '#1e293b',
  },
  analyticsTapText: {
    fontSize: 12,
    color: '#10b981',
    marginTop: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  turnoutStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  turnoutStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  turnoutStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  turnoutStatLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#64748b',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  helperText: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.1)',
  },
  infoText: {
    color: '#3b82f6',
    fontSize: 12,
    flex: 1,
  },
  turnoutDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#1e293b',
  },
  turnoutFooter: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  turnoutFooterText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  roleBreakdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  roleBreakdownBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  roleBreakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roleBreakdownName: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  roleBreakdownStats: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  roleTurnoutPercent: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 6,
    textAlign: 'right',
  },
  profileButton: {
    width: 44,
    height: 44,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  logoutButton: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    marginHorizontal: 24,
    padding: 6,
    borderRadius: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeTab: {
    backgroundColor: '#1e293b',
  },
  tabText: {
    color: '#64748b',
    fontWeight: '600',
    fontSize: 12,
  },
  activeTabText: {
    color: 'white',
  },
  scrollView: {
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748b',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 16,
    marginLeft: 4,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: 'white',
    fontSize: 16,
  },
  roleCard: {
    backgroundColor: '#020617',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qrIconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  usageInfo: {
    flex: 2,
    marginLeft: 8,
  },
  usageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  usageLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  usageRemaining: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: 'bold',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#0f172a',
    borderRadius: 3,
    width: '100%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  roleUsageStats: {
    color: '#475569',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'right',
    fontWeight: '500',
  },
  deleteBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  menuItemTitle: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  menuItemSubtitle: {
    color: '#64748b',
    fontSize: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 6,
  },
  statusBadgeEdit: {
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
  },
  statusBadgeLocked: {
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
  },
  actionToggleLock: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  actionToggleUnlock: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  actionToggleTextGreen: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: 'bold',
  },
  actionToggleTextBlue: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: 'bold',
  },
  disabledInput: {
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    color: '#475569',
    borderColor: 'transparent',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#020617',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  controlLabel: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  controlSubtitle: {
    color: '#64748b',
    fontSize: 12,
  },
  toggleBtn: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
  },
  toggleCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'white',
  },
  summaryBox: {
    flexDirection: 'row',
    backgroundColor: '#020617',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  summaryBoxError: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  footerCredits: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  overallStatsBox: {
    backgroundColor: '#020617',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  overallStatsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 10,
  },
  overallStatsValue: {
    fontSize: 22,
    fontWeight: '900',
    color: 'white',
  },
  overallStatsTarget: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  devLabel: {
    color: '#64748b',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  devNames: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 18,
    marginBottom: 32,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  saveButtonDisabled: {
    opacity: 0.6,
    backgroundColor: '#1e293b',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 10,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  summaryDivider: {
    width: 1,
    height: '100%',
    backgroundColor: '#1e293b',
    marginHorizontal: 12,
  },
  rulesInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.1)',
  },
  rulesInfoText: {
    color: '#94a3b8',
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
  },
  whitelistCard: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  whitelistLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  whitelistIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whitelistTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  whitelistSubtitle: {
    color: '#64748b',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#0f172a',
    borderRadius: 32,
    padding: 32,
    width: '100%',
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32,
  },
  sessionGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
  },
  sessionChoice: {
    flex: 1,
    backgroundColor: '#020617',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  sessionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  sessionName: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  cancelModalBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  cancelModalBtnText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default AdminScreen;
