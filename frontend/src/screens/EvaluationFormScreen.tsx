import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Platform, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Share,
  PanResponder,
  Animated as RNAnimated
} from 'react-native';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Star, 
  Edit3, 
  Save,
  Activity,
  ChevronRight,
  Info,
  CheckCircle,
  Briefcase,
  ClipboardCheck,
  ChevronUp,
  ChevronDown,
  GripVertical
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { API_URL } from '../config/api';
import { FeedbackModal } from '../components/FeedbackModal';

type QuestionType = 'rating' | 'text' | 'choice' | 'likert' | 'privacy' | 'signature' | 'header';

interface Question {
  id: string;
  type: QuestionType;
  label: string;
  statements: string[];
  options?: string[];
  subtype?: 'short' | 'long' | 'email' | 'number';
  required: boolean;
  likertScaleType?: 'agreement' | 'quality' | 'frequency' | 'satisfaction' | 'custom';
  hasOther?: boolean;
}

interface Page {
  id: string;
  title: string;
  description: string;
  questions: Question[];
}

const LIKERT_SCALES = {
  agreement: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'],
  quality: ['Needs Improvement', 'Fair', 'Good', 'Very Good', 'Excellent'],
  frequency: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'],
  satisfaction: ['Very Dissatisfied', 'Dissatisfied', 'Neutral', 'Satisfied', 'Very Satisfied']
};

const EvaluationFormScreen = ({ navigation, route }: any) => {
  const { eventId, sessionType = 'am-eval' } = route.params || {};
  const insets = useSafeAreaInsets();
  
  const [pages, setPages] = useState<Page[]>([
    { 
      id: 'page_1', 
      title: 'Intro & Privacy', 
      description: 'Welcome participants and get their consent.',
      questions: [
        { id: 'q_1', type: 'header', label: 'Evaluation Form', statements: [], required: false },
        { id: 'q_2', type: 'privacy', label: 'Data Privacy Notice', statements: [], required: true }
      ] 
    }
  ]);
  
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showJsonModal, setShowJsonModal] = useState(false);

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

  const hasFetched = React.useRef(false);

  useEffect(() => {
    if (eventId && !hasFetched.current) {
      hasFetched.current = true;
      fetchTemplate();
    }
  }, [eventId]);

  const copyToClipboard = (text: string) => {
    // Clipboard removed due to RN 0.76+ incompatibility
    showAlert("Developer Info", "Please select the text in the preview and copy it manually.", "info");
  };

  const fetchTemplate = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${API_URL}/api/events/${eventId}/evaluation-template?sessionType=${sessionType}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      
      const result = await response.json();
      if (result.status === 'success' && result.data) {
        // If data is formatted as pages already
        if (Array.isArray(result.data.questions)) {
          // Check if it's the old format or new format
          const firstItem = result.data.questions[0];
          if (firstItem && firstItem.questions) {
            setPages(result.data.questions);
          } else {
            // Migrating old flat format to single page
            setPages([{
              id: 'page_1',
              title: 'Evaluation',
              description: '',
              questions: result.data.questions
            }]);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching template:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addPage = () => {
    const newPage: Page = {
      id: `page_${Date.now()}`,
      title: `Page ${pages.length + 1}`,
      description: '',
      questions: []
    };
    setPages([...pages, newPage]);
    setActivePageIndex(pages.length);
  };

  const removePage = (index: number) => {
    if (pages.length === 1) return;
    showAlert(
      "Delete Page", 
      "Are you sure you want to remove this entire page?", 
      "confirm",
      () => {
        const newPages = pages.filter((_, i) => i !== index);
        setPages(newPages);
        setActivePageIndex(Math.max(0, activePageIndex - 1));
      },
      "Delete"
    );
  };

  const updatePageInfo = (field: 'title' | 'description', text: string) => {
    const newPages = [...pages];
    newPages[activePageIndex][field] = text;
    setPages(newPages);
  };

  const addQuestion = (type: QuestionType) => {
    const newQuestion: Question = {
      id: `q_${Date.now()}`,
      type,
      label: '',
      statements: type === 'likert' ? ['New Statement'] : [],
      options: type === 'choice' || type === 'privacy' ? ['Option 1'] : (type === 'likert' ? LIKERT_SCALES.agreement : undefined),
      subtype: type === 'text' ? 'short' : undefined,
      likertScaleType: type === 'likert' ? 'agreement' : undefined,
      required: type !== 'header'
    };
    
    const newPages = [...pages];
    newPages[activePageIndex].questions.push(newQuestion);
    setPages(newPages);
  };

  const removeQuestion = (qId: string) => {
    showAlert(
      "Remove Field",
      "Are you sure you want to delete this field? This action cannot be undone.",
      "confirm",
      () => {
        const newPages = [...pages];
        newPages[activePageIndex].questions = newPages[activePageIndex].questions.filter(q => q.id !== qId);
        setPages(newPages);
      },
      "Delete"
    );
  };

  const updateQuestion = (qId: string, updates: Partial<Question>) => {
    const newPages = [...pages];
    newPages[activePageIndex].questions = newPages[activePageIndex].questions.map(q => 
      q.id === qId ? { ...q, ...updates } : q
    );
    setPages(newPages);
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    const newPages = [...pages];
    const questions = [...newPages[activePageIndex].questions];
    
    if (direction === 'up' && index > 0) {
      [questions[index], questions[index - 1]] = [questions[index - 1], questions[index]];
    } else if (direction === 'down' && index < questions.length - 1) {
      [questions[index], questions[index + 1]] = [questions[index + 1], questions[index]];
    }
    
    newPages[activePageIndex].questions = questions;
    setPages(newPages);
  };

  const createPanResponder = (index: number) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        const threshold = 40;
        if (gestureState.dy > threshold) {
          moveQuestion(index, 'down');
          gestureState.dy = 0; // Reset dy to avoid multiple moves
        } else if (gestureState.dy < -threshold) {
          moveQuestion(index, 'up');
          gestureState.dy = 0;
        }
      },
      onPanResponderRelease: () => {},
    });
  };

  const handleSave = async () => {
    if (!eventId) {
      showAlert("Error", "No event ID found.", "error");
      return;
    }

    try {
      setIsSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${API_URL}/api/events/${eventId}/evaluation-template`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}` 
        },
        body: JSON.stringify({
          title: pages[0].title || 'Evaluation Form',
          questions: pages, // Storing full pages array in questions column
          is_active: true,
          session_type: sessionType
        })
      });
      
      const result = await response.json();
      if (result.status === 'success') {
        showAlert("Success", "Evaluation form template saved successfully.", "success", () => {
          navigation.goBack();
        });
      } else {
        throw new Error(result.message);
      }
    } catch (err: any) {
      showAlert("Error", err.message || "Failed to save template", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyJson = async () => {
    try {
      const jsonString = JSON.stringify({ eventId, questions: pages }, null, 2);
      await Share.share({
        message: jsonString,
        title: 'ZapRoll Evaluation Schema'
      });
    } catch (error) {
      showAlert("Error", "Could not share JSON structure.", "error");
    }
  };

  if (isLoading || !Array.isArray(pages) || !pages[activePageIndex]) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={{ color: '#64748b', marginTop: 12 }}>Loading Builder...</Text>
      </View>
    );
  }

  const activePage = pages[activePageIndex];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ArrowLeft color="white" size={20} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Form Builder</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity 
            onPress={() => setShowJsonModal(true)} 
            style={[styles.saveBtn, { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' }]}
          >
            <ClipboardCheck color="#3b82f6" size={18} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSave} disabled={isSaving} style={styles.saveBtn}>
            {isSaving ? (
              <ActivityIndicator color="white" size={18} />
            ) : (
              <>
                <Save color="white" size={18} />
                <Text style={styles.saveBtnText}>Save</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* JSON Structure Modal */}
      <Modal
        visible={showJsonModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowJsonModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Developer Reference</Text>
              <TouchableOpacity onPress={() => setShowJsonModal(false)}>
                <Trash2 color="#94a3b8" size={20} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Share this JSON structure with your web developer. It defines the pages and fields for your website's form renderer.
            </Text>
            <ScrollView style={styles.jsonPreview}>
              <Text style={styles.jsonText} selectable={true}>
                {JSON.stringify(pages, null, 2)}
              </Text>
            </ScrollView>
            <TouchableOpacity 
              style={styles.copyBtn} 
              onPress={handleCopyJson}
            >
              <Text style={styles.copyBtnText}>Copy / Share JSON Structure</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Page Tabs */}
      <View style={styles.pageTabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pageTabs}>
          {pages.map((page, index) => (
            <TouchableOpacity 
              key={page.id} 
              onPress={() => setActivePageIndex(index)}
              style={[styles.pageTab, activePageIndex === index && styles.activePageTab]}
            >
              <Text style={[styles.pageTabText, activePageIndex === index && styles.activePageTabText]}>
                Step {index + 1}
              </Text>
              {pages.length > 1 && activePageIndex === index && (
                <TouchableOpacity onPress={() => removePage(index)} style={styles.closePageBtn}>
                  <Trash2 color="#94a3b8" size={12} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={addPage} style={styles.addPageTab}>
            <Plus color="#3b82f6" size={18} />
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Page Info Editor */}
        <View style={styles.pageInfoCard}>
          <TextInput
            style={styles.pageTitleInput}
            value={activePage.title}
            onChangeText={(text) => updatePageInfo('title', text)}
            placeholder="Page Title"
            placeholderTextColor="#475569"
          />
          <TextInput
            style={styles.pageDescInput}
            value={activePage.description}
            onChangeText={(text) => updatePageInfo('description', text)}
            placeholder="Page Description (Optional)"
            placeholderTextColor="#475569"
            multiline
          />
        </View>

        {activePage.questions.map((item, index) => (
          <View 
            key={item.id} 
            style={styles.questionCard}
          >
            <View style={styles.cardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View {...createPanResponder(index).panHandlers} style={{ padding: 4 }}>
                  <GripVertical color="#94a3b8" size={20} />
                </View>
                <View style={styles.typeBadge}>
                  {item.type === 'rating' && <Star color="#f59e0b" size={14} />}
                  {item.type === 'text' && <Edit3 color="#3b82f6" size={14} />}
                  {item.type === 'choice' && <Activity color="#10b981" size={14} />}
                  {item.type === 'likert' && <Activity color="#8b5cf6" size={14} />}
                  {item.type === 'privacy' && <Briefcase color="#ef4444" size={14} />}
                  {item.type === 'signature' && <Edit3 color="#06b6d4" size={14} />}
                  {item.type === 'header' && <Edit3 color="#94a3b8" size={14} />}
                  <Text style={styles.typeText}>{item.type.toUpperCase()}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  <TouchableOpacity 
                    onPress={() => moveQuestion(index, 'up')}
                    disabled={index === 0}
                    style={{ opacity: index === 0 ? 0.3 : 1 }}
                  >
                    <ChevronUp color="#94a3b8" size={18} />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => moveQuestion(index, 'down')}
                    disabled={index === activePage.questions.length - 1}
                    style={{ opacity: index === activePage.questions.length - 1 ? 0.3 : 1 }}
                  >
                    <ChevronDown color="#94a3b8" size={18} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => removeQuestion(item.id)}>
                  <Trash2 color="#ef4444" size={18} />
                </TouchableOpacity>
              </View>
            </View>

            <TextInput
              style={styles.questionInput}
              placeholder={
                item.type === 'header' ? "Heading Text" : 
                item.type === 'privacy' ? "Privacy Policy Notice" :
                item.type === 'likert' ? "Instructions (e.g. Rate your agreement)" : 
                "Enter your question here..."
              }
              placeholderTextColor="#475569"
              value={item.label}
              onChangeText={(text) => updateQuestion(item.id, { label: text })}
              multiline
            />

            {item.type === 'rating' && (
              <View style={styles.ratingPreview}>
                <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} color="#f59e0b" size={20} fill="#f59e0b" style={{ marginRight: 6 }} />
                  ))}
                </View>
                <Text style={styles.ratingHint}>Participants will see a 1 to 5 star scale</Text>
              </View>
            )}

            {item.type === 'likert' && (
              <View style={styles.likertGrid}>
                <View style={styles.likertHeader}>
                  <Text style={styles.optionsLabel}>Scale Type:</Text>
                  <View style={styles.scaleRow}>
                    {(['agreement', 'quality', 'frequency', 'satisfaction'] as const).map((st) => (
                      <TouchableOpacity 
                        key={st}
                        onPress={() => updateQuestion(item.id, { 
                          likertScaleType: st,
                          options: LIKERT_SCALES[st]
                        })}
                        style={[
                          styles.scaleBtn, 
                          item.likertScaleType === st && styles.scaleBtnActive
                        ]}
                      >
                        <Text style={[
                          styles.scaleBtnText,
                          item.likertScaleType === st && styles.scaleBtnTextActive
                        ]}>
                          {st.charAt(0).toUpperCase() + st.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.scalePreview}>
                  <Text style={styles.previewLabel}>Scale Preview:</Text>
                  <View style={styles.previewRow}>
                    {(item.options || []).map((opt, idx) => (
                      <View key={idx} style={styles.previewBadge}>
                        <Text style={styles.previewText}>{opt}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <Text style={styles.optionsLabel}>Statements / Rows:</Text>
                {(item.statements || []).map((stmt, sIndex) => (
                  <View key={sIndex} style={styles.likertRow}>
                    <TextInput
                      style={styles.rowInput}
                      value={stmt}
                      placeholder="Enter statement..."
                      placeholderTextColor="#475569"
                      onChangeText={(text) => {
                        const newStats = [...(item.statements || [])];
                        newStats[sIndex] = text;
                        updateQuestion(item.id, { statements: newStats });
                      }}
                    />
                    <TouchableOpacity onPress={() => {
                      const newStats = (item.statements || []).filter((_, i) => i !== sIndex);
                      updateQuestion(item.id, { statements: newStats });
                    }}>
                      <Trash2 color="#ef4444" size={16} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity 
                  onPress={() => updateQuestion(item.id, { statements: [...item.statements, ''] })} 
                  style={styles.addRowBtn}
                >
                  <Plus color="#8b5cf6" size={14} />
                  <Text style={styles.addRowText}>Add Statement</Text>
                </TouchableOpacity>
              </View>
            )}

            {item.type === 'text' && (
              <View style={styles.subtypeContainer}>
                <Text style={styles.optionsLabel}>Input Type:</Text>
                <View style={styles.subtypeRow}>
                  {['short', 'long', 'email', 'number'].map((st) => (
                    <TouchableOpacity 
                      key={st}
                      onPress={() => updateQuestion(item.id, { subtype: st as any })}
                      style={[
                        styles.subtypeBtn, 
                        item.subtype === st && styles.subtypeBtnActive
                      ]}
                    >
                      <Text style={[
                        styles.subtypeBtnText,
                        item.subtype === st && styles.subtypeBtnTextActive
                      ]}>
                        {st.charAt(0).toUpperCase() + st.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {(item.type === 'choice' || item.type === 'privacy') && (
              <View style={styles.optionsContainer}>
                <Text style={styles.optionsLabel}>Options:</Text>
                {(item.options || []).map((opt, i) => (
                  <View key={i} style={styles.optionRow}>
                    <TextInput
                      style={styles.optionInput}
                      value={opt}
                      onChangeText={(text) => {
                        const newOpts = [...(item.options || [])];
                        newOpts[i] = text;
                        updateQuestion(item.id, { options: newOpts });
                      }}
                    />
                    <TouchableOpacity onPress={() => {
                      const newOpts = (item.options || []).filter((_, idx) => idx !== i);
                      updateQuestion(item.id, { options: newOpts });
                    }}>
                      <Trash2 color="#ef4444" size={16} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity 
                  onPress={() => updateQuestion(item.id, { options: [...(item.options || []), 'Option ' + ((item.options || []).length + 1)] })} 
                  style={styles.addOptionBtn}
                >
                  <Plus color="#10b981" size={14} />
                  <Text style={styles.addOptionText}>Add Option</Text>
                </TouchableOpacity>

                <View style={styles.otherOptionToggle}>
                  <Text style={styles.otherOptionLabel}>Include "Others" Option</Text>
                  <TouchableOpacity 
                    onPress={() => updateQuestion(item.id, { hasOther: !item.hasOther })}
                    style={[styles.toggleBtn, item.hasOther && styles.toggleBtnActive]}
                  >
                    <View style={[styles.toggleDot, item.hasOther && styles.toggleDotActive]} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {item.type === 'signature' && (
              <View style={styles.signaturePlaceholder}>
                <Edit3 color="#1e293b" size={40} />
                <Text style={styles.signatureText}>Signature Pad will be rendered here</Text>
              </View>
            )}
          </View>
        ))}

        <View style={{ height: 180 }} />
      </ScrollView>

      {/* Add Actions Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
        <Text style={styles.footerLabel}>ADD FIELD TO STEP {activePageIndex + 1}:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionRow}>
          <TouchableOpacity onPress={() => addQuestion('header')} style={styles.actionBtn}>
            <Edit3 color="#94a3b8" size={20} />
            <Text style={styles.actionBtnText}>Header</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => addQuestion('privacy')} style={styles.actionBtn}>
            <Briefcase color="#ef4444" size={20} />
            <Text style={styles.actionBtnText}>Privacy</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => addQuestion('rating')} style={styles.actionBtn}>
            <Star color="#f59e0b" size={20} />
            <Text style={styles.actionBtnText}>Rating</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => addQuestion('likert')} style={styles.actionBtn}>
            <Activity color="#8b5cf6" size={20} />
            <Text style={styles.actionBtnText}>Likert</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => addQuestion('text')} style={styles.actionBtn}>
            <Edit3 color="#3b82f6" size={20} />
            <Text style={styles.actionBtnText}>Text</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => addQuestion('choice')} style={styles.actionBtn}>
            <Activity color="#10b981" size={20} />
            <Text style={styles.actionBtnText}>Choice</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => addQuestion('signature')} style={styles.actionBtn}>
            <Edit3 color="#06b6d4" size={20} />
            <Text style={styles.actionBtnText}>Signature</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
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
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 8,
  },
  saveBtnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  pageTabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  pageTabs: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 12,
  },
  pageTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    gap: 8,
  },
  activePageTab: {
    backgroundColor: '#1e293b',
    borderColor: '#3b82f6',
  },
  pageTabText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  activePageTabText: {
    color: 'white',
  },
  closePageBtn: {
    marginLeft: 4,
  },
  addPageTab: {
    width: 40,
    height: 36,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  pageInfoCard: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  pageTitleInput: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  pageDescInput: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
  },
  questionCard: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#020617',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  typeText: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  questionInput: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    paddingVertical: 8,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  likertGrid: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  likertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#020617',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  rowInput: {
    flex: 1,
    color: '#94a3b8',
    fontSize: 14,
    paddingVertical: 10,
  },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  addRowText: {
    color: '#8b5cf6',
    fontSize: 12,
    fontWeight: 'bold',
  },
  likertHeader: {
    marginBottom: 16,
  },
  scaleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  scaleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  scaleBtnActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderColor: '#8b5cf6',
  },
  scaleBtnText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  scaleBtnTextActive: {
    color: '#8b5cf6',
  },
  scalePreview: {
    backgroundColor: '#020617',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  previewLabel: {
    color: '#475569',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  previewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  previewBadge: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  previewText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '500',
  },
  otherOptionToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  otherOptionLabel: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '500',
  },
  toggleBtn: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    padding: 2,
  },
  toggleBtnActive: {
    backgroundColor: '#10b981',
  },
  toggleDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'white',
  },
  toggleDotActive: {
    transform: [{ translateX: 20 }],
  },
  optionsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  optionsLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#020617',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  optionInput: {
    flex: 1,
    color: '#94a3b8',
    fontSize: 14,
    paddingVertical: 10,
  },
  addOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  addOptionText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: 'bold',
  },
  signaturePlaceholder: {
    height: 120,
    backgroundColor: 'rgba(6, 182, 212, 0.05)',
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
  },
  signatureText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500',
  },
  footer: {
    backgroundColor: '#0f172a',
    paddingTop: 16,
    borderTopWidth: 1,
    borderColor: '#1e293b',
  },
  footerLabel: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    marginBottom: 12,
    textAlign: 'center',
  },
  actionRow: {
    paddingHorizontal: 24,
    gap: 10,
    paddingBottom: 8,
  },
  actionBtn: {
    width: 85,
    backgroundColor: '#020617',
    borderRadius: 16,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  actionBtnText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    height: '80%',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalSubtitle: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  jsonPreview: {
    flex: 1,
    backgroundColor: '#020617',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 20,
  },
  jsonText: {
    color: '#10b981',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
  },
  copyBtn: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  copyBtnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  subtypeContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  subtypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  subtypeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  subtypeBtnActive: {
    backgroundColor: '#1e293b',
    borderColor: '#3b82f6',
  },
  subtypeBtnText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: 'bold',
  },
  subtypeBtnTextActive: {
    color: 'white',
  },
  ratingPreview: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#020617',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  ratingHint: {
    color: '#64748b',
    fontSize: 11,
    fontStyle: 'italic',
  }
});

export default EvaluationFormScreen;
