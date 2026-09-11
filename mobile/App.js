import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { WebView } from 'react-native-webview';

const DEFAULT_URL = 'http://192.168.29.150:5173';

export default function App() {
  const webViewRef = useRef(null);
  const [currentUrl, setCurrentUrl] = useState(DEFAULT_URL);
  const [inputUrl, setInputUrl] = useState(DEFAULT_URL);
  const [showConfig, setShowConfig] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleApplyUrl = () => {
    let formatted = inputUrl.trim();
    if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
      formatted = 'http://' + formatted;
    }
    setCurrentUrl(formatted);
    setInputUrl(formatted);
    setShowConfig(false);
    setHasError(false);
    webViewRef.current?.reload();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Top Status / Settings Bar */}
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          Skandan: {currentUrl}
        </Text>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => setShowConfig((prev) => !prev)}
        >
          <Text style={styles.settingsBtnText}>{showConfig ? '✕ Close' : '⚙ Change URL'}</Text>
        </TouchableOpacity>
      </View>

      {/* URL Configuration Drawer */}
      {showConfig && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.configDrawer}
        >
          <Text style={styles.configLabel}>Portal Server Address:</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={inputUrl}
              onChangeText={setInputUrl}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="e.g. http://192.168.29.150:5173"
            />
            <TouchableOpacity style={styles.applyBtn} onPress={handleApplyUrl}>
              <Text style={styles.applyBtnText}>Connect</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Main WebView or Error View */}
      {hasError ? (
        <ScrollView contentContainerStyle={styles.errorContainer}>
          <Text style={styles.errorIcon}>📡</Text>
          <Text style={styles.errorTitle}>Cannot Connect to Server</Text>
          <Text style={styles.errorUrl}>Target: {currentUrl}</Text>

          <View style={styles.troubleshootBox}>
            <Text style={styles.troubleshootTitle}>How to fix this in 30 seconds:</Text>
            <Text style={styles.step}>
              <Text style={styles.bold}>1. Fix Windows Firewall:</Text> On your computer, open Windows <Text style={styles.bold}>Settings</Text> → <Text style={styles.bold}>Network & internet</Text> → <Text style={styles.bold}>Wi-Fi</Text> → click <Text style={styles.bold}>"Eternal4 Jio1_5G"</Text> → set it to <Text style={styles.bold}>"Private network"</Text> (Windows blocks incoming traffic on Public networks).
            </Text>
            <Text style={styles.step}>
              <Text style={styles.bold}>2. Verify Same Wi-Fi:</Text> Make sure your phone is connected to <Text style={styles.bold}>Eternal4 Jio1_5G</Text>.
            </Text>
            <Text style={styles.step}>
              <Text style={styles.bold}>3. Or Run with Tunnel:</Text> On your PC, run <Text style={styles.code}>npx expo start --tunnel</Text> in the mobile folder.
            </Text>
          </View>

          <View style={styles.changeUrlBox}>
            <Text style={styles.configLabel}>Try another IP or Tunnel URL:</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={inputUrl}
                onChangeText={setInputUrl}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="http://192.168.29.xxx:5173"
              />
              <TouchableOpacity style={styles.applyBtn} onPress={handleApplyUrl}>
                <Text style={styles.applyBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setHasError(false);
              webViewRef.current?.reload();
            }}
          >
            <Text style={styles.retryText}>Reload Page</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <WebView
          ref={webViewRef}
          source={{ uri: currentUrl }}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          geolocationEnabled={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          allowsFullscreenVideo={true}
          originWhitelist={['*']}
          startInLoadingState={true}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('WebView error: ', nativeEvent);
            setErrorMessage(nativeEvent.description || 'Connection failed');
            setHasError(true);
          }}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6B2FA0" />
              <Text style={styles.loadingText}>Connecting to Skandan Portal...</Text>
              <Text style={styles.loadingSub}>{currentUrl}</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  topBarTitle: {
    fontSize: 11,
    color: '#64748B',
    flex: 1,
    fontWeight: '500',
  },
  settingsBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(107, 47, 160, 0.1)',
  },
  settingsBtnText: {
    fontSize: 11,
    color: '#6B2FA0',
    fontWeight: '700',
  },
  configDrawer: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  configLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    backgroundColor: '#FFFFFF',
  },
  applyBtn: {
    backgroundColor: '#6B2FA0',
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#6B2FA0',
    fontWeight: '700',
  },
  loadingSub: {
    marginTop: 4,
    fontSize: 12,
    color: '#94A3B8',
  },
  errorContainer: {
    padding: 24,
    alignItems: 'center',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 4,
  },
  errorUrl: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '600',
    marginBottom: 16,
  },
  troubleshootBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  troubleshootTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  step: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 8,
  },
  bold: {
    fontWeight: '700',
    color: '#1E293B',
  },
  code: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#6B2FA0',
    fontWeight: '700',
  },
  changeUrlBox: {
    width: '100%',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#6B2FA0',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  retryText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
});
