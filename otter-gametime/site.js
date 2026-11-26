(() => {
  const root = document.documentElement;
  const nav = document.getElementById("nav");
  const themeBtn = document.getElementById("themeToggle");
  const meta = document.querySelector('meta[name="theme-color"]');
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  let frame = null;

  const media = (p) => (window.otterMedia ? window.otterMedia(p) : `media/${p}`);
  const face = (key) =>
    window.otterExpr ? window.otterExpr(`anim/270/${key}.webp`) : `media/expr/${key}.webp`;

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
      frame.contentWindow.postMessage(
        { type: "otter-demo", action: "theme", value: next === "light" ? "day" : "night" },
        "*"
      );
    }
  };
  themeBtn?.addEventListener("click", () => applyTheme(theme() === "light" ? "dark" : "light"));
  applyTheme(theme());

  // greet
  const greets = [
    { t: "你好，我是小獭", f: "hi" },
    { t: "开战吧，我帮你记时长", f: "focus" },
    { t: "水位刚好，可以安心玩一会儿", f: "happy" },
    { t: "这局值得收进藏品墙", f: "celebrate" },
    { t: "忙完了，也记得休息", f: "sleep" },
  ];
  let gi = 0;
  const popFace = (el) => {
    if (!el || reduce) return;
    el.classList.remove("is-pop");
    void el.offsetWidth;
    el.classList.add("is-pop");
  };
  $("#greet")?.addEventListener("click", () => {
    gi = (gi + 1) % greets.length;
    $("#greetText").textContent = greets[gi].t;
    const el = $("#greetFace");
    if (el) {
      el.dataset.expr = `anim/270/${greets[gi].f}.webp`;
      el.src = face(greets[gi].f);
      popFace(el);
    }
  });

  // peek otter — Tubik: mascot as living UI, not decoration
  const peeks = [
    { f: "wave", s: "点我换个表情" },
    { f: "focus", s: "开战，我帮你记" },
    { f: "happy", s: "水位刚好" },
    { f: "celebrate", s: "收进藏品墙" },
    { f: "sleep", s: "记得休息" },
  ];
  let pi = 0;
  $("#peek")?.addEventListener("click", () => {
    pi = (pi + 1) % peeks.length;
    const p = peeks[pi];
    const img = $("#peekFace");
    if (img) {
      img.dataset.expr = `anim/270/${p.f}.webp`;
      img.src = face(p.f);
      popFace(img);
    }
    const bubble = $("#peekSay");
    if (bubble) {
      bubble.textContent = p.s;
      if (!reduce) {
        bubble.classList.remove("is-pop");
        void bubble.offsetWidth;
        bubble.classList.add("is-pop");
      }
    }
  });

  // companion day
  const DAYS = [
    {
      title: "专心打完这局",
      cmd: "开战 · 计时",
      say: "点开战开始计时。收工后，首页水位与小结会立刻更新，小獭换成庆祝或放松的表情。",
      face: "focus",
      tags: ["开战计时", "收工小结", "表情反馈"],
      shots: ["shots/timer.webp", "shots/home.webp", "shots/compose.webp"],
    },
    {
      title: "今天花在哪",
      cmd: "水位 · 今日",
      say: "首页用「水位」展示今日已记录时长与安心剩余。日历与桌面小组件也能看到同一份今日数据。",
      face: "happy",
      tags: ["今日水位", "安心剩余", "小组件"],
      shots: ["shots/home.webp", "shots/calendar.webp", "shots/desk.webp"],
    },
    {
      title: "把高光留下来",
      cmd: "藏品 · 保存",
      say: "通关、宵夜或日常片段都可以写入藏品墙，支持图文与语音，并可关联某一局的时长。",
      face: "celebrate",
      tags: ["藏品墙", "图文语音", "关联时长"],
      shots: ["shots/gallery.webp", "shots/compose.webp", "memories/life_ramen.webp"],
    },
    {
      title: "道一声晚安",
      cmd: "休息 · 晚安",
      say: "忙完后小獭会提醒休息。明天的水位重新累计，记录与藏品都还在本机。",
      face: "sleep",
      tags: ["休息提醒", "本机数据", "明日续记"],
      shots: ["shots/me.webp", "shots/about.webp", "scenes/scene-companion-mood.webp"],
    },
  ];
  const dayShow = (i) => {
    const d = DAYS[i];
    $$(".day-list button").forEach((b, idx) => b.setAttribute("aria-selected", String(idx === i)));
    $("#day-title").textContent = d.title;
    $("#day-say").textContent = d.say;
    if ($("#day-cmd")) $("#day-cmd").textContent = d.cmd;
    const faceEl = $("#day-face");
    if (faceEl) {
      faceEl.dataset.expr = `anim/270/${d.face}.webp`;
      faceEl.src = face(d.face);
      popFace(faceEl);
    }
    const pool = $("#day-pool");
    if (pool) {
      pool.innerHTML = d.tags
        .map((t, idx) => `<li class="${idx === 0 ? "on" : ""}">${t}</li>`)
        .join("");
    }
    $("#day-shots").innerHTML = d.shots.map((s) => `<img src="${media(s)}" alt="" />`).join("");
    const card = $("#day-card");
    if (card && !reduce) {
      card.classList.remove("is-swap");
      void card.offsetWidth;
      card.classList.add("is-swap");
    }
  };
  $(".day-list")?.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-i]");
    if (!b) return;
    dayShow(+b.dataset.i);
  });
  dayShow(0);

  // pond count-up
  const countUp = (el) => {
    const to = +el.dataset.count || 0;
    const suffix = el.dataset.suffix || "";
    if (reduce) {
      el.textContent = `${to}${suffix}`;
      return;
    }
    const start = performance.now();
    const dur = 900;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = `${Math.round(to * eased)}${suffix}`;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  // reveal
  const reveal = () => {
    const nodes = [...document.querySelectorAll("[data-in]")];
    const show = (n) => {
      if (n.classList.contains("is-in")) return;
      n.classList.add("is-in");
      n.style.visibility = "visible";
      n.querySelectorAll("[data-count]").forEach(countUp);
      n.querySelectorAll("img[loading='lazy']").forEach((img) => {
        img.loading = "eager";
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
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          show(e.target);
          io.unobserve(e.target);
        });
      },
      { threshold: 0.08, rootMargin: "80px 0px" }
    );
    nodes.forEach((n) => io.observe(n));
    setTimeout(() => {
      nodes.forEach((n) => {
        if (!n.classList.contains("is-in")) show(n);
      });
      io.disconnect();
    }, 2800);
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
    $$('[data-group="page"] .chip').forEach((c) =>
      c.setAttribute("aria-pressed", String(c.dataset.v === demoPage))
    );
    $$('[data-group="theme"] .chip').forEach((c) =>
      c.setAttribute("aria-pressed", String(c.dataset.v === demoTheme))
    );
    if ($("#ro-text")) {
      $("#ro-text").textContent = `${PAGE[demoPage] || demoPage} · ${demoTheme === "day" ? "浅色" : "深色"}`;
    }
  };

  const send = (action, value) => {
    if (frame?.contentWindow) {
      frame.contentWindow.postMessage({ type: "otter-demo", action, value }, "*");
    }
  };

  startBtn?.addEventListener("click", () => {
    if (frame) return;
    // 立刻拿掉海报层，避免 iframe 未绘制时仍透出「启动演示」
    startBtn.hidden = true;
    startBtn.setAttribute("aria-hidden", "true");
    frame = document.createElement("iframe");
    const th = theme() === "light" ? "light" : "dark";
    demoTheme = th === "light" ? "day" : "night";
    demoPage = "home";
    frame.src = `demo/index.html?embed&nosplash&theme=${th}&p=home`;
    frame.title = "水獭游时真机演示";
    frame.setAttribute("allow", "autoplay; clipboard-write");
    frame.className = "device-frame";
    view.appendChild(frame);
    $("#ro-text").textContent = "正在启动…";
    const arm = () => {
      startBtn.remove();
      $$("button[disabled]", panel).forEach((b) => {
        b.disabled = false;
      });
      syncDemoUI(demoPage, demoTheme);
      try {
        send("page", demoPage);
        send("theme", demoTheme);
      } catch (_) {}
      frame.focus();
    };
    frame.addEventListener("load", arm, { once: true });
    frame.addEventListener(
      "error",
      () => {
        frame.remove();
        frame = null;
        startBtn.hidden = false;
        startBtn.removeAttribute("aria-hidden");
        if ($("#ro-text")) $("#ro-text").textContent = "启动失败，再试一次";
      },
      { once: true }
    );
  });

  panel?.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-a]");
    if (!b || b.disabled) return;
    if (b.dataset.a === "reset") {
      if (!frame) return;
      $("#ro-text").textContent = "正在重置…";
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

  // 商店 / 下载 / changelog 由 shared/family.js 按 family.json 注水。
  $$("[data-store]").forEach((a) => {
    a.addEventListener("click", (e) => {
      if (!a.dataset.hrefReady) e.preventDefault();
    });
  });

  // scroll: nav + parallax + peek hide near footer
  const heroArt = $("#heroArt");
  const peek = $("#peek");
  let ticking = false;
  const onScroll = () => {
    const y = scrollY;
    nav?.classList.toggle("scrolled", y > 8);
    if (heroArt && !reduce) {
      const p = Math.max(-28, Math.min(36, y * 0.08));
      heroArt.style.setProperty("--parallax", `${p}px`);
    }
    if (peek) {
      const nearEnd = y + innerHeight > document.body.scrollHeight - 420;
      peek.classList.toggle("is-hide", nearEnd || y < 120);
    }
  };
  addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        onScroll();
        ticking = false;
      });
    },
    { passive: true }
  );
  onScroll();
  reveal();
})();
