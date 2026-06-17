const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

function extractToken(request) {
  const authorization = request.headers.get("authorization") || "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }
  return (request.headers.get("x-admin-token") || "").trim();
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

async function authorize(request, env) {
  const expected = String(env.ADMIN_TOKEN || "");
  if (!expected) {
    return { ok: false, status: 503, error: "ADMIN_TOKEN is not configured." };
  }

  const provided = extractToken(request);
  if (!provided) {
    return { ok: false, status: 401, error: "Missing admin token." };
  }

  const [expectedHash, providedHash] = await Promise.all([sha256(expected), sha256(provided)]);
  if (!constantTimeEqual(expectedHash, providedHash)) {
    return { ok: false, status: 401, error: "Invalid admin token." };
  }

  return { ok: true };
}

async function all(statement) {
  const result = await statement.all();
  return result.results || [];
}

function asCount(row) {
  return Number(row?.count || 0);
}

function windowDaysFromUrl(request) {
  const url = new URL(request.url);
  const days = Number(url.searchParams.get("days") || 30);
  if (!Number.isFinite(days)) return 30;
  return Math.min(90, Math.max(1, Math.round(days)));
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: jsonHeaders });
}

export async function onRequestGet({ request, env }) {
  const auth = await authorize(request, env);
  if (!auth.ok) {
    return jsonResponse({ ok: false, error: auth.error }, auth.status);
  }

  const windowDays = windowDaysFromUrl(request);
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  const [
    totalWaitlist,
    waitlistWindow,
    seoWaitlistTotal,
    eventsWindow,
    pageViewsWindow,
    lessonStartsWindow,
    lessonCompletionsWindow,
    lessonRetriesWindow,
    betaClicksWindow,
    topPages,
    eventsByName,
    lessonFunnel,
    waitlistBySource,
    waitlistByBeta,
    eventDaily,
    signupDaily,
    recentSignups,
    recentEvents,
  ] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS count FROM waitlist_signups").first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM waitlist_signups WHERE created_at >= ?").bind(since).first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM waitlist_signups WHERE source LIKE 'seo:%'").first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM product_events WHERE created_at >= ?").bind(since).first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM product_events WHERE event_name = 'page_view' AND created_at >= ?")
      .bind(since)
      .first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM product_events WHERE event_name = 'lesson_started' AND created_at >= ?")
      .bind(since)
      .first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM product_events WHERE event_name = 'lesson_completed' AND created_at >= ?")
      .bind(since)
      .first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM product_events WHERE event_name = 'lesson_retried' AND created_at >= ?")
      .bind(since)
      .first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM product_events WHERE event_name = 'paid_beta_clicked' AND created_at >= ?")
      .bind(since)
      .first(),
    all(
      env.DB.prepare(
        `SELECT page_path, source, COUNT(*) AS count
         FROM product_events
         WHERE event_name = 'page_view' AND created_at >= ? AND page_path <> ''
         GROUP BY page_path, source
         ORDER BY count DESC
         LIMIT 20`,
      ).bind(since),
    ),
    all(
      env.DB.prepare(
        `SELECT event_name, COUNT(*) AS count
         FROM product_events
         WHERE created_at >= ?
         GROUP BY event_name
         ORDER BY count DESC
         LIMIT 20`,
      ).bind(since),
    ),
    all(
      env.DB.prepare(
        `SELECT lesson_id,
                SUM(CASE WHEN event_name = 'lesson_started' THEN 1 ELSE 0 END) AS starts,
                SUM(CASE WHEN event_name = 'lesson_completed' THEN 1 ELSE 0 END) AS completions,
                SUM(CASE WHEN event_name = 'lesson_retried' THEN 1 ELSE 0 END) AS retries,
                SUM(CASE WHEN event_name = 'example_used' THEN 1 ELSE 0 END) AS examples
         FROM product_events
         WHERE lesson_id IS NOT NULL AND created_at >= ?
         GROUP BY lesson_id
         ORDER BY lesson_id ASC`,
      ).bind(since),
    ),
    all(
      env.DB.prepare(
        `SELECT source, COUNT(*) AS count
         FROM waitlist_signups
         GROUP BY source
         ORDER BY count DESC
         LIMIT 20`,
      ),
    ),
    all(
      env.DB.prepare(
        `SELECT beta_interest, COUNT(*) AS count
         FROM waitlist_signups
         WHERE beta_interest <> ''
         GROUP BY beta_interest
         ORDER BY count DESC
         LIMIT 20`,
      ),
    ),
    all(
      env.DB.prepare(
        `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS count
         FROM product_events
         WHERE created_at >= ?
         GROUP BY day
         ORDER BY day ASC`,
      ).bind(since),
    ),
    all(
      env.DB.prepare(
        `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS count
         FROM waitlist_signups
         WHERE created_at >= ?
         GROUP BY day
         ORDER BY day ASC`,
      ).bind(since),
    ),
    all(
      env.DB.prepare(
        `SELECT email, source, beta_interest, created_at, updated_at
         FROM waitlist_signups
         ORDER BY created_at DESC
         LIMIT 50`,
      ),
    ),
    all(
      env.DB.prepare(
        `SELECT event_name, lesson_id, beta_interest, source, page_path, created_at
         FROM product_events
         ORDER BY created_at DESC
         LIMIT 80`,
      ),
    ),
  ]);

  return jsonResponse({
    ok: true,
    generatedAt: new Date().toISOString(),
    windowDays,
    since,
    summary: {
      totalWaitlist: asCount(totalWaitlist),
      waitlistWindow: asCount(waitlistWindow),
      seoWaitlistTotal: asCount(seoWaitlistTotal),
      eventsWindow: asCount(eventsWindow),
      pageViewsWindow: asCount(pageViewsWindow),
      lessonStartsWindow: asCount(lessonStartsWindow),
      lessonCompletionsWindow: asCount(lessonCompletionsWindow),
      lessonRetriesWindow: asCount(lessonRetriesWindow),
      betaClicksWindow: asCount(betaClicksWindow),
    },
    targets: {
      waitlist: 100,
      lessonOneCompletions: 10,
      paidSignals: 3,
    },
    topPages,
    eventsByName,
    lessonFunnel,
    waitlistBySource,
    waitlistByBeta,
    eventDaily,
    signupDaily,
    recentSignups,
    recentEvents,
  });
}
