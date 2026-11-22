import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  Dimensions,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { ChevronRight, Sparkles, Scan, TrendingUp } from 'lucide-react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  interpolate,
  Extrapolation
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

interface OnboardingItem {
  id: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
  image?: any;
}

const ONBOARDING_DATA: OnboardingItem[] = [
  {
    id: '1',
    title: 'Welcome to Synergy 2026',
    description: 'The premier Research Colloquium and Student Research Conference. Empowering researchers to share their discoveries and ignite innovation.',
    image: require('../../assets/Synergy v2-01.png'),
  },
  {
    id: '2',
    title: 'Showcase Innovation',
    description: 'Present your findings to a community of scholars and industry experts. Synergy 2026 is the stage for your intellectual breakthroughs.',
    image: require('../../assets/onboarding_innovation.jpg'),
  },
  {
    id: '3',
    title: 'Streamlined Attendance',
    description: 'Experience a hassle-free conference with our digital registration and real-time event updates designed for the modern researcher.',
    image: require('../../assets/onboarding_attendance.jpg'),
  },
];

const OnboardingScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useSharedValue(0);
  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollX.value = event.nativeEvent.contentOffset.x;
  };

  const renderItem = ({ item }: { item: OnboardingItem }) => {
    const imgSize = width - 80;
    return (
      <View style={{ width, paddingHorizontal: 32, alignItems: 'center', justifyContent: 'center' }}>
        {/* Icon Container with fixed dimensions */}
        <View style={{ 
          width: imgSize, 
          height: imgSize, 
          borderRadius: 40, 
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 40,
          backgroundColor: '#0f172a', // slate-900
          borderWidth: 1,
          borderColor: '#1e293b', // slate-800
          overflow: 'hidden'
        }}>
          {item.image ? (
            <Image 
              source={item.image} 
              style={{ width: '100%', height: '100%', resizeMode: 'contain' }} 
            />
          ) : (
            item.icon
          )}
        </View>
        <View style={{ width: '100%' }}>
          <Text style={{ fontSize: 32, fontWeight: 'bold', color: 'white', textAlign: 'center', marginBottom: 16 }}>
            {item.title}
          </Text>
          <Text style={{ fontSize: 16, color: '#94a3b8', textAlign: 'center', lineHeight: 24 }}>
            {item.description}
          </Text>
        </View>
      </View>
    );
  };

  const nextStep = () => {
    if (currentIndex < ONBOARDING_DATA.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      navigation.replace('Login');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#020617', paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={ONBOARDING_DATA}
          renderItem={renderItem}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
          scrollEventThrottle={16}
          keyExtractor={(item) => item.id}
        />
      </View>

      <View style={{ paddingHorizontal: 32, paddingBottom: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Pagination Dots */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {ONBOARDING_DATA.map((_, index) => {
            const dotStyle = useAnimatedStyle(() => {
              const dotWidth = interpolate(
                scrollX.value,
                [(index - 1) * width, index * width, (index + 1) * width],
                [10, 24, 10],
                Extrapolation.CLAMP
              );
              const opacity = interpolate(
                scrollX.value,
                [(index - 1) * width, index * width, (index + 1) * width],
                [0.4, 1, 0.4],
                Extrapolation.CLAMP
              );
              return {
                width: dotWidth,
                opacity,
              };
            });

            return (
              <Animated.View
                key={index}
                style={[{ height: 10, borderRadius: 5, backgroundColor: '#3b82f6' }, dotStyle]}
              />
            );
          })}
        </View>

        {/* Next Button */}
        <TouchableOpacity
          onPress={nextStep}
          style={{ 
            backgroundColor: '#2563eb', 
            width: 64, 
            height: 64, 
            borderRadius: 32, 
            alignItems: 'center', 
            justifyContent: 'center',
            elevation: 5,
            shadowColor: '#2563eb',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.5,
            shadowRadius: 10
          }}
          activeOpacity={0.8}
        >
          {currentIndex === ONBOARDING_DATA.length - 1 ? (
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>START</Text>
          ) : (
            <ChevronRight color="white" size={32} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default OnboardingScreen;
