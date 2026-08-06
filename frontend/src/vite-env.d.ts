/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional Cesium Ion access token — unlocks real terrain, OSM Buildings
   *  and satellite imagery in the 3D view. Free signup at ion.cesium.com;
   *  the 3D view falls back to a flat ellipsoid + OSM street tiles when unset. */
  readonly VITE_CESIUM_ION_TOKEN?: string
  /** Base URL of the backend API, e.g. http://localhost:4000 (see backend/.env.example). */
  readonly VITE_API_BASE_URL?: string
  /** Optional Esri API key for the satellite basemap — unlocks the
   *  authenticated ibasemaps-api.arcgis.com endpoint. Falls back to Esri's
   *  unauthenticated public tile server when unset (fine for local dev,
   *  not for production per Esri's terms — see project memory). */
  readonly VITE_ARCGIS_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
