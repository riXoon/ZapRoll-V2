import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  TextInput,
  Dimensions,
  Platform,
  useWindowDimensions,
  FlatList,
  RefreshControl
} from 'react-native';
import { reportCache } from '../lib/reportCache';
import { 
  ArrowLeft, 
  Search, 
  Filter, 
  BarChart3, 
  Users, 
  ChevronRight, 
  Star, 
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeInRight, Layout, withRepeat, withTiming, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { API_URL } from '../config/api';
import { FeedbackModal } from '../components/FeedbackModal';

const { width } = Dimensions.get('window');

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

const CACHE_KEY = '@evaluation_analytics_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const ResponseRow = React.memo(({ item, activeSession, template, navigation, styles }: any) => {
  return (
    <TouchableOpacity 
      style={styles.responseItem}
      onPress={() => {
        navigation.navigate('EvaluationDetail', {
          response: item,
          template: template,
          sessionType: activeSession
        });
      }}
    >
      <View style={styles.respInfo}>
        <Text style={styles.respName}>{item.full_name || 'Anonymous'}</Text>
        <Text style={styles.respMeta}>{item.email || 'No Email'} • {new Date(activeSession === 'am-eval' ? item.am_eval_submitted_at : item.pm_eval_submitted_at).toLocaleDateString()}</Text>
      </View>
      <ChevronRight color="#334155" size={20} />
    </TouchableOpacity>
  );
});

const SummaryView = React.memo(({ analytics, activeSession, isSmallScreen, navigation, styles, eventId }: any) => {
  if (!analytics) return (
    <View style={styles.emptyState}>
      <AlertCircle color="#475569" size={48} />
      <Text style={styles.emptyText}>No responses found for this session.</Text>
    </View>
  );

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Top Stats */}
      <View style={[styles.metricsRow, isSmallScreen && { flexDirection: 'column' }]}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Total Responses</Text>
          <Text style={[styles.metricValue, isSmallScreen && { fontSize: 28 }]}>{analytics.totalResponses}</Text>
          <View style={styles.metricBadge}>
            <BarChart3 color="#3b82f6" size={12} />
            <Text style={styles.metricBadgeText}>Responses</Text>
          </View>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Average Rating</Text>
          <Text style={[styles.metricValue, isSmallScreen && { fontSize: 28 }]}>{analytics.overallAvg}</Text>
          <View style={[styles.metricBadge, { backgroundColor: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.1)' }]}>
            <Star color="#f59e0b" size={12} fill="#f59e0b" />
            <Text style={[styles.metricBadgeText, { color: '#f59e0b' }]}>Stars</Text>
          </View>
        </View>
      </View>

      {/* Charts Section */}
      {analytics.stats.map((item: any, idx: number) => {
        if (item.type === 'rating') {
          return (
            <Animated.View key={item.id} entering={FadeInDown.delay(100 * idx)} style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleWrapper}>
                  <View style={styles.sectionIconBox}>
                    <Star color="#f59e0b" size={16} fill="#f59e0b" />
                  </View>
                  <Text style={styles.sectionTitle}>{item.label}</Text>
                </View>
              </View>
              <View style={styles.ratingBox}>
                <View style={[styles.ratingMain, isSmallScreen && { flexDirection: 'column', alignItems: 'flex-start', gap: 10 }]}>
                  <Text style={[styles.ratingLarge, isSmallScreen && { fontSize: 44 }]}>{item.avg}</Text>
                  <View style={styles.starsColumn}>
                    <View style={styles.starsRow}>
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star 
                          key={s} 
                          size={isSmallScreen ? 16 : 18} 
                          color={s <= Math.round(parseFloat(item.avg)) ? "#f59e0b" : "#1e293b"} 
                          fill={s <= Math.round(parseFloat(item.avg)) ? "#f59e0b" : "transparent"}
                        />
                      ))}
                    </View>
                    <Text style={styles.ratingTotal}>Overall Average</Text>
                  </View>
                </View>
                
                {/* Star Breakdown */}
                <View style={styles.breakdownContainer}>
                  {[5, 4, 3, 2, 1].map(s => {
                    const count = item.breakdown[s - 1];
                    const percentage = item.total > 0 ? (count / item.total) * 100 : 0;
                    return (
                      <View key={s} style={styles.breakdownRow}>
                        <Text style={styles.breakdownStar}>{s} ★</Text>
                        <View style={styles.breakdownBarBg}>
                          <View style={[styles.breakdownBarFill, { width: `${percentage}%` }]} />
                        </View>
                        <Text style={styles.breakdownCount}>{count}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </Animated.View>
          );
        }

        if (item.type === 'likert') {
          return (
            <Animated.View key={item.id} entering={FadeInDown.delay(100 * idx)} style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleWrapper}>
                  <View style={styles.sectionIconBox}>
                    <BarChart3 color="#8b5cf6" size={16} />
                  </View>
                  <Text style={styles.sectionTitle}>{item.label}</Text>
                </View>
                <View style={styles.scaleTypeBadge}>
                  <Text style={styles.scaleTypeText}>{item.scaleType}</Text>
                </View>
              </View>
              <View style={styles.likertLegend}>
                {item.options.map((opt: string, oIdx: number) => (
                  <View key={oIdx} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981'][oIdx] }]} />
                    <Text style={styles.legendText}>{opt}</Text>
                  </View>
                ))}
              </View>
              
              {item.data.map((stmt: any, sIdx: number) => {
                const total = stmt.counts.reduce((a: number, b: number) => a + b, 0) || 1;
                const weightedSum = stmt.counts.reduce((acc: number, val: number, idx: number) => acc + (val * (idx + 1)), 0);
                const mean = (weightedSum / total).toFixed(1);

                return (
                  <View key={sIdx} style={styles.likertRow}>
                    <View style={[styles.likertRowHeader, isSmallScreen && { flexDirection: 'column', gap: 6 }]}>
                      <Text style={styles.likertLabel}>{stmt.label}</Text>
                      <View style={styles.meanBadge}>
                        <Text style={styles.meanText}>{mean} avg</Text>
                      </View>
                    </View>
                    <View style={styles.likertBarContainer}>
                      {stmt.counts.map((count: number, cIdx: number) => {
                        const percentage = (count / total) * 100;
                        const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981'];
                        if (percentage === 0) return <View key={cIdx} />;
                        return (
                          <View 
                            key={cIdx} 
                            style={[
                              styles.likertSegment, 
                              { width: `${percentage}%`, backgroundColor: colors[cIdx] }
                            ]} 
                          >
                            {percentage > 15 && <Text style={styles.segmentText}>{count}</Text>}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </Animated.View>
          );
        }

        if (item.type === 'text') {
          return (
            <Animated.View key={item.id} entering={FadeInDown.delay(100 * idx)} style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleWrapper}>
                  <View style={styles.sectionIconBox}>
                    <MessageSquare color="#3b82f6" size={16} />
                  </View>
                  <Text style={styles.sectionTitle}>{item.label}</Text>
                </View>
              </View>
              <View style={styles.sampleGrid}>
                {item.samples.map((s: any, sIdx: number) => (
                  <View key={sIdx} style={styles.sampleCard}>
                    <Text style={styles.sampleText}>"{s.text}"</Text>
                  </View>
                ))}
                {item.samples.length === 0 && (
                  <Text style={styles.noFeedback}>No comments shared yet.</Text>
                )}
              </View>
              {item.samples.length > 0 && (
                <TouchableOpacity 
                  style={styles.viewAllCommentsBtn}
                  onPress={() => {
                    navigation.navigate('EvaluationComments', {
                      eventId,
                      questionId: item.id,
                      questionLabel: item.label,
                      activeSession: activeSession,
                    });
                  }}
                >
                  <Text style={styles.viewAllCommentsText}>View All Comments</Text>
                  <ChevronRight color="#3b82f6" size={16} />
                </TouchableOpacity>
              )}
            </Animated.View>
          );
        }

        return null;
      })}
    </ScrollView>
  );
});

const ResponsesView = React.memo(({ 
  responseList, 
  searchQuery,
  setSearchQuery, 
  renderItem, 
  refreshing, 
  onRefresh, 
  styles 
}: any) => {
  const [localQuery, setLocalQuery] = useState(searchQuery);

  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(localQuery);
    }, 180); // 180ms debounce

    return () => clearTimeout(handler);
  }, [localQuery, setSearchQuery]);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.searchBar}>
        <Search color="#64748b" size={20} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search participants..."
          placeholderTextColor="#475569"
          value={localQuery}
          onChangeText={setLocalQuery}
        />
      </View>

      <FlatList
        data={responseList}
        keyExtractor={item => item.response_id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={11}
        removeClippedSubviews={true}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
        ListEmptyComponent={
          <View style={styles.emptySearch}>
            <Users color="#1e293b" size={40} />
            <Text style={styles.emptySearchText}>No results found.</Text>
          </View>
        }
      />
    </View>
  );
});

interface Template {
  id: string;
  questions: any[];
  session_type: string;
}

const EvaluationAnalyticsScreen = ({ navigation, route }: any) => {
  const requestedEventId = route.params?.eventId;
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const isSmallScreen = screenWidth < 380;
  
  const [activeSession, setActiveSession] = useState<'am-eval' | 'pm-eval'>('am-eval');
  const [activeTab, setActiveTab] = useState<'Summary' | 'Responses'>('Summary');
  const [summaryMounted, setSummaryMounted] = useState(true);
  const [responsesMounted, setResponsesMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [templates, setTemplates] = useState<Record<string, Template>>({});
  const [responses, setResponses] = useState<any[]>([]);
  const [filteredResponses, setFilteredResponses] = useState<any[]>([]);
  const [event, setEvent] = useState<any>(null);
  const [selectedResp, setSelectedResp] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Feedback Modal State
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackConfig, setFeedbackConfig] = useState<any>({
    title: '',
    message: '',
    type: 'info'
  });

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' | 'confirm' = 'info') => {
    setFeedbackConfig({ title, message, type });
    setFeedbackVisible(true);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === 'Summary') setSummaryMounted(true);
    if (activeTab === 'Responses') setResponsesMounted(true);
  }, [activeTab]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredResponses(responses);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredResponses(responses.filter(r => 
        r.full_name?.toLowerCase().includes(q) || 
        r.email?.toLowerCase().includes(q)
      ));
    }
  }, [searchQuery, responses]);

  const fetchData = async (forceRefresh = false) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const cacheKey = `${CACHE_KEY}:${session.user.id}:${requestedEventId || 'legacy'}`;
      if (!forceRefresh) {
        const cachedStr = reportCache.getItem(cacheKey);
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          if (Date.now() - cached.timestamp < CACHE_TTL) {
            setEvent(cached.event);
            setTemplates(cached.templates);
            setResponses(cached.responses);
            setFilteredResponses(cached.responses);
            setIsLoading(false);
            setRefreshing(false);
            return;
          }
        }
      }

      if (!refreshing) setIsLoading(true);
      // 1. Fetch Event
      const eventRes = await fetch(`${API_URL}/api/events`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const eventData = await eventRes.json();
      if (eventData.status !== 'success' || eventData.data.length === 0) return;
      const activeEvent = requestedEventId ? eventData.data.find((item: any) => item.id === requestedEventId) : eventData.data[0];
      if (!activeEvent) return;
      setEvent(activeEvent);

      // 2. Fetch Templates
      const { data: templateData, error: tError } = await supabase
        .from('evaluation_templates')
        .select('*')
        .eq('event_id', activeEvent.id);
      
      if (tError) throw tError;
      
      const tMap: Record<string, Template> = {};
      templateData?.forEach(t => {
        tMap[t.session_type] = t;
      });
      setTemplates(tMap);

      // 3. Fetch Responses from View
      const { data: respData, error: rError } = await supabase
        .from('v_evaluation_analytics')
        .select('*')
        .eq('event_id', activeEvent.id);
      
      if (rError) throw rError;
      setResponses(respData || []);
      setFilteredResponses(respData || []);

      reportCache.setItem(cacheKey, JSON.stringify({
        timestamp: Date.now(),
        event: activeEvent,
        templates: tMap,
        responses: respData || []
      }));

    } catch (error: any) {
      console.error('Fetch Error:', error);
      showAlert("Error", error.message || "Failed to load analytics.", "error");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(true);
  };

  const getActiveTemplate = React.useCallback(() => templates[activeSession], [templates, activeSession]);
  
  const currentResponses = React.useMemo(() => {
    const list: any[] = [];
    const isAm = activeSession === 'am-eval';
    for (let i = 0; i < responses.length; i++) {
      const r = responses[i];
      const submittedAt = isAm ? r.am_eval_submitted_at : r.pm_eval_submitted_at;
      if (submittedAt) {
        list.push({
          ...r,
          current_response: isAm ? r.am_eval_responses : r.pm_eval_responses,
          submitted_at: submittedAt
        });
      }
    }
    return list;
  }, [responses, activeSession]);

  // Aggregation Logic
  const analytics = React.useMemo(() => {
    const template = getActiveTemplate();
    if (!template || currentResponses.length === 0) return null;

    const stats: any[] = [];
    let totalRating = 0;
    let ratingCount = 0;

    // Questions are usually in a nested "pages" structure based on the builder
    const allQuestions: any[] = [];
    if (Array.isArray(template.questions)) {
      template.questions.forEach((p: any) => {
        if (p.questions) allQuestions.push(...p.questions);
        else allQuestions.push(p);
      });
    }

    allQuestions.forEach(q => {
      // Filter out personal information questions from summary
      const label = q.label?.toLowerCase() || '';
      const isPII = label.includes('name') || 
                   label.includes('email') || 
                   label.includes('initial') || 
                   label.includes('first') || 
                   label.includes('last');
      
      if (isPII) return;

      if (q.type === 'rating') {
        let sum = 0;
        let count = 0;
        const starBreakdown = [0, 0, 0, 0, 0];
        currentResponses.forEach(r => {
          const val = r.current_response?.[q.id];
          if (val) {
            const numericVal = parseInt(val);
            sum += numericVal;
            count++;
            totalRating += numericVal;
            ratingCount++;
            if (numericVal >= 1 && numericVal <= 5) starBreakdown[numericVal - 1]++;
          }
        });
        stats.push({
          type: 'rating',
          id: q.id,
          label: q.label,
          avg: count > 0 ? (sum / count).toFixed(1) : 'N/A',
          total: count,
          breakdown: starBreakdown
        });
      } else if (q.type === 'likert') {
        const statements = q.statements.map((stmt: string, sIdx: number) => {
          const counts = [0, 0, 0, 0, 0];
          currentResponses.forEach(r => {
            // Check both formats: {qId: {0: val}} and {qId_s0: val}
            const val = r.current_response?.[q.id]?.[sIdx] || r.current_response?.[`${q.id}_s${sIdx}`];
            if (val) {
              const numericVal = parseInt(val);
              if (numericVal >= 1 && numericVal <= 5) counts[numericVal - 1]++;
            }
          });
          return { label: stmt, counts };
        });
        stats.push({
          type: 'likert',
          id: q.id,
          label: q.label,
          data: statements,
          options: q.options || ['1', '2', '3', '4', '5'],
          scaleType: q.scaleType || 'Standard'
        });
      } else if (q.type === 'text') {
        const samples = currentResponses
          .filter(r => r.current_response?.[q.id])
          .map(r => ({
            text: r.current_response[q.id]
          }))
          .slice(-3); // Get latest 3
        stats.push({
          type: 'text',
          id: q.id,
          label: q.label,
          samples
        });
      }
    });

    return {
      stats,
      overallAvg: ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : '0.0',
      totalResponses: currentResponses.length
    };
  }, [getActiveTemplate, currentResponses]);

  // renderSummary removed

  const currentTemplate = getActiveTemplate();
  const renderItem = React.useCallback(({ item }: any) => (
    <ResponseRow 
      item={item}
      activeSession={activeSession}
      template={currentTemplate}
      navigation={navigation}
      styles={styles}
    />
  ), [activeSession, currentTemplate, navigation, styles]);

  const responseList = React.useMemo(() => {
    return filteredResponses.filter(r => 
      activeSession === 'am-eval' ? r.am_eval_submitted_at : r.pm_eval_submitted_at
    );
  }, [filteredResponses, activeSession]);

  // renderResponses removed

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft color="white" size={24} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Evaluation Insights</Text>
          <Text style={styles.headerSub}>{event?.name || 'Loading event...'}</Text>
        </View>
      </View>

      {/* Session Toggle */}
      <View style={styles.sessionBar}>
        <TouchableOpacity 
          onPress={() => setActiveSession('am-eval')}
          style={[styles.sessionTab, activeSession === 'am-eval' && styles.activeSessionTab]}
        >
          <Text style={[styles.sessionTabText, activeSession === 'am-eval' && styles.activeSessionTabText]}>AM Session</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setActiveSession('pm-eval')}
          style={[styles.sessionTab, activeSession === 'pm-eval' && styles.activeSessionTab]}
        >
          <Text style={[styles.sessionTabText, activeSession === 'pm-eval' && styles.activeSessionTabText]}>PM Session</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          onPress={() => setActiveTab('Summary')}
          style={[styles.tab, activeTab === 'Summary' && styles.activeTab]}
        >
          <BarChart3 color={activeTab === 'Summary' ? '#3b82f6' : '#64748b'} size={18} />
          <Text style={[styles.tabText, activeTab === 'Summary' && styles.activeTabText]}>Summary</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setActiveTab('Responses')}
          style={[styles.tab, activeTab === 'Responses' && styles.activeTab]}
        >
          <MessageSquare color={activeTab === 'Responses' ? '#3b82f6' : '#64748b'} size={18} />
          <Text style={[styles.tabText, activeTab === 'Responses' && styles.activeTabText]}>Responses</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {isLoading && !refreshing ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            <Animated.View entering={FadeInDown.delay(100)}>
              <SkeletonItem width="100%" height={120} borderRadius={24} style={{ marginBottom: 20, marginTop: 16 }} />
              <SkeletonItem width="100%" height={200} borderRadius={24} style={{ marginBottom: 20 }} />
              <SkeletonItem width="100%" height={200} borderRadius={24} style={{ marginBottom: 20 }} />
              <SkeletonItem width="100%" height={200} borderRadius={24} style={{ marginBottom: 20 }} />
            </Animated.View>
          </ScrollView>
        ) : (
          <>
            {summaryMounted && (
              <View style={[styles.tabContentContainer, activeTab !== 'Summary' && styles.hiddenContent]}>
                <SummaryView 
                  eventId={event?.id}
                  analytics={analytics} 
                  activeSession={activeSession}
                  isSmallScreen={isSmallScreen} 
                  navigation={navigation}
                  styles={styles} 
                />
              </View>
            )}
            {responsesMounted && (
              <View style={[styles.tabContentContainer, activeTab !== 'Responses' && styles.hiddenContent]}>
                <ResponsesView 
                  responseList={responseList}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  renderItem={renderItem}
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  styles={styles}
                />
              </View>
            )}
          </>
        )}
      </View>


      <FeedbackModal
        visible={feedbackVisible}
        title={feedbackConfig.title}
        message={feedbackConfig.message}
        type={feedbackConfig.type}
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
    paddingVertical: 16,
    gap: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#0f172a',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSub: {
    fontSize: 12,
    color: '#64748b',
  },
  sessionBar: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 16,
    gap: 12,
  },
  sessionTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  activeSessionTab: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderColor: '#3b82f6',
  },
  sessionTabText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  activeSessionTabText: {
    color: '#3b82f6',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 24,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  activeTab: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  tabText: {
    color: '#64748b',
    fontWeight: 'bold',
    fontSize: 14,
  },
  activeTabText: {
    color: '#3b82f6',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  metricLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  metricValue: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 12,
    letterSpacing: -1,
  },
  metricBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.1)',
  },
  metricBadgeText: {
    color: '#3b82f6',
    fontSize: 11,
    fontWeight: 'bold',
  },
  sectionCard: {
    backgroundColor: '#0f172a',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  sectionTitleWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  sectionIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -4,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
    lineHeight: 22,
    flex: 1,
  },
  scaleTypeBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  scaleTypeText: {
    color: '#8b5cf6',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ratingBox: {
    paddingVertical: 4,
  },
  ratingMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 24,
  },
  ratingLarge: {
    fontSize: 56,
    fontWeight: '900',
    color: 'white',
    letterSpacing: -2,
  },
  starsColumn: {
    gap: 4,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  ratingTotal: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500',
  },
  breakdownContainer: {
    gap: 10,
    backgroundColor: 'rgba(2, 6, 23, 0.4)',
    padding: 16,
    borderRadius: 20,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  breakdownStar: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    width: 24,
  },
  breakdownBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: '#1e293b',
    borderRadius: 3,
    overflow: 'hidden',
  },
  breakdownBarFill: {
    height: '100%',
    backgroundColor: '#f59e0b',
    borderRadius: 3,
  },
  breakdownCount: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: 'bold',
    width: 20,
    textAlign: 'right',
  },
  likertLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
    backgroundColor: 'rgba(2, 6, 23, 0.4)',
    padding: 16,
    borderRadius: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  likertRow: {
    marginBottom: 28,
  },
  likertRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 12,
  },
  likertLabel: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    flex: 1,
  },
  meanBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  meanText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '900',
  },
  likertBarContainer: {
    height: 24,
    backgroundColor: '#020617',
    borderRadius: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  likertSegment: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '900',
    opacity: 0.9,
  },
  sampleGrid: {
    gap: 12,
  },
  sampleCard: {
    backgroundColor: '#020617',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  sampleName: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sampleText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  noFeedback: {
    color: '#475569',
    textAlign: 'center',
    fontStyle: 'italic',
    padding: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 20,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    color: 'white',
    fontSize: 15,
  },
  responseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 12,
    gap: 16,
  },
  respInfo: {
    flex: 1,
  },
  respName: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  respMeta: {
    color: '#64748b',
    fontSize: 12,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    gap: 16,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 16,
    textAlign: 'center',
  },
  emptySearch: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptySearchText: {
    color: '#334155',
    fontSize: 14,
  },
  modalScroll: {
    maxHeight: 500,
  },
  modalHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  modalAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalAvatarText: {
    color: '#3b82f6',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalName: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalEmail: {
    color: '#64748b',
    fontSize: 13,
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#1e293b',
    marginBottom: 20,
  },
  modalQItem: {
    marginBottom: 24,
  },
  modalQLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 1,
  },
  modalStars: {
    flexDirection: 'row',
    gap: 4,
  },
  modalLikertList: {
    gap: 8,
  },
  modalLikertRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#020617',
    padding: 10,
    borderRadius: 10,
  },
  modalLikertStmt: {
    color: '#e2e8f0',
    fontSize: 13,
    flex: 1,
  },
  modalLikertVal: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalLikertValText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalTextAns: {
    color: 'white',
    fontSize: 15,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  modalChoiceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 6,
  },
  modalChoiceText: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: 'bold',
  },
  tabContentContainer: {
    flex: 1,
  },
  hiddenContent: {
    display: 'none',
  },
  viewAllCommentsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 16,
    gap: 8,
  },
  viewAllCommentsText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: 'bold',
  }
});

export default EvaluationAnalyticsScreen;
