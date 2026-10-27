# Publish runbook — threadflow-mcp

Third sibling on the proven pipeline (research-scope-mcp → marketing-scope-mcp →
threadflow-mcp). Carry-over lessons from both publish days:

1. **Namespace is CASE-SENSITIVE.** `server.json` name MUST be
   `io.github.AxelVerneBooks/threadflow-mcp` (camelCase to match the OAuth
   login exactly) or the registry returns 403.
2. **No placeholder remotes.** Never publish a `remotes[]` entry like
   `https://YOUR_HOST`.realm is not hosted yet, omit `remotes[]` and omit
   `packages[]` (registry validates declared npm identifiers exist).
3. **Device-code login is user-gated.** The user runs
   `~/bin/mcp-publisher login github`, says "code showing", types the code in
   the browser — the code never appears in chat or files.
4. **Stateless HTTP needs a fresh transport per request** (SDK throws
   "cannot be reused across requests" from request #2 otherwise). Guarded by
   the regression test in `test/server.test.mjs`.
5. **Smoke probe before publish (must keep working):**
   - stdio: `initialize` → `tools/list` → `tools/call draft_thread` returns
     a draftId; `post_thread` on never-drafted text returns the refusal.
   - HTTP: sessionless POST `/mcp` `initialize` → `tools/call` → 200 JSON.

## Order (sibling pipeline)

1. `npm test` green → git init & push to GitHub
   `AxelVerneBooks/threadflow-mcp` (public).
2. `mcp-publisher publish` (device code, user types it).
3. Verify via registry API: `GET /v0.1/servers?search=threadflow` (note the
   `/v0.1` prefix).
4. Directory packets: Cline marketplace issue, mcp.so issue, Glama
   "Add MCP Server → Runs from source" (expect a GitHub-OAuth retry or two).
5. Funnel tie-in: this is the distribution lever for the live ThreadFlow app —
   list the MCP server in the same catalogs already used for the two siblings,
   and route bio/reply traffic to the app.
