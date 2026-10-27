# Changelog

## 0.1.0 — 2026-10-26

Initial public release.

- `validate_thread` — per-post evidence checks (280-char limit, 25-post thread
  limit, empty posts, hook quality on post 1, links-on-final-post convention)
- `draft_thread` — validate + register; blocking issues refuse the draft
- `schedule_thread` — ISO-8601 future-run record; requires a registered draft
- `post_thread` — clearance/audit record; requires a registered draft
- **Kill-rule gate** — optional `preflight.offer.score`; below 45/100 returns
  the marketing-scope-mcp death-knell verbatim ("Below 45 out of 100 — rework
  the offer before spending anything on traffic") and schedules/posts nothing
- Dual transport: stdio + stateless Streamable HTTP (per-request transport,
  fresh-transport regression test inherited from the siblings' publish days)
- Platform boundary: no X credentials held here by design — the authenticated
  POST lives in the ThreadFlow app's Twitter-authenticated edge functions
