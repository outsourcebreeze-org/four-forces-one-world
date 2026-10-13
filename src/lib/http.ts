import { USER_AGENT } from "./constants";

export class FeedError extends Error {
  status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "FeedError";
    this.status = status;
  }
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 15000, headers, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...rest,
      signal: controller.signal,
      cache: "no-store",
      headers: {
        Accept: "application/json, application/geo+json, text/plain, */*",
        "User-Agent": USER_AGENT,
        ...headers,
      },
    });
    if (!response.ok) {
      throw new FeedError(`${response.status} ${response.statusText}`, response.status);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof FeedError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new FeedError(`Timed out after ${timeoutMs}ms`);
    }
    throw new FeedError(error instanceof Error ? error.message : "Request failed");
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchText(
  url: string,
  init: RequestInit & { timeoutMs?: number; maxBytes?: number } = {},
): Promise<string> {
  const { timeoutMs = 20000, maxBytes = 4_000_000, headers, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...rest,
      signal: controller.signal,
      cache: "no-store",
      headers: { "User-Agent": USER_AGENT, ...headers },
    });
    if (!response.ok) {
      throw new FeedError(`${response.status} ${response.statusText}`, response.status);
    }
    const reader = response.body?.getReader();
    if (!reader) return response.text();
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      received += value.byteLength;
      chunks.push(value);
      if (received >= maxBytes) {
        await reader.cancel();
        break;
      }
    }
    const merged = new Uint8Array(Math.min(received, maxBytes));
    let offset = 0;
    for (const chunk of chunks) {
      const slice = chunk.subarray(0, merged.length - offset);
      merged.set(slice, offset);
      offset += slice.length;
      if (offset >= merged.length) break;
    }
    return new TextDecoder().decode(merged);
  } catch (error) {
    if (error instanceof FeedError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new FeedError(`Timed out after ${timeoutMs}ms`);
    }
    throw new FeedError(error instanceof Error ? error.message : "Request failed");
  } finally {
    clearTimeout(timer);
  }
}

export async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  }
  const workers = Math.min(limit, items.length);
  if (workers > 0) {
    await Promise.all(Array.from({ length: workers }, () => run()));
  }
  return results;
}

export function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

export function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
