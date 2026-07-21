import { jsPDF } from 'jspdf'
import { mockUtilityLayers } from '../data/mockPlanning'
import type { PlanningParameters, PlanningResult, UtilityCrossing } from '../types/hdd'

const utilityLabels = Object.fromEntries(mockUtilityLayers.map((l) => [l.type, l.label])) as Record<
  UtilityCrossing['type'],
  string
>

const MARGIN_X = 20
const PAGE_BOTTOM = 280
const LINE_HEIGHT = 6

function formatPoint(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
}

/** Same content/section order as `reportGenerator.ts`'s `buildReportHtml` — this is its PDF sibling, generated client-side with jsPDF (pure JS, no native deps) instead of downloaded HTML. */
export function buildReportPdf(
  projectName: string,
  projectCode: string,
  parameters: PlanningParameters,
  result: PlanningResult,
  conflicts: UtilityCrossing[],
): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = 20

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_BOTTOM) {
      doc.addPage()
      y = 20
    }
  }

  const heading = (text: string) => {
    ensureSpace(LINE_HEIGHT * 2)
    y += 4
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(text.toUpperCase(), MARGIN_X, y)
    y += 1.5
    doc.setDrawColor(220)
    doc.line(MARGIN_X, y, 210 - MARGIN_X, y)
    y += LINE_HEIGHT
    doc.setFont('helvetica', 'normal')
  }

  const row = (label: string, value: string) => {
    ensureSpace(LINE_HEIGHT)
    doc.setFontSize(9)
    doc.setTextColor(90)
    doc.text(label, MARGIN_X, y)
    doc.setTextColor(20)
    doc.text(value, MARGIN_X + 55, y)
    y += LINE_HEIGHT
  }

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(projectName, MARGIN_X, y)
  y += 7
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(90)
  doc.text(`${projectCode} · Erstellt am ${new Date().toLocaleString('de-DE')}`, MARGIN_X, y)
  doc.setTextColor(20)
  y += 4

  heading('Planungsparameter')
  row('Startpunkt', parameters.startPoint ? formatPoint(parameters.startPoint.lat, parameters.startPoint.lng) : 'Nicht gesetzt')
  row('Zielpunkt', parameters.endPoint ? formatPoint(parameters.endPoint.lat, parameters.endPoint.lng) : 'Nicht gesetzt')
  row('Bohrgerät', parameters.drillRig)
  row('Bohrdurchmesser', `${parameters.pipeDiameterMm} mm`)
  row('Bohrradius (min.)', `${parameters.minDrillRadiusM} m`)
  row('Eintrittswinkel', `${parameters.entryAngleDeg}°`)
  row('Austrittswinkel', `${parameters.exitAngleDeg}°`)
  row('Sicherheitsabstand', `${parameters.safetyDistanceM} m`)

  heading('Ergebnisse')
  row('Bohrlänge (gesamt)', `${result.totalLengthM.toFixed(2)} m`)
  row('Bohrlänge (horizontal)', `${result.horizontalLengthM.toFixed(2)} m`)
  row('Max. Tiefe', `${result.maxDepthM.toFixed(2)} m`)
  row('Min. Radius', `${result.minRadiusM.toFixed(2)} m`)
  row('Eintrittspunkt', formatPoint(result.entryPoint.lat, result.entryPoint.lng))
  row('Austrittspunkt', formatPoint(result.exitPoint.lat, result.exitPoint.lng))

  if (result.warnings.length) {
    heading('Warnungen')
    doc.setFontSize(9)
    for (const w of result.warnings) {
      ensureSpace(LINE_HEIGHT)
      doc.setTextColor(161, 92, 0)
      doc.text(`• ${w}`, MARGIN_X, y)
      doc.setTextColor(20)
      y += LINE_HEIGHT
    }
  }

  const conflictCount = conflicts.filter((c) => c.isConflict).length
  heading(`Kollisionsprüfung${conflictCount > 0 ? ` (${conflictCount} Konflikt${conflictCount > 1 ? 'e' : ''})` : ''}`)

  const cols = [
    { label: 'Leitung', x: MARGIN_X, w: 32 },
    { label: 'Distanz', x: MARGIN_X + 32, w: 24 },
    { label: 'Bohrtiefe', x: MARGIN_X + 56, w: 24 },
    { label: 'Leitungstiefe', x: MARGIN_X + 80, w: 28 },
    { label: 'Abstand', x: MARGIN_X + 108, w: 24 },
    { label: 'Status', x: MARGIN_X + 132, w: 30 },
  ]
  ensureSpace(LINE_HEIGHT)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(90)
  for (const c of cols) doc.text(c.label, c.x, y)
  doc.setTextColor(20)
  doc.setFont('helvetica', 'normal')
  y += LINE_HEIGHT

  if (conflicts.length === 0) {
    ensureSpace(LINE_HEIGHT)
    doc.setFontSize(9)
    doc.text('Keine Leitungskreuzungen im Bohrpfad.', MARGIN_X, y)
    y += LINE_HEIGHT
  } else {
    for (const c of conflicts) {
      ensureSpace(LINE_HEIGHT)
      doc.setFontSize(8)
      if (c.isConflict) doc.setTextColor(179, 38, 30)
      doc.text(utilityLabels[c.type], cols[0].x, y)
      doc.text(`${c.distanceM.toFixed(2)} m`, cols[1].x, y)
      doc.text(`${c.drillDepthM.toFixed(2)} m`, cols[2].x, y)
      doc.text(`${c.utilityDepthM.toFixed(2)} m`, cols[3].x, y)
      doc.text(`${c.clearanceM.toFixed(2)} m`, cols[4].x, y)
      doc.text(c.isConflict ? 'Konflikt' : 'OK', cols[5].x, y)
      doc.setTextColor(20)
      y += LINE_HEIGHT
    }
  }

  ensureSpace(LINE_HEIGHT * 2)
  y = Math.max(y, PAGE_BOTTOM - 4)
  doc.setFontSize(7)
  doc.setTextColor(140)
  doc.text(
    'Angaben zur Rohrgeometrie und Bodenverhältnissen sind vereinfacht und nicht für die Bauausführung freigegeben — HDD Planner Demo.',
    MARGIN_X,
    y,
  )

  return doc.output('blob')
}
