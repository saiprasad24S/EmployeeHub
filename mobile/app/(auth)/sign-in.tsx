import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { TextInput, Button, Text, Snackbar, ActivityIndicator } from 'react-native-paper';
import { Link, useRouter } from 'expo-router';
import { useSignIn } from '@clerk/clerk-expo';

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [errorVisible, setErrorVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [resetMode, setResetMode] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetStep, setResetStep] = useState<'email' | 'code'>('email');

  const handleSignIn = async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      const completeSignIn = await signIn.create({
        identifier: email,
        password,
      });
      await setActive({ session: completeSignIn.createdSessionId });
      // Layout effect will navigate
    } catch (err: any) {
      setErrorMessage(err.errors?.[0]?.message || 'An error occurred during sign in');
      setErrorVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const handleResetRequest = async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: email,
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
    if (!isLoaded) return;
    setLoading(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: resetCode,
        password: newPassword,
      });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
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
                <TextInput label="Email Address" value={email} onChangeText={setEmail} mode="outlined" autoCapitalize="none" keyboardType="email-address" style={styles.input} />
                <Button mode="contained" onPress={handleResetRequest} loading={loading} disabled={loading} style={styles.button}>Send Reset Code</Button>
              </>
            ) : (
              <>
                <TextInput label="Verification Code" value={resetCode} onChangeText={setResetCode} mode="outlined" style={styles.input} />
                <TextInput label="New Password" value={newPassword} onChangeText={setNewPassword} mode="outlined" secureTextEntry style={styles.input} />
                <Button mode="contained" onPress={handleResetSubmit} loading={loading} disabled={loading} style={styles.button}>Reset & Sign In</Button>
              </>
            )}
            <Button mode="text" onPress={() => setResetMode(false)} style={styles.linkButton}>Back to Sign In</Button>
          </View>
        </ScrollView>
        <Snackbar visible={errorVisible} onDismiss={() => setErrorVisible(false)} duration={3000}>{errorMessage}</Snackbar>
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
            onChangeText={setEmail}
            mode="outlined"
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />
          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry={!showPassword}
            right={<TextInput.Icon icon={showPassword ? "eye-off" : "eye"} onPress={() => setShowPassword(!showPassword)} />}
            style={styles.input}
          />

          <View style={styles.forgotPasswordContainer}>
            <Button mode="text" onPress={() => setResetMode(true)} compact>
              Forgot Password?
            </Button>
          </View>

          <Button
            mode="contained"
            onPress={handleSignIn}
            loading={loading}
            disabled={loading}
            style={styles.button}
            buttonColor="#6B2FA0"
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
            onPress={() => {}}
            icon="google"
            style={styles.googleButton}
            textColor="#000"
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
        duration={3000}
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
    borderRadius: 8,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#666666',
  },
  googleButton: {
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingVertical: 6,
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
