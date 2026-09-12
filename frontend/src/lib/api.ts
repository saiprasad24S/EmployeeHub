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
    // Only attempt localhost:8000 fallback during local development on HTTP loopback/LAN addresses
    if (typeof window !== 'undefined' && !baseUrl) {
      const hostname = window.location.hostname || 'localhost'
      const isLocalDev =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.')
      if (isLocalDev && window.location.protocol === 'http:') {
        const fallbackUrl = `http://${hostname}:8000${input}`
        try {
          console.warn(`[authedFetch] Primary request to ${primaryUrl} failed (${primaryErr?.message}). Retrying fallback: ${fallbackUrl}`)
          return await fetch(fallbackUrl, { ...init, headers })
        } catch (fallbackErr: any) {
          console.error(`[authedFetch] Fallback request to ${fallbackUrl} also failed:`, fallbackErr)
          throw new Error(`Unable to connect to backend server at ${primaryUrl} or ${fallbackUrl} (${fallbackErr?.message || primaryErr?.message})`)
        }
      }
    }
    if (primaryErr instanceof TypeError && (primaryErr.message === 'Failed to fetch' || primaryErr.message.includes('fetch'))) {
      const target = primaryUrl || (typeof window !== 'undefined' ? `${window.location.origin}${input}` : input)
      throw new Error(`Unable to connect to backend server at ${target} (Failed to fetch). Please check your internet connection or server availability.`)
    }
    throw primaryErr
  }
}
