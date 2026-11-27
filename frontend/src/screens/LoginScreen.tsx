import { eventPalette as palette } from '../components/eventPalette';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { Input, Button } from '../components/ui';
import { ArrowRight } from 'lucide-react-native';
import { BrandMark, EventBanner, eventLayout } from '../components/eventLayout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

const LoginScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (loading) return;
    if (!email.trim() || !password) {
      setError('Enter your email and password to sign in.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) setError(result.error.message);
    } catch {
      setError('Could not reach ZapRoll. Check your connection and try again.');
    } finally {
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
          keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          <EventBanner>
            <BrandMark />
            <Text accessibilityRole="header" style={eventLayout.title}>Sign in</Text>
            <Text style={eventLayout.body}>
              Manage registration and attendance for your events.
            </Text>
          </EventBanner>

          <View>
            <Input 
              label="Email address" keyboardType="email-address" autoCapitalize="none"
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
            
            {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            <Button 
              title={loading ? "Signing In..." : "Sign In"} 
              onPress={handleLogin} 
              disabled={loading}
              icon={!loading && <ArrowRight size={18} color={palette.text} />}
            />

            <TouchableOpacity accessibilityRole="button" style={styles.footer} onPress={() => navigation.navigate('Register')}>
              <Text style={styles.footerText}>New to ZapRoll? <Text style={styles.footerLink}>Create an account</Text></Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  page: { flexGrow: 1, width: '100%', maxWidth: 500, alignSelf: 'center', padding: 20, justifyContent: 'center', gap: 24 },
  error: { color: '#fecaca', marginBottom: 16, fontSize: 15 },
  footer: {
    minHeight: 48,
    justifyContent: 'center',
    marginTop: 12,
  },
  footerText: {
    color: palette.secondary,
    fontSize: 14,
    textAlign: 'center',
  },
  footerLink: {
    color: palette.blue.ink,
    fontWeight: 'bold',
  },
});

export default LoginScreen;
