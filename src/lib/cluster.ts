import { createHash } from "node:crypto";
import { haversineKm, round } from "./geo";
import type { HazardEvent, NearbySituation, Severity, Situation } from "./types";

const NEAR_KM = 150;
const FAR_KM = 320;
const NEAR_HOURS = 24 * 14;
const FAR_HOURS = 96;
const NEIGHBOR_KM = 500;

function hoursApart(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 36e5;
}

function sameCluster(anchor: HazardEvent, event: HazardEvent): boolean {
  if (anchor.force !== event.force) return false;
  const km = haversineKm(anchor, event);
  const hours = hoursApart(anchor.time, event.time);
  if (km <= NEAR_KM && hours <= NEAR_HOURS) return true;
  return km <= FAR_KM && hours <= FAR_HOURS;
}

function situationId(eventIds: string[]): string {
  const digest = createHash("sha1").update([...eventIds].sort().join("|")).digest("hex");
  return `sit_${digest.slice(0, 12)}`;
}

function placeOf(event: HazardEvent): string | null {
  const place = event.details.place ?? event.details.country ?? event.details.area;
  return typeof place === "string" ? place : null;
}

export function clusterEvents(events: HazardEvent[]): Situation[] {
  const ordered = [...events].sort((a, b) => {
    if (b.severity !== a.severity) return b.severity - a.severity;
    return b.time.localeCompare(a.time);
  });
  const groups: HazardEvent[][] = [];
  for (const event of ordered) {
    const group = groups.find((candidate) => candidate.some((member) => sameCluster(member, event)));
    if (group) group.push(event);
    else groups.push([event]);
  }

  const situations: Situation[] = groups.map((group) => {
    const lead = [...group].sort((a, b) => b.severity - a.severity || b.time.localeCompare(a.time))[0];
    const weight = group.reduce((sum, event) => sum + event.severity + 1, 0);
    const lat = group.reduce((sum, event) => sum + event.lat * (event.severity + 1), 0) / weight;
    const lon = group.reduce((sum, event) => sum + event.lon * (event.severity + 1), 0) / weight;
    const eventIds = group.map((event) => event.id);
    return {
      id: situationId(eventIds),
      force: lead.force,
      title: lead.title,
      lat: round(lat, 4),
      lon: round(lon, 4),
      time: group.map((event) => event.time).sort().at(-1) ?? lead.time,
      severity: Math.max(...group.map((event) => event.severity)) as Severity,
      eventIds,
      sources: [...new Set(group.map((event) => event.source))],
      types: [...new Set(group.map((event) => event.type))],
      place: group.map(placeOf).find((place) => place) ?? null,
      nearby: [],
    };
  });

  for (const situation of situations) {
    const nearby: NearbySituation[] = [];
    for (const other of situations) {
      if (other.id === situation.id || other.force === situation.force) continue;
      const km = haversineKm(situation, other);
      if (km > NEIGHBOR_KM) continue;
      nearby.push({
        id: other.id,
        force: other.force,
        title: other.title,
        severity: other.severity,
        km: round(km, 0),
      });
    }
    situation.nearby = nearby.sort((a, b) => a.km - b.km).slice(0, 4);
  }

  return situations.sort((a, b) => b.severity - a.severity || b.time.localeCompare(a.time));
}
