import { colors } from '../../theme/tokens'

// Placeholder tolerance thresholds, not a validated engineering
// requirement — same "not validated, just plausible" honesty as the
// drilling simulator's own placeholder speed/force ranges.
export const DEVIATION_WARN_M = 0.3
export const DEVIATION_CRITICAL_M = 1.0

// Trend-based early trigger: fires well before the absolute threshold
// above, as soon as deviation is *clearly and consistently* growing —
// intervening partway through the drift instead of waiting for it to get
// bad. TREND_MIN_ABSOLUTE_M keeps this from false-triggering on the
// simulator's own small zero-mean noise before any real drift starts.
export const TREND_WINDOW_S = 12
export const TREND_MIN_GROWTH_M = 0.05
export const TREND_MIN_ABSOLUTE_M = 0.08
export const TREND_NOISE_TOLERANCE_M = 0.02

export function deviationColor(absDeviationM: number): string {
  if (absDeviationM >= DEVIATION_CRITICAL_M) return colors.accentRed
  if (absDeviationM >= DEVIATION_WARN_M) return colors.accentOrange
  return colors.accentGreen
}
