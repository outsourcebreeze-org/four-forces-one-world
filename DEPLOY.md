# Deploy on Vercel

Four Forces, One World is a Next.js App Router app. It does not keep a process polling feeds. `GET /api/events`, `/api/situations`, and `/api/health` fetch public sources on request and reuse an 8-minute in-memory cache on that instance. `POST /api/briefs` runs Nemotron and Tavily for one situation. That request-and-cache shape fits Vercel serverless functions. A separate always-on host is not required.

Connect the Origin repository `sebastien-vaval/four-forces-one-world`. Framework preset: Next.js. Build command: `npm run build`. Install command: `npm install`. No custom output directory.

## Environment variable names

Set these in the Vercel project. Do not commit values.

Required for live briefs, news checks, FIRMS fires, and OpenAQ stations:

- `NEBIUS_API_KEY`
- `TAVILY_API_KEY`
- `FIRMS_MAP_KEY`
- `OPENAQ_API_KEY`

Optional:

- `NEBIUS_BASE_URL` — default `https://api.tokenfactory.nebius.com/v1/`
- `NEMOTRON_TRIAGE_MODEL` — default `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`
- `NEMOTRON_BRIEF_MODEL` — default `nvidia/nemotron-3-super-120b-a12b`
- `NEMOTRON_ANALYST_MODEL` — default `nvidia/Nemotron-3-Ultra-550b-a55b`
- `DEMO_MODE` — leave unset for live feeds. `snapshot` serves `data/demo-snapshot.json` only.

The app still boots with no keys: public feeds stay live and briefs are labeled demo. FIRMS and OpenAQ are skipped until their keys are set.

## Function time

The data routes and `/api/briefs` set `maxDuration` to 60 seconds. The first uncached request waits on every feed at once. GDELT, after HTTP 429, waits 12 seconds and then 28 seconds, and skips a wait that would push that call past 50 seconds. Use a Vercel plan that allows 60-second functions. A 10-second cap will cut off a cold ingest; the route then serves the recorded snapshot and says the live ingest failed.

## Cache

Each function instance keeps the world in memory for eight minutes. Disk is best-effort: `.cache/world.json` in local development, `/tmp/four-forces-world.json` when `VERCEL` is set. Instances do not share that file. Briefs are cached in memory for 20 minutes.

## Local check before promoting

```bash
npm test
npm run build
```

Open the deployment, confirm `/api/health` reports `dataMode: "live"`, and request one brief. `/api/agent` reports whether `NEBIUS_API_KEY` is present and never returns the key.
