import { getWorld } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const refresh = new URL(request.url).searchParams.get("refresh") === "1";
  const world = await getWorld({ refresh });
  return Response.json({
    generatedAt: world.generatedAt,
    dataMode: world.dataMode,
    situations: world.situations,
  });
}
