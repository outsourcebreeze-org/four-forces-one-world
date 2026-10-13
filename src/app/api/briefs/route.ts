import { createBrief } from "@/lib/agent/pipeline";
import { getWorld } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: { situationId?: string; kind?: "situation" | "regional" };
  try {
    body = (await request.json()) as { situationId?: string; kind?: "situation" | "regional" };
  } catch {
    return Response.json({ error: "Expected JSON with situationId." }, { status: 400 });
  }
  if (!body.situationId) {
    return Response.json({ error: "situationId is required." }, { status: 400 });
  }
  const world = await getWorld();
  const situation = world.situations.find((item) => item.id === body.situationId);
  if (!situation) {
    return Response.json({ error: "Situation not found. Refresh the globe and try again." }, { status: 404 });
  }
  const events = world.events.filter((event) => situation.eventIds.includes(event.id));
  const kind = body.kind === "regional" ? "regional" : "situation";
  const neighbors =
    kind === "regional"
      ? situation.nearby
          .map((item) => world.situations.find((candidate) => candidate.id === item.id))
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
          .map((item) => ({
            situation: item,
            events: world.events.filter((event) => item.eventIds.includes(event.id)),
          }))
      : [];
  const brief = await createBrief({
    situation,
    events,
    articles: world.articles,
    kind,
    neighbors,
  });
  return Response.json(brief);
}
