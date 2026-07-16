import {
  Box,
  Button,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import GpsFixedOutlinedIcon from '@mui/icons-material/GpsFixedOutlined'
import { colors, utilityColors } from '../../theme/tokens'
import { usePlanningStore } from '../../store/planningStore'
import { mockUtilityLayers } from '../../data/mockPlanning'
import type { DrillRig, PlanningParameters } from '../../types/hdd'

const utilityLabels = Object.fromEntries(mockUtilityLayers.map((l) => [l.type, l.label]))

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
  const parameters = usePlanningStore((s) => s.parameters)
  const result = usePlanningStore((s) => s.result)
  const conflicts = usePlanningStore((s) => s.conflicts)
  const isCalculating = usePlanningStore((s) => s.isCalculating)
  const pointPickMode = usePlanningStore((s) => s.pointPickMode)
  const setParameter = usePlanningStore((s) => s.setParameter)
  const setPointPickMode = usePlanningStore((s) => s.setPointPickMode)
  const calculate = usePlanningStore((s) => s.calculate)

  const update = <K extends keyof PlanningParameters>(key: K, value: PlanningParameters[K]) => {
    setParameter(key, value)
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
          <PointField
            label="Startpunkt"
            value={formatPoint(parameters.startPoint.lat, parameters.startPoint.lng)}
            active={pointPickMode === 'start'}
            onPick={() => setPointPickMode(pointPickMode === 'start' ? null : 'start')}
          />
          <PointField
            label="Zielpunkt"
            value={formatPoint(parameters.endPoint.lat, parameters.endPoint.lng)}
            active={pointPickMode === 'end'}
            onPick={() => setPointPickMode(pointPickMode === 'end' ? null : 'end')}
          />
          <TextField
            select
            label="Bohrgerät"
            value={parameters.drillRig}
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
            value={parameters.pipeDiameterMm}
            onChange={(e) => update('pipeDiameterMm', Number(e.target.value))}
            slotProps={unitAdornment('mm')}
            fullWidth
          />
          <TextField
            label="Bohrradius (min.)"
            type="number"
            value={parameters.minDrillRadiusM}
            onChange={(e) => update('minDrillRadiusM', Number(e.target.value))}
            slotProps={unitAdornment('m')}
            fullWidth
          />
          <TextField
            label="Eintrittswinkel"
            type="number"
            value={parameters.entryAngleDeg}
            onChange={(e) => update('entryAngleDeg', Number(e.target.value))}
            slotProps={unitAdornment('°')}
            fullWidth
          />
          <TextField
            label="Austrittswinkel"
            type="number"
            value={parameters.exitAngleDeg}
            onChange={(e) => update('exitAngleDeg', Number(e.target.value))}
            slotProps={unitAdornment('°')}
            fullWidth
          />
          <TextField
            label="Sicherheitsabstand"
            type="number"
            value={parameters.safetyDistanceM}
            onChange={(e) => update('safetyDistanceM', Number(e.target.value))}
            slotProps={unitAdornment('m')}
            fullWidth
          />

          <Button
            variant="contained"
            size="large"
            fullWidth
            loading={isCalculating}
            onClick={calculate}
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
        {result.warnings.length > 0 && (
          <Stack spacing={0.5} sx={{ mt: 1.5 }}>
            {result.warnings.map((w) => (
              <Typography key={w} variant="caption" color={colors.accentOrange}>
                ⚠ {w}
              </Typography>
            ))}
          </Stack>
        )}
      </Box>

      <Divider sx={{ borderColor: colors.border }} />

      <Box sx={{ p: 1.75 }}>
        <Typography variant="caption" color={colors.textMuted} sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
          KOLLISIONSPRÜFUNG
        </Typography>
        <Stack spacing={1} sx={{ mt: 1.5 }}>
          {conflicts.length === 0 ? (
            <Typography variant="body2" color={colors.textSecondary}>
              Keine Leitungskreuzungen im Bohrpfad.
            </Typography>
          ) : (
            conflicts.map((c, i) => (
              <Stack
                key={i}
                direction="row"
                spacing={1}
                sx={{ alignItems: 'flex-start' }}
              >
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    mt: 0.4,
                    flexShrink: 0,
                    bgcolor: c.isConflict ? colors.accentRed : utilityColors[c.type],
                  }}
                />
                <Typography
                  variant="caption"
                  color={c.isConflict ? colors.accentRed : colors.textSecondary}
                  sx={{ fontWeight: c.isConflict ? 700 : 400 }}
                >
                  {c.isConflict ? '⚠ Konflikt mit ' : 'Kreuzung: '}
                  {utilityLabels[c.type]} bei {c.distanceM.toFixed(1)} m — Abstand{' '}
                  {c.clearanceM.toFixed(2)} m (erforderlich {parameters.safetyDistanceM.toFixed(2)} m)
                </Typography>
              </Stack>
            ))
          )}
        </Stack>
      </Box>
    </Box>
  )
}

function PointField({
  label,
  value,
  active,
  onPick,
}: {
  label: string
  value: string
  active: boolean
  onPick: () => void
}) {
  return (
    <TextField
      label={label}
      value={value}
      slotProps={{
        input: {
          readOnly: true,
          endAdornment: (
            <Tooltip title="Auf Karte anklicken zum Setzen">
              <IconButton
                size="small"
                onClick={onPick}
                sx={{
                  color: active ? '#fff' : colors.textSecondary,
                  bgcolor: active ? colors.accentBlue : 'transparent',
                  '&:hover': { bgcolor: active ? colors.accentBlueHover : colors.bgElevated },
                }}
              >
                <GpsFixedOutlinedIcon fontSize="inherit" sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          ),
        },
      }}
      fullWidth
    />
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
