import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import { 
  ArrowLeft, 
  UserCircle, 
  Briefcase, 
  Users, 
  ChevronRight
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { supabase } from '../lib/supabase';
import { API_URL } from '../config/api';

const WalkInRoleSelectionScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(true);
  const [event, setEvent] = useState<any>(null);

  useEffect(() => {
    fetchActiveEvent();
  }, []);

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
      }
    } catch (error) {
      console.error('Error fetching event for role selection:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getIconForRole = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('student')) return <UserCircle color="#3b82f6" size={32} />;
    if (lowerName.includes('employee') || lowerName.includes('staff')) return <Briefcase color="#10b981" size={32} />;
    return <Users color="#f59e0b" size={32} />;
  };

  const getBgColorForRole = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('student')) return 'rgba(59, 130, 246, 0.1)';
    if (lowerName.includes('employee') || lowerName.includes('staff')) return 'rgba(16, 185, 129, 0.1)';
    return 'rgba(245, 158, 11, 0.1)';
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#3b82f6" size="large" />
        <Text style={styles.loadingText}>Loading Roles...</Text>
      </View>
    );
  }

  const quotas = event?.event_quotas || [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft color="white" size={20} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Walk-In Portal</Text>
          <Text style={styles.headerSubtitle}>Select participant role</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.delay(100)} style={styles.heroSection}>
          <View style={styles.heroIconBox}>
            <Image 
              source={require('../../assets/Synergy-01.png')} 
              style={styles.heroLogo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.heroTitle}>New Registration</Text>
          <Text style={styles.heroSubtitle}>
            Choose a role to begin the on-the-spot registration process for {event?.name || 'the event'}.
          </Text>
        </Animated.View>

        <View style={styles.rolesGrid}>
          {quotas.map((quota: any, index: number) => (
            <Animated.View 
              key={quota.id} 
              entering={FadeInDown.delay(200 + index * 100)}
              layout={Layout.springify()}
            >
              <TouchableOpacity 
                style={styles.roleCard}
                onPress={() => navigation.navigate('WalkIn', { 
                  quotaId: quota.id,
                  roleName: quota.name,
                  event: event
                })}
              >
                <View style={[styles.iconContainer, { backgroundColor: getBgColorForRole(quota.name) }]}>
                  {getIconForRole(quota.name)}
                </View>
                <View style={styles.roleInfo}>
                  <Text style={styles.roleName}>{quota.name}</Text>
                  <Text style={styles.roleDescription}>Register as a {quota.name.toLowerCase()}</Text>
                </View>
                <ChevronRight color="#475569" size={20} />
              </TouchableOpacity>
            </Animated.View>
          ))}

          {quotas.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No roles configured for this event.</Text>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            All walk-ins are automatically marked as "Attended" upon registration.
          </Text>
        </View>
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
  loadingText: {
    color: '#64748b',
    marginTop: 16,
    fontSize: 14,
  },
  scrollContent: {
    padding: 24,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  heroIconBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  heroLogo: {
    width: '70%',
    height: '70%',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 12,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  rolesGrid: {
    gap: 16,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1e293b',
    gap: 20,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleInfo: {
    flex: 1,
  },
  roleName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  roleDescription: {
    fontSize: 14,
    color: '#64748b',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#475569',
    fontSize: 16,
  },
  footer: {
    marginTop: 40,
    padding: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.1)',
    borderStyle: 'dashed',
  },
  footerText: {
    color: '#3b82f6',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    opacity: 0.8,
  }
});

export default WalkInRoleSelectionScreen;
