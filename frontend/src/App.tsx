import { useEffect, useState } from 'react'
import { ThemeProvider, CssBaseline, Box, CircularProgress, Typography, Button } from '@mui/material'
import { theme } from './theme/theme'
import { colors } from './theme/tokens'
import { AppShell } from './layout/AppShell'
import { useAuthStore } from './features/auth/authStore'
import { LoginPage } from './features/auth/LoginPage'
import { RegisterPage } from './features/auth/RegisterPage'
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage'
import { ResetPasswordPage } from './features/auth/ResetPasswordPage'
import { CreateProjectPage } from './features/auth/CreateProjectPage'
import { usePlanningStore } from './store/planningStore'

function LoadingScreen() {
  return (
    <Box
      sx={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: colors.bgApp,
      }}
    >
      <CircularProgress />
    </Box>
  )
}

function ErrorScreen() {
  const bootstrap = usePlanningStore((s) => s.bootstrap)
  const logout = useAuthStore((s) => s.logout)
  return (
    <Box
      sx={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        bgcolor: colors.bgApp,
      }}
    >
      <Typography color={colors.textPrimary}>Projekt konnte nicht geladen werden.</Typography>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button variant="contained" onClick={() => void bootstrap()}>
          Erneut versuchen
        </Button>
        <Button variant="text" onClick={logout} sx={{ color: colors.textSecondary }}>
          Abmelden
        </Button>
      </Box>
    </Box>
  )
}

function AuthenticatedApp() {
  const planningStatus = usePlanningStore((s) => s.status)
  const bootstrap = usePlanningStore((s) => s.bootstrap)

  useEffect(() => {
    if (planningStatus === 'idle') void bootstrap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (planningStatus === 'idle' || planningStatus === 'loading') return <LoadingScreen />
  if (planningStatus === 'no-project') return <CreateProjectPage />
  if (planningStatus === 'error') return <ErrorScreen />

  return <AppShell />
}

// A reset link from an email lands here as ?resetToken=... on the root URL
// (there's no router in this app — this is the whole "routing" it needs).
// Checked once at module scope so it survives the initial render regardless
// of auth status: someone might click a reset link while already logged in
// on this device/browser.
function getResetTokenFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('resetToken')
}

function App() {
  const authStatus = useAuthStore((s) => s.status)
  const [authView, setAuthView] = useState<'login' | 'register' | 'forgot-password'>('login')
  const [resetToken, setResetToken] = useState(getResetTokenFromUrl)

  const clearResetToken = () => {
    setResetToken(null)
    const url = new URL(window.location.href)
    url.searchParams.delete('resetToken')
    window.history.replaceState({}, '', url)
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {resetToken ? (
        <ResetPasswordPage token={resetToken} onDone={clearResetToken} />
      ) : authStatus === 'anonymous' ? (
        authView === 'login' ? (
          <LoginPage
            onSwitchToRegister={() => setAuthView('register')}
            onForgotPassword={() => setAuthView('forgot-password')}
          />
        ) : authView === 'register' ? (
          <RegisterPage onSwitchToLogin={() => setAuthView('login')} />
        ) : (
          <ForgotPasswordPage onSwitchToLogin={() => setAuthView('login')} />
        )
      ) : (
        <AuthenticatedApp />
      )}
    </ThemeProvider>
  )
}

export default App
