import { useState } from 'react'
import { Box, Button, Divider, MenuItem, Stack, TextField, Typography } from '@mui/material'
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined'
import { PanelFrame } from '../../layout/PanelFrame'
import { colors, utilityColors } from '../../theme/tokens'
import { usePlanningStore } from '../../store/planningStore'
import { mockUtilityLayers } from '../../data/mockPlanning'
import { parseShapefileZip } from '../../domain/spartenplan/shapefileImport'
import { guessUtilityType, buildUploadedFeatureCollection } from '../../domain/spartenplan/normalize'
import type { ImportedLayerInfo, LayerAssignment, SpartenplanImportResult } from '../../domain/spartenplan/types'
import { parseParcelShapefileZip } from '../../domain/flurstuecke/shapefileImport'
import { isValidWgs84, reprojectFeatures } from '../../domain/reproject'
import { CrsPicker } from './CrsPicker'
import type { UtilityType, ParcelFeatureCollection } from '../../types/hdd'

const utilityLabels = Object.fromEntries(mockUtilityLayers.map((l) => [l.type, l.label])) as Record<
  UtilityType,
  string
>
const utilityTypeOptions = mockUtilityLayers.map((l) => l.type)

export function DatenPanel() {
  const spartenplanMeta = usePlanningStore((s) => s.spartenplanMeta)
  const uploadedSpartenplan = usePlanningStore((s) => s.uploadedSpartenplan)
  const setUploadedSpartenplan = usePlanningStore((s) => s.setUploadedSpartenplan)
  const clearUploadedSpartenplan = usePlanningStore((s) => s.clearUploadedSpartenplan)

  const parcelsMeta = usePlanningStore((s) => s.parcelsMeta)
  const setUploadedParcels = usePlanningStore((s) => s.setUploadedParcels)
  const clearUploadedParcels = usePlanningStore((s) => s.clearUploadedParcels)

  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [pendingFileName, setPendingFileName] = useState<string | null>(null)
  const [pendingImport, setPendingImport] = useState<SpartenplanImportResult | null>(null)
  const [pendingImportUnprojected, setPendingImportUnprojected] = useState<SpartenplanImportResult | null>(null)
  const [assignments, setAssignments] = useState<Record<string, LayerAssignment>>({})

  const [isParsingParcels, setIsParsingParcels] = useState(false)
  const [parcelsParseError, setParcelsParseError] = useState<string | null>(null)
  const [pendingParcelsFileName, setPendingParcelsFileName] = useState<string | null>(null)
  const [pendingParcels, setPendingParcels] = useState<ParcelFeatureCollection | null>(null)
  const [pendingParcelsUnprojected, setPendingParcelsUnprojected] = useState<ParcelFeatureCollection | null>(null)

  const applySpartenResult = (result: SpartenplanImportResult) => {
    const initialAssignments: Record<string, LayerAssignment> = {}
    for (const layer of result.layers) {
      initialAssignments[layer.id] = guessUtilityType(layer.sourceName) ?? 'ignore'
    }
    setPendingImport(result)
    setAssignments(initialAssignments)
  }

  const handleFileSelect = async (file: File) => {
    setParseError(null)
    setIsParsing(true)
    try {
      const result = await parseShapefileZip(file)
      if (result.layers.length === 0) {
        setParseError('Keine Leitungen (LineString) in dieser Datei gefunden.')
        return
      }
      setPendingFileName(file.name)
      if (isValidWgs84(result.rawFeatures)) {
        applySpartenResult(result)
      } else {
        setPendingImportUnprojected(result)
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Datei konnte nicht gelesen werden.')
    } finally {
      setIsParsing(false)
    }
  }

  const handleApplySpartenCrs = (code: string) => {
    if (!pendingImportUnprojected) return
    applySpartenResult({ ...pendingImportUnprojected, rawFeatures: reprojectFeatures(pendingImportUnprojected.rawFeatures, code) })
    setPendingImportUnprojected(null)
  }

  const handleCommit = async () => {
    if (!pendingImport || !pendingFileName) return
    const featureCollection = buildUploadedFeatureCollection(pendingImport, assignments)
    try {
      await setUploadedSpartenplan(featureCollection, {
        sourceFileName: pendingFileName,
        sourceFormat: 'shapefile',
        uploadedAt: new Date().toISOString(),
        layerCount: pendingImport.layers.filter((l) => assignments[l.id] !== 'ignore').length,
        featureCount: featureCollection.features.length,
      })
      setPendingImport(null)
      setPendingFileName(null)
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Übernehmen fehlgeschlagen.')
    }
  }

  const handleRemove = async () => {
    if (!window.confirm('Hochgeladenen Spartenplan wirklich entfernen?')) return
    try {
      await clearUploadedSpartenplan()
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Entfernen fehlgeschlagen.')
    }
  }

  const handleParcelsFileSelect = async (file: File) => {
    setParcelsParseError(null)
    setIsParsingParcels(true)
    try {
      const featureCollection = await parseParcelShapefileZip(file)
      if (featureCollection.features.length === 0) {
        setParcelsParseError('Keine Flurstücke (Polygon) in dieser Datei gefunden.')
        return
      }
      setPendingParcelsFileName(file.name)
      if (isValidWgs84(featureCollection.features)) {
        setPendingParcels(featureCollection)
      } else {
        setPendingParcelsUnprojected(featureCollection)
      }
    } catch (err) {
      setParcelsParseError(err instanceof Error ? err.message : 'Datei konnte nicht gelesen werden.')
    } finally {
      setIsParsingParcels(false)
    }
  }

  const handleApplyParcelsCrs = (code: string) => {
    if (!pendingParcelsUnprojected) return
    setPendingParcels({ ...pendingParcelsUnprojected, features: reprojectFeatures(pendingParcelsUnprojected.features, code) })
    setPendingParcelsUnprojected(null)
  }

  const handleCommitParcels = async () => {
    if (!pendingParcels || !pendingParcelsFileName) return
    try {
      await setUploadedParcels(pendingParcels, {
        sourceFileName: pendingParcelsFileName,
        uploadedAt: new Date().toISOString(),
        featureCount: pendingParcels.features.length,
      })
      setPendingParcels(null)
      setPendingParcelsFileName(null)
    } catch (err) {
      setParcelsParseError(err instanceof Error ? err.message : 'Übernehmen fehlgeschlagen.')
    }
  }

  const handleRemoveParcels = async () => {
    if (!window.confirm('Hochgeladene Flurstücke wirklich entfernen?')) return
    try {
      await clearUploadedParcels()
    } catch (err) {
      setParcelsParseError(err instanceof Error ? err.message : 'Entfernen fehlgeschlagen.')
    }
  }

  const typeBreakdown = uploadedSpartenplan
    ? countByType(uploadedSpartenplan.features.map((f) => f.properties.type))
    : null

  return (
    <PanelFrame title="Daten">
      <Box sx={{ maxWidth: 640 }}>
        <Typography variant="caption" color={colors.textMuted} sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
          AKTUELLER SPARTENPLAN
        </Typography>

        <Box sx={{ mt: 1.5, mb: 3 }}>
          {spartenplanMeta ? (
            <Stack spacing={1}>
              <Typography variant="body2" color={colors.textPrimary}>
                <strong>{spartenplanMeta.sourceFileName}</strong> ({spartenplanMeta.sourceFormat})
              </Typography>
              <Typography variant="caption" color={colors.textSecondary}>
                Hochgeladen: {new Date(spartenplanMeta.uploadedAt).toLocaleString('de-DE')} ·{' '}
                {spartenplanMeta.layerCount} Sparten · {spartenplanMeta.featureCount} Leitungssegmente
              </Typography>
              {typeBreakdown && (
                <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
                  {Object.entries(typeBreakdown).map(([type, count]) => (
                    <Stack key={type} direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: utilityColors[type as UtilityType],
                        }}
                      />
                      <Typography variant="caption" color={colors.textSecondary}>
                        {utilityLabels[type as UtilityType]}: {count}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              )}
              <Box>
                <Button size="small" color="error" onClick={() => void handleRemove()}>
                  Entfernen
                </Button>
              </Box>
            </Stack>
          ) : (
            <Typography variant="body2" color={colors.textSecondary}>
              Kein echter Spartenplan geladen — die Karte zeigt Demo-Daten, die sich mit
              Start-/Endpunkt mitbewegen.
            </Typography>
          )}
        </Box>

        <Typography variant="caption" color={colors.textMuted} sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
          {spartenplanMeta ? 'SPARTENPLAN ERSETZEN' : 'SPARTENPLAN HOCHLADEN'}
        </Typography>

        <Stack spacing={1.5} sx={{ mt: 1.5 }}>
          <Button
            variant="outlined"
            component="label"
            startIcon={<CloudUploadOutlinedIcon />}
            loading={isParsing}
            sx={{ alignSelf: 'flex-start' }}
          >
            Shapefile (.zip) auswählen
            <input
              type="file"
              accept=".zip"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleFileSelect(file)
                e.target.value = ''
              }}
            />
          </Button>
          {parseError && (
            <Typography variant="caption" color={colors.accentRed}>
              {parseError}
            </Typography>
          )}
        </Stack>

        {pendingImportUnprojected && <CrsPicker onApply={handleApplySpartenCrs} />}

        {pendingImport && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="caption" color={colors.textMuted} sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
              SPARTEN ZUORDNEN
            </Typography>
            <Stack spacing={1.5} sx={{ mt: 1.5 }}>
              {pendingImport.layers.map((layer) => (
                <LayerAssignmentRow
                  key={layer.id}
                  layer={layer}
                  value={assignments[layer.id] ?? 'ignore'}
                  onChange={(value) => setAssignments((prev) => ({ ...prev, [layer.id]: value }))}
                />
              ))}
              <Box>
                <Button variant="contained" onClick={() => void handleCommit()}>
                  Übernehmen
                </Button>
              </Box>
            </Stack>
          </Box>
        )}

        <Divider sx={{ my: 3, borderColor: colors.border }} />

        <Typography variant="caption" color={colors.textMuted} sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
          AKTUELLE FLURSTÜCKE
        </Typography>

        <Box sx={{ mt: 1.5, mb: 3 }}>
          {parcelsMeta ? (
            <Stack spacing={1}>
              <Typography variant="body2" color={colors.textPrimary}>
                <strong>{parcelsMeta.sourceFileName}</strong>
              </Typography>
              <Typography variant="caption" color={colors.textSecondary}>
                Hochgeladen: {new Date(parcelsMeta.uploadedAt).toLocaleString('de-DE')} ·{' '}
                {parcelsMeta.featureCount} Flurstücke
              </Typography>
              <Box>
                <Button size="small" color="error" onClick={() => void handleRemoveParcels()}>
                  Entfernen
                </Button>
              </Box>
            </Stack>
          ) : (
            <Typography variant="body2" color={colors.textSecondary}>
              Keine echten Flurstücke geladen — die Karte zeigt ein Demo-Gitter statt
              echter Grundstücksgrenzen.
            </Typography>
          )}
        </Box>

        <Typography variant="caption" color={colors.textMuted} sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
          {parcelsMeta ? 'FLURSTÜCKE ERSETZEN' : 'FLURSTÜCKE HOCHLADEN'}
        </Typography>

        <Stack spacing={1.5} sx={{ mt: 1.5 }}>
          <Button
            variant="outlined"
            component="label"
            startIcon={<CloudUploadOutlinedIcon />}
            loading={isParsingParcels}
            sx={{ alignSelf: 'flex-start' }}
          >
            Shapefile (.zip) auswählen
            <input
              type="file"
              accept=".zip"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleParcelsFileSelect(file)
                e.target.value = ''
              }}
            />
          </Button>
          {parcelsParseError && (
            <Typography variant="caption" color={colors.accentRed}>
              {parcelsParseError}
            </Typography>
          )}
        </Stack>

        {pendingParcelsUnprojected && <CrsPicker onApply={handleApplyParcelsCrs} />}

        {pendingParcels && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="body2" color={colors.textPrimary}>
              {pendingParcels.features.length} Flurstücke gefunden.
            </Typography>
            <Box sx={{ mt: 1.5 }}>
              <Button variant="contained" onClick={() => void handleCommitParcels()}>
                Übernehmen
              </Button>
            </Box>
          </Box>
        )}
      </Box>
    </PanelFrame>
  )
}

function LayerAssignmentRow({
  layer,
  value,
  onChange,
}: {
  layer: ImportedLayerInfo
  value: LayerAssignment
  onChange: (value: LayerAssignment) => void
}) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" color={colors.textPrimary} noWrap>
          {layer.sourceName}
        </Typography>
        <Typography variant="caption" color={colors.textMuted}>
          {layer.featureCount} Segmente
        </Typography>
      </Box>
      <TextField
        select
        size="small"
        value={value}
        onChange={(e) => onChange(e.target.value as LayerAssignment)}
        sx={{ width: 200 }}
      >
        <MenuItem value="ignore">Ignorieren</MenuItem>
        {utilityTypeOptions.map((type) => (
          <MenuItem key={type} value={type}>
            {utilityLabels[type]}
          </MenuItem>
        ))}
      </TextField>
    </Stack>
  )
}

function countByType(types: UtilityType[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const type of types) {
    counts[type] = (counts[type] ?? 0) + 1
  }
  return counts
}
