# Publish-day checklist — threadflow-mcp

Everything below is staged from the siblings' two publish days. Do the steps
in this order; nothing here requires secrets in chat — the only user-gated
input is the device code on step 3.

## Status

- [x] `npm test` green (5/5) — build + suite verified 2026-10-26
- [x] git repo initialized, committed (f85e39a), pushed
- [x] GitHub repo public: https://github.com/AxelVerneBooks/threadflow-mcp
- [x] Directory packets written: `cline-issue-body.md`, `mcp-so-issue.md`,
      `glama-submission.md`
- [ ] npm publish (`npm publish` — after the registry entry, per sibling order)
- [ ] Registry verify: `GET /v0.1/servers?search=threadflow` → expect
      `io.github.AxelVerneBooks/threadflow-mcp`, status active
- [ ] Glama listing (browser, AxelVerneBooks session) — packet ready
- [ ] Cline marketplace issue (paste `cline-issue-body.md`)
- [ ] mcp.so issue (paste `mcp-so-issue.md`)
- [ ] npm-live follow-up comment on the mcp.so issue once package is up
- [ ] Funnel tie-in after listings: add the MCP-server mention to the
      ThreadFlow app's launch materials (Track B / attribution-loop plan)

## Step commands (local)

```bash
# 1. registry publish (user-gated device code)
~/bin/mcp-publisher login github    # user types the code in the browser
~/bin/mcp-publisher publish         # from the repo root (server.json is here)

# 2. verify (note the /v0.1 prefix — sibling lesson)
curl -s "https://registry.modelcontextprotocol.io/v0.1/servers?search=threadflow"

# 3. npm (after registry entry is active)
npm publish
```

## Hard rules (carried from PUBLISH.md)

1. `server.json` name is case-sensitive:
   `io.github.AxelVerneBooks/threadflow-mcp` — already correct.
2. No placeholder `remotes[]` / `packages[]` — omitted, matching the siblings.
3. Device code never appears in chat or files.
4. Smoke probe must pass before publish (see smoke-probe.md).
