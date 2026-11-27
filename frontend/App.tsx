import { eventPalette as palette } from './src/components/eventPalette';
import React from 'react';
import "./global.css";
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Alert, AppState, View, Platform, Text, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Settings, BarChart3, CalendarDays, ArrowRight, type LucideIcon } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from './src/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { Button } from './src/components/ui';
import { BrandMark, EventBanner, eventLayout } from './src/components/eventLayout';

import { EventSelectionProvider, useEventSelection } from './src/lib/eventSelection';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const navigationTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: palette.canvas, card: palette.surface, border: palette.edge, text: palette.text, primary: palette.blue.ink },
};

const tabIcon = (Icon: LucideIcon) => ({ color, focused }: { color: string; focused: boolean }) => (
  <View style={[appStyles.tabIcon, focused && appStyles.activeTabIcon]}>
    <Icon color={color} size={20} strokeWidth={focused ? 2.35 : 1.8} />
  </View>
);

function MainTabs({ userId }: { userId: string }) {
  const { bottom, left, right } = useSafeAreaInsets();
  return (
    <EventSelectionProvider key={userId} userId={userId}>
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.edge,
          paddingBottom: Math.max(bottom, 8),
          paddingHorizontal: Math.max(left, right, 8),
          paddingTop: 7,
          height: 62 + Math.max(bottom, 8),
        },
        tabBarLabelPosition: 'below-icon',
        tabBarActiveTintColor: palette.blue.ink,
        tabBarInactiveTintColor: '#94a3b8',
        tabBarLabelStyle: { fontWeight: '600', fontSize: 12 },
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={SelectedHome}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: tabIcon(Home),
        }}
      />
      <Tab.Screen
        name="Events"
        getComponent={() => require('./src/screens/EventWorkspaceScreen').default}
        options={{ tabBarIcon: tabIcon(CalendarDays) }}
      />
      <Tab.Screen 
        name="Config" 
        component={SelectedConfig}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: tabIcon(Settings),
        }}
      />
      <Tab.Screen 
        name="Analytics" 
        component={SelectedAnalytics}
        options={{
          tabBarLabel: 'Analytics',
          tabBarIcon: tabIcon(BarChart3),
        }}
      />
    </Tab.Navigator>
    </EventSelectionProvider>
  );
}

function SelectedHome(props: any) {
  const { selectedEvent } = useEventSelection();
  if (!selectedEvent) return <ChooseEvent navigation={props.navigation} title="Event overview"
    description="Choose an event to see its status and next steps." showSignOut />;
  if (selectedEvent.event_mode === 'scheduled') {
    const EventOverview = require('./src/screens/EventOverviewScreen').default;
    return <EventOverview key={selectedEvent.id} event={selectedEvent} mode="home" navigation={props.navigation} />;
  }
  const HomeScreen = require('./src/screens/HomeScreen').default;
  return <HomeScreen key={selectedEvent.id} {...props} selectedEvent={selectedEvent} />;
}

function ChooseEvent({ navigation, title, description, showSignOut }: {
  navigation: { navigate: (route: string) => void }; title: string; description: string; showSignOut?: boolean;
}) {
  const { top } = useSafeAreaInsets();
  return <ScrollView style={appStyles.container} contentContainerStyle={[eventLayout.frame, appStyles.chooseContent, { paddingTop: top + 14 }]}>
    <BrandMark />
    <EventBanner>
      <CalendarDays size={24} color={palette.blue.ink} />
      <Text accessibilityRole="header" style={eventLayout.title}>{title}</Text>
      <Text style={eventLayout.body}>{description}</Text>
      <Button title="Open Events" icon={<ArrowRight size={18} color={palette.text} />} onPress={() => navigation.navigate('Events')} />
    </EventBanner>
    {showSignOut && (
      <Button title="Sign out" variant="secondary" onPress={() => Alert.alert('Sign out?', undefined, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', onPress: async () => {
          const { error } = await supabase.auth.signOut();
          if (error) Alert.alert('Could not sign out', error.message);
        } },
      ])} />
    )}
  </ScrollView>;
}

function SelectedConfig(props: any) {
  const { selectedEvent } = useEventSelection();
  if (!selectedEvent) return <ChooseEvent navigation={props.navigation} title="Event settings"
    description="Choose an event to manage its settings." />;
  const AdminScreen = require('./src/screens/AdminScreen').default;
  return <AdminScreen key={selectedEvent.id} {...props} selectedEvent={selectedEvent} />;
}

function SelectedAnalytics(props: any) {
  const { selectedEvent } = useEventSelection();
  if (!selectedEvent) return <ChooseEvent navigation={props.navigation} title="Analytics"
    description="Choose an event to view its registrations and attendance." />;
  if (selectedEvent.event_mode === 'scheduled') {
    const EventOverview = require('./src/screens/EventOverviewScreen').default;
    return <EventOverview key={selectedEvent.id} event={selectedEvent} mode="analytics" navigation={props.navigation} />;
  }
  const AnalyticsScreen = require('./src/screens/AnalyticsScreen').default;
  return <AnalyticsScreen key={selectedEvent.id} {...props} selectedEvent={selectedEvent} />;
}

export default function App() {
  const [session, setSession] = React.useState<Session | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === 'INITIAL_SESSION') setIsLoading(false);
    });

    const appState = Platform.OS !== 'web' ? AppState.addEventListener('change', state => {
      if (state === 'active') void supabase.auth.startAutoRefresh();
      else void supabase.auth.stopAutoRefresh();
    }) : undefined;

    return () => {
      subscription.unsubscribe();
      appState?.remove();
    };
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#020617', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar style="light" />
      <Stack.Navigator 
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}
      >
        {session ? (
          // Authenticated Stack
          <>
            <Stack.Screen name="MainApp">{() => <MainTabs userId={session.user.id} />}</Stack.Screen>
            <Stack.Screen name="EventRules" getComponent={() => require('./src/screens/EventRulesScreen').default} />
            <Stack.Screen name="RegWindow" getComponent={() => require('./src/screens/RegWindowScreen').default} />
            <Stack.Screen name="QRGenerator" getComponent={() => require('./src/screens/QRGeneratorScreen').default} />
            <Stack.Screen name="ParticipantList" getComponent={() => require('./src/screens/ParticipantListScreen').default} />
            <Stack.Screen name="WalkInSelection" getComponent={() => require('./src/screens/WalkInRoleSelectionScreen').default} />
            <Stack.Screen name="WalkIn" getComponent={() => require('./src/screens/WalkInScreen').default} />
            <Stack.Screen name="WalkInConfig" getComponent={() => require('./src/screens/WalkInConfigScreen').default} />
            <Stack.Screen name="Ticket" getComponent={() => require('./src/screens/TicketScreen').default} />
            <Stack.Screen name="EvaluationBridge" getComponent={() => require('./src/screens/EvaluationBridgeScreen').default} />
            <Stack.Screen name="EvaluationForm" getComponent={() => require('./src/screens/EvaluationFormScreen').default} />
            <Stack.Screen name="ParticipantEvaluation" getComponent={() => require('./src/screens/ParticipantEvaluationScreen').default} />
            <Stack.Screen name="TurnoutDashboard" getComponent={() => require('./src/screens/TurnoutDashboardScreen').default} />
            <Stack.Screen name="Whitelist" getComponent={() => require('./src/screens/WhitelistScreen').default} />
            <Stack.Screen name="EvaluationAnalytics" getComponent={() => require('./src/screens/EvaluationAnalyticsScreen').default} />
            <Stack.Screen name="EvaluationDetail" getComponent={() => require('./src/screens/EvaluationDetailScreen').default} />
            <Stack.Screen name="EvaluationComments" getComponent={() => require('./src/screens/EvaluationCommentsScreen').default} />
            <Stack.Screen name="PosterWhitelist" getComponent={() => require('./src/screens/PosterWhitelistScreen').default} />
          </>
        ) : (
          // Unauthenticated Stack
          <>
            <Stack.Screen name="Onboarding" getComponent={() => require('./src/screens/OnboardingScreen').default} />
            <Stack.Screen name="Login" getComponent={() => require('./src/screens/LoginScreen').default} />
            <Stack.Screen name="Register" getComponent={() => require('./src/screens/RegisterScreen').default} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const appStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.canvas },
  chooseContent: { gap: 16, paddingBottom: 24 },
  tabIcon: { width: 48, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  activeTabIcon: { backgroundColor: palette.blue.surface },
});
