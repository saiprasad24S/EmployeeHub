export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

export async function authedFetch(input: string, token: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  if (!(init?.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  // Primary URL using configured base URL or relative path (Vite proxy)
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
  const primaryUrl = `${baseUrl}${input}`

  try {
    return await fetch(primaryUrl, { ...init, headers })
  } catch (primaryErr: any) {
    // If primary fetch fails (e.g. relative path without proxy), try dynamic hostname at port 8000
    if (typeof window !== 'undefined' && !baseUrl) {
      const hostname = window.location.hostname || 'localhost'
      const fallbackUrl = `http://${hostname}:8000${input}`
      try {
        console.warn(`[authedFetch] Primary request to ${primaryUrl} failed (${primaryErr?.message}). Retrying fallback: ${fallbackUrl}`)
        return await fetch(fallbackUrl, { ...init, headers })
      } catch (fallbackErr: any) {
        console.error(`[authedFetch] Fallback request to ${fallbackUrl} also failed:`, fallbackErr)
        throw new Error(`Unable to connect to backend server at ${primaryUrl} or ${fallbackUrl} (${fallbackErr?.message || primaryErr?.message})`)
      }
    }
    throw primaryErr
  }
}
