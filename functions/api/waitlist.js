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

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function isFormRequest(request) {
  const contentType = request.headers.get("content-type") || "";
  return contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");
}

function safeRedirectUrl(request, value, status) {
  const requestUrl = new URL(request.url);
  let target;
  try {
    target = value ? new URL(String(value), requestUrl.origin) : new URL(request.headers.get("referer") || "/", requestUrl.origin);
  } catch {
    target = new URL("/", requestUrl.origin);
  }

  if (target.origin !== requestUrl.origin) {
    target = new URL("/", requestUrl.origin);
  }

  target.searchParams.set(status === "joined" ? "joined" : "error", status === "joined" ? "1" : "email");
  return target.toString();
}

function redirectForForm(request, payload, status) {
  return Response.redirect(safeRedirectUrl(request, payload?.returnTo, status), 303);
}

async function getCount(env) {
  const row = await env.DB.prepare("SELECT COUNT(*) AS count FROM waitlist_signups").first();
  return Number(row?.count ?? 0);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: jsonHeaders });
}

export async function onRequestGet({ env }) {
  return jsonResponse({ ok: true, count: await getCount(env) });
}

export async function onRequestPost({ request, env }) {
  const wantsFormRedirect = isFormRequest(request);
  let payload;
  try {
    if (wantsFormRedirect) {
      const formData = await request.formData();
      payload = Object.fromEntries(formData.entries());
    } else {
      payload = await request.json();
    }
  } catch {
    if (wantsFormRedirect) {
      return redirectForForm(request, {}, "error");
    }
    return jsonResponse({ ok: false, error: "Invalid JSON body." }, 400);
  }

  if (payload?.company) {
    if (wantsFormRedirect) {
      return redirectForForm(request, payload, "joined");
    }
    return jsonResponse({ ok: true, status: "accepted", count: await getCount(env) });
  }

  const email = normalizeEmail(payload?.email);
  if (!isValidEmail(email)) {
    if (wantsFormRedirect) {
      return redirectForForm(request, payload, "error");
    }
    return jsonResponse({ ok: false, error: "Enter a valid email address." }, 400);
  }

  const source = String(payload?.source || "waitlist").slice(0, 80);
  const betaInterest = String(payload?.betaInterest || "").slice(0, 80);
  const userAgent = String(request.headers.get("user-agent") || "").slice(0, 300);
  const now = new Date().toISOString();

  const existing = await env.DB.prepare("SELECT id FROM waitlist_signups WHERE email = ?").bind(email).first();

  if (existing) {
    await env.DB.prepare(
      `UPDATE waitlist_signups
       SET source = ?, beta_interest = ?, user_agent = ?, updated_at = ?
       WHERE email = ?`,
    )
      .bind(source, betaInterest, userAgent, now, email)
      .run();
  } else {
    await env.DB.prepare(
      `INSERT INTO waitlist_signups (id, email, source, beta_interest, user_agent, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(crypto.randomUUID(), email, source, betaInterest, userAgent, now, now)
      .run();
  }

  if (wantsFormRedirect) {
    return redirectForForm(request, payload, "joined");
  }

  return jsonResponse({
    ok: true,
    status: existing ? "updated" : "created",
    count: await getCount(env),
  });
}
