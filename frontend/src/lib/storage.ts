const memoryStore = new Map<string, string>()

export const safeMemoryStorage = {
  getItem: (key: string): string | null => memoryStore.get(String(key)) ?? null,
  setItem: (key: string, value: string): void => {
    memoryStore.set(String(key), String(value))
  },
  removeItem: (key: string): void => {
    memoryStore.delete(String(key))
  },
  clear: (): void => {
    memoryStore.clear()
  },
  key: (index: number): string | null => Array.from(memoryStore.keys())[index] ?? null,
  get length(): number {
    return memoryStore.size
  },
}

export function initStoragePolyfill() {
  if (typeof window === 'undefined') return

  const testAccess = (type: 'localStorage' | 'sessionStorage') => {
    try {
      const storage = window[type]
      if (!storage) return false
      const testKey = '__test_access__'
      storage.setItem(testKey, testKey)
      storage.removeItem(testKey)
      return true
    } catch {
      return false
    }
  }

  if (!testAccess('localStorage')) {
    try {
      Object.defineProperty(window, 'localStorage', {
        value: safeMemoryStorage,
        writable: true,
        configurable: true,
      })
    } catch (e) {
      console.warn('[StoragePolyfill] Could not redefine window.localStorage property:', e)
    }
  }

  if (!testAccess('sessionStorage')) {
    try {
      Object.defineProperty(window, 'sessionStorage', {
        value: safeMemoryStorage,
        writable: true,
        configurable: true,
      })
    } catch (e) {
      console.warn('[StoragePolyfill] Could not redefine window.sessionStorage property:', e)
    }
  }
}

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return safeMemoryStorage.getItem(key)
    }
  },
  setItem(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value)
    } catch {
      safeMemoryStorage.setItem(key, value)
    }
  },
  removeItem(key: string): void {
    try {
      window.localStorage.removeItem(key)
    } catch {
      safeMemoryStorage.removeItem(key)
    }
  },
}
