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

// Deliberately disjoint from the semantic accents above (accentGreen = safe/
// start, accentRed = conflict/end, accentOrange = drill path, accentBlue =
// UI selection) so a utility's own color is never mistaken for a status.
export const utilityColors = {
  strom: '#eab308',
  gas: '#a855f7',
  wasser: '#06b6d4',
  fernwaerme: '#9f1239',
  telekommunikation: '#ec4899',
  abwasser: '#78716c',
} as const

export type UtilityKey = keyof typeof utilityColors
