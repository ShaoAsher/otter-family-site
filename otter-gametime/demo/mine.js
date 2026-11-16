/* ═══════════════════════════════════════════════════════════════════
   「我」页的游戏档案：三格大数字下面，把你和游戏的关系讲具体
   一局的样子 · 你的节奏（几点开局 / 一周哪天）· 贴得最多的心情 · 我们认识的那天
   数字都是本地已算好的结果（客户端不重算权威指标）；滚到眼前才长出来。v3.js 调 GtMine(ctx)。
   ═══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
var HOURS=[1,0,0,0,0,0,0,1,1,2,2,3,6,8,4,2,2,3,5,9,14,18,12,5];
var HSUM=HOURS.reduce(function(a,b){ return a+b; },0);
var WEEK=[1.2,1.5,0.8,1.4,2.1,3.6,2.4], WK='一二三四五六日';
/* 三格大数字的副标题 + 点一下的换算 */
var NUM_SUB=[['本周 +12.4h','214 小时，差不多能看完 100 部电影了','proud'],['本周 +9 局','268 局，平均一局 48 分钟','happy'],['本周 +3 件','46 件藏品，每一件都是那天的你','love']];

var nums=document.querySelector('#page-me .m3-nums');
if(nums){
  [].forEach.call(nums.querySelectorAll('.n'), function(n, i){ var s=document.createElement('div'); s.className='mn-sub'; s.textContent=NUM_SUB[i][0]; n.appendChild(s); });
  var sec=document.createElement('div'); sec.className='v3-sec mn'; sec.id='mnSec';
  sec.innerHTML='<div class="v3-hd"><span class="t">你的游戏档案</span><span class="more">只在这台手机</span></div>'
    /* 一局的样子 */
    +'<div class="v3-card mn-one"><div class="hd"><b>一局的样子</b><img src="assets/otter/expr/still/270/focus.webp" alt=""></div>'
    +'<div class="cols"><div><small>平均一局</small><b><em data-mn="48">48</em><i>分钟</i></b><span>比上月短 6 分</span></div>'
    +'<div><small>最长一局</small><b>3<i>h</i> 20<i>m</i></b><span>10.18 星穹铁道</span></div>'
    +'<div class="ring"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="18"/><circle class="v" cx="22" cy="22" r="18" style="--p:.92"/></svg><b><em data-mn="92">92</em>%</b><span>准时收工</span></div></div></div>'
    /* 节奏：几点开局 + 一周哪天 */
    +'<div class="v3-card mn-rhythm"><div class="clock" id="mnClock"></div>'
    +'<div class="rt"><small>你最常在</small><b id="mnPeak">晚上 9 点</b><span id="mnPeakS">开局 · 占全部的 18%</span>'
    +'<div class="wk" id="mnWeek"></div><p class="mn-say"><img src="assets/otter/expr/still/270/night.webp" alt="">周六最上头 · 周三最克制</p></div></div>'
    /* 心情 */
    +'<div class="v3-card mn-mood"><div class="hd"><b>贴得最多的心情</b><span id="mnMoodN"></span></div><div class="seg" id="mnSeg"></div><div class="lg" id="mnLg"></div></div>'
    /* 初见 */
    +'<div class="v3-card mn-first"><img class="ot" src="assets/otter/expr/anim/270/hug.webp" alt=""><div class="tx"><small>我们认识的那天 · 6.28</small><b>第一局是原神，玩了 42 分钟</b><span>从那天起的 268 局，我都记着</span></div></div>';
  nums.after(sec);
}

window.GtMine=function(ctx){
  var $=ctx.$, $$=ctx.$$, STK=ctx.STK, OT=ctx.OT_EXPR, ITEMS=ctx.ITEMS, tagKey=ctx.tagKey, tip=ctx.tip, vib=ctx.vib, R=ctx.REDUCED, openS3=ctx.openS3;
  var sec=$('#mnSec'); if(!sec) return;

  /* 三格大数字：点一下换个说法 */
  $$('#page-me .m3-nums .n').forEach(function(n, i){ n.addEventListener('click', function(){ if(n.dataset.goto) return; vib(5);
    tip(n, NUM_SUB[i][1], {mood:NUM_SUB[i][2], ms:2200}); }); });

  /* 时段钟：24 根放射柱，最高那根实色；点柱子说那个钟点 */
  var clock=$('#mnClock'), max=Math.max.apply(null, HOURS), peak=HOURS.indexOf(max);
  var svg='<svg viewBox="0 0 140 140"><circle class="bg" cx="70" cy="70" r="30"/>';
  HOURS.forEach(function(v, h){ var a=(h/24)*Math.PI*2-Math.PI/2, r0=34, r1=34+Math.max(2, v/max*32);
    var x0=70+Math.cos(a)*r0, y0=70+Math.sin(a)*r0, x1=70+Math.cos(a)*r1, y1=70+Math.sin(a)*r1;
    svg+='<line data-h="'+h+'" class="'+(h===peak?'pk':'')+'" style="--i:'+h+'" x1="'+x0.toFixed(1)+'" y1="'+y0.toFixed(1)+'" x2="'+x1.toFixed(1)+'" y2="'+y1.toFixed(1)+'"/>'; });
  [[0,'0'],[6,'6'],[12,'12'],[18,'18']].forEach(function(t){ var a=(t[0]/24)*Math.PI*2-Math.PI/2;
    svg+='<text x="'+(70+Math.cos(a)*20).toFixed(1)+'" y="'+(70+Math.sin(a)*20+3).toFixed(1)+'">'+t[1]+'</text>'; });
  clock.innerHTML=svg+'</svg>';
  var hourName=function(h){ return (h<5?'凌晨 ':h<12?'上午 ':h<13?'中午 ':h<18?'下午 ':'晚上 ')+(h>12?h-12:h)+' 点'; };
  clock.addEventListener('click', function(e){ var l=e.target.closest('line'); if(!l) return; var h=+l.dataset.h;
    $$('line', clock).forEach(function(x){ x.classList.toggle('on', x===l); });
    $('#mnPeak').textContent=hourName(h); $('#mnPeakS').textContent=HOURS[h]?'开局 · 占全部的 '+Math.max(1, Math.round(HOURS[h]/HSUM*100))+'%':'从没在这个点开过局'; vib(5); });

  var wk=$('#mnWeek'), wmax=Math.max.apply(null, WEEK), wmin=Math.min.apply(null, WEEK);
  wk.innerHTML=WEEK.map(function(v, i){ return '<div class="'+(v===wmax?'hi':v===wmin?'lo':'')+'" style="--h:'+Math.round(v/wmax*100)+'%;--i:'+i+'"><i></i><span>'+WK[i]+'</span></div>'; }).join('');

  /* 心情：从藏品标签统计，前 5 个 + 其他 */
  var cnt={}, tot=0;
  ['game','life'].forEach(function(r){ (ITEMS[r]||[]).forEach(function(it){ (it.tags||[]).forEach(function(t){ var k=tagKey(t); if(!OT[k]) return; cnt[k]=(cnt[k]||0)+1; tot++; }); }); });
  var ks=Object.keys(cnt).sort(function(a,b){ return cnt[b]-cnt[a]; }), top=ks.slice(0,5), rest=tot-top.reduce(function(a,k){ return a+cnt[k]; },0);
  $('#mnMoodN').textContent='共贴了 '+tot+' 次';
  $('#mnSeg').innerHTML=top.map(function(k, i){ return '<i style="--c:'+OT[k].c+';--w:'+(cnt[k]/tot*100)+'%;--i:'+i+'"></i>'; }).join('')+(rest?'<i class="rest" style="--w:'+(rest/tot*100)+'%;--i:5"></i>':'');
  $('#mnLg').innerHTML=top.map(function(k){ return '<button data-k="'+k+'" style="--c:'+OT[k].c+'"><img src="'+STK(k, false)+'" alt=""><span>'+OT[k].n+'</span><b>'+Math.round(cnt[k]/tot*100)+'%</b></button>'; }).join('');
  $('#mnLg').addEventListener('click', function(e){ var x=e.target.closest('button'); if(!x) return; var k=x.dataset.k; vib(5);
    tip(x, OT[k].say+' · 贴过 '+cnt[k]+' 次', {mood:k, ms:2000}); });

  /* 滚到眼前才长出来：数字滚动 + 柱子升起 */
  var grow=function(card){ if(card.dataset.grown) return; card.dataset.grown=1; card.classList.add('in');
    $$('[data-mn]', card).forEach(function(el){ var to=+el.dataset.mn; if(R){ el.textContent=to; return; } var t0=performance.now();
      (function f(now){ var p=Math.min(1,(now-t0)/900), e=1-Math.pow(1-p,3); el.textContent=Math.round(to*e); if(p<1) requestAnimationFrame(f); })(t0); }); };
  var cards=$$('.v3-card', sec);
  if(window.IntersectionObserver && !R){ var io=new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ grow(e.target); io.unobserve(e.target); } }); }, {threshold:.35});
    cards.forEach(function(c){ io.observe(c); }); }
  else cards.forEach(grow);
  /* 每次进「我」重播一次 */
  window.mnReplay=function(){ if(R) return; cards.forEach(function(c){ delete c.dataset.grown; c.classList.remove('in'); if(io) io.observe(c); }); };
};
})();
