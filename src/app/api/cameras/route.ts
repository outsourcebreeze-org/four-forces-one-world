import { CAMERA_RADIUS_KM } from "@/lib/cameras";
import { camerasNear } from "@/lib/camera-catalog";
import { isFiniteCoord } from "@/lib/geo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  if (!isFiniteCoord(lat, lon)) {
    return Response.json({ error: "lat and lon are required." }, { status: 400 });
  }
  const requested = Number(searchParams.get("radiusKm"));
  const radiusKm =
    Number.isFinite(requested) && requested > 0 && requested <= CAMERA_RADIUS_KM
      ? requested
      : CAMERA_RADIUS_KM;
  const result = await camerasNear({ lat, lon }, radiusKm);
  return Response.json(result);
}
