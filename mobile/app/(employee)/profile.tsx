import React from 'react';
import { StyleSheet, View, Alert, ScrollView } from 'react-native';
import { Text, Avatar, List, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';

import { useAuthStore } from '../../src/store/authStore';
import { logoutFromBackend } from '../../src/lib/auth';

export default function ProfileScreen() {
  const { signOut, getToken } = useAuth();
  const router = useRouter();
  
  const profile = useAuthStore((state) => state.profile);
  const clearAuth = useAuthStore((state) => state.clear);

  const handleSignOut = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Sign Out", 
          style: "destructive",
          onPress: async () => {
            try {
              const token = await getToken();
              if (token) {
                await logoutFromBackend(token);
              }
            } catch (err) {
              console.error('Backend logout failed', err);
            } finally {
              await signOut();
              clearAuth();
              router.replace('/(auth)/sign-in');
            }
          }
        }
      ]
    );
  };

  const appVersion = Constants.expoConfig?.version || '1.0.0';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileSection}>
          <Avatar.Text size={80} label={(profile?.name || 'Employee').substring(0, 2).toUpperCase()} style={styles.avatar} />
          <Text style={styles.name}>{profile?.name || 'Employee'}</Text>
          <Text style={styles.designation}>{profile?.designation || 'Staff'}</Text>
          <Text style={styles.department}>{profile?.department || 'Department'}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>ID: {profile?.employee_id || 'N/A'}</Text>
          </View>
        </View>

        <View style={styles.settingsSection}>
          <List.Section>
            <List.Subheader>Shift Details</List.Subheader>
            <List.Item
              title={profile?.shift_name || 'General Shift'}
              description={`${profile?.shift_start_time || '09:00 AM'} - ${profile?.shift_end_time || '06:00 PM'}`}
              left={props => <List.Icon {...props} icon="clock-outline" color="#6B2FA0" />}
            />
            
            <Divider />
            
            <List.Subheader>Preferences</List.Subheader>
            <List.Item
              title="Notifications"
              description="Push notifications are enabled"
              left={props => <List.Icon {...props} icon="bell-outline" color="#6B2FA0" />}
              right={props => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => {}}
            />
            
            <Divider />
            
            <List.Subheader>App Info</List.Subheader>
            <List.Item
              title="About"
              description={`Version ${appVersion}`}
              left={props => <List.Icon {...props} icon="information-outline" color="#6B2FA0" />}
            />
            
            <Divider />
            
            <List.Item
              title="Sign Out"
              titleStyle={{ color: '#D32F2F', fontWeight: 'bold' }}
              left={props => <List.Icon {...props} icon="logout" color="#D32F2F" />}
              onPress={handleSignOut}
              style={styles.signOutItem}
            />
          </List.Section>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#6B2FA0',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  profileSection: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  avatar: {
    backgroundColor: '#6B2FA0',
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  designation: {
    fontSize: 16,
    color: '#4B5563',
    marginTop: 4,
  },
  department: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  badge: {
    marginTop: 12,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  badgeText: {
    color: '#4B5563',
    fontWeight: '500',
    fontSize: 12,
  },
  settingsSection: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
  },
  signOutItem: {
    marginTop: 8,
  }
});
