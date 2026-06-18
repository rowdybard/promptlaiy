(function () {
  if (location.pathname.indexOf("/admin") === 0) return;

  function sessionId() {
    try {
      var key = "pl_sid";
      var existing = sessionStorage.getItem(key);
      if (existing) return existing;
      var id = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random().toString(16).slice(2);
      sessionStorage.setItem(key, id);
      return id;
    } catch (e) {
      return "";
    }
  }

  var params = new URLSearchParams(location.search);
  var sid = sessionId();

  function send(payload) {
    payload.sessionId = sid;
    payload.path = location.pathname;
    try {
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
        credentials: "omit",
      }).catch(function () {});
    } catch (e) {
      /* tracking never breaks the page */
    }
  }

  send({
    type: "pageview",
    referrer: document.referrer || "",
    utmSource: params.get("utm_source") || "",
    utmMedium: params.get("utm_medium") || "",
    utmCampaign: params.get("utm_campaign") || "",
  });

  function labelFor(el) {
    if (el.dataset && el.dataset.track) return el.dataset.track.slice(0, 60);
    var href = (el.getAttribute && el.getAttribute("href")) || "";
    var text = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (href.indexOf("#apply") !== -1 || /apply for a build|send project brief/i.test(text)) return "apply_cta";
    if (href && href.charAt(0) !== "#" && /^https?:|^\//.test(href)) {
      return (text ? text.slice(0, 40) + " \u2192 " : "") + href.slice(0, 60);
    }
    return text.slice(0, 60) || (el.getAttribute && el.getAttribute("aria-label")) || "click";
  }

  document.addEventListener(
    "click",
    function (event) {
      var el = event.target.closest ? event.target.closest("a, button, [data-track]") : null;
      if (!el) return;
      if (el.type === "submit" && el.id === "next-button") return;
      send({ type: "click", target: labelFor(el) });
    },
    true
  );
})();
