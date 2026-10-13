import { SEVERITY_LABEL } from "../severity";
import type { HazardEvent, NewsArticle, Situation, SituationBrief } from "../types";
import { limitWords, sharesStory } from "./text";

const DEMO_LABEL =
  "Demo brief. This wording is a template, not a Nemotron response. Add NEBIUS_API_KEY for a model-written brief.";

function detailSentence(event: HazardEvent): string {
  const pairs = Object.entries(event.details)
    .filter(([, value]) => value !== null && value !== "")
    .slice(0, 3)
    .map(([key, value]) => `${key} ${value}`);
  if (pairs.length === 0) return "The stored source fields do not include a numeric measure.";
  return `Source fields: ${pairs.join("; ")}.`;
}

function evidenceFromEvents(events: HazardEvent[]): SituationBrief["evidence"] {
  const seen = new Set<string>();
  const evidence: SituationBrief["evidence"] = [];
  for (const event of events) {
    if (seen.has(event.url)) continue;
    seen.add(event.url);
    evidence.push({
      title: event.title,
      url: event.url,
      source: event.source,
      stance: "unconfirmed",
      note: "Official or primary source record for this situation.",
    });
    if (evidence.length >= 4) break;
  }
  return evidence;
}

function matchedNews(situation: Situation, articles: NewsArticle[]): SituationBrief["evidence"] {
  return articles
    .filter((article) => sharesStory(situation.title, article.title))
    .slice(0, 3)
    .map((article) => ({
      title: article.title,
      url: article.url,
      source: article.source,
      stance: "unconfirmed" as const,
      note: "Matched from the cached GDELT query. Not a dedicated search.",
    }));
}

export function buildDemoBrief(
  situation: Situation,
  events: HazardEvent[],
  articles: NewsArticle[] = [],
): SituationBrief {
  const lead = events[0];
  const when = lead?.time.slice(0, 16).replace("T", " ") ?? situation.time.slice(0, 16);
  const grouped =
    events.length > 1
      ? `${events.length} public reports are grouped here, from ${situation.sources.join(", ")}.`
      : `The record is from ${situation.sources.join(", ") || "a public feed"}.`;
  const kind = (situation.types[0] ?? situation.force).toLowerCase();
  const summary = limitWords(
    `${SEVERITY_LABEL[situation.severity]} ${kind} reported by ${lead?.source ?? "a public feed"}: ${situation.title}. Time ${when} UTC. ${lead ? detailSentence(lead) : ""} ${grouped} This demo brief only restates those fields.`,
    80,
  );
  return {
    headline: situation.title.slice(0, 160),
    summary,
    affectedArea: situation.place,
    populationEstimate: null,
    confidence: {
      level: situation.sources.length >= 2 ? "medium" : "low",
      score: situation.sources.length >= 3 ? 64 : situation.sources.length === 2 ? 52 : 36,
    },
    evidence: [...evidenceFromEvents(events), ...matchedNews(situation, articles)].slice(0, 6),
    contradictions: [],
    whatChanged: "No earlier brief is stored, so there is no change to compare.",
    guidanceLinks: evidenceFromEvents(events).map((item) => ({
      title: item.source,
      url: item.url,
    })),
    demo: true,
    demoLabel: DEMO_LABEL,
  };
}

export function buildDemoRegionalBrief(
  situation: Situation,
  events: HazardEvent[],
  neighbors: Array<{ situation: Situation; events: HazardEvent[] }>,
): SituationBrief {
  const lines = neighbors.slice(0, 2).map((neighbor) => {
    const km = situation.nearby.find((item) => item.id === neighbor.situation.id)?.km;
    if (km == null) {
      return `Also nearby, a ${neighbor.situation.force} report: ${neighbor.situation.title}.`;
    }
    return `Within ${km} km, a ${neighbor.situation.force} report: ${neighbor.situation.title}.`;
  });
  const summary = limitWords(
    `${situation.force} situation: ${situation.title}. ${lines.join(" ")} These notes only restate the public records. No combined impact figure is available from the sources.`,
    80,
  );
  const allEvents = [events, ...neighbors.map((neighbor) => neighbor.events)].flat();
  return {
    ...buildDemoBrief(situation, allEvents.length ? allEvents : events),
    headline: `Nearby hazards around ${situation.title}`.slice(0, 160),
    summary,
    demoLabel:
      "Demo regional note. This wording is a template, not a Nemotron Ultra response.",
  };
}
