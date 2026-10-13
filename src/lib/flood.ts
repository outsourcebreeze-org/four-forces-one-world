import { quantile, round } from "./geo";

export type FloodAssessment = {
  severity: 2 | 3 | 4;
  peak: number;
  p90: number;
  ratio: number;
};

/**
 * Compare the latest week and the short forecast with the prior-year 90th
 * percentile. Tiny GloFAS cells (under 80 m³/s) are ignored so a ditch is
 * not treated as a flood.
 */
export function assessFlood(
  series: Array<number | null>,
  forecastDays: number,
): FloodAssessment | null {
  if (series.length < forecastDays + 60) return null;
  const recentStart = series.length - forecastDays - 7;
  if (recentStart < 60) return null;
  const baseline = series
    .slice(0, recentStart)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const recent = series
    .slice(recentStart)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (baseline.length < 60 || recent.length === 0) return null;
  const sorted = [...baseline].sort((a, b) => a - b);
  const p90 = quantile(sorted, 0.9);
  const peak = Math.max(...recent);
  if (!(p90 > 0) || peak < 80) return null;
  const ratio = peak / p90;
  if (ratio < 1) return null;
  let severity: 2 | 3 | 4 = 2;
  if (ratio >= 1.35) severity = 3;
  if (ratio >= 1.8) severity = 4;
  return {
    severity,
    peak: round(peak, 1),
    p90: round(p90, 1),
    ratio: round(ratio, 2),
  };
}
