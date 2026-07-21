// Core domain types now live in @hdd-planner/domain (shared with the
// backend) — re-exported here so existing frontend imports of '../types/hdd'
// keep working unchanged. UI-only types (not needed server-side) stay here.
export type {
  GeoPoint,
  DrillRig,
  PlanningParameters,
  PlanningResult,
  UtilityType,
  ProfileSample,
  UtilityCrossing,
} from '@hdd-planner/domain'

import type { UtilityType } from '@hdd-planner/domain'

export interface UtilityLayerState {
  type: UtilityType
  label: string
  visible: boolean
}
