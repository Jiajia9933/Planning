import type { StyleSpecification } from 'maplibre-gl'

export type BasemapId = 'strasse' | 'satellit' | 'gelaende'

export interface BasemapOption {
  id: BasemapId
  label: string
  // A full style object (raster fallback) or a style JSON URL string (Esri's
  // Basemap Styles service, vector) — MapLibre's Map/setStyle accept both.
  style: StyleSpecification | string
}

// Free, no-API-key raster sources for local dev only — not licensed for
// production/commercial use (see project memory). Used as a fallback when
// VITE_ARCGIS_API_KEY is unset.
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

// Esri's Basemap Styles v2 service — returns a full Mapbox Style Spec v8
// JSON (attribution included), which MapLibre can load directly from a URL.
// Requires the "Basemap styles service" privilege on the API key.
function arcgisStyleUrl(styleId: string, apiKey: string): string {
  return `https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/${styleId}?token=${apiKey}`
}

const arcgisKey = import.meta.env.VITE_ARCGIS_API_KEY

export const basemapOptions: BasemapOption[] = [
  {
    id: 'strasse',
    label: 'Straße',
    style: arcgisKey
      ? arcgisStyleUrl('arcgis/streets', arcgisKey)
      : rasterStyle(
          ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          '© OpenStreetMap contributors',
        ),
  },
  {
    id: 'satellit',
    label: 'Satellit',
    // With a key, use Esri's licensed/authenticated tile endpoint (required
    // for production/commercial use per Esri's terms); without one, fall
    // back to the public unauthenticated server (fine for local dev only).
    style: arcgisKey
      ? rasterStyle(
          [
            `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${arcgisKey}`,
          ],
          '© Esri, Maxar, Earthstar Geographics',
        )
      : rasterStyle(
          [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          ],
          '© Esri, Maxar, Earthstar Geographics',
        ),
  },
  {
    id: 'gelaende',
    label: 'Gelände',
    style: arcgisKey
      ? arcgisStyleUrl('arcgis/topographic', arcgisKey)
      : rasterStyle(
          ['https://tile.opentopomap.org/{z}/{x}/{y}.png'],
          '© OpenTopoMap (CC-BY-SA)',
          17,
        ),
  },
]
