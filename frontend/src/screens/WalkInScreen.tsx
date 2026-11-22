import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  ActivityIndicator,
  TextInput
} from 'react-native';
import { FeedbackModal } from '../components/FeedbackModal';
import { 
  ArrowLeft, 
  UserPlus, 
  User, 
  GraduationCap,
  Briefcase,
  Users,
  Clock,
  Zap,
  Search,
  CheckCircle2,
  FileText
} from 'lucide-react-native';
import { Input, Button } from '../components/ui';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { API_URL } from '../config/api';

const WalkInScreen = ({ navigation, route }: any) => {
  const { quotaId, roleName, event: routeEvent } = route.params || {};
  const insets = useSafeAreaInsets();
  
  // Basic State
  const [isLoading, setIsLoading] = useState(false);
  const [event, setEvent] = useState<any>(routeEvent || null);
  const [activeSession, setActiveSession] = useState<'am-reg' | 'pm-reg' | 'employee-reg'>('am-reg');

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
  
  // Registration Mode: 'pre-registered' | 'walk-in'
  const [regMode, setRegMode] = useState<'pre-registered' | 'walk-in'>('pre-registered');
  
  // Form Fields State
  const [fullName, setFullName] = useState('');
  const [externalId, setExternalId] = useState('');
  const [email, setEmail] = useState('');
  const [yearSection, setYearSection] = useState('');
  const [capstoneTitle, setCapstoneTitle] = useState('');
  const [groupName, setGroupName] = useState('');
  
  // Sub-roles State
  const [studentYear, setStudentYear] = useState<'3rd Year' | '4th Year'>('3rd Year');
  const [studentType, setStudentType] = useState<'Poster' | 'Presenter' | 'Participant'>('Participant');
  const [guestType, setGuestType] = useState<'Speaker' | 'Others'>('Others');
  const [department, setDepartment] = useState('');

  useEffect(() => {
    if (!event) fetchActiveEvent();
    else detectActiveSession(event);
  }, [event]);

  const detectActiveSession = (activeEvent: any) => {
    // If it's an employee, prioritize employee-reg
    if (roleName === 'Employee') {
      setActiveSession('employee-reg');
      return;
    }

    const amOpen = activeEvent.sessions?.find((s: any) => s.session_type === 'am-reg')?.is_open;
    const pmOpen = activeEvent.sessions?.find((s: any) => s.session_type === 'pm-reg')?.is_open;
    
    if (pmOpen) setActiveSession('pm-reg');
    else if (amOpen) setActiveSession('am-reg');
    else setActiveSession('am-reg'); // Default to AM if nothing is open, force will handle it
  };

  const fetchActiveEvent = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const response = await fetch(`${API_URL}/api/events`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const result = await response.json();
      if (result.status === 'success' && result.data.length > 0) {
        setEvent(result.data[0]);
        detectActiveSession(result.data[0]);
      }
    } catch (error) {
      console.error('Error fetching event:', error);
    }
  };

  const handleSubmit = async () => {
    // Basic Validation
    if (regMode === 'pre-registered') {
      if (roleName === 'Student' && !externalId) {
        showAlert("Required", "Please input Student ID", "error");
        return;
      }
      if (roleName !== 'Student' && !fullName) {
        showAlert("Required", "Please input Full Name", "error");
        return;
      }
    } else {
      // Walk-in Validation
      if (!fullName) {
        showAlert("Required", "Full Name is required", "error");
        return;
      }
    }

    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Prepare metadata based on role and choices (Matching Web Portal Format)
      const metadata: any = {
        registration_source: 'on_site'
      };

      if (roleName === 'Student' && regMode === 'walk-in') {
        metadata.category = 'student';
        metadata.registered_category = 'student';
        metadata.studentId = externalId;
        metadata.yearLevel = studentYear;
        metadata.section = yearSection;
        metadata.studentRole = studentType;
        
        if (studentYear === '4th Year' && studentType !== 'Participant') {
          metadata.capstoneTitle = capstoneTitle;
          metadata.groupName = groupName;
        }
      } else if (roleName === 'Employee' && regMode === 'walk-in') {
        metadata.category = 'employee';
        metadata.registered_category = 'employee';
        metadata.department = department;
        metadata.isWalkIn = true;
        metadata.reg_type = 'walk-in';
      } else if (roleName === 'Guest') {
        metadata.category = 'guest';
        metadata.registered_category = 'guest';
        metadata.guestType = guestType;
      }

      const response = await fetch(`${API_URL}/api/events/manual-register`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}` 
        },
        body: JSON.stringify({
          eventId: event.id,
          mode: regMode,
          role: roleName,
          sessionType: activeSession,
          data: {
            fullName,
            externalId,
            email,
            quotaId,
            metadata
          }
        })
      });

      const result = await response.json();
      
      if (result.status === 'success') {
        showAlert("Success", "Participant registered and marked as attended!", "success", () => {
          navigation.goBack();
        });
      } else {
        showAlert("Failed", result.message || "Manual registration failed.", "error");
      }
    } catch (error: any) {
      showAlert("Error", error.message || "An unexpected error occurred.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const renderFormFields = () => {
    if (roleName === 'Student') {
      if (regMode === 'pre-registered') {
        return (
          <Animated.View entering={FadeInDown} style={styles.fieldGroup}>
            <Input 
              label="Student ID" 
              placeholder="e.g. 2021-00001" 
              value={externalId} 
              onChangeText={setExternalId} 
            />
            <Text style={styles.hint}>Registration will be matched by Student ID</Text>
          </Animated.View>
        );
      } else {
        return (
          <Animated.View entering={FadeInDown} style={styles.fieldGroup}>
            <Text style={styles.label}>YEAR LEVEL</Text>
            <View style={styles.toggleRow}>
              {['3rd Year', '4th Year'].map((year: any) => (
                <TouchableOpacity 
                  key={year}
                  onPress={() => setStudentYear(year)}
                  style={[styles.toggleBtn, studentYear === year && styles.activeToggle]}
                >
                  <Text style={[styles.toggleText, studentYear === year && styles.activeToggleText]}>{year}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {studentYear === '4th Year' && (
              <>
                <Text style={styles.label}>STUDENT TYPE</Text>
                <View style={styles.toggleRow}>
                  {['Poster', 'Presenter', 'Participant'].map((type: any) => (
                    <TouchableOpacity 
                      key={type}
                      onPress={() => setStudentType(type)}
                      style={[styles.toggleBtn, studentType === type && styles.activeToggle]}
                    >
                      <Text style={[styles.toggleText, studentType === type && styles.activeToggleText]}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Input 
              label={studentYear === '4th Year' && studentType !== 'Participant' ? "Representative Name" : "Full Name"} 
              placeholder="Enter name" 
              value={fullName} 
              onChangeText={setFullName} 
            />
            <Input 
              label="Year & Section" 
              placeholder="e.g. BSIT 4A" 
              value={yearSection} 
              onChangeText={setYearSection} 
            />
            
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Input 
                  label="Student ID" 
                  placeholder="Enter ID" 
                  value={externalId} 
                  onChangeText={setExternalId} 
                />
              </View>
              {studentYear === '4th Year' && studentType !== 'Participant' && (
                <View style={{ flex: 1 }}>
                  <Input 
                    label="Group Name" 
                    placeholder="Enter Group" 
                    value={groupName} 
                    onChangeText={setGroupName} 
                  />
                </View>
              )}
            </View>

            {studentYear === '4th Year' && studentType !== 'Participant' && (
              <Input 
                label="Capstone Title" 
                placeholder="Enter project title" 
                value={capstoneTitle} 
                onChangeText={setCapstoneTitle} 
              />
            )}
            
            <Input 
              label="Email Address" 
              placeholder="email@example.com" 
              value={email} 
              onChangeText={setEmail} 
              keyboardType="email-address"
            />
          </Animated.View>
        );
      }
    }

    if (roleName === 'Employee') {
      if (regMode === 'pre-registered') {
        return (
          <Animated.View entering={FadeInDown} style={styles.fieldGroup}>
            <Input 
              label="Employee Name" 
              placeholder="Enter full name" 
              value={fullName} 
              onChangeText={setFullName} 
            />
            <Text style={styles.hint}>Matching by registration name</Text>
          </Animated.View>
        );
      } else {
        return (
          <Animated.View entering={FadeInDown} style={styles.fieldGroup}>
            <Input label="Full Name" placeholder="Enter name" value={fullName} onChangeText={setFullName} />
            <Input label="Department" placeholder="e.g. IT Dept" value={department} onChangeText={setDepartment} />
            <Input label="Email Address" placeholder="email@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" />
          </Animated.View>
        );
      }
    }

    if (roleName === 'Guest') {
      return (
        <Animated.View entering={FadeInDown} style={styles.fieldGroup}>
          <Text style={styles.label}>GUEST CATEGORY</Text>
          <View style={styles.toggleRow}>
            {['Speaker', 'Others'].map((type: any) => (
              <TouchableOpacity 
                key={type}
                onPress={() => setGuestType(type as any)}
                style={[styles.toggleBtn, guestType === type && styles.activeToggle]}
              >
                <Text style={[styles.toggleText, guestType === type && styles.activeToggleText]}>{type}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Input label="Guest Name" placeholder="Enter name" value={fullName} onChangeText={setFullName} />
          {regMode === 'walk-in' && (
            <Input label="Email Address" placeholder="optional" value={email} onChangeText={setEmail} keyboardType="email-address" />
          )}
        </Animated.View>
      );
    }
  };

  if (!event) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft color="white" size={20} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>{roleName} Entry</Text>
          <Text style={styles.headerSubtitle}>Staff Manual Registration</Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          
          <View style={styles.modeSelector}>
            <TouchableOpacity 
              onPress={() => setRegMode('pre-registered')}
              style={[styles.modeBtn, regMode === 'pre-registered' && styles.activeMode]}
            >
              <CheckCircle2 color={regMode === 'pre-registered' ? "white" : "#64748b"} size={20} />
              <Text style={[styles.modeBtnText, regMode === 'pre-registered' && styles.activeModeText]}>Pre-Registered</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setRegMode('walk-in')}
              style={[styles.modeBtn, regMode === 'walk-in' && styles.activeMode]}
            >
              <UserPlus color={regMode === 'walk-in' ? "white" : "#64748b"} size={20} />
              <Text style={[styles.modeBtnText, regMode === 'walk-in' && styles.activeModeText]}>Walk-in</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            {renderFormFields()}

            <TouchableOpacity 
              onPress={handleSubmit} 
              style={[styles.submitBtn, isLoading && { opacity: 0.7 }]}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Text style={styles.submitBtnText}>Confirm Entry</Text>
                  <Zap color="white" size={20} />
                </>
              )}
            </TouchableOpacity>
            
            <View style={styles.sessionInfo}>
              <Clock color="#64748b" size={16} />
              <Text style={styles.sessionText}>Logging to {activeSession.replace('-reg', '').toUpperCase()} Session</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

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
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  scrollContent: {
    padding: 24,
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 6,
    marginBottom: 32,
    gap: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
  },
  activeMode: {
    backgroundColor: '#3b82f6',
  },
  modeBtnText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: 'bold',
  },
  activeModeText: {
    color: 'white',
  },
  form: {
    gap: 24,
  },
  fieldGroup: {
    gap: 16,
  },
  label: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    marginBottom: -8,
  },
  hint: {
    color: '#475569',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: -8,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  toggleBtn: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  activeToggle: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderColor: '#3b82f6',
  },
  toggleText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: 'bold',
  },
  activeToggleText: {
    color: '#3b82f6',
  },
  submitBtn: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 20,
    marginTop: 12,
    gap: 12,
  },
  submitBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sessionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    opacity: 0.6,
  },
  sessionText: {
    color: '#64748b',
    fontSize: 12,
  }
});

export default WalkInScreen;
