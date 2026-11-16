(() => {
  const root = document.documentElement;
  const nav = document.getElementById("nav");
  const themeBtn = document.getElementById("themeToggle");
  const meta = document.querySelector('meta[name="theme-color"]');
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  let frame = null;

  const media = (p) => (window.otterMedia ? window.otterMedia(p) : p);
  const face = (key) => (window.otterExpr ? window.otterExpr(`anim/270/${key}.webp`) : `anim/270/${key}.webp`);

  const theme = () => (root.getAttribute("data-theme") === "light" ? "light" : "dark");
  const applyTheme = (next) => {
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("gt_site_theme", next); } catch (_) {}
    if (meta) meta.setAttribute("content", next === "light" ? "#F5F4F8" : "#0B0A14");
    $$("img[data-shot-dark]").forEach((img) => {
      const src = next === "light" ? img.dataset.shotLight : img.dataset.shotDark;
      if (src) img.src = media(src);
    });
    if (frame && frame.contentWindow) {
      frame.contentWindow.postMessage({ type: "otter-demo", action: "theme", value: next === "light" ? "day" : "night" }, "*");
    }
  };
  themeBtn?.addEventListener("click", () => applyTheme(theme() === "light" ? "dark" : "light"));
  applyTheme(theme());

  // greet
  const greets = [
    { t: "今晚开一局？我帮你记着。", f: "wave" },
    { t: "水位刚刚好，可以安心玩一会儿。", f: "happy" },
    { t: "收工了就把高光收进来吧。", f: "celebrate" },
    { t: "忙完了也记得歇一歇。", f: "sleep" },
  ];
  let gi = 0;
  $("#greet")?.addEventListener("click", () => {
    gi = (gi + 1) % greets.length;
    $("#greetText").textContent = greets[gi].t;
    const el = $("#greetFace");
    if (el) {
      el.dataset.expr = `anim/270/${greets[gi].f}.webp`;
      el.src = face(greets[gi].f);
    }
  });

  // companion day
  const DAYS = [
    {
      title: "专心打完这局",
      cmd: "focus · 开战",
      say: "计时在烧，她坐在旁边。收工时，一眼能看见你刚刚走完的路。",
      face: "focus",
      shots: ["shots/timer.webp", "shots/home.webp", "shots/compose.webp"],
    },
    {
      title: "今天花在哪",
      cmd: "pond · 水位",
      say: "池水慢慢涨起来。不是报表，是一眼就懂的水位。",
      face: "happy",
      shots: ["shots/home.webp", "shots/calendar.webp", "shots/desk.webp"],
    },
    {
      title: "把高光留下来",
      cmd: "keep · 藏品",
      say: "通关、宵夜、雨停——贴上墙，翻开还有当晚的温度。",
      face: "celebrate",
      shots: ["shots/gallery.webp", "shots/compose.webp", "memories/life_ramen.webp"],
    },
    {
      title: "道一声晚安",
      cmd: "rest · 晚安",
      say: "忙完了，她也记得歇一歇。明天的池水，从零再涨。",
      face: "sleep",
      shots: ["shots/me.webp", "shots/about.webp", "scenes/scene-companion-mood.webp"],
    },
  ];
  let dayCur = 0;
  const dayShow = (i) => {
    dayCur = i;
    const d = DAYS[i];
    $$(".day-list button").forEach((b, idx) => b.setAttribute("aria-selected", String(idx === i)));
    $("#day-title").textContent = d.title;
    $("#day-say").textContent = d.say;
    if ($("#day-cmd")) $("#day-cmd").textContent = d.cmd;
    const faceEl = $("#day-face");
    if (faceEl) {
      faceEl.dataset.expr = `anim/270/${d.face}.webp`;
      faceEl.src = face(d.face);
    }
    $("#day-shots").innerHTML = d.shots.map((s) => `<img src="${media(s)}" alt="" />`).join("");
  };
  $(".day-list")?.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-i]");
    if (!b) return;
    dayShow(+b.dataset.i);
  });
  dayShow(0);

  // reveal：用 class，避免 inline opacity:0 卡死；超时兜底全显，并唤醒懒图
  const reveal = () => {
    const nodes = [...document.querySelectorAll("[data-in]")];
    const show = (n) => {
      n.classList.add("is-in");
      n.style.visibility = "visible";
      n.querySelectorAll("img[loading='lazy']").forEach((img) => {
        img.loading = "eager";
        if (!img.complete) {
          const src = img.currentSrc || img.src;
          if (src) img.src = src;
        }
      });
    };
    if (!root.classList.contains("motion") || reduce) {
      nodes.forEach(show);
      root.classList.add("ready");
      return;
    }
    nodes.forEach((n, i) => {
      n.style.setProperty("--in-delay", `${Math.min(i % 5, 4) * 50}ms`);
      n.style.visibility = "visible";
    });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        show(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: 0.01, rootMargin: "120px 0px 120px 0px" });
    nodes.forEach((n) => io.observe(n));
    // 兜底：2.5s 后仍未入场的全部显示，防止图片一直空白
    setTimeout(() => {
      nodes.forEach((n) => { if (!n.classList.contains("is-in")) show(n); });
      io.disconnect();
    }, 2500);
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
  let demoPage = "home";
  let demoTheme = "night";

  const syncDemoUI = (page, th) => {
    if (page) demoPage = page;
    if (th) demoTheme = th === "day" || th === "light" ? "day" : "night";
    $$('[data-group="page"] .chip').forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.v === demoPage)));
    $$('[data-group="theme"] .chip').forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.v === demoTheme)));
    if ($("#ro-text")) $("#ro-text").textContent = `${PAGE[demoPage] || demoPage} · ${demoTheme === "day" ? "浅色" : "深色"}`;
  };

  const send = (action, value) => {
    if (frame?.contentWindow) frame.contentWindow.postMessage({ type: "otter-demo", action, value }, "*");
  };

  startBtn?.addEventListener("click", () => {
    frame = document.createElement("iframe");
    const th = theme() === "light" ? "light" : "dark";
    demoTheme = th === "light" ? "day" : "night";
    demoPage = "home";
    frame.src = `demo/index.html?embed&nosplash&theme=${th}&p=home`;
    frame.title = "水獭游时真机演示";
    frame.setAttribute("allow", "autoplay; clipboard-write");
    view.appendChild(frame);
    $("#ro-text").textContent = "正在点亮…";
    frame.addEventListener("load", () => {
      startBtn.remove();
      $$("button[disabled]", panel).forEach((b) => { b.disabled = false; });
      syncDemoUI(demoPage, demoTheme);
      // 同源主动拉一次状态，避免首包 postMessage 丢失
      try {
        send("page", demoPage);
        send("theme", demoTheme);
      } catch (_) {}
      frame.focus();
    });
  });

  panel?.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-a]");
    if (!b || b.disabled) return;
    if (b.dataset.a === "reset") {
      $("#ro-text").textContent = "正在点亮…";
      frame.src = frame.src;
      return;
    }
    if (b.dataset.a === "page") syncDemoUI(b.dataset.v, demoTheme);
    if (b.dataset.a === "theme") syncDemoUI(demoPage, b.dataset.v);
    send(b.dataset.a, b.dataset.v);
  });

  addEventListener("message", (e) => {
    const d = e.data;
    if (!d || d.type !== "otter-demo-state" || !frame) return;
    if (e.source && e.source !== frame.contentWindow) return;
    const page = d.page || demoPage;
    const th = d.theme === "day" || d.theme === "light" ? "day" : "night";
    syncDemoUI(page, th);
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
