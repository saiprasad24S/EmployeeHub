import { authedFetch } from '../lib/api';
import { AttendanceRecord, MonthlyAttendanceDay } from '../types/employee';

export interface CheckInOutPayload {
  photoUri: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
  faceMatch?: boolean;
  livenessScore?: number;
}

export interface CheckInOutResponse {
  status: string;
  message?: string;
  attendance_id?: number;
  session_id?: number;
  login_time?: string;
  logout_time?: string;
}

export async function checkIn(
  payload: CheckInOutPayload,
  token: string
): Promise<CheckInOutResponse> {
  const formData = new FormData();
  const filename = payload.photoUri.split('/').pop() || 'checkin.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : 'image/jpeg';

  formData.append('selfie', {
    uri: payload.photoUri,
    name: filename,
    type,
  } as any);

  formData.append('latitude', String(payload.latitude));
  formData.append('longitude', String(payload.longitude));
  if (payload.accuracy !== undefined) {
    formData.append('accuracy', String(payload.accuracy));
  }
  if (payload.address) {
    formData.append('address', payload.address);
  }
  formData.append('face_match', payload.faceMatch !== false ? 'true' : 'false');
  formData.append('liveness_score', String(payload.livenessScore ?? 1.0));

  const res = await authedFetch('/api/attendance/checkin', token, {
    method: 'POST',
    body: formData,
  });
  return res.json();
}

export async function checkOut(
  payload: CheckInOutPayload,
  token: string
): Promise<CheckInOutResponse> {
  const formData = new FormData();
  const filename = payload.photoUri.split('/').pop() || 'checkout.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : 'image/jpeg';

  formData.append('selfie', {
    uri: payload.photoUri,
    name: filename,
    type,
  } as any);

  formData.append('latitude', String(payload.latitude));
  formData.append('longitude', String(payload.longitude));
  if (payload.accuracy !== undefined) {
    formData.append('accuracy', String(payload.accuracy));
  }
  if (payload.address) {
    formData.append('address', payload.address);
  }
  formData.append('face_match', payload.faceMatch !== false ? 'true' : 'false');
  formData.append('liveness_score', String(payload.livenessScore ?? 1.0));

  const res = await authedFetch('/api/attendance/checkout', token, {
    method: 'POST',
    body: formData,
  });
  return res.json();
}

export async function getAttendanceHistory(token: string): Promise<AttendanceRecord[]> {
  const res = await authedFetch('/api/attendance/', token);
  const data = await res.json();
  return Array.isArray(data) ? data : data.results || [];
}

export async function getMonthlyAttendance(
  employeeId: number | string,
  year: number,
  month: number,
  token: string
): Promise<{ days: MonthlyAttendanceDay[]; present_count: number; absent_count: number }> {
  const res = await authedFetch(
    `/api/attendance/employee-month?employee_id=${employeeId}&year=${year}&month=${month}`,
    token
  );
  const data = await res.json();
  return data;
}
