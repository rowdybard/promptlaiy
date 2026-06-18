(function () {
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- Scroll progress bar ---- */
  var bar = document.createElement("div");
  bar.className = "scroll-progress";
  bar.setAttribute("aria-hidden", "true");
  document.body.appendChild(bar);

  var ticking = false;
  function updateBar() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - doc.clientHeight;
    var pct = max > 0 ? (doc.scrollTop || window.scrollY) / max : 0;
    bar.style.transform = "scaleX(" + Math.min(1, Math.max(0, pct)) + ")";
    var topbar = document.querySelector(".topbar");
    if (topbar) topbar.classList.toggle("is-scrolled", (doc.scrollTop || window.scrollY) > 18);
    ticking = false;
  }
  window.addEventListener(
    "scroll",
    function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateBar);
      }
    },
    { passive: true }
  );
  updateBar();

  if (reduce) return;

  /* ---- Scroll reveal ---- */
  document.body.classList.add("js-reveal");

  var SELECTORS = [
    ".hero-copy > *",
    ".output-preview",
    ".promise-strip",
    ".section-heading",
    ".deliverable-list article",
    ".process li",
    ".scope-band > div",
    ".price-main",
    ".price-addons article",
    ".faq-list details",
    ".faq-reads",
    ".application-heading",
    ".application-shell",
    ".article > *",
  ];

  var nodes = [];
  SELECTORS.forEach(function (sel) {
    document.querySelectorAll(sel).forEach(function (n) {
      if (nodes.indexOf(n) === -1) nodes.push(n);
    });
  });

  var groupCount = new Map();
  nodes.forEach(function (n) {
    n.classList.add("reveal");
    var p = n.parentElement;
    var i = groupCount.get(p) || 0;
    groupCount.set(p, i + 1);
    n.style.setProperty("--rd", Math.min(i, 6) * 60 + "ms");
  });

  if (!("IntersectionObserver" in window)) {
    nodes.forEach(function (n) {
      n.classList.add("in");
    });
  } else {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    nodes.forEach(function (n) {
      io.observe(n);
    });
  }

  function revealVisible() {
    nodes.forEach(function (node) {
      if (node.classList.contains("in")) return;
      var rect = node.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.94 && rect.bottom > 0) node.classList.add("in");
    });
  }
  window.addEventListener("scroll", revealVisible, { passive: true });
  window.addEventListener("resize", revealVisible);
  setTimeout(revealVisible, 500);

  /* ---- Pointer tilt on the delivery preview ---- */
  var preview = document.querySelector(".output-preview");
  if (preview && window.matchMedia("(pointer: fine)").matches) {
    var frame;
    preview.style.transformStyle = "preserve-3d";
    preview.addEventListener("pointermove", function (e) {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(function () {
        var r = preview.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        preview.style.transform =
          "perspective(900px) rotateY(" + px * 5 + "deg) rotateX(" + -py * 5 + "deg) translateY(-4px)";
      });
    });
    preview.addEventListener("pointerleave", function () {
      if (frame) cancelAnimationFrame(frame);
      preview.style.transform = "";
    });
  }

  var hero = document.querySelector(".hero");
  if (hero && window.matchMedia("(pointer: fine)").matches) {
    hero.addEventListener("pointermove", function (event) {
      var rect = hero.getBoundingClientRect();
      var x = (event.clientX - rect.left) / rect.width - 0.5;
      var y = (event.clientY - rect.top) / rect.height - 0.5;
      hero.style.setProperty("--hero-pan-x", x * 18 + "px");
      hero.style.setProperty("--hero-pan-y", y * 12 + "px");
      hero.style.setProperty("--hero-pan-back-x", x * -12 + "px");
      hero.style.setProperty("--hero-pan-back-y", y * -8 + "px");
    });
    hero.addEventListener("pointerleave", function () {
      hero.style.setProperty("--hero-pan-x", "0px");
      hero.style.setProperty("--hero-pan-y", "0px");
      hero.style.setProperty("--hero-pan-back-x", "0px");
      hero.style.setProperty("--hero-pan-back-y", "0px");
    });
  }
})();
