export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || '';
export const WS_BASE_URL = process.env.EXPO_PUBLIC_WS_BASE_URL || '';

export interface ApiError {
  status: number;
  message: string;
  detail?: string;
}

export async function handleApiError(response: Response): Promise<never> {
  let message = 'An unexpected error occurred';
  let detail: string | undefined;

  try {
    const data = await response.json();
    if (data.message) {
      message = data.message;
    } else if (data.detail) {
      message = data.detail;
    }
    if (data.detail && data.message) {
      detail = data.detail;
    }
  } catch (e) {
    // Cannot parse JSON, keep default message
    message = response.statusText || message;
  }

  const error: ApiError = {
    status: response.status,
    message,
    detail,
  };
  throw error;
}

export async function authedFetch(
  path: string,
  token: string,
  init?: RequestInit
): Promise<Response> {
  const url = `${API_BASE_URL}${path}`;
  const headers = new Headers(init?.headers);

  headers.set('Authorization', `Bearer ${token}`);

  if (init?.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers,
    });
  } catch (error) {
    throw new Error('Network request failed. Please check your connection.');
  }

  if (!response.ok) {
    await handleApiError(response);
  }

  return response;
}
