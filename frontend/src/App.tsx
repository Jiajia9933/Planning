import { ThemeProvider, CssBaseline } from '@mui/material'
import { theme } from './theme/theme'
import { AppShell } from './layout/AppShell'

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppShell />
    </ThemeProvider>
  )
}

export default App
