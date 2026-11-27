import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { styles } from './eventSettingsStyles';
import { eventPalette as palette } from './eventPalette';

export function SettingsHeading({ icon: Icon, title, color = palette.blue.ink }: {
  icon: LucideIcon; title: string; color?: string;
}) {
  return <View style={[styles.cardHeaderLeft, { flexShrink: 1 }]}>
    <View style={headingStyles.icon}><Icon color={color} size={18} /></View>
    <Text accessibilityRole="header" style={[styles.cardTitle, headingStyles.title]}>{title}</Text>
  </View>;
}

const headingStyles = StyleSheet.create({
  icon: { width: 34, height: 34, borderRadius: 9, backgroundColor: palette.blue.surface, alignItems: 'center', justifyContent: 'center' },
  title: { flexShrink: 1 },
});
