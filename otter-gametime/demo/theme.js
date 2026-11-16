/* ═══════════════════════════════════════════════════════════════════
   主题：日 / 夜 / 自动
   首帧前的判定在 index.html <body> 第一段脚本里（不闪）；这里负责设置页「外观」卡与切换。
   自动 = 跟随系统深浅色，系统切换时实时跟随。切换时从点击处画圆扩散（View Transitions）。
   深链 ?theme=light|dark|auto；选择记在 localStorage gt_theme。
   ═══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
var REDUCED=matchMedia('(prefers-reduced-motion: reduce)').matches;
var mq=matchMedia('(prefers-color-scheme: dark)'), mode='dark';
try{ mode=(location.search.match(/[?&]theme=(light|dark|auto)\b/)||[])[1]||localStorage.getItem('gt_theme')||'dark'; }catch(_){}
var meta=document.querySelector('meta[name="theme-color"]');
var box=document.getElementById('stTheme');
var TH=[['light','日','白天的纸面'],['dark','夜','一池光'],['auto','自动','跟随系统']];

function isLight(){ return document.body.classList.contains('light'); }
function want(){ return mode==='light' || (mode==='auto' && !mq.matches); }
function sync(){
  if(meta) meta.setAttribute('content', isLight()?'#F5F4F8':'#0B0A14');
  if(!box) return;
  box.querySelectorAll('.th3').forEach(function(b){ b.classList.toggle('on', b.dataset.m===mode); b.setAttribute('aria-pressed', b.dataset.m===mode); });
  var sub=box.querySelector('.th-sub');
  if(sub) sub.textContent=mode==='auto'?'跟随系统 · 现在是'+(mq.matches?'深色':'浅色'):mode==='light'?'日间 · 白天的纸面':'夜间 · 一池光';
}
function paint(on, x, y){
  if(on===isLight()){ sync(); return; }
  var apply=function(){ document.body.classList.toggle('light', on); sync(); };
  if(!document.startViewTransition || REDUCED || x==null){ apply(); return; }
  var t=document.startViewTransition(apply);
  t.ready.then(function(){
    var R=Math.hypot(Math.max(x, innerWidth-x), Math.max(y, innerHeight-y));
    document.documentElement.animate({clipPath:['circle(0px at '+x+'px '+y+'px)', 'circle('+R+'px at '+x+'px '+y+'px)']},
      {duration:620, easing:'cubic-bezier(.22,1,.36,1)', pseudoElement:'::view-transition-new(root)'});
  }).catch(function(){});
}
function set(m, x, y){
  mode=m; try{ localStorage.setItem('gt_theme', m); }catch(_){}
  paint(want(), x, y);
}

if(box){
  box.querySelector('.th-opts').innerHTML=TH.map(function(t){
    return '<button class="th3" data-m="'+t[0]+'" aria-pressed="false"><i class="th-pv '+t[0]+'"><em></em><em></em><em></em><u></u></i><b>'+t[1]+'</b><small>'+t[2]+'</small></button>';
  }).join('');
  box.addEventListener('click', function(e){
    var b=e.target.closest('.th3'); if(!b || b.dataset.m===mode) return;
    set(b.dataset.m, e.clientX, e.clientY);
  });
}
mq.addEventListener && mq.addEventListener('change', function(){ if(mode==='auto') paint(want()); else sync(); });
sync();

window.GtTheme={ mode:function(){ return mode; }, set:set };

/* 预览深链：?p=timer|gallery|me 直达 Tab，?s3=s3-settings 直达二级页（走查两种主题用） */
var qp=(location.search.match(/[?&]p=(home|timer|gallery|me)\b/)||[])[1], qs=(location.search.match(/[?&]s3=(s3-[\w-]+)/)||[])[1];
if(qp || qs) setTimeout(function(){
  if(qp && window.enter) window.enter(qp);
  if(qs && window.openS3) window.openS3(qs);
}, 2600);
})();
