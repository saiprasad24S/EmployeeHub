import { authedFetch } from '../lib/api';
import { EmployeeProfile, Assignment } from '../types/employee';

export async function getEmployeeProfile(token: string): Promise<EmployeeProfile> {
  const res = await authedFetch('/api/employees/current/me/', token);
  return res.json();
}

export async function uploadProfilePhoto(
  photoUri: string,
  token: string,
  employeeId: number
): Promise<{ profile_photo: string }> {
  const formData = new FormData();
  const filename = photoUri.split('/').pop() || 'photo.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : 'image/jpeg';

  formData.append('profile_photo_file', {
    uri: photoUri,
    name: filename,
    type,
  } as any);

  const res = await authedFetch(`/api/employees/${employeeId}/upload-photo/`, token, {
    method: 'POST',
    body: formData,
  });
  return res.json();
}

export async function getTodayAssignment(token: string): Promise<Assignment | null> {
  try {
    const res = await authedFetch('/api/assignments/my-today/', token);
    const data = await res.json();
    return data || null;
  } catch (err: any) {
    if (err.status === 404) return null;
    throw err;
  }
}
