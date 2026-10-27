# Glama submission packet — threadflow-mcp

Modeled on both sibling packets (same directory pattern, same badge scan).
Glama grades the REPO, not a form: license / quality / maintenance badges.
Submission needs the **AxelVerneBooks** GitHub session ("Add MCP Server" →
authorize → point at the repo) — a signed-in browser step.

## Why the repo grades well already (badge map)

| Glama badge | What it checks | Our evidence |
|---|---|---|
| license | recognizable LICENSE | MIT LICENSE at root |
| quality | reproducible build + tests | `npm run build` (strict TS) + 5/5 integration tests; fresh build verified 2026-10-26 |
| maintenance | recent commits + CHANGELOG | dated CHANGELOG.md; initial commit f85e39a (2026-10-26) |

Docker note handled proactively: `docker/Dockerfile` exists at submission
time (the sibling needed it for Glama's follow-up step; this repo ships it
upfront, port 3003).

## Submission steps (needs signed-in browser, ~10 minutes)

1. Sign in to glama.ai with GitHub under **AxelVerneBooks**.
2. Directory → **"Add MCP Server"** → authorize → point it at
   `AxelVerneBooks/threadflow-mcp`. The indexer runs the scan itself.
3. Wait for the first index pass; check the listing for the three badges.
   Fix order if one is missing: license → quality → maintenance.
4. Edit the auto-generated listing text to the value prop below rather than
   leaving the README-scrape fallback.

⚠️ Sibling lesson: the GitHub OAuth authorize button can fail with a generic
"Something went wrong" 2–3× before succeeding (anti-clickjack enables the
button after ~20s). Retry patiently; don't abandon the flow.

## Metadata (paste when the form asks)

**One-sentence value prop:**

```
threadflow-mcp enforces thread publishing discipline: threads must pass
per-post evidence checks and a registered-draft gate before they can be
scheduled or posted, and any offer scoring below 45/100 is refused by the
pre-flight kill rule.
```

**Tool list (one-line each — matches src/index.ts exactly):**

- `validate_thread(posts)` — per-post evidence checks (280-char limit,
  25-post cap, empty posts, hook quality, links-on-final-post); saves nothing.
- `draft_thread(posts)` — validate + register; blocking issues refuse the
  draft outright.
- `schedule_thread(posts, run_at, preflight?)` — schedule a registered draft
  at an ISO-8601 UTC time; kill-rule gate enforced.
- `post_thread(posts, preflight?)` — clear + audit a registered draft;
  kill-rule gate enforced. Platform POST executes in the separate ThreadFlow
  app (no X credentials held here by design).

**Supported transport:** stdio (default; no ports) + stateless Streamable HTTP
(`--http --port 3003`, loopback — keep private or auth-proxy). Auth: none by
default (no env secrets required).

**Install/config example:**

```json
{ "mcpServers": { "threadflow": { "command": "node", "args": ["/path/to/dist/index.js"] } } }
```

**Docker:** `docker build -t threadflow-mcp -f docker/Dockerfile . && docker run -p 3003:3003 threadflow-mcp`

**Logo:** none yet — sibling's `docs/logo/build_logo.py` pipeline generates a
400×400 PNG if Glama asks at approval time.
**License:** MIT. **Maintenance contact:** via GitHub issues.

## Post-add verification

- Listing shows: badge trio, four tool descriptions (not truncated stubs),
  working install one-liner.
- If the auto-blurb scraped thin, the edit field is on the listing page itself.
- Registry status becomes verifiable on publish day
  (`/v0.1/servers?search=threadflow`) — expect Glama's "registry-listed"
  signal on the next index pass like both siblings'.
