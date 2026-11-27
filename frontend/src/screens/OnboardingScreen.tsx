import React, { useRef, useState } from 'react';
import { FlatList, Image, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark, eventLayout } from '../components/eventLayout';
import { eventPalette as palette } from '../components/eventPalette';
import { Button } from '../components/ui';

const slides = [
  {
    id: 'welcome',
    title: 'Welcome to Synergy\u00a02026',
    description: 'A research colloquium and student research conference for sharing discoveries and ideas.',
    image: require('../../assets/Synergy v2-01.png'),
    resizeMode: 'contain',
  },
  {
    id: 'research',
    title: 'Showcase your research',
    description: 'Present your findings to fellow researchers and industry experts at Synergy 2026.',
    image: require('../../assets/onboarding_innovation.jpg'),
    resizeMode: 'cover',
  },
  {
    id: 'attendance',
    title: 'Streamline attendance',
    description: 'Manage event registration and attendance digitally, from sign-up through check-in.',
    image: require('../../assets/onboarding_attendance.jpg'),
    resizeMode: 'cover',
  },
] as const;

const OnboardingScreen = ({ navigation }: any) => {
  const { top, bottom } = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const pageWidth = Math.min(width, 540);
  const photoHeight = Math.min(320, height * 0.34, pageWidth - 40);
  const [currentIndex, setCurrentIndex] = useState(0);
  const list = useRef<FlatList<(typeof slides)[number]>>(null);
  const lastSlide = currentIndex === slides.length - 1;
  const onViewableItemsChanged = useRef<NonNullable<React.ComponentProps<typeof FlatList>['onViewableItemsChanged']>>(
    ({ viewableItems }) => {
      const index = viewableItems[0]?.index;
      if (index != null) setCurrentIndex(index);
    },
  ).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  return (
    <View style={[styles.page, { paddingTop: top, paddingBottom: bottom }]}>
      <View style={[eventLayout.frame, styles.header]}><BrandMark /></View>
      <FlatList
        ref={list}
        data={slides}
        style={{ width: pageWidth, alignSelf: 'center' }}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({ length: pageWidth, offset: index * pageWidth, index })}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ScrollView style={{ width: pageWidth }} contentContainerStyle={styles.slide}>
            <View style={[styles.photo, { height: photoHeight }]}>
              <Image source={item.image} resizeMode={item.resizeMode}
                style={[styles.image, item.resizeMode === 'contain' && styles.logo]} />
            </View>
            <Text accessibilityRole="header" style={eventLayout.title}>{item.title}</Text>
            <Text style={styles.description}>{item.description}</Text>
          </ScrollView>
        )}
      />
      <View style={[eventLayout.frame, styles.footer]}>
        <View accessible accessibilityLabel={`Page ${currentIndex + 1} of ${slides.length}`} style={styles.dots}>
          {slides.map((slide, index) => <View key={slide.id} style={[styles.dot, index === currentIndex && styles.dotActive]} />)}
        </View>
        <Button title={lastSlide ? 'Get started' : 'Continue'} icon={<ArrowRight color={palette.text} size={18} />}
          onPress={() => lastSlide ? navigation.replace('Login') : list.current?.scrollToIndex({ index: currentIndex + 1, animated: true })} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.canvas },
  header: { maxWidth: 540, paddingTop: 12, paddingBottom: 12 },
  slide: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 12, gap: 12 },
  photo: { ...eventLayout.panel, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  image: { width: '100%', height: '100%' },
  logo: { width: '82%', height: '82%' },
  description: { ...eventLayout.body, fontSize: 16, lineHeight: 24 },
  footer: { maxWidth: 540, paddingTop: 10, paddingBottom: 14, gap: 14 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 6, borderRadius: 3, backgroundColor: '#334155' },
  dotActive: { width: 24, backgroundColor: palette.blue.ink },
});

export default OnboardingScreen;
