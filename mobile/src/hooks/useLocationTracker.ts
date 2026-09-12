import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { useAuth } from '@clerk/clerk-expo';
import { useAuthStore } from '../store/authStore';
import { sendLocationPing } from '../api/locationApi';

export function useLocationTracker() {
  const { getToken } = useAuth();
  const isSessionActive = useAuthStore((state) => state.isSessionActive);
  const watcherRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function startTracking() {
      if (!isSessionActive) {
        if (watcherRef.current) {
          watcherRef.current.remove();
          watcherRef.current = null;
        }
        return;
      }

      try {
        const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
        if (fgStatus !== 'granted') return;

        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 45000, // Ping every 45 seconds
            distanceInterval: 25, // Or if moved 25m
          },
          async (loc) => {
            if (!isMounted) return;
            try {
              const token = await getToken();
              if (token) {
                await sendLocationPing(
                  {
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                    accuracy: loc.coords.accuracy ?? undefined,
                    speed: loc.coords.speed ?? undefined,
                    is_mock: loc.mocked ?? false,
                  },
                  token
                );
              }
            } catch (err) {
              // Silently retry next interval
            }
          }
        );

        if (isMounted) {
          watcherRef.current = sub;
        } else {
          sub.remove();
        }
      } catch (err) {
        console.warn('Location tracking initialization failed', err);
      }
    }

    startTracking();

    return () => {
      isMounted = false;
      if (watcherRef.current) {
        watcherRef.current.remove();
        watcherRef.current = null;
      }
    };
  }, [isSessionActive, getToken]);
}
