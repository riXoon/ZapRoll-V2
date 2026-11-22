import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import { 
  CheckCircle2, 
  User, 
  MapPin, 
  Calendar,
  ShieldCheck,
  X
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scale, verticalScale, moderateScale } from '../utils/responsive';

const TicketScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { name, role } = route.params || { name: 'Erickson Guhilde', role: 'Student' };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.navigate('Scanner')}
          style={styles.closeBtn}
        >
          <X color="white" size={moderateScale(24)} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirmation Ticket</Text>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Animated.View entering={FadeInUp.delay(200)} style={styles.successBadge}>
            <CheckCircle2 color="#10b981" size={moderateScale(60)} />
            <Text style={styles.successText}>Access Verified</Text>
          </Animated.View>

          {/* Digital Pass Card */}
          <Animated.View entering={FadeInDown.delay(400)} style={styles.ticketCard}>
            <View style={styles.ticketTop}>
              <View style={styles.eventInfo}>
                <Text style={styles.eventName}>Founders Day 2024</Text>
                <View style={styles.infoRow}>
                  <MapPin color="#64748b" size={moderateScale(14)} />
                  <Text style={styles.infoText}>Main University Hall</Text>
                </View>
              </View>
              <View style={styles.statusChip}>
                <Text style={styles.statusLabel}>VALID ENTRY</Text>
              </View>
            </View>

            <View style={styles.divider}>
              <View style={styles.dotLeft} />
              <View style={styles.dashLine} />
              <View style={styles.dotRight} />
            </View>

            <View style={styles.ticketBottom}>
              <View style={styles.participantInfo}>
                <View style={styles.infoBlock}>
                  <Text style={styles.label}>PARTICIPANT</Text>
                  <Text style={styles.value}>{name}</Text>
                </View>
                <View style={styles.infoBlock}>
                  <Text style={styles.label}>ROLE</Text>
                  <Text style={[styles.value, { color: '#3b82f6' }]}>{role}</Text>
                </View>
              </View>

              <View style={styles.securitySection}>
                <ShieldCheck color="#10b981" size={moderateScale(20)} />
                <Text style={styles.securityText}>Tamper-Proof Visual Evidence</Text>
              </View>

              <View style={styles.timestamp}>
                <Calendar color="#64748b" size={moderateScale(14)} />
                <Text style={styles.timeText}>Scanned at: {new Date().toLocaleTimeString()}</Text>
              </View>
            </View>
          </Animated.View>

          <Text style={styles.instructions}>
            Please present this digital pass to the door staff for manual verification.
          </Text>

          <TouchableOpacity 
            onPress={() => navigation.navigate('Scanner')}
            style={styles.doneBtn}
          >
            <Text style={styles.doneBtnText}>Close Ticket</Text>
          </TouchableOpacity>
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
    paddingHorizontal: scale(24),
    paddingTop: verticalScale(24),
    paddingBottom: verticalScale(16),
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeBtn: {
    width: scale(44),
    height: scale(44),
    borderRadius: moderateScale(22),
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scale(16),
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  headerTitle: {
    fontSize: moderateScale(20),
    fontWeight: 'bold',
    color: 'white',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    padding: scale(32),
    alignItems: 'center',
  },
  successBadge: {
    alignItems: 'center',
    marginBottom: verticalScale(40),
  },
  successText: {
    color: '#10b981',
    fontSize: moderateScale(24),
    fontWeight: 'bold',
    marginTop: verticalScale(12),
  },
  ticketCard: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: moderateScale(32),
    borderWidth: 1,
    borderColor: '#1e293b',
    overflow: 'hidden',
  },
  ticketTop: {
    padding: scale(32),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  eventInfo: {
    gap: verticalScale(8),
  },
  eventName: {
    color: 'white',
    fontSize: moderateScale(20),
    fontWeight: 'bold',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  infoText: {
    color: '#64748b',
    fontSize: moderateScale(14),
  },
  statusChip: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(6),
    borderRadius: moderateScale(8),
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  statusLabel: {
    color: '#10b981',
    fontSize: moderateScale(10),
    fontWeight: 'bold',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dotLeft: {
    width: scale(30),
    height: scale(30),
    borderRadius: moderateScale(15),
    backgroundColor: '#020617',
    marginLeft: scale(-15),
  },
  dotRight: {
    width: scale(30),
    height: scale(30),
    borderRadius: moderateScale(15),
    backgroundColor: '#020617',
    marginRight: scale(-15),
  },
  dashLine: {
    flex: 1,
    height: 1,
    borderWidth: 1,
    borderColor: '#1e293b',
    borderStyle: 'dashed',
    marginHorizontal: scale(10),
  },
  ticketBottom: {
    padding: scale(32),
  },
  participantInfo: {
    gap: verticalScale(20),
    marginBottom: verticalScale(32),
  },
  infoBlock: {
    gap: verticalScale(4),
  },
  label: {
    color: '#64748b',
    fontSize: moderateScale(11),
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  value: {
    color: 'white',
    fontSize: moderateScale(22),
    fontWeight: 'bold',
  },
  securitySection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    padding: scale(12),
    borderRadius: moderateScale(12),
    marginBottom: verticalScale(20),
  },
  securityText: {
    color: '#10b981',
    fontSize: moderateScale(13),
    fontWeight: '600',
  },
  timestamp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  timeText: {
    color: '#64748b',
    fontSize: moderateScale(13),
  },
  instructions: {
    color: '#64748b',
    fontSize: moderateScale(14),
    textAlign: 'center',
    marginTop: verticalScale(32),
    lineHeight: moderateScale(22),
    paddingHorizontal: scale(20),
  },
  doneBtn: {
    backgroundColor: '#3b82f6',
    paddingVertical: verticalScale(18),
    width: '100%',
    borderRadius: moderateScale(20),
    alignItems: 'center',
    marginTop: verticalScale(40),
    marginBottom: verticalScale(20),
  },
  doneBtnText: {
    color: 'white',
    fontSize: moderateScale(16),
    fontWeight: 'bold',
  }
});

export default TicketScreen;
