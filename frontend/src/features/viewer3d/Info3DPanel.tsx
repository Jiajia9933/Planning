import { useMemo } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import { colors, utilityColors } from '../../theme/tokens'
import { usePlanningStore } from '../../store/planningStore'
import { mockUtilityLayers } from '../../data/mockPlanning'

const utilityLabels = Object.fromEntries(mockUtilityLayers.map((l) => [l.type, l.label]))

export function Info3DPanel() {
  const parameters = usePlanningStore((s) => s.parameters)
  const result = usePlanningStore((s) => s.result)
  const conflicts = usePlanningStore((s) => s.conflicts)

  // Real crossed utilities, not a hardcoded mockup — one dot per unique
  // type actually crossed (conflicts already arrive sorted by distanceM, so
  // the first occurrence per type is the one nearest the entry point),
  // spread evenly around the circle. Empty when nothing's been calculated
  // yet, which naturally degrades to just the bare ring/hub below.
  const crossSection = useMemo(() => {
    const byType = new Map<string, (typeof conflicts)[number]>()
    for (const c of conflicts) {
      if (!byType.has(c.type)) byType.set(c.type, c)
    }
    const entries = [...byType.values()]
    return entries.map((crossing, i) => ({
      key: crossing.type,
      label: utilityLabels[crossing.type],
      distanceM: crossing.utilityDepthM,
      angleDeg: -90 + (360 / entries.length) * i,
    }))
  }, [conflicts])

  return (
    <Box
      sx={{
        gridArea: 'panelBottom',
        borderLeft: `1px solid ${colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        bgcolor: colors.bgApp,
        overflow: 'auto',
      }}
    >
      <Box sx={{ px: 1.75, py: 1, borderBottom: `1px solid ${colors.border}` }}>
        <Typography variant="body2" color={colors.textPrimary} sx={{ fontWeight: 700 }}>
          3D Informationen
        </Typography>
      </Box>

      <Box sx={{ p: 1.75, flex: 1 }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-end', mb: 2 }}>
          <InfoStat label="Eintrittswinkel" value={`${parameters.entryAngleDeg}°`} align="left" />
          <InfoStat label="Max. Tiefe" value={`${result.maxDepthM.toFixed(2)} m`} align="center" />
          <InfoStat label="Austrittswinkel" value={`${parameters.exitAngleDeg}°`} align="right" />
        </Stack>

        <Box sx={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', maxWidth: 220, mx: 'auto' }}>
          <Box
            component="svg"
            viewBox="0 0 100 100"
            sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          >
            <circle cx={50} cy={50} r={38} fill="none" stroke={colors.border} strokeWidth={1} />
            <circle cx={50} cy={50} r={9} fill={colors.bgElevated} stroke={colors.accentOrange} strokeWidth={1.5} />
            {crossSection.map((item) => {
              const rad = (item.angleDeg * Math.PI) / 180
              const x = 50 + Math.cos(rad) * 38
              const y = 50 + Math.sin(rad) * 38
              return (
                <g key={item.key}>
                  <line x1={50} y1={50} x2={x} y2={y} stroke={utilityColors[item.key]} strokeOpacity={0.5} strokeWidth={0.6} />
                  <circle cx={x} cy={y} r={3} fill={utilityColors[item.key]} />
                </g>
              )
            })}
          </Box>

          <Typography
            variant="caption"
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: colors.textPrimary,
              fontWeight: 700,
              fontSize: 10,
              textAlign: 'center',
              lineHeight: 1.2,
            }}
          >
            Bohrung
            <br />Ø{parameters.pipeDiameterMm}mm
          </Typography>

          {crossSection.map((item) => {
            const rad = (item.angleDeg * Math.PI) / 180
            const leftPct = 50 + Math.cos(rad) * 46
            const topPct = 50 + Math.sin(rad) * 46
            return (
              <Box
                key={item.key}
                sx={{
                  position: 'absolute',
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                }}
              >
                <Typography variant="caption" color={colors.textSecondary} sx={{ display: 'block', fontSize: 10 }}>
                  {item.label}
                </Typography>
                <Typography variant="caption" color={colors.textPrimary} sx={{ display: 'block', fontWeight: 700, fontSize: 10 }}>
                  {item.distanceM.toFixed(2)} m
                </Typography>
              </Box>
            )
          })}
        </Box>
      </Box>
    </Box>
  )
}

function InfoStat({ label, value, align }: { label: string; value: string; align: 'left' | 'center' | 'right' }) {
  return (
    <Stack sx={{ textAlign: align }}>
      <Typography variant="caption" color={colors.textMuted} sx={{ fontSize: 10 }}>
        {label}
      </Typography>
      <Typography variant="body2" color={colors.textPrimary} sx={{ fontWeight: 700 }}>
        {value}
      </Typography>
    </Stack>
  )
}
