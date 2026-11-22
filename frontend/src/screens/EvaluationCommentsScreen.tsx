import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Platform,
  useWindowDimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  ArrowLeft, 
  Search, 
  MessageSquare, 
  Calendar, 
  Clock, 
  Mail, 
  User, 
  AlertCircle,
  FileText
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInRight, useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import { supabase } from '../lib/supabase';
import { API_URL } from '../config/api';
import { FeedbackModal } from '../components/FeedbackModal';

const CACHE_KEY = '@evaluation_analytics_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Custom Skeleton Loader Component
const SkeletonItem = ({ width, height, borderRadius = 12, style }: any) => {
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

// Optimized individual Row Component (Memoized)
const CommentRow = React.memo(({ item, isAm }: any) => {
  const nameInitial = item.name ? item.name[0].toUpperCase() : '?';
  const accentColor = isAm ? '#3b82f6' : '#8b5cf6';
  const badgeBg = isAm ? 'rgba(59, 130, 246, 0.06)' : 'rgba(139, 92, 246, 0.06)';
  const badgeBorder = isAm ? 'rgba(59, 130, 246, 0.15)' : 'rgba(139, 92, 246, 0.15)';

  return (
    <View style={[styles.commentCard, { borderLeftColor: accentColor }]}>
      <View style={styles.commentHeader}>
        <View style={[styles.avatar, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
          <Text style={[styles.avatarText, { color: accentColor }]}>{nameInitial}</Text>
        </View>
        <View style={styles.respondentInfo}>
          <Text style={styles.respondentName} numberOfLines={1}>
            {item.name || 'Anonymous'}
          </Text>
          <View style={styles.emailRow}>
            <Mail color="#64748b" size={12} />
            <Text style={styles.respondentEmail} numberOfLines={1}>
              {item.email || 'No email provided'}
            </Text>
          </View>
        </View>
        
        <View style={styles.dateTimeContainer}>
          <View style={styles.dateTimeBadge}>
            <Calendar color="#64748b" size={11} />
            <Text style={styles.dateTimeText}>{item.formattedDate}</Text>
          </View>
          <View style={styles.dateTimeBadge}>
            <Clock color="#64748b" size={11} />
            <Text style={styles.dateTimeText}>{item.formattedTime}</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.commentBody}>
        <Text style={styles.commentText}>"{item.text}"</Text>
      </View>
    </View>
  );
});

const EvaluationCommentsScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const isSmallScreen = screenWidth < 380;
  
  const { questionId, questionLabel, activeSession } = route.params || {};
  const isAm = activeSession === 'am-eval';
  
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [localQuery, setLocalQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [event, setEvent] = useState<any>(null);

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

  // Debounce search query updates to maintain 60fps scrolling
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(localQuery);
    }, 180);
    return () => clearTimeout(handler);
  }, [localQuery]);

  // Load cache on mount
  useEffect(() => {
    loadCachedComments();
  }, [questionId, activeSession]);

  const parseComments = (responsesList: any[]) => {
    const extracted: any[] = [];
    responsesList.forEach(r => {
      const submittedAt = isAm ? r.am_eval_submitted_at : r.pm_eval_submitted_at;
      const responsesObj = isAm ? r.am_eval_responses : r.pm_eval_responses;
      
      if (submittedAt && responsesObj && responsesObj[questionId]) {
        const textVal = responsesObj[questionId]?.trim();
        if (textVal) {
          const dateObj = new Date(submittedAt);
          extracted.push({
            response_id: r.response_id,
            name: r.full_name,
            email: r.email,
            text: textVal,
            submittedAt: dateObj,
            formattedDate: dateObj.toLocaleDateString(),
            formattedTime: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          });
        }
      }
    });
    // Sort comments chronologically (latest first)
    return extracted.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  };

  const loadCachedComments = async (forceRefresh = false) => {
    try {
      if (!forceRefresh) {
        const cachedStr = await AsyncStorage.getItem(CACHE_KEY);
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          if (Date.now() - cached.timestamp < CACHE_TTL) {
            setEvent(cached.event);
            const parsed = parseComments(cached.responses || []);
            setComments(parsed);
            setIsLoading(false);
            setRefreshing(false);
            return;
          }
        }
      }
      
      // Fallback or Refresh: Fetch fresh data
      await fetchFreshData();
    } catch (e: any) {
      console.error(e);
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const fetchFreshData = async () => {
    try {
      if (!refreshing) setIsLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsLoading(false);
        setRefreshing(false);
        return;
      }

      // 1. Fetch Event
      const eventRes = await fetch(`${API_URL}/api/events`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const eventData = await eventRes.json();
      if (eventData.status !== 'success' || eventData.data.length === 0) {
        setIsLoading(false);
        setRefreshing(false);
        return;
      }
      const activeEvent = eventData.data[0];
      setEvent(activeEvent);

      // 2. Fetch Templates
      const { data: templateData, error: tError } = await supabase
        .from('evaluation_templates')
        .select('*')
        .eq('event_id', activeEvent.id);
      
      if (tError) throw tError;
      
      const tMap: Record<string, any> = {};
      templateData?.forEach(t => {
        tMap[t.session_type] = t;
      });

      // 3. Fetch Responses from View
      const { data: respData, error: rError } = await supabase
        .from('v_evaluation_analytics')
        .select('*')
        .eq('event_id', activeEvent.id);
      
      if (rError) throw rError;

      const parsed = parseComments(respData || []);
      setComments(parsed);

      // Update cache
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        event: activeEvent,
        templates: tMap,
        responses: respData || []
      }));

    } catch (error: any) {
      console.error('Fetch Error:', error);
      showAlert("Error", error.message || "Failed to load fresh comments.", "error");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadCachedComments(true);
  };

  // Memoized filter list of comments based on debounced search query
  const filteredComments = useMemo(() => {
    if (!searchQuery.trim()) {
      return comments;
    }
    const q = searchQuery.toLowerCase();
    return comments.filter(c => 
      c.text?.toLowerCase().includes(q) ||
      c.name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  }, [comments, searchQuery]);

  const renderComment = useCallback(({ item }: any) => (
    <CommentRow item={item} isAm={isAm} />
  ), [isAm]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft color="white" size={24} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>Comments & Suggestions</Text>
          <View style={styles.sessionBadge}>
            <View style={[styles.sessionDot, { backgroundColor: isAm ? '#3b82f6' : '#8b5cf6' }]} />
            <Text style={[styles.sessionText, { color: isAm ? '#3b82f6' : '#8b5cf6' }]}>
              {isAm ? 'AM Session' : 'PM Session'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        {isLoading && !refreshing ? (
          <View style={{ flex: 1, paddingHorizontal: 20 }}>
            {/* Header skeletal */}
            <SkeletonItem width="100%" height={90} style={{ marginBottom: 20, marginTop: 10 }} />
            <SkeletonItem width="50%" height={24} style={{ marginBottom: 24 }} />
            {/* Comments list skeletons */}
            <SkeletonItem width="100%" height={130} style={{ marginBottom: 16 }} />
            <SkeletonItem width="100%" height={130} style={{ marginBottom: 16 }} />
            <SkeletonItem width="100%" height={130} style={{ marginBottom: 16 }} />
          </View>
        ) : (
          <FlatList
            data={filteredComments}
            keyExtractor={item => item.response_id}
            renderItem={renderComment}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            // Optimization properties for maximum rendering performance under large datasets
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={Platform.OS !== 'web'}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={handleRefresh} 
                tintColor={isAm ? "#3b82f6" : "#8b5cf6"} 
              />
            }
            ListHeaderComponent={
              <View>
                {/* Question Info Card */}
                <Animated.View entering={FadeInDown.delay(50)} style={styles.questionCard}>
                  <View style={styles.questionIconWrapper}>
                    <MessageSquare color={isAm ? '#3b82f6' : '#8b5cf6'} size={18} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.questionLabelText}>{questionLabel || 'Prompt'}</Text>
                  </View>
                </Animated.View>

                {/* Sticky search-like bar */}
                <View style={styles.searchContainer}>
                  <View style={styles.searchBar}>
                    <Search color="#64748b" size={20} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search comments, names or emails..."
                      placeholderTextColor="#475569"
                      value={localQuery}
                      onChangeText={setLocalQuery}
                    />
                  </View>
                </View>

                {/* Count metric banner */}
                <View style={styles.statsBanner}>
                  <FileText color="#475569" size={14} />
                  <Text style={styles.statsText}>
                    {searchQuery.trim() 
                      ? `Showing ${filteredComments.length} of ${comments.length} suggestions` 
                      : `Total of ${comments.length} suggestions shared`}
                  </Text>
                </View>
              </View>
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <AlertCircle color="#1e293b" size={48} />
                <Text style={styles.emptyText}>
                  {searchQuery.trim() ? "No search results match your criteria." : "No comments shared yet for this session."}
                </Text>
              </View>
            }
          />
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
    backgroundColor: '#020617', // slate-950
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#0f172a',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    letterSpacing: -0.5,
  },
  sessionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  sessionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sessionText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  questionCard: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginTop: 10,
    marginBottom: 20,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  questionIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionLabelText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    gap: 12,
  },
  searchInput: {
    flex: 1,
    color: 'white',
    fontSize: 15,
  },
  statsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  statsText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  commentCard: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    borderLeftWidth: 4,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  respondentInfo: {
    flex: 1,
    gap: 2,
  },
  respondentName: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  respondentEmail: {
    color: '#64748b',
    fontSize: 11,
    maxWidth: 120,
  },
  dateTimeContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  dateTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#020617',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  dateTimeText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
  },
  commentBody: {
    backgroundColor: '#020617',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  commentText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 22,
    opacity: 0.95,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    color: '#475569',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  }
});

export default EvaluationCommentsScreen;
