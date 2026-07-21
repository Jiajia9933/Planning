import { useState } from 'react'
import type { FormEvent } from 'react'
import { Box, Button, Stack, TextField, Typography } from '@mui/material'
import { AuthLayout } from './AuthLayout'
import { useAuthStore } from './authStore'
import { usePlanningStore } from '../../store/planningStore'
import { colors } from '../../theme/tokens'

/** Shown after login/register once we know the user has no project yet — creating one is always an explicit action. */
export function CreateProjectPage() {
  const createProject = usePlanningStore((s) => s.createProject)
  const logout = useAuthStore((s) => s.logout)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await createProject(name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Projekt konnte nicht erstellt werden.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Neues Projekt anlegen">
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          <Typography variant="body2" color={colors.textSecondary}>
            Jeder Bauleiter arbeitet an seinem eigenen Projekt — gib ihm einen Namen, um loszulegen.
          </Typography>
          <TextField
            label="Projektname"
            value={name}
            onChange={(e) => setName(e.target.value)}
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
            Projekt erstellen
          </Button>
          <Button variant="text" onClick={logout} sx={{ color: colors.textSecondary }}>
            Abmelden
          </Button>
        </Stack>
      </Box>
    </AuthLayout>
  )
}
