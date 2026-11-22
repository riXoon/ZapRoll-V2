import React from 'react';
import "./global.css";
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Platform, Text, ActivityIndicator } from 'react-native';
import { Home, Camera, Bell, Settings, Scan, BarChart3 } from 'lucide-react-native';
import { supabase } from './src/lib/supabase';
import { Session } from '@supabase/supabase-js';

import OnboardingScreen from './src/screens/OnboardingScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import AdminScreen from './src/screens/AdminScreen';
import EventRulesScreen from './src/screens/EventRulesScreen';
import RegWindowScreen from './src/screens/RegWindowScreen';
import QRGeneratorScreen from './src/screens/QRGeneratorScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import ParticipantListScreen from './src/screens/ParticipantListScreen';
import ScannerScreen from './src/screens/ScannerScreen';
import WalkInRoleSelectionScreen from './src/screens/WalkInRoleSelectionScreen';
import WalkInScreen from './src/screens/WalkInScreen';
import WalkInConfigScreen from './src/screens/WalkInConfigScreen';
import TicketScreen from './src/screens/TicketScreen';
import EvaluationBridgeScreen from './src/screens/EvaluationBridgeScreen';
import EvaluationFormScreen from './src/screens/EvaluationFormScreen';
import TurnoutDashboardScreen from './src/screens/TurnoutDashboardScreen';
import ParticipantEvaluationScreen from './src/screens/ParticipantEvaluationScreen';
import WhitelistScreen from './src/screens/WhitelistScreen';
import EvaluationAnalyticsScreen from './src/screens/EvaluationAnalyticsScreen';
import EvaluationDetailScreen from './src/screens/EvaluationDetailScreen';
import EvaluationCommentsScreen from './src/screens/EvaluationCommentsScreen';
import PosterWhitelistScreen from './src/screens/PosterWhitelistScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Placeholder for screens not yet implemented
const PlaceholderScreen = ({ name }: { name: string }) => (
  <View style={{ flex: 1, backgroundColor: '#020617', alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>{name} Coming Soon</Text>
  </View>
);

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#020617', // slate-950
          borderTopColor: '#1e293b', // slate-800
          paddingBottom: Platform.OS === 'ios' ? 25 : 10,
          paddingTop: 10,
          height: Platform.OS === 'ios' ? 90 : 70,
        },
        tabBarActiveTintColor: '#3b82f6', // blue-500
        tabBarInactiveTintColor: '#64748b', // slate-500
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tab.Screen 
        name="Config" 
        component={AdminScreen} 
        options={{
          tabBarLabel: 'Config',
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
      <Tab.Screen 
        name="Analytics" 
        component={AnalyticsScreen} 
        options={{
          tabBarLabel: 'Analytics',
          tabBarIcon: ({ color, size }) => <BarChart3 color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [session, setSession] = React.useState<Session | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    // 1. Check for initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    // 2. Listen for auth changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
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
            <Stack.Screen name="MainApp" component={MainTabs} />
            <Stack.Screen name="EventRules" component={EventRulesScreen} />
            <Stack.Screen name="RegWindow" component={RegWindowScreen} />
            <Stack.Screen name="QRGenerator" component={QRGeneratorScreen} />
            <Stack.Screen name="ParticipantList" component={ParticipantListScreen} />
            <Stack.Screen name="WalkInSelection" component={WalkInRoleSelectionScreen} />
            <Stack.Screen name="WalkIn" component={WalkInScreen} />
            <Stack.Screen name="WalkInConfig" component={WalkInConfigScreen} />
            <Stack.Screen name="Ticket" component={TicketScreen} />
            <Stack.Screen name="EvaluationBridge" component={EvaluationBridgeScreen} />
            <Stack.Screen name="EvaluationForm" component={EvaluationFormScreen} />
            <Stack.Screen name="ParticipantEvaluation" component={ParticipantEvaluationScreen} />
            <Stack.Screen name="TurnoutDashboard" component={TurnoutDashboardScreen} />
            <Stack.Screen name="Whitelist" component={WhitelistScreen} />
            <Stack.Screen name="EvaluationAnalytics" component={EvaluationAnalyticsScreen} />
            <Stack.Screen name="EvaluationDetail" component={EvaluationDetailScreen} />
            <Stack.Screen name="EvaluationComments" component={EvaluationCommentsScreen} />
            <Stack.Screen name="PosterWhitelist" component={PosterWhitelistScreen} />
          </>
        ) : (
          // Unauthenticated Stack
          <>
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
