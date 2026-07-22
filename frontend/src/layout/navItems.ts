import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import ArchitectureOutlinedIcon from '@mui/icons-material/ArchitectureOutlined'
import SpeedOutlinedIcon from '@mui/icons-material/SpeedOutlined'
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
  { id: 'daten', label: 'Daten', icon: CloudUploadOutlinedIcon },
  { id: 'karte', label: 'Karte', icon: MapOutlinedIcon },
  { id: 'bohrplanung', label: 'Bohrplanung', icon: ArchitectureOutlinedIcon },
  { id: 'monitoring', label: 'Überwachung', icon: SpeedOutlinedIcon },
  { id: 'berichte', label: 'Berichte', icon: AssessmentOutlinedIcon },
  { id: 'einstellungen', label: 'Einstellungen', icon: SettingsOutlinedIcon },
]
