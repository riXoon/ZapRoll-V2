import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Switch, 
  TextInput,
  ActivityIndicator
} from 'react-native';
import { FeedbackModal } from '../components/FeedbackModal';
import { 
  ArrowLeft, 
  QrCode, 
  UserCircle, 
  Briefcase, 
  Users, 
  Save,
  ExternalLink,
  Info
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { supabase } from '../lib/supabase';
import { API_URL } from '../config/api';

const WalkInConfigScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [eventId, setEventId] = useState<string | null>(null);

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
  
  // Links State
  const [studentLink, setStudentLink] = useState('');
  const [employeeLink, setEmployeeLink] = useState('');
  const [guestLink, setGuestLink] = useState('');
  
  // Status State
  const [isStudentOpen, setIsStudentOpen] = useState(false);
  const [isEmployeeOpen, setIsEmployeeOpen] = useState(false);
  const [isGuestOpen, setIsGuestOpen] = useState(false);

  // Quota IDs State
  const [studentQuotaId, setStudentQuotaId] = useState<string | null>(null);
  const [employeeQuotaId, setEmployeeQuotaId] = useState<string | null>(null);
  const [guestQuotaId, setGuestQuotaId] = useState<string | null>(null);

  useEffect(() => {
    fetchEventSettings();
  }, []);

  const handleToggleStatus = async (type: string, newValue: boolean) => {
    if (!eventId) return;

    // Optimistic UI update
    if (type === 'walkin-student') setIsStudentOpen(newValue);
    if (type === 'walkin-employee') setIsEmployeeOpen(newValue);
    if (type === 'walkin-guest') setIsGuestOpen(newValue);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

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
    } catch (error: any) {
      // Revert on error
      if (type === 'walkin-student') setIsStudentOpen(!newValue);
      if (type === 'walkin-employee') setIsEmployeeOpen(!newValue);
      if (type === 'walkin-guest') setIsGuestOpen(!newValue);
      showAlert('Error', 'Failed to update session status.', 'error');
    }
  };

  const fetchEventSettings = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${API_URL}/api/events`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const result = await response.json();
      
      if (result.status === 'success' && result.data.length > 0) {
        const event = result.data[0];
        setEventId(event.id);
        
        // Map session data to state
        const sLink = event.sessions?.find((s: any) => s.session_type === 'walkin-student');
        const eLink = event.sessions?.find((s: any) => s.session_type === 'walkin-employee');
        const gLink = event.sessions?.find((s: any) => s.session_type === 'walkin-guest');
        
        setStudentLink(sLink?.registration_link || '');
        setEmployeeLink(eLink?.registration_link || '');
        setGuestLink(gLink?.registration_link || '');
        
        setIsStudentOpen(sLink?.is_open || false);
        setIsEmployeeOpen(eLink?.is_open || false);
        setIsGuestOpen(gLink?.is_open || false);

        // Map quota data to state
        if (event.event_quotas && event.event_quotas.length > 0) {
          const sQuota = event.event_quotas.find((q: any) => q.name === 'Student');
          const eQuota = event.event_quotas.find((q: any) => q.name === 'Employee');
          const gQuota = event.event_quotas.find((q: any) => q.name === 'Guest');

          setStudentQuotaId(sQuota?.id || null);
          setEmployeeQuotaId(eQuota?.id || null);
          setGuestQuotaId(gQuota?.id || null);
        }
      }
    } catch (error) {
      console.error('Error fetching walk-in settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!eventId) return;
    
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${API_URL}/api/events/${eventId}/registration-settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          walkin_student_link: studentLink,
          walkin_student_open: isStudentOpen,
          walkin_employee_link: employeeLink,
          walkin_employee_open: isEmployeeOpen,
          guest_reg_link: guestLink,
          guest_reg_open: isGuestOpen
        })
      });

      const result = await response.json();
      if (result.status === 'success') {
        showAlert('Success', 'Walk-in configuration saved successfully!', 'success');
      } else {
        throw new Error(result.message || 'Failed to save');
      }
    } catch (error: any) {
      showAlert('Error', error.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#3b82f6" size="large" />
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
          <Text style={styles.headerTitle}>Walk-In Registration Setup</Text>
          <Text style={styles.headerSubtitle}>Configure public webform links</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.delay(100)} style={styles.infoBox}>
          <Info color="#3b82f6" size={20} />
          <Text style={styles.infoText}>
            These links will be encoded into QR codes that participants scan to register themselves.
          </Text>
        </Animated.View>

        {/* Student Walk-in */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.configCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleBox}>
              <UserCircle color="#3b82f6" size={20} />
              <Text style={styles.cardTitle}>Student Walk-in</Text>
            </View>
            <Switch
              value={isStudentOpen}
              onValueChange={(val) => handleToggleStatus('walkin-student', val)}
              trackColor={{ false: '#1e293b', true: '#3b82f6' }}
              thumbColor="white"
            />
          </View>
          <TextInput
            style={styles.input}
            placeholder="Paste Student Webform URL"
            placeholderTextColor="#475569"
            value={studentLink}
            onChangeText={setStudentLink}
          />
          <TouchableOpacity 
            style={[styles.qrBtn, !studentLink && styles.disabledBtn]}
            disabled={!studentLink}
            onPress={() => {
              const finalUrl = studentLink 
                ? `${studentLink}${studentLink.includes('?') ? '&' : '?'}quota_id=${studentQuotaId || ''}`
                : studentLink;

              navigation.navigate('QRGenerator', { 
                url: finalUrl, 
                title: 'Student Walk-In Registration',
                subtitle: 'Scan to register as student',
                isWalkIn: true,
                type: 'walkin-student'
              });
            }}
          >
            <QrCode color={studentLink ? "#3b82f6" : "#475569"} size={18} />
            <Text style={[styles.qrBtnText, !studentLink && { color: '#475569' }]}>Generate Student QR</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Employee Walk-in */}
        <Animated.View entering={FadeInDown.delay(300)} style={[styles.configCard, { borderColor: '#10b98133' }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleBox}>
              <Briefcase color="#10b981" size={20} />
              <Text style={styles.cardTitle}>Employee Walk-in</Text>
            </View>
            <Switch
              value={isEmployeeOpen}
              onValueChange={(val) => handleToggleStatus('walkin-employee', val)}
              trackColor={{ false: '#1e293b', true: '#10b981' }}
              thumbColor="white"
            />
          </View>
          <TextInput
            style={styles.input}
            placeholder="Paste Employee Webform URL"
            placeholderTextColor="#475569"
            value={employeeLink}
            onChangeText={setEmployeeLink}
          />
          <TouchableOpacity 
            style={[styles.qrBtn, !employeeLink && styles.disabledBtn]}
            disabled={!employeeLink}
            onPress={() => {
              const finalUrl = employeeLink 
                ? `${employeeLink}${employeeLink.includes('?') ? '&' : '?'}quota_id=${employeeQuotaId || ''}`
                : employeeLink;

              navigation.navigate('QRGenerator', { 
                url: finalUrl, 
                title: 'Employee Walk-In Registration',
                subtitle: 'Scan to register as employee',
                isWalkIn: true,
                type: 'employee-reg'
              });
            }}
          >
            <QrCode color={employeeLink ? "#10b981" : "#475569"} size={18} />
            <Text style={[styles.qrBtnText, !employeeLink && { color: '#475569' }]}>Generate Employee QR</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Guest Walk-in */}
        <Animated.View entering={FadeInDown.delay(400)} style={[styles.configCard, { borderColor: '#f59e0b33' }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleBox}>
              <Users color="#f59e0b" size={20} />
              <Text style={styles.cardTitle}>Guest Walk-in</Text>
            </View>
            <Switch
              value={isGuestOpen}
              onValueChange={(val) => handleToggleStatus('walkin-guest', val)}
              trackColor={{ false: '#1e293b', true: '#f59e0b' }}
              thumbColor="white"
            />
          </View>
          <TextInput
            style={styles.input}
            placeholder="Paste Guest Webform URL"
            placeholderTextColor="#475569"
            value={guestLink}
            onChangeText={setGuestLink}
          />
          <TouchableOpacity 
            style={[styles.qrBtn, !guestLink && styles.disabledBtn]}
            disabled={!guestLink}
            onPress={() => {
              const finalUrl = guestLink 
                ? `${guestLink}${guestLink.includes('?') ? '&' : '?'}quota_id=${guestQuotaId || ''}`
                : guestLink;

              navigation.navigate('QRGenerator', { 
                url: finalUrl, 
                title: 'Guest Walk-In Registration',
                subtitle: 'Scan to register as guest',
                isWalkIn: true,
                type: 'walkin-guest'
              });
            }}
          >
            <QrCode color={guestLink ? "#f59e0b" : "#475569"} size={18} />
            <Text style={[styles.qrBtnText, !guestLink && { color: '#475569' }]}>Generate Guest QR</Text>
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity 
          style={styles.saveBtn}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <>
              <Save color="white" size={20} />
              <Text style={styles.saveBtnText}>Save All Changes</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    gap: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    padding: 16,
    borderRadius: 16,
    gap: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  infoText: {
    flex: 1,
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 20,
  },
  configCard: {
    backgroundColor: '#0f172a',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  input: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    color: 'white',
    fontSize: 14,
    marginBottom: 16,
  },
  qrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    gap: 10,
  },
  qrBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  saveBtn: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 20,
    marginTop: 24,
    gap: 12,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  }
});

export default WalkInConfigScreen;
