import { useState } from 'react'
import type { FormEvent } from 'react'
import { Box, Button, Stack, TextField, Typography } from '@mui/material'
import { AuthLayout } from './AuthLayout'
import { useAuthStore } from './authStore'
import { colors } from '../../theme/tokens'

interface ForgotPasswordPageProps {
  onSwitchToLogin: () => void
}

export function ForgotPasswordPage({ onSwitchToLogin }: ForgotPasswordPageProps) {
  const requestPasswordReset = useAuthStore((s) => s.requestPasswordReset)
  const error = useAuthStore((s) => s.error)
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await requestPasswordReset(email)
      setSent(true)
    } catch {
      // error message is already set in the store
    } finally {
      setIsSubmitting(false)
    }
  }

  if (sent) {
    return (
      <AuthLayout title="E-Mail unterwegs">
        <Stack spacing={2}>
          <Typography variant="body2" color={colors.textSecondary}>
            Falls ein Konto mit dieser E-Mail existiert, haben wir gerade einen Link zum Zurücksetzen des Passworts
            verschickt. Prüfe dein Postfach.
          </Typography>
          <Button variant="text" onClick={onSwitchToLogin} sx={{ color: colors.textSecondary }}>
            Zurück zur Anmeldung
          </Button>
        </Stack>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Passwort vergessen">
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          <Typography variant="body2" color={colors.textSecondary}>
            Gib deine E-Mail-Adresse ein — wir schicken dir einen Link zum Zurücksetzen des Passworts.
          </Typography>
          <TextField
            label="E-Mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            required
            autoFocus
          />
          {error && (
            <Typography variant="caption" color={colors.accentRed}>
              {error}
            </Typography>
          )}
          <Button type="submit" variant="contained" fullWidth loading={isSubmitting}>
            Link senden
          </Button>
          <Button variant="text" onClick={onSwitchToLogin} sx={{ color: colors.textSecondary }}>
            Zurück zur Anmeldung
          </Button>
        </Stack>
      </Box>
    </AuthLayout>
  )
}
