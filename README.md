# Four Forces, One World

An open-source globe that puts public water, air, land, and fire signals in one place, then writes a short situation brief with a confidence score and the sources behind it.

It is a civil public-safety tool for municipal emergency offices, humanitarian coordinators, and campus or facility safety leads. It does not track people, and it does not add flight, ship, or other surveillance layers.

The four-force idea was inspired by FourForces Watch. This repository is a separate project. The code here was written for this project and is not a copy of that one.

## Run

```bash
npm install && npm run dev
```

Open [http://127.0.0.1:3847](http://127.0.0.1:3847).

No API keys are required. USGS, GDACS, NASA EONET, NWS, and Open-Meteo load live. Briefs are templates labeled **Demo** until `NEBIUS_API_KEY` is set. Set `DEMO_MODE=snapshot` to use the recorded file in `data/demo-snapshot.json` instead of live feeds.

```bash
npm test
npm run hello-nemotron
```

`hello-nemotron` prints a skip message when `NEBIUS_API_KEY` is missing, and calls Nemotron Nano when the key is set.

## Keys

Copy `.env.example` to `.env`. Secrets stay in the environment. Nothing in this repo is a credential.

| Variable | Required | Role |
| --- | --- | --- |
| `NEBIUS_API_KEY` | For live briefs | Nebius Token Factory, OpenAI-compatible |
| `TAVILY_API_KEY` | For news verification | Tavily search while a brief is written |
| `FIRMS_MAP_KEY` | Optional | NASA FIRMS active fires |
| `OPENAQ_API_KEY` | Optional | OpenAQ station PM2.5 |
| `NEMOTRON_TRIAGE_MODEL` | Optional | Default `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` |
| `NEMOTRON_BRIEF_MODEL` | Optional | Default `nvidia/nemotron-3-super-120b-a12b` |
| `NEMOTRON_ANALYST_MODEL` | Optional | Default `nvidia/Nemotron-3-Ultra-550b-a55b` |
| `NEBIUS_BASE_URL` | Optional | Default `https://api.tokenfactory.nebius.com/v1/` |
| `DEMO_MODE` | Optional | `snapshot` forces the recorded feeds |

Checked against Token Factory on 13 Oct 2026: one base URL serves these models. Nano is used for triage because it returns `content` directly. Super writes briefs. Super is a reasoning model, so brief calls send `max_tokens` of 4000. If `content` still comes back empty, the same prompt is sent to the triage model (Nano, unless you override it). Ultra is used only when you ask for a regional note.

Still needed for the full agent path: `NEBIUS_API_KEY` and `TAVILY_API_KEY`. FIRMS and OpenAQ are optional.

## What you can do

The globe colors situations by force. Filters cover force, severity, time window, a text search, and a watch-area city. The side list is the keyboard path. Selecting a situation shows the underlying records.

- Without Nebius, a template brief is filled from the source fields and marked demo. Cached examples in `data/demo-briefs.json` are used when the situation id matches the recording.
- With Nebius, Nano triages, Super drafts, and the draft is rejected if it cites a number or a population that is not in the payload. Ultra drafts a regional note when other forces sit within 500 km.
- With Tavily, a news search runs for that situation. Corroboration can raise confidence. Language such as “false alarm” or “did not happen” lowers it. Confidence stays capped when Tavily did not run.
- GDELT is one query per ingest, at least 5 seconds apart. A 429 waits 12 seconds and then 28 seconds before the next try, and then the feed is marked down. Matching articles are attached as unconfirmed context.

`POST /api/briefs` with `{ "situationId", "kind": "situation" | "regional" }`. `GET /api/events`, `/api/situations`, `/api/health`, and `/api/agent` are the other routes. `/api/agent` reports model ids and whether a key is present. It never returns the key.

## Architecture

```text
Public feeds
  USGS, GDACS, EONET, NWS, Open-Meteo, GDELT
  FIRMS and OpenAQ when keys exist
        │
        ▼
Normalize to one HazardEvent
        │
        ▼
Space-time clusters (situations)
        │
        ├─ Globe UI (globe.gl, NASA Blue Marble)
        │
        └─ Brief pipeline
             Nano triage → Super brief → Tavily + GDELT
             Ultra only for a regional note
             Demo template if the key is missing or the draft fails grounding
```

Ingest runs when an API route is called and is cached in memory for eight minutes. A copy is also written under `.cache/` locally, or `/tmp` on Vercel. A failed cache write does not discard a live result. If every live feed comes back empty, the UI switches to the recorded snapshot and says so. See [DEPLOY.md](DEPLOY.md) for Vercel.

Nemotron and Token Factory are used only in `src/lib/agent/nemotron.ts` and the brief route. There is no other hosted Nebius service in this MVP: ingestion and the API run in the Next.js process so one command is enough. A later step can move ingest to a scheduled job and the API to a serverless endpoint without changing the event schema.

## Severity

| Score | Meaning | Examples |
| --- | --- | --- |
| 1 | Minor | GDACS green, magnitude under 4.5 |
| 2 | Moderate | M4.5–5.4, NWS moderate, US AQI 101–150 |
| 3 | Severe | M5.5–6.4, GDACS orange, US AQI 151–200 |
| 4 | Extreme | M6.5+, GDACS red, US AQI 201+ |

The normalization rules live in `src/lib/severity.ts` and `src/lib/flood.ts`.

## Tests

```bash
npm test
```

Vitest covers feed parsing, severity, flood gating, clustering, demo-brief grounding, the brief JSON schema, confidence changes, and the Nemotron model defaults (including the empty-content fallback). Live network calls are not part of the test run.

Refresh the recorded snapshot after a feed change:

```bash
npm run snapshot
```

## Data

See [LICENSES_DATA.md](LICENSES_DATA.md). Open-Meteo flood and air-quality calls are free for non-commercial use and must be attributed. The footer in the app repeats that.

## License

MIT. See [LICENSE](LICENSE).
