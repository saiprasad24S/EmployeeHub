import React, { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { useRouter } from 'expo-router';

export default function SSOCallbackScreen() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS !== 'web') {
      const timer = setTimeout(() => {
        router.replace('/(employee)/home');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [router]);

  if (Platform.OS === 'web') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { AuthenticateWithRedirectCallback } = require('@clerk/clerk-react');
    return (
      <View style={styles.container}>
        <AuthenticateWithRedirectCallback
          signInForceRedirectUrl="/(employee)/home"
          signUpForceRedirectUrl="/(employee)/home"
        />
        <ActivityIndicator size="large" color="#6B2FA0" />
        <Text style={styles.text}>Signing you in...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#6B2FA0" />
      <Text style={styles.text}>Signing you in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  text: {
    marginTop: 16,
    color: '#6B2FA0',
    fontSize: 16,
    fontWeight: '600',
  },
});
