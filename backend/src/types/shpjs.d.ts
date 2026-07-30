declare module 'shpjs' {
  import type { FeatureCollection, Geometry } from 'geojson'

  type ShpFeatureCollection = FeatureCollection<Geometry, Record<string, unknown>> & {
    fileName?: string
  }

  export default function shp(
    input: ArrayBuffer | ArrayBufferView,
  ): Promise<ShpFeatureCollection | ShpFeatureCollection[]>
}
