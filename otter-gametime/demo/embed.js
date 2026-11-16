/* 官网 iframe：?embed&nosplash&theme=light|dark&p=home|timer|gallery|me */
(() => {
  const q = new URLSearchParams(location.search);
  if (!q.has("embed") && !q.has("nosplash")) return;

  const report = () => {
    if (parent === window) return;
    parent.postMessage(
      {
        type: "otter-demo-state",
        page: window.currentPage || "home",
        theme: document.body.classList.contains("light") ? "day" : "night",
      },
      "*"
    );
  };

  const setTheme = (v) => {
    const light = v === "day" || v === "light";
    if (window.GtTheme && window.GtTheme.set) window.GtTheme.set(light ? "light" : "dark");
    else document.body.classList.toggle("light", light);
    report();
  };

  const go = (v) => {
    const map = { home: "home", timer: "timer", battle: "timer", gallery: "gallery", memory: "gallery", me: "me", note: "gallery" };
    const page = map[v] || v || "home";
    if (typeof window.enter === "function") window.enter(page);
    report();
  };

  const actions = {
    page: go,
    theme: setTheme,
    reset: () => location.reload(),
  };
  window.demo = actions;

  addEventListener("message", (e) => {
    const d = e.data;
    if (d && d.type === "otter-demo" && actions[d.action]) actions[d.action](d.value);
  });

  if (q.has("embed")) {
    document.documentElement.classList.add("embed");
    document.head.insertAdjacentHTML(
      "beforeend",
      "<style>" +
        ".embed, .embed body{background:#0B0A14;margin:0;overflow:hidden;}" +
        ".embed body.light{background:#F5F4F8;}" +
        ".embed #boot{display:none!important;}" +
        ".embed .nav3, .embed .tabbar{}" +
        "</style>"
    );
  }

  const bootSkip = () => {
    const boot = document.getElementById("boot");
    if (boot) {
      boot.classList.add("gone");
      boot.style.display = "none";
    }
  };

  const start = () => {
    if (q.has("nosplash") || q.has("embed")) bootSkip();
    if (q.get("theme") === "light" || q.get("theme") === "day") setTheme("day");
    const p = q.get("p");
    if (p) go(p);
    else if (typeof window.enter === "function") go("home");
    report();
  };

  const wait = () => {
    if (typeof window.enter === "function") {
      start();
      const orig = window.enter;
      window.enter = function (name) {
        orig.apply(this, arguments);
        report();
      };
      return;
    }
    setTimeout(wait, 80);
  };

  if (document.readyState === "loading") addEventListener("DOMContentLoaded", wait);
  else wait();

  addEventListener("click", () => setTimeout(report, 80), true);
})();
