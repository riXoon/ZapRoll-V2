import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator,
  Dimensions,
  PanResponder
} from 'react-native';
import { FeedbackModal } from '../components/FeedbackModal';
import { 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle, 
  Star, 
  Send,
  Briefcase,
  Edit3
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { supabase } from '../lib/supabase';
import { API_URL } from '../config/api';

const { width } = Dimensions.get('window');

const ParticipantEvaluationScreen = ({ navigation, route }: any) => {
  const { eventId, registrationId, sessionId, sessionType } = route.params || {};
  const insets = useSafeAreaInsets();
  
  const [pages, setPages] = useState<any[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

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

  useEffect(() => {
    fetchTemplate();
  }, [eventId]);

  const fetchTemplate = async () => {
    try {
      setIsLoading(true);
      const queryParam = sessionType ? `?sessionType=${sessionType.includes('AM') ? 'am-eval' : sessionType.includes('PM') ? 'pm-eval' : sessionType}` : '';
      const response = await fetch(`${API_URL}/api/events/${eventId}/evaluation-template${queryParam}`);
      const result = await response.json();
      
      if (result.status === 'success' && result.data) {
        setPages(result.data.questions || []);
      } else {
        showAlert("Error", "Could not load evaluation form.", "error", () => {
          navigation.goBack();
        });
      }
    } catch (error) {
      console.error('Error fetching template:', error);
      showAlert("Network Error", "Please check your connection.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    if (currentPageIndex < pages.length - 1) {
      // Basic validation
      const currentPage = pages[currentPageIndex];
      const missingRequired = currentPage.questions.some((q: any) => 
        q.required && (!responses[q.id] || (Array.isArray(responses[q.id]) && responses[q.id].length === 0))
      );

      if (missingRequired) {
        showAlert("Required Fields", "Please answer all required questions before proceeding.", "error");
        return;
      }
      setCurrentPageIndex(currentPageIndex + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1);
    }
  };

  const updateResponse = (qId: string, value: any) => {
    setResponses(prev => ({ ...prev, [qId]: value }));
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${API_URL}/api/events/${eventId}/evaluation-responses`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': session ? `Bearer ${session.access_token}` : ''
        },
        body: JSON.stringify({
          registration_id: registrationId,
          session_id: sessionId,
          responses: responses,
          session_type: sessionType ? (sessionType.includes('AM') ? 'am-eval' : sessionType.includes('PM') ? 'pm-eval' : sessionType) : 'am-eval'
        })
      });

      const result = await response.json();
      if (result.status === 'success') {
        setIsDone(true);
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      showAlert("Submission Error", error.message || "Failed to submit evaluation.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={{ color: '#64748b', marginTop: 16 }}>Loading evaluation...</Text>
      </View>
    );
  }

  if (isDone) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Animated.View entering={FadeIn} style={styles.successCard}>
          <CheckCircle color="#10b981" size={80} />
          <Text style={styles.successTitle}>Thank You!</Text>
          <Text style={styles.successSubtitle}>
            Your evaluation has been submitted successfully. Your feedback helps us improve future events.
          </Text>
          <TouchableOpacity 
            style={styles.doneBtn}
            onPress={() => navigation.popTo('MainApp', { screen: 'Home' })}
          >
            <Text style={styles.doneBtnText}>Back to Home</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  const activePage = pages[currentPageIndex];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Progress Bar */}
      <View style={styles.progressHeader}>
        <View style={styles.progressBarBg}>
          <Animated.View 
            style={[
              styles.progressBarFill, 
              { width: `${((currentPageIndex + 1) / pages.length) * 100}%` }
            ]} 
          />
        </View>
        <Text style={styles.progressText}>Step {currentPageIndex + 1} of {pages.length}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View 
          key={activePage.id}
          entering={FadeInRight}
          exiting={FadeOutLeft}
        >
          <Text style={styles.pageTitle}>{activePage.title}</Text>
          {activePage.description ? <Text style={styles.pageDesc}>{activePage.description}</Text> : null}

          {activePage.questions.map((q: any) => (
            <View key={q.id} style={styles.questionItem}>
              {q.type !== 'header' && (
                <Text style={styles.questionLabel}>
                  {q.label} {q.required && <Text style={{ color: '#ef4444' }}>*</Text>}
                </Text>
              )}

              {q.type === 'header' && (
                <View style={styles.headerSection}>
                  <Text style={styles.headerText}>{q.label}</Text>
                  <View style={styles.headerLine} />
                </View>
              )}

              {q.type === 'rating' && (
                <View style={styles.ratingRow}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <TouchableOpacity 
                      key={star} 
                      onPress={() => updateResponse(q.id, star)}
                      style={styles.starBtn}
                    >
                      <Star 
                        fill={responses[q.id] >= star ? "#f59e0b" : "transparent"} 
                        color={responses[q.id] >= star ? "#f59e0b" : "#475569"} 
                        size={32} 
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {q.type === 'likert' && (
                <View style={styles.likertContainer}>
                  {q.statements.map((stmt: string, i: number) => (
                    <View key={i} style={styles.likertRow}>
                      <Text style={styles.likertStmt}>{stmt}</Text>
                      <View style={styles.likertOptions}>
                        {(q.options || [1, 2, 3, 4, 5]).map((opt: string, idx: number) => {
                          const val = idx + 1;
                          return (
                            <TouchableOpacity 
                              key={idx}
                              onPress={() => {
                                const current = responses[q.id] || {};
                                updateResponse(q.id, { ...current, [i]: val });
                              }}
                              style={[
                                styles.likertCircle,
                                responses[q.id]?.[i] === val && styles.likertCircleActive
                              ]}
                            >
                              <Text style={[
                                styles.likertValText,
                                responses[q.id]?.[i] === val && styles.likertValTextActive
                              ]}>{val}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                  <View style={styles.likertLegend}>
                    <Text style={styles.legendText}>1: {q.options?.[0] || 'Disagree'}</Text>
                    <Text style={styles.legendText}>{q.options?.length || 5}: {q.options?.[(q.options?.length || 5) - 1] || 'Agree'}</Text>
                  </View>
                </View>
              )}

              {q.type === 'text' && (
                <TextInput
                  style={[
                    styles.textInput, 
                    q.subtype === 'short' || q.subtype === 'email' || q.subtype === 'number' ? { minHeight: 50 } : null
                  ]}
                  placeholder={
                    q.subtype === 'email' ? "example@email.com" : 
                    q.subtype === 'number' ? "Enter ID number" : 
                    "Your answer..."
                  }
                  placeholderTextColor="#475569"
                  value={responses[q.id] || ''}
                  onChangeText={(val) => updateResponse(q.id, val)}
                  multiline={q.subtype === 'long'}
                  keyboardType={
                    q.subtype === 'email' ? 'email-address' : 
                    q.subtype === 'number' ? 'numeric' : 
                    'default'
                  }
                  autoCapitalize={q.subtype === 'email' ? 'none' : 'sentences'}
                />
              )}

              {q.type === 'choice' && (
                <View style={styles.choiceGrid}>
                  {q.options.map((opt: string, i: number) => (
                    <TouchableOpacity 
                      key={i} 
                      onPress={() => updateResponse(q.id, opt)}
                      style={[
                        styles.choiceBtn,
                        responses[q.id] === opt && styles.choiceBtnActive
                      ]}
                    >
                      <Text style={[
                        styles.choiceText,
                        responses[q.id] === opt && styles.choiceTextActive
                      ]}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                  
                  {q.hasOther && (
                    <View style={{ gap: 12 }}>
                      <TouchableOpacity 
                        onPress={() => updateResponse(q.id, 'Other')}
                        style={[
                          styles.choiceBtn,
                          responses[q.id]?.startsWith('Other:') && styles.choiceBtnActive
                        ]}
                      >
                        <Text style={[
                          styles.choiceText,
                          responses[q.id]?.startsWith('Other:') && styles.choiceTextActive
                        ]}>Others</Text>
                      </TouchableOpacity>

                      {responses[q.id]?.startsWith('Other') && (
                        <TextInput
                          style={styles.otherInput}
                          placeholder="Please specify..."
                          placeholderTextColor="#475569"
                          value={responses[q.id] === 'Other' ? '' : responses[q.id].replace('Other:', '')}
                          onChangeText={(val) => updateResponse(q.id, `Other:${val}`)}
                        />
                      )}
                    </View>
                  )}
                </View>
              )}

              {q.type === 'privacy' && (
                <View style={styles.privacyBox}>
                  <Briefcase color="#ef4444" size={24} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.privacyNotice}>{q.label}</Text>
                    <View style={styles.agreementOptions}>
                      {q.options.map((opt: string, i: number) => (
                        <TouchableOpacity 
                          key={i} 
                          onPress={() => updateResponse(q.id, opt)}
                          style={styles.agreementRow}
                        >
                          <View style={[
                            styles.radioCircle,
                            responses[q.id] === opt && styles.radioCircleActive
                          ]}>
                            {responses[q.id] === opt && <View style={styles.radioDot} />}
                          </View>
                          <Text style={styles.agreementText}>{opt}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              )}

              {q.type === 'signature' && (
                <SignatureField 
                  onCapture={(data) => updateResponse(q.id, data)} 
                  savedData={responses[q.id]}
                />
              )}
            </View>
          ))}
        </Animated.View>
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Footer Controls */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity 
          onPress={handleBack} 
          disabled={currentPageIndex === 0}
          style={[styles.controlBtn, currentPageIndex === 0 && styles.controlBtnDisabled]}
        >
          <ArrowLeft color={currentPageIndex === 0 ? "#475569" : "white"} size={24} />
          <Text style={[styles.controlBtnText, currentPageIndex === 0 && styles.controlBtnTextDisabled]}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={handleNext} 
          disabled={isSubmitting}
          style={[styles.nextBtn, currentPageIndex === pages.length - 1 && styles.submitBtn]}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" size={20} />
          ) : (
            <>
              <Text style={styles.nextBtnText}>
                {currentPageIndex === pages.length - 1 ? 'Submit' : 'Next'}
              </Text>
              {currentPageIndex === pages.length - 1 ? (
                <Send color="white" size={18} />
              ) : (
                <ArrowRight color="white" size={20} />
              )}
            </>
          )}
        </TouchableOpacity>
      </View>

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

// Simple Signature Implementation using SVG
const SignatureField = ({ onCapture, savedData }: { onCapture: (data: string) => void, savedData?: any }) => {
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath(`M${locationX},${locationY}`);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath(prev => `${prev} L${locationX},${locationY}`);
      },
      onPanResponderRelease: () => {
        if (currentPath) {
          const newPaths = [...paths, currentPath];
          setPaths(newPaths);
          setCurrentPath('');
          onCapture(JSON.stringify(newPaths));
        }
      },
    })
  ).current;

  const clear = () => {
    setPaths([]);
    onCapture('');
  };

  return (
    <View style={styles.signatureContainer}>
      <View style={styles.signatureCanvas} {...panResponder.panHandlers}>
        <Svg style={StyleSheet.absoluteFill}>
          {paths.map((p, i) => <Path key={i} d={p} stroke="white" strokeWidth={3} fill="none" />)}
          {currentPath ? <Path d={currentPath} stroke="white" strokeWidth={3} fill="none" /> : null}
        </Svg>
        {paths.length === 0 && !currentPath && (
          <View style={styles.signatureHint}>
            <Edit3 color="#1e293b" size={32} />
            <Text style={styles.signatureHintText}>Sign Here</Text>
          </View>
        )}
      </View>
      <TouchableOpacity onPress={clear} style={styles.clearBtn}>
        <Text style={styles.clearBtnText}>Clear</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  progressHeader: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#1e293b',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
  },
  progressText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  pageDesc: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 22,
    marginBottom: 24,
  },
  questionItem: {
    marginBottom: 32,
  },
  questionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginBottom: 16,
  },
  headerSection: {
    marginVertical: 16,
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginBottom: 8,
  },
  headerLine: {
    height: 1,
    backgroundColor: '#1e293b',
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
  },
  starBtn: {
    padding: 4,
  },
  likertContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  likertRow: {
    marginBottom: 20,
  },
  likertStmt: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 12,
  },
  likertOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  likertCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  likertCircleActive: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  likertValText: {
    color: '#64748b',
    fontWeight: 'bold',
  },
  likertValTextActive: {
    color: 'white',
  },
  likertLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  legendText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    color: 'white',
    padding: 16,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  choiceGrid: {
    gap: 12,
  },
  choiceBtn: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  choiceBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: '#10b981',
  },
  choiceText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '500',
  },
  choiceTextActive: {
    color: '#10b981',
    fontWeight: 'bold',
  },
  otherInput: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    color: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
  },
  privacyBox: {
    flexDirection: 'row',
    gap: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.1)',
  },
  privacyNotice: {
    color: '#e2e8f0',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  agreementOptions: {
    gap: 12,
  },
  agreementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: '#ef4444',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
  },
  agreementText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  signatureContainer: {
    marginTop: 8,
  },
  signatureCanvas: {
    height: 180,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    overflow: 'hidden',
  },
  signatureHint: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5,
  },
  signatureHintText: {
    color: '#64748b',
    fontSize: 14,
    marginTop: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  clearBtn: {
    alignSelf: 'flex-end',
    marginTop: 8,
    padding: 8,
  },
  clearBtnText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    backgroundColor: '#020617',
  },
  controlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  controlBtnDisabled: {
    opacity: 0.3,
  },
  controlBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  controlBtnTextDisabled: {
    color: '#64748b',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    minWidth: 120,
    justifyContent: 'center',
  },
  nextBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  submitBtn: {
    backgroundColor: '#10b981',
  },
  successCard: {
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 32,
    padding: 40,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 24,
    marginBottom: 12,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  doneBtn: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
  },
  doneBtnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  }
});

export default ParticipantEvaluationScreen;
