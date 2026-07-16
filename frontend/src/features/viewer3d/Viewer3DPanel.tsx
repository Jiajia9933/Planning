import { useEffect, useMemo, useRef, useState } from 'react'
import * as Cesium from 'cesium'
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material'
import GpsFixedOutlinedIcon from '@mui/icons-material/GpsFixedOutlined'
import ThreeDRotationOutlinedIcon from '@mui/icons-material/ThreeDRotationOutlined'
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined'
import OpenWithOutlinedIcon from '@mui/icons-material/OpenWithOutlined'
import ContentCutOutlinedIcon from '@mui/icons-material/ContentCutOutlined'
import { PanelFrame } from '../../layout/PanelFrame'
import { colors } from '../../theme/tokens'
import { usePlanningStore } from '../../store/planningStore'
import { useCesiumViewer } from './useCesiumViewer'
import { useGroundHeight } from './useGroundHeight'
import { rebuildSceneEntities } from './sceneEntities'
import { computeCameraTarget } from './cameraFraming'
import { applyCutaway, removeCutaway } from './undergroundCutaway'
import type { CutawayHandle } from './undergroundCutaway'
import './cesium-dark.css'

const tools = [
  { id: 'center', icon: GpsFixedOutlinedIcon, label: 'Ansicht zentrieren' },
  { id: 'cutaway', icon: ContentCutOutlinedIcon, label: 'Erdaufschnitt (unterirdisch)' },
  { id: 'orbit', icon: ThreeDRotationOutlinedIcon, label: 'Automatisch drehen' },
  { id: 'snapshot', icon: PhotoCameraOutlinedIcon, label: 'Screenshot' },
  { id: 'pan', icon: OpenWithOutlinedIcon, label: 'Verschieben' },
]

export function Viewer3DPanel() {
  const startPoint = usePlanningStore((s) => s.parameters.startPoint)
  const endPoint = usePlanningStore((s) => s.parameters.endPoint)
  const profile = usePlanningStore((s) => s.profile)
  const conflicts = usePlanningStore((s) => s.conflicts)
  const maxDepthM = usePlanningStore((s) => s.result.maxDepthM)

  const [tool, setTool] = useState<string | null>(null)
  const [cutawayEnabled, setCutawayEnabled] = useState(false)
  const { containerRef, viewer, buildingsTileset } = useCesiumViewer()
  const hasFramedInitially = useRef(false)
  const cutawayHandleRef = useRef<CutawayHandle | null>(null)

  const centerPoint = useMemo(
    () => ({ lat: (startPoint.lat + endPoint.lat) / 2, lng: (startPoint.lng + endPoint.lng) / 2 }),
    [startPoint, endPoint],
  )
  const groundHeightM = useGroundHeight(viewer, centerPoint)

  const flyToProject = (instant = false) => {
    if (!viewer) return
    const { center, radius, heading } = computeCameraTarget(startPoint, endPoint, maxDepthM, groundHeightM)
    const boundingSphere = new Cesium.BoundingSphere(center, radius)
    const offset = new Cesium.HeadingPitchRange(heading, Cesium.Math.toRadians(-32), radius * 2.4)
    if (instant) {
      viewer.camera.viewBoundingSphere(boundingSphere, offset)
    } else {
      viewer.camera.flyToBoundingSphere(boundingSphere, { offset, duration: 1 })
    }
  }

  useEffect(() => {
    if (!viewer) return
    rebuildSceneEntities(viewer, startPoint, endPoint, profile, conflicts, groundHeightM)
    if (!hasFramedInitially.current) {
      hasFramedInitially.current = true
      flyToProject(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, startPoint, endPoint, profile, conflicts, groundHeightM])

  useEffect(() => {
    if (!viewer) return
    if (tool === 'orbit') {
      const handler = () => {
        viewer.camera.rotateRight(-0.002)
        viewer.scene.requestRender()
      }
      viewer.clock.onTick.addEventListener(handler)
      return () => {
        viewer.clock.onTick.removeEventListener(handler)
      }
    }
  }, [viewer, tool])

  // Cuts a pit out of the globe (and OSM Buildings, if loaded) around the
  // project site and fills it with a soil-colored lining — the only way to
  // make 1-15m-deep entities actually read as "underground" rather than
  // lines drawn on top of the terrain at any normal viewing distance.
  useEffect(() => {
    if (!viewer) return
    if (cutawayEnabled) {
      const { radius } = computeCameraTarget(startPoint, endPoint, maxDepthM, groundHeightM)
      const pitRadiusM = Math.max(radius * 0.55, 40)
      const pitDepthM = Math.max(maxDepthM + 3, 8)
      cutawayHandleRef.current = applyCutaway(
        viewer,
        centerPoint,
        groundHeightM,
        pitRadiusM,
        pitDepthM,
        buildingsTileset,
      )
    }
    return () => {
      if (viewer && cutawayHandleRef.current) {
        removeCutaway(viewer, cutawayHandleRef.current, buildingsTileset)
        cutawayHandleRef.current = null
      }
    }
  }, [viewer, cutawayEnabled, startPoint, endPoint, centerPoint, groundHeightM, maxDepthM, buildingsTileset])

  const handleToolClick = (id: string) => {
    if (id === 'center') {
      flyToProject(false)
      return
    }
    if (id === 'snapshot') {
      if (!viewer) return
      viewer.render()
      const dataUrl = viewer.canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = 'hdd-3d-ansicht.png'
      document.body.appendChild(link)
      link.click()
      link.remove()
      return
    }
    if (id === 'cutaway') {
      setCutawayEnabled((prev) => !prev)
      return
    }
    setTool((prev) => (prev === id ? null : id))
  }

  const conflictCount = conflicts.filter((c) => c.isConflict).length

  return (
    <PanelFrame title="3D Ansicht" noPadding>
      <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <Box ref={containerRef} sx={{ position: 'absolute', inset: 0 }} />

        <Box
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            bgcolor: conflictCount > 0 ? colors.accentRed : colors.bgPanel,
            border: `1px solid ${conflictCount > 0 ? colors.accentRed : colors.border}`,
            borderRadius: 1,
            px: 1.25,
            py: 0.5,
            zIndex: 1,
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 700, color: conflictCount > 0 ? '#fff' : colors.textSecondary }}>
            {conflictCount > 0 ? `⚠ ${conflictCount} Konflikt(e)` : '✓ Keine Konflikte'}
          </Typography>
        </Box>

        <Stack
          direction="row"
          spacing={0.5}
          sx={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            bgcolor: colors.bgPanel,
            border: `1px solid ${colors.border}`,
            borderRadius: 1.5,
            p: 0.5,
            zIndex: 1,
          }}
        >
          {tools.map((t) => {
            const Icon = t.icon
            const active = t.id === 'cutaway' ? cutawayEnabled : tool === t.id
            return (
              <Tooltip key={t.id} title={t.label}>
                <IconButton
                  size="small"
                  onClick={() => handleToolClick(t.id)}
                  sx={{
                    color: active ? '#fff' : colors.textSecondary,
                    bgcolor: active ? colors.accentBlue : 'transparent',
                    '&:hover': { bgcolor: active ? colors.accentBlueHover : colors.bgElevated },
                  }}
                >
                  <Icon fontSize="small" />
                </IconButton>
              </Tooltip>
            )
          })}
        </Stack>
      </Box>
    </PanelFrame>
  )
}
