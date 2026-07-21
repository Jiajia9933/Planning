import type { ReactNode } from 'react'
import { Box, Paper, Typography } from '@mui/material'
import { colors } from '../../theme/tokens'

interface AuthLayoutProps {
  title: string
  children: ReactNode
}

/** Shared centered-card chrome for login/register/create-project — the only screens shown before AppShell mounts. */
export function AuthLayout({ title, children }: AuthLayoutProps) {
  return (
    <Box
      sx={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        bgcolor: colors.bgApp,
      }}
    >
      <Typography variant="h6" color={colors.textPrimary} sx={{ fontWeight: 700 }}>
        HDD Planner
      </Typography>
      <Paper
        variant="outlined"
        sx={{
          width: 360,
          maxWidth: '90vw',
          p: 3,
          bgcolor: colors.bgPanel,
          borderColor: colors.border,
        }}
      >
        <Typography variant="subtitle1" color={colors.textPrimary} sx={{ fontWeight: 700, mb: 2 }}>
          {title}
        </Typography>
        {children}
      </Paper>
    </Box>
  )
}
