/* ═══════════════════════════════════════════════════════════════════
   水獭家族标在水獭游时里的落地：启动页 · 关于 · 新手引导 · 桌面
   - 图标 = 深底 + 渐变圆盘 + 挖空的水獭剪影；启动页 / 新手引导 / 关于 / 桌面统一用它
   - 大尺寸用「分层 logo」（圆盘、水獭分层，能分开动）；静态位置用合成好的 gt_icon / logo.png
   - 透明剪影 gt_otter_w / gt_otter_k 只给 ≤ 32px 和单色的特定位置
   - 「桌面上的样子」：主屏图标 + 小组件 + 长按快捷操作 + 尺寸检查；点图标从启动页重新进来
   v3.js 调 GtBrand(ctx)。
   ═══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
var q=function(s, r){ return (r||document).querySelector(s); };
/* 圆盘渐变（左下 → 右上），与家族素材库 otter_family/README.md「三端与配色」一致 */
var DISC={gt:['#1FB6FF','#5CF2DE'], tools:['#FA5A1E','#FFB04A'], git:['#E89B0C','#FFD66B']};
var FAMILY_SITE='https://shaoasher.github.io/otter-family-site/?from=gametime#members';
var OSS_BRAND='https://otter.oss-cn-beijing.aliyuncs.com/library/otter-';
/* 三层：圆盘 / 水獭（gt_logo_otter.png）/ 右下手柄徽章（gt_badge.png）；两层画布都是圆盘外接正方形，徽章已在位 */
var logo=function(k){ var g=DISC[k||'gt']||DISC.gt;
  return '<span class="gtl" style="--g1:'+g[0]+';--g2:'+g[1]+'" role="img" aria-label="水獭游时"><i class="dk"></i><i class="ot"></i><img class="bdg" src="assets/brand/gt_badge.png" alt=""></span>'; };
window.GtLogo=logo;

var bm=q('#boot .mark img'); if(bm) bm.outerHTML=logo();
var bn=q('#boot .name'); if(bn){ var f=document.createElement('div'); f.className='fam'; f.textContent='水獭家族'; bn.after(f); }
var al=q('#s3-about .ab-logo img'); if(al) al.outerHTML=logo();

/* 关于：水獭家族 + 桌面入口 */
var desc=q('#s3-about .ab-desc');
if(desc){
  var fam=document.createElement('button'); fam.className='v3-card fam3'; fam.id='abFam'; fam.setAttribute('aria-label','水獭家族 · 看看小獭的其他作品');
  fam.innerHTML='<span class="ics"><i></i></span>'
    +'<span class="tx"><b>水獭家族</b><span>看看小獭的其他作品</span></span>'
    +'<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';
  desc.after(fam);
}
var onb=q('#abOnb');
if(onb){ var dk=document.createElement('div'); dk.className='rw'; dk.setAttribute('data-s3','s3-desk'); dk.setAttribute('role','button');
  dk.innerHTML='<span class="l">看看桌面上的样子<small>主屏图标 · 小组件 · 长按快捷操作</small></span><span class="r">›</span>'; onb.before(dk); }

/* 桌面上的样子 */
var APPS=[['gt','水獭游时'],['tools','水獭工具'],['git','水獭 Git'],['n','相册'],['n','日历'],['n','天气'],['n','音乐'],['n','地图']];
var ICON={gt:'assets/brand/gt_icon.png', tools:OSS_BRAND+'tools/icon.png', git:OSS_BRAND+'git/icon.png'};
var app=function(a, i){ return '<button class="ap'+(a[0]==='gt'?' gt':'')+'" data-k="'+a[0]+'" style="--i:'+i+'">'
  +(ICON[a[0]]?'<img src="'+ICON[a[0]]+'" alt="">':'<i class="nt">'+a[1].charAt(0)+'</i>')+'<span>'+a[1]+'</span></button>'; };
var pg=document.createElement('div'); pg.className='s3 dk'; pg.id='s3-desk';
pg.innerHTML='<div class="bar3"><button class="ib" data-back aria-label="返回">‹</button><div class="tt">桌面上的样子</div><span class="act"></span></div>'
  +'<div class="bd"><div class="dk-phone" id="dkPhone"><img class="wp" src="assets/onboard/bg.webp" alt=""><i class="dim"></i>'
  +'<div class="dk-sb"><b>21:08</b><span><i></i><i></i><i></i></span></div>'
  +'<button class="dk-wg" id="dkWg"><div class="pond"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19"/><circle class="v" cx="22" cy="22" r="19"/></svg><img src="assets/otter/expr/still/270/happy.webp" alt=""></div>'
  +'<div class="tx"><small>今天 · 2 局</small><b>1h 37m</b><span>还能安心玩 1h 23m</span></div><em>水獭游时</em></button>'
  +'<div class="dk-grid">'+APPS.map(app).join('')+'</div>'
  +'<div class="dk-dock">'+[['n','电话'],['n','信息'],['n','浏览器'],['n','相机']].map(app).join('')+'</div>'
  +'<div class="dk-menu" id="dkMenu" role="menu"><button data-a="go"><b>开战 · 星穹铁道</b><small>接着昨天那局</small></button><button data-a="rec"><b>记一条</b><small>收进藏品</small></button><button data-a="today"><b>今天玩了多久</b><small>1h 37m · 还能玩 1h 23m</small></button></div>'
  +'</div><p class="dk-tip">点「水獭游时」从启动页进来 · 长按看快捷操作</p>'
  +'<div class="lb3">尺寸检查</div><div class="v3-card dk-sizes">'
  +'<div><img src="assets/brand/gt_icon.png" style="width:64px" alt=""><span>64</span></div>'
  +'<div><img src="assets/brand/gt_icon.png" style="width:44px" alt=""><span>44</span></div>'
  +'<div class="mono"><img src="assets/brand/gt_otter_w.png" style="width:36px" alt=""><span>剪影 · 白</span></div>'
  +'<div class="mono lt"><img src="assets/brand/gt_otter_k.png" style="width:36px" alt=""><span>剪影 · 黑</span></div>'
  +'<div><img src="assets/brand/gt_otter_w.png" style="width:24px" alt=""><span>24</span></div>'
  +'<div><img src="assets/brand/gt_otter_w.png" style="width:16px" alt=""><span>16</span></div></div>'
  +'<div class="lb3">家族徽章</div><div class="v3-card dk-bgs">'
  +[['gt','水獭游时 · 手柄'],['tools','水獭工具 · 扳手'],['git','水獭 Git · 分支']].map(function(d){ var src=d[0]==='gt'?'assets/brand/gt_icon.png':OSS_BRAND+d[0]+'/icon.png'; return '<div><img src="'+src+'" alt=""><small>'+d[1]+'</small></div>'; }).join('')+'</div>'
  +'<div class="lb3">规则</div><div class="v3-card dk-rule"><p>图标 = 深底 + 渐变圆盘 + 挖空的蜷睡水獭，产品之间只换圆盘渐变和徽章：水獭游时 手柄 · 水獭工具 扳手 · 水獭 Git 分支。启动页、新手引导、关于、桌面都用同一枚。</p><p>徽章统一放右下角，压在圆盘边缘：白色圆章 + 深色图形，外圈一道底色缝隔开。</p><p>32px 以下只用透明剪影（白 / 黑），不带徽章。渐变只在圆盘上，不上文字；不加投影光。</p><p>游时标在 docs/mockup/assets/brand；兄弟 App 图标走 OSS library/otter-*/。</p></div></div>';
document.body.appendChild(pg);

window.GtBrand=function(ctx){
  var $=ctx.$, vib=ctx.vib, R=ctx.REDUCED, openS3=ctx.openS3, toast=ctx.toast, tip=ctx.tip;

  /* 从桌面点进来：重放启动页 */
  var boot=$('#boot'), st=$('#bootSt');
  var replayBoot=function(){ if(!boot) return; while($('.s3.on')) window.closeTop();
    boot.classList.remove('gone'); [].forEach.call(boot.querySelectorAll('*'), function(el){ el.style.animation='none'; void el.offsetWidth; el.style.animation=''; });
    var steps=['正在启动','读取本地数据','准备就绪'], i=0; st.textContent=steps[0];
    var t=setInterval(function(){ i++; if(i<steps.length) st.textContent=steps[i]; else { clearInterval(t); setTimeout(function(){ boot.classList.add('gone'); window.enter('home'); }, 420); } }, 620); };
  window.replayBoot=replayBoot;

  /* 关于：光圈只在进页和点 logo 时扩散一轮，平时静止，不挡 logo */
  var ab=$('#s3-about .ab-logo');
  var wave=function(){ if(!ab) return; ab.classList.remove('wave'); void ab.offsetWidth; ab.classList.add('wave'); };
  if(ab) ab.addEventListener('click', wave);
  var prevAb=ctx.S3_HOOKS['s3-about'];
  ctx.S3_HOOKS['s3-about']=function(){ if(prevAb) prevAb.apply(this, arguments); wave(); };

  /* 关于里的家族入口：去家族官网，from 让官网标出水獭游时那张卡 */
  var fam=$('#abFam');
  if(fam) fam.addEventListener('click', function(){ vib(5); window.open(FAMILY_SITE, '_blank', 'noopener'); });

  /* 桌面：点图标 = 打开（图标放大铺满再进启动页）；长按 = 快捷操作 */
  var ph=$('#dkPhone'), menu=$('#dkMenu'), gt=ph && ph.querySelector('.ap.gt'), lp=null, longed=false;
  if(!ph) return;
  var closeMenu=function(){ ph.classList.remove('menu'); };
  var launch=function(){ vib(8); var r=gt.querySelector('img').getBoundingClientRect(), pr=ph.getBoundingClientRect();
    var fx=document.createElement('img'); fx.className='dk-launch'; fx.src='assets/brand/gt_icon.png';
    fx.style.cssText='left:'+(r.left-pr.left)+'px;top:'+(r.top-pr.top)+'px;width:'+r.width+'px;height:'+r.height+'px';
    ph.appendChild(fx);
    if(R){ fx.remove(); replayBoot(); return; }
    fx.animate([{transform:'none', borderRadius:'22%'},{transform:'translate('+(pr.width/2-r.left+pr.left-r.width/2)+'px,'+(pr.height/2-r.top+pr.top-r.height/2)+'px) scale('+(pr.height/r.height*1.1)+')', borderRadius:'8%'}],
      {duration:420, easing:'cubic-bezier(.2,0,0,1)', fill:'forwards'}).onfinish=function(){ replayBoot(); setTimeout(function(){ fx.remove(); }, 400); }; };
  gt.addEventListener('pointerdown', function(){ longed=false; clearTimeout(lp); lp=setTimeout(function(){ longed=true; vib(12);
    menu.style.top=(gt.getBoundingClientRect().bottom-ph.getBoundingClientRect().top+8)+'px'; ph.classList.add('menu'); }, 480); });
  ['pointerup','pointerleave','pointercancel'].forEach(function(ev){ gt.addEventListener(ev, function(){ clearTimeout(lp); }); });
  gt.addEventListener('click', function(e){ e.stopPropagation(); if(longed) return; if(ph.classList.contains('menu')){ closeMenu(); return; } launch(); });
  gt.addEventListener('contextmenu', function(e){ e.preventDefault(); });
  menu.addEventListener('click', function(e){ var b=e.target.closest('button'); if(!b) return; e.stopPropagation(); vib(6); closeMenu();
    while($('.s3.on')) window.closeTop();
    if(b.dataset.a==='go') window.enter('timer');
    else if(b.dataset.a==='rec'){ window.enter('gallery'); setTimeout(function(){ openS3('s3-compose'); }, 300); }
    else window.enter('home'); });
  ph.addEventListener('click', function(e){ if(ph.classList.contains('menu') && !e.target.closest('.dk-menu')){ closeMenu(); return; }
    var a=e.target.closest('.ap'); if(a && a.dataset.k!=='gt'){ vib(4); toast(a.dataset.k==='n'?'这是示意图标':'那是水獭家族的另一款'); } });
  $('#dkWg').addEventListener('click', function(e){ e.stopPropagation(); vib(6); while($('.s3.on')) window.closeTop(); window.enter('home'); });
  ctx.S3_HOOKS['s3-desk']=function(){ closeMenu(); ph.classList.remove('in'); void ph.offsetWidth; ph.classList.add('in'); };
};
})();
