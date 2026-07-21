import { useState } from 'react'
import type { FormEvent } from 'react'
import { Box, Button, Stack, TextField, Typography } from '@mui/material'
import { AuthLayout } from './AuthLayout'
import { useAuthStore } from './authStore'
import { colors } from '../../theme/tokens'

interface RegisterPageProps {
  onSwitchToLogin: () => void
}

export function RegisterPage({ onSwitchToLogin }: RegisterPageProps) {
  const register = useAuthStore((s) => s.register)
  const error = useAuthStore((s) => s.error)
  const clearError = useAuthStore((s) => s.clearError)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const mismatch = passwordConfirm.length > 0 && password !== passwordConfirm

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (mismatch) return
    setIsSubmitting(true)
    try {
      await register(email, password)
    } catch {
      // error message is already set in the store
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Konto erstellen">
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          <TextField
            label="E-Mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            required
            autoFocus
          />
          <TextField
            label="Passwort"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            helperText="Mindestens 8 Zeichen"
            fullWidth
            required
          />
          <TextField
            label="Passwort bestätigen"
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            error={mismatch}
            helperText={mismatch ? 'Passwörter stimmen nicht überein' : ' '}
            fullWidth
            required
          />
          {error && (
            <Typography variant="caption" color={colors.accentRed}>
              {error}
            </Typography>
          )}
          <Button type="submit" variant="contained" fullWidth loading={isSubmitting} disabled={mismatch}>
            Registrieren
          </Button>
          <Button
            variant="text"
            onClick={() => {
              clearError()
              onSwitchToLogin()
            }}
            sx={{ color: colors.textSecondary }}
          >
            Bereits ein Konto? Anmelden
          </Button>
        </Stack>
      </Box>
    </AuthLayout>
  )
}
