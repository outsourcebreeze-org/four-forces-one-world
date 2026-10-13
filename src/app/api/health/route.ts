import { getWorld } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const world = await getWorld();
  return Response.json({
    generatedAt: world.generatedAt,
    dataMode: world.dataMode,
    notice: world.notice,
    health: world.health,
    counts: {
      events: world.events.length,
      situations: world.situations.length,
    },
  });
}
