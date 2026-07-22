import { colors } from '../../theme/tokens'

// Placeholder tolerance thresholds, not a validated engineering
// requirement — same "not validated, just plausible" honesty as the
// drilling simulator's own placeholder speed/force ranges.
export const DEVIATION_WARN_M = 0.3
export const DEVIATION_CRITICAL_M = 1.0

export function deviationColor(absDeviationM: number): string {
  if (absDeviationM >= DEVIATION_CRITICAL_M) return colors.accentRed
  if (absDeviationM >= DEVIATION_WARN_M) return colors.accentOrange
  return colors.accentGreen
}
