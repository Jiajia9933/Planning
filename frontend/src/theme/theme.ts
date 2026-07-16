import { createTheme } from '@mui/material/styles'
import { colors } from './tokens'

export const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: colors.bgApp,
      paper: colors.bgPanel,
    },
    text: {
      primary: colors.textPrimary,
      secondary: colors.textSecondary,
    },
    primary: {
      main: colors.accentBlue,
      dark: colors.accentBlueHover,
      contrastText: '#ffffff',
    },
    warning: {
      main: colors.accentOrange,
    },
    success: {
      main: colors.accentGreen,
    },
    error: {
      main: colors.accentRed,
    },
    divider: colors.border,
  },
  typography: {
    fontFamily:
      '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 13,
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 6,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          fontSize: '0.8125rem',
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: 'small',
      },
    },
    MuiSelect: {
      defaultProps: {
        size: 'small',
      },
    },
  },
})
