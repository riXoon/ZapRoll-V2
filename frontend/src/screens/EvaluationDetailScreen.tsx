import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions,
  useWindowDimensions,
  Platform
} from 'react-native';
import { 
  ArrowLeft, 
  Star, 
  CheckCircle2, 
  MessageSquare,
  Clock,
  Mail,
  User,
  Calendar,
  ChevronRight
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';

const EvaluationDetailScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const isSmallScreen = screenWidth < 380;
  
  const { response, template, sessionType } = route.params;

  if (!response || !template) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: 'white' }}>No response data found.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={{ color: '#3b82f6' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const userResp = response.current_response || (sessionType === 'am-eval' ? response.am_eval_responses : response.pm_eval_responses);
  
  const questions: any[] = [];
  template.questions.forEach((p: any) => {
    if (p.questions) questions.push(...p.questions);
    else questions.push(p);
  });

  const renderContent = () => {
    return questions.map((q: any, idx: number) => {
      if (q.type === 'header') return null;
      
      let answer: any = null;
      if (q.type === 'likert') {
        answer = q.statements.map((stmt: string, i: number) => ({
          label: stmt,
          val: userResp[q.id]?.[i] || userResp[`${q.id}_s${i}`]
        }));
      } else {
        answer = userResp[q.id];
      }

      if (!answer && q.type !== 'header') return null;

      return (
        <Animated.View 
          key={q.id} 
          entering={FadeInDown.delay(100 * (idx + 1))}
          style={styles.qCard}
        >
          <View style={styles.qHeader}>
            <View style={styles.qIconBox}>
              {q.type === 'rating' && <Star color="#f59e0b" size={16} fill="#f59e0b" />}
              {q.type === 'likert' && <Calendar color="#8b5cf6" size={16} />}
              {q.type === 'text' && <MessageSquare color="#3b82f6" size={16} />}
              {q.type === 'choice' && <CheckCircle2 color="#10b981" size={16} />}
            </View>
            <Text style={styles.qLabel}>{q.label}</Text>
          </View>
          
          <View style={styles.ansContent}>
            {q.type === 'rating' && (
              <View style={[styles.ratingBox, isSmallScreen && { flexDirection: 'column', gap: 12, alignItems: 'flex-start' }]}>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star 
                      key={s} 
                      size={isSmallScreen ? 24 : 28} 
                      color={s <= parseInt(answer) ? "#f59e0b" : "#1e293b"} 
                      fill={s <= parseInt(answer) ? "#f59e0b" : "transparent"}
                    />
                  ))}
                </View>
                <View style={styles.ratingBadge}>
                  <Text style={styles.ratingValueText}>{answer} / 5</Text>
                </View>
              </View>
            )}

            {q.type === 'likert' && (
              <View style={styles.likertList}>
                {answer.map((a: any, i: number) => (
                  <View key={i} style={[styles.likertRow, isSmallScreen && { gap: 8 }]}>
                    <Text style={styles.likertStmt}>{a.label}</Text>
                    <View style={styles.likertValBox}>
                      <Text style={styles.likertValText}>{a.val || '-'}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {q.type === 'text' && (
              <View style={styles.textAnsBox}>
                <Text style={styles.textAns}>{answer}</Text>
              </View>
            )}

            {q.type === 'choice' && (
              <View style={styles.choiceBadge}>
                <Text style={styles.choiceText}>{answer}</Text>
                <CheckCircle2 color="#10b981" size={18} fill="rgba(16, 185, 129, 0.2)" />
              </View>
            )}
          </View>
        </Animated.View>
      );
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Dynamic Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft color="white" size={24} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>Response Details</Text>
          <View style={styles.sessionBadge}>
            <View style={[styles.sessionDot, { backgroundColor: sessionType === 'am-eval' ? '#3b82f6' : '#8b5cf6' }]} />
            <Text style={styles.sessionText}>{sessionType === 'am-eval' ? 'AM Session' : 'PM Session'}</Text>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Profile Card - Premium Look */}
        <Animated.View entering={FadeInDown} style={styles.profileCard}>
          <View style={[styles.profileMain, isSmallScreen && { flexDirection: 'column', alignItems: 'flex-start' }]}>
            <View style={styles.avatarBox}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{response.full_name ? response.full_name[0] : '?'}</Text>
              </View>
              <View style={styles.avatarRing} />
            </View>
            
            <View style={styles.profileMeta}>
              <Text style={[styles.name, isSmallScreen && { fontSize: 20 }]} numberOfLines={1}>{response.full_name || 'Anonymous'}</Text>
              <View style={styles.emailRow}>
                <Mail color="#3b82f6" size={14} />
                <Text style={styles.emailText} numberOfLines={1}>{response.email || 'No email provided'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.profileDivider} />

          <View style={[styles.submissionMeta, isSmallScreen && { flexDirection: 'column', gap: 12 }]}>
            <View style={styles.metaItem}>
              <Calendar color="#64748b" size={14} />
              <Text style={styles.metaText}>{new Date(response.submitted_at || response.am_eval_submitted_at || response.pm_eval_submitted_at).toLocaleDateString()}</Text>
            </View>
            <View style={styles.metaItem}>
              <Clock color="#64748b" size={14} />
              <Text style={styles.metaText}>{new Date(response.submitted_at || response.am_eval_submitted_at || response.pm_eval_submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          </View>
        </Animated.View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>PARTICIPANT FEEDBACK</Text>
          <View style={styles.sectionLine} />
        </View>

        {renderContent()}
      </ScrollView>
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
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    letterSpacing: -0.5,
  },
  sessionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  sessionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sessionText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 60,
  },
  profileCard: {
    backgroundColor: '#0f172a',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  profileMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  avatarBox: {
    position: 'relative',
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 24,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    zIndex: 2,
  },
  avatarRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.1)',
    zIndex: 1,
  },
  avatarText: {
    color: '#3b82f6',
    fontSize: 32,
    fontWeight: 'bold',
  },
  profileMeta: {
    flex: 1,
    gap: 4,
  },
  name: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: -0.5,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emailText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
  },
  profileDivider: {
    height: 1,
    backgroundColor: '#1e293b',
    marginVertical: 20,
    opacity: 0.5,
  },
  submissionMeta: {
    flexDirection: 'row',
    gap: 24,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#1e293b',
    opacity: 0.5,
  },
  qCard: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 20,
  },
  qHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 20,
  },
  qIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  qLabel: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    flex: 1,
  },
  ansContent: {
    paddingLeft: 4,
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#020617',
    padding: 16,
    borderRadius: 16,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  ratingBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  ratingValueText: {
    color: '#f59e0b',
    fontSize: 16,
    fontWeight: 'bold',
  },
  likertList: {
    gap: 12,
  },
  likertRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#020617',
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },
  likertStmt: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    lineHeight: 20,
  },
  likertValBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  likertValText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: 'bold',
  },
  textAnsBox: {
    backgroundColor: '#020617',
    padding: 20,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  textAns: {
    color: 'white',
    fontSize: 16,
    fontStyle: 'italic',
    lineHeight: 26,
    opacity: 0.9,
  },
  choiceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.1)',
  },
  choiceText: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: 'bold',
  }
});

export default EvaluationDetailScreen;
