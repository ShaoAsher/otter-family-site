(() => {
  const root = document.documentElement;
  const nav = document.getElementById("nav");
  const themeBtn = document.getElementById("themeToggle");
  const meta = document.querySelector('meta[name="theme-color"]');
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  let frame = null;

  const theme = () => (root.getAttribute("data-theme") === "light" ? "light" : "dark");
  const applyTheme = (next) => {
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("gt_site_theme", next); } catch (_) {}
    if (meta) meta.setAttribute("content", next === "light" ? "#F5F4F8" : "#0B0A14");
    $$("img[data-shot-dark]").forEach((img) => {
      const src = next === "light" ? img.dataset.shotLight : img.dataset.shotDark;
      if (src) img.src = src;
    });
    if (frame && frame.contentWindow) {
      frame.contentWindow.postMessage({ type: "otter-demo", action: "theme", value: next === "light" ? "day" : "night" }, "*");
    }
  };
  themeBtn?.addEventListener("click", () => applyTheme(theme() === "light" ? "dark" : "light"));
  applyTheme(theme());

  // greet
  const greets = [
    { t: "今晚开一局？我帮你记着。", f: "media/expr/wave.webp" },
    { t: "水位刚刚好，可以安心玩一会儿。", f: "media/expr/happy.webp" },
    { t: "收工了就把高光收进来吧。", f: "media/expr/celebrate.webp" },
    { t: "忙完了也记得歇一歇。", f: "media/expr/sleep.webp" },
  ];
  let gi = 0;
  $("#greet")?.addEventListener("click", () => {
    gi = (gi + 1) % greets.length;
    $("#greetText").textContent = greets[gi].t;
    $("#greetFace").src = greets[gi].f;
  });

  // companion day
  const DAYS = [
    {
      title: "专心打完这局",
      say: "计时在烧，她坐在旁边。收工时，一眼能看见你刚刚走完的路。",
      face: "media/expr/focus.webp",
      shots: ["media/shots/timer.webp", "media/shots/home.webp", "media/shots/compose.webp"],
    },
    {
      title: "今天花在哪",
      say: "池水慢慢涨起来。不是报表，是一眼就懂的水位。",
      face: "media/expr/happy.webp",
      shots: ["media/shots/home.webp", "media/shots/calendar.webp", "media/shots/desk.webp"],
    },
    {
      title: "把高光留下来",
      say: "通关、宵夜、雨停——贴上墙，翻开还有当晚的温度。",
      face: "media/expr/celebrate.webp",
      shots: ["media/shots/gallery.webp", "media/shots/compose.webp", "media/memories/life_ramen.webp"],
    },
    {
      title: "道一声晚安",
      say: "忙完了，她也记得歇一歇。明天的池水，从零再涨。",
      face: "media/expr/sleep.webp",
      shots: ["media/shots/me.webp", "media/shots/about.webp", "media/scenes/scene-companion-mood.webp"],
    },
  ];
  let dayCur = 0;
  const dayShow = (i) => {
    dayCur = i;
    const d = DAYS[i];
    $$(".day-list button").forEach((b, idx) => b.setAttribute("aria-selected", String(idx === i)));
    $("#day-title").textContent = d.title;
    $("#day-say").textContent = d.say;
    $("#day-face").src = d.face;
    $("#day-shots").innerHTML = d.shots.map((s) => `<img src="${s}" alt="" loading="lazy" />`).join("");
  };
  $(".day-list")?.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-i]");
    if (!b) return;
    dayShow(+b.dataset.i);
  });
  dayShow(0);

  // reveal
  const reveal = () => {
    const nodes = [...document.querySelectorAll("[data-in]")];
    if (!root.classList.contains("motion") || reduce) {
      nodes.forEach((n) => { n.style.visibility = "visible"; });
      root.classList.add("ready");
      return;
    }
    nodes.forEach((n) => {
      n.style.opacity = "0";
      n.style.transform = "translateY(22px) scale(.985)";
      n.style.transition = "opacity 780ms cubic-bezier(.22,1,.36,1), transform 780ms cubic-bezier(.22,1,.36,1)";
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
      n.style.transitionDelay = `${Math.min(i % 5, 4) * 50}ms`;
      io.observe(n);
    });
    root.classList.add("ready");
  };

  // compare
  const compare = $("#compare");
  if (compare) {
    const input = $("input", compare);
    const sync = () => compare.style.setProperty("--p", input.value + "%");
    input.addEventListener("input", sync);
    sync();
  }

  // device demo
  const view = $("#device-view");
  const panel = $("#panel");
  const startBtn = $("#demo-start");
  const PAGE = { home: "此刻", timer: "开战", gallery: "藏品", me: "我" };

  const send = (action, value) => {
    if (frame?.contentWindow) frame.contentWindow.postMessage({ type: "otter-demo", action, value }, "*");
  };

  startBtn?.addEventListener("click", () => {
    frame = document.createElement("iframe");
    const th = theme() === "light" ? "light" : "dark";
    frame.src = `demo/index.html?embed&nosplash&theme=${th}&p=home`;
    frame.title = "水獭游时真机演示";
    frame.setAttribute("allow", "autoplay; clipboard-write");
    view.appendChild(frame);
    $("#ro-text").textContent = "正在点亮…";
    frame.addEventListener("load", () => {
      startBtn.remove();
      $$("button[disabled]", panel).forEach((b) => { b.disabled = false; });
      frame.focus();
    });
  });

  panel?.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-a]");
    if (!b || b.disabled) return;
    if (b.dataset.a === "reset") { frame.src = frame.src; return; }
    send(b.dataset.a, b.dataset.v);
  });

  addEventListener("message", (e) => {
    const d = e.data;
    if (!d || d.type !== "otter-demo-state" || !frame || e.source !== frame.contentWindow) return;
    $$('[data-group="page"] .chip').forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.v === d.page)));
    $$('[data-group="theme"] .chip').forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.v === d.theme)));
    $("#ro-text").textContent = `${PAGE[d.page] || d.page} · ${d.theme === "day" ? "浅色" : "深色"}`;
  });

  $$("[data-store]").forEach((a) => {
    a.addEventListener("click", (e) => { if (!a.dataset.hrefReady) e.preventDefault(); });
  });

  const list = $("#changelog");
  if (list) {
    fetch("../family.json")
      .then((r) => r.json())
      .then((d) => {
        const rows = d?.apps?.["otter-gametime"]?.changelog;
        if (!Array.isArray(rows) || !rows.length) return;
        list.innerHTML = rows.slice(0, 5).map((c) => `
          <li><b>v${c.version}</b><time datetime="${c.date}">${String(c.date).slice(5)}</time><span>${c.zh}</span></li>`).join("");
      })
      .catch(() => {});
  }

  window.addEventListener("scroll", () => nav?.classList.toggle("scrolled", scrollY > 8), { passive: true });
  nav?.classList.toggle("scrolled", scrollY > 8);
  reveal();
})();
