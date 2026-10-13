const NUMBER = /\d+(?:\.\d+)?/g;

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

export function unsupportedNumbers(text: string, allowedBlob: string): string[] {
  const stripped = text.replace(POLLUTANT_LABEL, " ");
  const allowed = new Set(numberTokens(allowedBlob));
  return numberTokens(stripped).filter((token) => !allowed.has(token));
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
