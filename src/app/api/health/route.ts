import { tavilyKeyStatus } from "@/lib/env";
import { getWorld } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const world = await getWorld();
  const tavily = tavilyKeyStatus();
  return Response.json({
    generatedAt: world.generatedAt,
    dataMode: world.dataMode,
    notice: world.notice,
    tavilyConfigured: tavily.tavilyConfigured,
    keyLength: tavily.keyLength,
    health: world.health,
    counts: {
      events: world.events.length,
      situations: world.situations.length,
    },
  });
}
