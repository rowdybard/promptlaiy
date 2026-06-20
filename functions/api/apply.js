const LIMITS = {
  name: 100,
  email: 254,
  idea: 3000,
  audience: 1000,
  problem: 1000,
  alternative: 1000,
  urgency: 1000,
  smallestVersion: 1000,
  package: 40,
};

const MAX_BODY_BYTES = 16_000;
const ALLOWED_PACKAGES = new Set(["prototype", "domain", "unsure"]);
const GLOBAL_DAILY_CAP = 20;
const BLOCKED_EMAIL_DOMAINS = new Set([
  "guerrillamail.com", "guerrillamail.net", "guerrillamail.org",
  "tempmail.com", "tempmail.net", "temp-mail.org",
  "mailinator.com", "10minutemail.com", "throwaway.email",
  "yopmail.com", "getnada.com", "sharklasers.com",
  "guerrillamailblock.com", "dispostable.com", "fakeinbox.com",
]);

function countUrls(text) {
  return (String(text || "").match(/https?:\/\//gi) || []).length;
}

function clean(value, maxLength) {
  return String(value || "")
    .replace(/\0/g, "")
    .trim()
    .slice(0, maxLength);
}

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function hashIp(ip, salt) {
  if (!ip || !salt) return "";
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function signNotification(id, salt) {
  if (!salt) return "";
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(salt),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(id));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== requestUrl.origin) {
    return json({ ok: false, error: "Request origin is not allowed." }, 403);
  }

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json({ ok: false, error: "Content type must be application/json." }, 415);
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return json({ ok: false, error: "Request body is too large." }, 413);
  }

  let payload;
  try {
    const body = await request.text();
    if (body.length > MAX_BODY_BYTES) {
      return json({ ok: false, error: "Request body is too large." }, 413);
    }
    payload = JSON.parse(body);
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  if (payload.company || payload.website_url) return json({ ok: true });

  const data = Object.fromEntries(
    Object.entries(LIMITS).map(([key, limit]) => [key, clean(payload[key], limit)])
  );

  const minimums = {
    name: 2,
    email: 3,
    idea: 30,
    audience: 10,
    problem: 10,
    alternative: 10,
    urgency: 10,
    smallestVersion: 10,
  };
  if (Object.entries(minimums).some(([key, minimum]) => data[key].length < minimum)) {
    return json({ ok: false, error: "Complete every required field." }, 400);
  }
  if (!validEmail(data.email)) {
    return json({ ok: false, error: "Enter a valid email address." }, 400);
  }
  const emailDomain = data.email.split("@")[1]?.toLowerCase() || "";
  if (BLOCKED_EMAIL_DOMAINS.has(emailDomain)) {
    return json({ ok: false, error: "Please use a permanent email address." }, 400);
  }
  const totalUrls =
    countUrls(data.idea) + countUrls(data.audience) + countUrls(data.problem) +
    countUrls(data.alternative) + countUrls(data.urgency) + countUrls(data.smallestVersion);
  if (totalUrls > 3) {
    return json({ ok: false, error: "Too many links in your brief. Please remove them and try again." }, 400);
  }
  const submitTime = Number(payload.submitTime) || 0;
  if (submitTime > 0 && submitTime < 3) {
    return json({ ok: false, error: "Something went wrong. Please try again." }, 400);
  }
  if (!env.DB) {
    return json({ ok: false, error: "Applications are temporarily unavailable." }, 503);
  }

  const idempotencyKey = clean(payload.idempotencyKey, 64);
  const safeIdempotencyKey = /^[a-zA-Z0-9-]{16,64}$/.test(idempotencyKey)
    ? idempotencyKey
    : crypto.randomUUID();
  const existing = await env.DB.prepare(
    "SELECT id FROM prototype_requests WHERE idempotency_key = ? LIMIT 1"
  )
    .bind(safeIdempotencyKey)
    .first();
  if (existing?.id) {
    return json({
      ok: true,
      requestId: existing.id,
      notificationToken: await signNotification(existing.id, env.ABUSE_SALT),
    });
  }

  const ipHash = await hashIp(request.headers.get("cf-connecting-ip"), env.ABUSE_SALT);

  const todayStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const globalCount = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM prototype_requests WHERE created_at >= ?"
  )
    .bind(todayStart)
    .first();
  if (Number(globalCount?.count || 0) >= GLOBAL_DAILY_CAP) {
    return json({ ok: false, error: "We're at capacity for today. Please try again tomorrow." }, 429);
  }

  if (ipHash) {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recent = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM prototype_requests WHERE ip_hash = ? AND created_at >= ?"
    )
      .bind(ipHash, since)
      .first();
    if (Number(recent?.count || 0) >= 5) {
      return json({ ok: false, error: "Too many briefs were sent recently. Try again later." }, 429);
    }
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const userAgent = clean(request.headers.get("user-agent"), 300);
  const referrer = clean(request.headers.get("referer"), 300);
  const packageChoice = ALLOWED_PACKAGES.has(data.package) ? data.package : "unsure";
  const hostingInterest = Boolean(payload.hostingInterest);

  try {
    await env.DB.prepare(
      `INSERT INTO prototype_requests (
        id, name, email, idea, audience, problem, alternative, urgency,
        smallest_version, package_choice, hosting_interest, status,
        referrer, user_agent, created_at, idempotency_key, ip_hash,
        notification_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, 'pending_client')`
    )
      .bind(
        id,
        data.name,
        data.email.toLowerCase(),
        data.idea,
        data.audience,
        data.problem,
        data.alternative,
        data.urgency,
        data.smallestVersion,
        packageChoice,
        hostingInterest ? 1 : 0,
        referrer,
        userAgent,
        createdAt,
        safeIdempotencyKey,
        ipHash
      )
      .run();
  } catch (error) {
    const duplicate = await env.DB.prepare(
      "SELECT id FROM prototype_requests WHERE idempotency_key = ? LIMIT 1"
    )
      .bind(safeIdempotencyKey)
      .first();
    if (duplicate?.id) {
      return json({
        ok: true,
        requestId: duplicate.id,
        notificationToken: await signNotification(duplicate.id, env.ABUSE_SALT),
      });
    }
    console.error(
      JSON.stringify({
        event: "application_save_failed",
        error: error instanceof Error ? error.message : "Unknown database error",
      })
    );
    return json({ ok: false, error: "Could not save your brief. Please try again." }, 500);
  }

  return json({
    ok: true,
    requestId: id,
    notificationToken: await signNotification(id, env.ABUSE_SALT),
  });
}

function methodNotAllowed() {
  return json({ ok: false, error: "Method not allowed." }, 405);
}

export const onRequestGet = methodNotAllowed;
export const onRequestHead = methodNotAllowed;
export const onRequestPut = methodNotAllowed;
export const onRequestPatch = methodNotAllowed;
export const onRequestDelete = methodNotAllowed;
export const onRequestOptions = methodNotAllowed;
