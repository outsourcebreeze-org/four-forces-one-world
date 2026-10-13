import {
  fetchEonet,
  fetchFirms,
  fetchGdacs,
  fetchGdelt,
  fetchNws,
  fetchOpenAq,
  fetchOpenMeteo,
  fetchUsgs,
} from "./feeds";
import type { HazardEvent, NewsArticle, SourceHealth } from "./types";

type Job = {
  source: string;
  attribution: string;
  run: () => Promise<{ events: HazardEvent[]; articles: NewsArticle[] }>;
};

async function runJob(job: Job): Promise<SourceHealth & { events: HazardEvent[]; articles: NewsArticle[] }> {
  const started = Date.now();
  try {
    const result = await job.run();
    return {
      source: job.source,
      attribution: job.attribution,
      ok: true,
      count: result.events.length + result.articles.length,
      ms: Date.now() - started,
      events: result.events,
      articles: result.articles,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Feed failed";
    return {
      source: job.source,
      attribution: job.attribution,
      ok: false,
      count: 0,
      ms: Date.now() - started,
      error: message.slice(0, 240),
      events: [],
      articles: [],
    };
  }
}

export async function ingestLive(): Promise<{
  events: HazardEvent[];
  articles: NewsArticle[];
  health: SourceHealth[];
}> {
  const firmsKey = process.env.FIRMS_MAP_KEY?.trim();
  const openAqKey = process.env.OPENAQ_API_KEY?.trim();
  const jobs: Job[] = [
    {
      source: "USGS",
      attribution: "USGS Earthquake Hazards Program",
      run: async () => ({ events: await fetchUsgs(), articles: [] }),
    },
    {
      source: "GDACS",
      attribution: "GDACS / UN OCHA / EC JRC",
      run: async () => ({ events: await fetchGdacs(), articles: [] }),
    },
    {
      source: "NASA EONET",
      attribution: "NASA EONET",
      run: async () => ({ events: await fetchEonet(), articles: [] }),
    },
    {
      source: "NOAA/NWS",
      attribution: "NOAA / National Weather Service",
      run: async () => ({ events: await fetchNws(), articles: [] }),
    },
    {
      source: "Open-Meteo",
      attribution: "Open-Meteo (non-commercial) and GloFAS",
      run: async () => {
        const meteo = await fetchOpenMeteo();
        return { events: [...meteo.flood, ...meteo.air], articles: [] };
      },
    },
    {
      source: "GDELT",
      attribution: "GDELT Project (1 request / 5 seconds)",
      run: async () => ({ events: [], articles: await fetchGdelt() }),
    },
  ];

  if (firmsKey) {
    jobs.push({
      source: "NASA FIRMS",
      attribution: "NASA FIRMS",
      run: async () => ({ events: await fetchFirms(firmsKey), articles: [] }),
    });
  }
  if (openAqKey) {
    jobs.push({
      source: "OpenAQ",
      attribution: "OpenAQ",
      run: async () => ({ events: await fetchOpenAq(openAqKey), articles: [] }),
    });
  }

  const results = await Promise.all(jobs.map((job) => runJob(job)));
  const health: SourceHealth[] = results.map((result) => ({
    source: result.source,
    attribution: result.attribution,
    ok: result.ok,
    count: result.count,
    ms: result.ms,
    ...(result.error ? { error: result.error } : {}),
    ...(result.skipped ? { skipped: result.skipped } : {}),
  }));
  if (!firmsKey) {
    health.push({
      source: "NASA FIRMS",
      attribution: "NASA FIRMS",
      ok: true,
      count: 0,
      ms: 0,
      skipped: "no-key",
    });
  }
  if (!openAqKey) {
    health.push({
      source: "OpenAQ",
      attribution: "OpenAQ",
      ok: true,
      count: 0,
      ms: 0,
      skipped: "no-key",
    });
  }

  const seen = new Set<string>();
  const events: HazardEvent[] = [];
  for (const result of results) {
    for (const event of result.events) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      events.push(event);
    }
  }
  const articles = results.flatMap((result) => result.articles).slice(0, 20);
  return { events, articles, health };
}
