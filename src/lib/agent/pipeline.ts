import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  BriefResponse,
  HazardEvent,
  NewsArticle,
  Situation,
  SituationBrief,
} from "../types";
import { applyCorroboration, type Corroboration } from "./confidence";
import { buildDemoBrief, buildDemoRegionalBrief } from "./demo-brief";
import { completeJson, modelSettings } from "./nemotron";
import { briefDraftSchema, normalizeBriefDraft } from "./schema";
import { limitWords, parseJsonLoose, sharesStory, unsupportedNumbers, wordCount } from "./text";

const SYSTEM = `You write civil public-safety situation briefs for emergency managers.
Use only the JSON payload. Never invent numbers, population, casualties, or places.
If a figure is not in the payload, omit it. populationEstimate must be null unless a source field states it.
summary must be at most 80 words. Respond with JSON only, no markdown.
Cite only URLs that appear in the payload.
Tone: calm, plain language, no speculation.`;

type Draft = {
  headline: string;
  summary: string;
  affectedArea: string | null;
  populationEstimate: string | null;
  confidence: { level: "low" | "medium" | "high"; score: number };
  evidence: SituationBrief["evidence"];
  contradictions: string[];
  whatChanged: string;
  guidanceLinks: SituationBrief["guidanceLinks"];
};

function allowedBlob(payload: unknown): string {
  return JSON.stringify(payload);
}

function allowsPopulation(events: HazardEvent[]): boolean {
  return events.some((event) =>
    Object.keys(event.details).some((key) => /population|people|fatal|exposed|injured/i.test(key)),
  );
}

function scrubUnsupportedNumbers(draft: Draft, payload: unknown): Draft {
  const blob = allowedBlob(payload);
  const drop = (text: string) =>
    text
      .split(/(?<=[.!?])\s+/)
      .filter((sentence) => unsupportedNumbers(sentence, blob).length === 0)
      .join(" ")
      .trim();
  return { ...draft, headline: drop(draft.headline), summary: drop(draft.summary) };
}

function groundingProblems(draft: Draft, payload: unknown, events: HazardEvent[]): string[] {
  const blob = allowedBlob(payload);
  const problems: string[] = [];
  const numbers = unsupportedNumbers(`${draft.headline} ${draft.summary}`, blob);
  if (numbers.length) problems.push(`Unsupported numbers: ${numbers.join(", ")}`);
  for (const word of ["million", "deaths", "fatalities", "killed", "injured"]) {
    if (draft.summary.toLowerCase().includes(word) && !blob.toLowerCase().includes(word)) {
      problems.push(`The word "${word}" is not in the source payload.`);
    }
  }
  if (wordCount(draft.summary) > 80) problems.push("Summary is over 80 words.");
  if (!allowsPopulation(events) && draft.populationEstimate) {
    problems.push("populationEstimate must be null.");
  }
  return problems;
}

function officialUrls(events: HazardEvent[]): Set<string> {
  return new Set(events.map((event) => event.url).filter((url) => /^https?:\/\//.test(url)));
}

function cleanDraft(draft: Draft, events: HazardEvent[], extraUrls: string[]): SituationBrief {
  const allowed = new Set([...officialUrls(events), ...extraUrls]);
  const evidence = draft.evidence.filter(
    (item) =>
      item &&
      typeof item.url === "string" &&
      allowed.has(item.url) &&
      (item.stance === "agree" || item.stance === "disagree" || item.stance === "unconfirmed"),
  );
  if (evidence.length === 0 && events[0]) {
    evidence.push({
      title: events[0].title,
      url: events[0].url,
      source: events[0].source,
      stance: "unconfirmed",
      note: "Primary source record.",
    });
  }
  const guidance = draft.guidanceLinks.filter(
    (link) => link && typeof link.url === "string" && officialUrls(events).has(link.url),
  );
  return {
    headline: draft.headline.slice(0, 180),
    summary: limitWords(draft.summary, 80),
    affectedArea: draft.affectedArea,
    populationEstimate: allowsPopulation(events) ? draft.populationEstimate : null,
    confidence: {
      level: draft.confidence.level,
      score: Math.max(0, Math.min(100, Math.round(draft.confidence.score))),
    },
    evidence: evidence.slice(0, 8).map((item) => ({
      title: String(item.title || item.source || "Source"),
      url: item.url,
      source: String(item.source || "source"),
      stance: item.stance,
      note: String(item.note || ""),
    })),
    contradictions: draft.contradictions.filter((item) => typeof item === "string").slice(0, 4),
    whatChanged: draft.whatChanged,
    guidanceLinks: guidance.slice(0, 4).map((link) => ({
      title: String(link.title || "Official source"),
      url: link.url,
    })),
    demo: false,
    demoLabel: null,
  };
}

async function searchTavily(query: string): Promise<Corroboration[]> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) return [];
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      topic: "news",
      search_depth: "basic",
      max_results: 5,
      include_answer: false,
    }),
  });
  if (!response.ok) {
    throw new Error(`Tavily ${response.status}`);
  }
  const payload = (await response.json()) as { results?: Array<Record<string, unknown>> };
  return (payload.results ?? [])
    .map((item) => {
      const url = typeof item.url === "string" ? item.url : "";
      const title = typeof item.title === "string" ? item.title : url;
      const text = typeof item.content === "string" ? item.content : "";
      if (!/^https?:\/\//.test(url)) return null;
      let source = "news";
      try {
        source = new URL(url).hostname.replace(/^www\./, "");
      } catch {
        source = "news";
      }
      const row: Corroboration = { title, url, source, text, origin: "tavily" };
      return row;
    })
    .filter((item): item is Corroboration => item !== null);
}

function gdeltMatches(title: string, articles: NewsArticle[]): Corroboration[] {
  return articles
    .filter((article) => sharesStory(title, article.title))
    .slice(0, 3)
    .map((article) => ({
      title: article.title,
      url: article.url,
      source: article.source,
      text: article.title,
      origin: "gdelt" as const,
    }));
}

async function draftWithModel(
  role: "brief" | "analyst",
  payload: unknown,
  events: HazardEvent[],
): Promise<{ brief: SituationBrief; model: string; emptyContentFallback: boolean }> {
  const instruction =
    role === "analyst"
      ? "Write a regional note covering every force in the payload. Do not invent how the hazards interact."
      : "Write one situation brief. Set confidence.score from 0 to 100 using only how well the payload sources agree.";
  let problems: string[] = [];
  let lastModel = modelSettings()[role];
  let fellBack = false;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await completeJson({
      role,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `${instruction}
Return JSON with keys: headline, summary, affectedArea, populationEstimate, confidence {level, score}, evidence [{title, url, source, stance, note}], contradictions, whatChanged, guidanceLinks [{title, url}].
stance is agree, disagree, or unconfirmed.
${problems.length ? `Fix these problems: ${problems.join(" ")}` : ""}
Payload:
${JSON.stringify(payload)}`,
        },
      ],
    });
    lastModel = result.model;
    fellBack = fellBack || result.emptyContentFallback;
    let parsed: unknown;
    try {
      parsed = parseJsonLoose(result.text);
    } catch {
      problems = ["Response was not JSON."];
      continue;
    }
    const checked = briefDraftSchema.safeParse(normalizeBriefDraft(parsed));
    if (!checked.success) {
      problems = checked.error.issues
        .slice(0, 6)
        .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`);
      continue;
    }
    let grounded = checked.data;
    problems = groundingProblems(grounded, payload, events);
    if (problems.length && problems.every((problem) => problem.startsWith("Unsupported numbers:"))) {
      const scrubbed = scrubUnsupportedNumbers(grounded, payload);
      const again = groundingProblems(scrubbed, payload, events);
      if (!again.length && scrubbed.headline.length >= 3 && wordCount(scrubbed.summary) >= 18) {
        grounded = scrubbed;
        problems = [];
      } else if (again.length) {
        problems = again;
      }
    }
    if (problems.length) continue;
    return {
      brief: cleanDraft(grounded, events, []),
      model: lastModel,
      emptyContentFallback: fellBack,
    };
  }
  throw new Error(problems.join(" ") || "Brief failed validation");
}

function fingerprint(events: HazardEvent[]): string {
  return createHash("sha1")
    .update(events.map((event) => `${event.id}:${event.time}:${event.severity}`).join("|"))
    .digest("hex")
    .slice(0, 10);
}

const cache = new Map<string, { at: number; response: BriefResponse }>();
const CACHE_MS = 20 * 60 * 1000;

export async function createBrief(input: {
  situation: Situation;
  events: HazardEvent[];
  articles: NewsArticle[];
  kind: "situation" | "regional";
  neighbors?: Array<{ situation: Situation; events: HazardEvent[] }>;
}): Promise<BriefResponse> {
  const neighbors = input.neighbors ?? [];
  const allEvents = [input.events, ...neighbors.map((neighbor) => neighbor.events)].flat();
  const cacheKey = `${input.kind}:${input.situation.id}:${fingerprint(allEvents)}:${Boolean(process.env.NEBIUS_API_KEY)}:${Boolean(process.env.TAVILY_API_KEY)}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return { ...hit.response, pipeline: { ...hit.response.pipeline, cached: true } };
  }

  const settings = modelSettings();
  let brief: SituationBrief;
  const models: string[] = [];
  let mode: BriefResponse["pipeline"]["mode"] = "demo";
  let emptyContentFallback = false;

  const cachedExample =
    !settings.apiKey && input.kind === "situation" ? await loadCachedBrief(input.situation.id) : null;
  if (cachedExample) {
    brief = cachedExample;
  } else if (!settings.apiKey) {
    brief =
      input.kind === "regional"
        ? buildDemoRegionalBrief(input.situation, input.events, neighbors)
        : buildDemoBrief(input.situation, input.events, input.articles);
  } else {
    try {
      if (input.kind === "situation") {
        const triage = await completeJson({
          role: "triage",
          messages: [
            {
              role: "system",
              content:
                "You triage a civil hazard. Reply with JSON only: {\"force\",\"severity\",\"priority\",\"reason\"}. priority is watch, elevated, or urgent. Do not invent measurements.",
            },
            {
              role: "user",
              content: JSON.stringify({
                situation: input.situation,
                events: input.events.map(publicEvent),
              }),
            },
          ],
        });
        models.push(triage.model);
        emptyContentFallback = triage.emptyContentFallback;
      }
      const drafted = await draftWithModel(
        input.kind === "regional" ? "analyst" : "brief",
        {
          situation: input.situation,
          events: allEvents.map(publicEvent),
          nearby: input.situation.nearby,
        },
        allEvents,
      );
      brief = drafted.brief;
      models.push(drafted.model);
      emptyContentFallback = emptyContentFallback || drafted.emptyContentFallback;
      mode = "live";
    } catch (error) {
      brief =
        input.kind === "regional"
          ? buildDemoRegionalBrief(input.situation, input.events, neighbors)
          : buildDemoBrief(input.situation, input.events, input.articles);
      brief.demoLabel = `Demo brief. The Nemotron call did not return a usable brief (${error instanceof Error ? error.message.slice(0, 160) : "request failed"}).`;
      mode = "demo-fallback";
    }
  }

  let tavilyRan = false;
  let tavilyItems: Corroboration[] = [];
  if (process.env.TAVILY_API_KEY?.trim()) {
    try {
      tavilyItems = await searchTavily(input.situation.title);
      tavilyRan = true;
    } catch {
      tavilyRan = false;
    }
  }
  const news = [...tavilyItems, ...gdeltMatches(input.situation.title, input.articles)];
  const tuned = applyCorroboration(brief, news, tavilyRan);
  const response: BriefResponse = {
    situationId: input.situation.id,
    kind: input.kind,
    brief: tuned.brief,
    pipeline: {
      mode,
      cached: false,
      models,
      verifiedWithTavily: tuned.verifiedWithTavily,
      gdeltMatches: tuned.gdeltMatches,
      emptyContentFallback,
    },
  };
  cache.set(cacheKey, { at: Date.now(), response });
  return response;
}

let cachedBriefs: Record<string, SituationBrief> | null = null;

async function loadCachedBrief(id: string): Promise<SituationBrief | null> {
  if (!cachedBriefs) {
    try {
      const raw = await readFile(path.join(process.cwd(), "data", "demo-briefs.json"), "utf8");
      cachedBriefs = JSON.parse(raw) as Record<string, SituationBrief>;
    } catch {
      cachedBriefs = {};
    }
  }
  const found = cachedBriefs[id];
  if (!found) return null;
  return {
    ...found,
    demo: true,
    demoLabel: found.demoLabel ?? "Cached example brief, labeled demo.",
  };
}

function publicEvent(event: HazardEvent) {
  return {
    id: event.id,
    force: event.force,
    type: event.type,
    title: event.title,
    lat: event.lat,
    lon: event.lon,
    time: event.time,
    severity: event.severity,
    source: event.source,
    url: event.url,
    details: event.details,
  };
}

export function clearBriefCache(): void {
  cache.clear();
}
