import React from 'react';
import { StyleSheet, View, Modal, FlatList, TouchableOpacity } from 'react-native';
import { Text, IconButton, Button, Divider, ActivityIndicator } from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../api/notificationApi';
import { NotificationItem } from '../types/employee';

interface NotificationSheetProps {
  visible: boolean;
  onClose: () => void;
}

export default function NotificationSheet({ visible, onClose }: NotificationSheetProps) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) return { results: [], unread_count: 0 };
      return getNotifications(token);
    },
    enabled: visible,
    refetchInterval: visible ? 15000 : false,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: number) => {
      const token = await getToken();
      if (token) await markNotificationAsRead(id, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      if (token) await markAllNotificationsAsRead(token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const notifications = data?.results || [];
  const unreadCount = data?.unread_count || 0;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Notifications</Text>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount} new</Text>
              </View>
            )}
          </View>
          <IconButton icon="close" size={24} iconColor="#FFFFFF" onPress={onClose} />
        </View>

        {unreadCount > 0 && (
          <View style={styles.actionRow}>
            <Button
              mode="text"
              compact
              textColor="#6B2FA0"
              onPress={() => markAllMutation.mutate()}
              loading={markAllMutation.isPending}
            >
              Mark all as read
            </Button>
          </View>
        )}

        {isLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#6B2FA0" />
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.centerBox}>
            <Text style={styles.emptyText}>No notifications yet.</Text>
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => String(item.id)}
            ItemSeparatorComponent={Divider}
            renderItem={({ item }: { item: NotificationItem }) => (
              <TouchableOpacity
                style={[styles.itemRow, !item.is_read && styles.unreadRow]}
                onPress={() => {
                  if (!item.is_read) {
                    markReadMutation.mutate(item.id);
                  }
                }}
              >
                <View style={styles.iconBox}>
                  <IconButton
                    icon={
                      item.notification_type === 'LEAVE_APPROVED'
                        ? 'check-circle'
                        : item.notification_type === 'LEAVE_REJECTED'
                        ? 'close-circle'
                        : 'bell-ring'
                    }
                    size={22}
                    iconColor={
                      item.notification_type === 'LEAVE_APPROVED'
                        ? '#22C55E'
                        : item.notification_type === 'LEAVE_REJECTED'
                        ? '#EF4444'
                        : '#6B2FA0'
                    }
                  />
                </View>
                <View style={styles.textBox}>
                  <Text style={[styles.itemTitle, !item.is_read && styles.boldTitle]}>
                    {item.title}
                  </Text>
                  <Text style={styles.itemMessage}>{item.message}</Text>
                  <Text style={styles.itemTime}>
                    {new Date(item.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    • {new Date(item.created_at).toLocaleDateString()}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#6B2FA0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  badge: {
    marginLeft: 8,
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 15,
  },
  itemRow: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  unreadRow: {
    backgroundColor: '#F3E8FF',
  },
  iconBox: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  textBox: {
    flex: 1,
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 15,
    color: '#1F2937',
  },
  boldTitle: {
    fontWeight: 'bold',
    color: '#6B2FA0',
  },
  itemMessage: {
    fontSize: 13,
    color: '#4B5563',
    marginTop: 2,
  },
  itemTime: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
});
