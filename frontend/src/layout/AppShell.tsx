import { Box } from '@mui/material'
import styles from './AppShell.module.css'
import { TopToolbar } from './TopToolbar'
import { LeftNavRail } from './LeftNavRail'
import { MapPanel } from '../features/map/MapPanel'
import { ParametersPanel } from '../features/planning/ParametersPanel'
import { SideViewPanel } from '../features/sideview/SideViewPanel'
import { Viewer3DPanel } from '../features/viewer3d/Viewer3DPanel'
import { Info3DPanel } from '../features/viewer3d/Info3DPanel'
import { colors } from '../theme/tokens'

export function AppShell() {
  return (
    <Box className={styles.shell} sx={{ color: colors.textPrimary, bgcolor: colors.bgApp }}>
      <TopToolbar
        projectName="Neues Projekt"
        projectCode="HDD-2024-05-23"
        onSave={() => console.info('Speichern (Milestone 8 implementiert Persistenz)')}
        onExport={() => console.info('Exportieren (Milestone 8 implementiert Persistenz)')}
        onCreateReport={() => console.info('Bericht erstellen (Milestone 8 implementiert Persistenz)')}
      />

      <LeftNavRail />

      <Box sx={{ gridArea: 'map', minHeight: 0, minWidth: 0, borderBottom: `1px solid ${colors.border}` }}>
        <MapPanel />
      </Box>

      <ParametersPanel />

      <Box className={styles.bottomRow}>
        <Box sx={{ minHeight: 0, minWidth: 0, borderRight: `1px solid ${colors.border}` }}>
          <SideViewPanel />
        </Box>
        <Box sx={{ minHeight: 0, minWidth: 0 }}>
          <Viewer3DPanel />
        </Box>
      </Box>

      <Info3DPanel />
    </Box>
  )
}
