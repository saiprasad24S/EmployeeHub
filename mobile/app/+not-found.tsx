import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';

export default function NotFoundScreen() {
  const { isSignedIn } = useAuth();

  // Gracefully redirect any unmatched route to the correct screen
  if (isSignedIn) {
    return <Redirect href="/(employee)/home" />;
  }

  return <Redirect href="/(auth)/sign-in" />;
}
