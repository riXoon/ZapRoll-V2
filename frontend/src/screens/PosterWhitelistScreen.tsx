import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator, 
  RefreshControl,
  TextInput,
  ScrollView,
  useWindowDimensions
} from 'react-native';
import { FeedbackModal } from '../components/FeedbackModal';
import { 
  ArrowLeft, 
  Search, 
  FileDown, 
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  UserCheck,
  Award,
  Download,
  Calendar
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, withRepeat, withTiming, useAnimatedStyle, useSharedValue, Layout } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { API_URL } from '../config/api';
import { exportToPDF, exportToExcel, exportPosterClearanceToPDF, exportPosterClearanceToExcel } from '../utils/exportUtils';
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

const formatDate = (dateString: string | null) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

const MemoizedRow = React.memo(({ item, index, isSmallScreen, styles }: any) => {
  const metadata = item.metadata || {};
  const section = metadata.section || metadata.yearSection || 'N/A';
  const group = metadata.groupNumber || 'N/A';
  const capstone = metadata.capstoneTitle || 'N/A';
  const fullName = item.full_name || 'Anonymous';
  const email = item.email || '-';

  return (
    <Animated.View 
      entering={FadeInDown.delay(index * 50)}
      layout={Layout.springify()}
      style={styles.tableRow}
    >
      <View style={[styles.column, { flex: isSmallScreen ? 2.2 : 2 }]}>
        <Text style={[styles.nameText, isSmallScreen && { fontSize: 13 }]} numberOfLines={1}>
          {fullName} {item.external_id ? `(${item.external_id})` : ''}
        </Text>
        <Text style={[styles.emailText, isSmallScreen && { fontSize: 11 }]} numberOfLines={1}>
          {capstone !== 'N/A' ? capstone : email}
        </Text>
        {isSmallScreen && (
          <View style={styles.mobileMetadataRow}>
            <Text style={styles.mobileMetadataText}>Sec: {section}</Text>
            <View style={styles.dotSeparator} />
            <Text style={styles.mobileMetadataText}>Grp: {group}</Text>
          </View>
        )}
      </View>
      
      {!isSmallScreen && (
        <>
          <View style={[styles.column, { flex: 0.8 }]}>
            <Text style={styles.detailsText} numberOfLines={1}>{section}</Text>
          </View>

          <View style={[styles.column, { flex: 0.8 }]}>
            <Text style={styles.detailsText} numberOfLines={1}>{group}</Text>
          </View>
        </>
      )}
      
      <View style={[styles.column, { flex: isSmallScreen ? 2 : 1.8 }]}>
        <View style={styles.timestampBox}>
          <Clock size={isSmallScreen ? 10 : 12} color="#3b82f6" />
          <Text style={[styles.timestampText, isSmallScreen && { fontSize: 10 }, styles.activeTimestamp]}>
            IN: {formatDate(item.poster_scanned_at)}
          </Text>
        </View>
        <View style={[styles.timestampBox, { marginTop: 4 }]}>
          <Clock size={isSmallScreen ? 10 : 12} color="#10b981" />
          <Text style={[styles.timestampText, isSmallScreen && { fontSize: 10 }, styles.activeTimestamp]}>
            OUT: {formatDate(item.poster_out_at)}
          </Text>
        </View>
      </View>

      <View style={[styles.column, { flex: 0.5, alignItems: 'flex-end' }]}>
        <View style={[styles.checkBadge, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }, isSmallScreen && { width: 28, height: 28 }]}>
          <Award size={isSmallScreen ? 16 : 20} color="#3b82f6" />
        </View>
      </View>
    </Animated.View>
  );
}, (prevProps, nextProps) => {
  return prevProps.item.registration_id === nextProps.item.registration_id && 
         prevProps.isSmallScreen === nextProps.isSmallScreen;
});

const CACHE_KEY_PREFIX = '@poster_whitelist_cache_';
const CACHE_TTL = 5 * 60 * 1000;

function useDebounce(value: any, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

const PosterWhitelistScreen = ({ navigation, route }: any) => {
  const insets = useSafeAreaInsets();
  const { eventId } = route.params || {};
  
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [responses, setResponses] = useState<any[]>([]);
  const [eventName, setEventName] = useState('Event');
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearchQuery = useDebounce(searchInput, 300);
  const [isExporting, setIsExporting] = useState(false);
  
  const { width: screenWidth } = useWindowDimensions();
  const isSmallScreen = screenWidth < 420;
  
  // Feedback Modal State
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackConfig, setFeedbackConfig] = useState<{
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'confirm';
    onConfirm?: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
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
    confirmLabel?: string,
    cancelLabel?: string
  ) => {
    setFeedbackConfig({ title, message, type, onConfirm, confirmLabel, cancelLabel });
    setFeedbackVisible(true);
  };

  const fetchResponses = async (forceRefresh = false) => {
    try {
      const cacheKey = `${CACHE_KEY_PREFIX}${eventId}`;

      if (!refreshing && !forceRefresh) {
        const cachedDataStr = await AsyncStorage.getItem(cacheKey);
        if (cachedDataStr) {
          const cachedData = JSON.parse(cachedDataStr);
          const now = new Date().getTime();
          if (now - cachedData.timestamp < CACHE_TTL) {
            setResponses(cachedData.responses);
            setEventName(cachedData.eventName);
            setIsLoading(false);
            return;
          }
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !eventId) return;

      const response = await fetch(`${API_URL}/api/events/${eventId}/poster-clearance-whitelist`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      
      const result = await response.json();
      let fetchedResponses = responses;
      if (result.status === 'success') {
        fetchedResponses = result.data || [];
        setResponses(fetchedResponses);
      }

      // 2. Fetch Event Name
      const eventRes = await fetch(`${API_URL}/api/events/${eventId}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const eventResult = await eventRes.json();
      let fetchedEventName = eventName;
      if (eventResult.status === 'success') {
        fetchedEventName = eventResult.data.name;
        setEventName(fetchedEventName);
      }

      await AsyncStorage.setItem(cacheKey, JSON.stringify({
        timestamp: new Date().getTime(),
        responses: fetchedResponses,
        eventName: fetchedEventName
      }));

    } catch (error) {
      console.error('Error fetching poster whitelist:', error);
      showAlert('Error', 'Failed to fetch poster clearance data.', 'error');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchResponses();
  }, [eventId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchResponses(true);
  };

  const filteredData = useMemo(() => {
    return responses.filter(item => {
      const name = item.full_name || '';
      const email = item.email || '';
      const id = item.external_id || '';
      
      return name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) || 
             email.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
             id.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
    });
  }, [responses, debouncedSearchQuery]);

  const handleExport = async (format: 'PDF' | 'Excel') => {
    if (filteredData.length === 0) {
      showAlert('No Data', 'There are no records to export.', 'info');
      return;
    }
    
    try {
      setIsExporting(true);
      const filename = `${eventName}_Poster_Clearance`;
      if (format === 'PDF') {
        await exportPosterClearanceToPDF(filteredData, eventName);
      } else {
        await exportPosterClearanceToExcel(filteredData, eventName);
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

  const renderItem = React.useCallback(({ item, index }: { item: any, index: number }) => (
    <MemoizedRow item={item} index={index} isSmallScreen={isSmallScreen} styles={styles} />
  ), [isSmallScreen]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ArrowLeft color="white" size={20} />
          </TouchableOpacity>
          <View style={{ flexShrink: 1 }}>
            <Text style={[styles.headerTitle, isSmallScreen && { fontSize: 16 }]} numberOfLines={1}>
              Poster Clearance
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>Eligible pre-registered presenters</Text>
          </View>
        </View>
        
        <View style={styles.headerRight}>
          <TouchableOpacity 
            onPress={() => handleExport('Excel')} 
            disabled={isExporting}
            style={[
              styles.exportTab, 
              isSmallScreen && { paddingHorizontal: 8, paddingVertical: 6 },
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
              isSmallScreen && { paddingHorizontal: 8, paddingVertical: 6 },
              { backgroundColor: 'rgba(129, 140, 248, 0.1)', borderColor: 'rgba(129, 140, 248, 0.2)' }
            ]}
          >
            <FileDown color="#818cf8" size={isSmallScreen ? 12 : 14} />
            <Text style={[styles.exportTabText, isSmallScreen && { fontSize: 10 }, { color: '#818cf8' }]}>PDF</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search & Stats */}
      <View style={styles.filterSection}>
        <View style={styles.searchBar}>
          <Search color="#64748b" size={18} />
          <TextInput 
            placeholder="Search presenters..."
            placeholderTextColor="#64748b"
            style={styles.searchInput}
            value={searchInput}
            onChangeText={setSearchInput}
          />
        </View>
        
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Award size={16} color="#3b82f6" />
            <Text style={styles.statText}>{responses.length} Cleared Presenters</Text>
          </View>
        </View>
      </View>

      {/* Table Header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.columnHeader, { flex: isSmallScreen ? 2.2 : 2 }]}>PRESENTER / CAPSTONE</Text>
        {!isSmallScreen && (
          <>
            <Text style={[styles.columnHeader, { flex: 0.8 }]}>SECTION</Text>
            <Text style={[styles.columnHeader, { flex: 0.8 }]}>GROUP</Text>
          </>
        )}
        <Text style={[styles.columnHeader, { flex: isSmallScreen ? 2 : 1.8 }]}>TIME IN / OUT</Text>
        <Text style={[styles.columnHeader, { flex: 0.5, textAlign: 'right' }]}>STATUS</Text>
      </View>

      {isLoading && !refreshing ? (
        <View style={styles.listContent}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <View key={i} style={styles.tableRow}>
              <View style={[styles.column, { flex: isSmallScreen ? 2.2 : 2 }]}>
                <SkeletonItem width="80%" height={16} borderRadius={4} style={{ marginBottom: 6 }} />
                <SkeletonItem width="60%" height={12} borderRadius={4} />
              </View>
              {!isSmallScreen && (
                <>
                  <View style={[styles.column, { flex: 0.8 }]}>
                    <SkeletonItem width="60%" height={14} borderRadius={4} />
                  </View>
                  <View style={[styles.column, { flex: 0.8 }]}>
                    <SkeletonItem width="70%" height={14} borderRadius={4} />
                  </View>
                </>
              )}
              <View style={[styles.column, { flex: isSmallScreen ? 2 : 1.8 }]}>
                <SkeletonItem width="80%" height={12} borderRadius={4} style={{ marginBottom: 6 }} />
                <SkeletonItem width="80%" height={12} borderRadius={4} />
              </View>
              <View style={[styles.column, { flex: 0.5, alignItems: 'flex-end' }]}>
                 <SkeletonItem width={isSmallScreen ? 28 : 32} height={isSmallScreen ? 28 : 32} borderRadius={16} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={filteredData}
          renderItem={renderItem}
          keyExtractor={item => item.registration_id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={11}
          removeClippedSubviews={true}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Award size={48} color="#1e293b" />
              <Text style={styles.emptyText}>No cleared posters yet</Text>
              <Text style={styles.emptySubtext}>Pre-registered presenters with both scans will appear here</Text>
            </View>
          }
        />
      )}

      <FeedbackModal
        visible={feedbackVisible}
        title={feedbackConfig.title}
        message={feedbackConfig.message}
        type={feedbackConfig.type}
        onConfirm={feedbackConfig.onConfirm}
        confirmLabel={feedbackConfig.confirmLabel}
        cancelLabel={feedbackConfig.cancelLabel}
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#0f172a',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
    marginRight: 10,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    fontSize: 13,
    color: '#64748b',
  },
  filterSection: {
    paddingHorizontal: 24,
    marginBottom: 20,
    marginTop: 16
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
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statText: {
    color: '#3b82f6',
    fontSize: 12,
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
    fontSize: 10,
    fontWeight: 'bold',
    color: '#64748b',
    letterSpacing: 1,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
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
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  emailText: {
    color: '#64748b',
    fontSize: 12,
  },
  detailsText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  timestampBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timestampText: {
    color: '#475569',
    fontSize: 11,
  },
  activeTimestamp: {
    color: '#94a3b8',
  },
  checkBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileMetadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  mobileMetadataText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
  },
  dotSeparator: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#334155',
    marginHorizontal: 6,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loaderText: {
    color: '#64748b',
    marginTop: 16,
    fontSize: 14,
  },
  emptyState: {
    paddingTop: 80,
    alignItems: 'center',
  },
  emptyText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  }
});

export default PosterWhitelistScreen;
