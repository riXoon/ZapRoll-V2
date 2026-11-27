import React from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { styles } from './eventSettingsStyles';

export function SettingsHeading({ icon: Icon, title, color = '#3b82f6' }: {
  icon: LucideIcon; title: string; color?: string;
}) {
  const small = useWindowDimensions().width < 420;
  return <View style={[styles.cardHeaderLeft, { flexShrink: 1 }]}>
    <Icon color={color} size={small ? 18 : 20} />
    <Text accessibilityRole="header" style={[styles.cardTitle, { flexShrink: 1 }, small && { fontSize: 16 }]}>{title}</Text>
  </View>;
}
