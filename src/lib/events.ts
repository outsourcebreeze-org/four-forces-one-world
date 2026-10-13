import { isFiniteCoord, round } from "./geo";
import type { DetailValue, HazardEvent, Severity } from "./types";

export function makeEvent(
  input: Omit<HazardEvent, "details" | "severity"> & {
    severity: number;
    details?: Record<string, DetailValue>;
  },
): HazardEvent | null {
  if (!isFiniteCoord(input.lat, input.lon)) return null;
  if (!input.id || !input.title || !input.url || !input.time) return null;
  const severity = Math.min(4, Math.max(0, Math.round(input.severity))) as Severity;
  const details: Record<string, DetailValue> = {};
  for (const [key, value] of Object.entries(input.details ?? {})) {
    if (value === undefined) continue;
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))
    ) {
      details[key] = typeof value === "number" ? round(value, 2) : value;
    }
  }
  return {
    ...input,
    lat: round(input.lat, 4),
    lon: round(input.lon, 4),
    severity,
    title: input.title.replace(/\s+/g, " ").trim(),
    details,
  };
}

export function parseTime(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 10_000_000_000 ? value * 1000 : value;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const normalized = /([zZ]|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}
