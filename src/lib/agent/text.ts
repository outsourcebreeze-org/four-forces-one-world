/** Plain numbers, decimals, and thousands groups such as 15,470. */
const NUMBER = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function limitWords(text: string, max: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= max) return words.join(" ");
  return `${words.slice(0, max).join(" ").replace(/[,:;]+$/, "")}…`;
}

export function numberTokens(text: string): string[] {
  return text.match(NUMBER) ?? [];
}

const POLLUTANT_LABEL = /\b(?:pm\s*2\.5|pm2\.5|pm\s*10|pm10|no\s*2|no2|so\s*2|so2|o3|co2)\b/gi;

function canonicalNumber(token: string): number | null {
  const value = Number(token.replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function roundedForms(value: number): number[] {
  return [
    value,
    Math.round(value),
    Math.round(value * 10) / 10,
    Math.round(value * 100) / 100,
    Math.round(value * 1000) / 1000,
  ];
}

/** A cited figure matches a source figure when it is the same value, a comma grouping, or a rounding. */
export function numberIsSupported(cited: number, sources: readonly number[]): boolean {
  for (const source of sources) {
    if (roundedForms(source).some((form) => form === cited)) return true;
    if (roundedForms(cited).some((form) => form === source)) return true;
    const delta = Math.abs(source - cited);
    if (delta <= 0.51) return true;
    const scale = Math.max(Math.abs(source), 1);
    if (delta / scale <= 0.01) return true;
  }
  return false;
}

export function unsupportedNumbers(text: string, allowedBlob: string): string[] {
  const stripped = text.replace(POLLUTANT_LABEL, " ");
  const sources = numberTokens(allowedBlob)
    .map(canonicalNumber)
    .filter((value): value is number => value != null);
  const bad: string[] = [];
  for (const token of numberTokens(stripped)) {
    const cited = canonicalNumber(token);
    if (cited == null || !numberIsSupported(cited, sources)) bad.push(token);
  }
  return bad;
}

export function parseJsonLoose(text: string): unknown {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) cleaned = fenced[1].trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) cleaned = cleaned.slice(start, end + 1);
  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(cleaned);
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const STOP = new Set([
  "alert",
  "warning",
  "watch",
  "issued",
  "until",
  "from",
  "with",
  "that",
  "this",
  "near",
  "area",
  "severe",
  "flood",
  "storm",
  "public",
  "report",
  "reports",
]);

export function distinctiveTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 4 && !STOP.has(word));
}

export function sharesStory(a: string, b: string): boolean {
  const left = new Set(distinctiveTokens(a));
  if (left.size === 0) return false;
  let hits = 0;
  for (const token of distinctiveTokens(b)) {
    if (left.has(token)) hits += 1;
  }
  return hits >= 2 || [...left].some((token) => token.length > 6 && distinctiveTokens(b).includes(token));
}

const CONTRADICTION = /false alarm|hoax|did not happen|never happened|unfounded|incorrectly reported|not confirmed/i;

export function stanceForText(text: string): "agree" | "disagree" | "unconfirmed" {
  if (CONTRADICTION.test(text)) return "disagree";
  return "unconfirmed";
}
