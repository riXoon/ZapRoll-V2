import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Share, ScrollView, Platform, Image } from 'react-native';
import { FeedbackModal } from '../components/FeedbackModal';
import { ArrowLeft, Download, Share2, ShieldCheck, Lock, Sun, Moon, CheckCircle, Globe, Briefcase, Users, Award } from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import ViewShot from "react-native-view-shot";
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';

const QRGeneratorScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const qrRef = useRef<any>();
  const viewShotRef = useRef<any>();
  const { roleName, title, capacity, url, showControls, type, eventName, venue, eventDate, isPreReg } = route.params || { roleName: 'General', capacity: '100', eventName: 'Synergy 2026' };
  const isUrlMode = !!url;
  const [isDownloading, setIsDownloading] = useState(false);

  // Feedback Modal State
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackConfig, setFeedbackConfig] = useState<{
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'confirm';
    onConfirm?: () => void;
  }>({
    title: '',
    message: '',
    type: 'info'
  });

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' | 'confirm' = 'info', onConfirm?: () => void) => {
    setFeedbackConfig({ title, message, type, onConfirm });
    setFeedbackVisible(true);
  };

  // Session Control States
  const [isOpen, setIsOpen] = useState(route.params?.isOpen !== false);


  // Data to be encoded in the QR Code
  const qrData = isUrlMode ? url : JSON.stringify({
    role: roleName,
    type: type,
    eventId: 'SYNERGY_2026',
    timestamp: new Date().toISOString()
  });

  const handleShare = async () => {
    try {
      await Share.share({
        message: `ZapRoll Event Access Code for ${roleName || title || 'the event'}. Scan this code during registration.`,
      });
    } catch (error) {
      console.log(error);
    }
  };

  const handleDownload = async () => {
    if (!isOpen) {
      showAlert("Access Denied", "Enable the session first before downloading the QR code.", "error");
      return;
    }

    try {
      setIsDownloading(true);
      
      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        showAlert("Permission Required", "Please allow access to your gallery to save the QR code.", "error");
        setIsDownloading(false);
        return;
      }

      // Capture the view
      const uri = await viewShotRef.current.capture();
      
      // Save to media library
      const asset = await MediaLibrary.createAssetAsync(uri);
      await MediaLibrary.createAlbumAsync('ZapRoll QRs', asset, false);

      showAlert(
        "Saved to Gallery",
        `The ${roleName || title || 'registration'} access card has been saved to your 'ZapRoll QRs' album.`,
        "success"
      );
    } catch (error) {
      console.log(error);
      showAlert("Download Error", "Something went wrong while saving the image.", "error");
    } finally {
      setIsDownloading(false);
    }
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
        <Text style={styles.headerTitle}>Access QR Code</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
        <Animated.View entering={FadeInUp.delay(100)} style={styles.roleInfo}>
          <Text style={styles.roleLabel}>{isUrlMode ? 'DESTINATION LINK' : 'PARTICIPANT ROLE'}</Text>
          <Text style={[
            styles.roleName, 
            isUrlMode && { 
              fontSize: 16, 
              color: type?.includes('pm') ? '#8b5cf6' : type?.includes('employee') ? '#10b981' : type?.includes('guest') ? '#f59e0b' : type?.includes('poster') ? '#ec4899' : '#3b82f6' 
            }
          ]}>{isUrlMode ? (url || 'No URL') : (roleName || title || 'General')}</Text>
          {!isUrlMode && (
            <View style={[
              styles.badge,
              type?.includes('pm') && { backgroundColor: 'rgba(139, 92, 246, 0.1)', borderColor: 'rgba(139, 92, 246, 0.2)' },
              type?.includes('employee') && { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)' },
              type?.includes('guest') && { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.2)' },
              type?.includes('poster') && { backgroundColor: 'rgba(236, 72, 153, 0.1)', borderColor: 'rgba(236, 72, 153, 0.2)' }
            ]}>
              <Text style={[
                styles.badgeText,
                type?.includes('pm') && { color: '#8b5cf6' },
                type?.includes('employee') && { color: '#10b981' },
                type?.includes('guest') && { color: '#f59e0b' },
                type?.includes('poster') && { color: '#ec4899' }
              ]}>{capacity} Slots Allocated</Text>
            </View>
          )}
        </Animated.View>

        {/* REAL QR Code Container */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.qrContainer}>
          {isOpen ? (
            <View style={[
              styles.qrFrame,
              { 
                shadowColor: type?.includes('pm') ? '#8b5cf6' : type?.includes('employee') ? '#10b981' : type?.includes('guest') ? '#f59e0b' : type?.includes('poster') ? '#ec4899' : '#3b82f6',
                borderColor: type?.includes('pm') ? 'rgba(139, 92, 246, 0.3)' : type?.includes('employee') ? 'rgba(16, 185, 129, 0.3)' : type?.includes('guest') ? 'rgba(245, 158, 11, 0.3)' : type?.includes('poster') ? 'rgba(236, 72, 153, 0.3)' : '#1e293b'
              }
            ]}>
              <View style={[
                styles.qrBackground,
                { borderColor: type?.includes('pm') ? 'rgba(139, 92, 246, 0.2)' : type?.includes('employee') ? 'rgba(16, 185, 129, 0.2)' : type?.includes('guest') ? 'rgba(245, 158, 11, 0.2)' : type?.includes('poster') ? 'rgba(236, 72, 153, 0.2)' : '#1e293b' }
              ]}>
                <QRCode
                  value={qrData}
                  size={200}
                  color="white"
                  backgroundColor="transparent"
                  logoSize={50}
                  logoMargin={2}
                  logoBorderRadius={15}
                  getRef={(c) => (qrRef.current = c)}
                />
              </View>
            </View>
          ) : (
            <View style={[styles.qrFrame, { borderColor: '#ef4444', borderStyle: 'dashed' }]}>
              <View style={{ alignItems: 'center', gap: 12 }}>
                <Lock color="#ef4444" size={48} />
                <Text style={{ color: '#ef4444', fontWeight: 'bold', textAlign: 'center' }}>
                  ACCESS RESTRICTED
                </Text>
                <Text style={{ color: '#64748b', fontSize: 12, textAlign: 'center', paddingHorizontal: 20 }}>
                  This session is currently disabled. Please enable it in the Event Settings to generate the active QR code.
                </Text>
              </View>
            </View>
          )}
          
          {isOpen && (
            <View style={styles.statusRow}>
              <ShieldCheck color="#10b981" size={16} />
              <Text style={styles.statusText}>Securely Generated & Encrypted</Text>
            </View>
          )}
        </Animated.View>



        {/* Actions */}
        <Animated.View entering={FadeInDown.delay(300)} style={styles.actions}>
          <TouchableOpacity 
            onPress={handleDownload} 
            style={[
              styles.downloadBtn, 
              { 
                backgroundColor: type?.includes('pm') ? '#8b5cf6' : type?.includes('employee') ? '#10b981' : type?.includes('guest') ? '#f59e0b' : type?.includes('poster') ? '#ec4899' : '#3b82f6',
                shadowColor: type?.includes('pm') ? '#8b5cf6' : type?.includes('employee') ? '#10b981' : type?.includes('guest') ? '#f59e0b' : type?.includes('poster') ? '#ec4899' : '#3b82f6'
              }
            ]}
          >
            <Download color="white" size={20} />
            <Text style={styles.btnText}>Download PNG</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={handleShare} 
            style={[
              styles.shareBtn, 
              {
                borderColor: type?.includes('pm') ? 'rgba(139, 92, 246, 0.2)' : type?.includes('employee') ? 'rgba(16, 185, 129, 0.2)' : type?.includes('guest') ? 'rgba(245, 158, 11, 0.2)' : type?.includes('poster') ? 'rgba(236, 72, 153, 0.2)' : 'rgba(59, 130, 246, 0.2)'
              }
            ]}
          >
            <Share2 color={type?.includes('pm') ? '#8b5cf6' : type?.includes('employee') ? '#10b981' : type?.includes('guest') ? '#f59e0b' : type?.includes('poster') ? '#ec4899' : '#3b82f6'} size={20} />
            <Text style={[
              styles.shareText, 
              { color: type?.includes('pm') ? '#8b5cf6' : type?.includes('employee') ? '#10b981' : type?.includes('guest') ? '#f59e0b' : type?.includes('poster') ? '#ec4899' : '#3b82f6' }
            ]}>Share to Team</Text>
          </TouchableOpacity>
        </Animated.View>

        <Text style={styles.disclaimer}>
          {isUrlMode 
            ? "When participants scan this, they will be redirected to the evaluation form in their mobile browser."
            : route.params?.isWalkIn 
              ? "Participants can scan this QR code at the venue entrance to access the digital walk-in registration form."
              : `This QR code is unique to the ${roleName || title || 'selected'} role. Once scanned during pre-registration, it will validate participant eligibility.`}
        </Text>
        </View>
      </ScrollView>

      {/* HIDDEN PROFESSIONAL EXPORT TEMPLATE */}
      <View style={styles.hiddenContainer} pointerEvents="none">
        <ViewShot ref={viewShotRef} options={{ format: "png", quality: 1.0 }}>
            <View style={[
              styles.exportCard, 
              { 
                borderColor: type?.includes('pm') ? '#8b5cf6' : type?.includes('employee') ? '#10b981' : type?.includes('guest') ? '#f59e0b' : type?.includes('poster') ? '#ec4899' : '#3b82f6' 
              }
            ]}>
              <View style={styles.exportHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Image 
                    source={require('../../assets/Synergy-01.png')} 
                    style={styles.exportLogo}
                    resizeMode="contain"
                  />
                  <View>
                    <Text style={styles.exportBrand}>SYNERGY</Text>
                    <Text style={[
                      styles.exportEvent, 
                      { 
                        color: type?.includes('pm') ? '#8b5cf6' : type?.includes('employee') ? '#10b981' : type?.includes('guest') ? '#f59e0b' : type?.includes('poster') ? '#ec4899' : '#3b82f6' 
                      }
                    ]}>{eventName}</Text>
                  </View>
                </View>
                {type?.includes('am') ? <Sun color="#3b82f6" size={24} /> : 
                 type?.includes('pm') ? <Moon color="#8b5cf6" size={24} /> : 
                 type?.includes('employee') ? <Briefcase color="#10b981" size={24} /> : 
                 type?.includes('guest') ? <Users color="#f59e0b" size={24} /> : 
                 type?.includes('poster') ? <Award color="#ec4899" size={24} /> : 
                 type === 'external-reg' ? <Globe color="#3b82f6" size={24} /> :
                 <Sun color="#3b82f6" size={24} />}
              </View>

              <View style={styles.exportBody}>
                <View style={styles.exportQrWrapper}>
                  <QRCode
                    value={qrData}
                    size={240}
                    color="black"
                    backgroundColor="white"
                  />
                </View>
                
                <View style={styles.exportInfo}>
                  <Text style={styles.exportRoleLabel}>ACCESS PURPOSE</Text>
                  <Text style={[styles.exportRoleName, { color: type?.includes('pm') ? '#8b5cf6' : type?.includes('employee') ? '#10b981' : type?.includes('guest') ? '#f59e0b' : type?.includes('poster') ? '#ec4899' : '#3b82f6' }]}>
                    {(() => {
                      const baseName = (roleName || title || 'PUBLIC').trim();
                      const upperBase = baseName.toUpperCase();
                      if (isPreReg || type === 'pre-reg') {
                        if (upperBase.endsWith('PRE-REGISTRATION')) return upperBase;
                        if (upperBase.endsWith('REGISTRATION')) {
                          return upperBase.replace(/REGISTRATION$/, 'PRE-REGISTRATION');
                        }
                        return `${upperBase} PRE-REGISTRATION`;
                      }
                      if (type?.includes('-reg') || type?.includes('guest')) {
                        if (upperBase.endsWith('REGISTRATION')) return upperBase;
                        return `${upperBase} REGISTRATION`;
                      }
                      return upperBase;
                    })()}
                  </Text>
                  <View style={[styles.exportDivider, { backgroundColor: type?.includes('pm') ? '#8b5cf6' : type?.includes('employee') ? '#10b981' : type?.includes('guest') ? '#f59e0b' : type?.includes('poster') ? '#ec4899' : '#3b82f6' }]} />
                  <Text style={styles.exportDisclaimer}>
                    {isPreReg || type === 'pre-reg'
                      ? "Scan this QR code to reserve your slot. This is for pre-registration purposes only; on-site registration is still required on the day of the event."
                      : type?.includes('-eval')
                        ? "Scan this code to access the evaluation form. Your feedback is essential for the continuous improvement of our conference sessions."
                        : `Scan this QR code to access the digital registration form for ${roleName || title || 'the event'}. Please ensure a stable internet connection.`}
                  </Text>
                </View>
              </View>

              <View style={styles.exportFooter}>
                <View style={{ alignItems: 'center', width: '100%' }}>
                  <Text style={styles.footerText}>
                    <Text style={styles.footerHighlight}>SYNERGY 2026</Text> • POWERED BY <Text style={styles.footerHighlight}>ZAPROLL</Text>
                  </Text>
                  <Text style={styles.footerDevText}>
                    Developed by Adrian Frivaldo & Erickson Guhilde
                  </Text>
                </View>
              </View>
            </View>
        </ViewShot>
      </View>

      <FeedbackModal
        visible={feedbackVisible}
        title={feedbackConfig.title}
        message={feedbackConfig.message}
        type={feedbackConfig.type}
        onConfirm={feedbackConfig.onConfirm}
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
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    padding: 32,
    alignItems: 'center',
  },
  roleInfo: {
    alignItems: 'center',
    marginBottom: 40,
  },
  roleLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 8,
  },
  roleName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 12,
  },
  badge: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  badgeText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  qrFrame: {
    width: 280,
    height: 280,
    backgroundColor: '#0f172a',
    borderRadius: 40,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  qrBackground: {
    padding: 16,
    backgroundColor: '#020617',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 8,
  },
  statusText: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: '500',
  },
  actions: {
    width: '100%',
    gap: 16,
  },
  downloadBtn: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 20,
    gap: 12,
  },
  btnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    backgroundColor: '#0f172a',
    gap: 12,
  },
  shareText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disclaimer: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 32,
    lineHeight: 18,
  },
  controlsCard: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#020617',
    padding: 12,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  controlLabel: {
    color: 'white',
    fontSize: 13,
    fontWeight: 'bold',
  },
  controlSubtitle: {
    color: '#64748b',
    fontSize: 11,
  },
  toggleBtn: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
  },
  toggleCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'white',
  },
  inputLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 6,
    marginLeft: 4,
  },
  pickerInput: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  pickerText: {
    color: 'white',
    fontSize: 14,
  },
  // Export Template Styles
  hiddenContainer: {
    position: 'absolute',
    left: -1000, // Off-screen
    width: 400,
  },
  exportCard: {
    width: 400,
    backgroundColor: '#020617',
    padding: 30,
    borderRadius: 0,
    borderWidth: 8,
    borderColor: '#3b82f6',
  },
  exportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingBottom: 20,
  },
  exportLogo: {
    width: 60,
    height: 60,
  },
  exportBrand: {
    fontSize: 28,
    fontWeight: '900',
    color: 'white',
    letterSpacing: 4,
  },
  exportEvent: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '700',
    marginTop: 2,
  },
  exportBody: {
    alignItems: 'center',
  },
  exportQrWrapper: {
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 24,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  exportInfo: {
    alignItems: 'center',
    width: '100%',
  },
  exportDivider: {
    width: 80,
    height: 4,
    backgroundColor: '#3b82f6',
    marginVertical: 20,
    borderRadius: 2,
  },
  exportDisclaimer: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
    fontWeight: '500',
  },
  exportFooter: {
    marginTop: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingTop: 20,
  },
  exportRoleLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 8,
  },
  exportRoleName: {
    fontSize: 24,
    fontWeight: '900',
    color: 'white',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  footerText: {
    fontSize: 9,
    color: '#475569',
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 6,
  },
  footerHighlight: {
    color: '#64748b',
    fontWeight: 'bold',
  },
  footerDevText: {
    fontSize: 10,
    color: 'white',
    fontWeight: 'bold',
    letterSpacing: 0.8,
    opacity: 0.6,
  },
});

export default QRGeneratorScreen;
