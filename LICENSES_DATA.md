# Data sources and licenses

Four Forces, One World reads public hazard feeds and normalizes them to one event record: `id`, `force`, `type`, `title`, `lat`, `lon`, `time`, `severity` (0–4), `source`, `url`, plus `license`, `attribution`, and scalar `details` copied from the feed.

This file is the attribution register. Re-check terms before any commercial use. The application code is MIT; the data is not, and Open-Meteo’s free API is non-commercial.

| Source | Force | Access | Terms used here |
| --- | --- | --- | --- |
| [USGS Earthquake Hazards GeoJSON](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php) | Land | No key. `4.5_day` feed. | US government work, public domain. Attribute the USGS Earthquake Hazards Program. |
| [GDACS event list](https://www.gdacs.org/) | Water, air, land, fire | No key. SEARCH GeoJSON with `eventlist` and `alertlevel`. | Free with attribution to GDACS, UN OCHA, and the European Commission JRC. |
| [NASA EONET v3](https://eonet.gsfc.nasa.gov/docs/v3) | All four | No key. Open events. | NASA open data. Attribute NASA EONET. |
| [NOAA / NWS api.weather.gov](https://www.weather.gov/documentation/services-web-api) | Water, air, land, fire | No key. A `User-Agent` header is required. US alerts only. Alerts without coordinates are kept only when they cover a watched city point. | US government work, public domain. Attribute NOAA / National Weather Service. |
| [Open-Meteo Flood API](https://open-meteo.com/en/docs/flood-api) | Water | No key. GloFAS river discharge at nine major-river cells. | **Free for non-commercial use.** Attribute [Open-Meteo](https://open-meteo.com/) and GloFAS / Copernicus EMS. Commercial use needs an Open-Meteo plan. |
| [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api) | Air | No key. Current US AQI at 16 cities. Readings under 101 are not plotted. | **Free for non-commercial use.** Attribute Open-Meteo. |
| [GDELT DOC 2.0](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/) | Context, not a map layer | No key. **1 request per 5 seconds.** One cached global query per ingest. | Attribute the GDELT Project. Articles are corroboration, not hazard points. |
| [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/api/area/) | Fire | `FIRMS_MAP_KEY`. VIIRS SNPP, three regions, high confidence, gridded. | Free with NASA’s MAP_KEY and usage limits. Attribute NASA FIRMS. Skipped when the key is absent. |
| [OpenAQ v3](https://docs.openaq.org/) | Air | `OPENAQ_API_KEY` in the `X-API-Key` header. | Attribute OpenAQ and the underlying monitoring network. Skipped when the key is absent. |
| [Tavily Search](https://docs.tavily.com/) | Verification | `TAVILY_API_KEY`. Called when a brief is requested, not during ingest. | Tavily API terms. A functional search call is what adjusts confidence. |
| [Nebius Token Factory](https://docs.tokenfactory.nebius.com/) | Briefs | `NEBIUS_API_KEY`. OpenAI-compatible `https://api.tokenfactory.nebius.com/v1/`. | Nebius and NVIDIA model terms. NVIDIA open models: Nemotron 3 Nano, Super, and Ultra. |
| [USGS HIVIS / NIMS](https://api.waterdata.usgs.gov/docs/nims/) | Cameras | No key. `/cameras` catalog, cached 15 minutes. Stills use `{smallDir}{camId}_newest.jpg`. | US government work, public domain. Attribute the U.S. Geological Survey. An API key only raises the rate limit. |
| [Québec 511 cameras](https://www.donneesquebec.ca/recherche/dataset/camera-de-circulation) | Cameras | No key. Données Québec WFS GeoJSON. | Locations and official viewer links are CC BY 4.0. The panel links to Québec 511 and does not embed the video. Platform terms: [Québec 511](https://www.quebec511.info/en/basdepage/Utilisation.aspx). |

Not connected, because the terms do not allow this demo: ALERTWildfire / ALERTWest (no license to reproduce camera data without an MSA, [terms](https://alertwest.live/cameras)), HPWREN live imagery (a UC San Diego license is required for data less than 24 hours old, [conditions](https://www.hpwren.ucsd.edu/cc.html)), and FL511 camera images (no public reuse grant, and the fuller feed needs an FDOT agreement).

Not in this version: ReliefWeb (needs an approved `appname`), Copernicus CEMS GRIB/NetCDF (Open-Meteo already exposes GloFAS), flights, ships, and cable maps.

The globe image is NASA Blue Marble imagery, which is in the public domain, stored under `public/textures/`.

Severity is a shared 0–4 scale, not the source’s native unit. Earthquakes use magnitude and PAGER. GDACS uses green / orange / red. NWS uses its severity words. Air uses US AQI (101 and above). Rivers use the latest peak divided by the prior-year 90th percentile, and cells under 80 m³/s are dropped so a misplaced ditch is not called a flood. Every brief is supposed to cite the source field, not a new measurement.
