/**
 * Integration test — launches the built stdio server and drives the full workflow:
 * validate_thread → draft_thread → schedule_thread/post_thread, including the
 * registry refusal and the pre-flight kill-rule gate.
 * Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { once } from "node:events";

const GOOD_THREAD = [
  "Most people fail their first launch because they skip pre-flight discipline. Here's the checklist agents skip.",
  "Step 1: score the offer before a single dollar or post leaves the building.",
  "Step 2: draft the thread against the validated registry.",
  "Step 3: publish with the auditor attached. https://axelverne.com/",
];

const SHORT_THREAD = ["hi"];

/** 3-post variant used by the HTTP regression probe (defined once, hoisted). */
const GOODS = [
  "Most people fail their first launch because they skip pre-flight discipline. Here's the checklist agents skip.",
  "Step 1: score the offer before a single dollar or post leaves the building.",
  "Step 3: publish with the auditor attached. https://axelverne.com/",
];

/** Minimal MCP stdio client for the test: JSON-RPC line responses per request id. */
class StdioMcpClient {
  #child;
  #buf = "";
  #pending = new Map();
  constructor(child) {
    this.#child = child;
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      this.#buf += chunk;
      let idx;
      while ((idx = this.#buf.indexOf("\n")) >= 0) {
        const line = this.#buf.slice(0, idx).trim();
        this.#buf = this.#buf.slice(idx + 1);
        if (!line) continue;
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          continue; // tolerate interleaved non-JSON lines (banner noise)
        }
        if (msg.id !== undefined && this.#pending.has(msg.id)) {
          this.#pending.get(msg.id)(msg);
          this.#pending.delete(msg.id);
        }
      }
    });
  }
  static spawn() {
    const child = spawn(process.execPath, [join(process.cwd(), "dist", "index.js")], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "inherit"],
    });
    return new this(child);
  }
  request(method, params, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const id = Math.floor(Math.random() * 1e9);
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`timeout waiting for ${method}`));
      }, timeoutMs);
      this.#pending.set(id, (msg) => {
        clearTimeout(timer);
        resolve(msg.result);
      });
      this.#child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  }
  notify(method, params) {
    this.#child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
  }
  async close() {
    this.#child.stdin.end();
    this.#child.kill();
    await once(this.#child, "exit").catch(() => {});
  }
}

function textPayload(result) {
  assert.ok(result?.content?.[0]?.text, `no text content in ${JSON.stringify(result)}`);
  return result.content[0].text;
}

async function initClient(client) {
  await client.request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "test-client", version: "0.0.1" },
  });
  client.notify("notifications/initialized", {});
}

async function callTool(client, name, args) {
  return client.request("tools/call", { name, arguments: args });
}

test("initialize + tools/list exposes the four workflow tools", async () => {
  const client = StdioMcpClient.spawn();
  try {
    await initClient(client);
    const tools = await client.request("tools/list", {});
    const names = tools.tools.map((t) => t.name).sort();
    assert.deepEqual(names, ["draft_thread", "post_thread", "schedule_thread", "validate_thread"]);
  } finally {
    await client.close();
  }
});

test("validate_thread flags without saving; draft refuses blocking posts", async () => {
  const client = StdioMcpClient.spawn();
  try {
    await initClient(client);

    // validate only, never saves
    const bad = JSON.parse(textPayload(await callTool(client, "validate_thread", { posts: SHORT_THREAD })));
    assert.ok(bad.flags.includes("no-hook") || bad.flags.includes("empty-post"), JSON.stringify(bad));

    // short thread should still register fine in a normal-length thread (hook > 20 chars)
    const good = JSON.parse(textPayload(await callTool(client, "validate_thread", { posts: GOOD_THREAD })));
    assert.equal(good.posts, 4);
    assert.equal(good.perPostChars.every((n) => n <= 280), true);
    assert.equal(good.flags.length, 0, JSON.stringify(good));

    // draft refuses blocking issue (275+ char post)
    const longPost = { posts: [GOOD_THREAD[0], "x".repeat(285)] };
    const longDraft = await callTool(client, "draft_thread", longPost);
    assert.equal(longDraft.isError, true);
    assert.match(textPayload(longDraft), /too-long/);
  } finally {
    await client.close();
  }
});

test("full workflow: draft → schedule/post (registry gates anything never drafted)", async () => {
  const client = StdioMcpClient.spawn();
  try {
    await initClient(client);

    // happy path: draft → post → schedule
    const drafted = JSON.parse(textPayload(await callTool(client, "draft_thread", { posts: GOOD_THREAD })));
    assert.match(drafted.draftId, /^d-/);

    const post = JSON.parse(textPayload(await callTool(client, "post_thread", { posts: GOOD_THREAD })));
    assert.equal(post.cleared, true);

    const sched = JSON.parse(textPayload(await callTool(client, "schedule_thread", { posts: GOOD_THREAD, run_at: "2026-10-28T16:00:00Z" })));
    assert.match(sched.scheduleId, /^s-/);
    assert.equal(sched.runAt, "2026-10-28T16:00:00.000Z");

    // THE HARD RULE: never-drafted text gets refused on both schedule + post
    const neverDrafted = [
      GOOD_THREAD[0],
      "somewhere this exact string slipped past draft_thread into post_thread's registry",
    ];
    const refused = await callTool(client, "post_thread", { posts: neverDrafted });
    assert.equal(refused.isError, true);
    assert.match(textPayload(refused), /never drafted/);
    const refusedSched = await callTool(client, "schedule_thread", { posts: neverDrafted, run_at: "2026-10-28T16:00:00Z" });
    assert.equal(refusedSched.isError, true);

    // bad ISO run_at refuses too
    const badDate = await callTool(client, "schedule_thread", { posts: GOOD_THREAD, run_at: "next tuesday-ish" });
    assert.equal(badDate.isError, true);
    assert.match(textPayload(badDate), /not a parseable ISO date/);
  } finally {
    await client.close();
  }
});

test("kill-rule gate: preflight score < 45 → GATE REFUSED with the sibling's verbatim rule", async () => {
  const client = StdioMcpClient.spawn();
  try {
    await initClient(client);
    await callTool(client, "draft_thread", { posts: GOOD_THREAD });

    // allow pass with strong score
    const pass = await callTool(client, "post_thread", {
      posts: GOOD_THREAD,
      preflight: { offer: { score: 82, grade: "A", scoredAt: new Date().toISOString() } },
    });
    assert.equal(JSON.parse(textPayload(pass)).cleared, true);

    // kill rule fires below 45
    const kill = await callTool(client, "schedule_thread", {
      posts: GOOD_THREAD,
      run_at: "2026-10-29T12:00:00Z",
      preflight: { offer: { score: 38, grade: "D" } },
    });
    assert.equal(kill.isError, true);
    const killText = textPayload(kill);
    assert.match(killText, /GATE REFUSED/);
    assert.match(killText, /Below 45 out of 100 — rework the offer before spending anything on traffic/);
  } finally {
    await client.close();
  }
});

test("stateless HTTP transport: second request works with no session (regression: transport-per-request)", async () => {
  const port = 42000 + Math.floor(Math.random() * 5000);
  const child = spawn(
    process.execPath,
    [join(process.cwd(), "dist", "index.js"), "--http", "--port", String(port)],
    { cwd: process.cwd(), env: { ...process.env }, stdio: ["ignore", "ignore", "inherit"] }
  );
  try {
    const base = `http://127.0.0.1:${port}/mcp`;
    let up = false;
    for (let i = 0; i < 40 && !up; i++) {
      try {
        await fetch(base, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 0, method: "ping", params: {} }) });
        up = true;
      } catch {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    assert.ok(up, `HTTP server on ${port} never opened`);

    const post = async (payload) =>
      fetch(base, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
        body: JSON.stringify(payload),
      });
    const parse = async (res) => {
      const t = await res.text();
      const dataLine = t.split("\n").find((l) => l.startsWith("data:"));
      return JSON.parse(dataLine ? dataLine.slice(5).trim() : t);
    };

    const init = await parse(await post({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "http-test", version: "0" } } }));
    assert.equal(init.result?.serverInfo?.name, "threadflow-mcp");

    // THE regression: further requests must NOT 500, even without any session
    const listed = await parse(await post({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }));
    assert.equal(listed.result?.tools?.length, 4, `tools/list broke: ${JSON.stringify(listed)}`);
    const call = await parse(await post({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "validate_thread", arguments: { posts: GOODS } },
    }));
    const report = JSON.parse(call.result.content[0].text);
    assert.ok(report.posts >= 1);
    assert.ok(Array.isArray(report.flags));
  } finally {
    child.kill();
    await once(child, "exit").catch(() => {});
  }
});
