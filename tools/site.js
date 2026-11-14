/* 水獭工具官网交互
   - 背景环境层：一片水，颜色和水位读当前章节的 data-tone（与 App 首页水面同一套状态）
   - 小獭问候与表情
   - 水面章节：步骤进入视口时切换右侧截图、表情与背景色调
   - 在线试用：iframe 载入 demo/，按钮经 postMessage 控制
   - GSAP 动效全部在 matchMedia(no-preference) 里注册；减少动态效果时内容直接落位 */
(function () {
  "use strict";
  var root = document.documentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var EXPR = window.otterExpr("");
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  /* ── 背景环境层 ─────────────────────────────────────────── */
  /* g：三团光的颜色；w：水色；lv：水位（占视口高度）；s：波速 */
  var TONES = {
    dawn: { g: [[250, 90, 30], [255, 176, 74], [255, 138, 61]], w: [255, 160, 90], lv: .1, s: 1 },
    calm: { g: [[64, 160, 210], [95, 201, 232], [110, 231, 168]], w: [95, 201, 232], lv: .12, s: .8 },
    busy: { g: [[255, 170, 90], [214, 138, 72], [255, 138, 61]], w: [255, 170, 90], lv: .14, s: 2.4 },
    alarm: { g: [[255, 107, 107], [214, 84, 90], [255, 150, 110]], w: [255, 120, 120], lv: .15, s: 1.6 },
    full: { g: [[64, 160, 210], [255, 170, 90], [95, 201, 232]], w: [120, 196, 232], lv: .34, s: 1 }
  };
  var cv = $("#ambient");
  var cx = cv.getContext("2d");
  var W = 0, H = 0;
  var tone = "dawn";
  var cur = JSON.parse(JSON.stringify(TONES.dawn));
  var clock = 0, last = 0, raf = 0;

  function resize() {
    W = cv.width = window.innerWidth;
    H = cv.height = window.innerHeight;
    if (reduced) draw(true);
  }

  function mix(a, b, k) { return a + (b - a) * k; }

  function rgba(c, a) { return "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + a + ")"; }

  function surface(x, i) {
    var len = W / (1.2 + i * .3);
    return 7 * Math.sin((x / len) * Math.PI * 2 - clock * (.5 + i * .14) * cur.s) +
      3 * Math.sin((x / (len * .43)) * Math.PI * 2 + clock * .7 * cur.s + i);
  }

  function draw(snap) {
    var t = TONES[tone];
    var k = snap ? 1 : .04;
    for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) cur.g[i][j] = mix(cur.g[i][j], t.g[i][j], k);
    for (j = 0; j < 3; j++) cur.w[j] = mix(cur.w[j], t.w[j], k);
    cur.lv = mix(cur.lv, t.lv, k);
    cur.s = mix(cur.s, t.s, k);

    cx.fillStyle = "#0b0a14";
    cx.fillRect(0, 0, W, H);
    var R = Math.max(W, H) * .6;
    var alpha = [.15, .11, .08];
    for (i = 0; i < 3; i++) {
      var px = W * (.5 + .38 * Math.sin(clock * .045 + i * 2.1));
      var py = H * (.3 + .26 * Math.cos(clock * .037 + i * 1.7));
      var gr = cx.createRadialGradient(px, py, 0, px, py, R);
      gr.addColorStop(0, rgba(cur.g[i], alpha[i]));
      gr.addColorStop(1, rgba(cur.g[i], 0));
      cx.fillStyle = gr;
      cx.fillRect(0, 0, W, H);
    }

    /* 水体：水位线以下一层很淡的水色，表面三条波线 */
    var top = H * (1 - cur.lv);
    cx.beginPath();
    cx.moveTo(0, H);
    for (var x = 0; x <= W; x += 8) cx.lineTo(x, top + surface(x, 0));
    cx.lineTo(W, H);
    cx.closePath();
    var wg = cx.createLinearGradient(0, top - 10, 0, H);
    wg.addColorStop(0, rgba(cur.w, .10));
    wg.addColorStop(1, rgba(cur.w, .02));
    cx.fillStyle = wg;
    cx.fill();

    for (i = 0; i < 3; i++) {
      var lg = cx.createLinearGradient(0, 0, W, 0);
      var a = .32 - i * .08;
      lg.addColorStop(0, rgba(cur.w, 0));
      lg.addColorStop(.5, rgba(cur.w, a));
      lg.addColorStop(1, rgba(cur.w, 0));
      cx.strokeStyle = lg;
      cx.lineWidth = 1.2;
      cx.beginPath();
      for (x = 0; x <= W; x += 8) {
        var y = top + i * 16 + surface(x, i) * (1 - i * .2);
        x ? cx.lineTo(x, y) : cx.moveTo(x, y);
      }
      cx.stroke();
    }
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (now - last < 33) return;
    clock += Math.min(now - last, 100) / 1000;
    last = now;
    draw(false);
  }

  function setTone(next) {
    if (!TONES[next] || next === tone) return;
    tone = next;
    if (reduced) draw(true);
  }

  window.addEventListener("resize", resize);
  resize();
  if (!reduced) {
    raf = requestAnimationFrame(loop);
    document.addEventListener("visibilitychange", function () {
      cancelAnimationFrame(raf);
      if (!document.hidden) { last = performance.now(); raf = requestAnimationFrame(loop); }
    });
  }

  /* 章节色调：视口中线所在的 [data-tone] 生效 */
  var toneIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) setTone(e.target.dataset.tone); });
  }, { rootMargin: "-48% 0px -48% 0px" });
  $$("[data-tone]").forEach(function (el) { toneIO.observe(el); });

  /* ── 导航底色 ── */
  var nav = $("#nav");
  var onScroll = function () { nav.classList.toggle("solid", window.scrollY > 12); };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ── 小獭问候（按时段）与表情 ── */
  var hour = new Date().getHours();
  var GREET = hour < 5 ? ["夜深了，电脑也该歇会儿了", "这么晚还没睡？我帮你看着"]
    : hour < 11 ? ["早上好，水挺清的", "早呀，今天也让电脑轻快一点"]
      : hour < 14 ? ["中午好，吃过饭再忙也不迟", "午安，电脑我帮你看着"]
        : hour < 18 ? ["下午好，顺手清一清？", "下午好，内存挺平稳的"]
          : ["晚上好，今天辛苦啦", "晚上好，看剧可以定时睡觉哦"];
  var PET = ["happy", "cheer", "hi", "clear", "proud", "bath"];
  var LINES = ["你好呀，我是小獭", "别戳啦，我在看着水面呢", "删东西之前我会先问你的", "水挺清的，放心用", "看剧睡着了？我到点帮你关"];
  var gi = 0;
  var greetText = $("#greet-text");
  greetText.textContent = GREET[0];
  $("#greet").addEventListener("click", function () {
    gi = (gi + 1) % GREET.length;
    greetText.textContent = GREET[gi];
  });

  var peek = $("#peek");
  var peekImg = $("img", peek);
  var bubble = $("#bubble");
  var lastPet = "", bubbleTimer = 0, li = 0;

  function say(text) {
    bubble.textContent = text;
    bubble.hidden = false;
    if (window.gsap && !reduced) gsap.fromTo(bubble, { autoAlpha: 0, y: 6, scale: .96 }, { autoAlpha: 1, y: 0, scale: 1, duration: .25, ease: "power2.out" });
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () {
      if (window.gsap && !reduced) gsap.to(bubble, { autoAlpha: 0, duration: .15, onComplete: function () { bubble.hidden = true; } });
      else bubble.hidden = true;
    }, 2800);
  }

  peek.addEventListener("click", function () {
    var k;
    do { k = PET[Math.random() * PET.length | 0]; } while (k === lastPet);
    lastPet = k;
    peekImg.src = EXPR + "anim_270/" + k + ".webp";
    say(LINES[li++ % LINES.length]);
    if (window.gsap && !reduced) gsap.fromTo(peekImg, { scale: .82, rotate: -8 }, { scale: 1, rotate: 0, duration: .5, ease: "back.out(2.4)" });
  });

  /* ── 系统识别：下载卡片与首屏主按钮 ── */
  var ua = navigator.userAgent;
  var isWin = /Windows/i.test(ua);
  var isMac = /Macintosh|Mac OS X/i.test(ua) && !/iPhone|iPad/i.test(ua);
  if (isWin) {
    $("#dl-win").classList.add("mine");
    var main = $("#cta-main"), alt = $("#cta-alt");
    var href = main.href, file = main.dataset.dl;
    main.href = alt.href;
    main.dataset.dl = alt.dataset.dl;
    alt.href = href;
    alt.dataset.dl = file;
    $("span", main).textContent = "下载 Windows 预览版";
    $("span", alt).textContent = "macOS 版";
  } else if (isMac) {
    $("#dl-mac").classList.add("mine");
  }

  /* ── 陪伴：一天里的小獭（表情与台词同 App 的 OtterLife / derive.otterEx） ── */
  var DAY = [
    { t: "08:30", n: "早安", c: "var(--accent)", cmd: "greet · 当日首次打开", title: "早～今天也一起把电脑收拾清爽",
      say: "每天第一次打开，小獭先打招呼。第一次见面它会自我介绍，隔了好几天回来它说一直把水看得好好的，周末早上让你慢慢来。",
      pool: ["morning", "welcome", "arrive", "hug", "stroll"] },
    { t: "10:00", n: "编译中", c: "var(--busy)", cmd: "CPU 78% · 忙碌", title: "有点忙，我帮你盯着",
      say: "Xcode 一编译，水面的波浪变急，小獭抱起一摞文件。只是忙不是坏事，它不会催你去关东西。",
      pool: ["busy", "focus"] },
    { t: "12:20", n: "饭点", c: "var(--accent)", cmd: "greet · 中午", title: "中午好，记得吃饭",
      say: "中午打开，小獭在吃饭；周末换成一桌大餐，下午换成一杯水或一杯奶茶。",
      pool: ["eat", "feast", "drink", "milktea"] },
    { t: "13:30", n: "午休", c: "var(--calm)", cmd: "闲置 · 有事戳我", title: "眯一会儿……有事戳我",
      say: "你一阵子没动，小獭在旁边安静待着，再久一点就打个盹。你一回来它就醒：醒啦！刚才梦到一池清水。",
      pool: ["relax", "nap", "stretch"] },
    { t: "14:30", n: "内存告急", c: "var(--alarm)", cmd: "Memory Pressure · 红线", title: "内存一下子紧了，我盯着呢",
      say: "内存压力过线，水变红，首页主按钮换成「释放内存」；缓过来以后，小獭会松一口气告诉你。",
      pool: ["sweat", "scared", "relief"] },
    { t: "15:10", n: "磁盘将满", c: "var(--busy)", cmd: "Disk 93% · 只剩 34 GB", title: "磁盘快满了！腾点地方吧？",
      say: "水位就是磁盘占用。快漫出来的时候，小獭把垃圾、大文件、半年没开过的虚拟机按大小排好给你。",
      pool: ["shock", "please"] },
    { t: "16:00", n: "一键养护", c: "var(--calm)", cmd: "System Junk · 6.3 GB → 废纸篓", title: "洗干净了，腾出 6.3 GB",
      say: "扫描时小獭埋头翻找，清理时它在洗澡；做完随机说一句「呼～清爽了」「水清了」，文件都在废纸篓，随时能放回来。",
      pool: ["bath", "focus", "great", "relief", "clear", "clean"] },
    { t: "17:30", n: "戳一下", c: "var(--accent)", cmd: "点一下侧栏的小獭", title: "嘿，在呢～",
      say: "侧栏的小獭可以戳：它会害羞、偷吃小鱼干、劝你去点「一键养护」；一天戳太多次，它先生气，最后认输。",
      pool: ["happy", "laugh", "shy", "yum", "lucky", "pout", "gg"] },
    { t: "23:30", n: "深夜", c: "#9b8cff", cmd: "greet · 23:00 以后", title: "这么晚还在呀，我陪你一会儿",
      say: "深夜打开，小獭陪你加班；水面平静时它会犯困。夜间勿扰默认开着，23:00 到 08:00 不弹通知。",
      pool: ["overtime", "sleepy", "nap"] },
    { t: "100G", n: "石头罐", c: "var(--ok)", cmd: "累计腾出 100 GB", title: "累计帮你腾出 100 GB 啦！",
      say: "每清理一次，小獭往石头罐里放一颗石子；累计腾出的空间跨过一个关口，它会庆祝一下，石头罐又满一格。",
      pool: ["celebrate", "great", "proud"] }
  ];
  var dayList = $("#day .day-list"), dayCard = $("#day-card"), dayFace = $("#day-face");
  var dayCur = 0, dayPick = 0, dayAuto = 0, dayCycle = 0;
  DAY.forEach(function (d, i) {
    var item = document.createElement("li");
    item.innerHTML = '<button type="button" role="tab" id="day-' + i + '" aria-controls="day-card" style="--c:' + d.c +
      '"><time>' + d.t + '</time><i></i><b>' + d.n + '</b></button>';
    dayList.appendChild(item);
  });
  var dayBtns = $$("button", dayList);
  function dayFaceTo(k) {
    $$("#day-pool li").forEach(function (el) { el.classList.toggle("on", el.textContent === k); });
    dayFace.src = EXPR + (reduced ? "still_270/" : "anim_270/") + k + ".webp";
    if (window.gsap && !reduced) gsap.fromTo(dayFace, { scale: .86, y: 6 }, { scale: 1, y: 0, duration: .45, ease: "back.out(2)" });
  }
  function dayShow(i) {
    var d = DAY[i];
    dayCur = i;
    dayBtns.forEach(function (b, j) { b.setAttribute("aria-selected", String(j === i)); b.tabIndex = j === i ? 0 : -1; });
    dayCard.style.setProperty("--c", d.c);
    dayCard.setAttribute("aria-labelledby", "day-" + i);
    $("#day-cmd").textContent = d.cmd;
    $("#day-title").textContent = d.title;
    $("#day-say").textContent = d.say;
    $("#day-pool").innerHTML = d.pool.map(function (k) { return "<li>" + k + "</li>"; }).join("");
    dayPick = 0;
    dayFaceTo(d.pool[0]);
  }
  function dayStop() { clearInterval(dayAuto); dayAuto = 0; }
  dayList.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    dayStop();
    dayShow(dayBtns.indexOf(b));
  });
  dayList.addEventListener("keydown", function (e) {
    var step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    dayStop();
    dayShow((dayCur + step + DAY.length) % DAY.length);
    dayBtns[dayCur].focus();
  });
  dayShow(0);
  if (!reduced) {
    var dayIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        clearInterval(dayCycle);
        if (!e.isIntersecting) { clearInterval(dayAuto); return; }
        dayCycle = setInterval(function () {
          var pool = DAY[dayCur].pool, k;
          if (pool.length < 2) return;
          do { k = pool[Math.random() * pool.length | 0]; } while (k === pool[dayPick]);
          dayPick = pool.indexOf(k);
          dayFaceTo(k);
        }, 2600);
        if (dayAuto !== 0 || e.target.dataset.touched) return;
        e.target.dataset.touched = "1";
        dayAuto = setInterval(function () { dayShow((dayCur + 1) % DAY.length); }, 5200);
      });
    }, { threshold: .4 });
    dayIO.observe($("#day"));
  }

  /* ── 水面章节 ── */
  var steps = $$(".step");
  var screens = $$("#screens img");
  var stateOtter = $("#state-otter");
  var stepIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target;
      steps.forEach(function (s) { s.classList.toggle("on", s === el); });
      screens.forEach(function (im, i) { im.classList.toggle("on", i === +el.dataset.shot); });
      var src = EXPR + el.dataset.otter + ".webp";
      if (stateOtter.getAttribute("src") !== src) {
        stateOtter.src = src;
        if (window.gsap && !reduced) gsap.fromTo(stateOtter, { scale: .8, y: 8 }, { scale: 1, y: 0, duration: .45, ease: "back.out(2)" });
      }
    });
  }, { rootMargin: "-45% 0px -45% 0px" });
  steps.forEach(function (s) { stepIO.observe(s); });

  /* ── 浅色 / 深色对比 ── */
  var promo = $("#promo");
  $$(".chapters a").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      var t = +a.dataset.t;
      var seek = function () {
        promo.currentTime = t;
        promo.play().catch(function () {});
      };
      if (promo.readyState >= 1) seek();
      else {
        promo.addEventListener("loadedmetadata", seek, { once: true });
        promo.preload = "auto";
        promo.load();
      }
      promo.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    });
  });

  var compare = $("#compare");
  $("input", compare).addEventListener("input", function (e) {
    compare.style.setProperty("--p", e.target.value + "%");
  });

  /* ── 在线试用 ── */
  var view = $("#demo-view");
  var panel = $("#panel");
  var frame = null;
  var PAGE = { home: "概览", check: "体检", clean: "清理", boost: "加速", privacy: "隐私", toolbox: "工具箱", mac: "本机", settings: "设置", about: "关于" };
  var PRESET_TEXT = { calm: "平静", busy: "忙碌", alarm: "内存告急", full: "磁盘将满" };
  var PRESET_DOT = { calm: "var(--calm)", busy: "var(--busy)", alarm: "var(--alarm)", full: "var(--busy)" };
  var head = function (p) { return String(p || "").split(":")[0]; };

  function send(action, value) {
    if (frame && frame.contentWindow) frame.contentWindow.postMessage({ type: "otter-demo", action: action, value: value }, "*");
  }

  $("#demo-start").addEventListener("click", function () {
    frame = document.createElement("iframe");
    frame.src = "demo/index.html?embed&nosplash";
    frame.title = "水獭工具交互演示";
    frame.setAttribute("allow", "autoplay; clipboard-write");
    view.appendChild(frame);
    var poster = $("#demo-start");
    $("#ro-text").textContent = "正在载入…";
    frame.addEventListener("load", function () {
      poster.remove();
      $$("button[disabled]", panel).forEach(function (b) { b.disabled = false; });
      frame.focus();
    });
  });

  panel.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-a]");
    if (!b || b.disabled) return;
    var a = b.dataset.a;
    if (a === "reset") { frame.src = frame.src; return; }
    send(a, b.dataset.v);
  });

  window.addEventListener("message", function (e) {
    var d = e.data;
    if (!d || d.type !== "otter-demo-state" || !frame || e.source !== frame.contentWindow) return;
    $$('[data-group="page"] .chip').forEach(function (c) { c.setAttribute("aria-pressed", String(head(c.dataset.v) === head(d.page))); });
    $$('[data-group="preset"] .chip').forEach(function (c) { c.setAttribute("aria-pressed", String(c.dataset.v === d.preset)); });
    $$('[data-group="theme"] .chip').forEach(function (c) { c.setAttribute("aria-pressed", String(c.dataset.v === d.theme)); });
    $("#ro-text").textContent = (PAGE[head(d.page)] || d.page) + " · " + (PRESET_TEXT[d.preset] || "平静") + (d.ai ? " · 小獭面板已打开" : "");
    $("#ro-dot").style.background = PRESET_DOT[d.preset] || "var(--calm)";
  });

  /* ── 动效 ───────────────────────────────────────────────── */
  var oc = $("#oc");

  function ocFinal() {
    $(".busy", oc).style.display = "none";
    $(".done", oc).style.display = "grid";
  }

  if (!window.gsap || !window.ScrollTrigger) {
    root.classList.remove("motion");
    ocFinal();
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  var mm = gsap.matchMedia();

  mm.add("(prefers-reduced-motion: reduce)", function () {
    root.classList.remove("motion");
    ocFinal();
  });

  mm.add("(prefers-reduced-motion: no-preference)", function () {
    /* 首屏入场：100ms 错开，位移 + 轻微模糊 */
    var intro = gsap.timeline({ defaults: { ease: "power3.out" } });
    intro
      .fromTo("[data-in]", { autoAlpha: 0, y: 18, filter: "blur(6px)" },
        { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: .7, stagger: .1, clearProps: "filter" })
      .fromTo("[data-in-stage]", { autoAlpha: 0, y: 48 }, { autoAlpha: 1, y: 0, duration: 1 }, "-=.45")
      .fromTo("#peek", { autoAlpha: 0, y: 40, rotate: 10 }, { autoAlpha: 1, y: 0, rotate: 0, duration: .7, ease: "back.out(1.8)" }, "-=.5")
      .add(function () { say(LINES[li++]); }, "+=.2");

    /* 首屏窗口：从倾斜放平 */
    gsap.fromTo("#hero-frame", { rotateX: 14, scale: .94 }, {
      rotateX: 0, scale: 1, ease: "none",
      scrollTrigger: { trigger: "#hero-frame", start: "top 95%", end: "top 25%", scrub: .6 }
    });

    /* 小獭在水里轻轻浮着 */
    gsap.to("#peek img", { y: -6, duration: 2.2, ease: "sine.inOut", yoyo: true, repeat: -1 });

    /* 章节内容进入视口 */
    gsap.set(".rise", { autoAlpha: 0, y: 16 });
    var reveal = function (batch) {
      gsap.to(batch, { autoAlpha: 1, y: 0, duration: .6, stagger: .1, ease: "power3.out", overwrite: true });
    };
    /* 点导航直接跳过某段时只会触发 onLeave，三种都要落位，否则跳过的内容回看时是空的 */
    ScrollTrigger.batch(".rise", { start: "top 88%", onEnter: reveal, onLeave: reveal, onEnterBack: reveal });

    /* 数字滚动 */
    $$("[data-count]").forEach(function (el) {
      var n = +el.dataset.count;
      var o = { v: 0 };
      gsap.to(o, {
        v: n, duration: 1.4, ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 90%", once: true },
        onUpdate: function () { el.textContent = Math.round(o.v); }
      });
    });

    /* 一键养护：进度条 → 原地切换为结果，一颗石子落进石头罐 */
    var busy = $(".busy", oc), done = $(".done", oc);
    var stage = $("#oc-stage");
    var drops = [];
    for (var i = 0; i < 6; i++) {
      var d = document.createElement("i");
      d.className = "pebble";
      stage.appendChild(d);
      drops.push(d);
    }
    var ocTl = gsap.timeline({ paused: true });
    ocTl
      .set(busy, { display: "grid", autoAlpha: 1 })
      .set(done, { display: "none" })
      .fromTo(oc, { scale: .9, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: .35, ease: "back.out(1.6)" })
      .fromTo(".oc .bar i", { xPercent: -110 }, { xPercent: 260, duration: .9, ease: "power1.inOut", repeat: 1 }, "<")
      .to(busy, { autoAlpha: 0, duration: .15 })
      .set(busy, { display: "none" })
      .set(done, { display: "grid" })
      .fromTo(done, { autoAlpha: 0, scale: .94 }, { autoAlpha: 1, scale: 1, duration: .4, ease: "back.out(1.8)" })
      .fromTo(".oc .done img", { scale: .5, rotate: -12 }, { scale: 1, rotate: 0, duration: .6, ease: "back.out(2.6)" }, "<")
      .set(drops, { autoAlpha: 0, y: -60, x: function (i) { return (i - 2.5) * 34; } }, "<")
      .to(drops, {
        keyframes: [{ autoAlpha: 1, duration: .1 }, { y: 0, duration: .5, ease: "bounce.out" }, { autoAlpha: 0, duration: .3 }],
        stagger: .07
      }, "<")
      .fromTo(".oc .btns span", { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: .3, stagger: .08 }, "-=.6");
    ScrollTrigger.create({
      trigger: "#oc-stage", start: "top 70%",
      onEnter: function () { ocTl.restart(); },
      onEnterBack: function () { ocTl.restart(); }
    });

    root.classList.add("ready");
    return function () { drops.forEach(function (b) { b.remove(); }); };
  });
})();
