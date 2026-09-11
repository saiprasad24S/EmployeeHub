import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { EmployeeProfile } from '../types/employee';
import { LoginResponse } from '../lib/auth';

const secureStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await SecureStore.getItemAsync(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await SecureStore.deleteItemAsync(name);
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
  
  setAuth: (response: LoginResponse) => void;
  setSessionActive: (isActive: boolean) => void;
  setOnline: (isOnline: boolean) => void;
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

      setAuth: (response) => set((state) => ({
        ...state,
        role: response.role,
        employeeId: response.employee?.employee_id || null,
        profile: response.employee || null,
        isSessionActive: !!response.session_is_active,
        requiresFaceRegistration: !!response.requires_face_registration,
        activeSession: response.active_session || null,
      })),
      setSessionActive: (isActive) => set({ isSessionActive: isActive }),
      setOnline: (isOnline) => set({ isOnline }),
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
