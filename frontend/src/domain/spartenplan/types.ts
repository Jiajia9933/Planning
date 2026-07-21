import type { Feature, LineString } from 'geojson'
import type { UtilityType } from '../../types/hdd'

/** One grouping of raw imported features the user assigns a UtilityType to. */
export interface ImportedLayerInfo {
  id: string
  sourceName: string
  featureCount: number
}

/** Raw line features tagged with `__layerId`, plus the layers detected among them. */
export interface SpartenplanImportResult {
  rawFeatures: Feature<LineString, Record<string, unknown>>[]
  layers: ImportedLayerInfo[]
}

export interface SpartenplanMeta {
  sourceFileName: string
  sourceFormat: 'shapefile' | 'dxf'
  uploadedAt: string
  layerCount: number
  featureCount: number
}

/** Per-layer choice in the assignment UI: a real utility type, or "leave out". */
export type LayerAssignment = UtilityType | 'ignore'
