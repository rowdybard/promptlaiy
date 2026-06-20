export function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function hashIp(ip, salt) {
  if (!ip || !salt) return "";
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function logFailedAttempt(env, ipHash) {
  if (!env.DB || !ipHash) return;
  try {
    await env.DB.prepare(
      "INSERT INTO security_log (id, ip_hash, path, reason, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
      .bind(crypto.randomUUID(), ipHash, "/api/admin", "admin_auth_fail", "", new Date().toISOString())
      .run();
  } catch {}
}

async function secureEqual(provided, expected) {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}

/**
 * Validates an admin request using a bearer token compared against env.ADMIN_TOKEN.
 * Returns { error: Response } on failure, or {} on success.
 * Includes brute-force protection: max 5 failed attempts per IP in 15 minutes.
 */
export async function requireAdmin(request, env) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) {
    return { error: json({ ok: false, error: "Origin not allowed." }, 403) };
  }
  if (!env.ADMIN_TOKEN) {
    return { error: json({ ok: false, error: "Admin access is not configured." }, 503) };
  }

  const ipHash = await hashIp(request.headers.get("cf-connecting-ip"), env.ABUSE_SALT);
  if (ipHash && env.DB) {
    try {
      const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const fails = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM security_log WHERE ip_hash = ? AND reason = 'admin_auth_fail' AND created_at >= ?"
      )
        .bind(ipHash, since)
        .first();
      if (Number(fails?.count || 0) >= 5) {
        return { error: json({ ok: false, error: "Too many failed attempts. Try again in 15 minutes." }, 429) };
      }
    } catch {}
  }

  const header = request.headers.get("authorization") || "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token || token.length > 256 || !(await secureEqual(token, env.ADMIN_TOKEN))) {
    await logFailedAttempt(env, ipHash);
    return { error: json({ ok: false, error: "Unauthorized." }, 401) };
  }

  return {};
}

const RANGES = {
  "1d": 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export function rangeDays(value) {
  return RANGES[value] || 7;
}
