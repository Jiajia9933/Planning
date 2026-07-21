import { getToken, clearToken } from './tokenStorage'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// Registered by authStore.ts (avoids a circular import between the two
// stores) so any 401 anywhere logs the user out instead of leaving the app
// stuck retrying with a dead token.
let unauthorizedHandler: (() => void) | null = null
export function onUnauthorized(handler: () => void) {
  unauthorizedHandler = handler
}

interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const token = getToken()
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  if (response.status === 401) {
    clearToken()
    unauthorizedHandler?.()
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}) as { error?: string })
    throw new ApiError(response.status, body.error ?? `Anfrage fehlgeschlagen (${response.status})`)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

/** Same auth-header/401-handling as `apiFetch`, but for binary responses (report PDF downloads) that shouldn't be parsed as JSON. */
export async function apiFetchBlob(path: string): Promise<Blob> {
  const token = getToken()
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })

  if (response.status === 401) {
    clearToken()
    unauthorizedHandler?.()
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}) as { error?: string })
    throw new ApiError(response.status, body.error ?? `Anfrage fehlgeschlagen (${response.status})`)
  }

  return response.blob()
}
