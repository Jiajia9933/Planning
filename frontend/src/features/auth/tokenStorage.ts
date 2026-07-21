const TOKEN_KEY = 'hdd-planner:token'
const EMAIL_KEY = 'hdd-planner:email'

export function getToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY)
}

export function getStoredEmail(): string | null {
  return window.localStorage.getItem(EMAIL_KEY)
}

/** The backend's JWT only carries the user id, not the email — remembered
 * client-side (from what the user just typed logging in) purely for display
 * in the TopToolbar user menu. */
export function setSession(token: string, email: string): void {
  window.localStorage.setItem(TOKEN_KEY, token)
  window.localStorage.setItem(EMAIL_KEY, email)
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY)
  window.localStorage.removeItem(EMAIL_KEY)
}
