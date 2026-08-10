/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional Cesium Ion access token — unlocks real terrain, OSM Buildings
   *  and satellite imagery in the 3D view. Free signup at ion.cesium.com;
   *  the 3D view falls back to a flat ellipsoid + OSM street tiles when unset. */
  readonly VITE_CESIUM_ION_TOKEN?: string
  /** Base URL of the backend API, e.g. http://localhost:4000 (see backend/.env.example). */
  readonly VITE_API_BASE_URL?: string
  /** Optional Esri API key, shared by all three basemaps (street/satellite/
   *  terrain) — unlocks the authenticated ibasemaps-api.arcgis.com and
   *  basemapstyles-api.arcgis.com endpoints. Falls back to OSM/OpenTopoMap/
   *  Esri's unauthenticated public tile servers when unset (fine for local
   *  dev, not for production — see project memory). */
  readonly VITE_ARCGIS_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
