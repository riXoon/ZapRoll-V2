import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated as RNAnimated } from 'react-native';
import { 
  Maximize, 
  Zap, 
  Info, 
  X, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  UserPlus
} from 'lucide-react-native';
import Animated, { FadeIn, FadeOut, SlideInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const ScannerScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const [isScanning, setIsScanning] = useState(true);
  const [scanResult, setScanResult] = useState<'success' | 'walkin' | 'error' | null>(null);
  const [flash, setFlash] = useState(false);

  // Simulation of the "TimeGate" (Check if before 8:45 AM)
  const isEarly = true; // This would be dynamic in production

  const handleScan = (type: 'valid' | 'invalid' | 'late') => {
    setIsScanning(false);
    if (type === 'valid') {
      setScanResult('success');
      // After 2 seconds, show the ticket or reset
      setTimeout(() => navigation.navigate('Ticket', { name: 'Erickson Guhilde', role: 'Student' }), 1500);
    } else if (type === 'late' || type === 'invalid') {
      setScanResult('walkin');
    } else {
      setScanResult('error');
    }
  };

  const resetScanner = () => {
    setScanResult(null);
    setIsScanning(true);
  };

  return (
    <View style={styles.container}>
      {/* Simulated Camera Viewfinder */}
      <View style={styles.viewfinder}>
        <View style={[styles.scannerOverlay, { paddingTop: insets.top + 20 }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.navigate('WalkInSelection')} style={styles.walkinEntryBtn}>
              <UserPlus color="white" size={20} />
              <Text style={styles.walkinEntryText}>Walk-In</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setFlash(!flash)} style={styles.iconBtn}>
              <Zap color={flash ? "#f59e0b" : "white"} size={24} fill={flash ? "#f59e0b" : "transparent"} />
            </TouchableOpacity>
          </View>

          <View style={styles.targetContainer}>
            <View style={styles.targetBox}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
              
              {isScanning && (
                <RNAnimated.View style={styles.scanLine} />
              )}
            </View>
            <Text style={styles.hintText}>Center the QR code within the frame</Text>
          </View>

          {/* Test Triggers (For development simulation) */}
          <View style={styles.testActions}>
            <TouchableOpacity onPress={() => handleScan('valid')} style={styles.testBtn}>
              <Text style={styles.testBtnText}>Valid Scan</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleScan('late')} style={[styles.testBtn, { backgroundColor: '#f59e0b' }]}>
              <Text style={styles.testBtnText}>Late/Walk-In</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <View style={styles.infoBadge}>
              <Clock color="#3b82f6" size={16} />
              <Text style={styles.infoText}>TimeGate: {isEarly ? 'Active (Pre-Reg)' : 'Closed (Walk-In Only)'}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Result Overlays */}
      {scanResult === 'success' && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.resultOverlay}>
          <View style={[styles.resultCard, { borderColor: '#10b981' }]}>
            <CheckCircle2 color="#10b981" size={80} />
            <Text style={styles.resultTitle}>Access Granted</Text>
            <Text style={styles.resultSub}>Pre-Registered: Erickson Guhilde</Text>
          </View>
        </Animated.View>
      )}

      {scanResult === 'walkin' && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.resultOverlay}>
          <View style={[styles.resultCard, { borderColor: '#f59e0b' }]}>
            <AlertCircle color="#f59e0b" size={80} />
            <Text style={styles.resultTitle}>Walk-In Required</Text>
            <Text style={styles.resultSub}>ID not found or Entry is Late.</Text>
            <TouchableOpacity 
              onPress={() => {
                resetScanner();
                navigation.navigate('WalkInSelection');
              }}
              style={styles.actionBtn}
            >
              <Text style={styles.actionBtnText}>Open Walk-In Form</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={resetScanner} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  viewfinder: {
    flex: 1,
    backgroundColor: '#1e293b', // Simulated camera background
  },
  scannerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'space-between',
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  walkinEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  walkinEntryText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetContainer: {
    alignItems: 'center',
  },
  targetBox: {
    width: width * 0.7,
    height: width * 0.7,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#3b82f6',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 20,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 20,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 20,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 20,
  },
  scanLine: {
    position: 'absolute',
    width: '100%',
    height: 2,
    backgroundColor: '#3b82f6',
    top: '50%',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  hintText: {
    color: 'white',
    marginTop: 30,
    fontSize: 16,
    opacity: 0.8,
  },
  testActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 20,
  },
  testBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  testBtnText: {
    color: 'white',
    fontWeight: 'bold',
  },
  footer: {
    alignItems: 'center',
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  infoText: {
    color: '#3b82f6',
    fontSize: 13,
    fontWeight: 'bold',
  },
  resultOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(2, 6, 23, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  resultCard: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 32,
    padding: 40,
    alignItems: 'center',
    borderWidth: 2,
  },
  resultTitle: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 20,
    textAlign: 'center',
  },
  resultSub: {
    color: '#94a3b8',
    fontSize: 16,
    marginTop: 10,
    textAlign: 'center',
    marginBottom: 30,
  },
  actionBtn: {
    backgroundColor: '#3b82f6',
    paddingVertical: 18,
    width: '100%',
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  actionBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelBtn: {
    paddingVertical: 12,
  },
  cancelBtnText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: 'bold',
  }
});

export default ScannerScreen;
