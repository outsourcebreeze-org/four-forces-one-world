import { haversineKm, isFiniteCoord, round } from "./geo";

export const CAMERA_RADIUS_KM = 50;
export const CAMERA_LIMIT = 3;

export const USGS_CAMERAS_URL =
  "https://api.waterdata.usgs.gov/nims/v0/cameras?returnFields=camId,camName,lat,lng,smallDir,newestImageDT,hideCam,stateAbrv,nwisId";
export const QUEBEC_CAMERAS_URL =
  "https://ws.mapserver.transports.gouv.qc.ca/swtq?service=wfs&version=2.0.0&request=getfeature&typename=ms:infos_cameras&outfile=Camera&srsname=EPSG:4326&outputformat=geojson";

export const USGS_TERMS_URL = "https://api.waterdata.usgs.gov/docs/nims/";
export const QUEBEC_TERMS_URL = "https://www.donneesquebec.ca/recherche/dataset/camera-de-circulation";
export const QUEBEC_PLATFORM_TERMS_URL = "https://www.quebec511.info/en/basdepage/Utilisation.aspx";

const USGS_IMAGE_HOST = "https://usgs-nims-images.s3.amazonaws.com/";
const QUEBEC_HOSTS = new Set(["www.quebec511.info", "quebec511.info"]);

export type CameraSourceId = "usgs-hivis" | "quebec-511";

export type PublicCamera = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  km: number;
  source: CameraSourceId;
  attribution: string;
  termsUrl: string;
  pageUrl: string;
  /** Present only when the source license allows a still in this app. */
  imageUrl: string | null;
  observedAt: string | null;
};

export type CameraCatalog = {
  usgs: PublicCamera[];
  quebec: PublicCamera[];
};

type UsgsRow = {
  camId?: unknown;
  camName?: unknown;
  lat?: unknown;
  lng?: unknown;
  smallDir?: unknown;
  newestImageDT?: unknown;
  hideCam?: unknown;
  stateAbrv?: unknown;
};

type QuebecFeature = {
  geometry?: { type?: string; coordinates?: unknown };
  properties?: Record<string, unknown>;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function coord(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number : null;
}

function hidden(value: unknown): boolean {
  return value === true || value === 1 || value === "true" || value === "1";
}

export function usgsImageUrl(camId: string, smallDir: string): string | null {
  if (!/^[A-Za-z0-9_-]+$/.test(camId)) return null;
  if (!smallDir.startsWith(USGS_IMAGE_HOST)) return null;
  const base = smallDir.endsWith("/") ? smallDir : `${smallDir}/`;
  const url = `${base}${camId}_newest.jpg`;
  return url.startsWith(USGS_IMAGE_HOST) ? url : null;
}

export function parseUsgsCameras(payload: unknown): PublicCamera[] {
  const rows = Array.isArray(payload) ? payload : [];
  const cameras: PublicCamera[] = [];
  for (const row of rows as UsgsRow[]) {
    if (hidden(row.hideCam)) continue;
    const camId = text(row.camId);
    const lat = coord(row.lat);
    const lon = coord(row.lng);
    if (!camId || lat == null || lon == null || !isFiniteCoord(lat, lon)) continue;
    const name = text(row.camName) || camId.replaceAll("_", " ");
    const state = text(row.stateAbrv);
    cameras.push({
      id: `usgs-${camId}`,
      name: state ? `${name}, ${state}` : name,
      lat,
      lon,
      km: 0,
      source: "usgs-hivis",
      attribution: "U.S. Geological Survey HIVIS. US government work, public domain.",
      termsUrl: USGS_TERMS_URL,
      pageUrl: `https://apps.usgs.gov/hivis/camera/${encodeURIComponent(camId)}`,
      imageUrl: usgsImageUrl(camId, text(row.smallDir)),
      observedAt: text(row.newestImageDT) || null,
    });
  }
  return cameras;
}

function quebecViewerUrl(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || !QUEBEC_HOSTS.has(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function parseQuebecCameras(payload: unknown): PublicCamera[] {
  const features = (payload as { features?: unknown })?.features;
  if (!Array.isArray(features)) return [];
  const cameras: PublicCamera[] = [];
  for (const feature of features as QuebecFeature[]) {
    const coordinates = feature.geometry?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) continue;
    const lon = coord(coordinates[0]);
    const lat = coord(coordinates[1]);
    if (lat == null || lon == null || !isFiniteCoord(lat, lon)) continue;
    const props = feature.properties ?? {};
    const cameraId = text(props.IDEcamera);
    const pageUrl = quebecViewerUrl(props.URL_FLUX_DONNEE);
    if (!cameraId || !pageUrl) continue;
    const name =
      text(props.DescriptionLocalisationEn) ||
      text(props.DescriptionLocalisationFr) ||
      `Québec 511 camera ${cameraId}`;
    cameras.push({
      id: `qc-${cameraId}`,
      name,
      lat,
      lon,
      km: 0,
      source: "quebec-511",
      attribution:
        "Ministère des Transports et de la Mobilité durable. Camera locations and viewer links: Données Québec, CC BY 4.0.",
      termsUrl: QUEBEC_TERMS_URL,
      pageUrl,
      imageUrl: null,
      observedAt: null,
    });
  }
  return cameras;
}

export function nearestCameras(
  catalog: CameraCatalog,
  origin: { lat: number; lon: number },
  radiusKm = CAMERA_RADIUS_KM,
  limit = CAMERA_LIMIT,
): PublicCamera[] {
  if (!isFiniteCoord(origin.lat, origin.lon)) return [];
  return [...catalog.usgs, ...catalog.quebec]
    .map((camera) => ({ ...camera, km: round(haversineKm(origin, camera), 1) }))
    .filter((camera) => camera.km <= radiusKm)
    .sort((a, b) => a.km - b.km || a.name.localeCompare(b.name))
    .slice(0, limit);
}
