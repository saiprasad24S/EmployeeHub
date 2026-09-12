import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { EmployeeProfile } from '../types/employee';
import { LoginResponse } from '../lib/auth';

const isWeb = Platform.OS === 'web';

const secureStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (isWeb) {
      try {
        return typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem(name) : null;
      } catch {
        return null;
      }
    }
    try {
      return (await SecureStore.getItemAsync(name)) || null;
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (isWeb) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(name, value);
        }
      } catch {}
      return;
    }
    try {
      await SecureStore.setItemAsync(name, value);
    } catch {}
  },
  removeItem: async (name: string): Promise<void> => {
    if (isWeb) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(name);
        }
      } catch {}
      return;
    }
    try {
      await SecureStore.deleteItemAsync(name);
    } catch {}
  },
};

interface AuthState {
  role: 'ADMIN' | 'EMPLOYEE' | null;
  employeeId: string | null;
  profile: EmployeeProfile | null;
  isSessionActive: boolean;
  requiresFaceRegistration: boolean;
  activeSession: { login_time: string; duration_seconds: number } | null;
  isLoading: boolean;
  isOnline: boolean;
  authError: string | null;
  
  setAuth: (response: LoginResponse) => void;
  setSessionActive: (isActive: boolean) => void;
  setOnline: (isOnline: boolean) => void;
  setAuthError: (error: string | null) => void;
  updateProfile: (partial: Partial<EmployeeProfile>) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      role: null,
      employeeId: null,
      profile: null,
      isSessionActive: false,
      requiresFaceRegistration: false,
      activeSession: null,
      isLoading: false,
      isOnline: false,
      authError: null,

      setAuth: (response) => set((state) => ({
        ...state,
        role: response.role,
        employeeId: response.employee?.employee_id || null,
        profile: response.employee || null,
        isSessionActive: !!response.session_is_active,
        requiresFaceRegistration: !!response.requires_face_registration,
        activeSession: response.active_session || null,
        authError: null,
      })),
      setSessionActive: (isActive) => set({ isSessionActive: isActive }),
      setOnline: (isOnline) => set({ isOnline }),
      setAuthError: (error) => set({ authError: error }),
      updateProfile: (partial) => set((state) => ({
        profile: state.profile ? { ...state.profile, ...partial } : null
      })),
      clear: () => set({
        role: null,
        employeeId: null,
        profile: null,
        isSessionActive: false,
        requiresFaceRegistration: false,
        activeSession: null,
      }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        role: state.role,
        employeeId: state.employeeId,
        profile: state.profile,
      }),
    }
  )
);
