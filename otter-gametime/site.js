(() => {
  const root = document.documentElement;
  const nav = document.getElementById("nav");
  const phone = document.getElementById("phone3d");
  const stage = document.getElementById("stage");
  const themeBtn = document.getElementById("themeToggle");
  const meta = document.querySelector('meta[name="theme-color"]');
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));

  const theme = () => root.getAttribute("data-theme") === "light" ? "light" : "dark";

  const applyTheme = (next) => {
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("gt_site_theme", next); } catch (_) {}
    if (meta) meta.setAttribute("content", next === "light" ? "#F5F4F8" : "#0B0A14");
    $$("img[data-shot-dark]").forEach((img) => {
      const src = next === "light" ? img.dataset.shotLight : img.dataset.shotDark;
      if (src) img.src = src;
    });
    const hero = $("#heroFrame");
    if (hero && hero.contentWindow) {
      hero.contentWindow.postMessage({ type: "otter-demo", action: "theme", value: next === "light" ? "day" : "night" }, "*");
    }
  };

  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      applyTheme(theme() === "light" ? "dark" : "light");
    });
  }
  applyTheme(theme());

  const reveal = () => {
    const nodes = [...document.querySelectorAll("[data-in]")];
    if (!root.classList.contains("motion") || reduce) {
      nodes.forEach((n) => { n.style.visibility = "visible"; });
      root.classList.add("ready");
      return;
    }
    nodes.forEach((n) => {
      n.style.opacity = "0";
      n.style.transform = "translateY(24px) scale(.98)";
      n.style.transition = "opacity 820ms cubic-bezier(.22,1,.36,1), transform 820ms cubic-bezier(.22,1,.36,1)";
      n.style.visibility = "visible";
    });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.style.opacity = "1";
        e.target.style.transform = "translateY(0) scale(1)";
        io.unobserve(e.target);
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -5% 0px" });
    nodes.forEach((n, i) => {
      n.style.transitionDelay = `${Math.min(i % 5, 4) * 55}ms`;
      io.observe(n);
    });
    root.classList.add("ready");
  };

  const onScroll = () => {
    if (nav) nav.classList.toggle("scrolled", window.scrollY > 8);
  };

  // subtle tilt — disabled while pointer is over iframe to keep clicks crisp
  if (phone && stage && !reduce) {
    let tx = 0, ty = 0, cx = 0, cy = 0, over = false;
    stage.addEventListener("pointerenter", () => { over = true; });
    stage.addEventListener("pointerleave", () => { over = false; tx = 0; ty = 0; });
    stage.addEventListener("pointermove", (e) => {
      if (e.target.closest("iframe")) { tx = 0; ty = 0; return; }
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      tx = x * 8;
      ty = -y * 6;
    });
    const loop = () => {
      cx += (tx - cx) * 0.1;
      cy += (ty - cy) * 0.1;
      phone.style.transform = over ? `rotateX(${cy}deg) rotateY(${cx}deg)` : "none";
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // compare slider
  const compare = $("#compare");
  if (compare) {
    const input = $("input", compare);
    const sync = () => compare.style.setProperty("--p", input.value + "%");
    input.addEventListener("input", sync);
    sync();
  }

  // live demo iframe
  const view = $("#demo-view");
  const panel = $("#panel");
  const startBtn = $("#demo-start");
  let frame = null;
  const PAGE = { home: "此刻", timer: "开战", gallery: "藏品", me: "我" };

  const send = (action, value) => {
    if (frame && frame.contentWindow) {
      frame.contentWindow.postMessage({ type: "otter-demo", action, value }, "*");
    }
  };

  if (startBtn && view && panel) {
    startBtn.addEventListener("click", () => {
      frame = document.createElement("iframe");
      const th = theme() === "light" ? "light" : "dark";
      frame.src = `demo/index.html?embed&nosplash&theme=${th}&p=home`;
      frame.title = "水獭游时交互演示";
      frame.setAttribute("allow", "autoplay; clipboard-write");
      view.appendChild(frame);
      $("#ro-text").textContent = "正在载入…";
      frame.addEventListener("load", () => {
        startBtn.remove();
        $$("button[disabled]", panel).forEach((b) => { b.disabled = false; });
        frame.focus();
      });
    });

    panel.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-a]");
      if (!b || b.disabled) return;
      if (b.dataset.a === "reset") {
        frame.src = frame.src;
        return;
      }
      send(b.dataset.a, b.dataset.v);
    });
  }

  addEventListener("message", (e) => {
    const d = e.data;
    if (!d || d.type !== "otter-demo-state") return;
    if (frame && e.source === frame.contentWindow) {
      $$('[data-group="page"] .chip').forEach((c) => {
        c.setAttribute("aria-pressed", String(c.dataset.v === d.page));
      });
      $$('[data-group="theme"] .chip').forEach((c) => {
        c.setAttribute("aria-pressed", String(c.dataset.v === d.theme));
      });
      $("#ro-text").textContent = `${PAGE[d.page] || d.page} · ${d.theme === "day" ? "浅色" : "深色"}`;
    }
  });

  $$("[data-store]").forEach((a) => {
    a.addEventListener("click", (e) => {
      if (!a.dataset.hrefReady) e.preventDefault();
    });
  });

  const list = $("#changelog");
  if (list) {
    fetch("../family.json")
      .then((r) => r.json())
      .then((d) => {
        const rows = d?.apps?.["otter-gametime"]?.changelog;
        if (!Array.isArray(rows) || !rows.length) return;
        list.innerHTML = rows.slice(0, 5).map((c) => `
          <li>
            <b>v${c.version}</b>
            <time datetime="${c.date}">${String(c.date).slice(5)}</time>
            <span>${c.zh}</span>
          </li>`).join("");
      })
      .catch(() => {});
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  reveal();
})();
