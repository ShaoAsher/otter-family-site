/* ═══════════════════════════════════════════════════════════════════
   滚动联动（2026-11 新增，原型先行）—— 头部、顶栏、底导跟着手指走，不是到点切换
   - 按 iOS 大标题导航栏：大标题跟内容走、滚到栏下渐隐；栏里同一个标题（17pt 居中）接上
   - 顶栏 = 安全区 + 44pt；标题、右侧控件都复用本页原头部（同字、同强调色、同控件缩到栏内尺寸，热区 44pt）
   - 背景材质随滚动出现，大标题完全进栏后才出底边细线
   - 底导：往下滚最小化为只剩图标的窄胶囊（同 iOS 26 tab bar minimize），往回滚展开；滚深了点当前 Tab = 回顶
   - 顶部下拉：橡皮筋，拉够了小獭从标题后探头说一句
   - 此刻：水池里的水跟着滚动速度晃
   全部只改 transform / opacity 的独立属性（translate / scale / rotate），不和各页自带的进场动画抢 transform。
   ═══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
var $=function(s,r){ return (r||document).querySelector(s); };
var R=matchMedia('(prefers-reduced-motion: reduce)').matches;
var vib=function(n){ if(navigator.vibrate) navigator.vibrate(n); };
var body=document.body, tb=$('#topbar'), nav=$('#nav');
if(!tb || !nav) return;
body.classList.add('sx');

/* 桌面走查没有安全区：?sat=47 模拟刘海机的状态栏高度 */
var sat=new URLSearchParams(location.search).get('sat'); if(sat) document.documentElement.style.setProperty('--sat-min', (+sat||0)+'px');

var RANGE=60;           /* 本页大标题底边滚到栏底边所需距离，换页时重量 */
var clamp=function(v,a,b){ return Math.max(a, Math.min(b, v)); };
var page=function(){ return body.dataset.page||'home'; };

/* ── 顶栏：标题、右侧控件都从本页原头部复制 ── */
var bar=document.createElement('div'); bar.className='sx-bar';
bar.innerHTML='<span></span><b class="sx-tt"></b><div class="sx-acts"></div>'; tb.appendChild(bar);
var tt=$('.sx-tt', bar), acts=$('.sx-acts', bar);
function head(){ return $('.page.on .v3-head'); }
function paintBar(){
  var h=head(); tt.innerHTML=''; acts.innerHTML='';
  if(!h){ RANGE=60; return; }
  var t=$('.v3-title', h), eb=$('.eyebrow', h), tint='';
  if(t){ tt.innerHTML='<span class="t">'+t.innerHTML+'</span>'; var em=$('em', t), e2=$('em', tt); if(em){ tint=getComputedStyle(em).color; if(e2) e2.style.color=tint; } }
  if(eb) tt.insertAdjacentHTML('beforeend', '<small>'+eb.textContent+'</small>');
  var rc=getComputedStyle(h.closest('.page')).getPropertyValue('--rc').trim();
  tb.style.setProperty('--bt', page()==='me' ? 'var(--alt)' : page()==='gallery' && rc ? 'rgb('+rc+')' : tint || 'var(--accent)');
  [].forEach.call(h.children, function(c){ if(c.classList.contains('ttl')) return;
    var k=c.cloneNode(true); k.removeAttribute('id'); [].forEach.call(k.querySelectorAll('[id]'), function(n){ n.removeAttribute('id'); });
    k.classList.add('sx-clone'); acts.appendChild(k); });
  var r=(t||h).getBoundingClientRect();
  RANGE=Math.max(40, r.bottom+scrollY-tb.offsetHeight);
}

/* ── 每帧：读滚动 → 写 CSS 变量 ── */
var lastY=scrollY, lastT=performance.now(), vel=0, compact=false, ticking=false, dirAcc=0;
function frame(){
  ticking=false;
  var y=Math.max(0, scrollY), now=performance.now(), dt=Math.max(1, now-lastT);
  var dy=y-lastY; vel=vel*.7+(dy/dt)*.3; lastY=y; lastT=now;
  var p=clamp(y/RANGE, 0, 1);
  body.style.setProperty('--hp', p.toFixed(3));
  var on=p>.6;
  if(on!==tb.classList.contains('on')){ if(on) paintBar(); tb.classList.toggle('on', on); tb.inert=!on; }

  /* 底导：同一方向累计 24px 才换状态，避免手指抖动来回闪 */
  dirAcc = (dy>0) === (dirAcc>0) ? dirAcc+dy : dy;
  if(y<RANGE){ setNav(false); }
  else if(dirAcc>24){ setNav(true); }
  else if(dirAcc<-24){ setNav(false); }

  /* 水池：速度 → 倾斜，弹回由 CSS transition 负责 */
  if(page()==='home' && !R){ var pond=$('#h3Pond .water'); if(pond) pond.style.setProperty('--tilt', clamp(vel*3.2, -7, 7).toFixed(2)+'deg'); clearTimeout(frame._t);
    frame._t=setTimeout(function(){ if(pond) pond.style.setProperty('--tilt','0deg'); }, 120); }
}
function setNav(c){ if(c!==compact){ compact=c; nav.classList.toggle('sx-compact', c); } }
addEventListener('scroll', function(){ if(!ticking){ ticking=true; requestAnimationFrame(frame); } }, {passive:true});

/* 换页：状态归零，紧凑件换成新页的 */
var lastPage=page();
new MutationObserver(function(){ if(page()===lastPage) return; lastPage=page(); setNav(false); dirAcc=0;
  body.style.setProperty('--hp', 0); tb.classList.remove('on'); tb.inert=true; requestAnimationFrame(paintBar); }).observe(body, {attributes:true, attributeFilter:['data-page']});
tb.inert=true; paintBar(); addEventListener('load', paintBar); addEventListener('resize', paintBar);
var realm=$('#g3Realm'); if(realm) realm.addEventListener('click', function(){ setTimeout(paintBar, 500); });

/* 滚深了，点当前 Tab = 回到顶部（底导先弹一下） */
nav.addEventListener('click', function(e){
  var b=e.target.closest('button'); if(!b || b.dataset.page!==page() || scrollY<innerHeight*.6) return;
  vib(8); scrollTo({top:0, behavior:R?'auto':'smooth'});
  if(!R) b.animate([{translate:'0 0'},{translate:'0 -6px'},{translate:'0 0'}], {duration:420, easing:'cubic-bezier(.34,1.45,.64,1)'});
});
/* 紧凑态下点底导任意处 = 先展开 */
nav.addEventListener('pointerdown', function(e){ if(compact && !e.target.closest('button.on')){ setNav(false); dirAcc=0; } }, true);

/* ── 顶部下拉：橡皮筋 + 小獭探头 ── */
var peek=document.createElement('div'); peek.className='sx-peek'; peek.innerHTML='<img src="assets/otter/expr/anim/270/hi.webp" alt=""><span></span>'; document.body.appendChild(peek);
var PULL={home:['今天也来啦～','水池我刚换过水','想玩哪款？'], gallery:['这些都是你的宝贝','往下翻翻，都在呢'], me:['你玩过的每一局我都记得','嘿，是我！']};
var FACE={home:'hi', gallery:'love', me:'proud'};
var t0=null, pull=0, fired=false;
addEventListener('touchstart', function(e){ if(scrollY<=0 && !$('.s3.on, .sh3.on') && page()!=='timer'){ t0=e.touches[0].clientY; pull=0; fired=false; } }, {passive:true});
addEventListener('touchmove', function(e){ if(t0===null) return; var d=e.touches[0].clientY-t0; if(d<=0 || scrollY>0){ pull=0; apply(); return; }
  pull=Math.pow(d, .82); apply();
  if(pull>70 && !fired){ fired=true; vib(10); var s=PULL[page()]||PULL.home; $('span', peek).textContent=s[Math.floor(Math.random()*s.length)];
    $('img', peek).src='assets/otter/expr/anim/270/'+(FACE[page()]||'hi')+'.webp'; } }, {passive:true});
addEventListener('touchend', function(){ if(t0===null) return; t0=null; pull=0; apply(); });
function apply(){ body.style.setProperty('--pull', pull.toFixed(1)+'px'); body.classList.toggle('sx-pulling', pull>0); peek.classList.toggle('on', pull>70); }
/* 桌面走查：在顶部用滚轮往上 = 模拟下拉 */
var wheelT=null;
addEventListener('wheel', function(e){ if(scrollY>0 || e.deltaY>=0 || $('.s3.on, .sh3.on') || page()==='timer') return;
  pull=Math.min(110, pull+(-e.deltaY)*.35); apply();
  if(pull>70 && !fired){ fired=true; vib(10); var s=PULL[page()]||PULL.home; $('span', peek).textContent=s[0]; $('img', peek).src='assets/otter/expr/anim/270/'+(FACE[page()]||'hi')+'.webp'; }
  clearTimeout(wheelT); wheelT=setTimeout(function(){ pull=0; fired=false; apply(); }, 260); }, {passive:true});
})();
