import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { useAuthStore } from '../store/authStore';

export default function NetworkBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const setOnlineInStore = useAuthStore((state) => state.setOnline);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const updateOnlineStatus = () => {
        const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
        setIsOnline(online);
        setOnlineInStore(online);
      };

      updateOnlineStatus();
      if (typeof window !== 'undefined') {
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
      }

      return () => {
        if (typeof window !== 'undefined') {
          window.removeEventListener('online', updateOnlineStatus);
          window.removeEventListener('offline', updateOnlineStatus);
        }
      };
    }

    // Native mobile connectivity check
    let interval: any;
    const checkConnection = async () => {
      try {
        const res = await fetch('https://clients3.google.com/generate_204', {
          method: 'HEAD',
        });
        const online = res.status === 204;
        setIsOnline(online);
        setOnlineInStore(online);
      } catch {
        setIsOnline(false);
        setOnlineInStore(false);
      }
    };

    checkConnection();
    interval = setInterval(checkConnection, 15000);
    return () => clearInterval(interval);
  }, [setOnlineInStore]);

  if (isOnline) return null;

  return (
    <View style={styles.banner}>
      <IconButton icon="wifi-off" size={16} iconColor="#FFFFFF" style={styles.icon} />
      <Text style={styles.text}>
        Offline Mode — Showing cached data. Check-in & messaging require connection.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  icon: {
    margin: 0,
    marginRight: 4,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
});
