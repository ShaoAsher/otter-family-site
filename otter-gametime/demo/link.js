/* ═══ 关联对局：游戏藏品必须挂在一局计时记录上 ═════════════════════
   数据 = 计时记录（开战 → 收工产生的每一局）；这里是演示数据，真实数据来自 timeline / periods。
   选择弹层：游戏筛选 + 按天分组 + 已记过标记；单选，确认才生效。
   本文件在 v3.js 之前加载：弹层 HTML 先插进页面，让 v3.js 统一挂上下拉关闭；交互由 GtLink(ctx) 接上。 */
(function(){
'use strict';

/* 一局：id · 游戏 · 哪天 · 开始 · 结束 · 分钟 · 已记过几条 */
var GT_SESS=[
  {id:'s1', g:'wzry', day:'今天', s:'20:12', e:'21:04', m:52, rec:0},
  {id:'s2', g:'ys',   day:'今天', s:'13:30', e:'14:15', m:45, rec:0},
  {id:'s3', g:'hsr',  day:'昨天', s:'22:10', e:'23:05', m:55, rec:1},
  {id:'s4', g:'hsr',  day:'昨天', s:'19:40', e:'20:30', m:50, rec:0},
  {id:'s5', g:'zzz',  day:'昨天', s:'12:05', e:'12:40', m:35, rec:0},
  {id:'s6', g:'ys',   day:'11.1 周日', s:'21:04', e:'21:52', m:48, rec:1},
  {id:'s7', g:'wzry', day:'11.1 周日', s:'14:20', e:'15:02', m:42, rec:0},
  {id:'s8', g:'mrfz', day:'10.31 周六', s:'20:00', e:'21:10', m:70, rec:0},
  {id:'s9', g:'hsr',  day:'10.31 周六', s:'15:30', e:'16:20', m:50, rec:2}
];
window.GT_SESS=GT_SESS;

function game(f){ return (window.GAMES||[]).filter(function(x){ return x.f===f; })[0] || {f:f, n:f, c:'61,220,255'}; }
function durOf(m){ return m>=60?Math.floor(m/60)+' 小时'+(m%60?' '+(m%60)+' 分':''):m+' 分钟'; }
/* 发布页那张关联卡上的两行字 */
window.gtSessLabel=function(x){
  if(!x) return null;
  return {t:game(x.g).n+' · '+(x.fresh?'刚刚那局':x.day), s:(x.fresh?'刚收工 · ':x.s+' – '+x.e+' · ')+durOf(x.m), c:game(x.g).c};
};
window.gtSessById=function(id){ return GT_SESS.filter(function(x){ return x.id===id; })[0]||null; };
/* 普通入口的默认：最近一局还没记过的；都记过就取最近一局 */
window.gtSessGuess=function(){ return GT_SESS.filter(function(x){ return !x.rec; })[0] || GT_SESS[0] || null; };
/* 收工「记一条这局」：把刚结束的这局放到最前面并返回它 */
window.gtSessFresh=function(f, m){
  GT_SESS.forEach(function(x){ x.fresh=false; });
  var x={id:'now'+Date.now(), g:f, day:'今天', s:'刚刚', e:'', m:Math.max(1, m|0), rec:0, fresh:true};
  GT_SESS.unshift(x); return x;
};
window.gtSessMark=function(id){ var x=window.gtSessById(id); if(x) x.rec++; };

var sh=document.createElement('div'); sh.className='sh3'; sh.id='sh3-link';
sh.innerHTML='<div class="sh-back" data-shclose></div><div class="sh-panel lk-sh"><div class="sh-grab"></div>'
  +'<div class="sh-hd"><b>关联这一局</b><span class="r" data-shclose>取消</span></div>'
  +'<p class="lk-why"><img src="assets/otter/expr/still/270/think.webp" alt="">挂在哪一局上，时长和复盘才算得清</p>'
  +'<div class="sh-cats lk-cats" id="lkCats" data-tabs></div><div class="lk-list" id="lkList"></div>'
  +'<div class="sh-ok"><button class="slab" id="lkOk" disabled>就这一局</button></div></div>';
document.body.appendChild(sh);

window.GtLink=function(ctx){
  var $=ctx.$, $$=ctx.$$, vib=ctx.vib, openSheet=ctx.openSheet, closeSheet=ctx.closeSheet, sparkle=ctx.sparkle, centerOf=ctx.centerOf, REDUCED=ctx.REDUCED;
  var st={sel:null, cur:null, g:'all', cb:null};

  var paintCats=function(){
    var gs=[]; GT_SESS.forEach(function(x){ if(gs.indexOf(x.g)<0) gs.push(x.g); });
    $('#lkCats').innerHTML='<span class="chip'+(st.g==='all'?' on':'')+'" data-g="all">全部</span>'
      +gs.map(function(f){ var g=game(f); return '<span class="chip lk-gc'+(st.g===f?' on':'')+'" data-g="'+f+'" data-c="'+g.c+'"><img src="assets/games/'+f+'.webp" alt="">'+g.n.split('：')[0]+'</span>'; }).join('');
  };
  var paintList=function(anim){
    var rows=GT_SESS.filter(function(x){ return st.g==='all' || x.g===st.g; }), html='', day='';
    rows.forEach(function(x, i){ var g=game(x.g), on=x.id===st.sel;
      if(x.day!==day){ day=x.day; html+='<div class="lk-day">'+day+'</div>'; }
      html+='<button class="lk-row'+(on?' on':'')+(x.fresh?' fresh':'')+'" data-id="'+x.id+'" style="--b:'+g.c+';--i:'+Math.min(i,10)+'">'
        +'<img class="gi" src="assets/games/'+x.g+'.webp" alt=""><span class="tx"><b>'+g.n+'</b><small>'
        +(x.fresh?'刚刚收工':x.s+' – '+x.e)+' · '+durOf(x.m)+'</small></span>'
        +(x.id===st.cur?'<em class="cur">当前</em>':(x.rec?'<em>已记 '+x.rec+' 条</em>':''))
        +'<i class="rd"></i></button>'; });
    if(!rows.length) html=GtEmpty.html('link');
    var L=$('#lkList'); L.innerHTML=html; L.classList.toggle('in', !!anim && !REDUCED);
    $('#lkOk').disabled=!st.sel;
    $('#lkOk').textContent=st.sel&&st.sel===st.cur?'就这一局（不变）':'就这一局';
  };

  $('#lkCats').addEventListener('click', function(e){ var c=e.target.closest('.chip'); if(!c || c.dataset.g===st.g) return;
    st.g=c.dataset.g; $$('.chip', $('#lkCats')).forEach(function(x){ x.classList.toggle('on', x===c); }); paintList(true); vib(5); });
  $('#lkList').addEventListener('click', function(e){ var r=e.target.closest('.lk-row'); if(!r) return;
    st.sel=r.dataset.id; $$('.lk-row', $('#lkList')).forEach(function(x){ x.classList.toggle('on', x===r); });
    $('#lkOk').disabled=false; $('#lkOk').textContent=st.sel===st.cur?'就这一局（不变）':'就这一局'; vib(6);
    if(!REDUCED){ var p=centerOf(r.querySelector('.rd')); sparkle(p[0], p[1], {c:r.style.getPropertyValue('--b'), n:6, r:34}); } });
  $('#lkOk').onclick=function(){ var x=window.gtSessById(st.sel); if(!x) return; closeSheet($('#sh3-link')); vib([6,24,10]);
    if(st.cb) setTimeout(function(){ st.cb(x); }, 160); };

  /* 打开选择：o.sel 当前已关联的那局 id；o.cb(session) 确认后回调 */
  window.gtLinkPick=function(o){
    st.cur=o.sel||null; st.sel=o.sel||null; st.cb=o.cb; st.g='all';
    paintCats(); paintList(false); openSheet('sh3-link');
    var on=$('#lkList .lk-row.on'); if(on) setTimeout(function(){ on.scrollIntoView({block:'center', behavior:REDUCED?'auto':'smooth'}); }, 260);
  };
};
})();
