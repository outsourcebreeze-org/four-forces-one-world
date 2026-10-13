import { AIR_CITIES, FLOOD_GAUGES, NWS_POINTS, USER_AGENT } from "./constants";
import { makeEvent, parseTime } from "./events";
import { assessFlood } from "./flood";
import { geometryPoint, round } from "./geo";
import {
  asArray,
  asNumber,
  asRecord,
  asString,
  FeedError,
  fetchJson,
  fetchText,
  isoDaysAgo,
  mapPool,
  sleep,
  todayIso,
} from "./http";
import {
  forceForEonet,
  forceForGdacs,
  forceForNwsEvent,
  severityForAqi,
  severityForFireAcres,
  severityForGdacs,
  severityForMagnitude,
  severityForNws,
  severityForPm25,
} from "./severity";
import type { HazardEvent, NewsArticle } from "./types";

const USGS_LICENSE = "USGS Earthquake Hazards Program. US government work, public domain.";
const GDACS_LICENSE = "GDACS (UN OCHA and European Commission JRC). Free with attribution.";
const EONET_LICENSE = "NASA EONET. NASA open data; attribute NASA.";
const NWS_LICENSE = "NOAA National Weather Service. US government work, public domain.";
const METEO_LICENSE =
  "Open-Meteo, non-commercial. Flood values are GloFAS via Open-Meteo. Attribute both.";
const FIRMS_LICENSE = "NASA FIRMS (LANCE / EOSDIS). Free with a MAP_KEY. Attribute NASA FIRMS.";
const OPENAQ_LICENSE = "OpenAQ. Attribute OpenAQ. Measurements stay with the reporting network.";

export function parseUsgs(payload: unknown): HazardEvent[] {
  const features = asArray(asRecord(payload)?.features);
  const events: HazardEvent[] = [];
  for (const feature of features) {
    const record = asRecord(feature);
    const properties = asRecord(record?.properties);
    const point = geometryPoint(record?.geometry);
    const mag = asNumber(properties?.mag);
    if (!record || !properties || !point || mag == null) continue;
    const id = asString(record.id) ?? asString(properties.code);
    const title = asString(properties.title);
    const url = asString(properties.url);
    const time = parseTime(properties.time);
    if (!id || !title || !url || !time) continue;
    const tsunami = asNumber(properties.tsunami) === 1;
    let severity = severityForMagnitude(mag, asString(properties.alert));
    if (tsunami && mag >= 6.5 && severity < 3) severity = 3;
    const event = makeEvent({
      id: `usgs:${id}`,
      force: "land",
      type: tsunami ? "Earthquake with tsunami flag" : "Earthquake",
      title,
      lat: point.lat,
      lon: point.lon,
      time,
      severity,
      source: "USGS",
      url,
      license: USGS_LICENSE,
      attribution: "USGS Earthquake Hazards Program",
      details: {
        magnitude: mag,
        depthKm: asNumber(asArray(asRecord(record.geometry)?.coordinates)[2]),
        place: asString(properties.place),
        pagerAlert: asString(properties.alert),
        tsunami: tsunami ? "yes" : "no",
      },
    });
    if (event) events.push(event);
  }
  return events;
}

export async function fetchUsgs(): Promise<HazardEvent[]> {
  const payload = await fetchJson(
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson",
    { timeoutMs: 20000 },
  );
  return parseUsgs(payload);
}

const GDACS_TYPE: Record<string, string> = {
  EQ: "Earthquake",
  TC: "Tropical cyclone",
  FL: "Flood",
  VO: "Volcano",
  WF: "Wildfire",
  DR: "Drought",
};

export function parseGdacs(payload: unknown): HazardEvent[] {
  const features = asArray(asRecord(payload)?.features);
  const events: HazardEvent[] = [];
  for (const feature of features) {
    const record = asRecord(feature);
    const properties = asRecord(record?.properties);
    const point = geometryPoint(record?.geometry);
    if (!properties || !point) continue;
    const code = asString(properties.eventtype);
    const force = forceForGdacs(code);
    const eventId = asNumber(properties.eventid) ?? asString(properties.eventid);
    if (!force || !code || eventId == null) continue;
    const urls = asRecord(properties.url);
    const url = asString(urls?.report) ?? asString(urls?.details);
    const time =
      parseTime(properties.datemodified) ??
      parseTime(properties.todate) ??
      parseTime(properties.fromdate);
    const title = asString(properties.name) ?? asString(properties.description);
    if (!url || !time || !title) continue;
    const severityData = asRecord(properties.severitydata);
    const event = makeEvent({
      id: `gdacs:${code}:${eventId}`,
      force,
      type: GDACS_TYPE[code] ?? code,
      title,
      lat: point.lat,
      lon: point.lon,
      time,
      severity: severityForGdacs(asString(properties.alertlevel)),
      source: "GDACS",
      url,
      license: GDACS_LICENSE,
      attribution: "GDACS / UN OCHA / EC JRC",
      details: {
        alertLevel: asString(properties.alertlevel),
        alertScore: asNumber(properties.alertscore),
        country: asString(properties.country),
        started: parseTime(properties.fromdate),
        severityText: asString(severityData?.severitytext),
        severityValue: asNumber(severityData?.severity),
        severityUnit: asString(severityData?.severityunit),
      },
    });
    if (event) events.push(event);
  }
  return events;
}

export async function fetchGdacs(): Promise<HazardEvent[]> {
  const today = todayIso();
  const high = await fetchJson(
    `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=EQ;TC;FL;VO;WF;DR&fromDate=${isoDaysAgo(45)}&toDate=${today}&alertlevel=Orange;Red`,
    { timeoutMs: 20000 },
  );
  const green = await fetchJson(
    `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=EQ;TC;VO;WF&fromDate=${isoDaysAgo(10)}&toDate=${today}&alertlevel=Green`,
    { timeoutMs: 20000 },
  );
  const merged = new Map<string, HazardEvent>();
  for (const event of [...parseGdacs(high), ...parseGdacs(green)]) {
    merged.set(event.id, event);
  }
  return [...merged.values()];
}

export function parseEonet(payload: unknown): HazardEvent[] {
  const events: HazardEvent[] = [];
  for (const item of asArray(asRecord(payload)?.events)) {
    const record = asRecord(item);
    if (!record) continue;
    const categories = asArray(record.categories)
      .map((entry) => asRecord(entry))
      .filter((entry): entry is Record<string, unknown> => Boolean(entry));
    const category = categories.find((entry) => forceForEonet(asString(entry.id)));
    const force = forceForEonet(asString(category?.id));
    if (!force || !category) continue;
    const geometries = asArray(record.geometry)
      .map((entry) => asRecord(entry))
      .filter((entry): entry is Record<string, unknown> => Boolean(entry));
    const latest = geometries[geometries.length - 1];
    const point = geometryPoint(latest);
    const id = asString(record.id);
    const title = asString(record.title);
    const sources = asArray(record.sources).map((entry) => asRecord(entry));
    const url = asString(sources[0]?.url) ?? (id ? `https://eonet.gsfc.nasa.gov/api/v3/events/${id}` : null);
    const time = parseTime(latest?.date);
    if (!id || !title || !point || !url || !time) continue;
    const acres =
      asString(latest?.magnitudeUnit)?.toLowerCase() === "acres"
        ? asNumber(latest?.magnitudeValue)
        : null;
    const event = makeEvent({
      id: `eonet:${id}`,
      force,
      type: asString(category.title) ?? "Natural event",
      title,
      lat: point.lat,
      lon: point.lon,
      time,
      severity: force === "fire" ? severityForFireAcres(acres) : 2,
      source: "NASA EONET",
      url,
      license: EONET_LICENSE,
      attribution: "NASA Earth Observatory Natural Event Tracker",
      details: {
        description: asString(record.description),
        category: asString(category.id),
        magnitudeValue: asNumber(latest?.magnitudeValue),
        magnitudeUnit: asString(latest?.magnitudeUnit),
      },
    });
    if (event) events.push(event);
  }
  return events;
}

export async function fetchEonet(): Promise<HazardEvent[]> {
  const payload = await fetchJson(
    "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=80",
    { timeoutMs: 20000 },
  );
  return parseEonet(payload);
}

function nwsUrl(id: string): string {
  return `https://api.weather.gov/alerts/${encodeURIComponent(id)}`;
}

export function parseNwsFeature(
  feature: unknown,
  plotAt?: { lat: number; lon: number; name: string },
): HazardEvent | null {
  const record = asRecord(feature);
  const properties = asRecord(record?.properties);
  if (!properties) return null;
  const eventName = asString(properties.event);
  if (!eventName) return null;
  const force = forceForNwsEvent(eventName);
  if (!force) return null;
  const severityName = asString(properties.severity) ?? "";
  if (severityName.toLowerCase() === "minor" || severityName.toLowerCase() === "unknown") {
    return null;
  }
  const id = asString(properties.id);
  const point = geometryPoint(record?.geometry) ?? (plotAt ? { lat: plotAt.lat, lon: plotAt.lon } : null);
  const time = parseTime(properties.onset) ?? parseTime(properties.sent) ?? parseTime(properties.effective);
  const title = asString(properties.headline) ?? eventName;
  if (!id || !point || !time) return null;
  return makeEvent({
    id: `nws:${id}`,
    force,
    type: eventName,
    title,
    lat: point.lat,
    lon: point.lon,
    time,
    severity: severityForNws(severityName),
    source: "NOAA/NWS",
    url: nwsUrl(id),
    license: NWS_LICENSE,
    attribution: "NOAA / National Weather Service",
    details: {
      severity: severityName,
      urgency: asString(properties.urgency),
      certainty: asString(properties.certainty),
      area: asString(properties.areaDesc),
      ends: parseTime(properties.ends),
      sender: asString(properties.senderName),
      plottedAt: plotAt ? `${plotAt.name} watch point` : "alert geometry",
    },
  });
}

export function parseNws(payload: unknown): HazardEvent[] {
  const events: HazardEvent[] = [];
  for (const feature of asArray(asRecord(payload)?.features)) {
    const event = parseNwsFeature(feature);
    if (event) events.push(event);
  }
  return events;
}

export async function fetchNws(): Promise<HazardEvent[]> {
  const headers = { "User-Agent": USER_AGENT, Accept: "application/geo+json" };
  const active = await fetchJson<unknown>("https://api.weather.gov/alerts/active?status=actual", {
    timeoutMs: 20000,
    headers,
  });
  const byId = new Map<string, HazardEvent>();
  for (const event of parseNws(active)) byId.set(event.id, event);
  const pointed = await mapPool(NWS_POINTS, 4, async (city) => {
    try {
      const payload = await fetchJson<unknown>(
        `https://api.weather.gov/alerts/active?point=${city.lat},${city.lon}`,
        { timeoutMs: 12000, headers },
      );
      return asArray(asRecord(payload)?.features)
        .map((feature) => parseNwsFeature(feature, city))
        .filter((event): event is HazardEvent => Boolean(event));
    } catch {
      return [];
    }
  });
  for (const event of pointed.flat()) {
    if (!byId.has(event.id)) byId.set(event.id, event);
  }
  return [...byId.values()].slice(0, 120);
}

function nearestCity<T extends { name: string; lat: number; lon: number }>(
  cities: readonly T[],
  lat: number,
  lon: number,
): T {
  return cities.reduce((best, city) => {
    const score = (city.lat - lat) ** 2 + (city.lon - lon) ** 2;
    const bestScore = (best.lat - lat) ** 2 + (best.lon - lon) ** 2;
    return score < bestScore ? city : best;
  });
}

export function parseOpenMeteoFlood(payload: unknown): HazardEvent[] {
  const rows = Array.isArray(payload) ? payload : [payload];
  const events: HazardEvent[] = [];
  for (const row of rows) {
    const record = asRecord(row);
    const daily = asRecord(record?.daily);
    const lat = asNumber(record?.latitude);
    const lon = asNumber(record?.longitude);
    if (!daily || lat == null || lon == null) continue;
    const series = asArray(daily.river_discharge).map((value) => asNumber(value));
    const assessment = assessFlood(series, 7);
    if (!assessment) continue;
    const gauge = nearestCity(FLOOD_GAUGES, lat, lon);
    const times = asArray(daily.time).map((value) => asString(value));
    const time = parseTime(times[times.length - 8] ?? times[times.length - 1]) ?? new Date().toISOString();
    const event = makeEvent({
      id: `openmeteo-flood:${round(lat, 2)}:${round(lon, 2)}:${time.slice(0, 10)}`,
      force: "water",
      type: "River discharge",
      title: `Elevated river discharge, ${gauge.name}`,
      lat,
      lon,
      time,
      severity: assessment.severity,
      source: "Open-Meteo Flood",
      url: "https://open-meteo.com/en/docs/flood-api",
      license: METEO_LICENSE,
      attribution: "Open-Meteo.com and GloFAS (Copernicus EMS)",
      details: {
        place: gauge.name,
        peakDischargeM3s: assessment.peak,
        baselineP90M3s: assessment.p90,
        peakToP90: assessment.ratio,
        unit: "m3/s",
      },
    });
    if (event) events.push(event);
  }
  return events;
}

export function parseOpenMeteoAir(payload: unknown): HazardEvent[] {
  const rows = Array.isArray(payload) ? payload : [payload];
  const events: HazardEvent[] = [];
  for (const row of rows) {
    const record = asRecord(row);
    const current = asRecord(record?.current);
    const lat = asNumber(record?.latitude);
    const lon = asNumber(record?.longitude);
    const aqi = asNumber(current?.us_aqi);
    if (!current || lat == null || lon == null || aqi == null) continue;
    const severity = severityForAqi(aqi);
    if (severity == null) continue;
    const city = nearestCity(AIR_CITIES, lat, lon);
    const time = parseTime(current.time) ?? new Date().toISOString();
    const event = makeEvent({
      id: `openmeteo-air:${city.name}:${time.slice(0, 13)}`,
      force: "air",
      type: "Air quality",
      title: `Elevated air quality index in ${city.name}`,
      lat,
      lon,
      time,
      severity,
      source: "Open-Meteo Air Quality",
      url: "https://open-meteo.com/en/docs/air-quality-api",
      license: METEO_LICENSE,
      attribution: "Open-Meteo.com air quality (CAMS)",
      details: {
        place: city.name,
        usAqi: aqi,
        pm25: asNumber(current.pm2_5),
        pm10: asNumber(current.pm10),
      },
    });
    if (event) events.push(event);
  }
  return events;
}

export async function fetchOpenMeteo(): Promise<{ flood: HazardEvent[]; air: HazardEvent[] }> {
  const lat = FLOOD_GAUGES.map((gauge) => gauge.lat).join(",");
  const lon = FLOOD_GAUGES.map((gauge) => gauge.lon).join(",");
  const airLat = AIR_CITIES.map((city) => city.lat).join(",");
  const airLon = AIR_CITIES.map((city) => city.lon).join(",");
  const [floodPayload, airPayload] = await Promise.all([
    fetchJson(
      `https://flood-api.open-meteo.com/v1/flood?latitude=${lat}&longitude=${lon}&daily=river_discharge&past_days=365&forecast_days=7&timezone=GMT`,
      { timeoutMs: 20000 },
    ),
    fetchJson(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${airLat}&longitude=${airLon}&current=us_aqi,pm2_5,pm10&timezone=UTC`,
      { timeoutMs: 20000 },
    ),
  ]);
  return { flood: parseOpenMeteoFlood(floodPayload), air: parseOpenMeteoAir(airPayload) };
}

/** Minimum gap between GDELT requests, including a retry. */
export const GDELT_MIN_GAP_MS = 5_000;

/**
 * Extra wait after HTTP 429, before the next try.
 * Index 0 is the first retry. A null delay means stop.
 */
export const GDELT_429_BACKOFF_MS = [12_000, 28_000] as const;

/** Stop retrying once the next wait would push this call past the serverless limit. */
export const GDELT_RETRY_BUDGET_MS = 50_000;

let gdeltReadyAt = 0;

export function gdeltRetryDelayMs(retryIndex: number): number | null {
  return GDELT_429_BACKOFF_MS[retryIndex] ?? null;
}

export async function throttleGdelt(): Promise<void> {
  const wait = gdeltReadyAt - Date.now();
  if (wait > 0) await sleep(wait);
  gdeltReadyAt = Date.now() + GDELT_MIN_GAP_MS;
}

export function parseGdelt(payload: unknown): NewsArticle[] {
  const articles = asArray(asRecord(payload)?.articles);
  const parsed: NewsArticle[] = [];
  for (const item of articles) {
    const record = asRecord(item);
    const title = asString(record?.title);
    const url = asString(record?.url);
    if (!title || !url || !/^https?:\/\//.test(url)) continue;
    const seen = asString(record?.seendate);
    const time = seen && /^\d{8}/.test(seen)
      ? parseTime(
          `${seen.slice(0, 4)}-${seen.slice(4, 6)}-${seen.slice(6, 8)}T${seen.slice(9, 11) || "00"}:${seen.slice(11, 13) || "00"}:00Z`,
        )
      : null;
    parsed.push({
      title,
      url,
      source: asString(record?.domain) ?? "GDELT",
      time,
      origin: "gdelt",
    });
  }
  return parsed;
}

export async function fetchGdelt(): Promise<NewsArticle[]> {
  const query = "(earthquake OR wildfire OR flood OR cyclone OR typhoon OR volcano) sourcelang:english";
  const url =
    "https://api.gdeltproject.org/api/v2/doc/doc?query=" +
    encodeURIComponent(query) +
    "&mode=ArtList&maxrecords=12&format=json&sort=DateDesc&timespan=2d";
  const attempts = GDELT_429_BACKOFF_MS.length + 1;
  const started = Date.now();
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await throttleGdelt();
    try {
      const payload = await fetchJson(url, { timeoutMs: 20000 });
      return parseGdelt(payload);
    } catch (error) {
      lastError = error;
      const status = error instanceof FeedError ? error.status : null;
      const delay = gdeltRetryDelayMs(attempt);
      const room = GDELT_RETRY_BUDGET_MS - (Date.now() - started);
      if (status !== 429 || delay == null || delay > room) throw error;
      gdeltReadyAt = Math.max(gdeltReadyAt, Date.now() + delay);
      await sleep(delay);
    }
  }
  throw lastError instanceof Error ? lastError : new FeedError("GDELT failed");
}

function firmsConfidenceKept(value: string): boolean {
  const text = value.toLowerCase();
  if (text === "l" || text === "low") return false;
  // VIIRS labels a real hotspot "nominal" much more often than "high".
  if (text === "h" || text === "high" || text === "n" || text === "nominal") return true;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 80;
}

export function parseFirms(csv: string): HazardEvent[] {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim() && !line.startsWith("<"));
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((cell) => cell.trim().toLowerCase());
  const index = (name: string) => header.indexOf(name);
  const latI = index("latitude");
  const lonI = index("longitude");
  const dateI = index("acq_date");
  const timeI = index("acq_time");
  const confI = index("confidence");
  const frpI = index("frp");
  if (latI < 0 || lonI < 0) return [];
  const kept = new Map<string, HazardEvent>();
  for (const line of lines.slice(1)) {
    const cells = line.split(",");
    if (confI >= 0 && !firmsConfidenceKept(cells[confI] ?? "")) continue;
    const lat = Number(cells[latI]);
    const lon = Number(cells[lonI]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const day = cells[dateI] || todayIso();
    const clock = (cells[timeI] || "0000").padStart(4, "0");
    const time = parseTime(`${day}T${clock.slice(0, 2)}:${clock.slice(2, 4)}:00Z`);
    if (!time) continue;
    const cell = `${round(lat, 0)}:${round(lon, 0)}`;
    const frp = frpI >= 0 ? Number(cells[frpI]) : null;
    const severity = frp != null && frp >= 100 ? 3 : 2;
    const event = makeEvent({
      id: `firms:${cell}:${day}`,
      force: "fire",
      type: "Active fire hotspot",
      title: `Active fire hotspot near ${round(lat, 1)}, ${round(lon, 1)}`,
      lat,
      lon,
      time,
      severity,
      source: "NASA FIRMS",
      url: `https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@${lon},${lat},6z`,
      license: FIRMS_LICENSE,
      attribution: "NASA FIRMS",
      details: {
        frp: Number.isFinite(frp ?? NaN) ? frp : null,
        confidence: cells[confI] ?? null,
        acquired: day,
      },
    });
    if (!event) continue;
    const previous = kept.get(cell);
    if (!previous || event.severity > previous.severity) kept.set(cell, event);
    if (kept.size >= 180) break;
  }
  return [...kept.values()];
}

export async function fetchFirms(mapKey: string): Promise<HazardEvent[]> {
  const areas = ["-130,-50,-30,55", "-20,-35,55,40", "60,-40,160,50"];
  const batches = await mapPool(areas, 2, async (area) => {
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(mapKey)}/VIIRS_SNPP_NRT/${area}/2`;
    const csv = await fetchText(url, { timeoutMs: 25000, maxBytes: 3_000_000 });
    return parseFirms(csv);
  });
  const merged = new Map<string, HazardEvent>();
  for (const event of batches.flat()) merged.set(event.id, event);
  return [...merged.values()].slice(0, 200);
}

export function parseOpenAqLatest(
  location: { id: string; name: string; lat: number; lon: number; sensorId: number },
  payload: unknown,
): HazardEvent | null {
  const results = asArray(asRecord(payload)?.results);
  const pm = results
    .map((item) => asRecord(item))
    .find((item) => asNumber(item?.sensorsId) === location.sensorId);
  const value = asNumber(pm?.value);
  if (!pm || value == null) return null;
  const severity = severityForPm25(value);
  if (severity == null) return null;
  const time = parseTime(asRecord(asRecord(pm.datetime)?.utc)?.utc ?? asRecord(pm.datetime)?.utc) ??
    parseTime(asString(asRecord(pm.period)?.datetimeFrom)) ??
    new Date().toISOString();
  return makeEvent({
    id: `openaq:${location.id}:${time.slice(0, 13)}`,
    force: "air",
    type: "Station PM2.5",
    title: `Elevated PM2.5 at ${location.name}`,
    lat: location.lat,
    lon: location.lon,
    time,
    severity,
    source: "OpenAQ",
    url: `https://explore.openaq.org/locations/${location.id}`,
    license: OPENAQ_LICENSE,
    attribution: "OpenAQ",
    details: {
      place: location.name,
      pm25: value,
      units: asString(asRecord(pm.parameter)?.units) ?? "µg/m³",
    },
  });
}

export async function fetchOpenAq(apiKey: string): Promise<HazardEvent[]> {
  // v3 only accepts order_by=id. Newest location ids are the active stations.
  const payload = await fetchJson<unknown>(
    "https://api.openaq.org/v3/locations?limit=16&parameters_id=2&order_by=id&sort_order=desc",
    { timeoutMs: 15000, headers: { "X-API-Key": apiKey } },
  );
  const locations = asArray(asRecord(payload)?.results)
    .map((item) => {
      const record = asRecord(item);
      const coordinates = asRecord(record?.coordinates);
      const id = asNumber(record?.id) ?? asString(record?.id);
      const name = asString(record?.name);
      const lat = asNumber(coordinates?.latitude);
      const lon = asNumber(coordinates?.longitude);
      const sensor = asArray(record?.sensors)
        .map((entry) => asRecord(entry))
        .find((entry) => asString(asRecord(entry?.parameter)?.name)?.toLowerCase() === "pm25");
      const sensorId = asNumber(sensor?.id);
      if (id == null || !name || lat == null || lon == null || sensorId == null) return null;
      return { id: String(id), name, lat, lon, sensorId };
    })
    .filter(
      (location): location is { id: string; name: string; lat: number; lon: number; sensorId: number } =>
        Boolean(location),
    )
    .slice(0, 12);
  const readings = await mapPool(locations, 3, async (location) => {
    try {
      const latest = await fetchJson(
        `https://api.openaq.org/v3/locations/${location.id}/latest`,
        { timeoutMs: 12000, headers: { "X-API-Key": apiKey } },
      );
      return parseOpenAqLatest(location, latest);
    } catch {
      return null;
    }
  });
  return readings.filter((event): event is HazardEvent => Boolean(event));
}
