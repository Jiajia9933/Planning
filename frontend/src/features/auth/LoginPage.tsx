import { useState } from 'react'
import type { FormEvent } from 'react'
import { Box, Button, Stack, TextField, Typography } from '@mui/material'
import { AuthLayout } from './AuthLayout'
import { useAuthStore } from './authStore'
import { colors } from '../../theme/tokens'

interface LoginPageProps {
  onSwitchToRegister: () => void
  onForgotPassword: () => void
}

export function LoginPage({ onSwitchToRegister, onForgotPassword }: LoginPageProps) {
  const login = useAuthStore((s) => s.login)
  const error = useAuthStore((s) => s.error)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await login(email, password)
    } catch {
      // error message is already set in the store
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Anmelden">
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
            fullWidth
            required
          />
          {error && (
            <Typography variant="caption" color={colors.accentRed}>
              {error}
            </Typography>
          )}
          <Button type="submit" variant="contained" fullWidth loading={isSubmitting}>
            Anmelden
          </Button>
          <Button variant="text" onClick={onForgotPassword} sx={{ color: colors.textSecondary }}>
            Passwort vergessen?
          </Button>
          <Button variant="text" onClick={onSwitchToRegister} sx={{ color: colors.textSecondary }}>
            Noch kein Konto? Registrieren
          </Button>
        </Stack>
      </Box>
    </AuthLayout>
  )
}
