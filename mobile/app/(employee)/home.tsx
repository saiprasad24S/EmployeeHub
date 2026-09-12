import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Card, Avatar, Button, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import { useAuthStore } from '../../src/store/authStore';
import { getTodayAssignment } from '../../src/api/employeeApi';
import { getNotifications } from '../../src/api/notificationApi';
import CheckInModal from '../../src/components/CheckInModal';
import NotificationSheet from '../../src/components/NotificationSheet';
import { useLocationTracker } from '../../src/hooks/useLocationTracker';

export default function HomeScreen() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const profile = useAuthStore((state) => state.profile);
  const isSessionActive = useAuthStore((state) => state.isSessionActive);
  const activeSession = useAuthStore((state) => state.activeSession);

  // Background GPS tracker when session is active
  useLocationTracker();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [modalVisible, setModalVisible] = useState(false);
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Live digital clock ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Today's patient assignment query
  const { data: assignment, refetch: refetchAssignment } = useQuery({
    queryKey: ['today-assignment'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) return null;
      return getTodayAssignment(token);
    },
    staleTime: 1000 * 60,
  });

  // Notification count query for bell badge
  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) return { results: [], unread_count: 0 };
      return getNotifications(token);
    },
    refetchInterval: 30000,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchAssignment(),
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    ]);
    setRefreshing(false);
  };

  const displayName = profile?.name || 'Employee';
  const unreadCount = notifData?.unread_count || 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Skandan Portal</Text>
          <Text style={styles.headerSub}>Skandan Home Carre Clinic</Text>
        </View>
        <View style={styles.headerIcons}>
          <View style={styles.bellWrapper}>
            <IconButton
              icon="bell-outline"
              iconColor="#FFFFFF"
              size={24}
              onPress={() => setNotificationVisible(true)}
            />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Profile Card */}
        <Card style={styles.card}>
          <Card.Content style={styles.profileContent}>
            <Avatar.Text
              size={64}
              label={displayName.substring(0, 2).toUpperCase()}
              style={styles.avatar}
            />
            <View style={styles.profileDetails}>
              <Text style={styles.profileName}>{displayName}</Text>
              <Text style={styles.profileSub}>{profile?.designation || 'Healthcare Professional'}</Text>
              <Text style={styles.profileSub}>{profile?.department || 'Department'}</Text>
              <Text style={styles.profileId}>ID: {profile?.employee_id || 'N/A'}</Text>
            </View>
          </Card.Content>
        </Card>

        {/* Live Clock & Duty Status Card */}
        <Card style={[styles.card, isSessionActive ? styles.activeCard : styles.inactiveCard]}>
          <Card.Content>
            <View style={styles.clockRow}>
              <View>
                <Text style={styles.clockLabel}>Current Time (IST)</Text>
                <Text style={styles.clockTime}>
                  {currentTime.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true,
                  })}
                </Text>
                <Text style={styles.clockDate}>
                  {currentTime.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
              </View>

              <View style={styles.statusBox}>
                <View
                  style={[
                    styles.statusIndicator,
                    { backgroundColor: isSessionActive ? '#22C55E' : '#9CA3AF' },
                  ]}
                />
                <Text style={styles.statusLabel}>
                  {isSessionActive ? 'DUTY ACTIVE' : 'OFF DUTY'}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Primary Action Hero Card */}
        <TouchableOpacity
          activeOpacity={0.88}
          style={[
            styles.heroActionButton,
            isSessionActive ? styles.heroActionCheckout : styles.heroActionCheckin,
          ]}
          onPress={() => setModalVisible(true)}
        >
          <View style={styles.heroActionLeft}>
            <View
              style={[
                styles.heroActionIconCircle,
                { backgroundColor: isSessionActive ? '#FEE2E2' : '#EDE9FE' },
              ]}
            >
              <IconButton
                icon={isSessionActive ? 'clock-check-outline' : 'camera-account'}
                size={26}
                iconColor={isSessionActive ? '#DC2626' : '#6B2FA0'}
                style={{ margin: 0 }}
              />
            </View>
            <View style={styles.heroActionTextCol}>
              <Text
                style={[
                  styles.heroActionTitle,
                  { color: isSessionActive ? '#991B1B' : '#4C1D95' },
                ]}
              >
                {isSessionActive ? 'Complete Duty & Clock Out' : 'Mark Duty Check-In'}
              </Text>
              <Text style={styles.heroActionSubtitle}>
                {isSessionActive
                  ? 'Tap to confirm shift end & face verify'
                  : 'Selfie face verification & GPS geofencing'}
              </Text>
            </View>
          </View>
          <IconButton
            icon="chevron-right"
            size={22}
            iconColor={isSessionActive ? '#DC2626' : '#6B2FA0'}
            style={{ margin: 0 }}
          />
        </TouchableOpacity>

        {/* Today's Shift Card */}
        <Card style={styles.card}>
          <Card.Title
            title="Assigned Shift"
            left={(props) => (
              <Avatar.Icon
                {...props}
                icon="clock-time-four-outline"
                style={{ backgroundColor: '#6B2FA0' }}
              />
            )}
          />
          <Card.Content>
            <Text style={styles.shiftName}>{profile?.shift_name || 'General Shift'}</Text>
            <Text style={styles.shiftTime}>
              {profile?.shift_start_time || '09:00 AM'} — {profile?.shift_end_time || '06:00 PM'}
            </Text>
          </Card.Content>
        </Card>

        {/* Today's Patient Assignment Card */}
        <Card style={styles.card}>
          <Card.Title
            title="Today's Patient Assignment"
            left={(props) => (
              <Avatar.Icon
                {...props}
                icon="account-heart-outline"
                style={{ backgroundColor: '#6B2FA0' }}
              />
            )}
          />
          <Card.Content>
            {assignment ? (
              <View>
                <Text style={styles.patientName}>{assignment.patient_name}</Text>
                <Text style={styles.patientAddress}>{assignment.patient_address}</Text>
                {assignment.patient_phone && (
                  <Text style={styles.patientPhone}>Contact: {assignment.patient_phone}</Text>
                )}
                <View style={styles.tag}>
                  <Text style={styles.tagText}>Status: {assignment.status}</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.emptyAssignmentText}>
                No field patient visits assigned for today. Attendance will match your default clinic location.
              </Text>
            )}
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Check In / Out Modal */}
      <CheckInModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        mode={isSessionActive ? 'CHECK_OUT' : 'CHECK_IN'}
        todayAssignment={assignment}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['today-assignment'] });
        }}
      />

      {/* Notifications Drawer */}
      <NotificationSheet
        visible={notificationVisible}
        onClose={() => setNotificationVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#6B2FA0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSub: {
    color: '#E0E0E0',
    fontSize: 12,
  },
  headerIcons: {
    flexDirection: 'row',
  },
  bellWrapper: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#EF4444',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    elevation: 2,
    borderRadius: 12,
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    backgroundColor: '#6B2FA0',
  },
  profileDetails: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  profileSub: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  profileId: {
    fontSize: 12,
    color: '#6B2FA0',
    fontWeight: '600',
    marginTop: 4,
  },
  activeCard: {
    borderLeftWidth: 5,
    borderLeftColor: '#22C55E',
  },
  inactiveCard: {
    borderLeftWidth: 5,
    borderLeftColor: '#9CA3AF',
  },
  clockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clockLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  clockTime: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 2,
  },
  clockDate: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 2,
  },
  statusBox: {
    alignItems: 'center',
  },
  statusIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginBottom: 4,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#374151',
  },
  heroActionButton: {
    marginBottom: 16,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  heroActionCheckin: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#DDD6FE',
  },
  heroActionCheckout: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FECACA',
  },
  heroActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  heroActionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  heroActionTextCol: {
    flex: 1,
  },
  heroActionTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  heroActionSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  shiftName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  shiftTime: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  patientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  patientAddress: {
    fontSize: 13,
    color: '#4B5563',
    marginTop: 4,
  },
  patientPhone: {
    fontSize: 13,
    color: '#6B2FA0',
    marginTop: 2,
  },
  tag: {
    alignSelf: 'flex-start',
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 8,
  },
  tagText: {
    fontSize: 11,
    color: '#6B2FA0',
    fontWeight: '600',
  },
  emptyAssignmentText: {
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 18,
  },
});
