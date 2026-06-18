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

function clean(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
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

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  if (payload.company) return json({ ok: true });

  const data = Object.fromEntries(
    Object.entries(LIMITS).map(([key, limit]) => [key, clean(payload[key], limit)])
  );

  const required = ["name", "email", "idea", "audience", "problem", "alternative", "urgency", "smallestVersion"];
  if (required.some((key) => data[key].length < (key === "name" || key === "email" ? 2 : 10))) {
    return json({ ok: false, error: "Complete every required field." }, 400);
  }
  if (!validEmail(data.email)) {
    return json({ ok: false, error: "Enter a valid email address." }, 400);
  }
  if (!env.DB) {
    return json({ ok: false, error: "Applications are temporarily unavailable." }, 503);
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const userAgent = clean(request.headers.get("user-agent"), 300);
  const referrer = clean(request.headers.get("referer"), 300);

  try {
    await env.DB.prepare(
      `INSERT INTO prototype_requests (
        id, name, email, idea, audience, problem, alternative, urgency,
        smallest_version, package_choice, hosting_interest, status,
        referrer, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?)`
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
        ["prototype", "domain", "unsure"].includes(data.package) ? data.package : "unsure",
        payload.hostingInterest ? 1 : 0,
        referrer,
        userAgent,
        createdAt
      )
      .run();
  } catch {
    return json({ ok: false, error: "Could not save your brief. Please try again." }, 500);
  }

  return json({ ok: true, requestId: id });
}
