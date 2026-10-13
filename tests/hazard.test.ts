import { describe, expect, it } from "vitest";
import { applyCorroboration, retuneConfidence } from "../src/lib/agent/confidence";
import { buildDemoBrief } from "../src/lib/agent/demo-brief";
import {
  maxTokensForModel,
  modelSettings,
  readMessageContent,
  shouldFallbackToNano,
} from "../src/lib/agent/nemotron";
import { briefDraftSchema } from "../src/lib/agent/schema";
import { numberTokens, parseJsonLoose, unsupportedNumbers, wordCount } from "../src/lib/agent/text";
import { clusterEvents } from "../src/lib/cluster";
import { DEFAULT_MODELS } from "../src/lib/constants";
import { assessFlood } from "../src/lib/flood";
import { quantile } from "../src/lib/geo";
import { parseEonet, parseFirms, parseGdacs, parseUsgs } from "../src/lib/feeds";
import {
  forceForNwsEvent,
  severityForAqi,
  severityForGdacs,
  severityForMagnitude,
} from "../src/lib/severity";
import type { HazardEvent, SituationBrief } from "../src/lib/types";

const NANO = DEFAULT_MODELS.triage;
const SUPER = DEFAULT_MODELS.brief;

function event(partial: Partial<HazardEvent> & Pick<HazardEvent, "id" | "force" | "lat" | "lon">): HazardEvent {
  return {
    type: "Earthquake",
    title: partial.title ?? partial.id,
    time: partial.time ?? "2026-10-13T00:00:00.000Z",
    severity: partial.severity ?? 2,
    source: partial.source ?? "USGS",
    url: partial.url ?? `https://example.com/${partial.id}`,
    license: "test",
    attribution: "test",
    details: partial.details ?? { magnitude: 4.8 },
    ...partial,
  };
}

describe("severity and force", () => {
  it("maps magnitude, GDACS color, AQI, and NWS names", () => {
    expect(severityForMagnitude(4.8)).toBe(2);
    expect(severityForMagnitude(6.6)).toBe(4);
    expect(severityForMagnitude(5.2, "orange")).toBe(3);
    expect(severityForGdacs("Red")).toBe(4);
    expect(severityForGdacs("Green")).toBe(1);
    expect(severityForAqi(146)).toBe(2);
    expect(severityForAqi(80)).toBeNull();
    expect(forceForNwsEvent("Flood Warning")).toBe("water");
    expect(forceForNwsEvent("Red Flag Warning")).toBe("fire");
    expect(forceForNwsEvent("Heat Advisory")).toBe("air");
  });
});

describe("feeds", () => {
  it("normalizes a USGS feature", () => {
    const events = parseUsgs({
      features: [
        {
          id: "us6000u1ww",
          geometry: { type: "Point", coordinates: [-81.5274, 7.7361, 10] },
          properties: {
            mag: 4.8,
            place: "21 km W of Río Grande, Panama",
            time: 1791848206354,
            url: "https://earthquake.usgs.gov/earthquakes/eventpage/us6000u1ww",
            title: "M 4.8 - 21 km W of Río Grande, Panama",
            alert: null,
            tsunami: 0,
          },
        },
      ],
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: "usgs:us6000u1ww",
      force: "land",
      lat: 7.7361,
      lon: -81.5274,
      severity: 2,
      source: "USGS",
    });
    expect(events[0].details.magnitude).toBe(4.8);
  });

  it("normalizes GDACS and EONET", () => {
    const gdacs = parseGdacs({
      features: [
        {
          geometry: { type: "Point", coordinates: [84.628, 27.995] },
          properties: {
            eventtype: "FL",
            eventid: 1104225,
            name: "Flood in Nepal",
            fromdate: "2026-10-11T01:00:00",
            alertlevel: "Green",
            alertscore: 1,
            country: "Nepal",
            url: { report: "https://www.gdacs.org/report.aspx?eventid=1104225&eventtype=FL" },
            severitydata: { severity: 1, severitytext: "Green flood", severityunit: "" },
          },
        },
      ],
    });
    expect(gdacs[0]).toMatchObject({ force: "water", severity: 1, source: "GDACS" });
    expect(gdacs[0].url).toContain("gdacs.org");

    const eonet = parseEonet({
      events: [
        {
          id: "EONET_25238",
          title: "Wildfire Buckhorn 2, Cassia, Idaho",
          categories: [{ id: "wildfires", title: "Wildfires" }],
          sources: [{ url: "https://irwin.doi.gov/observer/incidents/2026-IDTFD-000268" }],
          geometry: [
            {
              magnitudeValue: 2000,
              magnitudeUnit: "acres",
              date: "2026-10-10T14:58:00Z",
              type: "Point",
              coordinates: [-114.102967, 42.337217],
            },
          ],
        },
      ],
    });
    expect(eonet[0]).toMatchObject({ force: "fire", severity: 2, source: "NASA EONET" });
  });

  it("keeps high-confidence FIRMS hotspots and grids them", () => {
    const csv = [
      "latitude,longitude,acq_date,acq_time,confidence,frp",
      "34.1,-118.2,2026-10-12,0315,h,12",
      "34.2,-118.3,2026-10-12,0315,l,4",
      "10.0,20.0,2026-10-12,1200,85,140",
    ].join("\n");
    const events = parseFirms(csv);
    expect(events).toHaveLength(2);
    expect(events.some((item) => item.severity === 3)).toBe(true);
  });
});

describe("flood and clustering", () => {
  it("flags a river only when the peak exceeds the prior p90 and is a real channel", () => {
    const baseline = Array.from({ length: 80 }, () => 100);
    const quiet = assessFlood([...baseline, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90], 7);
    expect(quiet).toBeNull();
    const rising = assessFlood([...baseline, 140, 150, 160, 170, 180, 190, 200, 180, 170, 160, 150, 140, 130, 120], 7);
    expect(rising?.severity).toBeGreaterThanOrEqual(2);
    expect(rising?.peak).toBeGreaterThan(rising?.p90 ?? 0);
    const ditch = Array.from({ length: 94 }, () => 2);
    expect(assessFlood(ditch, 7)).toBeNull();
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
  });

  it("groups a nearby quake pair and keeps a distant fire apart", () => {
    const situations = clusterEvents([
      event({ id: "a", force: "land", lat: 7.7, lon: -81.5, title: "Quake A", source: "USGS" }),
      event({
        id: "b",
        force: "land",
        lat: 7.9,
        lon: -81.3,
        title: "Quake B",
        source: "GDACS",
        time: "2026-10-13T02:00:00.000Z",
      }),
      event({
        id: "c",
        force: "fire",
        lat: 42.3,
        lon: -114.1,
        title: "Wildfire",
        type: "Wildfire",
        source: "NASA EONET",
      }),
    ]);
    expect(situations).toHaveLength(2);
    const land = situations.find((item) => item.force === "land");
    expect(land?.sources.sort()).toEqual(["GDACS", "USGS"]);
    expect(land?.nearby[0]?.force).toBeUndefined();
  });
});

describe("briefs", () => {
  it("builds a demo brief from source fields only", () => {
    const quake = event({
      id: "quake",
      force: "land",
      lat: 7.74,
      lon: -81.53,
      title: "M 4.8 - Río Grande, Panama",
      url: "https://earthquake.usgs.gov/earthquakes/eventpage/us6000u1ww",
      details: { magnitude: 4.8, depthKm: 10, place: "Río Grande, Panama" },
    });
    const situation = clusterEvents([quake])[0];
    const brief = buildDemoBrief(situation, [quake]);
    expect(brief.demo).toBe(true);
    expect(brief.populationEstimate).toBeNull();
    expect(wordCount(brief.summary)).toBeLessThanOrEqual(80);
    expect(brief.evidence.every((item) => item.url === quake.url)).toBe(true);
    const allowed = JSON.stringify([quake, situation]);
    expect(unsupportedNumbers(brief.summary, allowed)).toEqual([]);
    expect(brief.summary).toContain("4.8");
    expect(brief.demoLabel).toMatch(/Demo brief/);
  });

  it("validates the brief contract and lowers confidence when news disputes it", () => {
    const draft = {
      headline: "Flood in Nepal",
      summary: "GDACS reports a green flood in Nepal.",
      affectedArea: "Nepal",
      populationEstimate: null,
      confidence: { level: "medium" as const, score: 60 },
      evidence: [],
      contradictions: [],
      whatChanged: "First brief.",
      guidanceLinks: [],
    };
    expect(briefDraftSchema.safeParse(draft).success).toBe(true);
    const base: SituationBrief = {
      ...draft,
      evidence: [],
      guidanceLinks: [],
      demo: true,
      demoLabel: "Demo",
    };
    const tuned = applyCorroboration(
      base,
      [
        {
          title: "Report was a false alarm",
          url: "https://news.example/story",
          source: "news.example",
          text: "Officials said it did not happen.",
          origin: "tavily",
        },
      ],
      true,
    );
    expect(tuned.brief.confidence.score).toBeLessThan(60);
    expect(tuned.brief.evidence[0]?.stance).toBe("disagree");
    expect(retuneConfidence(80, { tavilyResults: 2, disagreements: 0, gdeltMatches: 0, tavilyRan: true }).level).toBe(
      "high",
    );
  });
});

describe("Nemotron routing", () => {
  it("uses the verified defaults and falls back when Super content is empty", () => {
    const settings = modelSettings({} as NodeJS.ProcessEnv);
    expect(settings.baseURL).toBe("https://api.tokenfactory.nebius.com/v1/");
    expect(settings.triage).toBe(NANO);
    expect(settings.brief).toBe(SUPER);
    expect(settings.analyst).toBe(DEFAULT_MODELS.analyst);
    expect(settings.apiKey).toBe("");
    expect(maxTokensForModel(SUPER, NANO)).toBeGreaterThanOrEqual(1000);
    expect(maxTokensForModel(NANO, NANO)).toBe(800);
    expect(shouldFallbackToNano("", SUPER, NANO)).toBe(true);
    expect(shouldFallbackToNano("{\"ok\":true}", SUPER, NANO)).toBe(false);
    expect(shouldFallbackToNano("", NANO, NANO)).toBe(false);
    expect(readMessageContent([{ type: "text", text: " ready " }])).toBe("ready");
    const custom = modelSettings({
      NEMOTRON_TRIAGE_MODEL: "nvidia/Nemotron-3_5-Lightning",
      NEMOTRON_BRIEF_MODEL: NANO,
      NEBIUS_API_KEY: "secret-not-logged",
    } as unknown as NodeJS.ProcessEnv);
    expect(custom.triage).toBe("nvidia/Nemotron-3_5-Lightning");
    expect(custom.brief).toBe(NANO);
    expect(custom.apiKey).toBe("secret-not-logged");
  });

  it("parses fenced JSON and strips thinking tags", () => {
    const parsed = parseJsonLoose('<think>secret</think>\n```json\n{"headline":"Quake"}\n```');
    expect(parsed).toEqual({ headline: "Quake" });
    expect(numberTokens("magnitude 4.8 at 10 km")).toEqual(["4.8", "10"]);
    expect(unsupportedNumbers("about 4.8", "magnitude 4.8")).toEqual([]);
    expect(unsupportedNumbers("about 99", "magnitude 4.8")).toEqual(["99"]);
  });
});
