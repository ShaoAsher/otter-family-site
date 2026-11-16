/* ═══════════════════════════════════════════════════════════════════
   液态玻璃的"活"（只在亮色里看得见，暗色不受影响）
   · 天空：环境层里四团色光，颜色由 glass.css 按页面 / 状态决定
   · 光源：指针 / 手机倾斜 → 所有玻璃的镜面反光一起挪（--lx/--ly）
   · 液滴：切 Tab 时先拉长甩过去，再回弹
   · 果冻按压：按下压扁，松手弹回
   ═══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
var REDUCED=matchMedia('(prefers-reduced-motion: reduce)').matches;
var body=document.body, light=function(){ return body.classList.contains('light'); };

/* ── 天空 ── */
var env=document.getElementById('env');
if(env){ var sky=document.createElement('div'); sky.className='sky'; sky.innerHTML='<i></i><i></i><i></i><i></i>'; env.appendChild(sky); }

/* ── 光源：指针 / 陀螺仪 ── */
var lx=22, ly=0, raf=0;
function aim(x, y){
  lx=x; ly=y; if(raf) return;
  raf=requestAnimationFrame(function(){ raf=0; body.style.setProperty('--lx', lx.toFixed(1)+'%'); body.style.setProperty('--ly', ly.toFixed(1)+'%'); });
}
addEventListener('pointermove', function(e){
  if(REDUCED || !light()) return;
  aim(e.clientX/innerWidth*100, Math.max(-20, e.clientY/innerHeight*60-20));
}, {passive:true});
addEventListener('deviceorientation', function(e){
  if(REDUCED || !light() || e.gamma==null) return;
  aim(50+Math.max(-45, Math.min(45, e.gamma))*1.1, Math.max(-20, Math.min(40, (e.beta-40)*.8)));
});

/* ── 底导液滴 ── */
var nav=document.getElementById('nav'), drop=null, dropX=null, anim=null;
if(nav){ drop=document.createElement('i'); drop.className='nv-drop'; nav.insertBefore(drop, nav.firstChild); }
function place(go){
  if(!drop) return;
  var b=nav.querySelector('button.on'); if(!b){ drop.style.opacity='0'; return; }
  nav.classList.add('nv-measure');
  var r=b.getBoundingClientRect(), p=nav.getBoundingClientRect();
  nav.classList.remove('nv-measure'); if(!r.width) return;
  var w=r.width, x=r.left-p.left;
  drop.style.width=w+'px';
  var to='translateX('+x+'px)';
  if(anim){ anim.cancel(); anim=null; }
  if(dropX===null || !go || REDUCED || !light()){ drop.style.transform=to; drop.style.opacity='1'; dropX=x; return; }
  var dir=x>dropX?1:-1, dist=Math.abs(x-dropX), from=dropX; dropX=x;
  var sx=1+Math.min(.6, dist/220);
  drop.style.transformOrigin=dir>0?'0% 50%':'100% 50%';
  anim=drop.animate([
    {transform:'translateX('+from+'px) scale(1,1)'},
    {transform:'translateX('+(from+dir*dist*.45)+'px) scale('+sx+',.84)', offset:.3, easing:'cubic-bezier(.55,0,1,.45)'},
    {transform:'translateX('+(x+dir*6)+'px) scale(.96,1.06)', offset:.62},
    {transform:'translateX('+(x-dir*2)+'px) scale(1.02,.98)', offset:.82},
    {transform:to+' scale(1,1)'}
  ], {duration:620, easing:'cubic-bezier(.22,1,.36,1)'});
  drop.style.transform=to; drop.style.opacity='1';
}
if(nav){
  addEventListener('resize', function(){ place(false); });
  setTimeout(function(){ place(false); }, 300);
  new MutationObserver(function(ms){
    var page=ms.some(function(m){ return m.attributeName==='data-page'; });
    requestAnimationFrame(function(){ place(page); });
  }).observe(body, {attributes:true, attributeFilter:['class', 'data-page']});
}

/* ── 果冻按压 ── */
var JELLY='nav button, .ib, .chip, .slab, .h3-streak, .th3';
document.addEventListener('pointerdown', function(e){
  if(REDUCED || !light()) return; var el=e.target.closest(JELLY); if(!el) return;
  el.animate([{transform:'scale(1,1)'},{transform:'scale(1.05,.92)', offset:.25},{transform:'scale(.98,1.03)', offset:.6},{transform:'scale(1,1)'}],
    {duration:520, easing:'cubic-bezier(.22,1,.36,1)'});
}, true);

window.GtGlass={ place:place };
})();
