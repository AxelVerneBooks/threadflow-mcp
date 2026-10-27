# threadflow-mcp

**Thread publishing discipline for AI agents.** Draft an X/Twitter thread, get
the per-post evidence check, then enforce that ONLY a validated draft can be
scheduled or posted — with an optional pre-spend gate: when a
[`marketing-scope-mcp`](https://github.com/AxelVerneBooks/marketing-scope-mcp)
pre-flight score is supplied, an offer scoring **below 45/100 is refused** with
the sibling's own verbatim kill rule.

The sibling of both — [`research-scope-mcp`](https://github.com/AxelVerneBooks/research-scope-mcp)
(sources → citations) and `marketing-scope-mcp` (tactics → scored offers) —
extended from *planning* your campaign into *publishing* your threads.

## The discipline

```
validate_thread  →  draft_thread  →  schedule_thread / post_thread
   (evidence)         (registry)          (enforced gates)
```

1. **`validate_thread(posts[])`** — deterministic per-post checks with evidence:
   280-char platform limit, 25-post thread limit, empty/one-word posts, hook
   quality on post 1, and the links-on-final-post convention. Reads only; the
   registry is untouched.
2. **`draft_thread(posts[])`** — validate AND register the posts. Blocking
   issues (too-long, empty-post, too-many-posts) refuse the draft outright.
3. **`schedule_thread(posts[], run_at, preflight?)`** / **`post_thread(posts[], preflight?)`** —
   **refuse any posts array that was never drafted**, with an error naming the
   exact text. This is the thread-tool equivalent of the sibling's
   unscored-offer gate: no pre-flight → no publish.
4. **The kill-rule gate (the white space).** Pass the marketing server's
   `score_offer` result as `preflight.offer` and a score **< 45** comes back as:

   > `GATE REFUSED — pre-flight score 38/100 (grade D) is below the kill rule:
   > "Below 45 out of 100 — rework the offer before spending anything on
   > traffic."`

   **Honesty boundary, stated in the tool docs too:** the gate receives the
   score as a tool argument; it cannot cryptographically prove the sibling
   scorer produced it. It is only as strong as the agent chain that runs
   `score_offer` first — and the exact refusal text is written so the audit
   trail says precisely why a post was refused.
5. **Platform boundary, stated in the tool docs too:** this server holds no X
   credentials by design. `post_thread` / `schedule_thread` clear and audit a
   draft; the authenticated platform POST happens in the
   [ThreadFlow app](https://github.com/AxelVerneBooks/threadflow)'s
   Twitter-authenticated path (`SUPABASE_*` edge functions), never here.

## Install

Node ≥ 20.

```bash
npm install -g threadflow-mcp
# or run from source:
git clone https://github.com/AxelVerneBooks/threadflow-mcp
cd threadflow-mcp && npm install && npm run build
```

### Claude Code

```bash
claude mcp add threadflow -- node /path/to/dist/index.js
```

### Cursor (`.cursor/mcp.json`)

```json
{ "mcpServers": { "threadflow": { "command": "node", "args": ["/path/to/dist/index.js"] } } }
```

### Streamable HTTP

```bash
node dist/index.js --http --port 3003        # serves MCP at http://127.0.0.1:3003/mcp
```

### Docker

```bash
docker build -t threadflow-mcp -f docker/Dockerfile .
docker run -d --name threadflow -p 3003:3003 threadflow-mcp
# MCP at http://127.0.0.1:3003/mcp
```

The draft/schedule registries are **in-memory** (lost on restart — re-draft
before finalizing); this is workflow discipline, not a scheduler daemon.

## Example session

```text
> validate_thread(posts: [...])
  → per-post char counts, flags, issue list — none saved

> draft_thread(posts: [...])
  → draftId d-1a2b + validation report (blocking issues refuse the draft)

> post_thread(posts: [same exact text],
                preflight: { score_offer(...) })
  → 82/100 (A)  → cleared, audited
  → 38/100 (D)  → GATE REFUSED, verbatim kill rule

> schedule_thread(posts: [...], run_at: "2026-10-28T16:00:00Z")
  → scheduleId s-3c4d, pending (dispatch happens in the ThreadFlow app)
```

## The chained workflow (the product story)

```
marketing-scope-mcp score_offer  →  threadflow-mcp draft_thread  →  post_thread
        (whether)                        (what)                      (when/gate)
```

An agent runs `score_offer`, drafts the thread, and threads the score through
`preflight` — the same enforced-discipline white space the marketing server
occupies, extended from planning to publishing.

## License

MIT — see [LICENSE](LICENSE).
