import { Box, Snackbar } from '@mui/material'
import styles from './AppShell.module.css'
import { TopToolbar } from './TopToolbar'
import { LeftNavRail } from './LeftNavRail'
import { MapPanel } from '../features/map/MapPanel'
import { ParametersPanel } from '../features/planning/ParametersPanel'
import { SideViewPanel } from '../features/sideview/SideViewPanel'
import { Viewer3DPanel } from '../features/viewer3d/Viewer3DPanel'
import { Info3DPanel } from '../features/viewer3d/Info3DPanel'
import { DatenPanel } from '../features/daten/DatenPanel'
import { ProjektPanel } from '../features/projects/ProjektPanel'
import { BerichtePanel } from '../features/berichte/BerichtePanel'
import { colors } from '../theme/tokens'
import { usePlanningStore } from '../store/planningStore'
import { downloadFile } from '../domain/fileDownload'
import { useToast } from '../hooks/useToast'

export function AppShell() {
  const projectName = usePlanningStore((s) => s.projectName)
  const projectCode = usePlanningStore((s) => s.projectCode)
  const parameters = usePlanningStore((s) => s.parameters)
  const result = usePlanningStore((s) => s.result)
  const profile = usePlanningStore((s) => s.profile)
  const conflicts = usePlanningStore((s) => s.conflicts)
  const activeNavId = usePlanningStore((s) => s.activeNavId)
  const currentProjectId = usePlanningStore((s) => s.currentProjectId)
  const isSaving = usePlanningStore((s) => s.isSaving)
  const saveParameters = usePlanningStore((s) => s.saveParameters)
  const createReport = usePlanningStore((s) => s.createReport)
  const { toast, showToast, closeToast } = useToast()

  const handleSave = async () => {
    try {
      await saveParameters()
      showToast('Projekt gespeichert')
    } catch {
      showToast('Speichern fehlgeschlagen')
    }
  }

  const handleExport = () => {
    const payload = { projectName, projectCode, parameters, result, profile, conflicts }
    downloadFile(`${projectCode}.json`, JSON.stringify(payload, null, 2), 'application/json')
    showToast('Projekt exportiert')
  }

  const handleCreateReport = async () => {
    try {
      await createReport()
      showToast('Bericht erstellt und in Berichte gespeichert')
    } catch {
      showToast('Bericht konnte nicht erstellt werden')
    }
  }

  return (
    <Box className={styles.shell} sx={{ color: colors.textPrimary, bgcolor: colors.bgApp }}>
      <TopToolbar
        projectName={projectName}
        projectCode={projectCode}
        onSave={() => void handleSave()}
        isSaving={isSaving}
        onExport={handleExport}
        onCreateReport={() => void handleCreateReport()}
      />

      <LeftNavRail />

      {activeNavId === 'daten' ? (
        <Box className={styles.dataPage}>
          <DatenPanel />
        </Box>
      ) : activeNavId === 'projekt' || !currentProjectId ? (
        <Box className={styles.dataPage}>
          <ProjektPanel />
        </Box>
      ) : activeNavId === 'berichte' ? (
        <Box className={styles.dataPage}>
          <BerichtePanel />
        </Box>
      ) : activeNavId === 'bohrplanung' ? (
        <Box className={styles.dataPage} />
      ) : (
        <>
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
        </>
      )}

      <Snackbar
        open={!!toast}
        autoHideDuration={2500}
        onClose={closeToast}
        message={toast?.message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
