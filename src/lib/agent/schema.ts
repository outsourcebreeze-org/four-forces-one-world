import { z } from "zod";

const LEVELS: Record<string, "low" | "medium" | "high"> = {
  low: "low",
  medium: "medium",
  high: "high",
  moderate: "medium",
  med: "medium",
  severe: "high",
  urgent: "high",
  extreme: "high",
  critical: "high",
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Models often emit a 0–1 score, a synonym for level, or strings where objects were requested. */
export function normalizeBriefDraft(value: unknown): unknown {
  const draft = asObject(value);
  if (!draft) return value;
  const next: Record<string, unknown> = { ...draft };
  if (next.affectedArea === undefined || next.affectedArea === "") next.affectedArea = null;
  if (next.populationEstimate === undefined || next.populationEstimate === "") next.populationEstimate = null;
  if (typeof next.whatChanged !== "string") next.whatChanged = "";

  const confidence = asObject(next.confidence);
  if (confidence) {
    let score = confidence.score;
    if (typeof score === "string") score = Number(score.replace(/%$/, ""));
    if (typeof score === "number" && Number.isFinite(score) && score > 0 && score <= 1) score = Math.round(score * 100);
    const levelRaw = typeof confidence.level === "string" ? confidence.level.toLowerCase() : "";
    next.confidence = {
      level: LEVELS[levelRaw] ?? "medium",
      score: typeof score === "number" && Number.isFinite(score) ? score : 40,
    };
  }

  if (Array.isArray(next.evidence)) {
    next.evidence = next.evidence
      .map((item) => {
        if (typeof item === "string") {
          const url = item.match(/https?:\/\/\S+/)?.[0] ?? "";
          if (!url) return null;
          return { title: item, url, source: "news", stance: "unconfirmed", note: "" };
        }
        const row = asObject(item);
        if (!row) return null;
        const stance = typeof row.stance === "string" ? row.stance.toLowerCase() : "unconfirmed";
        return {
          title: typeof row.title === "string" ? row.title : String(row.source ?? "Source"),
          url: typeof row.url === "string" ? row.url : "",
          source: typeof row.source === "string" ? row.source : "source",
          stance: stance === "agree" || stance === "disagree" ? stance : "unconfirmed",
          note: typeof row.note === "string" ? row.note : "",
        };
      })
      .filter(Boolean);
  } else {
    next.evidence = [];
  }

  if (!Array.isArray(next.contradictions)) next.contradictions = [];
  next.contradictions = (next.contradictions as unknown[]).filter((item) => typeof item === "string");

  if (Array.isArray(next.guidanceLinks)) {
    next.guidanceLinks = next.guidanceLinks
      .map((item) => {
        if (typeof item === "string") {
          return /^https?:\/\//.test(item) ? { title: "Official source", url: item } : null;
        }
        const row = asObject(item);
        if (!row || typeof row.url !== "string") return null;
        return { title: typeof row.title === "string" ? row.title : "Official source", url: row.url };
      })
      .filter(Boolean);
  } else {
    next.guidanceLinks = [];
  }
  return next;
}

export const briefDraftSchema = z.object({
  headline: z.string().min(3).max(180),
  summary: z.string().min(1),
  affectedArea: z.string().nullable(),
  populationEstimate: z.string().nullable(),
  confidence: z.object({
    level: z.enum(["low", "medium", "high"]),
    score: z.number().min(0).max(100),
  }),
  evidence: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      source: z.string(),
      stance: z.enum(["agree", "disagree", "unconfirmed"]),
      note: z.string(),
    }),
  ),
  contradictions: z.array(z.string()),
  whatChanged: z.string(),
  guidanceLinks: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
    }),
  ),
});

export type BriefDraft = z.infer<typeof briefDraftSchema>;
