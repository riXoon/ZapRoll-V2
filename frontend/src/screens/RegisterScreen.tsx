import React, { useState } from 'react';
import { View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Image } from 'react-native';
import { FeedbackModal } from '../components/FeedbackModal';
import { Input, Button } from '../components/ui';
import { ArrowLeft } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { scale, verticalScale, moderateScale } from '../utils/responsive';

const RegisterScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

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

  const validateEmail = (emailStr: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailStr.trim());
  };

  const validatePassword = (passStr: string) => {
    const minLength = passStr.length >= 8;
    const hasUpper = /[A-Z]/.test(passStr);
    const hasLower = /[a-z]/.test(passStr);
    const hasNumber = /[0-9]/.test(passStr);
    const hasSpecial = /[^A-Za-z0-9]/.test(passStr);

    return {
      isValid: minLength && hasUpper && hasLower && hasNumber && hasSpecial,
      minLength,
      hasUpper,
      hasLower,
      hasNumber,
      hasSpecial
    };
  };

  const getPasswordStrength = (passStr: string) => {
    if (!passStr) return { score: 0, label: '', color: '#475569', criteria: { minLength: false, hasUpper: false, hasLower: false, hasNumber: false, hasSpecial: false } };

    const criteria = validatePassword(passStr);
    let score = 0;
    if (criteria.minLength) score += 1;
    if (criteria.hasUpper) score += 1;
    if (criteria.hasLower) score += 1;
    if (criteria.hasNumber) score += 1;
    if (criteria.hasSpecial) score += 1;

    let label = 'Weak';
    let color = '#ef4444'; // Red 500
    if (score === 3) {
      label = 'Fair';
      color = '#f97316'; // Orange 500
    } else if (score === 4) {
      label = 'Good';
      color = '#eab308'; // Yellow 500
    } else if (score === 5) {
      label = 'Strong';
      color = '#10b981'; // Emerald 500
    }

    return {
      score,
      label,
      color,
      criteria
    };
  };

  const handleRegister = async () => {
    if (!name || !email || !password || !confirmPassword || !organization) {
      showAlert('Error', 'Please fill in all fields', 'error');
      return;
    }

    if (password !== confirmPassword) {
      showAlert('Error', 'Passwords do not match.', 'error');
      return;
    }

    if (!validateEmail(email)) {
      showAlert('Invalid Email', 'Please enter a valid email address.', 'error');
      return;
    }

    const passCheck = validatePassword(password);
    if (!passCheck.isValid) {
      const requirements = [];
      if (!passCheck.minLength) requirements.push('• Be at least 8 characters long');
      if (!passCheck.hasUpper) requirements.push('• Contain at least one uppercase letter (A-Z)');
      if (!passCheck.hasLower) requirements.push('• Contain at least one lowercase letter (a-z)');
      if (!passCheck.hasNumber) requirements.push('• Contain at least one digit (0-9)');
      if (!passCheck.hasSpecial) requirements.push('• Contain at least one special character');

      showAlert(
        'Weak Password',
        `Your password must meet the following requirements:\n\n${requirements.join('\n')}`,
        'error'
      );
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          organization: organization,
        },
      },
    });

    if (error) {
      showAlert('Registration Error', error.message, 'error');
      setLoading(false);
    } else {
      setLoading(false);
      showAlert('Success', 'Account created successfully! Please sign in.', 'success', () => {
        navigation.navigate('Login');
      });
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: scale(32), paddingTop: verticalScale(24) }}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.delay(200).duration(800)}>
            <TouchableOpacity 
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <ArrowLeft color="white" size={moderateScale(20)} />
            </TouchableOpacity>

            <View style={styles.iconContainer}>
              <Image 
                source={require('../../assets/Synergy-01.png')} 
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              Join the synergy community and start managing events with ease.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(400).duration(800)}>
            <Input 
              label="Full Name"
              placeholder="John Doe"
              value={name}
              onChangeText={setName}
            />
            <Input 
              label="Organization"
              placeholder="e.g. University of Science"
              value={organization}
              onChangeText={setOrganization}
            />
            <Input 
              label="Email Address"
              placeholder="name@school.edu"
              value={email}
              onChangeText={setEmail}
            />
            <Input 
              label="Password"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            {password.length > 0 && (() => {
              const strength = getPasswordStrength(password);
              return (
                <View style={styles.strengthContainer}>
                  <View style={styles.strengthHeader}>
                    <Text style={styles.strengthLabel}>Password Strength: </Text>
                    <Text style={[styles.strengthValue, { color: strength.color }]}>
                      {strength.label}
                    </Text>
                  </View>
                  <View style={styles.progressBarContainer}>
                    <View 
                      style={[
                        styles.progressBar, 
                        { 
                          width: `${(strength.score / 5) * 100}%`, 
                          backgroundColor: strength.color 
                        }
                      ]} 
                    />
                  </View>
                  <View style={styles.requirementsList}>
                    <Text style={[styles.requirementItem, { color: strength.criteria.minLength ? '#10b981' : '#64748b' }]}>
                      {strength.criteria.minLength ? '✓' : '•'} At least 8 characters
                    </Text>
                    <Text style={[styles.requirementItem, { color: strength.criteria.hasUpper ? '#10b981' : '#64748b' }]}>
                      {strength.criteria.hasUpper ? '✓' : '•'} At least one uppercase letter (A-Z)
                    </Text>
                    <Text style={[styles.requirementItem, { color: strength.criteria.hasLower ? '#10b981' : '#64748b' }]}>
                      {strength.criteria.hasLower ? '✓' : '•'} At least one lowercase letter (a-z)
                    </Text>
                    <Text style={[styles.requirementItem, { color: strength.criteria.hasNumber ? '#10b981' : '#64748b' }]}>
                      {strength.criteria.hasNumber ? '✓' : '•'} At least one digit (0-9)
                    </Text>
                    <Text style={[styles.requirementItem, { color: strength.criteria.hasSpecial ? '#10b981' : '#64748b' }]}>
                      {strength.criteria.hasSpecial ? '✓' : '•'} At least one special character
                    </Text>
                  </View>
                </View>
              );
            })()}
            <Input 
              label="Confirm Password"
              placeholder="••••••••"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />

            <View style={styles.termsContainer}>
              <Text style={styles.termsText}>By signing up, you agree to our </Text>
              <TouchableOpacity>
                <Text style={styles.termsLink}>Terms of Service</Text>
              </TouchableOpacity>
            </View>

            <Button 
              title={loading ? "Creating Account..." : "Create Account"} 
              onPress={handleRegister} 
              disabled={loading}
            />

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.footerLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

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
    backgroundColor: '#020617', // slate-950
  },
  backButton: {
    width: scale(44),
    height: scale(44),
    backgroundColor: '#0f172a',
    borderRadius: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(32),
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  iconContainer: {
    width: scale(80),
    height: scale(80),
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: moderateScale(20),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(24),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  logo: {
    width: '80%',
    height: '80%',
  },
  title: {
    fontSize: moderateScale(32),
    fontWeight: 'bold',
    color: 'white',
    marginBottom: verticalScale(8),
  },
  subtitle: {
    fontSize: moderateScale(16),
    color: '#94a3b8',
    marginBottom: verticalScale(32),
    lineHeight: moderateScale(24),
  },
  termsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: verticalScale(32),
    paddingHorizontal: scale(4),
  },
  termsText: {
    color: '#64748b',
    fontSize: moderateScale(13),
  },
  termsLink: {
    color: '#3b82f6',
    fontSize: moderateScale(13),
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: verticalScale(40),
    marginBottom: verticalScale(40),
  },
  footerText: {
    color: '#94a3b8',
    fontSize: moderateScale(14),
  },
  footerLink: {
    color: '#3b82f6',
    fontSize: moderateScale(14),
    fontWeight: 'bold',
  },
  strengthContainer: {
    marginBottom: verticalScale(20),
    paddingHorizontal: scale(4),
  },
  strengthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(8),
  },
  strengthLabel: {
    fontSize: moderateScale(12),
    color: '#94a3b8',
  },
  strengthValue: {
    fontSize: moderateScale(12),
    fontWeight: 'bold',
  },
  progressBarContainer: {
    height: verticalScale(4),
    backgroundColor: '#1e293b',
    borderRadius: moderateScale(2),
    overflow: 'hidden',
    marginBottom: verticalScale(12),
  },
  progressBar: {
    height: '100%',
    borderRadius: moderateScale(2),
  },
  requirementsList: {
    gap: verticalScale(4),
  },
  requirementItem: {
    fontSize: moderateScale(12),
    lineHeight: moderateScale(16),
  },
});

export default RegisterScreen;
