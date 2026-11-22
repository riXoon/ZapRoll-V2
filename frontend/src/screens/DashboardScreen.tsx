import React from 'react';
import { View, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';

const DashboardScreen = () => {
  return (
    <View className="flex-1 items-center justify-center bg-slate-950">
      <View className="p-8 bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl">
        <Text className="text-4xl font-bold text-white mb-2 text-center">
          ZapRoll
        </Text>
        <Text className="text-slate-400 text-lg text-center">
          Event: Synergy
        </Text>
        <Text className="text-blue-400 mt-4 font-medium text-center">
          Welcome to the Main Dashboard
        </Text>
      </View>
      <StatusBar style="light" />
    </View>
  );
};

export default DashboardScreen;
