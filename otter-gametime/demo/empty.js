/* ═══════════════════════════════════════════════════════════════════
   空态 & 骨架 —— 全站一套（样式见 empty.css；规范与 App 落地计划见设计文档 §8.6）
   · GtEmpty.SPEC   所有空态的登记表（唯一来源）：表情 · 标题 · 副文 · 点她换的几句 · 动作 · 虚线占位形状 · 尺寸
   · GtEmpty.html(id, over) / GtEmpty.mount(host, id, over)
   · GtSkel.show(page) / GtSkel.hide(page)
   走查深链：?empty=all | home,timer,gallery,me（新用户：什么都还没有）
             ?skel=1（每次进 Tab 先放 1s 骨架）· ?skel=hold（骨架停住，点一下放行）
   须在主脚本和 v3.js 之前加载：它们渲染时直接调 GtEmpty。
   ═══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
var Q=new URLSearchParams(location.search);var R=matchMedia('(prefers-reduced-motion: reduce)').matches;
var vib=function(n){ if(navigator.vibrate) navigator.vibrate(n); };
var STK=function(k, still){ return 'assets/otter/expr/'+(still?'still/270/':'anim/270/')+k+'.webp'; };
var esc=function(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); };
var hour=function(){ var h=Q.get('hour'); return h!==null?+h:new Date().getHours(); };
var night=function(){ var h=hour(); return h>=23 || h<5; };

var EMPTY=(Q.get('empty')||'').split(',').filter(Boolean);
var on=function(page){ return EMPTY.indexOf('all')>=0 || EMPTY.indexOf(page)>=0; };

/* ── 登记表 ─────────────────────────────────────────────────────
   写法规则（App 同一套）：
   t 标题 = 现状，≤ 12 字，不写「暂无 / 没有数据」，用小獭的口吻
   s 副文 = 为什么空 / 下一步做什么，≤ 2 行
   lines = 点小獭时轮换的几句（第一句就是 s）
   act 主动作 ≤ 1（整页用实体按钮，卡内 / 行内用文字链）；alt 次动作 ≤ 1
   k 表情：邀请 hi·cheer·love · 筛选无果 think · 清空 / 完成 relief · 出错 please · 深夜整页自动换 sleepy
   ec 情绪色（虚线、粒子、文字链），默认 accent 青；生活粉 · 回忆紫 · 暖橙 */
var C={cyan:'61,220,255', pink:'255,138,184', violet:'155,123,240', warm:'255,170,90', green:'110,231,168'};
var SPEC={
  'home.week':  {size:'card', k:'cheer', ghost:'days', t:'火苗从今天开始', s:'每天打开看一眼，就算一天',
                 lines:['每天打开看一眼，就算一天','连着来，火苗会越烧越旺','我会帮你数着的'], ec:C.warm},
  'home.lib':   {size:'card', k:'hi', ghost:'icons', t:'游戏库还空着', s:'把常玩的几款加进来，开战时一点就开',
                 lines:['把常玩的几款加进来，开战时一点就开','你平时都玩什么呀？','加几款，我好认识你～'], act:{label:'添加游戏', sh3:'sh3-games'}},
  'home.mem':   {size:'card', k:'love', ghost:'polaroid', t:'第一张拍立得，等你来贴', s:'收工后点「记一条」，那一刻就留下来了',
                 lines:['收工后点「记一条」，那一刻就留下来了','出金、通关、连跪，都值得记','我会帮你收好的'], act:{label:'记一条', s3:'s3-compose'}, ec:C.violet},
  'timer.deck': {size:'page', k:'hi', ghost:'card', t:'还没有可以开战的游戏', s:'先加一款，开战时我帮你看着时间',
                 lines:['先加一款，开战时我帮你看着时间','想玩什么？我陪你','加好了就能开战啦'], act:{label:'添加游戏', sh3:'sh3-games'}},
  'timer.today':{size:'card', k:'calm', ghost:'rows', t:'今天还没开局', s:'开一局，时长会记在这里',
                 lines:['开一局，时长会记在这里','今天休息一下也很好','想玩就去吧'], ec:C.green},
  /* 藏品页右下角常驻「记一条」，空态不再放同名按钮，副文指过去 */
  'gallery.game':{size:'page', k:'highlight', ghost:'polaroid', t:'游戏藏品还空着', s:'高光、出金、连跪……点右下角「记一条」，那一刻就留下来了',
                 lines:['高光、出金、连跪……点右下角「记一条」，那一刻就留下来了','第一件藏品，想记点什么？','我已经准备好相框了']},
  'gallery.life':{size:'page', k:'cafe', ghost:'polaroid', t:'生活藏品还空着', s:'一顿好吃的、一段散步、一场雨，都值得记一下',
                 lines:['一顿好吃的、一段散步、一场雨，都值得记一下','今天有什么小开心吗？','不玩游戏的时候，你在做什么呀'], ec:C.pink},
  'gallery.when':{size:'inline', k:'think', t:'这段时间还空着', s:'换个时间看看？', act:{label:'看全部', fn:'galAll'}},
  'gallery.tag':{size:'inline', k:'think', t:'这段时间还没有「{tag}」', s:'换个时间，或者换个标签看看', act:{label:'清除筛选', fn:'galAll'}},
  'me.hl':      {size:'card', k:'highlight', ghost:'hl', t:'第一张高光，还在路上', s:'记下的藏品里，最好看的那张会放在这里',
                 lines:['记下的藏品里，最好看的那张会放在这里','出金那天记得拍下来哦','我会挑最闪的一张'], act:{label:'记一条', s3:'s3-compose'}, ec:C.violet},
  'me.week':    {size:'card', k:'hi', ghost:'bars', t:'这周还没开过局', s:'第一局，我陪你',
                 lines:['第一局，我陪你','玩多久都行，我帮你记着','一周后这里会长出七根小柱子'], ec:C.violet},
  'me.pod':     {size:'card', k:'think', ghost:'pod', t:'领奖台还空着', s:'玩得最久的三款，会站上来',
                 lines:['玩得最久的三款，会站上来','谁会拿第一呢？','我已经备好皇冠了'], ec:C.warm},
  'drafts':     {size:'page', k:'nap', t:'没有写到一半的东西', s:'在「记一条」里点返回，就能把没写完的存到这里',
                 lines:['在「记一条」里点返回，就能把没写完的存到这里','写一半也没关系，我帮你留着'], ec:C.violet},
  'trash':      {size:'page', k:'relief', t:'回收站空空的', s:'删掉的藏品会在这里待 30 天，后悔了随时能找回来',
                 lines:['删掉的藏品会在这里待 30 天，后悔了随时能找回来','干干净净，舒服～'], act:{label:'回藏品看看', goto:'gallery', ghost:true}, ec:C.green},
  'link':       {size:'inline', k:'think', t:'这款最近还没开过局', s:'先去「开战」玩一局，收工后就能记了'},
  'games.search':{size:'inline', k:'think', t:'没找到「{q}」', s:'换个叫法试试？'},
  'error.load': {size:'page', k:'please', t:'刚才没读出来', s:'数据都还在手机里，再试一次就好',
                 lines:['数据都还在手机里，再试一次就好','是我手滑了，再来一次好不好'], act:{label:'再试一次', fn:'retry'}, ec:C.warm, noNight:true}
};

var AMB={sleepy:'zzZ', nap:'zzZ', goodnight:'zzZ', think:'?·?', speechless:'?·?', please:'…·…'};
var GHOST={
  polaroid:function(){ return [['-7deg',0],['4deg',1],['8deg',2]].map(function(r){ return '<i style="--r:'+r[0]+';--i:'+r[1]+'"></i>'; }).join(''); },
  icons:function(){ return '<i class="add" style="--i:0">+</i><i style="--i:1"></i><i style="--i:2"></i><i style="--i:3"></i><i style="--i:4"></i>'; },
  days:function(){ var s=''; for(var i=0;i<7;i++) s+='<i'+(i===6?' class="now"':'')+' style="--i:'+i+'"></i>'; return s; },
  bars:function(){ return [22,34,18,40,28,46,26].map(function(h,i){ return '<i style="--h:'+h+'px;--i:'+i+'"></i>'; }).join(''); },
  pod:function(){ return '<i style="--h:62px;--i:1">2</i><i style="--h:84px;--i:0">1</i><i style="--h:46px;--i:2">3</i>'; },
  rows:function(){ return '<i style="--i:0"></i><i style="--i:1"></i><i style="--i:2"></i>'; },
  card:function(){ return '<i class="add" style="--i:0">+</i>'; },
  hl:function(){ return '<i class="big" style="--i:0"></i><i style="--i:1"></i><i style="--i:2"></i><i style="--i:3"></i>'; }
};
var fill=function(s, v){ return String(s||'').replace(/\{(\w+)\}/g, function(_, k){ return esc(v && v[k]!=null ? v[k] : ''); }); };

function actHtml(a, size){
  if(!a) return '';
  var attr=a.s3?' data-s3="'+a.s3+'"':a.sh3?' data-sh3="'+a.sh3+'"':a.goto?' data-goto="'+a.goto+'"':a.fn?' data-ge-fn="'+a.fn+'"':'';
  if(size==='page') return '<button class="slab'+(a.ghost?' ghost':'')+'"'+attr+'>'+esc(a.label)+'</button>';
  return '<button class="ge-link"'+attr+'>'+esc(a.label)+'</button>';
}

/** over：覆盖登记表的字段（k / t / s / act / ec），以及模板变量 vars:{tag, q} */
function html(id, over){
  var o={}, b=SPEC[id]||SPEC['error.load'], k;
  for(k in b) o[k]=b[k];
  if(over) for(k in over) o[k]=over[k];
  var v=o.vars||{}, ek=o.k;
  if(o.size==='page' && night() && !o.noNight) ek='sleepy';
  var amb=(AMB[ek]||'✦✧·').split(''), t=fill(o.t, v), s=fill(o.s, v);
  var lines=(o.lines||[o.s]).map(function(x){ return fill(x, v); });
  var ambH='<span class="ge-amb" aria-hidden="true">'+amb.map(function(c,i){
    return '<i style="--x:'+[-26,14,30][i]+'px;--dx:'+[-10,6,12][i]+'px;--d:'+(i*1.2)+'s">'+c+'</i>'; }).join('')+'</span>';
  /* 约束 D7：同屏动图 ≤ 3 —— 只有整页空态用动图；卡内 / 行内用静帧 + CSS 呼吸，点一下才换动图 */
  var still=o.size!=='page';
  var ot='<img class="ge-ot" src="'+STK(ek, still)+'" alt="小獭" draggable="false">';
  var gh=o.ghost&&GHOST[o.ghost]?'<div class="ge-gh '+o.ghost+'" aria-hidden="true">'+GHOST[o.ghost]()+'</div>':'';
  var head='<div class="ge ge-'+o.size+' in" data-ge="'+id+'" data-k="'+ek+'" data-lines="'+esc(JSON.stringify(lines))+'" style="--ec:'+(o.ec||C.cyan)+'" role="status">';
  if(o.size==='page')
    return head+'<div class="ge-stage">'+gh+ambH+ot+'<i class="ge-sh"></i></div>'
      +'<b class="ge-t">'+t+'</b><p class="ge-s">'+s+'</p>'
      +(o.act||o.alt?'<div class="ge-acts">'+actHtml(o.act,'page')+actHtml(o.alt,'link')+'</div>':'')+'</div>';
  if(o.size==='card')
    return head+gh+'<div class="ge-row">'+'<span style="position:relative">'+ambH+ot+'</span>'
      +'<div class="ge-tx"><b class="ge-t">'+t+'</b><p class="ge-s">'+s+'</p></div>'+actHtml(o.act,'card')+'</div></div>';
  return head+'<span style="position:relative;display:block">'+ambH+ot+'</span><b class="ge-t">'+t+'</b><p class="ge-s">'+s+'</p>'+actHtml(o.act,'inline')+'</div>';
}
function mount(host, id, over){ if(!host) return null; host.innerHTML=html(id, over); host.classList.add('ge-host'); return host.firstElementChild; }

/* ── 生命力：点小獭 → 弹一下 + 冒两颗星 + 换一句；连点三下害羞 ── */
function spark(x, y, ch, n){
  if(R) return;
  for(var i=0;i<n;i++){ var s=document.createElement('span'); s.textContent=ch[i%ch.length];
    s.style.cssText='position:fixed;left:'+x+'px;top:'+y+'px;z-index:500;pointer-events:none;font-weight:800;font-size:14px;color:rgb(255,210,122)';
    document.body.appendChild(s);
    var a=(Math.random()*1.4-.7)-Math.PI/2, d=34+Math.random()*26;
    s.animate([{transform:'translate(-50%,-50%) scale(.4)',opacity:0},{transform:'translate(calc(-50% + '+Math.cos(a)*d*.5+'px),calc(-50% + '+Math.sin(a)*d*.5+'px)) scale(1.1)',opacity:1,offset:.35},
      {transform:'translate(calc(-50% + '+Math.cos(a)*d+'px),calc(-50% + '+Math.sin(a)*d+'px)) scale(.8)',opacity:0}], {duration:700+i*60, easing:'cubic-bezier(.2,.7,.3,1)'}).onfinish=(function(el){ return function(){ el.remove(); }; })(s); }
}
document.addEventListener('click', function(e){
  var ot=e.target.closest('.ge-ot');
  if(ot){
    var g=ot.closest('.ge'), lines=JSON.parse(g.dataset.lines||'[]'), sEl=g.querySelector('.ge-s');
    var n=(+g.dataset.n||0)+1; g.dataset.n=n;
    ot.classList.remove('poke'); void ot.offsetWidth; ot.classList.add('poke'); vib(8);
    var r=ot.getBoundingClientRect(); spark(r.left+r.width/2, r.top+r.height*.25, ['✦','✧'], 3);
    var next=n%4===3?'好啦好啦，我在呢～':lines[n%lines.length], still=!g.classList.contains('ge-page');
    clearTimeout(ot._t);
    ot.src=STK(n%4===3?'shy':g.dataset.k);
    ot._t=setTimeout(function(){ ot.src=STK(g.dataset.k, still); }, n%4===3?1600:4000);
    if(sEl && next){ sEl.classList.add('swap'); setTimeout(function(){ sEl.textContent=next; sEl.classList.remove('swap'); }, 200); }
    return;
  }
  var f=e.target.closest('[data-ge-fn]');
  if(f && FNS[f.dataset.geFn]){ vib(6); FNS[f.dataset.geFn](f); }
});
var FNS={ retry:function(b){ var g=b.closest('.ge'); if(g){ g.style.opacity='.4'; setTimeout(function(){ g.style.opacity=''; }, 600); } } };

window.GtEmpty={on:on, SPEC:SPEC, html:html, mount:mount, fns:FNS, night:night};

/* ═══ 新用户：四个 Tab 改写成「什么都还没有」 ══════════════════════ */
var $=function(s,r){ return (r||document).querySelector(s); };
var $$=function(s,r){ return [].slice.call((r||document).querySelectorAll(s)); };
var set=function(sel, html){ var el=$(sel); if(el) el.innerHTML=html; return el; };
function typeLine(el, text){
  if(!el) return; if(R){ el.textContent=text; return; }
  el.textContent=''; var i=0; (function f(){ el.textContent=text.slice(0, ++i); if(i<text.length) setTimeout(f, 42); })();
}
var EMPTY_PAINT={
  home:function(){
    document.body.classList.add('e-home');
    $$('.h3-streak').forEach(function(st){ var b=st.querySelector('b'); if(b) b.textContent='0'; st.style.filter='grayscale(1) opacity(.7)'; st.setAttribute('aria-label','还没有连续打卡，打开打卡日历'); });
    set('#h3Today','0m'); set('#page-home .h3-read .k','今天 · 0 局'); set('#h3Hint','想玩就去吧，我帮你看着时间');
    var sp=$('#h3Split'); if(sp) sp.style.display='none';
    var w=$('#h3Water'); if(w) w.style.setProperty('--lv', .06);
    setTimeout(function(){ typeLine($('#tw'), '我们刚认识～先告诉我你常玩什么吧'); }, 700);
    var cv=$('#h3Now .cover'); if(cv){ cv.className='cover ge-slot'; cv.innerHTML='+'; }
    set('#h3NowCapT','还没有游戏'); set('#h3NowNm','先挑一款常玩的游戏'); set('#h3NowS','开战时小獭帮你记着时长');
    var go=$('#h3Go'); if(go && !go.dataset.ge){ go.dataset.ge=1; go.textContent='挑游戏';
      go.addEventListener('click', function(e){ e.stopImmediatePropagation(); var t=$('[data-sh3="sh3-games"]'); if(t) t.click(); }, true); }
    var more=$('#page-home .h3-lib .more'); if(more) more.textContent='全部 0 款 ›';
    mount($('#h3Days'), 'home.week');
    swapRow('#h3Lib', 'home.lib'); swapRow('#h3Mem', 'home.mem');
  },
  timer:function(){
    document.body.classList.add('e-timer');
    set('#tkSub','先加一款游戏');
    var stage=$('#stage'); if(stage && !$('.ge-deck', stage)){ var d=document.createElement('div'); d.className='ge-deck'; stage.appendChild(d); mount(d, 'timer.deck'); }
    window.paintTodayRing=function(){ if(window.tkRing) tkRing.set({ratio:.001, color:'61,220,255', comet:false, speed:1}); };
    window.paintTodayRing(); setTimeout(function(){ set('#tkRingPct','0%'); }, 1400); set('#page-timer .today .gauge .k','今天 · 0 局');
    set('#page-timer .today .gauge .v','0m <small>/ <span class="tkLimit">3</span> 小时</small>');
    set('#page-timer .today .gauge .hint','还没开局'); set('#page-timer .today .streak','0 天');
    $$('#page-timer .today > .row').forEach(function(r){ r.remove(); });
    var td=$('#page-timer .today'); if(td && !$('.ge', td)){ var h=document.createElement('div'); td.appendChild(h); mount(h, 'timer.today'); }
  },
  gallery:function(){
    document.body.classList.add('e-gallery');
    $$('#g3Realm small').forEach(function(s){ s.textContent='0'; });
    set('#g3FootN','0'); set('#g3FootS','记下第一件，这里会亮起一格');
    var b=$('#page-gallery .g3-foot b'); if(b) b.innerHTML='这个月还没留下东西';
    var f=$('#g3Filter'); if(f) f.style.display='none';
  },
  me:function(){
    set('#page-me .v3-head .eyebrow','第 1 天，很高兴认识你');
    set('#page-me .m3-id .line','打卡率 <em>—</em> · 连续 <em>0</em> 天');
    set('#m3WeekV','0<small>/ 20 小时预算</small>');
    var dl=$('#page-me .m3-week .delta'); if(dl) dl.style.display='none';
    var bg=$('#m3Budget'); if(bg) bg.style.width='0';
    var say=$('#page-me .m3-week .say'); if(say) say.remove();
    mount($('#m3Bars'), 'me.week');
    $$('#page-me .m3-nums b[data-c3]').forEach(function(b){ b.dataset.c3=0; b.textContent='0'; b.closest('.n').classList.add('zero'); });
    mount($('#m3Pod'), 'me.pod');
    var hl=$('#meHl'); if(hl && !$('.ge', hl)){ var big=$('#meHlBig'), row=$('#meHlRow'); if(row) row.remove();
      if(big){ big.className=''; big.removeAttribute('id'); big.onclick=null; mount(big, 'me.hl'); } }
    var mem=$('#meMem'); if(mem){
      set('#meMem .tx b','0 局 · 0 小时'); set('#meMem .tx span','今天是我们认识的第 1 天');
      var ot=$('#meMem .ot'); if(ot) ot.src=STK('hi');
      var sp=$('#meSpark'); if(sp) sp.innerHTML=Array(14).join('<i style="--h:4%"></i>')+'<i class="now" style="--h:4%"></i>';
    }
    var g=$('#page-me .m3-row[data-s3="s3-games"] .s'); if(g) g.textContent='还没有游戏 · 先加一款';
  }
};
/* 横向滚动行（游戏库 / 拍立得）直接换成空态：原来没有卡，就不加卡（约束 E3） */
function swapRow(sel, id){
  var row=$(sel); if(!row || row.dataset.ge) return;
  row.dataset.ge=1; row.className=''; row.removeAttribute('style'); mount(row, id);
}

/* ═══ 骨架 ═══════════════════════════════════════════════════════ */
var SK={
  head:function(right){ return '<div class="sk-row" style="align-items:flex-end;margin-bottom:18px"><div class="sk-col"><i class="sk" style="width:96px;height:10px"></i><i class="sk" style="width:172px;height:32px;margin-top:6px"></i></div>'+(right||'')+'</div>'; },
  sec:function(w){ return '<div class="sk-sec"><i class="sk" style="width:'+(w||84)+'px;height:16px;margin-bottom:var(--gap)"></i>'; }
};
var SKEL={
  home:function(){
    return SK.head('<i class="sk pill" style="width:64px;height:40px"></i>')
      +'<div class="sk card" style="height:236px;padding:16px;position:relative"><img class="sk-ot" src="'+STK('read')+'" alt=""><span class="sk-say">小獭在翻本子…</span></div>'
      +'<div class="sk card sk-gap" style="height:88px"></div>'
      +SK.sec()+'<div class="sk card" style="height:78px"></div></div>'
      +SK.sec(64)+'<div class="sk-row">'+[0,1,2,3,4].map(function(){ return '<i class="sk" style="width:58px;height:58px;border-radius:18px;flex:none"></i>'; }).join('')+'</div></div>'
      +SK.sec(96)+'<div class="sk-row">'+['-4deg','3deg','-2deg'].map(function(r){ return '<i class="sk" style="width:112px;height:140px;border-radius:6px;flex:none;rotate:'+r+'"></i>'; }).join('')+'</div></div>';
  },
  gallery:function(){
    return SK.head('<i class="sk round" style="width:40px;height:40px"></i><i class="sk round" style="width:40px;height:40px"></i>')
      +'<i class="sk pill" style="height:48px"></i>'
      +'<div class="sk card sk-gap" style="height:72px;position:relative"><img class="sk-ot" src="'+STK('photo')+'" alt="" style="width:44px;height:44px;bottom:12px"><span class="sk-say" style="right:64px;bottom:26px">小獭在翻相册…</span></div>'
      +'<div class="sk-row sk-gap">'+[52,52,52,52].map(function(w){ return '<i class="sk pill" style="width:'+w+'px;height:32px"></i>'; }).join('')+'</div>'
      +'<div class="sk card sk-gap" style="height:220px"></div>'
      +'<div class="sk-row sk-gap" style="align-items:flex-start"><div class="sk-col" style="gap:12px"><i class="sk card" style="height:200px"></i><i class="sk card" style="height:150px"></i></div>'
      +'<div class="sk-col" style="gap:12px"><i class="sk card" style="height:140px"></i><i class="sk card" style="height:210px"></i></div></div>';
  },
  me:function(){
    return SK.head('<i class="sk round" style="width:40px;height:40px"></i>')
      +'<div class="sk card" style="height:120px;padding:18px;position:relative"><div class="sk-row"><i class="sk round" style="width:72px;height:72px;flex:none"></i><div class="sk-col"><i class="sk" style="width:60%;height:16px"></i><i class="sk" style="width:80%;height:11px"></i><i class="sk pill" style="width:120px;height:26px"></i></div></div></div>'
      +SK.sec()+'<div class="sk card" style="height:200px;position:relative"><img class="sk-ot" src="'+STK('highlight')+'" alt=""><span class="sk-say">小獭在挑高光…</span></div>'
      +'<div class="sk-row sk-gap">'+[0,1,2].map(function(){ return '<i class="sk" style="flex:1;height:112px;border-radius:16px"></i>'; }).join('')+'</div></div>'
      +'<div class="sk card sk-gap" style="height:150px"></div>';
  },
  timer:function(){
    return '<div style="padding:calc(env(safe-area-inset-top,0px) + 20px) var(--gx) 0"><i class="sk" style="width:64px;height:10px"></i><i class="sk" style="width:96px;height:30px;margin-top:8px"></i></div>'
      +'<div style="display:flex;justify-content:center;margin-top:40px;position:relative"><i class="sk" style="width:150px;height:190px;border-radius:26px"></i>'
      +'<img class="sk-ot" src="'+STK('loading')+'" alt="" style="right:calc(50% - 110px);bottom:-14px"><span class="sk-say" style="right:auto;left:50%;translate:-50% 0;bottom:-40px">小獭在洗牌…</span></div>'
      +'<div style="padding:0 var(--gx);margin-top:72px"><div class="sk-row"><i class="sk" style="width:56px;height:14px"></i>'+[0,1,2,3].map(function(){ return '<i class="sk pill" style="flex:1;height:34px"></i>'; }).join('')+'</div>'
      +'<i class="sk pill" style="height:72px;margin-top:12px"></i>'
      +'<i class="sk" style="width:84px;height:16px;margin-top:var(--sec)"></i><i class="sk card" style="height:100px;margin-top:var(--gap)"></i></div>';
  }
};
var SKEL_MODE=Q.get('skel');
function skShow(page){
  var p=$('#page-'+page); if(!p || !SKEL[page] || $('.sk-layer', p)) return;
  var L=document.createElement('div'); L.className='sk-layer'; L.innerHTML=SKEL[page]();
  if(page==='gallery'){ var g=$('#g3Realm'); if(g) L.style.setProperty('--sk', document.body.dataset.realm==='life'?C.pink:C.cyan); }
  p.classList.remove('sk-off'); p.classList.add('sk-on'); p.appendChild(L);
  var say=$('.sk-say', L), t1=setTimeout(function(){ if(say) say.classList.add('on'); }, 700),
      t2=setTimeout(function(){ if(say){ say.classList.remove('on'); setTimeout(function(){ say.textContent='东西有点多，再等我一下～'; say.classList.add('on'); }, 300); } }, 2600);
  L._t=[t1,t2];
  if(SKEL_MODE==='hold'){ L.style.pointerEvents='auto'; L.addEventListener('click', function(){ skHide(page); }); }
  else setTimeout(function(){ skHide(page); }, 1000);
}
function skHide(page){
  var p=$('#page-'+page), L=p && $('.sk-layer', p); if(!L) return;
  L._t.forEach(clearTimeout); L.classList.add('sk-done');
  setTimeout(function(){ L.classList.add('out'); p.classList.remove('sk-on'); p.classList.add('sk-off');
    setTimeout(function(){ L.remove(); p.classList.remove('sk-off'); }, 400); }, R?0:260);
}
window.GtSkel={show:skShow, hide:skHide};

/* ═══ 接线：等所有脚本渲染完，再按深链改写 / 挂骨架 ═══════════════ */
document.addEventListener('DOMContentLoaded', function(){ setTimeout(boot, 0); });
function boot(){
  ['home','timer','gallery','me'].forEach(function(p){ if(on(p) && EMPTY_PAINT[p]) try{ EMPTY_PAINT[p](); }catch(e){ console.warn('[empty] '+p, e); } });
  if(typeof window.enter==='function'){
    var orig=window.enter;
    window.enter=function(name){
      orig(name);
      if(on(name) && EMPTY_PAINT[name]) try{ EMPTY_PAINT[name](); }catch(e){}
      if(SKEL_MODE) skShow(name);
    };
  }
  if(SKEL_MODE) skShow(document.body.dataset.page||'home');
  setInterval(function(){ document.body.classList.toggle('ge-solo', !!$('.page.on .ge-page, .s3.on .ge-page, .page.on > .sk-layer')); }, 400);
  if(EMPTY.length || SKEL_MODE){
    var tag=document.createElement('div'); tag.className='ge-dev';
    tag.textContent=(EMPTY.length?'空态 · '+EMPTY.join(','):'')+(EMPTY.length&&SKEL_MODE?' · ':'')+(SKEL_MODE?'骨架 · 点我重放':'');
    tag.onclick=function(){ if(SKEL_MODE) skShow(document.body.dataset.page||'home'); };
    document.body.appendChild(tag);
  }
}
})();
