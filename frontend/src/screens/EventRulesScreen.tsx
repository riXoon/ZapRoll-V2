import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { ArrowLeft, Clock, GraduationCap, CheckCircle2 } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const EventRulesScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const [rules, setRules] = useState({
    firstYear: true,
    secondYear: true,
    thirdYear: true,
    fourthYear: true,
  });

  const toggleRule = (key: keyof typeof rules) => {
    setRules({ ...rules, [key]: !rules[key] });
  };

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
        <Text style={styles.headerTitle}>Year-Level Filters</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.delay(100)} style={styles.sectionHeader}>
          <View style={styles.iconBox}>
            <GraduationCap color="#3b82f6" size={24} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitleText}>Student Eligibility</Text>
            <Text style={styles.sectionSubtitleText}>
              Toggle which year levels are allowed to register for this event.
            </Text>
          </View>
        </Animated.View>

        <View style={styles.listCard}>
          {[
            { id: 'firstYear', label: '1st Year Students', icon: '1st' },
            { id: 'secondYear', label: '2nd Year Students', icon: '2nd' },
            { id: 'thirdYear', label: '3rd Year Students', icon: '3rd' },
            { id: 'fourthYear', label: '4th Year Students', icon: '4th' },
          ].map((item, idx) => (
            <View 
              key={item.id} 
              style={[
                styles.listItem,
                idx !== 3 && styles.borderBottom
              ]}
            >
              <View style={styles.listItemLeft}>
                <View style={styles.yearIcon}>
                  <Text style={styles.yearText}>{item.icon}</Text>
                </View>
                <Text style={styles.itemLabel}>{item.label}</Text>
              </View>
              <Switch
                value={rules[item.id as keyof typeof rules]}
                onValueChange={() => toggleRule(item.id as keyof typeof rules)}
                trackColor={{ false: '#1e293b', true: '#3b82f6' }}
                thumbColor="white"
              />
            </View>
          ))}
        </View>

        <Animated.View entering={FadeInDown.delay(200)} style={styles.sectionHeader}>
          <View style={[styles.iconBox, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
            <Clock color="#10b981" size={24} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitleText}>Session Schedule</Text>
            <Text style={styles.sectionSubtitleText}>Standard event operation hours.</Text>
          </View>
        </Animated.View>
        
        <View style={styles.listCard}>
          <View style={styles.timeRow}>
            <Text style={styles.timeLabel}>Morning Session</Text>
            <Text style={styles.timeValue}>08:00 AM - 12:00 PM</Text>
          </View>
          <View style={[styles.timeRow, { marginTop: 16 }]}>
            <Text style={styles.timeLabel}>Afternoon Session</Text>
            <Text style={styles.timeValue}>01:00 PM - 05:00 PM</Text>
          </View>
        </View>

        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.saveButton}
        >
          <CheckCircle2 color="white" size={20} />
          <Text style={styles.saveButtonText}>Save Filters</Text>
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
  sectionHeader: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  iconBox: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  sectionTitleText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  sectionSubtitleText: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  listCard: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1e293b',
    overflow: 'hidden',
    padding: 20,
    marginBottom: 32,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  yearIcon: {
    width: 40,
    height: 40,
    backgroundColor: '#020617',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  yearText: {
    color: '#3b82f6',
    fontWeight: 'bold',
    fontSize: 12,
  },
  itemLabel: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '500',
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeLabel: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
  },
  timeValue: {
    color: 'white',
    fontWeight: 'bold',
    fontStyle: 'italic',
  },
  saveButton: {
    backgroundColor: '#059669',
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 40,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
});

export default EventRulesScreen;
