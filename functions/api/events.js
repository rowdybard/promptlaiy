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

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: jsonHeaders });
}

export async function onRequestPost({ request, env, context }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const eventName = String(payload?.eventName || "").slice(0, 80);
  if (!eventName) {
    return jsonResponse({ ok: false, error: "Missing event name." }, 400);
  }

  const lessonId = Number.isInteger(payload?.lessonId) ? payload.lessonId : null;
  const betaInterest = String(payload?.betaInterest || "").slice(0, 80);
  const createdAt = new Date().toISOString();

  context.waitUntil(
    env.DB.prepare(
      `INSERT INTO product_events (id, event_name, lesson_id, beta_interest, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(crypto.randomUUID(), eventName, lessonId, betaInterest, createdAt)
      .run(),
  );

  return jsonResponse({ ok: true });
}
