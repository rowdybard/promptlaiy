(function () {
  var finePointer = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var compactViewport = window.matchMedia && window.matchMedia("(max-width: 700px)").matches;
  if (!finePointer || reducedMotion || compactViewport) return;

  var ring = document.createElement("span");
  var core = document.createElement("span");
  ring.className = "chrome-cursor";
  core.className = "chrome-cursor-core";
  ring.setAttribute("aria-hidden", "true");
  core.setAttribute("aria-hidden", "true");
  document.body.appendChild(ring);
  document.body.appendChild(core);
  document.body.classList.add("has-chrome-cursor");

  var targetX = -80;
  var targetY = -80;
  var ringX = targetX;
  var ringY = targetY;
  var coreX = targetX;
  var coreY = targetY;
  var visible = false;
  var running = false;

  function paint() {
    ringX += (targetX - ringX) * 0.2;
    ringY += (targetY - ringY) * 0.2;
    coreX += (targetX - coreX) * 0.48;
    coreY += (targetY - coreY) * 0.48;
    ring.style.transform = "translate3d(" + ringX + "px," + ringY + "px,0) translate(-50%,-50%)";
    core.style.transform = "translate3d(" + coreX + "px," + coreY + "px,0) translate(-50%,-50%)";
    if (Math.abs(targetX - ringX) > 0.1 || Math.abs(targetY - ringY) > 0.1) {
      requestAnimationFrame(paint);
    } else {
      running = false;
    }
  }

  function ensurePaint() {
    if (running) return;
    running = true;
    requestAnimationFrame(paint);
  }

  function setHoverState(node) {
    var interactive = node && node.closest("a, button, summary, [role='button'], [data-cursor]");
    var field = node && node.closest("input, textarea, select");
    ring.classList.toggle("is-interactive", Boolean(interactive));
    core.classList.toggle("is-interactive", Boolean(interactive));
    ring.classList.toggle("is-field", Boolean(field));
    core.classList.toggle("is-field", Boolean(field));
  }

  window.addEventListener(
    "pointermove",
    function (event) {
      targetX = event.clientX;
      targetY = event.clientY;
      if (!visible) {
        visible = true;
        ring.classList.add("is-visible");
        core.classList.add("is-visible");
      }
      setHoverState(event.target);
      ensurePaint();
    },
    { passive: true }
  );

  document.addEventListener("pointerdown", function () {
    ring.classList.add("is-pressed");
  });
  document.addEventListener("pointerup", function () {
    ring.classList.remove("is-pressed");
  });
  document.documentElement.addEventListener("mouseleave", function () {
    visible = false;
    ring.classList.remove("is-visible");
    core.classList.remove("is-visible");
  });

  document.querySelectorAll(".button, .nav-cta, .btn, .seg-btn").forEach(function (node) {
    node.classList.add("chrome-magnetic");
    node.addEventListener("pointermove", function (event) {
      var rect = node.getBoundingClientRect();
      var x = (event.clientX - rect.left) / rect.width - 0.5;
      var y = (event.clientY - rect.top) / rect.height - 0.5;
      node.style.setProperty("--mag-x", x * 7 + "px");
      node.style.setProperty("--mag-y", y * 5 + "px");
    });
    node.addEventListener("pointerleave", function () {
      node.style.setProperty("--mag-x", "0px");
      node.style.setProperty("--mag-y", "0px");
    });
  });

  var publicSurfaces = ".output-preview, .deliverable-list article, .price-main, .price-addons article, .faq-list details, .application-shell, .article-cta";
  var adminSurfaces = ".panel, .kpi, .reply";
  var surfaceSelector = document.body.classList.contains("admin") ? adminSurfaces : publicSurfaces;

  function enhanceSurface(node) {
    if (node.classList.contains("chrome-reactive")) return;
    var glint = document.createElement("span");
    glint.className = "chrome-glint";
    glint.setAttribute("aria-hidden", "true");
    node.classList.add("chrome-reactive");
    node.appendChild(glint);
    node.addEventListener("pointermove", function (event) {
      var rect = node.getBoundingClientRect();
      node.style.setProperty("--light-x", event.clientX - rect.left + "px");
      node.style.setProperty("--light-y", event.clientY - rect.top + "px");
      node.style.setProperty("--glint-opacity", "1");
    });
    node.addEventListener("pointerleave", function () {
      node.style.setProperty("--glint-opacity", "0");
    });
  }

  document.querySelectorAll(surfaceSelector).forEach(enhanceSurface);
  new MutationObserver(function (records) {
    records.forEach(function (record) {
      record.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        if (node.matches(surfaceSelector)) enhanceSurface(node);
        node.querySelectorAll(surfaceSelector).forEach(enhanceSurface);
      });
    });
  }).observe(document.body, { childList: true, subtree: true });
})();
