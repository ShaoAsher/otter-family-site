/* 水獭家族官网公共脚本：素材地址、版本号、版本记录与下载链接，都按 family.json 来。
 *
 * 单 App 页：
 *   <script src="../shared/family.js" data-app="otter-git" defer></script>
 *
 * 家族首页（多成员卡）：
 *   <script src="shared/family.js" data-home defer></script>
 *
 * - `[data-media]` / `[data-brand]` / `[data-expr]`：素材
 * - `.v` / `.ver`：带 v 的版本；`[data-ver]`：纯版本号；`[data-ver="short"]`：主.次
 * - `.vlist` / `#changelog`：版本记录
 * - `[data-dl]`：安装包；`[data-store]`：商店（ios 等）
 * - `[data-family]`：家族官网（`site` / `members`，members 可用 data-from）
 *
 * 成员卡可用短 id（gametime）或完整 id（otter-gametime），按 apps.*.from 解析。
 */
(function () {
  var me = document.currentScript;
  var scriptApp = me && me.dataset.app;
  var isHome = !!(me && me.dataset.home != null);
  if (!scriptApp && !isHome) return;
  var root = me.src.replace(/shared\/family\.js.*$/, "");
  var LIB_VER = "3.1.0"; // fallback = libraryVersion；fetch 后覆盖
  var MEDIA = "https://otter.oss-cn-beijing.aliyuncs.com/library/{app}/";
  var SHOTS = "https://otter.oss-cn-beijing.aliyuncs.com/library/{app}/";
  var EXPR = "https://otter.oss-cn-beijing.aliyuncs.com/library/expr/";
  var BRAND = "https://otter.oss-cn-beijing.aliyuncs.com/library/";
  var ALIAS = {
    gametime: "otter-gametime",
    ottertools: "otter-tools",
    ottergit: "otter-git",
    otterdays: "otter-days"
  };

  function $$(s, rootEl) {
    return Array.prototype.slice.call((rootEl || document).querySelectorAll(s));
  }
  function expand(tpl, ver, appId) {
    return tpl
      .replace(/\{version\}/g, ver || LIB_VER)
      .replace(/\{app\}/g, appId || scriptApp || "");
  }
  function absMedia(path, mediaBase) {
    if (!path) return mediaBase;
    return mediaBase + path;
  }
  function fill(tpl, v) {
    return tpl.replace(/\{(\w+)\}/g, function (_, k) {
      return v[k] == null ? "" : v[k];
    });
  }
  function resolveAppId(cfg, raw) {
    if (!raw) return null;
    if (cfg.apps && cfg.apps[raw]) return raw;
    if (ALIAS[raw] && cfg.apps && cfg.apps[ALIAS[raw]]) return ALIAS[raw];
    if (cfg.apps) {
      for (var id in cfg.apps) {
        if (cfg.apps[id] && cfg.apps[id].from === raw) return id;
      }
    }
    return ALIAS[raw] || raw;
  }
  function appVersion(app) {
    return (app.download && app.download.version) || app.latest || "";
  }

  function media(mediaTpl, shotsTpl, appId) {
    var id = appId || scriptApp;
    if (!id) return;
    var base = expand(mediaTpl, LIB_VER, id);
    var shots = expand(shotsTpl || SHOTS, LIB_VER, id);
    if (base.indexOf("{app}") >= 0) base = base.replace(/\{app\}/g, id);
    if (shots.indexOf("{app}") >= 0) shots = shots.replace(/\{app\}/g, id);
    if (window.otterMedia && window.otterMedia.__mediaBase === base && window.otterMedia.__shotsBase === shots) return;
    window.otterMedia = function (p) { return absMedia(p, base, shots); };
    window.otterMedia.__mediaBase = base;
    window.otterMedia.__shotsBase = shots;
    $$("[data-media]").forEach(function (el) {
      el[el.tagName === "A" ? "href" : "src"] = absMedia(el.dataset.media, base);
    });
    $$("[data-media-poster]").forEach(function (el) {
      el.poster = absMedia(el.dataset.mediaPoster, base);
    });
    $$("video source[data-media]").forEach(function (s) { s.parentNode.load(); });
  }
  if (scriptApp) media(MEDIA, SHOTS);

  function expr(base) {
    base = expand(base, LIB_VER, scriptApp);
    if (window.otterExpr && window.otterExpr("") === base) return;
    window.otterExpr = function (p) { return base + p; };
    $$("[data-expr]").forEach(function (el) { el.src = base + el.dataset.expr; });
  }
  function brand(base) {
    base = expand(base, LIB_VER, scriptApp);
    if (!base.endsWith("/")) base += "/";
    window.otterBrand = function (p) { return base + p; };
    $$("[data-brand]").forEach(function (el) {
      el[el.tagName === "A" ? "href" : "src"] = base + el.dataset.brand;
    });
  }
  if (scriptApp) {
    expr(EXPR);
    brand(BRAND);
  }
  if (!window.fetch) return;

  function fillVersions(scope, app) {
    var v = appVersion(app);
    if (!v) return;
    $$( ".v, .ver", scope).forEach(function (el) { el.textContent = "v" + v; });
    $$("[data-ver]", scope).forEach(function (el) {
      var mode = el.dataset.ver;
      el.textContent = mode === "short" ? v.split(".").slice(0, 2).join(".") : v;
    });
    // 兼容成员卡旧写法：.meta li.st
    $$(".meta li.st", scope).forEach(function (el) {
      if (el.hasAttribute("data-ver")) return;
      el.textContent = v;
    });
    var nav = (scope || document).querySelector
      ? (scope || document).querySelector('nav a.btn-sm[href="#download"]')
      : null;
    if (!nav && !scope) {
      nav = document.querySelector('nav a.btn-sm[href="#download"]');
    }
    if (nav) nav.textContent = "下载 " + v.split(".").slice(0, 2).join(".");
  }

  function fillChangelog(scope, app) {
    if (!app.changelog || !app.changelog.length) return;
    var lists = [];
    if (scope) {
      var one = scope.querySelector(".vlist, #changelog");
      if (one) lists.push(one);
    } else {
      lists = $$(".vlist, #changelog");
    }
    lists.forEach(function (list) {
      list.textContent = "";
      app.changelog.forEach(function (r) {
        if (list.id === "changelog" || list.tagName === "OL") {
          var li = document.createElement("li");
          var b = document.createElement("b");
          b.textContent = "v" + r.version;
          var time = document.createElement("time");
          if (r.date) {
            time.setAttribute("datetime", r.date);
            time.textContent = String(r.date).slice(5);
          }
          var span = document.createElement("span");
          span.textContent = r.zh || "";
          li.appendChild(b);
          li.appendChild(time);
          li.appendChild(span);
          list.appendChild(li);
          return;
        }
        var rowLi = document.createElement("li");
        var row = document.createElement("div");
        [["b", "v" + r.version], ["span.vd", (r.date || "").slice(5)], ["span.vt", r.zh || ""]].forEach(function (p) {
          var t = p[0].split(".");
          var el = document.createElement(t[0]);
          if (t[1]) el.className = t[1];
          el.textContent = p[1];
          row.appendChild(el);
        });
        rowLi.appendChild(row);
        list.appendChild(rowLi);
      });
    });
  }

  function fillLinks(cfg, app, appId, where, scope) {
    var dl = app.download, rel = cfg.family && cfg.family.releases;
    if (!dl || !rel) return;
    var v = { app: appId, version: dl.version };
    $$("[data-dl]", scope).forEach(function (a) {
      var key = a.dataset.dl;
      if (!key) {
        a.href = fill(rel.page, v);
        return;
      }
      var file = dl.files && dl.files[key];
      if (!file) return;
      if (key === "android" && where === "global" && dl.files.android_apk) {
        file = dl.files.android_apk;
      }
      v.file = file;
      var mirror = /\.apk$/i.test(file) ? "global" : where;
      a.href = fill(rel[mirror], v);
    });
  }

  function fillStores(app, scope) {
    var stores = app.stores || {};
    $$("[data-store]", scope).forEach(function (a) {
      var key = a.dataset.store;
      var url = stores[key];
      if (!url) return;
      a.href = url;
      a.dataset.hrefReady = "1";
      if (a.tagName === "A" && !a.getAttribute("target")) {
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener");
      }
    });
  }

  function fillFamily(cfg, scope) {
    var fam = cfg.family || {};
    $$("[data-family]", scope).forEach(function (a) {
      var kind = a.dataset.family || "site";
      if (kind === "members") {
        var from = a.dataset.from || "";
        a.href = fill(fam.members || fam.site || "", { from: from });
      } else if (kind === "site") {
        a.href = fam.site || a.href;
      }
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

  function hydrateApp(cfg, appId, scope) {
    var app = cfg.apps[appId];
    if (!app) return;
    fillVersions(scope, app);
    fillChangelog(scope, app);
    fillStores(app, scope);
    fillLinks(cfg, app, appId, "cn", scope);
    where().then(function (w) {
      if (w !== "cn") fillLinks(cfg, app, appId, w, scope);
    });
  }

  fetch(root + "family.json", { cache: "no-cache" })
    .then(function (r) { return r.json(); })
    .then(function (cfg) {
      if (!cfg || cfg.schema !== 1 || !cfg.apps) return;
      if (cfg.family && cfg.family.libraryVersion) LIB_VER = cfg.family.libraryVersion;
      if (scriptApp) {
        if (cfg.family && cfg.family.media) media(cfg.family.media, cfg.family.shots, scriptApp);
        if (cfg.family && cfg.family.expr) expr(cfg.family.expr);
        if (cfg.family && cfg.family.brand) brand(cfg.family.brand);
        hydrateApp(cfg, scriptApp, null);
        fillFamily(cfg, null);
        return;
      }
      // 首页：每个成员卡独立注水
      fillFamily(cfg, null);
      $$(".member[data-app]").forEach(function (card) {
        var appId = resolveAppId(cfg, card.dataset.app);
        if (!appId) return;
        hydrateApp(cfg, appId, card);
      });
    })
    .catch(function () {});
})();
