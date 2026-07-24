import { useEffect, useRef } from 'react'
import { authedFetch } from '../lib/api'

export function useLocationTracker(getToken: () => Promise<string | null>) {
  const watchIdRef = useRef<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const isCheckedIn = localStorage.getItem('skandan_active_session') === 'true'
    if (!isCheckedIn) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    const sendLocationUpdate = async (latitude: number, longitude: number, accuracy?: number) => {
      try {
        const token = await getToken()
        if (token) {
          await authedFetch('/api/location/update', token, {
            method: 'POST',
            body: JSON.stringify({
              latitude,
              longitude,
              accuracy: accuracy ?? 1.0,
              is_mock: false,
            }),
          })
        } else {
          // If logged out of Clerk but session active, buffer coordinates in localStorage
          const queue = JSON.parse(localStorage.getItem('skandan_offline_locations') || '[]')
          queue.push({ latitude, longitude, accuracy: accuracy ?? 1.0, timestamp: new Date().toISOString() })
          localStorage.setItem('skandan_offline_locations', JSON.stringify(queue.slice(-50)))
        }
      } catch (err) {
        console.warn('Background location tracking update failed', err)
      }
    }

    const requestAndLogLocation = () => {
      if (!('geolocation' in navigator)) return
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          sendLocationUpdate(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy)
        },
        (err) => {
          console.warn('GPS location error in background tracker', err)
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
      )
    }

    // Immediate initial check
    requestAndLogLocation()

    // 45-second fallback interval
    intervalRef.current = setInterval(requestAndLogLocation, 45000)

    // Watch position for movement
    if ('geolocation' in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          sendLocationUpdate(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy)
        },
        () => {},
        { enableHighAccuracy: true, distanceFilter: 10 } as PositionOptions
      )
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [getToken])
}
