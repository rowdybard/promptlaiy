const MAX_BODY_BYTES = 4_000;
const ALLOWED_TYPES = new Set(["pageview", "click"]);

function clean(value, maxLength) {
  return String(value || "")
    .replace(/\0/g, "")
    .trim()
    .slice(0, maxLength);
}

function noStore(status = 204) {
  return new Response(null, { status, headers: { "Cache-Control": "no-store" } });
}

async function hashIp(ip, salt) {
  if (!ip || !salt) return "";
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function hostOf(value) {
  const raw = clean(value, 300);
  if (!raw) return "";
  try {
    return new URL(raw).host.slice(0, 120);
  } catch {
    return "";
  }
}

function deviceFromUA(ua) {
  const value = String(ua || "").toLowerCase();
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/.test(value)) return "tablet";
  if (/mobi|iphone|ipod|android.*mobile|windows phone/.test(value)) return "mobile";
  return "desktop";
}

function normalizePath(value) {
  const raw = clean(value, 300);
  if (!raw.startsWith("/")) return "/";
  return raw.split(/[?#]/)[0].slice(0, 200) || "/";
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return noStore(204);
  if (!env.DB) return noStore(204);

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) return noStore(204);

  let payload;
  try {
    const body = await request.text();
    if (body.length > MAX_BODY_BYTES) return noStore(204);
    payload = JSON.parse(body);
  } catch {
    return noStore(204);
  }

  const type = clean(payload.type, 20);
  if (!ALLOWED_TYPES.has(type)) return noStore(204);

  const ipHash = await hashIp(request.headers.get("cf-connecting-ip"), env.ABUSE_SALT);

  if (ipHash) {
    const since = new Date(Date.now() - 60 * 1000).toISOString();
    const recent = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM analytics_events WHERE ip_hash = ? AND created_at >= ?"
    )
      .bind(ipHash, since)
      .first();
    if (Number(recent?.count || 0) >= 120) return noStore(204);
  }

  const sessionRaw = clean(payload.sessionId, 64);
  const sessionId = /^[a-zA-Z0-9-]{8,64}$/.test(sessionRaw) ? sessionRaw : "";

  try {
    await env.DB.prepare(
      `INSERT INTO analytics_events (
        id, type, path, target, referrer_host, utm_source, utm_medium,
        utm_campaign, session_id, country, device, ip_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        crypto.randomUUID(),
        type,
        normalizePath(payload.path),
        clean(payload.target, 120),
        hostOf(payload.referrer),
        clean(payload.utmSource, 60),
        clean(payload.utmMedium, 60),
        clean(payload.utmCampaign, 60),
        sessionId,
        clean(request.cf?.country, 4),
        deviceFromUA(request.headers.get("user-agent")),
        ipHash,
        new Date().toISOString()
      )
      .run();
  } catch {
    return noStore(204);
  }

  return noStore(204);
}
