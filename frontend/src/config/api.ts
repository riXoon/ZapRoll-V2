import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Dynamically gets the local IP address for development.
 * This ensures the app works on physical devices via Expo Go.
 */
const getLocalUrl = () => {
  // For Expo Go: get the IP address of the machine running the dev server
  const hostUri = Constants.expoConfig?.hostUri || '';
  const ip = hostUri.split(':').shift();

  if (ip) {
    return `http://${ip}:3000`;
  }

  // Fallbacks for simulators
  return Platform.select({
    android: 'http://10.0.2.2:3000',
    ios: 'http://localhost:3000',
    default: 'http://localhost:3000',
  });
};

// Logic:
// 1. In Development: Default to local backend (dynamic IP) unless EXPO_PUBLIC_USE_PROD_IN_DEV is set.
// 2. In Production: Use the Vercel URL (EXPO_PUBLIC_API_URL).
const USE_PROD = !__DEV__ || process.env.EXPO_PUBLIC_USE_PROD_IN_DEV === 'true';

export const API_URL = USE_PROD 
  ? (process.env.EXPO_PUBLIC_API_URL || getLocalUrl()) 
  : getLocalUrl();

console.log(`[API] Environment: ${__DEV__ ? 'Development' : 'Production'}`);
console.log(`[API] Base URL: ${API_URL}`);
