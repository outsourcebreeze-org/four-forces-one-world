export function round(value: number, digits = 1): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

export function quantile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return Number.NaN;
  const index = (sortedAsc.length - 1) * p;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sortedAsc[low];
  return sortedAsc[low] * (high - index) + sortedAsc[high] * (index - low);
}

export function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const radius = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isFiniteCoord(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
  );
}

type Ring = number[][];

function ringCentroid(ring: Ring): { lat: number; lon: number } | null {
  if (!ring?.length) return null;
  let lat = 0;
  let lon = 0;
  let count = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const pair = ring[i];
    const x = pair?.[0];
    const y = pair?.[1];
    if (typeof x !== "number" || typeof y !== "number") continue;
    const isClosing =
      count > 0 &&
      i === ring.length - 1 &&
      x === ring[0]?.[0] &&
      y === ring[0]?.[1];
    if (isClosing) continue;
    lon += x;
    lat += y;
    count += 1;
  }
  if (!count) return null;
  const point = { lat: lat / count, lon: lon / count };
  return isFiniteCoord(point.lat, point.lon) ? point : null;
}

export function geometryPoint(geometry: unknown): { lat: number; lon: number } | null {
  if (!geometry || typeof geometry !== "object") return null;
  const record = geometry as { type?: string; coordinates?: unknown };
  if (record.type === "Point" && Array.isArray(record.coordinates)) {
    const [lon, lat] = record.coordinates;
    if (typeof lat === "number" && typeof lon === "number" && isFiniteCoord(lat, lon)) {
      return { lat, lon };
    }
    return null;
  }
  if (record.type === "Polygon" && Array.isArray(record.coordinates)) {
    return ringCentroid(record.coordinates[0] as Ring);
  }
  if (record.type === "MultiPolygon" && Array.isArray(record.coordinates)) {
    let best: Ring | null = null;
    for (const polygon of record.coordinates) {
      const ring = Array.isArray(polygon) ? (polygon[0] as Ring) : null;
      if (ring && (!best || ring.length > best.length)) best = ring;
    }
    return best ? ringCentroid(best) : null;
  }
  return null;
}
