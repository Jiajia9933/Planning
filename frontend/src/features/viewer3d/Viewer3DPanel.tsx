import { useEffect, useRef, useState } from 'react'
import * as Cesium from 'cesium'
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material'
import GpsFixedOutlinedIcon from '@mui/icons-material/GpsFixedOutlined'
import ThreeDRotationOutlinedIcon from '@mui/icons-material/ThreeDRotationOutlined'
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined'
import OpenWithOutlinedIcon from '@mui/icons-material/OpenWithOutlined'
import { PanelFrame } from '../../layout/PanelFrame'
import { colors } from '../../theme/tokens'
import { usePlanningStore } from '../../store/planningStore'
import { useCesiumViewer } from './useCesiumViewer'
import { rebuildSceneEntities } from './sceneEntities'
import { computeCameraTarget } from './cameraFraming'
import './cesium-dark.css'

const tools = [
  { id: 'center', icon: GpsFixedOutlinedIcon, label: 'Ansicht zentrieren' },
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
  const { containerRef, viewer } = useCesiumViewer()
  const hasFramedInitially = useRef(false)

  const flyToProject = (instant = false) => {
    if (!viewer) return
    const { center, radius, heading } = computeCameraTarget(startPoint, endPoint, maxDepthM)
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
    rebuildSceneEntities(viewer, startPoint, endPoint, profile, conflicts)
    if (!hasFramedInitially.current) {
      hasFramedInitially.current = true
      flyToProject(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, startPoint, endPoint, profile, conflicts])

  useEffect(() => {
    if (!viewer) return
    if (tool === 'orbit') {
      const handler = () => {
        viewer.camera.rotateRight(-0.002)
      }
      viewer.clock.onTick.addEventListener(handler)
      return () => {
        viewer.clock.onTick.removeEventListener(handler)
      }
    }
  }, [viewer, tool])

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
            const active = tool === t.id
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
