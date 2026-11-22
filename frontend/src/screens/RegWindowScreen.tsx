import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { ArrowLeft, CalendarDays, Hourglass, Bell, ShieldCheck } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const RegWindowScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <ArrowLeft color="white" size={20} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Registration Window</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.delay(100)} style={styles.infoCard}>
          <View style={styles.iconCircle}>
            <CalendarDays color="#3b82f6" size={24} />
          </View>
          <Text style={styles.cardTitle}>Event Timeline</Text>
          <Text style={styles.cardSubtitle}>
            Define when the registration opens and closes for participants.
          </Text>

          <View style={styles.timePickerPlaceholder}>
            <View style={styles.timeBox}>
              <Text style={styles.timeLabel}>OPENS</Text>
              <Text style={styles.timeValue}>May 15, 2024</Text>
              <Text style={styles.timeSubValue}>08:00 AM</Text>
            </View>
            <View style={styles.timeDivider} />
            <View style={styles.timeBox}>
              <Text style={styles.timeLabel}>CLOSES</Text>
              <Text style={styles.timeValue}>May 20, 2024</Text>
              <Text style={styles.timeSubValue}>05:00 PM</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200)} style={styles.optionCard}>
          <View style={styles.optionItem}>
            <View style={styles.optionIconBox}>
              <Hourglass color="#f59e0b" size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionTitle}>Early Bird Access</Text>
              <Text style={styles.optionSubtitle}>Open 24h early for priority roles</Text>
            </View>
          </View>

          <View style={styles.optionItem}>
            <View style={[styles.optionIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
              <Bell color="#3b82f6" size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionTitle}>Auto-Reminders</Text>
              <Text style={styles.optionSubtitle}>Notify users before window closes</Text>
            </View>
          </View>

          <View style={[styles.optionItem, { borderBottomWidth: 0 }]}>
            <View style={[styles.optionIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
              <ShieldCheck color="#10b981" size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionTitle}>Strict Window</Text>
              <Text style={styles.optionSubtitle}>Deny registration after deadline</Text>
            </View>
          </View>
        </Animated.View>

        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.applyButton}
        >
          <Text style={styles.applyButtonText}>Apply Window Settings</Text>
        </TouchableOpacity>
        
        <View style={{ height: 50 }} />
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
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#0f172a',
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
  scrollView: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  infoCard: {
    backgroundColor: '#0f172a',
    borderRadius: 32,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  timePickerPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#020617',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  timeBox: {
    flex: 1,
    alignItems: 'center',
  },
  timeDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#1e293b',
    marginHorizontal: 12,
  },
  timeLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#3b82f6',
    letterSpacing: 1,
    marginBottom: 8,
  },
  timeValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  timeSubValue: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  optionCard: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 32,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  optionIconBox: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 12,
    color: '#64748b',
  },
  applyButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 40,
  },
  applyButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
});

export default RegWindowScreen;
