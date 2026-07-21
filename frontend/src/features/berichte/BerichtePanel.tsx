import { useEffect, useState } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import { PanelFrame } from '../../layout/PanelFrame'
import { colors } from '../../theme/tokens'
import { usePlanningStore } from '../../store/planningStore'

function formatCreatedAt(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })
}

export function BerichtePanel() {
  const reports = usePlanningStore((s) => s.reports)
  const currentProjectId = usePlanningStore((s) => s.currentProjectId)
  const loadReports = usePlanningStore((s) => s.loadReports)
  const downloadReport = usePlanningStore((s) => s.downloadReport)

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.resolve().then(() => {
      if (!cancelled) {
        setIsLoading(true)
        setError(null)
      }
    })
    loadReports()
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Berichte konnten nicht geladen werden.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProjectId])

  const handleDownload = async (id: string) => {
    setDownloadingId(id)
    try {
      await downloadReport(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bericht konnte nicht heruntergeladen werden.')
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <PanelFrame title="Berichte">
      <Stack sx={{ maxWidth: 640, mx: 'auto', gap: 1.5 }}>
        {!isLoading && reports.length === 0 && (
          <Typography variant="body2" color={colors.textSecondary}>
            Noch keine Berichte für dieses Projekt. Klicke oben rechts auf "Bericht erstellen".
          </Typography>
        )}

        {reports.map((r) => (
          <Box
            key={r.id}
            component="button"
            onClick={() => void handleDownload(r.id)}
            disabled={downloadingId !== null}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: 1.75,
              py: 1.25,
              border: `1px solid ${colors.border}`,
              borderRadius: 1.5,
              bgcolor: colors.bgPanel,
              cursor: downloadingId !== null ? 'default' : 'pointer',
              textAlign: 'left',
              opacity: downloadingId !== null && downloadingId !== r.id ? 0.6 : 1,
              '&:hover': downloadingId === null ? { bgcolor: colors.bgElevated } : undefined,
            }}
          >
            <PictureAsPdfOutlinedIcon sx={{ fontSize: 20, color: colors.textSecondary }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }} color={colors.textPrimary}>
                {r.projectName}
              </Typography>
              <Typography variant="caption" color={colors.textSecondary}>
                {formatCreatedAt(r.createdAt)}
              </Typography>
            </Box>
          </Box>
        ))}

        {error && (
          <Typography variant="caption" color={colors.accentRed}>
            {error}
          </Typography>
        )}
      </Stack>
    </PanelFrame>
  )
}
