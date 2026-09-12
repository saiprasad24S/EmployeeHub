import React from 'react';
import { StyleSheet, View, Modal, Clipboard, ToastAndroid } from 'react-native';
import { Text, Avatar, IconButton, Button, Card, Divider } from 'react-native-paper';
import { EmployeeSearchResult } from '../../types/chat';

interface ColleagueProfileSheetProps {
  visible: boolean;
  onClose: () => void;
  employee: EmployeeSearchResult | null;
}

export default function ColleagueProfileSheet({
  visible,
  onClose,
  employee,
}: ColleagueProfileSheetProps) {
  if (!employee) return null;

  const handleCopyId = () => {
    Clipboard.setString(employee.employee_id);
    ToastAndroid.show('Employee ID copied to clipboard', ToastAndroid.SHORT);
  };

  const isOnline = employee.is_online;
  const displayName = employee.name || 'Colleague';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Employee Information</Text>
            <IconButton icon="close" size={22} onPress={onClose} />
          </View>

          <Divider />

          {/* Profile Details */}
          <View style={styles.content}>
            <View style={styles.avatarWrapper}>
              <Avatar.Text
                size={72}
                label={displayName.substring(0, 2).toUpperCase()}
                style={styles.avatar}
              />
              <View
                style={[
                  styles.onlineDot,
                  { backgroundColor: isOnline ? '#22C55E' : '#9CA3AF' },
                ]}
              />
            </View>

            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.designation}>{employee.designation || 'Healthcare Staff'}</Text>
            <Text style={styles.department}>{employee.department || 'Clinical Operations'}</Text>

            {/* Status badge */}
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: isOnline ? '#DCFCE7' : '#F3F4F6' },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: isOnline ? '#166534' : '#6B7280' },
                ]}
              >
                {isOnline
                  ? 'Active Now'
                  : employee.last_seen_at
                  ? `Last seen ${new Date(employee.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : 'Offline'}
              </Text>
            </View>

            {/* Employee ID with Copy Button */}
            <Card style={styles.idCard}>
              <Card.Content style={styles.idContent}>
                <View>
                  <Text style={styles.idLabel}>Employee ID</Text>
                  <Text style={styles.idValue}>{employee.employee_id}</Text>
                </View>
                <Button
                  mode="outlined"
                  compact
                  icon="content-copy"
                  textColor="#6B2FA0"
                  onPress={handleCopyId}
                >
                  Copy
                </Button>
              </Card.Content>
            </Card>

            <Text style={styles.privacyNote}>
              Personal contact details (phone and email) are protected for employee privacy.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    backgroundColor: '#6B2FA0',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  designation: {
    fontSize: 14,
    color: '#4B5563',
    marginTop: 4,
  },
  department: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  idCard: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginTop: 20,
  },
  idContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  idLabel: {
    fontSize: 11,
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  idValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 2,
  },
  privacyNote: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
});
