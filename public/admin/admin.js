const TOKEN_KEY = "pl_admin_token";
const SVGNS = "http://www.w3.org/2000/svg";
const PAGE_SIZE = 25;

const state = {
  range: "7d",
  repliesOffset: 0,
  filters: { q: "", status: "", package: "", hosting: "" },
  total: 0,
  timer: null,
};

const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
};

function token() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

function fmt(n) {
  n = Number(n || 0);
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

function escapeHtml(s) {
  return String(s == null ? "" : s);
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      Authorization: "Bearer " + token(),
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401 || res.status === 403) {
    lock("Session expired or unauthorized. Enter your token again.");
    throw new Error("unauthorized");
  }
  return res.json().catch(() => ({ ok: false }));
}

function toast(message) {
  const t = el("div", "toast", message);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2400);
}

/* ---------- Auth ---------- */
const FAILS_KEY = "pl_admin_fails";
const FAILS_TIMESTAMP_KEY = "pl_admin_fails_ts";
const MAX_FAILS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
let sessionTimer = null;

function getFails() {
  try {
    const ts = Number(localStorage.getItem(FAILS_TIMESTAMP_KEY) || 0);
    if (ts && Date.now() - ts > LOCKOUT_MS) {
      localStorage.removeItem(FAILS_KEY);
      localStorage.removeItem(FAILS_TIMESTAMP_KEY);
      return 0;
    }
    return Number(localStorage.getItem(FAILS_KEY) || 0);
  } catch {
    return 0;
  }
}

function incrementFails() {
  try {
    const count = getFails() + 1;
    localStorage.setItem(FAILS_KEY, String(count));
    localStorage.setItem(FAILS_TIMESTAMP_KEY, String(Date.now()));
    return count;
  } catch {
    return 0;
  }
}

function clearFails() {
  try {
    localStorage.removeItem(FAILS_KEY);
    localStorage.removeItem(FAILS_TIMESTAMP_KEY);
  } catch {}
}

function resetSessionTimer() {
  if (sessionTimer) clearTimeout(sessionTimer);
  sessionTimer = setTimeout(() => lock("Session timed out after 30 minutes of inactivity."), SESSION_TIMEOUT_MS);
}

function lock(message) {
  if (state.timer) clearInterval(state.timer);
  if (sessionTimer) clearTimeout(sessionTimer);
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {}
  $("#dashboard").hidden = true;
  $("#login").hidden = false;
  const err = $("#login-error");
  if (message) {
    err.textContent = message;
    err.hidden = false;
  }
  $("#token").value = "";
  $("#token").focus();
}

function unlock() {
  $("#login").hidden = true;
  $("#dashboard").hidden = false;
  loadAll();
  state.timer = setInterval(() => loadStats(), 30000);
  resetSessionTimer();
  document.addEventListener("click", resetSessionTimer, { passive: true });
  document.addEventListener("keydown", resetSessionTimer, { passive: true });
}

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const value = $("#token").value.trim();
  if (!value) return;

  const fails = getFails();
  if (fails >= MAX_FAILS) {
    const err = $("#login-error");
    err.textContent = "Too many failed attempts. Try again in 15 minutes.";
    err.hidden = false;
    return;
  }

  try {
    sessionStorage.setItem(TOKEN_KEY, value);
  } catch {}
  $("#login-error").hidden = true;
  const probe = await fetch("/api/admin/stats?range=1d", {
    headers: { Authorization: "Bearer " + value },
  });
  if (!probe.ok) {
    if (probe.status === 401) {
      const count = incrementFails();
      const remaining = MAX_FAILS - count;
      lock(remaining > 0
        ? `Invalid token. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
        : "Too many failed attempts. Try again in 15 minutes.");
    } else if (probe.status === 429) {
      lock("Too many failed attempts. Try again in 15 minutes.");
    } else {
      lock("Could not reach the server.");
    }
    return;
  }
  clearFails();
  unlock();
});

$("#logout-btn").addEventListener("click", () => lock(""));

/* ---------- Loaders ---------- */
function loadAll() {
  loadStats();
  loadReplies();
}

async function loadStats() {
  let data;
  try {
    data = await api("/api/admin/stats?range=" + state.range);
  } catch {
    return;
  }
  if (!data.ok) return;
  renderKpis(data.totals, data.previous);
  renderChart(data.timeseries);
  renderBars("#top-paths", data.topPaths);
  renderBars("#top-referrers", data.topReferrers);
  renderBars("#top-clicks", data.topClicks);
  renderBars("#countries", data.countries);
  renderDonut("#devices", data.devices);
}

async function loadReplies() {
  const p = new URLSearchParams();
  p.set("limit", String(PAGE_SIZE));
  p.set("offset", String(state.repliesOffset));
  if (state.filters.q) p.set("q", state.filters.q);
  if (state.filters.status) p.set("status", state.filters.status);
  if (state.filters.package) p.set("package", state.filters.package);
  if (state.filters.hosting) p.set("hosting", state.filters.hosting);

  $("#replies").innerHTML = "";
  $("#replies").appendChild(el("div", "skeleton", "Loading replies..."));

  let data;
  try {
    data = await api("/api/admin/replies?" + p.toString());
  } catch {
    return;
  }
  if (!data.ok) return;
  state.total = data.total;
  renderReplies(data.replies);
  renderPager();
}

/* ---------- KPI ---------- */
function deltaNode(cur, prev) {
  const d = el("div", "k-delta");
  if (!prev) {
    d.className = "k-delta flat";
    d.textContent = cur ? "new" : "0%";
    return d;
  }
  const pct = ((cur - prev) / prev) * 100;
  const rounded = Math.round(pct);
  d.className = "k-delta " + (rounded > 0 ? "up" : rounded < 0 ? "down" : "flat");
  d.textContent = (rounded > 0 ? "▲ +" : rounded < 0 ? "▼ " : "") + rounded + "% vs prev";
  return d;
}

function renderKpis(t, prev) {
  const cards = [
    ["Page views", t.pageviews, prev.pageviews],
    ["Sessions", t.sessions, prev.sessions],
    ["Clicks", t.clicks, prev.clicks],
    ["Applications", t.applies, prev.applies],
    [
      "View → apply",
      t.pageviews ? ((t.applies / t.pageviews) * 100).toFixed(1) + "%" : "0%",
      null,
      true,
    ],
  ];
  const wrap = $("#kpis");
  const entering = !wrap.dataset.rendered;
  wrap.classList.toggle("is-entering", entering);
  wrap.innerHTML = "";
  cards.forEach(([label, value, prevVal, raw]) => {
    const card = el("div", "kpi");
    card.appendChild(el("div", "k-label", label));
    card.appendChild(el("div", "k-value", raw ? value : fmt(value)));
    if (prevVal !== null) card.appendChild(deltaNode(Number(value), Number(prevVal)));
    else card.appendChild(el("div", "k-delta flat", "conversion"));
    wrap.appendChild(card);
  });
  if (entering) {
    wrap.dataset.rendered = "true";
    setTimeout(() => wrap.classList.remove("is-entering"), 700);
  }
}

/* ---------- Chart ---------- */
function fillDays(series) {
  const days = state.range === "1d" ? 1 : Number(state.range.replace("d", ""));
  const map = {};
  series.forEach((r) => (map[r.day] = r));
  const out = [];
  const count = Math.max(days, 2);
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    out.push(map[d] || { day: d, pageviews: 0, sessions: 0, clicks: 0 });
  }
  return out;
}

function renderChart(series) {
  const data = fillDays(series);
  const W = 760;
  const H = 260;
  const pad = { l: 38, r: 16, t: 16, b: 28 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const max = Math.max(1, ...data.map((d) => Math.max(d.pageviews, d.sessions, d.clicks)));
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;
  const x = (i) => pad.l + i * stepX;
  const y = (v) => pad.t + innerH - (v / max) * innerH;

  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("preserveAspectRatio", "none");

  for (let g = 0; g <= 4; g++) {
    const gy = pad.t + (innerH / 4) * g;
    const line = document.createElementNS(SVGNS, "line");
    line.setAttribute("x1", pad.l);
    line.setAttribute("x2", W - pad.r);
    line.setAttribute("y1", gy);
    line.setAttribute("y2", gy);
    line.setAttribute("class", "grid-line");
    svg.appendChild(line);
    const lbl = document.createElementNS(SVGNS, "text");
    lbl.setAttribute("x", 4);
    lbl.setAttribute("y", gy + 3);
    lbl.setAttribute("class", "axis-label");
    lbl.textContent = fmt(Math.round(max - (max / 4) * g));
    svg.appendChild(lbl);
  }

  const seriesDefs = [
    ["pageviews", "#4ea8ff"],
    ["sessions", "#38e8b0"],
    ["clicks", "#ffd257"],
  ];
  seriesDefs.forEach(([key, color]) => {
    const pts = data.map((d, i) => `${x(i)},${y(d[key])}`).join(" ");
    const poly = document.createElementNS(SVGNS, "polyline");
    poly.setAttribute("points", pts);
    poly.setAttribute("fill", "none");
    poly.setAttribute("stroke", color);
    poly.setAttribute("stroke-width", "2.5");
    poly.setAttribute("stroke-linejoin", "round");
    poly.setAttribute("stroke-linecap", "round");
    svg.appendChild(poly);
    data.forEach((d, i) => {
      const c = document.createElementNS(SVGNS, "circle");
      c.setAttribute("cx", x(i));
      c.setAttribute("cy", y(d[key]));
      c.setAttribute("r", "2.5");
      c.setAttribute("fill", color);
      const title = document.createElementNS(SVGNS, "title");
      title.textContent = `${d.day} · ${key}: ${d[key]}`;
      c.appendChild(title);
      svg.appendChild(c);
    });
  });

  const labelEvery = Math.ceil(data.length / 7);
  data.forEach((d, i) => {
    if (i % labelEvery !== 0 && i !== data.length - 1) return;
    const t = document.createElementNS(SVGNS, "text");
    t.setAttribute("x", x(i));
    t.setAttribute("y", H - 8);
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("class", "axis-label");
    t.textContent = d.day.slice(5);
    svg.appendChild(t);
  });

  const chart = $("#chart");
  const entering = !chart.dataset.rendered;
  chart.classList.toggle("is-entering", entering);
  chart.innerHTML = "";
  chart.appendChild(svg);
  if (entering) {
    chart.dataset.rendered = "true";
    setTimeout(() => chart.classList.remove("is-entering"), 1100);
  }
}

/* ---------- Bar lists ---------- */
function renderBars(sel, items) {
  const wrap = $(sel);
  wrap.innerHTML = "";
  if (!items || !items.length) {
    wrap.appendChild(el("div", "empty", "No data yet."));
    return;
  }
  const max = Math.max(...items.map((i) => Number(i.count)));
  items.forEach((item) => {
    const row = el("div", "bar-row");
    row.appendChild(el("div", "bar-label", item.label || "(none)"));
    row.appendChild(el("div", "bar-value", fmt(item.count)));
    const track = el("div", "bar-track");
    const fill = el("div", "bar-fill");
    fill.style.width = Math.max(3, (Number(item.count) / max) * 100) + "%";
    track.appendChild(fill);
    row.appendChild(track);
    wrap.appendChild(row);
  });
}

/* ---------- Donut ---------- */
function renderDonut(sel, items) {
  const wrap = $(sel);
  wrap.innerHTML = "";
  if (!items || !items.length) {
    wrap.appendChild(el("div", "empty", "No data yet."));
    return;
  }
  const colors = ["#4ea8ff", "#38e8b0", "#ffd257", "#ff6b6b", "#a78bfa"];
  const total = items.reduce((s, i) => s + Number(i.count), 0) || 1;
  const size = 140;
  const r = 54;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.setAttribute("width", "140");
  svg.setAttribute("height", "140");
  let offset = 0;
  items.forEach((item, idx) => {
    const frac = Number(item.count) / total;
    const c = document.createElementNS(SVGNS, "circle");
    c.setAttribute("cx", cx);
    c.setAttribute("cy", cy);
    c.setAttribute("r", r);
    c.setAttribute("fill", "none");
    c.setAttribute("stroke", colors[idx % colors.length]);
    c.setAttribute("stroke-width", "18");
    c.setAttribute("stroke-dasharray", `${frac * circ} ${circ}`);
    c.setAttribute("stroke-dashoffset", -offset * circ);
    c.setAttribute("transform", `rotate(-90 ${cx} ${cy})`);
    svg.appendChild(c);
    offset += frac;
  });
  wrap.appendChild(svg);

  const legend = el("div", "donut-legend");
  items.forEach((item, idx) => {
    const row = el("div");
    const dot = el("span", "dot");
    dot.style.background = colors[idx % colors.length];
    row.appendChild(dot);
    row.appendChild(document.createTextNode(`${item.label || "?"} · ${item.count}`));
    legend.appendChild(row);
  });
  wrap.appendChild(legend);
}

/* ---------- Replies ---------- */
const FIELD_LABELS = {
  idea: "Idea",
  audience: "Audience",
  problem: "Problem",
  alternative: "Current alternative",
  urgency: "Why now",
  smallest_version: "Smallest useful version",
  referrer: "Referrer",
};

function statusButtons(reply) {
  const wrap = el("div", "status-set");
  ["new", "contacted", "won", "lost", "archived"].forEach((s) => {
    const b = el("button", reply.status === s ? "active" : "", s);
    b.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const res = await api("/api/admin/replies", {
        method: "PATCH",
        body: JSON.stringify({ id: reply.id, status: s }),
      });
      if (res.ok) {
        reply.status = s;
        toast("Marked " + s);
        loadReplies();
      }
    });
    wrap.appendChild(b);
  });
  return wrap;
}

function renderReplies(replies) {
  const wrap = $("#replies");
  wrap.innerHTML = "";
  $("#replies-count").textContent = state.total ? `(${state.total})` : "";
  if (!replies.length) {
    wrap.appendChild(el("div", "empty", "No replies match these filters."));
    return;
  }
  replies.forEach((r) => {
    const det = el("details", "reply");
    const sum = el("summary");
    sum.appendChild(el("span", "r-name", r.name));
    sum.appendChild(el("span", "r-email", r.email));
    sum.appendChild(el("span", "r-spacer"));
    sum.appendChild(el("span", "tag pkg", r.package_choice));
    if (r.hosting_interest) sum.appendChild(el("span", "tag", "hosting"));
    sum.appendChild(el("span", "tag status-" + r.status, r.status));
    sum.appendChild(el("span", "r-date", new Date(r.created_at).toLocaleString()));
    det.appendChild(sum);

    const body = el("div", "reply-body");
    Object.keys(FIELD_LABELS).forEach((key) => {
      if (!r[key]) return;
      const dl = el("dl", "reply-field");
      dl.appendChild(el("dt", null, FIELD_LABELS[key]));
      dl.appendChild(el("dd", null, escapeHtml(r[key])));
      body.appendChild(dl);
    });

    const actions = el("div", "reply-actions");
    const mail = el("a", null, "Email " + r.name.split(" ")[0]);
    mail.href = `mailto:${r.email}?subject=${encodeURIComponent("Your Promptlaiy prototype brief")}`;
    actions.appendChild(mail);
    actions.appendChild(statusButtons(r));
    body.appendChild(actions);

    det.appendChild(body);
    wrap.appendChild(det);
  });
}

function renderPager() {
  const start = state.total === 0 ? 0 : state.repliesOffset + 1;
  const end = Math.min(state.repliesOffset + PAGE_SIZE, state.total);
  $("#page-info").textContent = `${start}–${end} of ${state.total}`;
  $("#prev-page").disabled = state.repliesOffset === 0;
  $("#next-page").disabled = end >= state.total;
}

/* ---------- Controls ---------- */
$("#range-seg").addEventListener("click", (e) => {
  const btn = e.target.closest(".seg-btn");
  if (!btn) return;
  document.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  state.range = btn.dataset.range;
  loadStats();
});

$("#refresh-btn").addEventListener("click", loadAll);

let searchTimer;
$("#search").addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.filters.q = e.target.value.trim();
    state.repliesOffset = 0;
    loadReplies();
  }, 350);
});

["status", "package", "hosting"].forEach((key) => {
  $("#" + key + "-filter").addEventListener("change", (e) => {
    state.filters[key] = e.target.value;
    state.repliesOffset = 0;
    loadReplies();
  });
});

$("#prev-page").addEventListener("click", () => {
  state.repliesOffset = Math.max(0, state.repliesOffset - PAGE_SIZE);
  loadReplies();
});
$("#next-page").addEventListener("click", () => {
  state.repliesOffset += PAGE_SIZE;
  loadReplies();
});

/* =====================================================================
   Marketing HQ — tab switching, post templates, copy-to-clipboard
   ===================================================================== */

const POSTS = {
  reddit: [
    {
      title: "r/startups — I built a thing",
      tag: "r/startups",
      body: `I got tired of watching founders spend 3 months and $15k building something nobody wanted. So I started building clickable prototypes in a week instead.

The idea is simple: you tell me what you want to build, I build the smallest version that actually works — not a mockup, not a slide deck, something you can click through and put in front of real people. Then I write up what's solid, what's weak, and what's most likely to fail.

It's $499 flat. One core workflow. One revision. You get the source code and a hosted preview for 60 days.

[Link to your site]

I'm not claiming this replaces building a real product. It doesn't. But it's way cheaper to find out your core assumption is wrong on day 7 than on day 90.

Happy to answer questions about the process.`,
    },
    {
      title: "r/Entrepreneur — lesson learned",
      tag: "r/Entrepreneur",
      body: `Last year I watched three founders in my circle build full products before ever talking to a single user. All three failed. Not because the ideas were bad — because they built the wrong thing first.

The pattern was identical: idea → 3 months of heads-down building → launch → crickets → "maybe we need better marketing" → burnout.

What I learned from watching this happen three times: the cheapest way to test an idea is to build something clickable — not a landing page, not a Figma file, something people can actually use — and put it in front of 5-10 potential users.

I started doing this as a service. $499, one week, you get a working prototype + a blunt evaluation of what's likely to fail. No retainer, no "let's hop on a call to discuss your needs." You fill out a brief, I build, you get files.

[Link to your site]

Not posting this as a sales pitch — posting because the "build less, test sooner" message needs to reach more people before they burn their savings.`,
    },
    {
      title: "r/SaaS — build in public",
      tag: "r/SaaS",
      body: `Building a prototype service for founders who want to test ideas without building full products.

Week 1: shipped the landing page + application form. Got [X] applicants.

The pitch: $499, 7 days, you get a clickable prototype + evaluation + test plan. Source code included. No subscriptions, no upsells.

What I've learned so far:
- Founders don't want "validation services." They want something real they can show people.
- The "7 days" part matters more than the price. Speed is the actual product.
- Most people who fill out the form have already tried no-code tools and gotten stuck.

[Link to your site]

Currently [X] spots open per week. Will post updates as I go.`,
    },
    {
      title: "r/nocode — for people who got stuck",
      tag: "r/nocode",
      body: `This is for people who started building with [Bubble/Glide/Webflow/etc], got 80% done, and then realized the last 20% is the part that actually matters.

I build clickable prototypes for founders. Not production apps — prototypes. The smallest version of your idea that works end-to-end, built in a week, with source code you own.

The difference from no-code: I build the actual interactions, not just the UI. Your core workflow works. You can put it in front of users and they can actually do the thing.

$499 flat. You get:
- Working prototype (hosted for 60 days)
- Source code + setup instructions
- Blunt evaluation of what's solid and what's not
- Three specific tests to run with users

[Link to your site]

Not trying to compete with no-code tools — this is for the stage before you're ready to commit to building the real thing.`,
    },
    {
      title: "r/smallbusiness — pain point post",
      tag: "r/smallbusiness",
      body: `If you've ever paid a developer $5k+ for an MVP only to find out the idea wasn't right, this might save you some money.

I build prototypes. Not apps — prototypes. The smallest clickable version of your idea, done in a week, for $499.

The point isn't to launch a business on it. The point is to find out if the core thing even makes sense before you spend real money building it.

You get:
- A working prototype (not a mockup — people can actually click through it)
- An honest write-up of what works and what doesn't
- A test plan with 3 specific things to try with potential customers
- The source code

[Link to your site]

I keep it to one core workflow. If your idea needs 15 features to be useful, I'll tell you that before taking your money.`,
    },
  ],
  discord: [
    {
      title: "Indie Hackers Discord — casual intro",
      tag: "Discord",
      body: `Hey — I run a service where I build clickable prototypes for founders in 7 days for $499. Not no-code, not a landing page — actual working interactions you can put in front of users.

If anyone here is stuck between "I have an idea" and "should I spend months building it," happy to chat. I also write up what's most likely to fail about the idea, which is the part most people skip.

Site: [link]

Not trying to spam — figured it's relevant since a lot of indie hackers are in the "should I build this" phase.`,
    },
    {
      title: "Startup community Discord — value-first",
      tag: "Discord",
      body: `Quick tip for anyone in the "should I build this" phase:

Before you write a line of code or pay someone to build it, build the smallest clickable version and put it in front of 5 people. Not a landing page — people lie on landing pages. Something they can actually use.

I do this as a service ($499, 7 days, [link]) but honestly you can do it yourself with [Figma + a free prototype tool]. The point is: test the core workflow, not the marketing site.

The number of founders I've talked to who spent 3 months building something and never once put a prototype in front of a real user is wild.`,
    },
    {
      title: "Founder Discord — launch update",
      tag: "Discord",
      body: `Just opened up [X] prototype slots for this week.

For context: I build clickable prototypes for founders — $499, 7 days, you get a working prototype + source code + an evaluation of what's likely to fail. One core workflow, one revision.

If you've got an idea you're not sure about, this is cheaper than building the wrong thing. [link]

DM me if you've got questions before applying.`,
    },
  ],
  facebook: [
    {
      title: "Startup/Entrepreneur group — story post",
      tag: "Facebook",
      body: `Genuine question for this group: how many of you have built a full product before testing the core idea?

I watched three friends do this last year. All three spent months and thousands of dollars building something, launched it, and... nothing. Not because the ideas were bad. Because they built the wrong thing first.

I started a service to fix this. I build clickable prototypes in a week — not landing pages, not mockups, something real enough that you can put it in front of 5 potential users and learn whether the core thing even makes sense.

$499 flat. You get the prototype, the source code, and an honest write-up of what's solid and what's not. [Link]

Curious — has anyone here tested an idea with a prototype before building the full thing? How'd it go?`,
    },
    {
      title: "No-code group — for people who got stuck",
      tag: "Facebook",
      body: `For anyone who's tried no-code tools and gotten stuck at the "it looks right but the interactions don't work" stage:

I build clickable prototypes — the actual working interactions, not just the UI. $499, 7 days, source code included. It's not a production app, it's the thing you put in front of users to find out if your idea makes sense before you commit to building the real version.

[Link]

This isn't anti-no-code — it's for the stage before you're ready to commit to a platform. If you're curious what the difference looks like, happy to explain in comments.`,
    },
    {
      title: "Small business group — direct but honest",
      tag: "Facebook",
      body: `If you've got a software idea for your business but you're not sure it's worth $10k+ to build, I can build you a clickable prototype for $499.

You get:
- A working prototype of your core workflow (7 days)
- The source code — it's yours
- An honest assessment of what's likely to work and what's likely to fail
- A plan for 3 tests you can run with real users

This isn't the production app. It's the thing you build BEFORE the production app, so you don't spend $10k finding out the idea wasn't right.

[Link]

No subscriptions, no retainers. One-time $499, you own the files.`,
    },
  ],
  twitter: [
    {
      title: "Single tweet — the core pitch",
      tag: "Twitter",
      body: `I build clickable prototypes for founders in 7 days for $499.

Not a landing page. Not a mockup. Something you can put in front of real users to find out if your idea makes sense before you spend months building the wrong thing.

Source code included. [Link]`,
    },
    {
      title: "Thread — why most prototypes fail",
      tag: "Twitter thread",
      body: `Most "prototypes" fail because they're not testing the right thing. A thread:

1/ Most founders build a landing page and call it a prototype. But landing pages test marketing, not the product. People click "Sign up" and you learn nothing about whether your core workflow makes sense.

2/ Some founders build Figma mockups. Better — but people interact with mockups differently than real software. They're polite. They say "yeah, that looks great." Then they never use the real thing.

3/ The prototype that actually teaches you something is one where the core workflow works. Not the full app — just the one thing that has to be right or everything else is wasted.

4/ I build these. $499, 7 days, one core workflow. You get a working prototype + source code + an honest evaluation of what's likely to fail. [Link]

5/ The point isn't to launch a business on a prototype. It's to find out if your core assumption is right for $499 instead of $15k and 3 months.

6/ If you're in the "should I build this" phase, that's the phase where a prototype is most useful. After you've built the full thing, it's too late.`,
    },
    {
      title: "Build in public — weekly update",
      tag: "Twitter",
      body: `Week [X] update:

- [X] prototype briefs submitted
- [X] prototypes delivered
- [Something you learned this week]
- [Something that didn't work]

Still $499 flat, 7 days, source code included. [Link]

Currently [X] spots open for next week.`,
    },
    {
      title: "Hot take — contrarian",
      tag: "Twitter",
      body: `Hot take: "validate your idea" advice is mostly useless because what people actually need is something clickable to show users, not another survey or landing page test.

Surveys tell you what people say they'd do. Prototypes tell you what they actually do.

That's why I build prototypes, not landing pages. [Link]`,
    },
  ],
  hn: [
    {
      title: "Show HN — launch post",
      tag: "Show HN",
      body: `Show HN: Promptlaiy — clickable prototypes in 7 days for $499

I build the smallest working version of a founder's software idea — not a mockup, not a landing page, a clickable prototype where the core workflow actually works. Then I write up what's solid, what's weak, and what's most likely to fail.

Why: I watched too many founders spend months and thousands building products nobody wanted. The cheapest way to test a software idea is to build something clickable and put it in front of real users — but most people either skip this or do it wrong (landing pages, surveys, Figma files that people are too polite to criticize).

How it works: you fill out a brief, I build one core workflow in 7 days, you get the prototype + source code + evaluation + test plan. $499 flat, one revision included.

[Link]

I'm a [your background] developer. Happy to answer questions about the process, the tech stack, or why I think the "prototype first" approach beats "build MVP, iterate, hope."`,
    },
    {
      title: "Indie Hackers — first post",
      tag: "Indie Hackers",
      body: `Hey IH community —

I launched a service where I build clickable prototypes for founders in 7 days for $499.

The idea came from watching three friends build full products before testing their core assumption. All three failed. Not bad ideas — wrong execution order.

What I do differently: I build one core workflow (not the whole app), make it actually clickable (not a Figma file), and write up what's most likely to fail (which is the part most builders won't tell you).

You get source code, a hosted preview for 60 days, and a test plan with 3 specific things to try with users.

[Link]

Currently [X] spots per week. I'll post updates here as I go.`,
    },
    {
      title: "Indie Hackers — milestone post",
      tag: "Indie Hackers",
      body: `[X] prototypes shipped. Here's what I've learned:

1. The "7 days" matters more than the "$499." Speed is the actual product. Founders who test in week 1 beat founders who plan for 3 months.

2. Most people don't need more features in their prototype. They need fewer. The ones who try to cram 10 workflows into a prototype learn nothing.

3. The evaluation is the part people value most. Everyone can build a prototype. Not everyone will tell you "this assumption is probably wrong."

4. [Something specific you learned]

Revenue so far: $[X]. Next goal: [Y].

[Link]`,
    },
  ],
  linkedin: [
    {
      title: "Professional post — the pattern",
      tag: "LinkedIn",
      body: `I've noticed a pattern with founders who fail:

They build the full product before testing the core assumption.

Not because they're reckless — because the jump from "I have an idea" to "I should build something" feels like one step. It's actually two:

1. Build the smallest clickable version
2. Put it in front of real users

Most people skip step 1 and go straight to building the real thing. That's where $15k and 3 months go to die.

I build clickable prototypes — $499, 7 days, one core workflow. You get the prototype, the source code, and an honest evaluation of what's likely to fail.

It's not a product launch. It's a de-risking exercise before you commit to building the real thing.

[Link]`,
    },
    {
      title: "LinkedIn — build in public / milestone",
      tag: "LinkedIn",
      body: `Shipped [X] prototypes this month. A few things I've learned:

- Founders don't need "validation." They need something real enough to show users. Surveys and landing pages test what people say. Prototypes test what people do.

- The most valuable part isn't the code. It's the honest assessment of what's likely to fail. Most builders won't tell you that. I do, because finding out on day 7 for $499 is better than finding out on day 90 for $15k.

- Speed is the product. The 7-day turnaround matters more than the price.

If you're in the "should I build this" phase: [link]`,
    },
  ],
  ph: [
    {
      title: "Product Hunt — launch day comment",
      tag: "Product Hunt",
      body: `We're live on Product Hunt today!

Promptlaiy builds clickable prototypes for founders in 7 days for $499. Not a landing page, not a mockup — a working prototype where your core workflow actually functions.

The idea: test your core assumption for $499 before spending $15k building the wrong thing.

What you get:
- Clickable prototype (hosted for 60 days)
- Source code + setup instructions
- Blunt evaluation of what's solid and what's not
- Test plan with 3 specific user tests
- One revision included

Would love your support and feedback: [PH link]

If you've got questions about the process, I'll be in comments all day.`,
    },
    {
      title: "Product Hunt — maker comment template",
      tag: "Product Hunt",
      body: `Thanks for the support, everyone!

Quick context on why I built this: I watched three founders spend months and thousands building products before ever putting something clickable in front of users. All three failed — not because the ideas were bad, but because they built the wrong thing first.

Promptlaiy is the step I wish they'd taken. $499, 7 days, you get a working prototype + source code + an honest evaluation. No subscriptions, no retainers.

[PH link]

Happy to answer any questions about the process, the tech, or the philosophy.`,
    },
  ],
  outreach: [
    {
      title: "Twitter/X DM — reference their tweet",
      tag: "Twitter DM",
      body: `Hey [name] — saw your tweet about [specific thing they tweeted about]. Really resonated, especially the part about [specific detail].

I build clickable prototypes for founders testing ideas — $499, 7 days. Not sure if it's relevant to what you're working on, but if you're ever in the "should I build this" phase, I'd build you one for free. No strings.

Either way, great thread. Keep posting.`,
    },
    {
      title: "LinkedIn DM — reference their post",
      tag: "LinkedIn DM",
      body: `Hi [name],

Read your post about [specific topic from their recent post]. The point about [specific detail] was spot on — most people miss that.

I run a service building clickable prototypes for founders who want to test ideas before committing to a full build. $499, 7 days, source code included.

If you're ever working through a "should I build this" decision, happy to build you a prototype on the house. No pitch, no follow-up sequence.

Keep the posts coming — they're genuinely useful.`,
    },
    {
      title: "Cold email — 3 sentences, no calendar link",
      tag: "Email",
      body: `Subject: [Specific thing they wrote/built] + a question

Hi [name],

Read [specific thing — their blog post, tweet, product launch, comment]. The part about [specific detail] made me think about what I'm building.

I build clickable prototypes for founders — $499, 7 days, one core workflow. If you're ever testing a new idea and want a prototype to put in front of users, reply and I'll build it for free.

[Your name]`,
    },
    {
      title: "Reddit DM — after helpful comment exchange",
      tag: "Reddit DM",
      body: `Hey [name] — appreciated your comment in [subreddit] about [topic]. You clearly know your stuff.

I build clickable prototypes for founders testing ideas ($499, 7 days, source code included). Based on what you said about [their specific point], I think you'd get the value of testing before building.

If you've got an idea you're sitting on, I'd build you one for free. Just fill out the brief at [link] and mention this DM.

No pressure either way — your comment was genuinely helpful and I wanted to return the favor.`,
    },
    {
      title: "Follow-up message — 1 sentence, no guilt",
      tag: "Follow-up",
      body: `Hey [name] — just bumping this in case it got buried. No worries if it's not the right time.`,
    },
    {
      title: "Influencer outreach — Superhuman style",
      tag: "Influencer",
      body: `Subject: Loved your [specific piece] — quick offer

Hi [name],

I read your [specific article/tweet/thread/post] about [topic]. The insight about [specific detail] was something I hadn't seen anyone else articulate.

I build clickable prototypes for founders — $499, 7 days. I'd build you one for free, no strings, because I think you'd do something interesting with it.

If you've got an idea sitting in a notes app somewhere, send me a one-paragraph brief and I'll have something clickable back to you in a week.

[Your name]
[Link]`,
    },
  ],
  quora: [
    {
      title: "Quora answer — value first, link in bio",
      tag: "Quora",
      body: `The cheapest way to test a software idea is to build a clickable prototype — not a landing page, not a survey, something people can actually use — and put it in front of 5-10 potential users.

Here's why most "validation" approaches fail:

1. **Landing pages test marketing, not the product.** People click "Sign up" and you learn nothing about whether your core workflow makes sense.

2. **Surveys test what people say, not what they do.** There's a massive gap between "yes, I'd use that" and actually using it.

3. **Figma mockups make people polite.** They say "looks great!" because it's clearly not real. They won't give you honest feedback on something that's clearly a draft.

What works: build the smallest version where the one core thing actually functions. Put it in front of 5 people. Watch them use it. Don't explain it first — see if they can figure it out.

I do this as a service ($499, 7 days) but you can do it yourself. The point is: test the core workflow, not the marketing site.

[Note: link goes in your Quora bio, not in the answer itself. Quora penalizes in-answer links.]`,
    },
    {
      title: "Stack Exchange answer — helpful, no link",
      tag: "Stack Exchange",
      body: `The key question isn't "should I build my idea?" — it's "what's the cheapest way to find out if my core assumption is wrong?"

For most software ideas, that means building a clickable prototype: the smallest version where the one thing that has to work actually works. Not the full app. Not a landing page. Just the core workflow.

Put it in front of 5-10 potential users. Watch them try to use it without instructions. If they can't figure it out, or if they don't care, you've saved yourself months of building the wrong thing.

If you want to go deeper, I wrote about the specific approach here: [link in your profile bio, not in the answer]`,
    },
    {
      title: "Reddit comment — when someone asks 'how to test'",
      tag: "Reddit",
      body: `Don't build a landing page. Don't run a survey. Build the smallest clickable version of the core thing and put it in front of 5 people.

Landing pages test marketing copy. Surveys test what people say. Neither tells you if your core workflow makes sense.

Build something where the one thing that has to work actually works. Watch people use it without explaining it first. If they can't figure it out or don't care, you just saved yourself 3 months.

I do this as a service ($499, 7 days) but honestly you can do it yourself in a weekend with [tool]. The point is: test the thing, not the pitch.`,
    },
  ],
  partner: [
    {
      title: "Newsletter swap outreach",
      tag: "Newsletter",
      body: `Subject: Newsletter swap? [Your newsletter] x [Their newsletter]

Hi [name],

I read [their newsletter name] regularly — especially the issue about [specific topic]. Great stuff.

I run a small newsletter / email list about [your topic] with [X] subscribers. Mostly founders and indie hackers.

I'm doing newsletter swaps this month — I mention your product in my next send, you mention mine in yours. No money, no affiliate stuff, just cross-pollination between audiences that overlap.

If you're interested, I can send you a draft of what I'd write about [their product]. You'd have full approval before anything goes out.

[Your name]
[Link]`,
    },
    {
      title: "Guest post pitch",
      tag: "Guest Post",
      body: `Subject: Pitch: "Why most founders test their ideas wrong (and what to do instead)"

Hi [name],

I've been reading [their blog] for a while — your post about [specific topic] was particularly useful.

I'd like to pitch a guest post:

**Title:** Why most founders test their ideas wrong (and what to do instead)

**Angle:** Most "validation" advice tells founders to build landing pages and run surveys. Both test the wrong thing. I've built [X] prototypes for founders and watched the same pattern repeat: the ones who test with clickable prototypes find out if their idea works in a week. The ones who build full products find out in 3 months.

**Outline:**
- Why landing pages test marketing, not products
- Why surveys test what people say, not what they do
- The clickable prototype approach (with a real example)
- How to do it yourself without paying anyone

~1,500 words. Original, not published elsewhere. I'll include one link to my site in the bio.

Interested?

[Your name]`,
    },
    {
      title: "Podcast outreach — get on shows",
      tag: "Podcast",
      body: `Subject: Guest pitch — "The $499 prototype that saves founders $15k"

Hi [name],

Listener of [podcast name] — the episode with [specific guest] about [specific topic] was excellent.

I'd love to be a guest. Here's what I can talk about:

- Why most founders spend months building products nobody wants
- The difference between a prototype and an MVP (and why most people build the wrong one first)
- How to test a software idea in 7 days for under $500
- What I've learned building [X] prototypes for founders

I'm a [your background] developer who started building prototypes after watching three friends fail at startups the same way. I have real stories, real numbers, and I don't sugarcoat.

Happy to do a pre-interview call if that's your process.

[Your name]
[Link]`,
    },
    {
      title: "Complementary product co-marketing",
      tag: "Co-marketing",
      body: `Subject: Cross-promo idea — [Your product] + [Their product]

Hi [name],

I use [their product] and I think there's a natural overlap with what I do.

I build clickable prototypes for founders testing ideas ($499, 7 days). Your customers are [what their customers do] — many of them are probably in the "I have an idea but I'm not sure if it's worth building" phase.

Here's what I'm thinking:
- I write a guest post for your blog about testing ideas before building
- You mention my service in your newsletter (I'll write the blurb, you approve)
- I offer your customers a discount (e.g. $100 off) with a code tied to your brand
- We both win: your customers get a useful resource, I get exposure to the right audience

No money changing hands. Just value swap.

If this sounds interesting, I can send you a draft of the guest post this week.

[Your name]
[Link]`,
    },
  ],
  press: [
    {
      title: "HARO response — journalist query reply",
      tag: "HARO",
      body: `Hi [journalist name],

Re: your query about [topic from their HARO request].

I build clickable prototypes for founders — $499, 7 days. I've worked with [X] founders and watched the same pattern repeat: the ones who test with prototypes before building full products succeed at [higher rate]. The ones who skip this step burn [time/money].

A few data points I can share:
- [Specific stat from your experience]
- [Specific pattern you've observed]
- [Specific story, anonymized if needed]

I can speak to:
- Why most "validation" advice is wrong
- The difference between a prototype and an MVP
- How founders can test ideas for under $500 in a week
- Real examples of ideas that failed at the prototype stage (saving thousands)

Available for a quick call or email follow-up. Here's my site: [link]

[Your name]
[Your title]`,
    },
    {
      title: "Direct journalist outreach",
      tag: "Press",
      body: `Subject: Source for a story? Founders wasting $15k building the wrong thing

Hi [journalist name],

I read your [specific article] about [topic] in [publication]. Great piece — especially the point about [specific detail].

I have a story you might find interesting:

I build clickable prototypes for founders. $499, 7 days. After working with [X] founders, I've noticed a clear pattern: the ones who test with prototypes first succeed at [rate]. The ones who build full products first fail at [rate].

I have:
- Real data on cost/time savings
- Anonymized stories of ideas that failed at prototype stage
- A contrarian take on why most "startup validation" advice is wrong
- Specific examples of founders who saved $10k+ by testing first

If you're working on anything related to startups, product development, or founder mistakes, I'd be happy to be a source.

[Your name]
[Link]`,
    },
  ],
};

const CHECKLIST = [
  { label: "Set up Google Analytics or Plausible", note: "Free tier. You need to know where traffic comes from." },
  { label: "Submit site to Google Search Console", note: "Verify ownership, submit sitemap. Free.", link: "https://search.google.com/search-console" },
  { label: "Write 3 SEO guide articles", note: "You already have 7. Write more targeting long-tail keywords founders search." },
  { label: "Create a Twitter/X account", note: "Post build-in-public updates 2-3x per week. Not just links — share what you're learning." },
  { label: "Join 3 relevant subreddits", note: "r/startups, r/Entrepreneur, r/SaaS, r/nocode, r/smallbusiness. Engage for 2 weeks before posting." },
  { label: "Join 2-3 Discord communities", note: "Indie Hackers, startup communities. Be helpful first, mention your service when relevant." },
  { label: "Join 3-5 Facebook groups", note: "Startup, entrepreneur, no-code groups. Same rule: engage before promoting." },
  { label: "Create an Indie Hackers account", note: "Post your first update. Engage with other makers.", link: "https://indiehackers.com" },
  { label: "Set up a Hacker News account", note: "Karma needed to post. Start engaging now so you can post when ready.", link: "https://news.ycombinator.com" },
  { label: "Create a Product Hunt maker account", note: "Engage with other launches before your own. Build up a following.", link: "https://producthunt.com" },
  { label: "Create a LinkedIn company page", note: "Post weekly. Professional tone. Connect with founders and VCs." },
  { label: "Write a Medium article", note: "Repurpose one of your guides. Link back to your site.", link: "https://medium.com" },
  { label: "Answer Quora questions", note: "Search for 'how to test a startup idea' and similar. Answer helpfully, link your site.", link: "https://quora.com" },
  { label: "Answer on Stack Exchange", note: "Startups, Entrepreneurship, or Product Management SE. Be genuinely helpful.", link: "https://stackexchange.com" },
  { label: "Create a YouTube video", note: "Screen-record a prototype build. 'How I built a clickable prototype in 7 days.' Free with OBS." },
  { label: "Post on Betalist", note: "Free launch listing for early-stage products.", link: "https://betalist.com" },
  { label: "Post on Microlaunch", note: "Free launch platform for micro products.", link: "https://microlaunch.net" },
  { label: "Reach out to 5 startup newsletters", note: "Find newsletters that cover new tools for founders. Email the editor, offer a free prototype in exchange for a mention." },
  { label: "Find 10 startup communities/forums", note: "Beyond Reddit and Discord. Look for niche communities in your target market." },
  { label: "Create an email list", note: "Free with Mailchimp (up to 500). Collect emails from your site. Send monthly updates." },
  { label: "Cross-promote with 3 other indie makers", note: "Find people with complementary products. Swap mentions in newsletters or social posts." },
  { label: "Speak at a local startup meetup", note: "Meetup.com, Eventbrite. Free to attend, offer to give a 10-min talk on prototyping." },
  { label: "Write a guest post", note: "Find blogs that cover startups/entrepreneurship. Pitch a post about testing ideas cheaply." },
  { label: "Create an OG image for sharing", note: "You have one. Make sure it looks good when shared on social platforms." },
  { label: "Set up UTM tracking on all links", note: "Know which posts drive traffic. Use utm_source, utm_medium, utm_campaign on every link you share." },
];

const DIRECTORIES = [
  { label: "BetaList", note: "Early-stage product launches. Free.", link: "https://betalist.com" },
  { label: "Microlaunch", note: "Micro product launches. Free.", link: "https://microlaunch.net" },
  { label: "Product Hunt (when ready)", note: "Time it right. Build a following first.", link: "https://producthunt.com" },
  { label: "Indie Hackers", note: "List your product + post updates.", link: "https://indiehackers.com" },
  { label: "Hacker News (Show HN)", note: "One shot. Make it count.", link: "https://news.ycombinator.com" },
  { label: "Dev.to", note: "Write a technical post about your approach.", link: "https://dev.to" },
  { label: "Makerlog", note: "Track your builds publicly.", link: "https://makerlog.xyz" },
  { label: "Netlify/Cloudflare showcase", note: "If you build on these platforms, submit to their showcases." },
  { label: "Awesome lists on GitHub", note: "Find relevant awesome-lists and submit a PR to get listed." },
  { label: "Startup Stash", note: "Directory of startup tools and services.", link: "https://startupstash.com" },
  { label: "Toolify.ai", note: "AI tool directory. Good if you use AI in your process.", link: "https://toolify.ai" },
  { label: "SubmitJuice directory list", note: "Free list of 100+ places to submit your startup.", link: "https://submitjuice.com" },
  { label: "Google Business Profile", note: "If you have a business entity, claim your profile. Free.", link: "https://business.google.com" },
  { label: "Crunchbase", note: "Add your company. Free tier available.", link: "https://crunchbase.com" },
  { label: "AngelList / Wellfound", note: "List your startup. Good for talent and visibility.", link: "https://wellfound.com" },
  { label: "G2 / Capterra", note: "Software review sites. List your service if it fits a category." },
];

/* ---------- Tab switching ---------- */
$("#main-tabs").addEventListener("click", (e) => {
  const tab = e.target.closest(".main-tab");
  if (!tab) return;
  const target = tab.dataset.tab;

  document.querySelectorAll(".main-tab").forEach((t) => {
    const active = t.dataset.tab === target;
    t.classList.toggle("active", active);
    t.setAttribute("aria-selected", active ? "true" : "false");
  });

  document.querySelectorAll(".tab-panel").forEach((p) => {
    const isActive = p.id === "tab-" + target;
    p.classList.toggle("active", isActive);
    p.hidden = !isActive;
  });

  if (target === "analytics") {
    document.getElementById("range-seg").style.visibility = "";
  } else {
    document.getElementById("range-seg").style.visibility = "hidden";
  }
});

/* ---------- Post rendering ---------- */
function renderPosts(containerId, posts, platformTag) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  wrap.innerHTML = "";
  posts.forEach((post) => {
    const card = el("div", "post-card");

    const head = el("div", "post-card-head");
    head.appendChild(el("span", "post-card-title", post.title));
    head.appendChild(el("span", "post-card-tag " + platformTag, post.tag));
    card.appendChild(head);

    const body = el("div", "post-body", post.body);
    card.appendChild(body);

    const foot = el("div", "post-card-foot");
    const copyBtn = el("button", "copy-btn", "Copy");
    copyBtn.addEventListener("click", () => {
      copyToClipboard(post.body, copyBtn);
    });
    foot.appendChild(copyBtn);
    card.appendChild(foot);

    wrap.appendChild(card);
  });
}

function copyToClipboard(text, btn) {
  const fallback = () => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch {}
    ta.remove();
    showCopied(btn);
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(
      () => showCopied(btn),
      () => fallback()
    );
  } else {
    fallback();
  }
}

function showCopied(btn) {
  const original = btn.textContent;
  btn.textContent = "Copied!";
  btn.classList.add("copied");
  setTimeout(() => {
    btn.textContent = original;
    btn.classList.remove("copied");
  }, 1800);
}

/* ---------- Checklist rendering ---------- */
function renderChecklist(containerId, items, storageKey) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  wrap.innerHTML = "";

  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
  } catch {}

  items.forEach((item, idx) => {
    const row = el("div", "check-item");
    const box = el("div", "check-box" + (saved[idx] ? " checked" : ""));
    box.setAttribute("role", "checkbox");
    box.setAttribute("tabindex", "0");
    box.setAttribute("aria-checked", saved[idx] ? "true" : "false");

    const content = el("div", "check-content");
    const label = el("div", "check-label" + (saved[idx] ? " done" : ""), item.label);

    if (item.note) {
      const note = el("div", "check-note");
      if (item.link) {
        const a = el("a", "check-link", item.link.replace(/^https?:\/\//, "").replace(/\/$/, ""));
        a.href = item.link;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        note.appendChild(document.createTextNode(item.note + " "));
        note.appendChild(a);
      } else {
        note.textContent = item.note;
      }
      content.appendChild(label);
      content.appendChild(note);
    } else {
      content.appendChild(label);
    }

    function toggle() {
      saved[idx] = !saved[idx];
      box.classList.toggle("checked", saved[idx]);
      box.setAttribute("aria-checked", saved[idx] ? "true" : "false");
      label.classList.toggle("done", saved[idx]);
      try {
        localStorage.setItem(storageKey, JSON.stringify(saved));
      } catch {}
    }

    box.addEventListener("click", toggle);
    box.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        toggle();
      }
    });

    row.appendChild(box);
    row.appendChild(content);
    wrap.appendChild(row);
  });
}

/* ---------- Playbook rendering ---------- */
function renderPlaybook() {
  const wrap = document.getElementById("playbook-content");
  if (!wrap) return;
  wrap.innerHTML = "";

  const daily = el("div", "playbook-block");
  daily.innerHTML = `<span class="pb-time">20 min / day</span><h3>Daily routine</h3>
    <ul>
      <li><strong>5 min:</strong> Open 2-3 communities (Reddit, Discord, LinkedIn). Scan for questions you can answer. Don't post links. Don't mention your product.</li>
      <li><strong>10 min:</strong> Answer 2-3 questions helpfully. Real answers, not "check out my site." Be the person you'd want to find when searching.</li>
      <li><strong>5 min:</strong> Note any threads where someone describes the exact problem you solve. Save them. Don't reply yet — wait until you have enough karma/reputation in that community.</li>
    </ul>
    <p style="margin-top:10px">Do this for <strong>2 weeks</strong> before mentioning your product anywhere. You're building a reputation, not a sales pipeline.</p>`;
  wrap.appendChild(daily);

  const weekly = el("div", "playbook-block");
  weekly.innerHTML = `<span class="pb-time">30 min / week</span><h3>Weekly review</h3>
    <ul>
      <li>Check profile views on each platform. Are they growing?</li>
      <li>Which answers got upvotes/likes? Double down on that topic.</li>
      <li>Any DMs or replies? Respond within 24 hours.</li>
      <li>Any saved threads where you now have enough reputation to mention your product? Craft a <strong>value-first</strong> response, not a pitch.</li>
      <li>Plan 1-2 posts for the coming week. Space them out across days.</li>
    </ul>`;
  wrap.appendChild(weekly);

  const whenTo = el("div", "playbook-block");
  whenTo.innerHTML = `<h3>When to mention your product</h3>
    <p>The rule: <strong>answer 10 questions before pitching once.</strong> If you've been helpful, people will check your profile. That's where your link lives.</p>
    <ul>
      <li><strong>Someone asks directly</strong> about how to test an idea or build a prototype → mention it, but lead with value.</li>
      <li><strong>You've been active for 2+ weeks</strong> and have karma/reputation → you've earned the right to share.</li>
      <li><strong>Never</strong> post the same pitch in two communities. Adapt the message to each one.</li>
      <li><strong>Never</strong> post and run. Stay for comments in the first hour. It's the most important hour.</li>
    </ul>`;
  wrap.appendChild(whenTo);

  const tips = el("div", "playbook-block");
  tips.innerHTML = `<h3>Channel-specific tips</h3>
    <div class="playbook-grid">
      <div class="playbook-tip"><h4>Reddit</h4><p>Read the subreddit rules before posting. Some ban self-promotion entirely. Use r/SideProject or r/IMadeThis for show-and-tell. Engage in comments, don't just post and leave.</p></div>
      <div class="playbook-tip"><h4>Discord</h4><p>Be a regular. Show up daily, even for 5 minutes. Help in #help channels. When you launch, people will know you. Put your link in your bio, not in every message.</p></div>
      <div class="playbook-tip"><h4>LinkedIn</h4><p>Comment on 5 posts from people in your target market before posting your own. Comments drive profile views. Post from your personal profile, not a company page — the algorithm favors personal accounts.</p></div>
      <div class="playbook-tip"><h4>Twitter/X</h4><p>Reply to bigger accounts in your space. Not "great post!" — add a real point. Replies are the fastest way to build an audience from zero. Thread once a week.</p></div>
      <div class="playbook-tip"><h4>Hacker News</h4><p>One Show HN post, ever. Make it count. Comment on threads related to your space for months beforehand. HN detects and penalizes self-promotion patterns.</p></div>
      <div class="playbook-tip"><h4>Indie Hackers</h4><p>Post a genuine "milestone" update. People love following along. Share real numbers, real failures. The community rewards transparency.</p></div>
    </div>`;
  wrap.appendChild(tips);
}

/* ---------- SEO section rendering ---------- */
function renderSEO() {
  const wrap = document.getElementById("seo-content");
  if (!wrap) return;
  wrap.innerHTML = "";

  const workflow = el("div", "content-block");
  workflow.innerHTML = `<span class="cb-tag">Free workflow</span><h3>Keyword research (no paid tools)</h3>
    <ol>
      <li><strong>Google Keyword Planner</strong> — Free with a Google Ads account (you don't need to run ads). Enter seed keywords like "test startup idea" or "prototype MVP." Note volume and competition.</li>
      <li><strong>Google Search Console</strong> — Already set up? Check which queries Google shows your pages for. These are free, real data — not estimates.</li>
      <li><strong>AnswerThePublic</strong> — Free tier (3 searches/day). Enter a seed keyword and see every question people ask about it. Each question is a potential blog post.</li>
      <li><strong>Reddit search</strong> — Search your topic in relevant subreddits. The questions people ask in Reddit are the same ones they search on Google — but with less competition.</li>
      <li><strong>Google autocomplete</strong> — Type your seed keyword into Google and let autocomplete suggest long-tail variations. Each one is a keyword with intent.</li>
      <li><strong>Manual SERP check</strong> — Search your target keyword. If the top 10 results are weak, outdated, or from big sites with no specific depth, you can rank. If it's all authoritative guides, pick a different keyword.</li>
    </ol>
    <p style="margin-top:10px">Goal: 30-50 rankable keywords in ~2 hours. Pick long-tail (100-1,000 monthly searches) over high-volume terms. Less competition, more intent.</p>`;
  wrap.appendChild(workflow);

  const calendar = el("div", "content-block");
  calendar.innerHTML = `<span class="cb-tag">Content calendar</span><h3>Publishing schedule</h3>
    <p><strong>Cadence:</strong> 2-4 posts per month. Consistency beats volume. One good post per week for 12 weeks beats 10 posts in week one and silence after.</p>
    <ul>
      <li><strong>Week 1:</strong> Long-form guide targeting one long-tail keyword (1,500-2,500 words)</li>
      <li><strong>Week 2:</strong> Short comparison or "vs" post (800-1,200 words) — high intent, easy to rank</li>
      <li><strong>Week 3:</strong> Long-form guide targeting another long-tail keyword</li>
      <li><strong>Week 4:</strong> "How to" or tutorial post — captures problem-aware searchers</li>
    </ul>
    <p style="margin-top:10px">Each post: one target keyword, one search intent, one clear takeaway. Internal link to your service page. Add to your existing 7 guides.</p>`;
  wrap.appendChild(calendar);

  const titles = el("div", "content-block");
  titles.innerHTML = `<span class="cb-tag">Templates</span><h3>Blog post titles that rank</h3>
    <div class="content-grid">
      <div class="content-card"><h4>"How to [task] in [timeframe]"</h4><p>e.g., "How to test a startup idea in 7 days" — captures problem-aware searchers with intent.</p></div>
      <div class="content-card"><h4>"[A] vs [B]: which is right for you?"</h4><p>e.g., "Clickable prototype vs mockup: which is right for you?" — comparison posts rank well and convert.</p></div>
      <div class="content-card"><h4>"[Number] ways to [task] (without [pain])"</h4><p>e.g., "5 ways to validate your app idea without spending $10k" — list posts with a cost-saving angle.</p></div>
      <div class="content-card"><h4>"[Common belief] is wrong. Here's what works."</h4><p>e.g., "MVP-first is wrong. Here's why you should prototype first." — contrarian angle drives clicks and shares.</p></div>
      <div class="content-card"><h4>"The complete guide to [topic] for [audience]"</h4><p>e.g., "The complete guide to prototyping for non-technical founders" — comprehensive, evergreen, ranks long-term.</p></div>
    </div>`;
  wrap.appendChild(titles);

  const aiSearch = el("div", "content-block");
  aiSearch.innerHTML = `<span class="cb-tag">2026 update</span><h3>AI search visibility</h3>
    <p>58.5% of US searches now end without a click. AI Overviews intercept traffic. Here's how to stay visible:</p>
    <ul>
      <li><strong>llms.txt file</strong> — Add an <code>llms.txt</code> file at your root. AI crawlers (ChatGPT, Perplexity, Claude) prioritize it. List your best content.</li>
      <li><strong>Schema markup</strong> — Add JSON-LD structured data to your pages. AI engines use it to understand and cite your content.</li>
      <li><strong>Direct answers</strong> — Structure posts with clear Q&A format. AI engines extract and cite direct answers. If your post answers a question in the first paragraph, you get cited.</li>
      <li><strong>Entity clarity</strong> — Be specific about what you are, who you serve, and what problem you solve. AI engines build entity graphs, not keyword indexes.</li>
      <li><strong>Test with AI</strong> — Ask ChatGPT, Claude, and Perplexity about your topic. See if they cite you. If not, check who they cite and study their content structure.</li>
    </ul>
    <p style="margin-top:10px">Free tool: <a href="https://georion.app/free-tools" target="_blank" rel="noopener noreferrer">Georion free tools</a> — check AI visibility, generate llms.txt, test if AI cites your URL.</p>`;
  wrap.appendChild(aiSearch);
}

/* ---------- Email section rendering ---------- */
function renderEmail() {
  const wrap = document.getElementById("email-content");
  if (!wrap) return;
  wrap.innerHTML = "";

  const magnets = el("div", "content-block");
  magnets.innerHTML = `<span class="cb-tag">Lead magnets</span><h3>5 lead magnet ideas</h3>
    <div class="content-grid">
      <div class="content-card"><h4>Prototype checklist PDF</h4><p>"The 12-point checklist for testing a software idea before building it." 2-page PDF. Converts at 8%+.</p></div>
      <div class="content-card"><h4>Idea evaluation template</h4><p>A simple Notion/Google Doc template founders can copy to evaluate their own idea. Practical, not theoretical.</p></div>
      <div class="content-card"><h4>3-day email course</h4><p>"Test your idea in 3 days" — one short email per day with one action. Day 1: define core assumption. Day 2: build smallest test. Day 3: put it in front of 5 people.</p></div>
      <div class="content-card"><h4>Cost calculator</h4><p>"How much does building the wrong idea cost?" — simple calculator showing time × money wasted. Interactive, shareable.</p></div>
      <div class="content-card"><h4>Prototype brief template</h4><p>The exact template you use to scope prototypes. Founders fill it out, realize they need help, become warm leads.</p></div>
    </div>
    <p style="margin-top:10px"><strong>Free tools:</strong> <a href="https://www.mailerlite.com" target="_blank" rel="noopener noreferrer">MailerLite</a> (free up to 1,000 subscribers, includes landing pages) or <a href="https://convertkit.com" target="_blank" rel="noopener noreferrer">ConvertKit</a> (free up to 10,000 subscribers, no landing pages on free tier).</p>`;
  wrap.appendChild(magnets);

  const sequence = el("div", "content-block");
  sequence.innerHTML = `<span class="cb-tag">Welcome sequence</span><h3>3-email welcome sequence</h3>
    <p><strong>Email 1 (immediate):</strong> Deliver the lead magnet. One paragraph. "Here's your [thing]. Reply and tell me what you're building — I read every reply."</p>
    <p style="margin-top:8px"><strong>Email 2 (day 2):</strong> Short story. "Last year I watched three founders build the wrong thing. Here's what they did wrong, and how to avoid it." 200 words. No pitch.</p>
    <p style="margin-top:8px"><strong>Email 3 (day 4):</strong> Soft pitch. "If you're sitting on an idea and not sure if it's worth building, I can build you a clickable prototype in 7 days. $499. Here's how it works: [link]." One paragraph. Clear CTA. No urgency tricks.</p>
    <p style="margin-top:10px"><strong>Rules:</strong> No weekly newsletter — it becomes unsustainable. Send updates only when there's real news. Each email should be worth reading even if they never buy anything.</p>`;
  wrap.appendChild(sequence);

  const placement = el("div", "content-block");
  placement.innerHTML = `<span class="cb-tag">Placement</span><h3>Where to capture emails</h3>
    <ul>
      <li><strong>Exit-intent popup</strong> on your homepage — offer the lead magnet. Not a "subscribe to our newsletter" (converts at 1%). A specific offer converts at 8%+.</li>
      <li><strong>End of every blog post</strong> — "Want the checklist version of this post? Enter your email."</li>
      <li><strong>Dedicated landing page</strong> — /free or /resources. Drive social traffic here instead of your homepage.</li>
      <li><strong>About page</strong> — People who read your about page are interested. Give them a reason to stay in touch.</li>
      <li><strong>404 page</strong> — Turn a dead end into an email capture. Offer the lead magnet.</li>
    </ul>`;
  wrap.appendChild(placement);
}

/* ---------- UTM Builder ---------- */
function renderUTMBuilder() {
  const wrap = document.getElementById("utm-builder");
  if (!wrap) return;
  wrap.innerHTML = "";

  const form = el("div", "utm-form");
  const fields = [
    { id: "utm-url", label: "Destination URL *", placeholder: "https://promptlaiy.com" },
    { id: "utm-source", label: "Campaign Source *", placeholder: "reddit, twitter, newsletter" },
    { id: "utm-medium", label: "Campaign Medium *", placeholder: "social, email, referral" },
    { id: "utm-campaign", label: "Campaign Name", placeholder: "r-startups-launch, oct-newsletter" },
    { id: "utm-content", label: "Campaign Content", placeholder: "post-1, cta-button, header-link" },
    { id: "utm-term", label: "Campaign Term", placeholder: "prototype-service" },
  ];

  fields.forEach((f) => {
    const field = el("div", "utm-field");
    const label = el("label", null, f.label);
    label.htmlFor = f.id;
    const input = el("input");
    input.id = f.id;
    input.type = "text";
    input.placeholder = f.placeholder;
    input.addEventListener("input", updateUTM);
    field.appendChild(label);
    field.appendChild(input);
    form.appendChild(field);
  });

  wrap.appendChild(form);

  const output = el("div", "utm-output");
  const urlDisplay = el("div", "utm-url empty", "Fill in the fields above to generate a tracked URL...");
  urlDisplay.id = "utm-result";
  output.appendChild(urlDisplay);

  const actions = el("div", "utm-actions");
  const copyUTM = el("button", "copy-btn", "Copy URL");
  copyUTM.id = "utm-copy";
  copyUTM.addEventListener("click", () => {
    const url = document.getElementById("utm-result").textContent;
    if (url && !url.startsWith("Fill in")) copyToClipboard(url, copyUTM);
  });
  actions.appendChild(copyUTM);

  const clearUTM = el("button", "copy-btn", "Clear");
  clearUTM.addEventListener("click", () => {
    fields.forEach((f) => { document.getElementById(f.id).value = ""; });
    updateUTM();
  });
  actions.appendChild(clearUTM);
  output.appendChild(actions);

  const recentLabel = el("div", null, "Recent links (saved locally):");
  recentLabel.style.fontSize = "12px";
  recentLabel.style.fontWeight = "700";
  recentLabel.style.color = "var(--muted)";
  output.appendChild(recentLabel);

  const recent = el("div", "utm-recent");
  recent.id = "utm-recent";
  output.appendChild(recent);

  wrap.appendChild(output);
  renderRecentUTMs();
}

function updateUTM() {
  const url = document.getElementById("utm-url").value.trim();
  const source = document.getElementById("utm-source").value.trim();
  const medium = document.getElementById("utm-medium").value.trim();
  const campaign = document.getElementById("utm-campaign").value.trim();
  const content = document.getElementById("utm-content").value.trim();
  const term = document.getElementById("utm-term").value.trim();
  const result = document.getElementById("utm-result");

  if (!url || !source || !medium) {
    result.textContent = "Fill in URL, Source, and Medium to generate a tracked URL...";
    result.classList.add("empty");
    return;
  }

  const params = new URLSearchParams();
  params.set("utm_source", source);
  params.set("utm_medium", medium);
  if (campaign) params.set("utm_campaign", campaign);
  if (content) params.set("utm_content", content);
  if (term) params.set("utm_term", term);

  const separator = url.includes("?") ? "&" : "?";
  const final = url + separator + params.toString();
  result.textContent = final;
  result.classList.remove("empty");

  const copyBtn = document.getElementById("utm-copy");
  copyBtn.onclick = () => {
    copyToClipboard(final, copyBtn);
    saveUTM(final);
  };
}

function saveUTM(url) {
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem("pl_utm_links") || "[]"); } catch {}
  if (saved[0] === url) return;
  saved.unshift(url);
  saved = saved.slice(0, 10);
  try { localStorage.setItem("pl_utm_links", JSON.stringify(saved)); } catch {}
  renderRecentUTMs();
}

function renderRecentUTMs() {
  const wrap = document.getElementById("utm-recent");
  if (!wrap) return;
  wrap.innerHTML = "";
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem("pl_utm_links") || "[]"); } catch {}
  if (!saved.length) {
    wrap.appendChild(el("div", null, "No saved links yet."));
    wrap.firstChild.style.fontSize = "12px";
    wrap.firstChild.style.color = "var(--muted)";
    return;
  }
  saved.forEach((url) => {
    const item = el("div", "utm-recent-item");
    const urlSpan = el("span", "utm-recent-url", url);
    item.appendChild(urlSpan);
    const copyBtn = el("button", "copy-btn", "Copy");
    copyBtn.addEventListener("click", () => copyToClipboard(url, copyBtn));
    item.appendChild(copyBtn);
    wrap.appendChild(item);
  });
}

/* ---------- Export all posts ---------- */
function exportAllPosts() {
  const sections = [
    { label: "REDDIT", posts: POSTS.reddit },
    { label: "DISCORD", posts: POSTS.discord },
    { label: "FACEBOOK GROUPS", posts: POSTS.facebook },
    { label: "TWITTER / X", posts: POSTS.twitter },
    { label: "HACKER NEWS & INDIE HACKERS", posts: POSTS.hn },
    { label: "LINKEDIN", posts: POSTS.linkedin },
    { label: "PRODUCT HUNT", posts: POSTS.ph },
    { label: "COLD OUTREACH (DMs & EMAIL)", posts: POSTS.outreach },
    { label: "QUORA & ANSWER SITES", posts: POSTS.quora },
    { label: "PARTNERSHIP & CROSS-PROMO", posts: POSTS.partner },
    { label: "PRESS & HARO", posts: POSTS.press },
  ];

  let out = "PROMPTLAIY — MARKETING HQ EXPORT\n";
  out += "All post templates formatted as they'd appear on each platform.\n";
  out += "Delete bracketed [notes] before posting. Adapt tone to each community.\n";
  out += "=" .repeat(60) + "\n\n";

  sections.forEach((section) => {
    out += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    out += "  " + section.label + "\n";
    out += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
    section.posts.forEach((post) => {
      out += "▶ " + post.title + "\n";
      out += "  Tag: " + post.tag + "\n";
      out += "-" .repeat(50) + "\n";
      out += post.body + "\n\n";
      out += "-" .repeat(50) + "\n\n";
    });
  });

  return out;
}

/* ---------- Render marketing content on unlock ---------- */
const originalUnlock = unlock;
unlock = function () {
  originalUnlock();
  renderPosts("reddit-posts", POSTS.reddit, "reddit");
  renderPosts("discord-posts", POSTS.discord, "discord");
  renderPosts("facebook-posts", POSTS.facebook, "facebook");
  renderPosts("twitter-posts", POSTS.twitter, "twitter");
  renderPosts("hn-posts", POSTS.hn, "hn");
  renderPosts("linkedin-posts", POSTS.linkedin, "linkedin");
  renderPosts("ph-posts", POSTS.ph, "ph");
  renderPosts("outreach-posts", POSTS.outreach, "twitter");
  renderPosts("quora-posts", POSTS.quora, "hn");
  renderPosts("partner-posts", POSTS.partner, "linkedin");
  renderPosts("press-posts", POSTS.press, "linkedin");
  renderPlaybook();
  renderSEO();
  renderEmail();
  renderUTMBuilder();
  renderChecklist("promo-checklist", CHECKLIST, "pl_promo_checklist");
  renderChecklist("directory-checklist", DIRECTORIES, "pl_directory_checklist");

  const exportBtn = document.getElementById("export-all-btn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const text = exportAllPosts();
      copyToClipboard(text, exportBtn);
    });
  }
};

/* ---------- Boot ---------- */
if (token()) {
  unlock();
} else {
  $("#token").focus();
}
