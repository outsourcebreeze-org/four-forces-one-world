import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { clusterEvents } from "./cluster";
import { ingestLive } from "./ingest";
import { modelSettings } from "./agent/nemotron";
import type { HazardEvent, KeyPresence, NewsArticle, SourceHealth, WorldState } from "./types";

const TTL_MS = 8 * 60 * 1000;
const snapshotPath = path.join(process.cwd(), "data", "demo-snapshot.json");

function cacheCandidates(): string[] {
  const local = path.join(process.cwd(), ".cache", "world.json");
  const temp = path.join(os.tmpdir(), "four-forces-world.json");
  // Vercel functions can write /tmp. The project directory is read-only.
  return process.env.VERCEL ? [temp, local] : [local, temp];
}

type DiskCache = { at: number; payload: WorldState };

let memory: DiskCache | null = null;
let inflight: Promise<WorldState> | null = null;

export function keyPresence(): KeyPresence {
  return {
    nebius: Boolean(process.env.NEBIUS_API_KEY?.trim()),
    tavily: Boolean(process.env.TAVILY_API_KEY?.trim()),
    firms: Boolean(process.env.FIRMS_MAP_KEY?.trim()),
    openaq: Boolean(process.env.OPENAQ_API_KEY?.trim()),
  };
}

export function snapshotRequested(): boolean {
  const value = process.env.DEMO_MODE?.trim().toLowerCase();
  return value === "snapshot" || value === "1" || value === "true";
}

export function assembleWorld(input: {
  events: HazardEvent[];
  articles: NewsArticle[];
  health: SourceHealth[];
  dataMode: WorldState["dataMode"];
  notice: string | null;
  generatedAt?: string;
}): WorldState {
  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    dataMode: input.dataMode,
    notice: input.notice,
    events: input.events,
    situations: clusterEvents(input.events),
    articles: input.articles,
    health: input.health,
    keys: keyPresence(),
  };
}

async function readSnapshot(): Promise<WorldState> {
  try {
    const raw = await readFile(snapshotPath, "utf8");
    const parsed = JSON.parse(raw) as {
      recordedAt?: string;
      events?: HazardEvent[];
      articles?: NewsArticle[];
      health?: SourceHealth[];
    };
    const events = parsed.events ?? [];
    return assembleWorld({
      events,
      articles: parsed.articles ?? [],
      health: parsed.health ?? [],
      dataMode: "demo-snapshot",
      notice: `Showing the recorded snapshot from ${parsed.recordedAt ?? "the repository"}. Live feeds were not used.`,
      generatedAt: parsed.recordedAt,
    });
  } catch {
    return assembleWorld({
      events: [],
      articles: [],
      health: [],
      dataMode: "demo-snapshot",
      notice: "Demo snapshot is missing and live feeds were not used.",
    });
  }
}

async function readDisk(): Promise<DiskCache | null> {
  for (const cachePath of cacheCandidates()) {
    try {
      const raw = await readFile(cachePath, "utf8");
      const parsed = JSON.parse(raw) as DiskCache;
      if (!parsed?.payload || typeof parsed.at !== "number") continue;
      return parsed;
    } catch {
      // Try the next location.
    }
  }
  return null;
}

async function writeDisk(entry: DiskCache): Promise<void> {
  const body = JSON.stringify(entry);
  let lastError: unknown;
  for (const cachePath of cacheCandidates()) {
    try {
      await mkdir(path.dirname(cachePath), { recursive: true });
      await writeFile(cachePath, body);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Could not write the world cache");
}

export async function getWorld(options: { refresh?: boolean } = {}): Promise<WorldState> {
  if (snapshotRequested()) return readSnapshot();
  if (!options.refresh && memory && Date.now() - memory.at < TTL_MS) {
    return { ...memory.payload, keys: keyPresence() };
  }
  if (!options.refresh && !memory) {
    const disk = await readDisk();
    if (disk && Date.now() - disk.at < TTL_MS) {
      memory = disk;
      return { ...disk.payload, keys: keyPresence() };
    }
  }
  if (inflight && !options.refresh) return inflight;

  inflight = (async () => {
    try {
      const live = await ingestLive();
      if (live.events.length === 0) {
        const snapshot = await readSnapshot();
        snapshot.notice =
          "Live feeds returned no events. Showing the recorded snapshot, labeled as demo data.";
        return snapshot;
      }
      const failed = live.health.filter((row) => !row.ok).map((row) => row.source);
      const world = assembleWorld({
        ...live,
        dataMode: "live",
        notice: failed.length ? `Some feeds did not respond: ${failed.join(", ")}.` : null,
      });
      memory = { at: Date.now(), payload: world };
      try {
        await writeDisk(memory);
      } catch {
        // A read-only filesystem must not throw away a successful live ingest.
      }
      return world;
    } catch {
      const snapshot = await readSnapshot();
      snapshot.notice = "Live ingest failed. Showing the recorded snapshot, labeled as demo data.";
      return snapshot;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function agentStatus() {
  const settings = modelSettings();
  return {
    baseURL: settings.baseURL,
    keyPresent: Boolean(settings.apiKey),
    models: {
      triage: settings.triage,
      brief: settings.brief,
      analyst: settings.analyst,
    },
    tavily: Boolean(process.env.TAVILY_API_KEY?.trim()),
    demoBriefs: !settings.apiKey,
  };
}
