/* 水獭家族官网公共脚本：素材地址、版本号、版本记录与下载链接，都按 family.json 来。
 *
 *   <script src="../shared/family.js" data-app="otter-git" defer></script>   放在页面自己的脚本前面
 *
 * - `[data-media]`：素材在 TOS。普通路径走 `family.media`（`…/latest/{app}/`）；以 `shots/` 开头的
 *   走 `family.shots`（`…/latest/shots/{app}/`，按 app 分组）。img/source→src，a→href；
 *   `[data-media-poster]` 填 video poster。`otterMedia(路径)` 同上规则。
 * - `[data-expr]`：小獭表情，和 App 用同一份 TOS 表情包（family.json 的 `family.expr`），值如 `anim/270/hi.webp`、
 *   `still/270/hi.webp`；页面脚本用 `otterExpr(路径)` 拼地址
 * - `.v` / `.ver`：能下载到的版本（`download.version`，没有安装包时是 `latest`）；导航「下载 X.Y」同
 * - `.vlist`：版本记录（全部条目，新的在前）
 * - `[data-dl]`：值是 family.json 里 `download.files` 的键（macos / windows / …），空串 = 发布页
 *
 * 版本字段（勿混）：
 *   family.libraryVersion — 与 App 版本号一致（拼旧模板 {version} 时用）
 *   family.libraryBuild   — 仅 TOS 素材树世代；小改素材只涨它，≠ App pubspec +N
 *   apps.*.latest / download.version — 各 App 安装包版本
 *
 * 下载源：国内走 TOS，海外走 GitHub Release；按访客 IP 判断，查询失败或超时保持 TOS。
 * 页面里写死的版本号与链接只是脚本没跑起来时的兜底。
 */
(function () {
  var me = document.currentScript;
  var id = me && me.dataset.app;
  if (!id) return;
  var root = me.src.replace(/shared\/family\.js.*$/, "");
  var LIB_VER = "3.0.2"; // fallback = libraryVersion（与 App 同号），不是 libraryBuild
  var MEDIA = "https://otter.oss-cn-beijing.aliyuncs.com/library/latest/{app}/";
  var SHOTS = "https://otter.oss-cn-beijing.aliyuncs.com/library/latest/shots/{app}/";
  var EXPR = "https://otter.oss-cn-beijing.aliyuncs.com/library/latest/expr/";
  var BRAND = "https://otter.oss-cn-beijing.aliyuncs.com/library/latest/";

  function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function expand(tpl, ver) {
    return tpl.replace(/\{version\}/g, ver || LIB_VER).replace(/\{app\}/g, id);
  }
  function absMedia(path, mediaBase, shotsBase) {
    if (!path) return mediaBase;
    if (path.indexOf("shots/") === 0) return shotsBase + path.slice(6);
    return mediaBase + path;
  }

  function media(mediaTpl, shotsTpl) {
    var base = expand(mediaTpl, LIB_VER);
    var shots = expand(shotsTpl || SHOTS, LIB_VER);
    if (base.indexOf("{app}") >= 0) base = base.replace("{app}", id);
    if (shots.indexOf("{app}") >= 0) shots = shots.replace("{app}", id);
    if (window.otterMedia && window.otterMedia.__mediaBase === base && window.otterMedia.__shotsBase === shots) return;
    window.otterMedia = function (p) { return absMedia(p, base, shots); };
    window.otterMedia.__mediaBase = base;
    window.otterMedia.__shotsBase = shots;
    $$("[data-media]").forEach(function (el) {
      el[el.tagName === "A" ? "href" : "src"] = absMedia(el.dataset.media, base, shots);
    });
    $$("[data-media-poster]").forEach(function (el) {
      el.poster = absMedia(el.dataset.mediaPoster, base, shots);
    });
    $$("video source[data-media]").forEach(function (s) { s.parentNode.load(); });
  }
  media(MEDIA, SHOTS);

  function expr(base) {
    base = expand(base, LIB_VER);
    if (window.otterExpr && window.otterExpr("") === base) return;
    window.otterExpr = function (p) { return base + p; };
    $$("[data-expr]").forEach(function (el) { el.src = base + el.dataset.expr; });
  }
  function brand(base) {
    base = expand(base, LIB_VER);
    if (!base.endsWith("/")) base += "/";
    window.otterBrand = function (p) { return base + p; };
    $$("[data-brand]").forEach(function (el) {
      el[el.tagName === "A" ? "href" : "src"] = base + el.dataset.brand;
    });
  }
  expr(EXPR);
  brand(BRAND);
  if (!window.fetch) return;
  function fill(tpl, v) { return tpl.replace(/\{(\w+)\}/g, function (_, k) { return v[k] == null ? "" : v[k]; }); }

  function versions(app) {
    var v = (app.download && app.download.version) || app.latest;
    $$(".v, .ver").forEach(function (el) { el.textContent = "v" + v; });
    var nav = document.querySelector('nav a.btn-sm[href="#download"]');
    if (nav) nav.textContent = "下载 " + v.split(".").slice(0, 2).join(".");
    var list = document.querySelector(".vlist");
    if (!list || !app.changelog || !app.changelog.length) return;
    list.textContent = "";
    app.changelog.forEach(function (r) {
      // 用 div 而不是无 href 的 <a>，避免看起来可点却没反应。
      var li = document.createElement("li"), row = document.createElement("div");
      [["b", "v" + r.version], ["span.vd", (r.date || "").slice(5)], ["span.vt", r.zh || ""]].forEach(function (p) {
        var t = p[0].split("."), el = document.createElement(t[0]);
        if (t[1]) el.className = t[1];
        el.textContent = p[1];
        row.appendChild(el);
      });
      li.appendChild(row);
      list.appendChild(li);
    });
  }

  function links(cfg, app, where) {
    var dl = app.download, rel = cfg.family && cfg.family.releases;
    if (!dl || !rel) return;
    var v = { app: id, version: dl.version };
    $$("[data-dl]").forEach(function (a) {
      var key = a.dataset.dl;
      if (!key) { a.href = fill(rel.page, v); return; }
      var file = dl.files && dl.files[key];
      if (!file) return;
      v.file = file;
      a.href = fill(rel[where], v);
    });
  }

  function country(url) {
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 2500);
    return fetch(url, { signal: ctl && ctl.signal, cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (d) { clearTimeout(timer); return d.country || Promise.reject(); });
  }
  function where() {
    var hit = null;
    try { hit = sessionStorage.getItem("otter-mirror"); } catch (e) {}
    if (hit) return Promise.resolve(hit);
    return country("https://api.country.is/")
      .catch(function () { return country("https://get.geojs.io/v1/ip/country.json"); })
      .then(function (cc) {
        var w = String(cc).toUpperCase() === "CN" ? "cn" : "global";
        try { sessionStorage.setItem("otter-mirror", w); } catch (e) {}
        return w;
      }, function () { return "cn"; });
  }

  fetch(root + "family.json", { cache: "no-cache" })
    .then(function (r) { return r.json(); })
    .then(function (cfg) {
      var app = cfg && cfg.schema === 1 && cfg.apps && cfg.apps[id];
      if (!app) return;
      // 只取 libraryVersion（与 App 同号）；libraryBuild 不参与 URL 拼接
      if (cfg.family && cfg.family.libraryVersion) LIB_VER = cfg.family.libraryVersion;
      if (cfg.family && cfg.family.media) media(cfg.family.media, cfg.family.shots);
      if (cfg.family && cfg.family.expr) expr(cfg.family.expr);
      if (cfg.family && cfg.family.brand) brand(cfg.family.brand);
      if (app.latest) versions(app);
      links(cfg, app, "cn");
      where().then(function (w) { if (w !== "cn") links(cfg, app, w); });
    })
    .catch(function () {});
})();
