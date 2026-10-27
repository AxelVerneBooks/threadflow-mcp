/**
 * threadflow-mcp — MCP server (v0.1.0)
 *
 * X/Twitter thread workflow: validate a thread's posts (explainable, per-post
 * evidence), then enforce that ONLY a validated thread can be scheduled or
 * posted. When a marketing pre-flight score (from the sibling
 * marketing-scope-mcp `score_offer`) is supplied, posting a thread whose offer
 * scores below 45/100 is refused with the sibling's verbatim kill rule.
 *
 * Transports:
 *   - stdio (default):  `node dist/index.js`
 *   - Streamable HTTP:  `node dist/index.js --http --port 3003`
 *
 * Tools:
 *   validate_thread(posts[])                     -> per-post evidence report
 *   draft_thread(posts[])                        -> validate + register (unsaved posts rejected downstream)
 *   schedule_thread(posts[], run_at, preflight?) -> requires a validated draft; kill-rule gate
 *   post_thread(posts[], preflight?)             -> requires a validated draft; kill-rule gate
 */

import { randomUUID } from "node:crypto";
import { createServer as createHttpServer } from "node:http";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

import { validateThread, type ThreadValidation } from "./thread/validate.js";
import { version } from "./version.js";

/* ------------------------------------------------------------------ */
/* registries (module scope — shared by every server instance)         */
/* ------------------------------------------------------------------ */

interface DraftRecord {
  draftId: string;
  posts: string[];
  validation: ThreadValidation;
  draftedAt: string;
}

interface ScheduledRecord {
  scheduleId: string;
  draftId: string;
  runAt: string;
  scheduledAt: string;
}

const drafts = new Map<string, DraftRecord>();
const schedules = new Map<string, ScheduledRecord>();

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/** Kill rule — the sibling server's first criterion, verbatim. */
export const KILL_RULE =
  "Below 45 out of 100 — rework the offer before spending anything on traffic.";

/**
 * Enforce the pre-flight gate on a user-supplied score object.
 *
 * HONESTY BOUNDARY (documented, not hidden): this server cannot prove the score
 * object was produced by marketing-scope-mcp's `score_offer` — it receives the
 * number over a tool argument. The gate is only as strong as the agent chain
 * that runs the sibling scorer first. The refusal text quotes the kill rule so
 * the audit trail says exactly why the post was refused.
 */
function checkPreflight(
  preflight: { offer?: { score: number; grade?: string; scoredAt?: string } } | undefined
): string | null {
  const score = preflight?.offer?.score;
  if (score === undefined) return null; // no preflight supplied -> gate not engaged (allowed in open mode)
  if (typeof score !== "number" || Number.isNaN(score)) return "preflight.offer.score must be a number";
  if (score < 45) {
    return `GATE REFUSED — pre-flight score ${score}/100 (grade ${
      preflight?.offer?.grade ?? "?"
    }) is below the kill rule: "${KILL_RULE}"`;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* server                                                              */
/* ------------------------------------------------------------------ */

function buildServer(): McpServer {
  const server: McpServer = new McpServer(
    { name: "threadflow-mcp", version },
    {
      instructions:
        "X/Twitter thread workflow: draft threads as ordered post arrays, validate_thread first, then post_thread or schedule_thread on the SAME validated text. Never schedule a thread that was never drafted — the registry refuses it. When a marketing pre-flight score is available (from marketing-scope-mcp score_offer), pass it; the kill rule refuses posting offers below 45/100.",
    }
  );

  const postList = z
    .array(z.string().min(1))
    .min(1)
    .max(25)
    .describe("The thread posts in order. Post 1 is the hook/frame — links belong on the FINAL post, per convention.");

  /* --- tool 1: validate_thread -------------------------------------- */

  server.registerTool(
    "validate_thread",
    {
      title: "Validate a thread",
      description:
        "Run the per-post evidence check on a draft thread WITHOUT saving anything: 280-char platform limit per post, 25-post thread limit, empty-post detection, hook quality on post 1, and the links-on-final-post convention. Returns flags + an issue list WITH per-post evidence. Side effect: none (the registry only accepts drafts made with draft_thread).",
      inputSchema: { posts: postList },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ posts }) => {
      return { content: [{ type: "text" as const, text: JSON.stringify(validateThread(posts), null, 2) }] };
    }
  );

  /* --- tool 2: draft_thread ----------------------------------------- */

  server.registerTool(
    "draft_thread",
    {
      title: "Draft a thread",
      description:
        "Validate a thread AND register the validated posts in the in-memory draft registry (keyed by the exact joined text; lost on restart — re-draft before finalizing). Returns the draftId and the validation report. post_thread/schedule_thread REJECT any posts array that was never drafted, with an error naming the exact text — the thread equivalent of the sibling's unscored-offer gate.",
      inputSchema: { posts: postList },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ posts }) => {
      const validation = validateThread(posts);
      const blocking = validation.issues.filter((i) =>
        ["too-long", "empty-post", "too-many-posts"].includes(i.flag)
      );
      if (blocking.length) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Thread has blocking issues — fix and re-draft:\n${blocking
                .map((i) => `post ${i.post}: [${i.flag}] ${i.detail}`)
                .join("\n")}`,
            },
          ],
        };
      }
      const draftId = `d-${randomUUID().slice(0, 4).toLowerCase()}`;
      drafts.set(posts.map((p) => p.trim()).join("\n\n"), { draftId, posts, validation, draftedAt: new Date().toISOString() });
      return { content: [{ type: "text" as const, text: JSON.stringify({ draftId, validation }, null, 2) }] };
    }
  );

  const preflightSchema = z
    .object({
      offer: z
        .object({
          score: z.number().min(0).max(100).describe("score_offer's 0–100 number (marketing-scope-mcp)"),
          grade: z.string().optional().describe("score_offer's letter grade"),
          offerId: z.string().optional().describe("score_offer's offerId, for the audit trail"),
          scoredAt: z.string().optional().describe("score_offer's scoredAt timestamp"),
        })
        .optional()
        .describe("Pre-flight result for the offer this thread pitches. Score < 45 triggers the kill-rule refusal."),
    })
    .optional();

  /* --- tool 3: schedule_thread ------------------------------------- */

  server.registerTool(
    "schedule_thread",
    {
      title: "Schedule a thread",
      description:
        "Schedule a VALIDATED draft to run at an ISO-8601 UTC time. Requires the exact posts to have been drafted with draft_thread first (the registry refuses unvalidated text). Accepts the optional marketing pre-flight score — score < 45 returns the kill-rule refusal and schedules nothing. In-memory only (lost on restart); this is workflow discipline, not a scheduler daemon.",
      inputSchema: {
        posts: postList,
        run_at: z.string().describe("ISO-8601 timestamp when the thread should fire, e.g. 2026-10-28T16:00:00Z"),
        preflight: preflightSchema,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ posts, run_at, preflight }) => {
      const key = posts.map((p) => p.trim()).join("\n\n");
      if (!drafts.has(key)) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Refused — these posts were never drafted with draft_thread (registry enforces validated drafts).\nrun draft_thread on this exact text first:\n${key.slice(0, 120)}${key.length > 120 ? "…" : ""}`,
            },
          ],
        };
      }
      const runAt = new Date(run_at);
      if (Number.isNaN(runAt.getTime())) {
        return { isError: true, content: [{ type: "text" as const, text: `run_at is not a parseable ISO date: "${run_at}"` }] };
      }
      const gate = checkPreflight(preflight as { offer?: { score: number; grade?: string; scoredAt?: string } } | undefined);
      if (gate) {
        return { isError: true, content: [{ type: "text" as const, text: gate }] };
      }
      const scheduleId = `s-${randomUUID().slice(0, 4).toLowerCase()}`;
      schedules.set(scheduleId, { scheduleId, draftId: drafts.get(key)!.draftId, runAt: runAt.toISOString(), scheduledAt: new Date().toISOString() });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { scheduleId, draftId: drafts.get(key)!.draftId, runAt: runAt.toISOString(), pending: true, note: "Discipline record only — dispatch happens in the ThreadFlow app/worker, not here." },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  /* --- tool 4: post_thread ----------------------------------------- */

  server.registerTool(
    "post_thread",
    {
      title: "Post a thread",
      description:
        "Mark a VALIDATED draft as cleared to post NOW. Requires the exact posts to have been drafted with draft_thread first (refuses unvalidated text) and honors the optional pre-flight kill-rule gate (score < 45 -> refusal, verbatim sibling rule). This tool records the audit line; the actual platform POST is executed by the ThreadFlow app's authenticated path — this server holds no X credentials by design.",
      inputSchema: { posts: postList, preflight: preflightSchema },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ posts, preflight }) => {
      const key = posts.map((p) => p.trim()).join("\n\n");
      if (!drafts.has(key)) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Refused — these posts were never drafted with draft_thread (registry enforces validated drafts).\nrun draft_thread on this exact text first:\n${key.slice(0, 120)}${key.length > 120 ? "…" : ""}`,
            },
          ],
        };
      }
      const gate = checkPreflight(preflight as { offer?: { score: number; grade?: string; scoredAt?: string } } | undefined);
      if (gate) {
        return { isError: true, content: [{ type: "text" as const, text: gate }] };
      }
      const draft = drafts.get(key)!;
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { cleared: true, draftId: draft.draftId, posts: draft.posts.length, clearedAt: new Date().toISOString(), dispatch: "ThreadFlow app executes the authenticated POST" },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  return server;
}

// stdio keeps one long-lived server for the process lifetime.
const server: McpServer = buildServer();

/* ------------------------------------------------------------------ */
/* transports                                                          */
/* ------------------------------------------------------------------ */

async function runStdio(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function runHttp(port: number): void {
  // Stateless Streamable HTTP: fresh server + transport per request (the
  // sibling project's published regression lesson — a reused stateless
  // transport 500s from the second request on). Module-scope registries
  // keep state.
  const httpServer = createHttpServer((req, res) => {
    void (async () => {
      try {
        const requestServer = buildServer();
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        res.on("close", () => {
          void transport.close();
          if (requestServer) {
            void requestServer.close();
          }
        });
        await requestServer.connect(transport);
        await transport.handleRequest(req, res);
      } catch (err) {
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
        }
        const payload = JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: (err as Error).message } });
        if (!res.writableEnded) {
          res.end(payload);
        } else {
          res.destroy();
        }
      }
    })();
  });
  httpServer.listen(port, () => {
    const addr = httpServer.address();
    const bound = typeof addr === "object" && addr ? `${addr.address}:${addr.port}` : String(port);
    console.error(`threadflow-mcp ${version} listening (Streamable HTTP) on http://${bound}/mcp`);
  });
}

/* --- entry -------------------------------------------------------- */

const args = process.argv.slice(2);
if (args.includes("--http")) {
  const portIdx = args.indexOf("--port");
  const port = portIdx >= 0 ? Number(args[portIdx + 1]) || 3003 : Number(process.env.PORT) || 3003;
  runHttp(port);
} else {
  runStdio().catch((err) => {
    console.error("stdio transport failed:", err);
    process.exit(1);
  });
}
