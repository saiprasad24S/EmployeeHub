import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { TextInput, Button, Text, Snackbar, ActivityIndicator } from 'react-native-paper';
import { Link, useRouter } from 'expo-router';
import { useSignUp } from '@clerk/clerk-expo';

export default function SignUpScreen() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorVisible, setErrorVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSignUp = async () => {
    if (!isLoaded) return;
    if (password !== confirmPassword) {
      setErrorMessage("Passwords don't match");
      setErrorVisible(true);
      return;
    }

    setLoading(true);
    try {
      await signUp.create({
        firstName,
        lastName,
        emailAddress: email,
        password,
      });

      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err: any) {
      setErrorMessage(err.errors?.[0]?.message || 'Failed to create account');
      setErrorVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code,
      });
      if (completeSignUp.status === 'complete') {
        await setActive({ session: completeSignUp.createdSessionId });
        // Layout will navigate
      } else {
        setErrorMessage('Verification failed');
        setErrorVisible(true);
      }
    } catch (err: any) {
      setErrorMessage(err.errors?.[0]?.message || 'Invalid verification code');
      setErrorVisible(true);
    } finally {
      setLoading(false);
    }
  };

  if (pendingVerification) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Verify Email</Text>
            <Text style={styles.subtitle}>Enter the code sent to {email}</Text>
          </View>
          <View style={styles.form}>
            <TextInput
              label="Verification Code"
              value={code}
              onChangeText={setCode}
              mode="outlined"
              style={styles.input}
              keyboardType="number-pad"
            />
            <Button
              mode="contained"
              onPress={handleVerify}
              loading={loading}
              disabled={loading}
              style={styles.button}
              buttonColor="#6B2FA0"
            >
              Verify & Sign In
            </Button>
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
          <Text style={styles.subtitle}>Create an Account</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.row}>
            <TextInput
              label="First Name"
              value={firstName}
              onChangeText={setFirstName}
              mode="outlined"
              style={[styles.input, styles.halfInput]}
            />
            <View style={{ width: 16 }} />
            <TextInput
              label="Last Name"
              value={lastName}
              onChangeText={setLastName}
              mode="outlined"
              style={[styles.input, styles.halfInput]}
            />
          </View>
          
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
          <TextInput
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            mode="outlined"
            secureTextEntry={!showPassword}
            style={styles.input}
          />

          <Button
            mode="contained"
            onPress={handleSignUp}
            loading={loading}
            disabled={loading}
            style={[styles.button, { marginTop: 16 }]}
            buttonColor="#6B2FA0"
          >
            Create Account
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
            Sign up with Google
          </Button>

          <View style={styles.signinContainer}>
            <Text>Already have an account? </Text>
            <Link href="/(auth)/sign-in" asChild>
              <Text style={styles.signinLink}>Sign In</Text>
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
    marginTop: 10,
  },
  row: {
    flexDirection: 'row',
  },
  halfInput: {
    flex: 1,
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
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
  signinContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
    marginBottom: 20,
  },
  signinLink: {
    color: '#6B2FA0',
    fontWeight: 'bold',
  },
  snackbar: {
    backgroundColor: '#D32F2F',
  },
});
