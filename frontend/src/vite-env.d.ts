/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional Cesium Ion access token — unlocks real terrain, OSM Buildings
   *  and satellite imagery in the 3D view. Free signup at ion.cesium.com;
   *  the 3D view falls back to a flat ellipsoid + OSM street tiles when unset. */
  readonly VITE_CESIUM_ION_TOKEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
