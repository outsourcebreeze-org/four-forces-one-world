# Four Forces, One World

An open-source globe that puts public water, air, land, and fire signals in one place, then writes a short situation brief with a confidence score and the sources behind it.

It is a civil public-safety tool for municipal emergency offices, humanitarian coordinators, and campus or facility safety leads. It does not track people, and it does not add flight, ship, or other surveillance layers.

The four-force idea was inspired by FourForces Watch. This repository is a separate project. The code here was written for this project and is not a copy of that one.

**Live demo:** [https://four-forces-one-world.vercel.app](https://four-forces-one-world.vercel.app)

**Demo video:** YouTube link TBD

## Hackathon

Nebius Global AI Hackathon. Track: Best Apps and Agents. Entrant: OutsourceBreeze LLC (Miami, FL).

## Testing instructions for judges

The live demo already has the Nebius and Tavily keys configured. You do not need to paste secrets into the site.

1. Open the [live demo](https://four-forces-one-world.vercel.app) and wait for the globe. The first load pulls public feeds and can take a few seconds.
2. Filter by force (water, air, land, fire), severity, time window, text, or a watch-area city. The side list is the keyboard path. Selecting a row or a globe point shows the underlying public records.
3. Choose **Ask Nemotron for a brief**. A live brief is badged **Live brief**, not **Demo**. The footer names the models. Nano triages, then Super drafts. A **Tavily** mark means the news check ran. Confidence stays capped when that check did not run.
4. When the panel says other forces sit within 500 km, choose **Regional note (Ultra)**. That is the only Ultra call. The footer should include `nvidia/Nemotron-3-Ultra-550b-a55b` (or the `NEMOTRON_ANALYST_MODEL` override). A **Demo** badge means the model reply failed grounding and the template was used instead.
5. Open [https://four-forces-one-world.vercel.app/api/health](https://four-forces-one-world.vercel.app/api/health). `tavilyConfigured` is `true` when the Tavily key is present. The response does not include the key or its length.
6. Select a situation in the United States, such as a western wildfire or a flood warning. The side panel **Live cameras** section lists USGS river cameras within 50 km, with a still that refreshes about once a minute, a distance, and a link to HIVIS. A situation with nothing nearby, including most places outside the United States and Québec, says no camera was found. Québec matches open the official Québec 511 viewer instead of embedding the video.
7. Optional local checks, from a checkout with dependencies installed: `npm test`, then `npm run build`. `npm run hello-nemotron` calls Nemotron Nano when `NEBIUS_API_KEY` is set and prints a skip message when it is not.

## Run

```bash
npm install && npm run dev
```

Open [http://127.0.0.1:3847](http://127.0.0.1:3847).

No API keys are required to browse public feeds. USGS, GDACS, NASA EONET, NWS, and Open-Meteo load live. Briefs are templates labeled **Demo** until `NEBIUS_API_KEY` is set. Set `DEMO_MODE=snapshot` to use the recorded file in `data/demo-snapshot.json` instead of live feeds.

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
| `NEXT_PUBLIC_SENTRY_DSN` | Optional | Browser Sentry DSN. Empty leaves the client SDK off. Inlined at build time |
| `SENTRY_DSN` | Optional | Server and edge Sentry DSN. Falls back to `NEXT_PUBLIC_SENTRY_DSN` |
| `SENTRY_AUTH_TOKEN` | Optional | Uploads source maps during `next build`. The build succeeds without it |
| `SENTRY_ORG` | Optional | Sentry org slug. Default `outsourcebreeze` |
| `SENTRY_PROJECT` | Optional | Sentry project slug. Default `four-forces-one-world` |
| `SENTRY_TRACES_SAMPLE_RATE` | Optional | Server and edge trace sample rate, 0 to 1. Default `0.1`. Falls back to the public rate |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | Optional | Browser trace sample rate, 0 to 1. Default `0.1` |
| `SENTRY_DEBUG_ROUTE` | Optional | Set to `1` to open `/sentry-example-page` and `/api/sentry-example-api`. Otherwise those routes are not found |

Checked against Token Factory on 13 Oct 2026: one base URL serves these models. Nano is used for triage because it returns `content` directly. Super writes situation briefs. Super is a reasoning model, so brief calls send `max_tokens` of 4000. If `content` still comes back empty, the same prompt is sent to the triage model (Nano, unless you override it).

Ultra is `nvidia/Nemotron-3-Ultra-550b-a55b` unless `NEMOTRON_ANALYST_MODEL` overrides it. It is called in one place: a regional note. The situation panel button **Regional note (Ultra)** (`src/components/dashboard.tsx`) posts `{ situationId, kind: "regional" }` to `POST /api/briefs`. `createBrief` in `src/lib/agent/pipeline.ts` then calls `draftWithModel` with role `analyst` only for that kind. `completeJson` in `src/lib/agent/nemotron.ts` sends the analyst role to the Ultra model. A single-situation brief uses Super, and triage uses Nano. Ultra is not used for ingest.

The production deployment has `NEBIUS_API_KEY` and `TAVILY_API_KEY` configured. FIRMS and OpenAQ stay optional. A local checkout still needs the Nebius and Tavily keys in `.env` if you want live briefs and news verification on your own machine.

## Monitoring

Sentry is optional. With `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN` unset, the SDK does not start and the globe, feeds, and briefs behave as they do without it.

`NEXT_PUBLIC_SENTRY_DSN` is the browser DSN and is included in the client bundle, so set it in the host before the build. `SENTRY_DSN` is read on the server and edge at runtime and falls back to the public DSN. Do not commit either value. `SENTRY_AUTH_TOKEN` is the secret used only to upload source maps. Leave it unset and the build still succeeds; source maps are not uploaded.

Traces default to 10 percent (`0.1`). Personal data is not sent (`sendDefaultPii` is false, and the SDK 11 `dataCollection` flags for user info, cookies, headers, bodies, query strings, and stack variables are off). Session Replay is not enabled. `SENTRY_ORG` defaults to `outsourcebreeze` and `SENTRY_PROJECT` defaults to `four-forces-one-world`.

Set `SENTRY_DEBUG_ROUTE=1` only when you want to fire a test error. `/sentry-example-page` then has a client button and a server button. `/api/sentry-example-api` throws. Any other value, including unset, makes both routes respond as not found. Leave this unset on the public demo.

## What you can do

The globe colors situations by force. Filters cover force, severity, time window, a text search, and a watch-area city. The side list is the keyboard path. Selecting a situation shows the underlying records.

- Without Nebius, a template brief is filled from the source fields and marked demo. Cached examples in `data/demo-briefs.json` are used when the situation id matches the recording.
- With Nebius, Nano triages, Super drafts, and the draft is rejected if it cites a number or a population that is not in the payload. Ultra drafts a regional note when other forces sit within 500 km. That regional call is the analyst role described above.
- With Tavily, a news search runs for that situation. Corroboration can raise confidence. Language such as “false alarm” or “did not happen” lowers it. Confidence stays capped when Tavily did not run.
- GDELT is one query per ingest, at least 5 seconds apart. A 429 waits 12 seconds and then 28 seconds before the next try, and then the feed is marked down. Matching articles are attached as unconfirmed context.

`POST /api/briefs` with `{ "situationId", "kind": "situation" | "regional" }`. `GET /api/events`, `/api/situations`, `/api/health`, `/api/agent`, and `/api/cameras` are the other routes. `/api/cameras?lat=&lon=` returns up to three public cameras within 50 km. `/api/health` reports `tavilyConfigured` and does not report key length. `/api/agent` reports model ids and whether a key is present. It never returns the key.

## Live cameras

Selecting a situation asks for cameras within 50 km. The catalogs are cached on the server for 15 minutes. No camera key is required.

| Source | Connected | Terms | What the panel does |
| --- | --- | --- | --- |
| [USGS HIVIS / NIMS](https://api.waterdata.usgs.gov/docs/nims/) | Yes | US government work, public domain. An API key is optional and only raises the rate limit ([key docs](https://api.waterdata.usgs.gov/docs/ogcapi/keys/)). Unkeyed reads stay under the published limit by caching the catalog. | Shows the official 720 px still (`{smallDir}{camId}_newest.jpg`) and links to the [HIVIS camera page](https://apps.usgs.gov/hivis). |
| [Québec 511 cameras](https://www.donneesquebec.ca/recherche/dataset/camera-de-circulation) | Yes, link only | The Données Québec GeoJSON is [CC BY 4.0](https://www.donneesquebec.ca/recherche/dataset/camera-de-circulation). The [Québec 511 platform terms](https://www.quebec511.info/en/basdepage/Utilisation.aspx) prohibit using that site’s content for a purpose other than the platform. The RSS policy is separate and is not the camera catalog. | Shows the nearest camera name, distance, and the official viewer URL from the open dataset. It does not embed or hotlink the video. |
| [ALERTWildfire / ALERTWest](https://alertwest.live/cameras) | No | The [terms of use](https://alertwest.live/cameras) (also at [alertwest.live/tou](https://alertwest.live/tou)) forbid screen-scraping, pulling data into a third-party system, and any license to reproduce camera data without an MSA (sections 3.6, 3.7, and 7.1). The [crediting page](https://www.alertwest.org/crediting-and-branding) and [ALERTCalifornia’s non-commercial credit guide](https://alertcalifornia.org/crediting-and-branding/) do not grant that MSA. | Not shown. |
| [HPWREN](https://www.hpwren.ucsd.edu/cc.html) | No | Live images less than 24 hours old require a license from the UC San Diego Office of Innovation and Commercialization. This demo does not have that license. Archived imagery is CC BY-NC and is not a live camera. | Not shown. |
| [FL511 / Florida 511](https://services.arcgis.com/3wFbqsFPLeKqOlIK/arcgis/rest/services/FL511_Traffic_Cameras/FeatureServer) | No | No public terms were found that allow a third-party app to reproduce FL511 camera images. FDOT’s RTMC procedures limit CCTV to traffic and information use on FDOT systems, and the fuller SunGuide feed needs an FDOT agreement this project does not have. Newsroom materials at [news.fl511.com/about](https://news.fl511.com/about/) cover promoting FL511, not republishing camera frames. | Not shown. |

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
             Live cameras: USGS stills and Québec 511 links within 50 km
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
