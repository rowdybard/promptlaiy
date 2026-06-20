const MAX_BODY_BYTES = 2_000;

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
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

async function hashIp(ip, salt) {
  if (!ip || !salt) return "";
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) {
    return json({ ok: false, error: "Origin not allowed." }, 403);
  }
  if (!env.DB) {
    return json({ ok: false, error: "Subscriptions are temporarily unavailable." }, 503);
  }

  let payload;
  try {
    const body = await request.text();
    if (body.length > MAX_BODY_BYTES) return json({ ok: false, error: "Body too large." }, 413);
    payload = JSON.parse(body);
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  if (payload.company) return json({ ok: true });

  const email = clean(payload.email, 254);
  if (!validEmail(email)) {
    return json({ ok: false, error: "Enter a valid email address." }, 400);
  }

  const source = clean(payload.source, 100);
  const ipHash = await hashIp(request.headers.get("cf-connecting-ip"), env.ABUSE_SALT);

  if (ipHash) {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recent = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM subscribers WHERE ip_hash = ? AND created_at >= ?"
    )
      .bind(ipHash, since)
      .first();
    if (Number(recent?.count || 0) >= 3) {
      return json({ ok: false, error: "Too many subscriptions from this address." }, 429);
    }
  }

  try {
    await env.DB.prepare(
      "INSERT INTO subscribers (id, email, source, ip_hash, created_at) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(crypto.randomUUID(), email, source, ipHash, new Date().toISOString())
      .run();
  } catch (err) {
    if (String(err?.message || "").includes("UNIQUE")) {
      return json({ ok: true, alreadySubscribed: true });
    }
    return json({ ok: false, error: "Could not subscribe. Please try again." }, 500);
  }

  return json({ ok: true });
}
