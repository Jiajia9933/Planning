import { useState } from 'react'
import type { FormEvent } from 'react'
import { Box, Button, Stack, TextField, Typography } from '@mui/material'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import { PanelFrame } from '../../layout/PanelFrame'
import { colors } from '../../theme/tokens'
import { usePlanningStore } from '../../store/planningStore'

function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })
}

export function ProjektPanel() {
  const projects = usePlanningStore((s) => s.projects)
  const currentProjectId = usePlanningStore((s) => s.currentProjectId)
  const openProject = usePlanningStore((s) => s.openProject)
  const createProject = usePlanningStore((s) => s.createProject)

  const [isCreating, setIsCreating] = useState(false)
  const [isOpening, setIsOpening] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleOpen = async (id: string) => {
    if (id === currentProjectId) return
    setIsOpening(id)
    try {
      await openProject(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Projekt konnte nicht geöffnet werden.')
    } finally {
      setIsOpening(null)
    }
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await createProject(name)
      setName('')
      setIsCreating(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Projekt konnte nicht erstellt werden.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <PanelFrame title="Projekte">
      <Stack sx={{ maxWidth: 640, mx: 'auto', gap: 2 }}>
        {projects.length === 0 && !isCreating && (
          <Typography variant="body2" color={colors.textSecondary}>
            Noch keine Projekte vorhanden. Leg dein erstes Projekt an, um loszulegen.
          </Typography>
        )}

        <Stack sx={{ gap: 1 }}>
          {projects.map((p) => {
            const isActive = p.id === currentProjectId
            return (
              <Box
                key={p.id}
                component="button"
                onClick={() => void handleOpen(p.id)}
                disabled={isOpening !== null}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 1.75,
                  py: 1.25,
                  border: `1px solid ${isActive ? colors.accentBlue : colors.border}`,
                  borderRadius: 1.5,
                  bgcolor: isActive ? 'rgba(59,130,246,0.10)' : colors.bgPanel,
                  cursor: isOpening !== null ? 'default' : 'pointer',
                  textAlign: 'left',
                  opacity: isOpening !== null && isOpening !== p.id ? 0.6 : 1,
                  '&:hover': isOpening === null ? { bgcolor: colors.bgElevated } : undefined,
                }}
              >
                <FolderOutlinedIcon sx={{ fontSize: 20, color: isActive ? colors.accentBlue : colors.textSecondary }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }} color={colors.textPrimary}>
                    {p.name}
                  </Typography>
                  <Typography variant="caption" color={colors.textSecondary}>
                    {p.code} · zuletzt geändert {formatUpdatedAt(p.updatedAt)}
                  </Typography>
                </Box>
                {isActive && (
                  <Typography variant="caption" sx={{ fontWeight: 700, color: colors.accentBlue }}>
                    Geöffnet
                  </Typography>
                )}
              </Box>
            )
          })}
        </Stack>

        {isCreating ? (
          <Box component="form" onSubmit={handleCreate}>
            <Stack sx={{ gap: 1.5 }}>
              <TextField
                label="Projektname"
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
                required
                autoFocus
                size="small"
              />
              <Stack direction="row" sx={{ gap: 1 }}>
                <Button type="submit" variant="contained" loading={isSubmitting}>
                  Projekt erstellen
                </Button>
                <Button
                  variant="text"
                  onClick={() => {
                    setIsCreating(false)
                    setName('')
                    setError(null)
                  }}
                  sx={{ color: colors.textSecondary }}
                >
                  Abbrechen
                </Button>
              </Stack>
            </Stack>
          </Box>
        ) : (
          <Button variant="outlined" onClick={() => setIsCreating(true)} sx={{ alignSelf: 'flex-start' }}>
            + Neues Projekt
          </Button>
        )}

        {error && (
          <Typography variant="caption" color={colors.accentRed}>
            {error}
          </Typography>
        )}
      </Stack>
    </PanelFrame>
  )
}
