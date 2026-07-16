import { useCallback, useState } from 'react'

interface ToastState {
  message: string
  key: number
}

/** Minimal toast queue for one-off action feedback (save/export/report). */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null)

  const showToast = useCallback((message: string) => {
    setToast({ message, key: Date.now() })
  }, [])

  const closeToast = useCallback(() => setToast(null), [])

  return { toast, showToast, closeToast }
}
