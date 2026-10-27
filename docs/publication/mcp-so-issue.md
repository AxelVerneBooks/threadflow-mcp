# mcp.so submission issue — ready to paste (repo: `chatmcp/mcpso`)

Modeled on the marketing-scope-mcp packet (its issue used this exact format;
sibling packets verified working). Plain issue, no template: **name,
description, features, connection information.**

**Open:** https://github.com/chatmcp/mcpso/issues/new

## Title

```
[Server Submission] threadflow-mcp — thread publishing discipline MCP server (validate / draft / schedule / post)
```

## Body (paste everything between the rules)

```
# threadflow-mcp

**Repository:** https://github.com/AxelVerneBooks/threadflow-mcp
**License:** MIT · **Language:** TypeScript (Node ≥ 20) · **Registry manifest:** server.json, valid against the official MCP registry (2025-12-11 schema)

## Description

threadflow-mcp is a thread publishing discipline server for X/Twitter. It
enforces that a thread was validated and registered before it can be scheduled
or posted: the registry refuses never-drafted text, blocking issues refuse the
draft outright, and when a marketing pre-flight score is supplied
(marketing-scope-mcp `score_offer`), an offer scoring below 45/100 returns
GATE REFUSED with that sibling's verbatim kill rule. The thread-tool analog of
an unscored-offer gate: no validated draft, no publish. Sister server to
research-scope-mcp (sources → citations) and marketing-scope-mcp (tactics →
scored offers), extended from planning a campaign into publishing its threads.

## Features (4 tools)

- `validate_thread(posts)` — deterministic per-post checks WITH evidence:
  280-char platform limit, 25-post thread limit, empty posts, hook quality on
  post 1, links-on-final-post convention. Read-only; nothing saved
- `draft_thread(posts)` — validate AND register; blocking issues refuse;
  returns draftId + the validation report
- `schedule_thread(posts, run_at, preflight?)` — ISO-8601 future-run record on
  a registered draft; kill-rule gate honored end-to-end
- `post_thread(posts, preflight?)` — clearance/audit record on a registered
  draft; kill-rule gate honored end-to-end. NO X credentials held here by
  design — the authenticated POST executes in the separate ThreadFlow app

## Connection info

stdio (default, no ports, most clients):

    node dist/index.js          # after clone + npm ci && npm run build

Streamable HTTP (optional, loopback, stateless per-request transport):

    node dist/index.js --http --port 3003   →  http://localhost:3003/mcp

Client config (stdio-capable clients — Claude Code, Cursor, Cline):

    { "mcpServers": { "threadflow": { "command": "node", "args": ["/path/to/dist/index.js"] } } }

npm package `threadflow-mcp` in progress — the repo-clone route above is the
verified install path (fresh build + 5/5 integration tests verified
2026-10-26). No API keys, no network calls, no telemetry; registries are
in-memory by design (re-draft before finalizing).

## Notes

- The registry manifest `io.github.AxelVerneBooks/threadflow-mcp` v0.1.0 will
  be published on the official MCP registry on the same publish day — verify
  via /v0.1/servers?search=threadflow and update this note when active.
- Verify the install in one ask: call `validate_thread` and expect JSON with
  `perPostChars` + `flags`.
- Maintenance: issues at the repo; CHANGELOG.md is dated and version-pinned.
```

---

## Post-submission notes (do not paste)

- Filing needs any GitHub account; repo URL is live.
- When npm publishes, one follow-up comment replaces the "in progress" line
  (both siblings' precedent: the indexing pass followed the npm-live update).
