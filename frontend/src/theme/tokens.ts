// Raw design tokens shared between the MUI theme and hand-rolled CSS/SVG
// (charts, map overlays) that cannot consume MUI's theme object directly.
export const colors = {
  bgApp: '#0a0e16',
  bgPanel: '#0f151f',
  bgPanelAlt: '#121a26',
  bgElevated: '#161f2c',
  border: '#1e2836',
  borderStrong: '#2a3644',
  textPrimary: '#e8ecf1',
  textSecondary: '#8892a0',
  textMuted: '#5b6470',
  accentBlue: '#3b82f6',
  accentBlueHover: '#2563eb',
  accentOrange: '#f5a623',
  accentGreen: '#22c55e',
  accentRed: '#ef4444',
} as const

export const utilityColors = {
  strom: '#eab308',
  gas: '#3b82f6',
  wasser: '#38bdf8',
  fernwaerme: '#ef4444',
  telekommunikation: '#ec4899',
  abwasser: '#22c55e',
} as const

export type UtilityKey = keyof typeof utilityColors
