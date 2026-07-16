import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import type { BasemapId } from './mapStyles'
import { basemapOptions } from './mapStyles'

interface UseMapLibreMapOptions {
  /** [[minLng, minLat], [maxLng, maxLat]] — the view fits this box on load. */
  bounds: [[number, number], [number, number]]
  fitPadding?: number
  initialBasemap?: BasemapId
}

/** Owns the MapLibre GL instance lifecycle so panel components stay declarative. */
export function useMapLibreMap({ bounds, fitPadding = 56, initialBasemap = 'satellit' }: UseMapLibreMapOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [map, setMap] = useState<maplibregl.Map | null>(null)
  const [basemap, setBasemapState] = useState<BasemapId>(initialBasemap)
  // Bumped on initial load and after every setStyle() reload, since a style
  // swap discards all sources/layers — consumers re-add their data on change.
  const [styleVersion, setStyleVersion] = useState(0)

  useEffect(() => {
    if (!containerRef.current) return

    const initialStyle = basemapOptions.find((b) => b.id === initialBasemap)!.style
    const instance = new maplibregl.Map({
      container: containerRef.current,
      style: initialStyle,
      bounds,
      fitBoundsOptions: { padding: fitPadding },
      attributionControl: { compact: true },
    })

    instance.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right')
    instance.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left')

    mapRef.current = instance
    instance.on('load', () => {
      setMap(instance)
      setStyleVersion((v) => v + 1)
    })

    return () => {
      instance.remove()
      mapRef.current = null
      setMap(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setBasemap = (id: BasemapId) => {
    const option = basemapOptions.find((b) => b.id === id)
    const instance = mapRef.current
    if (!option || !instance) return
    instance.once('style.load', () => setStyleVersion((v) => v + 1))
    instance.setStyle(option.style)
    setBasemapState(id)
  }

  return { containerRef, map, basemap, setBasemap, styleVersion }
}
