export function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
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

  const header = request.headers.get("authorization") || "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token || token.length > 256 || !(await secureEqual(token, env.ADMIN_TOKEN))) {
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
