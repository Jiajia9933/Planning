import { mockUtilityLayers } from '../data/mockPlanning'
import type { PlanningParameters, PlanningResult, UtilityCrossing } from '../types/hdd'

const utilityLabels = Object.fromEntries(mockUtilityLayers.map((l) => [l.type, l.label])) as Record<
  UtilityCrossing['type'],
  string
>

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!)
}

function formatPoint(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
}

function row(label: string, value: string): string {
  return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`
}

/**
 * Builds a standalone, printable HTML report — no server round-trip needed
 * for the demo, and the download/print affordance works the same once a
 * real backend-rendered report replaces this.
 */
export function buildReportHtml(
  projectName: string,
  projectCode: string,
  parameters: PlanningParameters,
  result: PlanningResult,
  conflicts: UtilityCrossing[],
): string {
  const generatedAt = new Date().toLocaleString('de-DE')
  const conflictCount = conflicts.filter((c) => c.isConflict).length

  const conflictRows = conflicts.length
    ? conflicts
        .map(
          (c) => `<tr class="${c.isConflict ? 'conflict' : ''}">
            <td>${escapeHtml(utilityLabels[c.type])}</td>
            <td>${c.distanceM.toFixed(2)} m</td>
            <td>${c.drillDepthM.toFixed(2)} m</td>
            <td>${c.utilityDepthM.toFixed(2)} m</td>
            <td>${c.clearanceM.toFixed(2)} m</td>
            <td>${c.isConflict ? '⚠ Konflikt' : 'OK'}</td>
          </tr>`,
        )
        .join('')
    : '<tr><td colspan="6">Keine Leitungskreuzungen im Bohrpfad.</td></tr>'

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<title>Bohrungsbericht ${escapeHtml(projectCode)}</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #1a1f27; max-width: 800px; margin: 40px auto; padding: 0 24px; }
  h1 { font-size: 22px; margin-bottom: 0; }
  .subtitle { color: #5b6470; margin-top: 4px; margin-bottom: 24px; }
  h2 { font-size: 15px; text-transform: uppercase; letter-spacing: 0.5px; color: #5b6470; border-bottom: 1px solid #dde1e6; padding-bottom: 6px; margin-top: 32px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { text-align: left; padding: 6px 8px; font-size: 13px; border-bottom: 1px solid #eef0f2; }
  th { color: #5b6470; font-weight: 600; width: 40%; }
  .conflict { background: #fdecec; color: #b3261e; font-weight: 600; }
  .warning { color: #a15c00; }
  footer { margin-top: 40px; font-size: 11px; color: #8892a0; }
</style>
</head>
<body>
  <h1>${escapeHtml(projectName)}</h1>
  <div class="subtitle">${escapeHtml(projectCode)} · Erstellt am ${escapeHtml(generatedAt)}</div>

  <h2>Planungsparameter</h2>
  <table>
    ${row('Startpunkt', formatPoint(parameters.startPoint.lat, parameters.startPoint.lng))}
    ${row('Zielpunkt', formatPoint(parameters.endPoint.lat, parameters.endPoint.lng))}
    ${row('Bohrgerät', parameters.drillRig)}
    ${row('Bohrdurchmesser', `${parameters.pipeDiameterMm} mm`)}
    ${row('Bohrradius (min.)', `${parameters.minDrillRadiusM} m`)}
    ${row('Eintrittswinkel', `${parameters.entryAngleDeg}°`)}
    ${row('Austrittswinkel', `${parameters.exitAngleDeg}°`)}
    ${row('Sicherheitsabstand', `${parameters.safetyDistanceM} m`)}
  </table>

  <h2>Ergebnisse</h2>
  <table>
    ${row('Bohrlänge (gesamt)', `${result.totalLengthM.toFixed(2)} m`)}
    ${row('Bohrlänge (horizontal)', `${result.horizontalLengthM.toFixed(2)} m`)}
    ${row('Max. Tiefe', `${result.maxDepthM.toFixed(2)} m`)}
    ${row('Min. Radius', `${result.minRadiusM.toFixed(2)} m`)}
    ${row('Eintrittspunkt', formatPoint(result.entryPoint.lat, result.entryPoint.lng))}
    ${row('Austrittspunkt', formatPoint(result.exitPoint.lat, result.exitPoint.lng))}
  </table>

  ${
    result.warnings.length
      ? `<h2>Warnungen</h2><ul class="warning">${result.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>`
      : ''
  }

  <h2>Kollisionsprüfung ${conflictCount > 0 ? `(${conflictCount} Konflikt${conflictCount > 1 ? 'e' : ''})` : ''}</h2>
  <table>
    <thead><tr><th>Leitung</th><th>Distanz</th><th>Bohrtiefe</th><th>Leitungstiefe</th><th>Abstand</th><th>Status</th></tr></thead>
    <tbody>${conflictRows}</tbody>
  </table>

  <footer>Angaben zur Rohrgeometrie und Bodenverhältnissen sind vereinfacht und nicht für die Bauausführung freigegeben — HDD Planner Demo.</footer>
</body>
</html>`
}
