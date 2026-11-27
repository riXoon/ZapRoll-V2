import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { eventPalette as palette } from './eventPalette';

export const eventLayout = StyleSheet.create({
  frame: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 20 },
  title: { color: palette.text, fontSize: 32, fontWeight: '700', letterSpacing: -1 },
  sectionTitle: { color: palette.text, fontSize: 19, fontWeight: '700', letterSpacing: -0.3 },
  body: { color: palette.secondary, fontSize: 14, lineHeight: 21 },
  panel: { backgroundColor: palette.surface, borderColor: palette.edge, borderWidth: 1, borderRadius: 18 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  detailTitle: { color: palette.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.5, flexShrink: 1 },
  iconButton: {
    minWidth: 48, minHeight: 48, flexShrink: 0, alignItems: 'center', justifyContent: 'center',
    backgroundColor: palette.surface, borderColor: palette.edge, borderWidth: 1, borderRadius: 14,
  },
});

export function BrandMark() {
  return (
    <View style={styles.brand}>
      <Image source={require('../../assets/icon.png')} style={styles.mark} resizeMode="contain" />
      <Text style={styles.wordmark}>ZapRoll</Text>
    </View>
  );
}

export function EventBanner({ children }: React.PropsWithChildren) {
  return (
    <View style={styles.banner}>
      <View pointerEvents="none" style={styles.pattern}>
        <View style={styles.square}><View style={styles.squareCenter} /></View>
        <View style={[styles.square, styles.squareOffset]}><View style={styles.squareCenter} /></View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 32, height: 32, borderRadius: 9 },
  wordmark: { color: palette.text, fontWeight: '700', fontSize: 17, letterSpacing: -0.35 },
  banner: {
    backgroundColor: palette.blue.surface, borderColor: palette.blue.edge, borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22, padding: 20, gap: 12, overflow: 'hidden',
  },
  pattern: { position: 'absolute', top: -34, right: -28, opacity: 0.16, transform: [{ rotate: '-12deg' }] },
  square: { width: 118, height: 118, borderWidth: 2, borderColor: palette.blue.ink, borderRadius: 24, padding: 18 },
  squareCenter: { flex: 1, borderWidth: 2, borderColor: palette.blue.ink, borderRadius: 12 },
  squareOffset: { marginTop: -32, marginLeft: 54 },
});
