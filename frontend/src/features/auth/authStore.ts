import { create } from 'zustand'
import { apiFetch, onUnauthorized, ApiError } from './api'
import { getToken, getStoredEmail, setSession, clearToken } from './tokenStorage'

interface AuthState {
  status: 'anonymous' | 'authenticated'
  email: string | null
  error: string | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
  clearError: () => void
  requestPasswordReset: (email: string) => Promise<void>
  resetPassword: (token: string, newPassword: string) => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  status: getToken() ? 'authenticated' : 'anonymous',
  email: getStoredEmail(),
  error: null,

  login: async (email, password) => {
    set({ error: null })
    try {
      const data = await apiFetch<{ token: string }>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      })
      setSession(data.token, email)
      set({ status: 'authenticated', email })
    } catch (err) {
      set({ error: err instanceof ApiError ? err.message : 'Anmeldung fehlgeschlagen.' })
      throw err
    }
  },

  register: async (email, password) => {
    set({ error: null })
    try {
      const data = await apiFetch<{ token: string }>('/api/auth/register', {
        method: 'POST',
        body: { email, password },
      })
      setSession(data.token, email)
      set({ status: 'authenticated', email })
    } catch (err) {
      set({ error: err instanceof ApiError ? err.message : 'Registrierung fehlgeschlagen.' })
      throw err
    }
  },

  logout: () => {
    clearToken()
    set({ status: 'anonymous', email: null, error: null })
  },

  clearError: () => set({ error: null }),

  // Always resolves (even for an unregistered email — the backend responds
  // identically either way so this can't be used to enumerate accounts).
  requestPasswordReset: async (email) => {
    set({ error: null })
    try {
      await apiFetch('/api/auth/forgot-password', { method: 'POST', body: { email } })
    } catch (err) {
      set({ error: err instanceof ApiError ? err.message : 'Anfrage fehlgeschlagen.' })
      throw err
    }
  },

  resetPassword: async (token, newPassword) => {
    set({ error: null })
    try {
      const data = await apiFetch<{ token: string; email: string | null }>('/api/auth/reset-password', {
        method: 'POST',
        body: { token, password: newPassword },
      })
      setSession(data.token, data.email ?? '')
      set({ status: 'authenticated', email: data.email })
    } catch (err) {
      set({ error: err instanceof ApiError ? err.message : 'Zurücksetzen fehlgeschlagen.' })
      throw err
    }
  },
}))

onUnauthorized(() => useAuthStore.getState().logout())
