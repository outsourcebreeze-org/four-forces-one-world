export const FORCES = ["water", "air", "land", "fire"] as const;

export type Force = (typeof FORCES)[number];

export type Severity = 0 | 1 | 2 | 3 | 4;

/** Scalar fields copied from a feed. Briefs may cite only these values. */
export type DetailValue = string | number | boolean | null;

export type HazardEvent = {
  id: string;
  force: Force;
  type: string;
  title: string;
  lat: number;
  lon: number;
  /** ISO-8601 time of the observation or alert. */
  time: string;
  severity: Severity;
  source: string;
  url: string;
  license: string;
  attribution: string;
  details: Record<string, DetailValue>;
};

export type NewsArticle = {
  title: string;
  url: string;
  source: string;
  time: string | null;
  origin: "gdelt";
};

export type SourceHealth = {
  source: string;
  ok: boolean;
  count: number;
  ms: number;
  attribution: string;
  error?: string;
  skipped?: "no-key";
};

export type NearbySituation = {
  id: string;
  force: Force;
  title: string;
  severity: Severity;
  km: number;
};

export type Situation = {
  id: string;
  force: Force;
  title: string;
  lat: number;
  lon: number;
  time: string;
  severity: Severity;
  eventIds: string[];
  sources: string[];
  types: string[];
  place: string | null;
  nearby: NearbySituation[];
};

export type KeyPresence = {
  nebius: boolean;
  tavily: boolean;
  firms: boolean;
  openaq: boolean;
};

export type WorldState = {
  generatedAt: string;
  dataMode: "live" | "demo-snapshot";
  notice: string | null;
  events: HazardEvent[];
  situations: Situation[];
  articles: NewsArticle[];
  health: SourceHealth[];
  keys: KeyPresence;
};

export type EvidenceStance = "agree" | "disagree" | "unconfirmed";

export type SituationBrief = {
  headline: string;
  summary: string;
  affectedArea: string | null;
  populationEstimate: string | null;
  confidence: {
    level: "low" | "medium" | "high";
    score: number;
  };
  evidence: Array<{
    title: string;
    url: string;
    source: string;
    stance: EvidenceStance;
    note: string;
  }>;
  contradictions: string[];
  whatChanged: string;
  guidanceLinks: Array<{ title: string; url: string }>;
  demo: boolean;
  demoLabel: string | null;
};

export type BriefPipeline = {
  mode: "demo" | "live" | "demo-fallback";
  cached: boolean;
  models: string[];
  verifiedWithTavily: boolean;
  gdeltMatches: number;
  emptyContentFallback: boolean;
};

export type BriefResponse = {
  situationId: string;
  kind: "situation" | "regional";
  brief: SituationBrief;
  pipeline: BriefPipeline;
};
