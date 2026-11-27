import React from 'react';
import "./global.css";
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AppState, View, Platform, Text, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Camera, Bell, Settings, Scan, BarChart3, CalendarDays } from 'lucide-react-native';
import { supabase } from './src/lib/supabase';
import type { Session } from '@supabase/supabase-js';

import { EventSelectionProvider, useEventSelection } from './src/lib/eventSelection';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Placeholder for screens not yet implemented
const PlaceholderScreen = ({ name }: { name: string }) => (
  <View style={{ flex: 1, backgroundColor: '#020617', alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>{name} Coming Soon</Text>
  </View>
);

function MainTabs({ userId }: { userId: string }) {
  const { bottom } = useSafeAreaInsets();
  const baseBottomPadding = Platform.OS === 'ios' ? 25 : 10;
  const bottomPadding = Math.max(bottom, baseBottomPadding);

  return (
    <EventSelectionProvider key={userId} userId={userId}>
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#020617', // slate-950
          borderTopColor: '#1e293b', // slate-800
          paddingBottom: bottomPadding,
          paddingTop: 10,
          height: (Platform.OS === 'ios' ? 90 : 70) + bottomPadding - baseBottomPadding,
        },
        tabBarActiveTintColor: '#3b82f6', // blue-500
        tabBarInactiveTintColor: '#64748b', // slate-500
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={SelectedHome}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Events"
        getComponent={() => require('./src/screens/EventWorkspaceScreen').default}
        options={{ tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} /> }}
      />
      <Tab.Screen 
        name="Config" 
        component={SelectedConfig}
        options={{
          tabBarLabel: 'Config',
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
      <Tab.Screen 
        name="Analytics" 
        component={SelectedAnalytics}
        options={{
          tabBarLabel: 'Analytics',
          tabBarIcon: ({ color, size }) => <BarChart3 color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
    </EventSelectionProvider>
  );
}

function SelectedHome(props: any) {
  const { selectedEvent } = useEventSelection();
  const HomeScreen = require('./src/screens/HomeScreen').default;
  return <HomeScreen key={selectedEvent?.id ?? 'default'} {...props} selectedEvent={selectedEvent} />;
}

function SelectedConfig(props: any) {
  const { selectedEvent } = useEventSelection();
  const AdminScreen = require('./src/screens/AdminScreen').default;
  return <AdminScreen key={selectedEvent?.id ?? 'default'} {...props} selectedEvent={selectedEvent} />;
}

function SelectedAnalytics(props: any) {
  const { selectedEvent } = useEventSelection();
  const AnalyticsScreen = require('./src/screens/AnalyticsScreen').default;
  return <AnalyticsScreen key={selectedEvent?.id ?? 'default'} {...props} selectedEvent={selectedEvent} />;
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
    <NavigationContainer>
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
