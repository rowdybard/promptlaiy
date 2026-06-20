const MAX_BODY_BYTES = 16_000;

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

async function hashIp(ip, salt) {
  if (!ip || !salt) return "";
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function secureEqual(provided, expected) {
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  return crypto.subtle.timingSafeEqual(providedHash, expectedHash);
}

async function authorize(request, env) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return { error: json({ ok: false, error: "Request origin is not allowed." }, 403) };

  const requestId = clean(url.searchParams.get("requestId"), 64);
  const token = clean(url.searchParams.get("token"), 128);
  if (!/^[a-f0-9-]{36}$/.test(requestId) || !/^[a-f0-9]{64}$/.test(token) || !env.ABUSE_SALT) {
    return { error: json({ ok: false, error: "Invalid notification handoff." }, 403) };
  }

  const expected = await signNotification(requestId, env.ABUSE_SALT);
  if (!(await secureEqual(token, expected))) {
    return { error: json({ ok: false, error: "Invalid notification handoff." }, 403) };
  }

  return { requestId };
}

export async function onRequestPost({ request, env }) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json({ ok: false, error: "Content type must be application/json." }, 415);
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) return json({ ok: false, error: "Request body is too large." }, 413);

  const auth = await authorize(request, env);
  if (auth.error) return auth.error;
  if (!env.DB || !env.NOTIFY_ENDPOINT) {
    return json({ ok: false, error: "Notifications are temporarily unavailable." }, 503);
  }

  const ipHash = await hashIp(request.headers.get("cf-connecting-ip"), env.ABUSE_SALT);
  if (ipHash) {
    try {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const recent = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM security_log WHERE ip_hash = ? AND path = '/api/notify' AND created_at >= ?"
      )
        .bind(ipHash, since)
        .first();
      if (Number(recent?.count || 0) >= 10) {
        return json({ ok: false, error: "Rate limit exceeded. Try again later." }, 429);
      }
    } catch {}
  }

  const application = await env.DB.prepare(
    "SELECT notification_status FROM prototype_requests WHERE id = ? LIMIT 1"
  )
    .bind(auth.requestId)
    .first();
  if (!application) return json({ ok: false, error: "Application not found." }, 404);
  if (!["pending_client", "failed", "not_configured"].includes(application.notification_status)) {
    return json({ ok: false, error: "Notification handoff already used." }, 409);
  }

  await env.DB.prepare(
    `UPDATE prototype_requests
     SET notification_status = 'client_redirected', notification_error = ''
     WHERE id = ?`
  )
    .bind(auth.requestId)
    .run();

  return new Response(null, {
    status: 307,
    headers: {
      "Cache-Control": "no-store",
      Location: env.NOTIFY_ENDPOINT,
    },
  });
}

export async function onRequestPatch({ request, env }) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json({ ok: false, error: "Content type must be application/json." }, 415);
  }

  const auth = await authorize(request, env);
  if (auth.error) return auth.error;
  if (!env.DB) return json({ ok: false, error: "Notifications are temporarily unavailable." }, 503);

  const patchIpHash = await hashIp(request.headers.get("cf-connecting-ip"), env.ABUSE_SALT);
  if (patchIpHash) {
    try {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const recent = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM security_log WHERE ip_hash = ? AND path = '/api/notify' AND created_at >= ?"
      )
        .bind(patchIpHash, since)
        .first();
      if (Number(recent?.count || 0) >= 10) {
        return json({ ok: false, error: "Rate limit exceeded. Try again later." }, 429);
      }
    } catch {}
  }

  let payload;
  try {
    const body = await request.text();
    if (body.length > 2_000) return json({ ok: false, error: "Request body is too large." }, 413);
    payload = JSON.parse(body);
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  const message = clean(payload.message, 500);
  const success = payload.success === true;
  const awaitingActivation = success && /confirm|activation/i.test(message);
  const status = success ? (awaitingActivation ? "awaiting_activation" : "submitted") : "failed";
  const notifiedAt = status === "submitted" ? new Date().toISOString() : null;

  await env.DB.prepare(
    `UPDATE prototype_requests
     SET notification_status = ?, notification_error = ?, notified_at = ?
     WHERE id = ? AND notification_status = 'client_redirected'`
  )
    .bind(status, success && !awaitingActivation ? "" : message, notifiedAt, auth.requestId)
    .run();

  return json({ ok: true });
}

function methodNotAllowed() {
  return json({ ok: false, error: "Method not allowed." }, 405);
}

export const onRequestGet = methodNotAllowed;
export const onRequestHead = methodNotAllowed;
export const onRequestPut = methodNotAllowed;
export const onRequestDelete = methodNotAllowed;
export const onRequestOptions = methodNotAllowed;
