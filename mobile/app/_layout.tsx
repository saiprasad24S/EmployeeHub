import { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaperProvider, ActivityIndicator, Text } from 'react-native-paper';
import { View, StyleSheet, StatusBar } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '../src/store/authStore';
import { loginToBackend } from '../src/lib/auth';
import { theme } from '../src/theme';
import ErrorBoundary from '../src/components/ErrorBoundary';
import NetworkBanner from '../src/components/NetworkBanner';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      gcTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

const tokenCache = {
  async getToken(key: string) {
    try {
      const item = await SecureStore.getItemAsync(key);
      if (item) {
        console.log(`${key} was used 🔐 \n`);
      } else {
        console.log('No values stored under key: ' + key);
      }
      return item;
    } catch (error) {
      console.error('SecureStore get item error: ', error);
      await SecureStore.deleteItemAsync(key);
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      return SecureStore.setItemAsync(key, value);
    } catch (err) {
      return;
    }
  },
};

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

if (!publishableKey) {
  throw new Error('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY');
}

function InitialLayout() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [isInitializing, setIsInitializing] = useState(true);
  const setAuth = useAuthStore((state) => state.setAuth);
  const clear = useAuthStore((state) => state.clear);

  useEffect(() => {
    if (!isLoaded) return;

    const inAuthGroup = segments[0] === '(auth)';
    
    const initAuth = async () => {
      try {
        if (isSignedIn) {
          const token = await getToken();
          if (token) {
            const response = await loginToBackend(token);
            setAuth(response);
            if (inAuthGroup || (segments as string[]).length === 0) {
              router.replace('/(employee)/home');
            }
          } else {
            clear();
            router.replace('/(auth)/sign-in');
          }
        } else {
          clear();
          if (!inAuthGroup) {
            router.replace('/(auth)/sign-in');
          }
        }
      } catch (err: any) {
        console.error('Auth initialization error:', err);
        clear();
        if (!inAuthGroup) {
          router.replace('/(auth)/sign-in');
        }
      } finally {
        setIsInitializing(false);
        SplashScreen.hideAsync();
      }
    };

    initAuth();
  }, [isLoaded, isSignedIn]);

  if (isInitializing || !isLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Skandan Portal</Text>
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
        <QueryClientProvider client={queryClient}>
          <PaperProvider theme={theme as any}>
            <StatusBar barStyle="light-content" backgroundColor="#6B2FA0" />
            <NetworkBanner />
            <InitialLayout />
          </PaperProvider>
        </QueryClientProvider>
      </ClerkProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#6B2FA0',
  },
  loadingText: {
    marginTop: 20,
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
});
