import { useMemo, useState } from 'react'
import { Box, Button, Checkbox, FormControlLabel, Stack, Typography } from '@mui/material'
import { PanelFrame } from '../../layout/PanelFrame'
import { colors } from '../../theme/tokens'
import { usePlanningStore } from '../../store/planningStore'
import { useDrillingSession } from './useDrillingSession'
import { DraufsichtView } from './DraufsichtView'
import { SeitenansichtView } from './SeitenansichtView'
import { deviationColor } from './constants'
import { computeGuidanceArrows } from './guidanceArrows'

const CHART_WIDTH = 640
const CHART_HEIGHT = 160
const CHART_MARGIN = { top: 10, right: 12, bottom: 20, left: 36 }
const PLOT_W = CHART_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right
const PLOT_H = CHART_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom

function formatElapsed(elapsedS: number): string {
  const m = Math.floor(elapsedS / 60)
  const s = Math.floor(elapsedS % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function MonitoringPanel() {
  const currentProjectId = usePlanningStore((s) => s.currentProjectId)
  const profile = usePlanningStore((s) => s.profile)
  const result = usePlanningStore((s) => s.result)
  const parameters = usePlanningStore((s) => s.parameters)
  const uploadedParcels = usePlanningStore((s) => s.uploadedParcels)
  const hasResult = profile.length > 0

  const {
    readings,
    isRunning,
    isComplete,
    totalReadings,
    error,
    turnWarning,
    replanTriggerIndex,
    lastHeadingKickDeg,
    lastVerticalKickDeg,
    steer,
    steerVertical,
    start,
  } = useDrillingSession(currentProjectId)

  const [manualMode, setManualMode] = useState(false)

  const latest = readings.length > 0 ? readings[readings.length - 1] : null

  // Live "what direction should the bit point right now" preview — recomputed
  // on every new reading, independent of whether an actual replan has been
  // triggered. See the guidanceArrows module for why this reacts earlier
  // than the discrete trigger-once auto-replan.
  const guidance = useMemo(() => {
    // Nothing left to steer toward once the run has reached the end.
    if (!parameters.endPoint || isComplete) return null
    return computeGuidanceArrows(
      readings,
      parameters.endPoint,
      profile,
      uploadedParcels,
      parameters.minDrillRadiusM,
      parameters.exitAngleDeg,
    )
  }, [readings, parameters.endPoint, profile, uploadedParcels, parameters.minDrillRadiusM, parameters.exitAngleDeg, isComplete])

  // Downsampled to keep the chart light even once a run has thousands of readings.
  const chartPoints = useMemo(() => {
    if (readings.length === 0) return []
    const step = Math.max(1, Math.floor(readings.length / 300))
    return readings.filter((_, i) => i % step === 0 || i === readings.length - 1)
  }, [readings])

  const maxAbsDeviation = useMemo(
    () => Math.max(0.1, ...chartPoints.map((r) => Math.max(Math.abs(r.lateralDeviationM), Math.abs(r.verticalDeviationM)))),
    [chartPoints],
  )
  const maxElapsedS = chartPoints.length > 0 ? chartPoints[chartPoints.length - 1].elapsedS : 1

  const xScale = (elapsedS: number) => (elapsedS / maxElapsedS) * PLOT_W
  const yScale = (deviationM: number) => PLOT_H / 2 - (deviationM / maxAbsDeviation) * (PLOT_H / 2)

  const buildPath = (key: 'lateralDeviationM' | 'verticalDeviationM') =>
    chartPoints.map((r, i) => `${i === 0 ? 'M' : 'L'} ${xScale(r.elapsedS).toFixed(1)} ${yScale(r[key]).toFixed(1)}`).join(' ')

  return (
    <PanelFrame title="Überwachung">
      <Stack sx={{ maxWidth: 680, mx: 'auto', gap: 2.5 }}>
        <Typography variant="body2" color={colors.textSecondary}>
          Simulierter Testlauf — echte Sensordaten sind noch nicht angebunden. Vergleicht die (simulierte)
          Ist-Position jede Sekunde mit dem geplanten Bohrpfad.
        </Typography>

        <Box>
          <Button variant="contained" disabled={!hasResult || isRunning} onClick={() => void start(manualMode)}>
            {isRunning ? 'Testlauf läuft…' : 'Testlauf starten'}
          </Button>
          <FormControlLabel
            sx={{ ml: 1.5 }}
            control={
              <Checkbox
                size="small"
                checked={manualMode}
                disabled={isRunning}
                onChange={(_, checked) => setManualMode(checked)}
              />
            }
            label={
              <Typography variant="caption" color={colors.textSecondary}>
                Manuelle Steuerung (Draufsicht ←/→, Seitenansicht ↑/↓ — jeder Tastendruck stößt die Ist-Richtung an, danach korrigiert sie sich von selbst zurück)
              </Typography>
            }
          />
          {!hasResult && (
            <Typography variant="caption" color={colors.textMuted} sx={{ display: 'block', mt: 0.5 }}>
              Erst "Planung berechnen", um einen Testlauf zu starten.
            </Typography>
          )}
          {error && (
            <Typography variant="caption" color={colors.accentRed} sx={{ display: 'block', mt: 0.5 }}>
              {error}
            </Typography>
          )}
        </Box>

        {latest && parameters.startPoint && parameters.endPoint && (
          <>
            {turnWarning && (
              <Typography variant="caption" color={colors.accentOrange}>
                ⚠ {turnWarning}
              </Typography>
            )}
            {guidance?.warningText && (
              <Typography variant="caption" color={colors.accentRed}>
                ⚠ Live-Korrektur nicht fahrbar: {guidance.warningText}
              </Typography>
            )}

            <DraufsichtView
              startPoint={parameters.startPoint}
              endPoint={parameters.endPoint}
              waypoints={parameters.waypoints}
              readings={readings}
              replanTriggerIndex={replanTriggerIndex}
              guidance={guidance}
              manualMode={manualMode}
              onSteer={steer}
            />
            <SeitenansichtView
              profile={profile}
              readings={readings}
              replanTriggerIndex={replanTriggerIndex}
              guidance={guidance}
              manualMode={manualMode}
              onSteerVertical={steerVertical}
            />

            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 2 }}>
              <Reading label="Zeit" value={formatElapsed(latest.elapsedS)} />
              <Reading
                label="Strecke"
                value={`${latest.distanceM.toFixed(1)} / ${result.horizontalLengthM.toFixed(1)} m`}
              />
              <Reading label="Vortriebsgeschwindigkeit" value={`${latest.speedMPerMin.toFixed(2)} m/min`} />
              <Reading label="Richtung" value={`${latest.headingDeg.toFixed(1)}°`} />
              {manualMode && lastHeadingKickDeg !== null && (
                <Reading
                  label="Letzte Korrektur (horiz.)"
                  value={`${lastHeadingKickDeg >= 0 ? '+' : ''}${lastHeadingKickDeg}° — korrigiert automatisch zurück`}
                  color={colors.accentOrange}
                />
              )}
              {manualMode && lastVerticalKickDeg !== null && (
                <Reading
                  label="Letzte Korrektur (vert.)"
                  value={`${lastVerticalKickDeg >= 0 ? '+' : ''}${lastVerticalKickDeg}° — korrigiert automatisch zurück`}
                  color={colors.accentOrange}
                />
              )}
              <Reading label="Vortriebskraft" value={`${latest.forceKn.toFixed(1)} kN`} />
              <Reading label="Tiefe" value={`${latest.depthM.toFixed(2)} m`} />
              <Reading
                label="Seitliche Abweichung"
                value={`${latest.lateralDeviationM.toFixed(2)} m`}
                color={deviationColor(latest.lateralDeviationM)}
              />
              <Reading
                label="Vertikale Abweichung"
                value={`${latest.verticalDeviationM >= 0 ? '+' : ''}${latest.verticalDeviationM.toFixed(2)} m`}
                color={deviationColor(Math.abs(latest.verticalDeviationM))}
              />
            </Stack>

            {isComplete && (
              <Typography variant="caption" color={colors.accentGreen}>
                ✓ Testlauf abgeschlossen ({totalReadings} Messpunkte).
              </Typography>
            )}

            <Box>
              <Typography variant="caption" color={colors.textMuted} sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
                ABWEICHUNG ÜBER ZEIT
              </Typography>
              <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} width="100%" height={CHART_HEIGHT}>
                <g transform={`translate(${CHART_MARGIN.left},${CHART_MARGIN.top})`}>
                  <line x1={0} x2={PLOT_W} y1={PLOT_H / 2} y2={PLOT_H / 2} stroke={colors.border} strokeWidth={1} />
                  <text x={-8} y={PLOT_H / 2} fill={colors.textSecondary} fontSize={10} textAnchor="end" dominantBaseline="middle">
                    0
                  </text>
                  <text x={-8} y={4} fill={colors.textSecondary} fontSize={10} textAnchor="end">
                    +{maxAbsDeviation.toFixed(1)}m
                  </text>
                  <text x={-8} y={PLOT_H - 2} fill={colors.textSecondary} fontSize={10} textAnchor="end">
                    -{maxAbsDeviation.toFixed(1)}m
                  </text>
                  <path d={buildPath('lateralDeviationM')} fill="none" stroke={colors.accentBlue} strokeWidth={1.5} />
                  <path d={buildPath('verticalDeviationM')} fill="none" stroke={colors.accentOrange} strokeWidth={1.5} />
                </g>
              </svg>
              <Stack direction="row" spacing={2}>
                <LegendSwatch color={colors.accentBlue} label="Seitliche Abweichung" />
                <LegendSwatch color={colors.accentOrange} label="Vertikale Abweichung" />
              </Stack>
            </Box>
          </>
        )}
      </Stack>
    </PanelFrame>
  )
}

function Reading({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Box sx={{ minWidth: 130 }}>
      <Typography variant="caption" color={colors.textMuted} sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 700 }} color={color ?? colors.textPrimary}>
        {value}
      </Typography>
    </Box>
  )
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
      <Box sx={{ width: 14, height: 2, bgcolor: color }} />
      <Typography variant="caption" color={colors.textSecondary}>
        {label}
      </Typography>
    </Stack>
  )
}
