import type { StyleSpecification } from 'maplibre-gl'

export type BasemapId = 'strasse' | 'satellit' | 'gelaende'

export interface BasemapOption {
  id: BasemapId
  label: string
  style: StyleSpecification
}

// Free, no-API-key raster sources for the demo. Swap `tiles`/`attribution`
// for a keyed provider (MapTiler, etc.) via env vars once the project needs
// production-grade cartography and higher rate limits.
function rasterStyle(tiles: string[], attribution: string, maxzoom = 19): StyleSpecification {
  return {
    version: 8,
    sources: {
      basemap: {
        type: 'raster',
        tiles,
        tileSize: 256,
        maxzoom,
        attribution,
      },
    },
    layers: [
      {
        id: 'basemap',
        type: 'raster',
        source: 'basemap',
      },
    ],
  }
}

export const basemapOptions: BasemapOption[] = [
  {
    id: 'strasse',
    label: 'Straße',
    style: rasterStyle(
      ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      '© OpenStreetMap contributors',
    ),
  },
  {
    id: 'satellit',
    label: 'Satellit',
    style: rasterStyle(
      [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      '© Esri, Maxar, Earthstar Geographics',
    ),
  },
  {
    id: 'gelaende',
    label: 'Gelände',
    style: rasterStyle(
      ['https://tile.opentopomap.org/{z}/{x}/{y}.png'],
      '© OpenTopoMap (CC-BY-SA)',
      17,
    ),
  },
]
