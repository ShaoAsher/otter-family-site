/* ═══════════════════════════════════════════════════════════════════
   开战页的陪伴层：小獭搭子 · 这局的约定 · 今日记录的心情
   - 搭子：坐在转盘下面那一行，跟着「选中的游戏 / 按住充能 / 计时里程碑 / 接近上限 / 收工」换表情和话
   - 约定：开局前给自己一个时长（可不设），计时中变成进度，到点小獭轻轻提醒一次；收工小结里兑现
   只读主脚本的 GAMES / deckIdx / deckState / tkMood，不改原有状态机；v3.js 调 GtBattle(ctx) 注入工具。
   ═══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
/* 每款游戏和你的「上一次」：选中时搭子说出来 */
var MEMO={
  hsr:{k:'great', t:'昨天 2 局，上次贴了「超爽」'},
  ys:{k:'gacha', t:'今天抽过一次了，还想再抽？'},
  zzz:{k:'coop', t:'3 天没开了，队友在等你'},
  wzry:{k:'laugh', t:'上次三连胜收工，手感还在'},
  mrfz:{k:'retry', t:'上周卡在危机合约 18 级'},
  mc:{k:'calm', t:'上个月盖的小屋还在等你'}
};
/* 计时里程碑：第二列是编排表里的场景（v3.js OT_POOL），不是表情 key */
var MILE=[[30,'run30','半小时了，状态不错'],[60,'run60','一小时啦，起来喝口水'],[90,'run90','一个半小时，眼睛眨一眨'],[120,'run120','两小时了，伸个懒腰？']];
var PLANS=[[30,'30 分钟'],[60,'1 小时'],[0,'到上限'],[-1,'随意']];

var page=document.getElementById('page-timer');
if(page){
  var nav=page.querySelector('.nav'), cta=page.querySelector('.cta');
  var b=document.createElement('div'); b.className='tk-buddy'; b.id='tkBuddy'; b.setAttribute('aria-live','polite');
  b.innerHTML='<img src="assets/otter/expr/still/270/hi.webp" alt=""><span class="say"><span id="tkBuddyT"></span></span>';
  var idx=nav && nav.querySelector('.idx'); if(idx) idx.after(b);
  var p=document.createElement('div'); p.className='tk-plan'; p.id='tkPlan';
  p.innerHTML='<div class="pick"><span class="k">这局打算</span><div class="ops" id="tkPlanOps">'
    +PLANS.map(function(x){ return '<button data-m="'+x[0]+'"'+(x[0]===-1?' class="on"':'')+'>'+x[1]+'</button>'; }).join('')+'</div></div>'
    +'<div class="run"><span id="tkPlanT"></span><i class="bar"><b id="tkPlanB"></b></i></div>';
  if(cta) cta.before(p);
  /* 计时中小獭坐到卡片右肩上当主角（待机时缩回搭子那一行） */
  var stg=page.querySelector('#stage');
  if(stg){ var pc=document.createElement('div'); pc.className='tk-perch'; pc.id='tkPerch'; pc.setAttribute('aria-hidden','true');
    pc.innerHTML='<img src="assets/otter/expr/anim/270/focus.webp" alt="">'; stg.appendChild(pc); }
}

window.GtBattle=function(ctx){
  var $=ctx.$, $$=ctx.$$, STK=ctx.STK, OT=ctx.OT_EXPR, vib=ctx.vib, toast=ctx.toast, sparkle=ctx.sparkle, centerOf=ctx.centerOf, R=ctx.REDUCED;
  var otPick=ctx.otPick, POOL=ctx.OT_POOL||{};
  var bd=$('#tkBuddy'); if(!bd) return;
  var img=bd.querySelector('img'), say=$('#tkBuddyT'), perch=$('#tkPerch'), pimg=perch&&perch.querySelector('img');
  var cur='';
  /* 同一句不重播；换话时小獭弹一下、文字淡入。s 可以是编排表的场景名（同一句话只抽一次脸），也可以直接是表情 key */
  var talk=function(s, text, still){
    var key=s+'|'+text; if(key===cur) return; cur=key;
    var k=POOL[s] && otPick ? otPick(s) : s;
    img.src=STK(k, still?false:undefined); say.textContent=text; bd.style.setProperty('--c', (OT[k]||OT.happy).c);
    if(pimg){ pimg.src=STK(k); perch.style.setProperty('--c', (OT[k]||OT.happy).c); }
    if(!R){ [bd, perch].forEach(function(e){ if(!e) return; e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop'); }); }
  };
  var game=function(){ return (window.GAMES||[])[window.deckIdx||0] || {}; };
  var limitMin=function(){ return Math.round((window.kWaterLimitHours||3)*60); };
  var USED=97;
  var fm=function(m){ return m>=60 ? Math.floor(m/60)+' 小时'+(m%60?' '+(m%60)+' 分':'') : m+' 分钟'; };

  /* ── 约定 ── */
  var plan=-1, warned=false, elapsed=0;
  var planMin=function(){ return plan===0 ? Math.max(10, limitMin()-USED) : plan; };
  var ops=$('#tkPlanOps');
  var paintOps=function(){ var left=Math.max(0, limitMin()-USED);
    $$('button', ops).forEach(function(x){ if(+x.dataset.m===0) x.innerHTML='到上限<small>'+(left>=60?Math.floor(left/60)+'h ':'')+(left%60)+'m</small>'; }); };
  paintOps();
  ops.addEventListener('click', function(e){ var x=e.target.closest('button'); if(!x || x.classList.contains('on')) return;
    $$('button', ops).forEach(function(o){ o.classList.toggle('on', o===x); }); plan=+x.dataset.m; vib(6);
    if(!R){ var c=centerOf(x); sparkle(c[0], c[1], {c:'61,220,255', n:5, r:26}); }
    if(plan===-1) talk('ok', '不设也行，我替你看着上限', true);
    else talk('cheer', '说好了，'+fm(planMin())+'，到点我叫你'); });

  var tmOf=function(){ var t=$('#page-timer [data-go] .tm'); if(!t) return 0; var a=t.textContent.split(':').map(Number);
    return a.length===3 ? a[0]*60+a[1] : a[0]; };
  var paintRun=function(){
    var t=$('#tkPlanT'), bar=$('#tkPlanB'), pm=planMin();
    if(plan===-1){ t.innerHTML='随意玩 · 已经 <b>'+fm(elapsed)+'</b>'; bar.style.width='0'; $('#tkPlan').classList.add('free'); return; }
    $('#tkPlan').classList.remove('free');
    var left=pm-elapsed;
    t.innerHTML= left>=0 ? '约定 '+fm(pm)+' · 还剩 <b>'+fm(left)+'</b>' : '约定的 '+fm(pm)+'到了 · 多玩了 <b>'+fm(-left)+'</b>';
    bar.style.width=Math.min(100, elapsed/pm*100)+'%'; $('#tkPlan').classList.toggle('past', left<0);
  };

  /* ── 状态 → 搭子 ── */
  var st=function(){ return window.deckState||'idle'; };
  var mileHit={};
  var idle=function(){ var g=game(), m=MEMO[g.f]; if(m) talk(m.k, m.t); };
  var onState=function(){
    var s=st(), tm=window.tkMood;
    page.classList.toggle('tk-run', s==='timing'||s==='warn');
    if(s==='idle'){ idle(); paintOps(); }
    else if(s==='timing'){ if(elapsed<5) talk('start', plan>0?'开局！'+fm(planMin())+'，我盯着':'开局！我就在旁边'); }
    else if(s==='warn'){ talk(tm==='over'?'over':'near', tm==='over'?'超过上限了……这局打完收工好不好':'快到上限啦，这局打完就收工？'); }
    else if(s==='done'){ talk('doneShort', '收工！这一局辛苦啦'); }
  };
  new MutationObserver(onState).observe(document.body, {attributes:true, attributeFilter:['class']});
  var ix=$('#tkIdx'); if(ix) new MutationObserver(function(){ if(st()==='idle'||st()==='done') idle(); }).observe(ix, {childList:true, characterData:true, subtree:true});
  var go=$('#page-timer [data-go]');
  if(go) new MutationObserver(function(){ if(go.classList.contains('press') && (st()==='idle'||st()==='done')) talk('charge', '按住……准备好了吗'); else if(st()==='idle') idle(); })
    .observe(go, {attributes:true, attributeFilter:['class']});

  /* 计时：读 CTA 上的时间，里程碑 + 约定到点各说一次 */
  setInterval(function(){
    var s=st(); if(s!=='timing' && s!=='warn'){ if(s==='idle'){ elapsed=0; warned=false; mileHit={}; } return; }
    elapsed=tmOf(); paintRun();
    if(plan!==-1 && !warned && elapsed>=planMin()){ warned=true; vib([20,60,20]);
      MILE.forEach(function(x){ if(elapsed>=x[0]) mileHit[x[0]]=1; });
      talk('run120', '说好的 '+fm(planMin())+'到啦'); toast('说好的 '+fm(planMin())+'到啦，这局打完就收工？', {tone:'info'}); return; }
    if(s==='timing') MILE.forEach(function(x){ if(elapsed>=x[0] && !mileHit[x[0]]){ mileHit[x[0]]=1; talk(x[1], x[2]); vib(8); } });
  }, 500);

  /* 里程碑（收工小结调）：说到做到 > 今天第一局续上连续天数；走查用 `mile=streak|plan` 强制一种 */
  var MILE_DEMO=(location.search.match(/[?&]mile=(\w+)/)||[])[1];
  window.tkMile=function(){
    var kept=plan!==-1 && elapsed-planMin()<=2;
    if(MILE_DEMO==='plan' || kept) return {t:'说到做到', s:'约定 '+fm(plan===-1?30:planMin())+'，到点就收工'};
    if(MILE_DEMO==='streak') return {t:'连续 13 天', s:'再坚持 10 天，追平你最长的 23 天'};
    return null;
  };
  /* 收工小结：没兑现的约定记一笔（兑现了已经是里程碑，不重复说） */
  var done=$('#tkDone');
  if(done) new MutationObserver(function(){ if(!done.classList.contains('on') || plan===-1) return;
    var ch=$('#tdChips'); if(!ch || ch.querySelector('.pl')) return; var over=elapsed-planMin();
    if(over>2) ch.insertAdjacentHTML('afterbegin', '<span class="pl">比约定多 '+fm(over)+'</span>'); })
    .observe(done, {attributes:true, attributeFilter:['class']});

  /* 今日记录：每一局带上那局的心情 */
  var ROW_K=['laugh','gacha'];
  var face=function(r, k){ if(r.querySelector('.mf')) return; var du=r.querySelector('.du'); if(!du) return;
    du.insertAdjacentHTML('beforebegin', '<img class="mf" src="'+STK(k, false)+'" alt="'+((OT[k]||{}).n||'')+'">'); };
  $$('#page-timer .today .row').forEach(function(r, i){ face(r, ROW_K[i%ROW_K.length]); });
  var td=$('#page-timer .today');
  if(td) new MutationObserver(function(){ $$('#page-timer .today .row.fresh').forEach(function(r){
    face(r, {calm:'relief', focus:'happy', near:'proud', over:'cry'}[window.tkMood]||'relief'); }); }).observe(td, {childList:true});

  idle();
};
})();
