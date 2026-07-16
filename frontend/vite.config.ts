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
})
