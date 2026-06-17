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

function cleanString(value, maxLength) {
  return String(value || "")
    .trim()
    .slice(0, maxLength);
}

function cleanPagePath(value) {
  const raw = cleanString(value, 240);
  if (!raw) return "";
  try {
    const url = new URL(raw, "https://promptlaiy.pages.dev");
    return `${url.pathname}${url.search}`.slice(0, 240);
  } catch {
    return raw.startsWith("/") ? raw.slice(0, 240) : "";
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: jsonHeaders });
}

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const eventName = cleanString(payload?.eventName, 80);
  if (!eventName) {
    return jsonResponse({ ok: false, error: "Missing event name." }, 400);
  }

  const lessonId = Number.isInteger(payload?.lessonId) ? payload.lessonId : null;
  const betaInterest = cleanString(payload?.betaInterest, 80);
  const source = cleanString(payload?.source, 80);
  const pagePath = cleanPagePath(payload?.path || payload?.pagePath);
  const referrer = cleanString(payload?.referrer || request.headers.get("referer"), 300);
  const userAgent = cleanString(request.headers.get("user-agent"), 300);
  const createdAt = new Date().toISOString();

  try {
    await env.DB.prepare(
      `INSERT INTO product_events
       (id, event_name, lesson_id, beta_interest, source, page_path, referrer, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(crypto.randomUUID(), eventName, lessonId, betaInterest, source, pagePath, referrer, userAgent, createdAt)
      .run();
  } catch {
    return jsonResponse({ ok: false, error: "Could not record event." }, 500);
  }

  return jsonResponse({ ok: true });
}
