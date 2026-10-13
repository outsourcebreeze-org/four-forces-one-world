import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildDemoBrief } from "../src/lib/agent/demo-brief";
import { clusterEvents } from "../src/lib/cluster";
import { ingestLive } from "../src/lib/ingest";

async function main() {
  const live = await ingestLive();
  const situations = clusterEvents(live.events);
  const briefs: Record<string, ReturnType<typeof buildDemoBrief>> = {};
  for (const situation of situations.slice(0, 12)) {
    const events = live.events.filter((event) => situation.eventIds.includes(event.id));
    briefs[situation.id] = buildDemoBrief(situation, events, live.articles);
  }

const dataDir = path.join(process.cwd(), "data");
await mkdir(dataDir, { recursive: true });
await writeFile(
  path.join(dataDir, "demo-snapshot.json"),
  JSON.stringify(
    {
      recordedAt: new Date().toISOString(),
      events: live.events,
      articles: live.articles,
      health: live.health,
    },
    null,
    2,
  ),
);
await writeFile(path.join(dataDir, "demo-briefs.json"), JSON.stringify(briefs, null, 2));
console.log(
  `Recorded ${live.events.length} events, ${situations.length} situations, ${Object.keys(briefs).length} demo briefs.`,
);
for (const row of live.health) {
  console.log(`  ${row.source}: ${row.skipped ? "skipped" : row.ok ? row.count : row.error}`);
}
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
