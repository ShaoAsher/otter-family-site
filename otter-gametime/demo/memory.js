/* ═══════════════════════════════════════════════════════════════════
   记忆页 + 「我」页瘦身
   - 「我」只留：名片 · 最近的精彩（高光大图 + 三张小卡）· 记忆入口卡 · 功能列表
   - 数字、最近 7 天、游戏档案、领奖台搬进二级页「记忆」，再加日历 / 足迹两扇门和「一路走来」时间线
   节点是整块搬家（保留 id），原有的填充逻辑照常工作。v3.js 调 GtMemory(ctx)。
   ═══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
var me=document.getElementById('page-me'); if(!me) return;
var q=function(s, r){ return (r||document).querySelector(s); };
var secOf=function(s){ var x=q(s, me); return x && x.closest('.v3-sec'); };
var unfx=function(el){ if(el){ el.classList.remove('fx'); [].forEach.call(el.querySelectorAll('.fx'), function(x){ x.classList.remove('fx'); }); } return el; };

/* 一路走来：新的在上；rec = 藏品里的那一条，s3 = 点开去哪 */
var LINE=[
  {d:'今天', m:'11.2', t:'第 268 局', s:'星穹铁道 1h 37m，在上限内收工', k:'happy', s3:'s3-today'},
  {d:'10.31', t:'终于出金了', s:'那天贴了「超爽」和「抽卡」', k:'great', rec:['game',0]},
  {d:'10.22', t:'连续打卡开始', s:'到今天 12 天了，离纪录还差 11 天', k:'cheer', s3:'s3-calendar'},
  {d:'10.18', t:'最长的一局', s:'星穹铁道 3h 20m，那晚真的停不下来', k:'focus'},
  {d:'9.14', t:'第一次贴「通关」', s:'后来又贴了 2 次', k:'proud'},
  {d:'8.03', t:'暑假第一次超时', s:'多玩了 40 分钟，第二天就收住了', k:'shock', warn:1},
  {d:'7.20', t:'第 100 局', s:'王者荣耀，三连胜收工', k:'laugh'},
  {d:'6.28', t:'我们认识的那天', s:'第一局是原神，玩了 42 分钟', k:'hug', first:1}
];
var SHOW=5;

/* ── 记忆页骨架 ── */
var pg=document.createElement('div'); pg.className='s3 mm'; pg.id='s3-memory';
pg.innerHTML='<div class="bar3"><button class="ib" data-back aria-label="返回">‹</button><div class="tt">记忆</div><span class="act"></span></div><div class="bd"></div>';
var bd=q('.bd', pg);
var hero=document.createElement('div'); hero.className='v3-card mm-hero';
hero.innerHTML='<i class="sky"></i><img class="ot" src="assets/otter/expr/anim/270/hug.webp" alt=""><div class="tx"><small>从 6.28 到今天</small><b><em data-mm="128">128</em> 天</b><p>你玩过的每一局，我都记得</p></div>';
bd.appendChild(hero);
var nums=unfx(q('.m3-nums', me)); if(nums) bd.appendChild(nums);

var doors=document.createElement('div'); doors.className='mm-doors';
var dots=''; for(var i=0;i<7;i++) dots+='<i class="'+(i===6?'now':i===2?'':'on')+'"></i>';
var heat=''; for(var j=0;j<48;j++){ var v=(j*37+11)%17; heat+='<i class="'+(v>12?'l3':v>8?'l2':v>4?'l1':'')+'"></i>'; }
doors.innerHTML='<button class="v3-card dr cal" data-s3="s3-calendar"><span class="k">打卡日历</span><b>连续 <em>12</em> 天</b><span class="dots">'+dots+'</span></button>'
  +'<button class="v3-card dr ft" data-s3="s3-foot"><span class="k">足迹</span><b>今年 <em>186</em> 天</b><span class="heat">'+heat+'</span></button>';
bd.appendChild(doors);

var week=unfx(secOf('.m3-week')); if(week) bd.appendChild(week);

var line=document.createElement('div'); line.className='v3-sec mm-line'; line.id='mmLine';
line.innerHTML='<div class="v3-hd"><span class="t">一路走来</span><span class="more">时间线</span></div><div class="v3-card"><ol id="mmList"></ol><button class="more-b" id="mmMore">再往前看看</button></div>';
bd.appendChild(line);

var arch=document.getElementById('mnSec');
if(arch){ var f=q('.mn-first', arch); if(f) f.remove(); bd.appendChild(arch); }
var pod=unfx(secOf('#m3Pod')); if(pod) bd.appendChild(pod);
var end=document.createElement('div'); end.className='mm-end'; end.textContent='只存在这台手机 · 不上传';
bd.appendChild(end);
document.body.appendChild(pg);

/* ── 「我」页：最近的精彩 + 记忆入口 ── */
var id=document.getElementById('m3Id');
var hl=document.createElement('div'); hl.className='v3-sec me-hl'; hl.id='meHl';
hl.innerHTML='<div class="v3-hd"><span class="t">最近的精彩</span><span class="more" data-goto="gallery">藏品 ›</span></div><div class="mh-big" id="meHlBig"></div><div class="mh-row" id="meHlRow"></div>';
var ent=document.createElement('div'); ent.className='v3-card me-mem'; ent.id='meMem'; ent.setAttribute('role','button'); ent.setAttribute('aria-label','打开记忆');
ent.innerHTML='<i class="sky"></i><div class="hd"><div class="tx"><small>记忆</small><b>268 局 · 214 小时</b><span>从 6.28 起，第 128 天</span></div><img class="ot" src="assets/otter/expr/anim/270/proud.webp" alt=""></div>'
  +'<div class="spark" id="meSpark"></div>'
  +'<div class="mm-go"><button data-mm-go="s3-calendar">日历</button><button data-mm-go="s3-foot">足迹</button><button data-mm-go="#mmLine">时间线</button><button data-mm-go="#mnSec">游戏档案</button><span class="ar">›</span></div>';
if(id){ id.after(hl); hl.after(ent); }
/* 打卡日历已经在记忆页里了，列表里不再重复 */
var calRow=q('.m3-row[data-s3="s3-calendar"]', me); if(calRow) calRow.remove();
var foot=q('.m3-foot div', me); if(foot) foot.textContent='最近的都在这儿，更早的都在「记忆」里';

window.GtMemory=function(ctx){
  var $=ctx.$, $$=ctx.$$, STK=ctx.STK, OT=ctx.OT_EXPR, ITEMS=ctx.ITEMS, tagKey=ctx.tagKey, tip=ctx.tip, vib=ctx.vib, R=ctx.REDUCED,
    openS3=ctx.openS3, openRecord=ctx.openRecord, introMe=ctx.introMe;
  var tagOf=function(it){ return tagKey((it.tags||[])[0]||'happy'); };

  /* 最近的精彩：一张高光大图 + 三张不同的瞬间（游戏 / 生活混排，只取有图的） */
  var big=ITEMS.game.filter(function(it){ return it.feat; })[0];
  var pool=[ITEMS.life[0], ITEMS.game[1], ITEMS.life[3], ITEMS.game[3]].filter(function(it){ return it && it!==big && (it.img||it.cover); }).slice(0,3);
  var src=function(it){ return it.img?'assets/memories/'+it.img+'.webp':'assets/games/'+it.cover+'.webp'; };
  var bigEl=$('#meHlBig');
  if(big && bigEl){ var k=tagOf(big);
    bigEl.innerHTML='<img class="ph" src="'+src(big)+'" alt=""><i class="shade"></i><span class="mh-tag">本周高光</span>'
      +'<img class="ot" src="'+STK(k)+'" alt=""><div class="tx"><b>'+big.t+'</b><span>'+big.d+' · '+(OT[k]?OT[k].n:'')+'</span></div>';
    bigEl.onclick=function(){ vib(6); openRecord(big, bigEl); }; }
  var row=$('#meHlRow');
  if(row) pool.forEach(function(it, i){ var k=tagOf(it), c=document.createElement('button'); c.className='mh-s'; c.style.setProperty('--i', i);
    c.innerHTML='<img class="ph" src="'+src(it)+'" alt=""><i class="shade"></i><img class="ot" src="'+STK(k, false)+'" alt=""><span>'+it.t+'</span>';
    c.onclick=function(){ vib(5); openRecord(it, c); }; row.appendChild(c); });

  /* 入口卡：最近 14 天的小波形（只是示意，权威数字由 page 下发） */
  var sp=$('#meSpark'), M=[60,95,0,40,120,160,25,170,120,240,97,80,130,97], mx=240;
  if(sp) sp.innerHTML=M.map(function(m, i){ return '<i class="'+(i===M.length-1?'now':m>180?'over':'')+'" style="--h:'+(m?Math.max(8, m/mx*100):4)+'%;--i:'+i+'"></i>'; }).join('');
  var mem=$('#meMem');
  var go=function(t){ openS3('s3-memory');
    if(t.charAt(0)==='#') setTimeout(function(){ var el=$(t), s=$('#s3-memory'); if(el && s) s.scrollTo({top:el.offsetTop-64, behavior:R?'auto':'smooth'}); }, 380);
    else setTimeout(function(){ openS3(t); }, 260); };
  if(mem) mem.addEventListener('click', function(e){ e.stopPropagation(); var b=e.target.closest('[data-mm-go]'); vib(6);
    if(b) go(b.dataset.mmGo); else openS3('s3-memory'); });

  /* 时间线 */
  var list=$('#mmList'), more=$('#mmMore');
  var paint=function(all){ list.innerHTML=LINE.map(function(n, i){ if(!all && i>=SHOW) return '';
    return '<li class="'+(n.warn?'warn ':'')+(n.first?'first ':'')+(n.s3||n.rec?'tap':'')+'" data-i="'+i+'" style="--i:'+i+';--c:'+(OT[n.k]?OT[n.k].c:'155,123,240')+'">'
      +'<span class="dt">'+n.d+(n.m?'<small>'+n.m+'</small>':'')+'</span><i class="pt"></i>'
      +'<div class="tx"><b>'+n.t+'</b><span>'+n.s+'</span></div><img class="ot" src="'+STK(n.k, false)+'" alt=""></li>'; }).join('');
    more.hidden=all || LINE.length<=SHOW; };
  paint(false);
  more.onclick=function(){ vib(5); paint(true); list.classList.remove('in'); void list.offsetWidth; list.classList.add('in'); };
  list.addEventListener('click', function(e){ var li=e.target.closest('li'); if(!li) return; var n=LINE[+li.dataset.i]; vib(5);
    if(n.rec) openRecord(ITEMS[n.rec[0]][n.rec[1]], li);
    else if(n.s3) openS3(n.s3);
    else tip(li.querySelector('.ot'), OT[n.k]?OT[n.k].say:'记着呢', {mood:n.k, ms:1800}); });

  /* 进记忆页：数字滚、柱子长、时间线一条条亮起 */
  var count=function(){ $$('#s3-memory [data-mm]').forEach(function(el){ var to=+el.dataset.mm; if(R){ el.textContent=to; return; } var t0=performance.now();
    (function f(now){ var p=Math.min(1,(now-t0)/900), e=1-Math.pow(1-p,3); el.textContent=Math.round(to*e); if(p<1) requestAnimationFrame(f); })(t0); }); };
  ctx.S3_HOOKS['s3-memory']=function(){ paint(false); list.classList.remove('in');
    setTimeout(function(){ if(introMe) introMe(); count(); if(window.mnReplay) mnReplay(); list.classList.add('in'); }, 160); };

  /* 进「我」：精彩卡依次浮起，入口卡波形长出来 */
  window.meReplay=function(){ if(R) return; [hl, ent].forEach(function(el){ el.classList.remove('in'); void el.offsetWidth; el.classList.add('in'); }); };
  if(R){ hl.classList.add('in'); ent.classList.add('in'); }
};
})();
