import { getWorld, recordedSnapshot } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("snapshot") === "1") {
    const world = await recordedSnapshot(
      "Live feeds were slow or unavailable. Showing the recorded snapshot.",
    );
    return Response.json(world);
  }
  const refresh = url.searchParams.get("refresh") === "1";
  const world = await getWorld({ refresh });
  return Response.json(world);
}
