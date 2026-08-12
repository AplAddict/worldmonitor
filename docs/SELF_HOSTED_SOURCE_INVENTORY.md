# Self-hosted World Monitor — source inventory and runtime audit

**Audit timestamp:** 2026-08-12 04:55 UTC  
**Deployment revision:** `371509cf` at audit start (runtime image subsequently unchanged by this document)  
**Scope:** self-hosted scheduler, seeders, relay cadence, and provider configuration. Secrets and credential values are deliberately excluded.

## Runtime contract

| Component | Verified state | Evidence |
|---|---|---|
| Web application | healthy | Docker healthcheck probes `127.0.0.1:8080/api/health` |
| AIS / cache relay | healthy | Docker healthcheck healthy |
| Public application route | protected | `https://world.isaaczipperstein.com/` returns Authentik redirect (`302`) without a session |
| Browser session bootstrap | protected | `/api/wm-session` returns Authentik redirect (`302`) without a session |
| Credential status route | protected | `/operator-credentials-api/status` returns Authentik redirect (`302`) without a session |
| Credentials boundary | private named volumes | credential service is sole writer; consumers mount read-only |
| Scheduled producer | enabled | `worldmonitor-seeders.timer`, every 15 minutes with up to two-minute randomized delay |

The repository-managed production timer is `OnCalendar=*:0/15`, `Persistent=true`, `RandomizedDelaySec=2m`. Per-source locks, interval gates, and the one-shot systemd service prevent this refresh opportunity cadence from turning into overlapping provider runs.

## Scheduled self-hosted seeders — live result

The latest systemd-triggered run completed at **2026-08-12 04:55:47 UTC** with **12 successful, 0 degraded** seeders. A prior run exposed a stale reference to a nonexistent `seed-fred-rates.mjs`; this was removed. FRED data is produced by `seed-economy.mjs` (which successfully fetched 24/24 series), not by a standalone script.

| Seeder / cache domain | Primary source(s) | Latest observed result | Cadence / freshness contract |
|---|---|---:|---|
| Supply-chain PortWatch | ArcGIS Daily Chokepoints service | 13 chokepoints | Scheduler every 6h; cache TTL 12h |
| PortWatch disruptions | PortWatch/ArcGIS data | 2 active records | Scheduler every 6h; source cache contract |
| PortWatch chokepoint reference | PortWatch/ArcGIS data | 28 reference records | Scheduler every 6h |
| Seismology | USGS M4.5 weekly GeoJSON feed | 107 events | Scheduler every 6h; cache TTL 6h |
| Weather alerts | US National Weather Service active alerts | 50 alerts | Scheduler every 6h; cache TTL 15m; panel max stale 45m |
| Natural events | NASA EONET, GDACS, NOAA/NHC tropical service | 17 events | Scheduler every 6h; cache TTL 12h |
| Cyber threats | C2Intel and Feodo public feeds; optional URLhaus/OTX/AbuseIPDB | 248 deduplicated threats | Scheduler every 6h; relay cyber cadence 2h / TTL 6h |
| Economy / macro | FRED (24 series), EIA, NY Fed GSCPI, Yahoo macro fallback | 2 canonical records plus component keys | Scheduler every 6h; FRED TTL 26h; macro TTL 6h |
| Petroleum | U.S. EIA series API | 4 series | Scheduler every 6h; cache TTL 7d |
| Market quotes | Finnhub and Yahoo Finance fallback | 48 instruments | Scheduler every 6h; relay live-market seed 5m / TTL 2h |
| Earnings calendar | market calendar provider in existing seeder | 100 entries of 1,039 reported | Scheduler every 6h |
| Wildfire detections | NASA FIRMS VIIRS SNPP / NOAA-20 / NOAA-21 | 473 detections | Scheduler every 6h; latest run completed in ~170s |

### Observed degradation and deliberate omissions

| Item | Status | Meaning / action |
|---|---|---|
| `seed-fred-rates.mjs` | **fixed** | Stale manifest entry referred to a file absent in this fork. Removed; no data source failed. |
| GDACS call during natural-event seed | degraded sub-source, non-fatal | Timed out after 15 seconds. The seed retained 17 valid events from other sources. Monitor if repeated; do not label the natural-events cache failed. |
| URLhaus / ThreatFox | intentionally unconfigured | No `URLHAUS_AUTH_KEY`; public C2Intel and Feodo sources still populated cyber data. |
| AlienVault OTX | intentionally unconfigured | No OTX credential. |
| AbuseIPDB | intentionally unconfigured | No AbuseIPDB credential. |
| Wildfire on final run | lock-skipped | Another seed held the source lock; this is expected lock protection, not source failure. The immediately preceding run completed 473 records successfully. |

The seeder runner now exits nonzero on any degraded member. This prevents a partial source failure from being hidden as scheduler success.

## Always-on relay / cache cadence

The relay maintains additional continuously refreshed or on-demand source families. The table groups verified code-level cadence contracts; it is not a claim that every optional credentialed source is configured.

| Family | Cadence | TTL / failure behavior |
|---|---:|---|
| OREF alert polling | 5m minimum/default | Persisted 7d; historical OREF bootstrap is intentionally skipped without an Israeli proxy; live Tzeva Adom path remains separate |
| Telegram ingestion | 1m default | whole poll cycle capped at 3m |
| UCDP conflict data | 6h | 24h TTL |
| Satellite / imagery seed | 2h | 6h TTL |
| Market caches | 5m | generally 2h TTL |
| Cyber IOC feeds | 2h | 6h TTL |
| Positive events | 15m | 45m TTL |
| Service status probe | 15m | source-specific health classification |
| Theater posture | 10m | live 20m; stale backup 24h / 7d |
| Climate news | 30m | 4m source timeout; retry after 20m |
| Chokepoint flows | 6h | 5m source timeout; retry after 20m |
| Chokepoint transit and summary | 10m | 1h TTL |
| Shipping stress | 15m | 1h TTL |
| Social velocity / WSB tickers | 3h | 12h TTL, designed to surface stale before empty |
| Weather | 15m | 90m TTL |
| World Bank / annual data | 24h | 7d TTL |
| OpenSky aircraft cache | 60s | negative cache 30s |
| RSS | 5m | exponential negative cache, capped at 15m |
| Polymarket | 10m | negative cache 5m on error / rate limit |
| AviationStack | 2m | source cache 2m |
| NOTAM | on demand / relay cache | 30m TTL |
| AIS snapshot broadcast | 5s default | vessel metadata TTL 24h |

## Credential catalog: configured capability vs. active proof

The private credential catalog has **41 slots**. Presence in the catalog means the source can be configured in the operator credential service; it does **not** prove credentials are present or a data call is live.

| Group | Slots | Potential sources / integrations |
|---|---:|---|
| Markets | 2 | Finnhub; Alpha Vantage |
| Economy & energy | 4 | EIA; FRED; IMF SDMX; WTO |
| Climate & environment | 4 | NASA FIRMS; OpenAQ; WAQI; ReliefWeb |
| Conflict & security | 5 | ACLED token/email/password; UCDP; Cloudflare Radar |
| Cyber intelligence | 3 | URLhaus/ThreatFox; AlienVault OTX; AbuseIPDB |
| Maritime & aviation | 7 | AISStream; OpenSky OAuth ID/secret; AviationStack; ICAO; Wingbits; Travelpayouts |
| Public procurement | 1 | SAM.gov |
| Social & OSINT | 7 | ScrapeCreators; Reddit OAuth ID/secret/user agent; Telegram API ID/hash/session |
| Research & search | 3 | Exa; Brave Search; SerpAPI |
| AI enrichment | 5 | Groq; OpenRouter; compatible LLM URL/key/model |

## Potential public/no-key sources observed in code

This is a non-exhaustive code inventory of public or fallback upstreams used by existing seed/relay implementations: ArcGIS/PortWatch, USGS, NWS, NASA EONET, GDACS, NOAA/NHC, C2Intel, Feodo, Yahoo Finance, NY Fed GSCPI, World Bank, BIS, Eurostat, ECB, GDELT, ReliefWeb, NASA/NOAA/NSIDC climate datasets, Polymarket, RSS feeds, and selected OpenSky public paths.

## Audit rules

- A healthy container is not treated as proof that every optional provider is configured.
- A cache is considered successful only when its seeder logs `seed_complete` and verifies data persisted to Redis.
- Optional credentialed sources are reported as **unconfigured**, not failed, when their required credential is absent.
- Aggregated caches may succeed with a degraded sub-source; that is stated explicitly above.
- Provider values, Redis tokens, cookies, and response bodies are excluded from this report.
