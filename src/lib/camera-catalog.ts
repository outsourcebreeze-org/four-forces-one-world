import { fetchJson } from "./http";
import {
  CAMERA_RADIUS_KM,
  type CameraCatalog,
  type PublicCamera,
  QUEBEC_CAMERAS_URL,
  USGS_CAMERAS_URL,
  nearestCameras,
  parseQuebecCameras,
  parseUsgsCameras,
} from "./cameras";

const CACHE_MS = 15 * 60 * 1000;

type Slot<T> = { at: number; rows: T[] };

let usgsSlot: Slot<PublicCamera> | null = null;
let quebecSlot: Slot<PublicCamera> | null = null;
let usgsInflight: Promise<PublicCamera[]> | null = null;
let quebecInflight: Promise<PublicCamera[]> | null = null;

async function loadSource<T>(
  current: Slot<T> | null,
  inflight: Promise<T[]> | null,
  setInflight: (promise: Promise<T[]> | null) => void,
  setSlot: (slot: Slot<T>) => void,
  fetchRows: () => Promise<T[]>,
): Promise<{ rows: T[]; failed: boolean }> {
  if (current && Date.now() - current.at < CACHE_MS) return { rows: current.rows, failed: false };
  if (!inflight) {
    inflight = fetchRows()
      .then((rows) => {
        setSlot({ at: Date.now(), rows });
        return rows;
      })
      .finally(() => setInflight(null));
    setInflight(inflight);
  }
  try {
    return { rows: await inflight, failed: false };
  } catch {
    return { rows: current?.rows ?? [], failed: !current };
  }
}

export async function camerasNear(
  origin: { lat: number; lon: number },
  radiusKm = CAMERA_RADIUS_KM,
): Promise<{ radiusKm: number; cameras: PublicCamera[]; notices: string[] }> {
  const [usgs, quebec] = await Promise.all([
    loadSource(
      usgsSlot,
      usgsInflight,
      (promise) => {
        usgsInflight = promise;
      },
      (slot) => {
        usgsSlot = slot;
      },
      async () => parseUsgsCameras(await fetchJson(USGS_CAMERAS_URL, { timeoutMs: 20000 })),
    ),
    loadSource(
      quebecSlot,
      quebecInflight,
      (promise) => {
        quebecInflight = promise;
      },
      (slot) => {
        quebecSlot = slot;
      },
      async () => parseQuebecCameras(await fetchJson(QUEBEC_CAMERAS_URL, { timeoutMs: 20000 })),
    ),
  ]);
  const notices: string[] = [];
  if (usgs.failed) notices.push("USGS river cameras did not respond.");
  if (quebec.failed) notices.push("Québec 511 camera locations did not respond.");
  return {
    radiusKm,
    cameras: nearestCameras({ usgs: usgs.rows, quebec: quebec.rows }, origin, radiusKm),
    notices,
  };
}

export function emptyCatalog(): CameraCatalog {
  return { usgs: [], quebec: [] };
}
