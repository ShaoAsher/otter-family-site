/* 水獭家族官网公共脚本：素材地址、版本号、版本记录与下载链接，都按 family.json 来。
 *
 *   <script src="../shared/family.js" data-app="git" defer></script>   放在页面自己的脚本前面
 *
 * - `[data-media]`：素材在 TOS（family.json 的 `family.media`，`{app}` 换成 data-app），值是相对路径；
 *   img / source 填 src，a 填 href，`[data-media-poster]` 填 video 的 poster。页面脚本用 `otterMedia(路径)` 拼地址
 * - `[data-expr]`：小獭表情，和 App 用同一份 TOS 表情包（family.json 的 `family.expr`），值如 `anim_270/hi.webp`、
 *   `still_270/hi.webp`；页面脚本用 `otterExpr(路径)` 拼地址
 * - `.v` / `.ver`：能下载到的版本（`download.version`，没有安装包时是 `latest`）；导航「下载 X.Y」同
 * - `.vlist`：版本记录（全部条目，新的在前）
 * - `[data-dl]`：值是 family.json 里 `download.files` 的键（macos / windows / …），空串 = 发布页
 *
 * 下载源：国内走 TOS，海外走 GitHub Release；按访客 IP 判断，查询失败或超时保持 TOS。
 * 页面里写死的版本号与链接只是脚本没跑起来时的兜底。
 */
(function () {
  var me = document.currentScript;
  var id = me && me.dataset.app;
  if (!id) return;
  var root = me.src.replace(/shared\/family\.js.*$/, "");
  var MEDIA = "https://otter-family-site.tos-cn-beijing.volces.com/site/{app}/"; // 与 family.json 的 family.media 一致，先用它出图
  var EXPR = "https://otter-family-site.tos-cn-beijing.volces.com/expr/v3/"; // 与 family.json 的 family.expr 一致

  function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }

  function media(tpl) {
    var base = tpl.replace("{app}", id);
    if (window.otterMedia && window.otterMedia("") === base) return;
    window.otterMedia = function (p) { return base + p; };
    $$("[data-media]").forEach(function (el) {
      el[el.tagName === "A" ? "href" : "src"] = base + el.dataset.media;
    });
    $$("[data-media-poster]").forEach(function (el) { el.poster = base + el.dataset.mediaPoster; });
    $$("video source[data-media]").forEach(function (s) { s.parentNode.load(); });
  }
  media(MEDIA);

  function expr(base) {
    if (window.otterExpr && window.otterExpr("") === base) return;
    window.otterExpr = function (p) { return base + p; };
    $$("[data-expr]").forEach(function (el) { el.src = base + el.dataset.expr; });
  }
  expr(EXPR);
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
      var li = document.createElement("li"), row = document.createElement("a");
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
      if (cfg.family && cfg.family.media) media(cfg.family.media);
      if (cfg.family && cfg.family.expr) expr(cfg.family.expr);
      if (app.latest) versions(app);
      links(cfg, app, "cn");
      where().then(function (w) { if (w !== "cn") links(cfg, app, w); });
    })
    .catch(function () {});
})();
