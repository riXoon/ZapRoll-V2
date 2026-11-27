import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardTypeOptions } from 'react-native';
import { eventPalette as palette } from './eventPalette';

interface InputProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  editable?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoFocus?: boolean;
}

export const Input = ({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  editable,
  keyboardType,
  autoCapitalize,
  autoFocus,
}: InputProps) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.inputWrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputContainer, focused && styles.inputFocused]}>
        <TextInput
          placeholder={placeholder}
          accessibilityLabel={label}
          editable={editable}
          placeholderTextColor="#94a3b8"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.input}
        />
      </View>
    </View>
  );
};

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export const Button = ({ title, onPress, variant = 'primary', disabled, icon }: ButtonProps) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.8}
    accessibilityRole="button"
    accessibilityLabel={title}
    accessibilityState={{ disabled: !!disabled }}
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
    {icon}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  inputWrapper: {
    marginBottom: 16,
  },
  label: {
    color: palette.secondary,
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '600',
  },
  inputContainer: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
  },
  inputFocused: {
    borderColor: palette.blue.edge,
  },
  input: {
    color: palette.text,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  button: {
    minHeight: 50,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: palette.primary,
  },
  buttonSecondary: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: '#334155',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'center',
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
  },
  textDisabled: {
    color: '#94a3b8',
  },
});
