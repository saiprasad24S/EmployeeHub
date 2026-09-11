import { authedFetch } from '../lib/api';
import { NotificationItem } from '../types/employee';

export interface NotificationsResponse {
  results: NotificationItem[];
  unread_count: number;
}

export async function getNotifications(token: string): Promise<NotificationsResponse> {
  const res = await authedFetch('/api/notifications/', token);
  const data = await res.json();
  if (Array.isArray(data)) {
    return {
      results: data,
      unread_count: data.filter((n: NotificationItem) => !n.is_read).length,
    };
  }
  return {
    results: data.results || [],
    unread_count: data.unread_count ?? (data.results || []).filter((n: NotificationItem) => !n.is_read).length,
  };
}

export async function markNotificationAsRead(id: number, token: string): Promise<void> {
  await authedFetch(`/api/notifications/${id}/read/`, token, {
    method: 'PATCH',
  });
}

export async function markAllNotificationsAsRead(token: string): Promise<void> {
  await authedFetch('/api/notifications/read-all/', token, {
    method: 'POST',
  });
}

export async function registerPushDeviceToken(
  pushToken: string,
  platform: string,
  token: string
): Promise<void> {
  await authedFetch('/api/notifications/device/register/', token, {
    method: 'POST',
    body: JSON.stringify({
      token: pushToken,
      device_type: platform,
    }),
  });
}

export async function unregisterPushDeviceToken(
  pushToken: string,
  token: string
): Promise<void> {
  await authedFetch('/api/notifications/device/unregister/', token, {
    method: 'POST',
    body: JSON.stringify({
      token: pushToken,
    }),
  });
}
