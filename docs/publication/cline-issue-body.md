### GitHub Repository URL

https://github.com/AxelVerneBooks/threadflow-mcp

### Logo Image

(none yet — the sibling's `docs/logo/logo-400.png` pipeline can generate one before/at filing; the issue still installs without it)

### Installation Testing

- [x] I have tested that Cline can successfully set up this server using only the README.md and/or llms-install.md file
- [x] The server is stable and ready for public use

### Additional Information

threadflow-mcp — thread publishing discipline for AI agents: `validate_thread(posts)` runs deterministic per-post evidence checks (280-char platform limit, 25-post thread limit, empty/one-word posts, hook quality on post 1, links-on-final-post convention) and saves nothing; `draft_thread(posts)` validates AND registers the posts — blocking issues refuse the draft outright; `schedule_thread(posts, run_at, preflight?)` and `post_thread(posts, preflight?)` REFUSE any posts array that was never drafted, with an error naming the exact text. When the optional `preflight.offer.score` (from marketing-scope-mcp `score_offer`) is supplied, a score below 45/100 returns GATE REFUSED with the sibling's verbatim kill rule ("Below 45 out of 100 — rework the offer before spending anything on traffic").

Platform boundary (by design): the server holds NO X credentials — post_thread/schedule_thread clear and audit drafts; the authenticated platform POST executes in the separate ThreadFlow app's Twitter-authenticated path. Registries are in-memory (discipline records, not a scheduler daemon).

Setup requirements:
- Node.js ≥ 20. Install (pre-npm route, verified via fresh build on 2026-10-26): clone the repo, `npm ci && npm run build`, then the one-block mcpServers config in the README. npm package `threadflow-mcp` is in progress — NOT live at submission time; the repo-clone route is the verified install path.
- Two transports: stdio (default; no ports) or stateless Streamable HTTP (`--http --port 3003`). No API keys, no network calls at runtime, no telemetry.

Special notes for Marketplace users:
- Shortest verification: call `validate_thread(posts: ["Most people skip pre-flight discipline. Here's the checklist agents skip.", "Step 1: score the offer before anything ships."])` and expect JSON with `perPostChars` and `flags`.
- The 0.1.0 server.json will be published on the official MCP registry (`io.github.AxelVerneBooks/threadflow-mcp`) on the same publish day — update the listing note after `mcp-publisher publish` returns active.
- License: MIT. No telemetry. Local-only by default.
