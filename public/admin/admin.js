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
function lock(message) {
  if (state.timer) clearInterval(state.timer);
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
}

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const value = $("#token").value.trim();
  if (!value) return;
  try {
    sessionStorage.setItem(TOKEN_KEY, value);
  } catch {}
  $("#login-error").hidden = true;
  const probe = await fetch("/api/admin/stats?range=1d", {
    headers: { Authorization: "Bearer " + value },
  });
  if (!probe.ok) {
    lock(probe.status === 401 ? "Invalid token." : "Could not reach the server.");
    return;
  }
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

/* ---------- Boot ---------- */
if (token()) {
  unlock();
} else {
  $("#token").focus();
}
