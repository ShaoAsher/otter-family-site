/* ═══ 分享卡：版式 × 主题 ══════════════════════════════════════════
   版式跟内容走（单图 / 多图 / 视频 / 纯文字各有一组），主题跟情绪走（按主标签推荐一套）。
   两者独立：任何版式都能套任何主题。卡片只由 scRender() 按 SC 状态整体重绘。
   v3.js 是闭包，这里导出 GtShare(ctx)，由 v3.js 把工具函数传进来调用；所以本文件要在 v3.js 之前加载。 */
window.GtShare=function(ctx){
'use strict';
var $=ctx.$, $$=ctx.$$, OT_EXPR=ctx['OT_EXPR'], EXPR_KEYS=ctx['EXPR_KEYS'], tagsOf=ctx['tagsOf'], mainTag=ctx['mainTag'], tagName=ctx['tagName'], tagKey=ctx['tagKey'], STK=ctx['STK'], recMedia=ctx['recMedia'], mediaOf=ctx['mediaOf'], fmtT=ctx['fmtT'], brandize=ctx['brandize'], typeInto=ctx['typeInto'], ALL=ctx['ALL'], ITEMS=ctx['ITEMS'], S3_HOOKS=ctx['S3_HOOKS'], safe=ctx['safe'], REDUCED=ctx['REDUCED'], vib=ctx['vib'], toast=ctx['toast'], confetti=ctx['confetti'], centerOf=ctx['centerOf'], openS3=ctx['openS3'];


/* 主题：按「情绪价值 × 生命力」分九套；moods 里的主标签会把它顶到推荐位 */
var SC_THEMES=[
  {k:'pop',   n:'元气',  vibe:'高能', c:'255,200,60',  moods:['great','cheer','laugh','gacha','hi','happy','proud']},
  {k:'hud',   n:'战报',  vibe:'燃',   c:'61,220,255',  moods:['rank','clear','highlight','retry','coop','focus','grind','queue']},
  {k:'dawn',  n:'晨光',  vibe:'温柔', c:'255,170,150', moods:['love','shy','hug','morning','please','smile','thanks']},
  {k:'paper', n:'拍立得', vibe:'日常', c:'255,220,170', moods:['stroll','solo','cafe','milktea','friends','cook','eat','dessert','ok']},
  {k:'diary', n:'手账',  vibe:'认真', c:'160,210,140', moods:['study','write','plan','note','sport','relax','bath']},
  {k:'film',  n:'胶片',  vibe:'回忆', c:'230,200,140', moods:['movie','music','travel','photo','city','story','relief']},
  {k:'night', n:'夜色',  vibe:'安静', c:'150,140,255', moods:['calm','sleepy','night','goodnight','think','nap','sleep']},
  {k:'rain',  n:'雨天',  vibe:'治愈', c:'120,160,220', moods:['cry','scared','speechless','rot','gg','angry','shock','rain','sad']},
  {k:'brand', n:'游戏色', vibe:'专属', c:'124,140,255', moods:[], game:true}
];

/* 版式：按内容分组；第一项是该类内容的默认版式 */
var SC_LAYOUTS={
  photo:[['poster','海报'],['frame','相框'],['mag','杂志']],
  multi:[['grid','拼贴'],['stack','叠放'],['strip','胶片条'],['poster','海报']],
  video:[['poster','海报'],['frame','相框'],['strip','胶片条']],
  text:[['quote','金句'],['memo','便签'],['letter','信笺'],['diary','日记'],['chat','对话']]
};

var SC_Q=['「第三次站上十二层，这次很稳。」','「一抽入魂，今晚的星星都是金色的。」','「有些时刻不用赢，记得就好。」'], scK=0;
var SC_MQ={great:'「一抽入魂，今晚的星星都是金色的。」', cheer:'「第三次站上十二层，这次很稳。」', grr:'「先记下，明天打回来。」',
  happy:'「今天的快乐，存一份在这里。」', calm:'「慢慢来，也是一种好。」', love:'「这一刻，值得被记住。」', shock:'「等等，这剧情我没想到。」',
  cry:'「破防了，但还是很喜欢。」', sleepy:'「玩够了，晚安。」', gg:'「寄了，但我还会回来。」', walk:'「风很舒服，路也刚好。」'};
var SC_WEEK=['周日','周一','周二','周三','周四','周五','周六'];
/* cap：用户改过的文案；null = 用默认（图片类取一句金句，纯文字取主标签小獭的话） */
var SC={it:null, kind:'photo', layout:'poster', theme:'pop', rec:'pop', media:[], cap:null};
var SC_CAP_MAX=40;

function scEsc(s){ return String(s||'').replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function scDate(it){
  var m=/(\d{1,2})\.(\d{1,2})/.exec(it.d||''), now=new Date(2026, 10, 1);
  var mo=m?+m[1]:now.getMonth()+1, d=m?+m[2]:now.getDate();
  return {m:mo, d:d, w:SC_WEEK[new Date(2026, mo-1, d).getDay()], s:mo+'.'+d};
}
function scKind(it, media){
  if(it.note && !it.img && !it.cover) return 'text';
  if(media[0] && media[0].kind==='video') return 'video';
  return media.length>1?'multi':'photo';
}
function scRecTheme(it){
  var mt=mainTag(it);
  for(var i=0;i<SC_THEMES.length;i++) if(SC_THEMES[i].moods.indexOf(mt)>=0) return SC_THEMES[i].k;
  return it.g?'hud':'paper';
}

/* 一格媒体：视频用封面 + 播放钮 + 时长，实况加角标 */
function scCell(m, cls){
  var src=m.kind==='video'?(m.poster||m.src):m.src, mark='';
  if(m.kind==='video') mark='<i class="sc-play"><svg viewBox="0 0 24 24"><path d="M9 7.2v9.6l7.6-4.8z"/></svg></i><b class="sc-dur">'+(m.dur?fmtT(m.dur):(SC.it.video||'0:24'))+'</b>';
  else if(m.kind==='live') mark='<b class="sc-live">实况</b>';
  return '<div class="sc-m '+(cls||'')+'"><img src="'+src+'" alt="">'+mark+'</div>';
}
function scCount(M){
  var v=M.filter(function(m){ return m.kind==='video'; }).length, p=M.length-v;
  return [p?p+' 张':'', v?v+' 段视频':''].filter(Boolean).join(' · ');
}
function scDefCap(){
  var mt=mainTag(SC.it), mo=OT_EXPR[mt];
  if(SC.kind==='text') return mo?mo.say:'这一刻被好好收起来了';
  return (SC_MQ[mt]||SC_Q[scK]).replace(/^「|」$/g, '');
}
function scCapText(){ return SC.cap!=null?SC.cap:scDefCap(); }
/* 卡上 #scQ 的内容：图片类加书名号当金句，纯文字类原样（它本身就是小獭的话） */
function scCapHtml(){ var s=scEsc(scCapText()); return !s?'':(SC.kind==='text'?s:'「'+s+'」'); }
/* 金句 / 信笺默认不放文案，用户写了才出现 */
function scCapHidden(){ return (SC.layout==='quote' || SC.layout==='letter') && !SC.cap; }

function scTags(tgs){ return tgs.length?'<div class="sc-tags">'+tgs.map(function(t){ var x=OT_EXPR[tagKey(t)]; return x?'<span style="--c:'+x.c+'"><img src="'+STK(tagKey(t), false)+'" alt="">'+scEsc(tagName(t))+'</span>':''; }).join('')+'</div>':''; }

function scRender(){
  var it=SC.it, card=$('#sc3'); if(!it || !card) return;
  var tgs=tagsOf(it), mt=mainTag(it), mo=OT_EXPR[mt], dt=scDate(it), g=it.g?ALL.filter(function(x){ return x[0]===it.g; })[0]:null;
  var title=scEsc(it.t||(it.note||'').split(/[，。]/)[0]), note=scEsc(it.note||'');
  var q=scCapHtml(), qHid='<div class="sc-q'+(scCapHidden()?' hide':'')+'" id="scQ">'+(scCapHidden()?'':q)+'</div>';
  var src=g?'<img class="gi" src="assets/games/'+g[0]+'.webp" alt=""><span>'+g[1]+'</span>':'<span>生活</span>';
  var face=mo?'<img class="sc-face" src="'+STK(mt)+'" alt="">':'';
  var foot='<div class="sc-ft"><i class="sc-lg"></i><span>水獭游时 · 旅人 · '+dt.s+'</span>'+(mo?'<em style="--c:'+mo.c+'">'+scEsc(tagName(tgs[0]))+'</em>':'')+'</div>';
  var M=SC.media, L=SC.layout, h='';

  if(L==='poster'){
    h=scCell(M[0], 'hero')+'<div class="sc-over">'+face+'<div class="sc-src">'+src+'</div><div class="sc-t">'+title+'</div>'
      +'<div class="sc-q" id="scQ">'+q+'</div></div>'+(M.length>1?'<div class="sc-thumbs">'+M.slice(1,4).map(function(m){ return scCell(m); }).join('')+'</div>':'')+foot;
  } else if(L==='frame'){
    h='<div class="sc-pic">'+scCell(M[0], 'hero')+face+'</div><div class="sc-body"><div class="sc-src">'+src+'</div><div class="sc-t">'+title+'</div>'
      +'<div class="sc-q" id="scQ">'+q+'</div>'+scTags(tgs)+foot+'</div>';
  } else if(L==='mag'){
    h='<div class="sc-mast"><b>'+dt.m+'</b><span>'+dt.w+'<br>'+dt.s+'</span><i>ISSUE · '+(g?g[1]:'生活')+'</i></div>'
      +'<div class="sc-t big">'+title+'</div>'+scCell(M[0], 'hero')+'<div class="sc-body"><div class="sc-q" id="scQ">'+q+'</div>'+face+foot+'</div>';
  } else if(L==='grid'){
    var n=Math.min(M.length, 4);
    h='<div class="sc-grid n'+n+'">'+M.slice(0,n).map(function(m, i){ return scCell(m, i===0?'hero':''); }).join('')+'</div>'
      +'<div class="sc-body"><div class="sc-src">'+src+'<small>'+scCount(M.slice(0,n))+'</small></div><div class="sc-t">'+title+'</div><div class="sc-q" id="scQ">'+q+'</div>'+face+foot+'</div>';
  } else if(L==='stack'){
    h='<div class="sc-stack">'+M.slice(0,3).reverse().map(function(m, i, a){ return '<div class="sc-pol" style="--r:'+[-7,5,-1.5][3-a.length+i]+'deg">'+scCell(m)+'</div>'; }).join('')+face+'</div>'
      +'<div class="sc-body"><div class="sc-t">'+title+'</div><div class="sc-q" id="scQ">'+q+'</div>'+scTags(tgs)+foot+'</div>';
  } else if(L==='strip'){
    h='<div class="sc-film"><div class="sc-holes"></div><div class="sc-frames">'+M.slice(0,3).map(function(m){ return scCell(m); }).join('')+'</div><div class="sc-holes"></div></div>'
      +'<div class="sc-body"><div class="sc-src">'+src+'</div><div class="sc-t">'+title+'</div><div class="sc-q" id="scQ">'+q+'</div>'+face+foot+'</div>';
  } else if(L==='quote'){
    h='<div class="sc-txt"><i class="sc-mark">「</i><div class="sc-big">'+note+'</div><div class="sc-by">— 旅人 · '+dt.s+' · '+(g?g[1]:'生活')+'</div>'
      +scTags(tgs)+'</div>'+face+qHid+foot;
  } else if(L==='memo'){
    h='<div class="sc-memo"><i class="sc-tape"></i><div class="sc-hand">'+note+'</div><div class="sc-by">'+dt.s+' '+dt.w+'</div>'+face+'</div>'
      +'<div class="sc-q" id="scQ">'+q+'</div>'+foot;
  } else if(L==='letter'){
    h='<div class="sc-letter"><div class="sc-to">写给 '+dt.m+' 月 '+dt.d+' 日的自己</div><div class="sc-lines">'+note+'</div>'
      +'<div class="sc-sign">旅人<small>'+dt.w+'</small></div>'+face+'</div>'+qHid+foot;
  } else if(L==='diary'){
    h='<div class="sc-day"><b>'+('0'+dt.d).slice(-2)+'</b><span>'+dt.m+' 月<br>'+dt.w+'</span>'+face+'</div>'
      +'<div class="sc-body"><div class="sc-hand">'+note+'</div>'+scTags(tgs)+'<div class="sc-q" id="scQ">'+q+'</div>'+foot+'</div>';
  } else if(L==='chat'){
    h='<div class="sc-chat"><div class="sc-chd">和小獭说 · '+dt.s+'</div><div class="sc-me">'+note+'</div>'
      +'<div class="sc-ot"><img src="'+STK(mt||'happy')+'" alt=""><span id="scQ">'+q+'</span></div>'
      +(tgs.length?'<div class="sc-stk"><small>小獭帮你贴上了</small>'+scTags(tgs)+'</div>':'')+'</div>'+foot;
  }
  card.className='sc3 L-'+L+' T-'+SC.theme;
  card.innerHTML=h;
  if(SC.theme==='brand') brandize(card, $('#rdGi'), '124,140,255');
  scFit();
}

/* 卡片按舞台剩余空间等比缩放（只缩不放），面板收起 / 展开、版式变高都会重算 */
function scFit(){
  var st=$('#scStage'), fit=$('#scFit'), card=$('#sc3'); if(!st || !fit || !card) return;
  var h=card.offsetHeight, w=card.offsetWidth; if(!h || !w) return;
  var s=Math.min(1, (st.clientHeight-24)/h, (st.clientWidth-8)/w);
  fit.style.setProperty('--fit', Math.max(.5, s).toFixed(3));
}

/* 版式按钮 = 版式骨架示意，用当前主题的颜色画；块：[类型, x, y, w, h]（百分比）
   类型 m 图 · t 主字 · s 次字 · a 强调 · p 纸面 · d 暗条 */
var SC_LV={
  poster:[['m',0,0,100,100],['t',10,66,62,6],['s',10,78,40,4]],
  frame:[['m',8,7,84,56],['t',10,70,62,6],['s',10,81,40,4]],
  mag:[['a',8,6,26,12],['t',8,24,74,7],['m',8,37,84,42],['s',8,86,48,4]],
  grid:[['m',0,0,63,56],['m',65,0,35,27],['m',65,29,35,27],['t',9,66,62,6],['s',9,77,40,4]],
  stack:[['p',10,10,54,46],['p',36,6,54,46],['m',28,14,46,40],['t',10,68,62,6],['s',10,79,40,4]],
  strip:[['d',0,8,100,40],['m',5,15,27,26],['m',37,15,27,26],['m',69,15,27,26],['t',9,60,62,6],['s',9,71,40,4]],
  quote:[['a',10,8,14,14],['t',10,30,78,7],['t',10,42,60,7],['s',10,58,36,4]],
  memo:[['p',10,12,80,58],['a',38,8,24,7],['t',18,26,62,5],['t',18,36,48,5]],
  letter:[['a',10,8,44,5],['s',10,22,80,2],['s',10,34,80,2],['s',10,46,80,2],['t',10,17,60,4],['t',56,58,32,5]],
  diary:[['a',10,7,30,22],['s',44,12,22,4],['s',10,34,80,2],['t',10,42,74,6],['t',10,53,52,6]],
  chat:[['a',38,10,54,14],['p',22,32,52,14],['m',6,33,12,12],['s',30,54,50,4]]
};
function scLv(k){
  return '<i class="sc-lv T-'+SC.theme+'">'+(SC_LV[k]||[]).map(function(b){
    return '<span class="lv-'+b[0]+'" style="left:'+b[1]+'%;top:'+b[2]+'%;width:'+b[3]+'%;height:'+b[4]+'%"></span>'; }).join('')+'</i>';
}
/* 主题变了，版式骨架跟着换色 */
function scTint(){
  $$('#scLayouts .sc-lv').forEach(function(i){ i.className='sc-lv T-'+SC.theme; if(SC.theme==='brand') brandize(i, $('#rdGi'), '124,140,255'); });
}

function scBar(){
  var lb=$('#scLayouts'), th=$('#scStyles'); if(!lb || !th) return;
  lb.innerHTML=SC_LAYOUTS[SC.kind].map(function(l){ return '<button class="sc-sw'+(l[0]===SC.layout?' on':'')+'" data-l="'+l[0]+'" style="--c:255,255,255">'+scLv(l[0])+'<b>'+l[1]+'</b></button>'; }).join('');
  scTint();
  th.innerHTML=SC_THEMES.filter(function(t){ return !t.game || SC.it.g; }).map(function(t){
    var pk=t.moods.length?t.moods.join(','):'@game';
    return '<button class="sc-sw'+(t.k===SC.theme?' on':'')+'" data-t="'+t.k+'" data-peek="'+pk+'" data-c="'+t.c+'" style="--c:'+t.c+'">'
      +scPreview(t)+'<b>'+t.n+'</b><small>'+(t.k===SC.rec?'推荐':t.vibe)+'</small></button>'; }).join('');
  var br=$('.sc-pv.T-brand', th); if(br) brandize(br, $('#rdGi'), '124,140,255');
}
/* 主题按钮 = 迷你分享卡：主题自己的底 / 纹理 / 字色 / 强调色 + 代表表情；内容骨架跟随当前藏品类型 */
function scPreview(t){
  var body=SC.kind==='text'
    ? '<span class="pv-q">「</span><span class="pv-l"></span><span class="pv-l"></span><span class="pv-l s"></span>'
    : '<span class="pv-m"></span><span class="pv-l"></span><span class="pv-l s"></span>';
  return '<i class="sc-pv T-'+t.k+'">'+body+'<span class="pv-c"></span><img src="'+STK(t.moods[0]||'cheer', false)+'" alt=""></i>';
}

function scSwap(fn){
  var card=$('#sc3');
  if(REDUCED){ fn(); scRender(); return; }
  card.classList.remove('flip'); void card.offsetWidth; card.classList.add('flip');
  setTimeout(function(){ fn(); scRender(); card.classList.add('flip'); }, 300);
}

S3_HOOKS['s3-share']=function(){
  var it=window.CUR_REC||ITEMS.game[1], card=$('#sc3');
  SC.it=it; SC.media=recMedia(it).map(mediaOf); SC.kind=scKind(it, SC.media);
  SC.layout=SC_LAYOUTS[SC.kind][0][0]; SC.rec=SC.theme=scRecTheme(it); SC.cap=null;
  scBar(); scPane('layout'); scDock(false); scCapSync(); scRender();
  if(!REDUCED) card.animate([{transform:'rotate(-8deg) translateY(40px) scale(.9)',opacity:0},{transform:'rotate(-1.5deg)',opacity:1}],{duration:600,easing:'cubic-bezier(.34,1.45,.64,1)'});
};

/* 底部面板：版式 / 主题 / 文案 三页签，一次只摊开一页 */
function scPane(p){
  var seg=$('#scSeg'); if(!seg) return;
  var bs=$$('button', seg), i=0;
  bs.forEach(function(b, k){ var on=b.dataset.p===p; b.classList.toggle('on', on); if(on) i=k; });
  seg.style.setProperty('--si', i);
  $$('#scDock .sc-pane').forEach(function(x){ x.classList.toggle('on', x.dataset.p===p); });
}
/* 收起只留两个按钮，卡片随之放大 */
function scDock(min){ var d=$('#scDock'); if(d) d.classList.toggle('min', !!min); }
/* 输入框 / 字数 / 「恢复默认」与 SC.cap 对齐 */
function scCapSync(){
  var inp=$('#scCapIn'); if(!inp) return;
  /* 金句 / 信笺默认卡上没有文案，输入框也留空，只给提示 */
  inp.value=SC.cap!=null?SC.cap:(scCapHidden()?'':scDefCap());
  inp.placeholder=scCapHidden()?'写一句，会落在卡片底部':'写一句想对这一刻说的话';
  $('#scCapN').textContent=inp.value.length+'/'+SC_CAP_MAX;
  $('#scCapRe').hidden=SC.cap==null;
}
/* 只改卡上那一句，不整卡重绘（避免小獭入场动画重播） */
function scCapPaint(typed){
  var q=$('#scQ'); if(!q) return;
  var hid=scCapHidden(); q.classList.toggle('hide', hid);
  if(hid){ q.innerHTML=''; }
  else if(typed && !REDUCED){ typeInto(q, (SC.kind==='text'?'':'「')+scCapText()+(SC.kind==='text'?'':'」'), 40); }
  else q.innerHTML=scCapHtml();
  scFit();
}

safe('share', function(){
  var lb=$('#scLayouts'), th=$('#scStyles'), card=$('#sc3'), seg=$('#scSeg'), dock=$('#scDock'), inp=$('#scCapIn'); if(!th) return;
  lb.addEventListener('click', function(e){ var c=e.target.closest('.sc-sw'); if(!c || c.dataset.l===SC.layout) return;
    $$('.sc-sw', lb).forEach(function(x){ x.classList.toggle('on', x===c); });
    scSwap(function(){ SC.layout=c.dataset.l; scCapSync(); }); vib(6); });
  th.addEventListener('click', function(e){ var c=e.target.closest('.sc-sw'); if(!c || c.dataset.t===SC.theme) return;
    $$('.sc-sw', th).forEach(function(x){ x.classList.toggle('on', x===c); });
    scSwap(function(){ SC.theme=c.dataset.t; scTint(); }); vib(6); });
  seg.addEventListener('click', function(e){ var b=e.target.closest('button'); if(!b) return; scDock(false); scPane(b.dataset.p); });
  $('#scMini').onclick=function(){ scDock(false); vib(4); };

  /* 把手：点一下收起 / 展开；往下拖超过 40 收起，往上拖展开 */
  var g=$('#scGrab'), y0=null, dy=0;
  g.addEventListener('pointerdown', function(e){ y0=e.clientY; dy=0; g.setPointerCapture(e.pointerId); });
  g.addEventListener('pointermove', function(e){ if(y0!==null) dy=e.clientY-y0; });
  g.addEventListener('pointerup', function(){ if(y0===null) return; y0=null;
    var min=dock.classList.contains('min'); scDock(Math.abs(dy)<6?!min:dy>40); vib(4); });
  dock.addEventListener('transitionend', function(e){ if(e.target.classList.contains('sc-more')) scFit(); });
  if(window.ResizeObserver){ var ro=new ResizeObserver(function(){ scFit(); }); ro.observe($('#scStage')); ro.observe(card); }

  inp.addEventListener('input', function(){ SC.cap=inp.value; $('#scCapN').textContent=inp.value.length+'/'+SC_CAP_MAX; $('#scCapRe').hidden=false; scCapPaint(false); });
  $('#scCapRe').onclick=function(){ SC.cap=null; scCapSync(); scCapPaint(true); vib(4); };
  /* 换一句：只由点击触发；纯文字取一句小獭的话，图片类轮换金句（接 AI 后走 share-caption，无 Key 退回这里） */
  $('#scSpark').onclick=function(){
    if(SC.kind==='text'){ var ks=EXPR_KEYS().filter(function(k){ return OT_EXPR[k].g==='mood'; }); SC.cap=OT_EXPR[ks[Math.floor(Math.random()*ks.length)]].say; }
    else { scK=(scK+1)%SC_Q.length; SC.cap=SC_Q[scK].replace(/^「|」$/g, ''); }
    scCapSync(); scCapPaint(true); vib(6); };
  $('#scSave').onclick=function(){
    if(!REDUCED) card.animate([{transform:'rotate(-1.5deg)'},{transform:'scale(.6) translateY(260px)',opacity:.2}],{duration:520,easing:'cubic-bezier(.5,0,.75,0)'});
    setTimeout(function(){ toast('已存到相册'); }, 420); };
  $('#scSend').onclick=function(){ var c=centerOf($('#scSend')); confetti(c[0],c[1],14); toast('已打开系统分享'); };
});

/* 控制台演示用：scDemo('game' | 'life', 下标, 版式?, 主题?) */
window.scDemo=function(realm, i, layout, theme){
  window.CUR_REC=ITEMS[realm][i]; openS3('s3-share');
  if(layout || theme){ if(layout) SC.layout=layout; if(theme) SC.theme=theme; scBar(); scRender(); }
  return SC.kind+' · '+SC.layout+' · '+SC.theme;
};
};
