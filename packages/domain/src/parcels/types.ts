import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson'

export type ParcelFeatureCollection = FeatureCollection<Polygon | MultiPolygon, { label?: string }>

export interface CrossedParcel {
  index: number
  label: string
}
