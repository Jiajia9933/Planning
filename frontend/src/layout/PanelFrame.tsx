import type { ReactNode } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import { colors } from '../theme/tokens'

interface PanelFrameProps {
  title: string
  actions?: ReactNode
  children: ReactNode
  bodySx?: object
  noPadding?: boolean
}

/** Shared chrome (header + scrollable body) reused by every dockable panel. */
export function PanelFrame({ title, actions, children, bodySx, noPadding }: PanelFrameProps) {
  return (
    <Box
      sx={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        minWidth: 0,
        bgcolor: colors.bgApp,
      }}
    >
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.75,
          py: 1,
          borderBottom: `1px solid ${colors.border}`,
          flexShrink: 0,
        }}
      >
        <Typography variant="body2" color={colors.textPrimary} sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        {actions}
      </Stack>
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          position: 'relative',
          p: noPadding ? 0 : 1.75,
          overflow: 'auto',
          ...bodySx,
        }}
      >
        {children}
      </Box>
    </Box>
  )
}
