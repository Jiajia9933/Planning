import { useState } from 'react'
import type { FormEvent } from 'react'
import { Box, Button, Stack, TextField, Typography } from '@mui/material'
import { AuthLayout } from './AuthLayout'
import { useAuthStore } from './authStore'
import { colors } from '../../theme/tokens'

interface ResetPasswordPageProps {
  token: string
  onDone: () => void
}

export function ResetPasswordPage({ token, onDone }: ResetPasswordPageProps) {
  const resetPassword = useAuthStore((s) => s.resetPassword)
  const error = useAuthStore((s) => s.error)
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const mismatch = passwordConfirm.length > 0 && password !== passwordConfirm

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (mismatch) return
    setIsSubmitting(true)
    try {
      await resetPassword(token, password)
      onDone()
    } catch {
      // error message is already set in the store — link may be expired/used
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Neues Passwort setzen">
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          <TextField
            label="Neues Passwort"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            helperText="Mindestens 8 Zeichen"
            fullWidth
            required
            autoFocus
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
            Passwort speichern
          </Button>
        </Stack>
      </Box>
    </AuthLayout>
  )
}
