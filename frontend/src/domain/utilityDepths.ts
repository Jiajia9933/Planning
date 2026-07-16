import type { UtilityType } from '../types/hdd'

/**
 * Typical burial depth for each utility type (meters below surface).
 * Standin for per-feature depth attributes a real cadastral/utility GIS feed
 * would supply — used only to size the clash check until Milestone 4's data
 * source is real.
 */
export const utilityDepthsM: Record<UtilityType, number> = {
  telekommunikation: 0.6,
  strom: 0.8,
  fernwaerme: 1.0,
  gas: 1.2,
  wasser: 1.5,
  abwasser: 2.0,
}
