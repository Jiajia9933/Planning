import type { UtilityType } from './types'

// ============================================================
// ENGINEERING-TODO: SIMPLIFIED PLACEHOLDER — REPLACE ME
// ============================================================
// Typical burial depth for each utility type (meters below surface) — a
// standin for per-feature depth attributes a real cadastral/utility GIS feed
// would supply. A qualified engineer should replace this with real
// per-feature depth data once available. Searchable marker: ENGINEERING-TODO
// ============================================================
export const utilityDepthsM: Record<UtilityType, number> = {
  telekommunikation: 0.6,
  strom: 0.8,
  fernwaerme: 1.0,
  gas: 1.2,
  wasser: 1.5,
  abwasser: 2.0,
}
