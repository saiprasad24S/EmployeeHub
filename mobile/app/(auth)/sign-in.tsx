import React, { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { TextInput, Button, Text, Snackbar } from 'react-native-paper';
import { Link, useRouter } from 'expo-router';
import { useSignIn, useOAuth } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import { useAuthStore } from '../../src/store/authStore';

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [errorVisible, setErrorVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const authError = useAuthStore((state) => state.authError);
  const setAuthError = useAuthStore((state) => state.setAuthError);

  useEffect(() => {
    if (authError) {
      setErrorMessage(authError);
      setErrorVisible(true);
    }
  }, [authError]);

  const [resetMode, setResetMode] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetStep, setResetStep] = useState<'email' | 'code'>('email');

  const handleSignIn = async () => {
    if (!isLoaded || !signIn) return;
    if (!email.trim()) {
      setErrorMessage('Please enter your email address');
      setErrorVisible(true);
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password');
      setErrorVisible(true);
      return;
    }

    setLoading(true);
    setErrorVisible(false);
    setAuthError(null);
    try {
      const result = await signIn.create({
        identifier: email.trim(),
        password,
      });

      if (result.status === 'complete' && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        router.replace('/(employee)/home');
      } else if (result.status === 'needs_first_factor') {
        const factorRes = await signIn.attemptFirstFactor({
          strategy: 'password',
          password,
        });
        if (factorRes.status === 'complete' && factorRes.createdSessionId) {
          await setActive({ session: factorRes.createdSessionId });
          router.replace('/(employee)/home');
        } else {
          setErrorMessage('Authentication incomplete. Please check your credentials.');
          setErrorVisible(true);
        }
      } else {
        setErrorMessage('Authentication incomplete. Please verify your credentials.');
        setErrorVisible(true);
      }
    } catch (err: any) {
      console.error('Sign-in error:', err);
      const msg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message ||
        'Incorrect email or password. Please try again.';
      setErrorMessage(msg);
      setErrorVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!isLoaded) return;
    setGoogleLoading(true);
    setErrorVisible(false);
    setAuthError(null);
    try {
      if (Platform.OS === 'web') {
        if (signIn) {
          await signIn.authenticateWithRedirect({
            strategy: 'oauth_google',
            redirectUrl: '/sso-callback',
            redirectUrlComplete: '/(employee)/home',
          });
        }
      } else {
        const { createdSessionId, setActive: setOAuthActive } = await startOAuthFlow();
        if (createdSessionId && setOAuthActive) {
          await setOAuthActive({ session: createdSessionId });
          router.replace('/(employee)/home');
        }
      }
    } catch (err: any) {
      console.error('Google sign in error:', err);
      const msg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message ||
        'Google sign-in could not be completed. Please use Email & Password.';
      setErrorMessage(msg);
      setErrorVisible(true);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleResetRequest = async () => {
    if (!isLoaded || !signIn) return;
    if (!email.trim()) {
      setErrorMessage('Please enter your email address to reset password');
      setErrorVisible(true);
      return;
    }
    setLoading(true);
    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: email.trim(),
      });
      setResetStep('code');
    } catch (err: any) {
      setErrorMessage(err.errors?.[0]?.message || 'Failed to request reset');
      setErrorVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async () => {
    if (!isLoaded || !signIn) return;
    setLoading(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: resetCode.trim(),
        password: newPassword,
      });
      if (result.status === 'complete' && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        router.replace('/(employee)/home');
      } else {
        setErrorMessage('Verification failed');
        setErrorVisible(true);
      }
    } catch (err: any) {
      setErrorMessage(err.errors?.[0]?.message || 'Failed to reset password');
      setErrorVisible(true);
    } finally {
      setLoading(false);
    }
  };

  if (resetMode) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Skandan Portal</Text>
            <Text style={styles.subtitle}>Reset Password</Text>
          </View>
          <View style={styles.form}>
            {resetStep === 'email' ? (
              <>
                <TextInput
                  label="Email Address"
                  value={email}
                  onChangeText={(t) => { setEmail(t); setErrorVisible(false); }}
                  mode="outlined"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                />
                <Button mode="contained" onPress={handleResetRequest} loading={loading} disabled={loading} style={styles.button} buttonColor="#6B2FA0">
                  Send Reset Code
                </Button>
              </>
            ) : (
              <>
                <TextInput label="Verification Code" value={resetCode} onChangeText={setResetCode} mode="outlined" style={styles.input} />
                <TextInput label="New Password" value={newPassword} onChangeText={setNewPassword} mode="outlined" secureTextEntry style={styles.input} />
                <Button mode="contained" onPress={handleResetSubmit} loading={loading} disabled={loading} style={styles.button} buttonColor="#6B2FA0">
                  Reset & Sign In
                </Button>
              </>
            )}
            <Button mode="text" onPress={() => setResetMode(false)} style={styles.linkButton} textColor="#6B2FA0">
              Back to Sign In
            </Button>
          </View>
        </ScrollView>
        <Snackbar visible={errorVisible} onDismiss={() => setErrorVisible(false)} duration={5000} style={styles.snackbar}>
          {errorMessage}
        </Snackbar>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Skandan Portal</Text>
          <Text style={styles.subtitle}>Employee Portal</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label="Email Address"
            value={email}
            onChangeText={(t) => { setEmail(t); setErrorVisible(false); }}
            mode="outlined"
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />
          <TextInput
            label="Password"
            value={password}
            onChangeText={(t) => { setPassword(t); setErrorVisible(false); }}
            mode="outlined"
            secureTextEntry={!showPassword}
            right={<TextInput.Icon icon={showPassword ? "eye-off" : "eye"} onPress={() => setShowPassword(!showPassword)} />}
            style={styles.input}
          />

          <View style={styles.forgotPasswordContainer}>
            <Button mode="text" onPress={() => setResetMode(true)} compact textColor="#6B2FA0">
              Forgot Password?
            </Button>
          </View>

          <Button
            mode="contained"
            onPress={handleSignIn}
            loading={loading}
            disabled={loading || googleLoading}
            style={styles.button}
            buttonColor="#6B2FA0"
            labelStyle={{ fontSize: 16, fontWeight: '700' }}
          >
            Sign In
          </Button>

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>

          <Button
            mode="outlined"
            onPress={handleGoogleSignIn}
            loading={googleLoading}
            disabled={loading || googleLoading}
            icon="google"
            style={styles.googleButton}
            textColor="#374151"
            labelStyle={{ fontSize: 15, fontWeight: '600' }}
          >
            Sign in with Google
          </Button>

          <View style={styles.signupContainer}>
            <Text>Don't have an account? </Text>
            <Link href="/(auth)/sign-up" asChild>
              <Text style={styles.signupLink}>Sign Up</Text>
            </Link>
          </View>
        </View>
      </ScrollView>

      <Snackbar
        visible={errorVisible}
        onDismiss={() => setErrorVisible(false)}
        duration={5000}
        style={styles.snackbar}
      >
        {errorMessage}
      </Snackbar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    backgroundColor: '#6B2FA0',
    padding: 40,
    paddingTop: 80,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#E0E0E0',
  },
  form: {
    padding: 24,
    marginTop: 20,
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  button: {
    paddingVertical: 6,
    borderRadius: 12,
    elevation: 2,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  googleButton: {
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 6,
    borderWidth: 1.5,
    elevation: 1,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  signupLink: {
    color: '#6B2FA0',
    fontWeight: 'bold',
  },
  linkButton: {
    marginTop: 16,
  },
  snackbar: {
    backgroundColor: '#D32F2F',
  },
});
