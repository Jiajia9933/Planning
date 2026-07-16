import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import ArchitectureOutlinedIcon from '@mui/icons-material/ArchitectureOutlined'
import ViewInArOutlinedIcon from '@mui/icons-material/ViewInArOutlined'
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined'
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import type { SvgIconComponent } from '@mui/icons-material'

export interface NavItem {
  id: string
  label: string
  icon: SvgIconComponent
}

export const navItems: NavItem[] = [
  { id: 'projekt', label: 'Projekt', icon: FolderOutlinedIcon },
  { id: 'karte', label: 'Karte', icon: MapOutlinedIcon },
  { id: 'bohrplanung', label: 'Bohrplanung', icon: ArchitectureOutlinedIcon },
  { id: '3d-ansicht', label: '3D Ansicht', icon: ViewInArOutlinedIcon },
  { id: 'auswertung', label: 'Auswertung', icon: InsightsOutlinedIcon },
  { id: 'dokumente', label: 'Dokumente', icon: ArticleOutlinedIcon },
  { id: 'berichte', label: 'Berichte', icon: AssessmentOutlinedIcon },
  { id: 'einstellungen', label: 'Einstellungen', icon: SettingsOutlinedIcon },
]
