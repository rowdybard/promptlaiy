import { json, requireAdmin, rangeDays } from "./_auth.js";

function isoDaysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function windowTotals(db, start, end) {
  const events = await db
    .prepare(
      `SELECT
         SUM(CASE WHEN type = 'pageview' THEN 1 ELSE 0 END) AS pageviews,
         SUM(CASE WHEN type = 'click' THEN 1 ELSE 0 END) AS clicks,
         COUNT(DISTINCT CASE WHEN session_id != '' THEN session_id END) AS sessions
       FROM analytics_events
       WHERE created_at >= ? AND created_at < ?`
    )
    .bind(start, end)
    .first();

  const applies = await db
    .prepare("SELECT COUNT(*) AS count FROM prototype_requests WHERE created_at >= ? AND created_at < ?")
    .bind(start, end)
    .first();

  return {
    pageviews: Number(events?.pageviews || 0),
    clicks: Number(events?.clicks || 0),
    sessions: Number(events?.sessions || 0),
    applies: Number(applies?.count || 0),
  };
}

async function rows(db, sql, ...bind) {
  const result = await db.prepare(sql).bind(...bind).all();
  return result.results || [];
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;
  if (!env.DB) return json({ ok: false, error: "Database unavailable." }, 503);

  const url = new URL(request.url);
  const days = rangeDays(url.searchParams.get("range"));
  const now = new Date().toISOString();
  const start = isoDaysAgo(days);
  const prevStart = isoDaysAgo(days * 2);

  const [current, previous] = await Promise.all([
    windowTotals(env.DB, start, now),
    windowTotals(env.DB, prevStart, start),
  ]);

  const timeseries = await rows(
    env.DB,
    `SELECT substr(created_at, 1, 10) AS day,
            SUM(CASE WHEN type = 'pageview' THEN 1 ELSE 0 END) AS pageviews,
            SUM(CASE WHEN type = 'click' THEN 1 ELSE 0 END) AS clicks,
            COUNT(DISTINCT CASE WHEN session_id != '' THEN session_id END) AS sessions
     FROM analytics_events
     WHERE created_at >= ?
     GROUP BY day
     ORDER BY day ASC`,
    start
  );

  const topPaths = await rows(
    env.DB,
    `SELECT path AS label, COUNT(*) AS count
     FROM analytics_events
     WHERE type = 'pageview' AND created_at >= ?
     GROUP BY path ORDER BY count DESC LIMIT 12`,
    start
  );

  const topReferrers = await rows(
    env.DB,
    `SELECT referrer_host AS label, COUNT(*) AS count
     FROM analytics_events
     WHERE type = 'pageview' AND referrer_host != '' AND created_at >= ?
     GROUP BY referrer_host ORDER BY count DESC LIMIT 12`,
    start
  );

  const topClicks = await rows(
    env.DB,
    `SELECT target AS label, COUNT(*) AS count
     FROM analytics_events
     WHERE type = 'click' AND target != '' AND created_at >= ?
     GROUP BY target ORDER BY count DESC LIMIT 12`,
    start
  );

  const devices = await rows(
    env.DB,
    `SELECT device AS label, COUNT(*) AS count
     FROM analytics_events
     WHERE type = 'pageview' AND created_at >= ?
     GROUP BY device ORDER BY count DESC LIMIT 12`,
    start
  );

  const countries = await rows(
    env.DB,
    `SELECT CASE WHEN country = '' THEN 'Unknown' ELSE country END AS label, COUNT(*) AS count
     FROM analytics_events
     WHERE type = 'pageview' AND created_at >= ?
     GROUP BY label ORDER BY count DESC LIMIT 12`,
    start
  );

  const sources = await rows(
    env.DB,
    `SELECT CASE WHEN utm_source = '' THEN 'direct / organic' ELSE utm_source END AS label, COUNT(*) AS count
     FROM analytics_events
     WHERE type = 'pageview' AND created_at >= ?
     GROUP BY label ORDER BY count DESC LIMIT 12`,
    start
  );

  return json({
    ok: true,
    range: `${days}d`,
    generatedAt: now,
    totals: current,
    previous,
    timeseries: timeseries.map((r) => ({
      day: r.day,
      pageviews: Number(r.pageviews || 0),
      clicks: Number(r.clicks || 0),
      sessions: Number(r.sessions || 0),
    })),
    topPaths,
    topReferrers,
    topClicks,
    devices,
    countries,
    sources,
  });
}
