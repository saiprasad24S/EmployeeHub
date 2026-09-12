import { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaperProvider, ActivityIndicator, Text } from 'react-native-paper';
import { View, StyleSheet, StatusBar, Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '../src/store/authStore';
import { loginToBackend } from '../src/lib/auth';
import { theme } from '../src/theme';
import ErrorBoundary from '../src/components/ErrorBoundary';
import NetworkBanner from '../src/components/NetworkBanner';

if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      gcTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

const isWeb = Platform.OS === 'web';

const tokenCache = {
  async getToken(key: string) {
    if (isWeb) {
      try {
        return typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem(key) : null;
      } catch {
        return null;
      }
    }
    try {
      const item = await SecureStore.getItemAsync(key);
      return item;
    } catch (error) {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch {}
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    if (isWeb) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
        }
      } catch {}
      return;
    }
    try {
      return SecureStore.setItemAsync(key, value);
    } catch (err) {
      return;
    }
  },
  async clearToken(key: string) {
    if (isWeb) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
        }
      } catch {}
      return;
    }
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {}
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
  const setAuthError = useAuthStore((state) => state.setAuthError);
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
        const detail = err?.detail || err?.message || 'Access Denied: Your account is not registered in the system.';
        setAuthError(detail);
        clear();
        if (!inAuthGroup) {
          router.replace('/(auth)/sign-in');
        }
      } finally {
        setIsInitializing(false);
        if (Platform.OS !== 'web') {
          SplashScreen.hideAsync().catch(() => {});
        }
      }
    };

    initAuth();
  }, [isLoaded, isSignedIn]);

  return (
    <View style={styles.rootContainer}>
      <Slot />
      {(isInitializing || !isLoaded) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Skandan Portal</Text>
        </View>
      )}
    </View>
  );
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
  rootContainer: {
    flex: 1,
    backgroundColor: '#6B2FA0',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#6B2FA0',
    zIndex: 9999,
  },
  loadingText: {
    marginTop: 20,
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
});
