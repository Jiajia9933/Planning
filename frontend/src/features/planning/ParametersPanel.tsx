import { useState } from 'react'
import {
  Box,
  Button,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { colors } from '../../theme/tokens'
import { mockPlanningParameters, mockPlanningResult } from '../../data/mockPlanning'
import type { DrillRig, PlanningParameters } from '../../types/hdd'

const drillRigs: DrillRig[] = [
  'Vermeer D40x55',
  'Vermeer D24x40',
  'Ditch Witch JT30',
  'Herrenknecht HK50',
]

function formatPoint(lat: number, lng: number) {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
}

function unitAdornment(unit: string) {
  return {
    input: {
      endAdornment: (
        <Typography variant="caption" color={colors.textMuted}>
          {unit}
        </Typography>
      ),
    },
  }
}

export function ParametersPanel() {
  const [params, setParams] = useState<PlanningParameters>(mockPlanningParameters)
  const [isCalculating, setIsCalculating] = useState(false)
  const result = mockPlanningResult

  const update = <K extends keyof PlanningParameters>(key: K, value: PlanningParameters[K]) => {
    setParams((prev) => ({ ...prev, [key]: value }))
  }

  const handleCalculate = () => {
    setIsCalculating(true)
    // Real geometry engine lands in Milestone 3; this just simulates latency
    // so the button state and loading affordance are already production-shaped.
    window.setTimeout(() => setIsCalculating(false), 600)
  }

  return (
    <Box
      sx={{
        gridArea: 'panelTop',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        borderLeft: `1px solid ${colors.border}`,
        borderBottom: `1px solid ${colors.border}`,
        bgcolor: colors.bgApp,
        overflowY: 'auto',
      }}
    >
      <Box sx={{ px: 1.75, py: 1, borderBottom: `1px solid ${colors.border}` }}>
        <Typography variant="body2" color={colors.textPrimary} sx={{ fontWeight: 700 }}>
          Planung
        </Typography>
      </Box>

      <Box sx={{ p: 1.75 }}>
        <Typography variant="caption" color={colors.textMuted} sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
          PLANUNGSPARAMETER
        </Typography>

        <Stack spacing={1.5} sx={{ mt: 1.5 }}>
          <TextField
            label="Startpunkt"
            value={formatPoint(params.startPoint.lat, params.startPoint.lng)}
            slotProps={{ input: { readOnly: true } }}
            fullWidth
          />
          <TextField
            label="Zielpunkt"
            value={formatPoint(params.endPoint.lat, params.endPoint.lng)}
            slotProps={{ input: { readOnly: true } }}
            fullWidth
          />
          <TextField
            select
            label="Bohrgerät"
            value={params.drillRig}
            onChange={(e) => update('drillRig', e.target.value as DrillRig)}
            fullWidth
          >
            {drillRigs.map((rig) => (
              <MenuItem key={rig} value={rig}>
                {rig}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Bohrdurchmesser"
            type="number"
            value={params.pipeDiameterMm}
            onChange={(e) => update('pipeDiameterMm', Number(e.target.value))}
            slotProps={unitAdornment('mm')}
            fullWidth
          />
          <TextField
            label="Bohrradius (min.)"
            type="number"
            value={params.minDrillRadiusM}
            onChange={(e) => update('minDrillRadiusM', Number(e.target.value))}
            slotProps={unitAdornment('m')}
            fullWidth
          />
          <TextField
            label="Eintrittswinkel"
            type="number"
            value={params.entryAngleDeg}
            onChange={(e) => update('entryAngleDeg', Number(e.target.value))}
            slotProps={unitAdornment('°')}
            fullWidth
          />
          <TextField
            label="Austrittswinkel"
            type="number"
            value={params.exitAngleDeg}
            onChange={(e) => update('exitAngleDeg', Number(e.target.value))}
            slotProps={unitAdornment('°')}
            fullWidth
          />

          <Button
            variant="contained"
            size="large"
            fullWidth
            loading={isCalculating}
            onClick={handleCalculate}
          >
            Planung berechnen
          </Button>
        </Stack>
      </Box>

      <Divider sx={{ borderColor: colors.border }} />

      <Box sx={{ p: 1.75 }}>
        <Typography variant="caption" color={colors.textMuted} sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
          ERGEBNISSE
        </Typography>
        <Stack spacing={1} sx={{ mt: 1.5 }}>
          <ResultRow label="Bohrlänge (gesamt)" value={`${result.totalLengthM.toFixed(2)} m`} />
          <ResultRow label="Bohrlänge (horizontal)" value={`${result.horizontalLengthM.toFixed(2)} m`} />
          <ResultRow label="Max. Tiefe" value={`${result.maxDepthM.toFixed(2)} m`} />
          <ResultRow label="Min. Radius" value={`${result.minRadiusM.toFixed(2)} m`} />
          <ResultRow label="Eintrittspunkt" value={formatPoint(result.entryPoint.lat, result.entryPoint.lng)} />
          <ResultRow label="Austrittspunkt" value={formatPoint(result.exitPoint.lat, result.exitPoint.lng)} />
        </Stack>
      </Box>
    </Box>
  )
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
      <Typography variant="body2" color={colors.textSecondary}>
        {label}
      </Typography>
      <Typography variant="body2" color={colors.textPrimary} sx={{ fontWeight: 600 }}>
        {value}
      </Typography>
    </Stack>
  )
}
