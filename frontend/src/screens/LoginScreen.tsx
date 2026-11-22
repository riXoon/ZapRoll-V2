import React, { useState } from 'react';
import { View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Image } from 'react-native';
import { FeedbackModal } from '../components/FeedbackModal';
import { Input, Button } from '../components/ui';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { scale, verticalScale, moderateScale } from '../utils/responsive';

const LoginScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert('Error', 'Please fill in all fields', 'error');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      showAlert('Login Error', error.message, 'error');
      setLoading(false);
    } else {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: scale(32), paddingTop: verticalScale(48) }}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.delay(200).duration(800)}>
            <View style={styles.iconContainer}>
              <Image 
                source={require('../../assets/Synergy-01.png')} 
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>
              Sign in to continue your synergy journey
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(400).duration(800)}>
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
            
            <TouchableOpacity style={styles.forgotPass}>
              <Text style={styles.linkText}>Forgot Password?</Text>
            </TouchableOpacity>

            <Button 
              title={loading ? "Signing In..." : "Sign In"} 
              onPress={handleLogin} 
              disabled={loading}
            />

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.footerLink}>Sign Up</Text>
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
  iconContainer: {
    width: scale(80),
    height: scale(80),
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: moderateScale(20),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(32),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  logo: {
    width: '80%',
    height: '80%',
  },
  title: {
    fontSize: moderateScale(36),
    fontWeight: 'bold',
    color: 'white',
    marginBottom: verticalScale(8),
  },
  subtitle: {
    fontSize: moderateScale(18),
    color: '#94a3b8',
    marginBottom: verticalScale(40),
  },
  forgotPass: {
    alignItems: 'flex-end',
    marginBottom: verticalScale(32),
  },
  linkText: {
    color: '#3b82f6',
    fontSize: moderateScale(14),
    fontWeight: '500',
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: verticalScale(48),
    marginBottom: verticalScale(32),
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
});

export default LoginScreen;
