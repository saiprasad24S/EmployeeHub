import { authedFetch } from './api';
import { EmployeeProfile } from '../types/employee';

export interface LoginResponse {
  role: 'ADMIN' | 'EMPLOYEE';
  employee?: EmployeeProfile;
  session_is_active?: boolean;
  requires_face_registration?: boolean;
  active_session?: {
    login_time: string;
    duration_seconds: number;
  };
}

export async function loginToBackend(token: string): Promise<LoginResponse> {
  const response = await authedFetch('/api/auth/login', token, {
    method: 'POST',
  });
  return response.json();
}

export async function logoutFromBackend(token: string): Promise<void> {
  await authedFetch('/api/auth/logout', token, {
    method: 'POST',
  });
}
