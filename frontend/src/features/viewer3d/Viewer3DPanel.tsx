import { useState } from 'react'
import { Box, IconButton, Stack, Tooltip } from '@mui/material'
import GpsFixedOutlinedIcon from '@mui/icons-material/GpsFixedOutlined'
import ThreeDRotationOutlinedIcon from '@mui/icons-material/ThreeDRotationOutlined'
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined'
import OpenWithOutlinedIcon from '@mui/icons-material/OpenWithOutlined'
import { PanelFrame } from '../../layout/PanelFrame'
import { colors } from '../../theme/tokens'

const tools = [
  { id: 'center', icon: GpsFixedOutlinedIcon, label: 'Ansicht zentrieren' },
  { id: 'orbit', icon: ThreeDRotationOutlinedIcon, label: 'Kamera drehen' },
  { id: 'snapshot', icon: PhotoCameraOutlinedIcon, label: 'Screenshot' },
  { id: 'pan', icon: OpenWithOutlinedIcon, label: 'Verschieben' },
]

export function Viewer3DPanel() {
  const [tool, setTool] = useState('orbit')

  return (
    <PanelFrame title="3D Ansicht" noPadding>
      <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        {/* Placeholder scene — real CesiumJS globe lands in Milestone 6 */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(180deg, #0d1420 0%, #141d2b 55%, #1a2436 100%)`,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            inset: '-20%',
            opacity: 0.35,
            backgroundImage:
              'repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 28px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 28px)',
            transform: 'perspective(600px) rotateX(55deg)',
          }}
        />

        <Box
          component="svg"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        >
          <path
            d="M 8 40 C 30 55, 45 62, 60 58 S 88 44, 94 40"
            fill="none"
            stroke={colors.accentOrange}
            strokeWidth={1.1}
            strokeLinecap="round"
          />
          <circle cx={8} cy={40} r={1.4} fill={colors.accentGreen} />
          <circle cx={94} cy={40} r={1.4} fill={colors.accentRed} />
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
          }}
        >
          {tools.map((t) => {
            const Icon = t.icon
            const active = tool === t.id
            return (
              <Tooltip key={t.id} title={t.label}>
                <IconButton
                  size="small"
                  onClick={() => setTool(t.id)}
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
