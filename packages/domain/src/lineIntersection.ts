export type Coord = [number, number]

/**
 * Intersection of two 2D segments, if any. `t`/`u` are the fractional
 * position along segment A/B respectively (0..1). Treats lng/lat as planar
 * Cartesian — accurate enough at the ~100m scale these crossings occur at.
 */
export function segmentIntersection(a1: Coord, a2: Coord, b1: Coord, b2: Coord): { point: Coord; t: number } | null {
  const d1x = a2[0] - a1[0]
  const d1y = a2[1] - a1[1]
  const d2x = b2[0] - b1[0]
  const d2y = b2[1] - b1[1]

  const denom = d1x * d2y - d1y * d2x
  if (Math.abs(denom) < 1e-15) return null

  const dx = b1[0] - a1[0]
  const dy = b1[1] - a1[1]
  const t = (dx * d2y - dy * d2x) / denom
  const u = (dx * d1y - dy * d1x) / denom

  if (t < 0 || t > 1 || u < 0 || u > 1) return null

  return { point: [a1[0] + t * d1x, a1[1] + t * d1y], t }
}
