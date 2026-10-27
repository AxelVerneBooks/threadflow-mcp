/**
 * Thread validation — deterministic, explainable checks on one X/Twitter thread
 * (an ordered list of posts). Same philosophy as the sibling scorers: the checks
 * return WITH their evidence so the number is auditable rather than a vibe.
 *
 * Rules calibrated to X's own published limits:
 *   - 280 characters per post (the platform's standard limit)
 *   - 25 posts per thread (the platform's standard publishing limit)
 *
 * Flags returned: `too-long`, `too-few-posts`, `too-many-posts`, `empty-post`,
 * `no-hook`, `link-first-post`. An `issue` list carries the fixable problems.
 */

export interface ThreadIssue {
  post: number; // 1-indexed
  flag: string;
  detail: string;
}

export interface ThreadValidation {
  posts: number;
  totalChars: number;
  perPostChars: number[];
  flags: string[];
  issues: ThreadIssue[];
}

const MAX_POST_CHARS = 280;
const MIN_POSTS = 1;
const MAX_POSTS = 25;

export function validateThread(postsIn: string[]): ThreadValidation {
  const posts = postsIn.map((p) => p.trim()).filter((p) => p.length > 0);
  const perPostChars = posts.map((p) => [...p].length); // codepoint count, aligns with X's counting
  const totalChars = perPostChars.reduce((a, b) => a + b, 0);

  const issues: ThreadIssue[] = [];
  const flags = new Set<string>();

  if (posts.length > 0 && posts.length < MIN_POSTS) flags.add("too-few-posts");
  if (posts.length > MAX_POSTS) {
    flags.add("too-many-posts");
    issues.push({
      post: 0,
      flag: "too-many-posts",
      detail: `${posts.length} posts (platform limit ${MAX_POSTS})`,
    });
  }

  posts.forEach((post, i) => {
    const n = i + 1;
    if (perPostChars[i] > MAX_POST_CHARS) {
      flags.add("too-long");
      issues.push({ post: n, flag: "too-long", detail: `${perPostChars[i]} chars (limit ${MAX_POST_CHARS})` });
    }
    if (post.length < 8) {
      flags.add("empty-post");
      issues.push({ post: n, flag: "empty-post", detail: "post is shorter than a usable sentence" });
    }
  });

  if (posts.length > 0) {
    const first = posts[0];
    const hookOk =
      /^[a-z0-9'/]/i.test(first) || first.endsWith("?") || first.endsWith("!") || first.endsWith(":");
    if (!hookOk || first.length < 20) {
      flags.add("no-hook");
      issues.push({
        post: 1,
        flag: "no-hook",
        detail: "first post is shorter than 20 chars or opens with punctuation/link — it is the thread's frame, per the TIKTOK-style thumbnail rule",
      });
    }
    if (/https?:\/\//i.test(first)) {
      flags.add("link-first-post");
      issues.push({
        post: 1,
        flag: "link-first-post",
        detail: "links in post 1 bury the hook; convention (and this family's own launch threads) put links on the final post only",
      });
    }
  }

  return {
    posts: posts.length,
    totalChars,
    perPostChars,
    flags: [...flags],
    issues,
  };
}
