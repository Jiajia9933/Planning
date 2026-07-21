import { useState } from 'react'
import type { MouseEvent } from 'react'
import { Box, Button, IconButton, Stack, Typography, Tooltip, Menu, MenuItem, Divider } from '@mui/material'
import UndoIcon from '@mui/icons-material/Undo'
import RedoIcon from '@mui/icons-material/Redo'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import HelpOutlineIcon from '@mui/icons-material/HelpOutlineOutlined'
import PersonOutlineIcon from '@mui/icons-material/PersonOutlineOutlined'
import { colors } from '../theme/tokens'
import { useAuthStore } from '../features/auth/authStore'

interface TopToolbarProps {
  projectName: string
  projectCode: string
  onSave: () => void
  isSaving?: boolean
  onExport: () => void
  onCreateReport: () => void
}

export function TopToolbar({
  projectName,
  projectCode,
  onSave,
  isSaving,
  onExport,
  onCreateReport,
}: TopToolbarProps) {
  const email = useAuthStore((s) => s.email)
  const logout = useAuthStore((s) => s.logout)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)

  const handleOpenMenu = (e: MouseEvent<HTMLElement>) => setMenuAnchor(e.currentTarget)
  const handleCloseMenu = () => setMenuAnchor(null)

  return (
    <Box
      component="header"
      sx={{
        gridArea: 'toolbar',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 2,
        bgcolor: colors.bgPanel,
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      <Box>
        <Typography variant="body1" color={colors.textPrimary} sx={{ fontWeight: 700, lineHeight: 1.2 }}>
          {projectName}
        </Typography>
        <Typography variant="caption" color={colors.textMuted}>
          {projectCode}
        </Typography>
      </Box>

      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Button variant="text" size="small" sx={{ color: colors.textSecondary }} onClick={onSave} loading={isSaving}>
          Speichern
        </Button>
        <Button
          variant="text"
          size="small"
          sx={{ color: colors.textSecondary }}
          onClick={onExport}
        >
          Exportieren
        </Button>
        <Button variant="contained" size="small" onClick={onCreateReport}>
          Bericht erstellen
        </Button>

        <Stack direction="row" sx={{ ml: 1, borderLeft: `1px solid ${colors.border}`, pl: 1 }}>
          <Tooltip title="Rückgängig">
            <IconButton size="small" sx={{ color: colors.textSecondary }}>
              <UndoIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Wiederholen">
            <IconButton size="small" sx={{ color: colors.textSecondary }}>
              <RedoIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Automatisch gespeichert">
            <IconButton size="small" sx={{ color: colors.textSecondary }}>
              <SaveOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        <Stack direction="row" sx={{ ml: 1, borderLeft: `1px solid ${colors.border}`, pl: 1 }}>
          <IconButton size="small" sx={{ color: colors.textSecondary }}>
            <HelpOutlineIcon fontSize="small" />
          </IconButton>
          <Tooltip title={email ?? ''}>
            <IconButton size="small" sx={{ color: colors.textSecondary }} onClick={handleOpenMenu}>
              <PersonOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={handleCloseMenu}>
            {email && (
              <MenuItem disabled sx={{ opacity: '1 !important' }}>
                <Typography variant="caption" color={colors.textMuted}>
                  {email}
                </Typography>
              </MenuItem>
            )}
            <Divider />
            <MenuItem
              onClick={() => {
                handleCloseMenu()
                logout()
              }}
            >
              Abmelden
            </MenuItem>
          </Menu>
        </Stack>
      </Stack>
    </Box>
  )
}
