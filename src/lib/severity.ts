import type { Force, Severity } from "./types";

export const SEVERITY_LABEL: Record<Severity, string> = {
  0: "Background",
  1: "Minor",
  2: "Moderate",
  3: "Severe",
  4: "Extreme",
};

export function severityForMagnitude(mag: number, pager?: string | null): Severity {
  let severity: Severity = 1;
  if (mag >= 4.5) severity = 2;
  if (mag >= 5.5) severity = 3;
  if (mag >= 6.5) severity = 4;
  const alert = (pager ?? "").toLowerCase();
  if (alert === "red") return 4;
  if (alert === "orange" && severity < 3) return 3;
  if (alert === "yellow" && severity < 2) return 2;
  return severity;
}

export function severityForGdacs(level: string | null | undefined): Severity {
  const value = (level ?? "").toLowerCase();
  if (value === "red") return 4;
  if (value === "orange") return 3;
  if (value === "green") return 1;
  return 1;
}

export function severityForNws(level: string | null | undefined): Severity {
  const value = (level ?? "").toLowerCase();
  if (value === "extreme") return 4;
  if (value === "severe") return 3;
  if (value === "moderate") return 2;
  if (value === "minor") return 1;
  return 1;
}

/** US AQI. Readings under 101 are not plotted. */
export function severityForAqi(aqi: number): Severity | null {
  if (!Number.isFinite(aqi) || aqi < 101) return null;
  if (aqi < 151) return 2;
  if (aqi < 201) return 3;
  return 4;
}

/**
 * EPA 24-hour PM2.5 breakpoints. Used only to place an OpenAQ reading
 * on the shared 0–4 scale. Briefs cite the measured concentration.
 */
export function severityForPm25(pm25: number): Severity | null {
  if (!Number.isFinite(pm25) || pm25 < 35.5) return null;
  if (pm25 < 55.5) return 2;
  if (pm25 < 150.5) return 3;
  return 4;
}

export function forceForGdacs(code: string | null | undefined): Force | null {
  switch ((code ?? "").toUpperCase()) {
    case "EQ":
    case "VO":
      return "land";
    case "TC":
      return "air";
    case "FL":
    case "DR":
      return "water";
    case "WF":
      return "fire";
    default:
      return null;
  }
}

const EONET_FORCE: Record<string, Force> = {
  wildfires: "fire",
  volcanoes: "land",
  severestorms: "air",
  floods: "water",
  earthquakes: "land",
  drought: "water",
  landslides: "land",
  sealakeice: "water",
  tempextremes: "air",
  dusthaze: "air",
  snow: "air",
  watercolor: "water",
};

export function forceForEonet(categoryId: string | null | undefined): Force | null {
  if (!categoryId) return null;
  return EONET_FORCE[categoryId.toLowerCase()] ?? null;
}

export function forceForNwsEvent(eventName: string): Force | null {
  const name = eventName.toLowerCase();
  if (/test message|test alert/.test(name)) return null;
  if (/volcano/.test(name)) return "land";
  if (/flood|tsunami|storm surge|seiche|hydrologic/.test(name)) return "water";
  if (/fire|red flag/.test(name)) return "fire";
  if (/earthquake|landslide|avalanche/.test(name)) return "land";
  if (/ash/.test(name)) return "air";
  if (
    /air quality|smoke|dust|heat|wind|tornado|thunder|hurricane|typhoon|tropical|winter|blizzard|ice|snow|freeze|frost|fog|chill|gale|marine|storm|cold/.test(
      name,
    )
  ) {
    return "air";
  }
  return null;
}

export function severityForFireAcres(acres: number | null): Severity {
  if (acres == null || !Number.isFinite(acres)) return 2;
  if (acres >= 50000) return 4;
  if (acres >= 10000) return 3;
  return 2;
}
