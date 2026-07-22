import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import cesium from 'vite-plugin-cesium'

// vite-plugin-cesium's own type declarations don't resolve to a callable
// default export under this project's `moduleResolution: nodenext` — cast
// at the call site rather than relax a project-wide compiler option.
const cesiumPlugin = cesium as unknown as (options?: Record<string, unknown>) => Plugin

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cesiumPlugin()],
  build: {
    rollupOptions: {
      output: {
        // maplibre-gl ships as its own pre-minified, pre-mangled bundle
        // (dist/maplibre-gl.js) with an internal worker that self-references
        // top-level helper functions by name (e.g. createGeoJSONIndex, used
        // as a default parameter value). Left in the shared app chunk
        // alongside other heavy libraries (jsPDF's CommonJS interop, in
        // particular), Rollup's cross-module identifier renaming corrupted
        // that reference — it silently ended up pointing at an unrelated
        // top-level binding from a different module instead (observed in
        // production as "zT is not defined", or a wrong-but-defined name
        // depending on the build), because two independently-minified
        // scopes were flattened into one. Never showed up in `vite dev`,
        // which serves native ESM and skips this bundling pass entirely.
        // Isolating maplibre-gl into its own chunk removes any chance of
        // that collision.
        manualChunks(id) {
          if (id.includes('node_modules/maplibre-gl')) return 'maplibre'
        },
      },
    },
  },
})
