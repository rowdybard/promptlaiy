async function hashIp(ip, salt) {
  if (!ip || !salt) return "";
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function clean(value, maxLength) {
  return String(value || "").replace(/\0/g, "").trim().slice(0, maxLength);
}

async function logSuspicious(env, ipHash, path, reason, ua) {
  if (!env.DB) return;
  try {
    await env.DB.prepare(
      "INSERT INTO security_log (id, ip_hash, path, reason, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
      .bind(
        crypto.randomUUID(),
        ipHash,
        clean(path, 200),
        clean(reason, 100),
        clean(ua, 300),
        new Date().toISOString()
      )
      .run();
  } catch {}
}

export async function onRequestNext(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();
  const ua = request.headers.get("user-agent") || "";
  const path = new URL(request.url).pathname;

  if (ua.length < 10) {
    const ipHash = await hashIp(request.headers.get("cf-connecting-ip"), env.ABUSE_SALT);
    await logSuspicious(env, ipHash, path, "missing_or_short_ua", ua);
    return new Response(JSON.stringify({ ok: false, error: "Forbidden." }), {
      status: 403,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  if (method === "POST") {
    const fetchMode = request.headers.get("sec-fetch-mode") || "";
    if (!fetchMode) {
      const ipHash = await hashIp(request.headers.get("cf-connecting-ip"), env.ABUSE_SALT);
      await logSuspicious(env, ipHash, path, "missing_sec_fetch_mode", ua);
      return new Response(JSON.stringify({ ok: false, error: "Forbidden." }), {
        status: 403,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }
  }

  return context.next();
}
