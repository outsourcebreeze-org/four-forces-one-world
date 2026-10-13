import type { SituationBrief } from "../types";
import { stanceForText } from "./text";

export type Corroboration = {
  title: string;
  url: string;
  source: string;
  text: string;
  origin: "tavily" | "gdelt";
};

export function confidenceLevel(score: number): SituationBrief["confidence"]["level"] {
  if (score < 45) return "low";
  if (score < 70) return "medium";
  return "high";
}

export function retuneConfidence(
  score: number,
  input: { tavilyResults: number; disagreements: number; gdeltMatches: number; tavilyRan: boolean },
): SituationBrief["confidence"] {
  let next = score;
  if (input.disagreements > 0) next -= 20;
  if (input.tavilyResults >= 2) next += 12;
  else if (input.tavilyResults === 1) next += 6;
  else if (input.tavilyRan) next -= 8;
  if (input.gdeltMatches > 0) next += 4;
  if (!input.tavilyRan || input.tavilyResults === 0) next = Math.min(next, 64);
  next = Math.max(10, Math.min(92, Math.round(next)));
  return { score: next, level: confidenceLevel(next) };
}

export function applyCorroboration(
  brief: SituationBrief,
  items: Corroboration[],
  tavilyRan: boolean,
): { brief: SituationBrief; gdeltMatches: number; verifiedWithTavily: boolean } {
  const seen = new Set(brief.evidence.map((item) => item.url));
  const evidence = [...brief.evidence];
  let disagreements = 0;
  let tavilyResults = 0;
  let gdeltMatches = 0;
  for (const item of items) {
    if (!/^https?:\/\//.test(item.url) || seen.has(item.url)) continue;
    seen.add(item.url);
    const stance = stanceForText(`${item.title} ${item.text}`);
    if (item.origin === "tavily") {
      tavilyResults += 1;
      if (stance === "disagree") disagreements += 1;
    } else {
      gdeltMatches += 1;
    }
    evidence.push({
      title: item.title,
      url: item.url,
      source: item.source,
      stance,
      note:
        item.origin === "tavily"
          ? "Tavily news search."
          : "Matched from the cached GDELT query.",
    });
  }
  const contradictions = [...brief.contradictions];
  if (disagreements > 0) {
    contradictions.push("At least one news result uses language that disputes or does not confirm the report.");
  }
  return {
    brief: {
      ...brief,
      evidence: evidence.slice(0, 8),
      contradictions,
      confidence: retuneConfidence(brief.confidence.score, {
        tavilyResults,
        disagreements,
        gdeltMatches,
        tavilyRan,
      }),
    },
    gdeltMatches,
    verifiedWithTavily: tavilyRan,
  };
}
