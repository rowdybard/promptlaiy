import { json, requireAdmin } from "./_auth.js";

const ALLOWED_STATUS = new Set(["new", "contacted", "won", "lost", "archived"]);
const ALLOWED_PACKAGE = new Set(["prototype", "domain", "unsure"]);

function clean(value, maxLength) {
  return String(value || "").replace(/\0/g, "").trim().slice(0, maxLength);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;
  if (!env.DB) return json({ ok: false, error: "Database unavailable." }, 503);

  const url = new URL(request.url);
  const status = clean(url.searchParams.get("status"), 20);
  const pkg = clean(url.searchParams.get("package"), 20);
  const q = clean(url.searchParams.get("q"), 100);
  const from = clean(url.searchParams.get("from"), 30);
  const to = clean(url.searchParams.get("to"), 30);
  const hosting = clean(url.searchParams.get("hosting"), 5);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 100);
  const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);

  const where = [];
  const binds = [];
  if (ALLOWED_STATUS.has(status)) {
    where.push("status = ?");
    binds.push(status);
  }
  if (ALLOWED_PACKAGE.has(pkg)) {
    where.push("package_choice = ?");
    binds.push(pkg);
  }
  if (hosting === "yes" || hosting === "no") {
    where.push("hosting_interest = ?");
    binds.push(hosting === "yes" ? 1 : 0);
  }
  if (from) {
    where.push("created_at >= ?");
    binds.push(from);
  }
  if (to) {
    where.push("created_at <= ?");
    binds.push(to);
  }
  if (q) {
    const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    where.push("(name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR idea LIKE ? ESCAPE '\\')");
    binds.push(like, like, like);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await env.DB.prepare(`SELECT COUNT(*) AS count FROM prototype_requests ${whereSql}`)
    .bind(...binds)
    .first();

  const listResult = await env.DB.prepare(
    `SELECT id, name, email, idea, audience, problem, alternative, urgency,
            smallest_version, package_choice, hosting_interest, status,
            notification_status, notification_error, notified_at,
            referrer, user_agent, created_at
     FROM prototype_requests ${whereSql}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`
  )
    .bind(...binds, limit, offset)
    .all();

  const statusFacet = await env.DB.prepare(
    "SELECT status AS label, COUNT(*) AS count FROM prototype_requests GROUP BY status"
  ).all();
  const packageFacet = await env.DB.prepare(
    "SELECT package_choice AS label, COUNT(*) AS count FROM prototype_requests GROUP BY package_choice"
  ).all();

  return json({
    ok: true,
    total: Number(totalRow?.count || 0),
    limit,
    offset,
    replies: listResult.results || [],
    facets: {
      status: statusFacet.results || [],
      package: packageFacet.results || [],
    },
  });
}

export async function onRequestPatch(context) {
  const { request, env } = context;
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;
  if (!env.DB) return json({ ok: false, error: "Database unavailable." }, 503);

  let payload;
  try {
    const body = await request.text();
    if (body.length > 2_000) return json({ ok: false, error: "Body too large." }, 413);
    payload = JSON.parse(body);
  } catch {
    return json({ ok: false, error: "Invalid body." }, 400);
  }

  const id = clean(payload.id, 64);
  const status = clean(payload.status, 20);
  if (!/^[a-f0-9-]{36}$/.test(id)) return json({ ok: false, error: "Invalid id." }, 400);
  if (!ALLOWED_STATUS.has(status)) return json({ ok: false, error: "Invalid status." }, 400);

  const result = await env.DB.prepare("UPDATE prototype_requests SET status = ? WHERE id = ?")
    .bind(status, id)
    .run();

  if (!result.meta?.changes) return json({ ok: false, error: "Reply not found." }, 404);
  return json({ ok: true, id, status });
}
