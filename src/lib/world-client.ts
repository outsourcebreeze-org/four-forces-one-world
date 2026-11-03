import type { WorldState } from "./types";

/** Stop waiting on a cold ingest. The server budget is 10s; this is a little longer. */
export const FEED_CLIENT_TIMEOUT_MS = 12_000;

async function readWorld(fetchImpl: typeof fetch, url: string, timeoutMs: number): Promise<WorldState> {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`Events request failed (${response.status})`);
  return (await response.json()) as WorldState;
}

/**
 * Live feeds first. If that request fails or times out, the recorded snapshot
 * still gives the globe something to draw.
 */
export async function fetchWorld(options: {
  refresh?: boolean;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
} = {}): Promise<WorldState> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? FEED_CLIENT_TIMEOUT_MS;
  const liveUrl = options.refresh ? "/api/events?refresh=1" : "/api/events";
  try {
    return await readWorld(fetchImpl, liveUrl, timeoutMs);
  } catch {
    return readWorld(fetchImpl, "/api/events?snapshot=1", timeoutMs);
  }
}
