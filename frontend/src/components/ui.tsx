import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, KeyboardTypeOptions } from 'react-native';
import { scale, verticalScale, moderateScale } from '../utils/responsive';

interface InputProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

export const Input = ({ 
  label, 
  placeholder, 
  value, 
  onChangeText, 
  secureTextEntry, 
  keyboardType, 
  autoCapitalize 
}: InputProps) => (
  <View style={styles.inputWrapper}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.inputContainer}>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor="#475569"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        style={styles.input}
      />
    </View>
  </View>
);

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
}

export const Button = ({ title, onPress, variant = 'primary', disabled }: ButtonProps) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.8}
    disabled={disabled}
    style={[
      styles.button,
      variant === 'primary' ? styles.buttonPrimary : styles.buttonSecondary,
      disabled && styles.buttonDisabled
    ]}
  >
    <Text style={[
      styles.buttonText,
      variant === 'primary' ? styles.textWhite : styles.textSlate,
      disabled && styles.textDisabled
    ]}>
      {title}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  inputWrapper: {
    marginBottom: verticalScale(20),
  },
  label: {
    color: '#94a3b8',
    fontSize: moderateScale(14),
    marginBottom: verticalScale(8),
    fontWeight: '500',
    marginLeft: scale(4),
  },
  inputContainer: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: moderateScale(16),
    paddingHorizontal: scale(16),
    paddingVertical: Platform.OS === 'ios' ? verticalScale(14) : verticalScale(10),
  },
  input: {
    color: 'white',
    fontSize: moderateScale(16),
    minHeight: verticalScale(24),
  },
  button: {
    paddingVertical: verticalScale(16),
    borderRadius: moderateScale(16),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: verticalScale(4) },
    shadowOpacity: 0.3,
    shadowRadius: moderateScale(8),
    elevation: 4,
  },
  buttonPrimary: {
    backgroundColor: '#2563eb',
  },
  buttonSecondary: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  buttonText: {
    fontSize: moderateScale(18),
    fontWeight: 'bold',
  },
  textWhite: {
    color: 'white',
  },
  textSlate: {
    color: '#e2e8f0',
  },
  buttonDisabled: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    shadowOpacity: 0,
    elevation: 0,
    opacity: 0.5,
  },
  textDisabled: {
    color: '#64748b',
  },
});
