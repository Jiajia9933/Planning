import { Box, Stack, Typography } from '@mui/material'
import { navItems } from './navItems'
import { colors } from '../theme/tokens'
import { usePlanningStore } from '../store/planningStore'

export function LeftNavRail() {
  const activeId = usePlanningStore((s) => s.activeNavId)
  const setActiveId = usePlanningStore((s) => s.setActiveNavId)

  return (
    <Box
      component="nav"
      sx={{
        gridArea: 'nav',
        bgcolor: colors.bgPanel,
        borderRight: `1px solid ${colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}
    >
      <Box sx={{ px: 2, py: 2.25 }}>
        <Typography variant="subtitle1" color={colors.textPrimary} sx={{ fontWeight: 700 }}>
          HDD Planner
        </Typography>
      </Box>

      <Stack sx={{ px: 1, gap: 0.25 }}>
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = item.id === activeId
          return (
            <Box
              key={item.id}
              component="button"
              onClick={() => setActiveId(item.id)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                px: 1.5,
                py: 1,
                border: 'none',
                borderRadius: 1,
                cursor: 'pointer',
                textAlign: 'left',
                bgcolor: isActive ? 'rgba(59,130,246,0.16)' : 'transparent',
                color: isActive ? '#ffffff' : colors.textSecondary,
                transition: 'background-color 120ms ease, color 120ms ease',
                '&:hover': {
                  bgcolor: isActive ? 'rgba(59,130,246,0.22)' : colors.bgElevated,
                  color: colors.textPrimary,
                },
              }}
            >
              <Icon sx={{ fontSize: 20, color: isActive ? colors.accentBlue : 'inherit' }} />
              <Typography variant="body2" sx={{ fontWeight: isActive ? 600 : 500 }}>
                {item.label}
              </Typography>
            </Box>
          )
        })}
      </Stack>
    </Box>
  )
}
