import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ScrollView } from 'react-native';
import { FeedbackModal } from '../components/FeedbackModal';
import { 
  ArrowLeft, 
  ExternalLink, 
  CheckCircle, 
  AlertCircle, 
  Award,
  ClipboardCheck,
  Send
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const EvaluationBridgeScreen = ({ navigation, route }: any) => {
  const insets = useSafeAreaInsets();
  const { eventId, sessionType, formUrl } = route.params || { eventId: null, sessionType: 'AM Session', formUrl: '' };
  
  // Mocking participant state (In real app, this comes from Supabase/API)
  const [attendanceStatus, setAttendanceStatus] = useState({
    am: true,
    pm: true
  });
  
  const [evalStarted, setEvalStarted] = useState(false);
  const [isWhitelisted, setIsWhitelisted] = useState(false);

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

  const handleOpenForm = async () => {
    setEvalStarted(true);
    await Linking.openURL(formUrl);
  };

  const handleConfirmSubmission = () => {
    if (!attendanceStatus.am || !attendanceStatus.pm) {
      showAlert(
        "Incomplete Attendance",
        "You must have scanned both AM and PM session entries to qualify for whitelisting.",
        "error"
      );
      return;
    }

    showAlert(
      "Confirm Submission",
      "By clicking yes, you certify that you have finished the Google Form. The admin will verify this against the form responses.",
      "confirm",
      () => setIsWhitelisted(true)
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft color="white" size={20} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Evaluation Bridge</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View entering={FadeInDown.delay(200)} style={styles.card}>
          <View style={styles.iconContainer}>
            <ClipboardCheck color="#3b82f6" size={40} />
          </View>
          <Text style={styles.title}>{sessionType} Evaluation</Text>
          <Text style={styles.subtitle}>
            Complete the evaluation to unlock your E-Certificate for this session.
          </Text>

          {/* Attendance Checkmarks */}
          <View style={styles.checkSection}>
            <View style={styles.checkItem}>
              <CheckCircle color={attendanceStatus.am ? "#10b981" : "#475569"} size={18} />
              <Text style={[styles.checkText, attendanceStatus.am && styles.checkTextActive]}>
                AM Entry Scanned
              </Text>
            </View>
            <View style={styles.checkItem}>
              <CheckCircle color={attendanceStatus.pm ? "#10b981" : "#475569"} size={18} />
              <Text style={[styles.checkText, attendanceStatus.pm && styles.checkTextActive]}>
                PM Entry Scanned
              </Text>
            </View>
          </View>
        </Animated.View>

        {!isWhitelisted ? (
          <Animated.View entering={FadeInDown.delay(400)}>
            <TouchableOpacity 
              style={styles.formButton}
              onPress={() => navigation.navigate('ParticipantEvaluation', { eventId, sessionType })}
            >
              <ClipboardCheck color="white" size={20} />
              <Text style={styles.formButtonText}>Start Evaluation</Text>
            </TouchableOpacity>

            <View style={styles.noticeBox}>
              <AlertCircle color="#64748b" size={14} />
              <Text style={styles.noticeText}>Complete the form to get whitelisted.</Text>
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInUp} style={styles.successCard}>
            <Award color="#10b981" size={50} />
            <Text style={styles.successTitle}>Evaluation Claimed!</Text>
            <Text style={styles.successSubtitle}>
              You are now whitelisted. The admin will verify your response and send your E-Certificate to your registered email.
            </Text>
            <TouchableOpacity 
              style={styles.doneButton}
              onPress={() => navigation.popTo('MainApp', { screen: 'Home' })}
            >
              <Text style={styles.doneButtonText}>Back to Home</Text>
            </TouchableOpacity>
          </Animated.View>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
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
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 24,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  checkSection: {
    width: '100%',
    backgroundColor: '#020617',
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '600',
  },
  checkTextActive: {
    color: '#10b981',
  },
  formButton: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 20,
    gap: 12,
    marginBottom: 12,
  },
  formButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  confirmButton: {
    backgroundColor: '#1e293b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  confirmButtonTextDisabled: {
    color: '#64748b',
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 6,
  },
  noticeText: {
    color: '#64748b',
    fontSize: 12,
  },
  successCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#10b981',
    marginTop: 20,
    marginBottom: 12,
  },
  successSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  doneButton: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  doneButtonText: {
    color: 'white',
    fontWeight: 'bold',
  }
});

export default EvaluationBridgeScreen;
