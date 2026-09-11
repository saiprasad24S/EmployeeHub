import { authedFetch } from '../lib/api';

export interface LocationBreadcrumbPayload {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  battery_percentage?: number;
  is_mock?: boolean;
}

export async function sendLocationPing(
  payload: LocationBreadcrumbPayload,
  token: string
): Promise<{ status: string }> {
  const res = await authedFetch('/api/location/update', token, {
    method: 'POST',
    body: JSON.stringify({
      latitude: payload.latitude,
      longitude: payload.longitude,
      accuracy: payload.accuracy ?? null,
      speed: payload.speed ?? null,
      battery_percentage: payload.battery_percentage ?? null,
      is_mock: payload.is_mock ?? false,
    }),
  });
  return res.json();
}
