/* ═══════════════════════════════════════════════════════════════════
   小獭助手 + 生命力场景（2026-11 新增，原型先行）
   - 悬浮小獭：全局常驻（开战页、聊天、记一条、看图时让位），可拖、贴边；
     形象「随机变」或固定一个表情；点她 → 问小獭；连点 = 痒、长按 = 抱抱、甩一下 / 摇手机 = 转晕
   - 问小獭：按当前页给 3 个建议；能打字、能按住说话；改数据的事先出确认卡
   - 场景：欢迎回来 · 深夜 · 里程碑仪式 · 那天的你 · 今日小纸条
   走查深链：?back=5 欢迎回来 · ?night=1 深夜 · ?ms=streak30|streak7|streak100|s100|ontime 里程碑 · ?note=1 小纸条 · ?pet=off
   ═══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
var $=function(s,r){ return (r||document).querySelector(s); };
var $$=function(s,r){ return [].slice.call((r||document).querySelectorAll(s)); };
var vib=function(n){ if(navigator.vibrate) navigator.vibrate(n); };
var R=matchMedia('(prefers-reduced-motion: reduce)').matches;
var Q=location.search;
var qv=function(k){ var m=Q.match(new RegExp('[?&]'+k+'=([\\w-]+)')); return m?m[1]:null; };
var STK=function(k, still){ return 'assets/otter/expr/'+(still?'still/270/':'anim/270/')+k+'.webp'; };
var C={happy:'255,180,120', hi:'255,200,150', cheer:'110,231,168', love:'255,138,184', proud:'255,170,90', calm:'120,200,255', sleepy:'190,150,255',
  hug:'255,160,170', laugh:'255,200,100', think:'130,190,255', focus:'96,210,230', shock:'255,220,90', please:'255,190,140', speechless:'160,170,200',
  great:'255,210,122', relief:'150,220,170', shy:'255,150,180', ok:'110,231,168', cry:'124,140,255', goodnight:'170,150,255', morning:'255,200,110'};
var SKINS=['happy','hi','cheer','love','proud','calm','sleepy','hug','laugh','shy','focus','great'];
var toast=function(m, o){ if(window.v3toast) v3toast(m, o); };
var hour=function(){ var h=qv('hour'); return h!==null?+h:new Date().getHours(); };
var night=function(){ var h=hour(); return qv('night')==='1' || h>=23 || h<5; };
var page=function(){ return document.body.dataset.page||'home'; };
var safe=function(n, f){ try{ f(); }catch(e){ console.warn('[pet] '+n, e); } };

/* 粒子：从 (x,y) 往上飘一把字符 */
function float(x, y, chars, n, cls){
  if(R) return;
  for(var i=0;i<n;i++){ (function(i){
    var p=document.createElement('span'); p.className=cls||'pt3'; p.textContent=chars[i%chars.length];
    p.style.left=x+'px'; p.style.top=y+'px'; document.body.appendChild(p);
    var dx=(Math.random()-.5)*70, dy=-(50+Math.random()*60);
    p.animate([{transform:'translate(-50%,-50%) scale(.4)', opacity:0},{transform:'translate(calc(-50% + '+dx*.5+'px), calc(-50% + '+dy*.5+'px)) scale(1.1)', opacity:1, offset:.3},
      {transform:'translate(calc(-50% + '+dx+'px), calc(-50% + '+dy+'px)) scale(.8)', opacity:0}], {duration:1100+i*90, easing:'cubic-bezier(.2,0,0,1)', delay:i*70})
      .onfinish=function(){ p.remove(); };
  })(i); }
}
function confetti(x, y, n){
  if(R) return;
  var pal=['#3DDCFF','#9B7BF0','#FF6B2C','#FFD27A','#FF8AB8','#6EE7A8'];
  for(var i=0;i<n;i++){ (function(){
    var c=document.createElement('i'); c.className='cf3'; c.style.background=pal[Math.floor(Math.random()*pal.length)];
    c.style.left=x+'px'; c.style.top=y+'px'; document.body.appendChild(c);
    var dx=(Math.random()-.5)*320, up=-(120+Math.random()*160), fall=240+Math.random()*220, rot=Math.random()*720-360;
    c.animate([{transform:'translate(0,0) rotate(0)', opacity:1},{transform:'translate('+dx*.6+'px,'+up+'px) rotate('+rot*.5+'deg)', opacity:1, offset:.35},
      {transform:'translate('+dx+'px,'+fall+'px) rotate('+rot+'deg)', opacity:0}], {duration:1500+Math.random()*700, easing:'cubic-bezier(.2,.6,.4,1)'}).onfinish=function(){ c.remove(); };
  })(); }
}
var centerOf=function(el){ var r=el.getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2]; };
function typeInto(el, text, speed, done){
  if(R){ el.textContent=text; if(done) done(); return; }
  var i=0; el.textContent=''; clearInterval(el._tt);
  el._tt=setInterval(function(){ el.textContent=text.slice(0, ++i);
    if(i>=text.length){ clearInterval(el._tt); if(done) done(); } }, /[，。！？～]/.test(text.charAt(i))?speed*4:speed);
}

/* ═══ 悬浮小獭 ═══════════════════════════════════════════════════ */
var cfg={mode:'random', k:'happy', side:'right', y:.62};
try{ cfg=Object.assign(cfg, JSON.parse(localStorage.getItem('gt_pet')||'{}')); }catch(_){}
var saveCfg=function(){ try{ localStorage.setItem('gt_pet', JSON.stringify(cfg)); }catch(_){} };

var pet=document.createElement('div'); pet.className='pet hide'; pet.id='pet';
pet.setAttribute('role','button'); pet.setAttribute('aria-label','小獭助手，点一下问她');
pet.innerHTML='<i class="halo"></i><i class="shadow"></i><div class="bd"><img alt=""></div><span class="say"></span><span class="zz">z</span>';
document.body.appendChild(pet);
var img=$('img', pet), say=$('.say', pet), cur='', tempT=null;

function ctxPool(){
  if(night()) return ['sleepy','calm','goodnight'];
  if(window.deckState==='warn') return ['please','shock','hug'];
  var h=hour(); return h<10?['hi','morning','cheer']:h<18?['happy','cheer','proud','focus']:['happy','love','calm','laugh'];
}
function setFace(k){ if(k===cur) return; cur=k; img.src=STK(k); pet.style.setProperty('--pc', C[k]||C.happy); }
function homeFace(){ if(cfg.mode==='fixed') return setFace(night()?'sleepy':cfg.k);
  var p=ctxPool().filter(function(k){ return k!==cur; }); setFace(p[Math.floor(Math.random()*p.length)]||'happy'); }
/* 临时表情：反应完回到自己的形象 */
function react(k, ms){ clearTimeout(tempT); setFace(k); tempT=setTimeout(homeFace, ms||1800); }
setInterval(function(){ if(cfg.mode==='random' && !tempT_active()) homeFace(); }, 22000);
function tempT_active(){ return pet.classList.contains('drag') || sayOn; }

var sayOn=false, sayT=null;
function speak(text, ms, ask){
  sayOn=true; say.textContent=text; say.classList.toggle('ask', !!ask); say.classList.add('on'); clearTimeout(sayT);
  sayT=setTimeout(function(){ say.classList.remove('on','ask'); sayOn=false; }, ms||Math.max(2400, text.length*160));
}

/* 位置：贴左 / 右边，纵向比例记住 */
var W=function(){ return innerWidth; }, H=function(){ return innerHeight; };
var pos={x:0, y:0};
function place(x, y, anim){
  pos.x=x; pos.y=y; pet.classList.toggle('left', x < W()/2);
  pet.style.transform='translate('+x+'px,'+y+'px)'+(anim===false?'':'');
}
function dock(){ var x=cfg.side==='left'?8:W()-72, y=Math.max(90, Math.min(H()-180, cfg.y*H())); place(x, y); }
addEventListener('resize', dock);
var tuckT=null;
addEventListener('scroll', function(){
  if(down) return; pet.classList.add('tuck'); clearTimeout(tuckT);
  tuckT=setTimeout(function(){ pet.classList.remove('tuck'); }, 900);
}, {passive:true});

/* 手势：点 / 连点 / 长按 / 拖 / 甩 */
var down=null, moved=false, holdT=null, taps=0, tapT=null, last=[];
pet.addEventListener('pointerdown', function(e){
  pet.setPointerCapture(e.pointerId); down={x:e.clientX, y:e.clientY, px:pos.x, py:pos.y, t:performance.now(), q:e.target.closest('.say.ask')?hintQ:''}; moved=false; last=[{x:e.clientX, y:e.clientY, t:down.t}];
  holdT=setTimeout(function(){ if(!moved){ down=null; hug(); } }, 600);
});
pet.addEventListener('pointermove', function(e){
  if(!down) return; var dx=e.clientX-down.x, dy=e.clientY-down.y;
  if(!moved && Math.hypot(dx,dy)>6){ moved=true; clearTimeout(holdT); pet.classList.add('drag'); setFace('shock'); }
  if(moved){ place(down.px+dx, down.py+dy); last.push({x:e.clientX, y:e.clientY, t:performance.now()}); if(last.length>5) last.shift(); }
});
pet.addEventListener('pointerup', function(){
  clearTimeout(holdT); if(!down) return; var d=down; down=null;
  if(moved){ pet.classList.remove('drag');
    var a=last[0], b=last[last.length-1], v=Math.hypot(b.x-a.x, b.y-a.y)/Math.max(1, b.t-a.t);
    cfg.side=pos.x+32 < W()/2 ? 'left':'right'; cfg.y=Math.max(.12, Math.min(.8, pos.y/H())); saveCfg(); dock();
    if(v>1.6) dizzy(); else react('happy', 900);
    return; }
  if(d.q){ taps=0; say.classList.remove('on','ask'); sayOn=false; openAsk(d.q); return; }
  taps++; clearTimeout(tapT);
  tapT=setTimeout(function(){ var n=taps; taps=0; if(n>=3) tickle(); else openAsk(); }, 260);
});
function poke(){ pet.classList.remove('poke'); void pet.offsetWidth; pet.classList.add('poke'); }
function tickle(){ poke(); react('laugh', 1600); vib([6,40,6,40,6]); var c=centerOf(pet); float(c[0], c[1]-20, ['哈','哈','✦'], 4); speak('哈哈哈好痒，别闹～', 1800); }
function hug(){ pet.classList.remove('hug'); void pet.offsetWidth; pet.classList.add('hug'); react('hug', 2200); vib([10,60,30]);
  var c=centerOf(pet); float(c[0], c[1]-24, ['♥','♥','♡'], 5, 'pet-heart'); speak('抱抱～今天也辛苦啦', 2200); }
function dizzy(){ pet.classList.remove('dizzy'); void pet.offsetWidth; pet.classList.add('dizzy'); react('speechless', 2000); vib([20,30,20]);
  var c=centerOf(pet); float(c[0], c[1]-26, ['@','·','@'], 3); speak('转、转晕了……', 1800); }
/* 摇手机 */
var shakeAt=0;
addEventListener('devicemotion', function(e){ var a=e.accelerationIncludingGravity; if(!a) return;
  var m=Math.abs(a.x||0)+Math.abs(a.y||0)+Math.abs(a.z||0), now=Date.now();
  if(m>38 && now-shakeAt>3000 && !pet.classList.contains('hide')){ shakeAt=now; dizzy(); } });

/* 什么时候让位：开战页（有陪玩小獭）· 聊天 · 记一条 · 看图 · 启动 / 引导 · 全屏场景 */
function shouldHide(){
  if(qv('pet')==='off') return true;
  var boot=$('#boot'); if(boot && !boot.classList.contains('gone')) return true;
  if(page()==='timer') return true;
  if($('.s3.on#s3-otter, .s3.on#s3-compose, .s3.on#s3-share, .ob3.on, .lf-stage.on, #sh3-pet.on')) return true;
  var vw=$('#vw3'); if(vw && getComputedStyle(vw).display!=='none') return true;
  return false;
}
var wasHidden=true;
setInterval(function(){ var h=shouldHide(); pet.classList.toggle('hide', h);
  if(wasHidden && !h){ poke(); } wasHidden=h; }, 300);
dock(); homeFace();

/* 偶尔冒一句：每个 Tab 进来一次，最多一句，不追着说 */
var LINES={
  home:['今天的水池我帮你看着','想玩就去吧，我数着时间'], gallery:['想找哪一条？点我帮你翻','这一页都是你的高光～'],
  me:['你玩过的每一局我都记得','要不要看看这周的小结？']
};
var said={};
setInterval(function(){ var p=page(); if(said[p] || pet.classList.contains('hide')) return; said[p]=1;
  var l=night()?['夜深了，眼睛也要休息哦']:LINES[p]; if(l) setTimeout(function(){ if(!pet.classList.contains('hide') && !$('#tip3.on') && !pet.classList.contains('tuck')) speak(l[Math.floor(Math.random()*l.length)]); }, 1800); }, 1200);

/* ═══ 问小獭 ═════════════════════════════════════════════════════ */
var sh=document.createElement('div'); sh.className='sh3'; sh.id='sh3-pet';
var MIC='<svg viewBox="0 0 24 24"><rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5"/></svg>';
var SEND='<svg viewBox="0 0 24 24"><path d="M5 12.5 19.5 5l-4.6 15-3.1-6.3z"/><path d="M11.8 13.7 19.5 5"/></svg>';
sh.innerHTML='<div class="sh-back"></div><div class="sh-panel"><div class="sh-grab"></div>'
  +'<div class="pa-hd"><img class="av" alt=""><div class="tx"><b>问小獭</b><small id="paWhere"></small></div><button class="skin" id="paSkinB">换形象</button></div>'
  +'<div class="pa-skin" id="paSkin"><div class="mode"><span class="chip" data-m="random">随机变</span><span class="chip" data-m="fixed">固定一个</span></div><div class="grid" id="paGrid"></div></div>'
  +'<div class="pa-log" id="paLog"></div><div class="pa-sug" id="paSug"></div>'
  +'<div class="pa-listen" id="paListen"><span class="wv">'+[0,1,2,3,4,5,6].map(function(i){ return '<i style="--i:'+i+'"></i>'; }).join('')+'</span><span>在听…松手就好</span></div>'
  +'<div class="pa-in"><button class="mic" id="paMic" aria-label="按住说话">'+MIC+'</button><textarea id="paIn" rows="1" placeholder="让小獭帮你做点什么…"></textarea><button class="send" id="paSend" aria-label="发送" disabled>'+SEND+'</button></div>'
  +'<div class="pa-foot"><span>改数据前都会先问你 · 密钥只在这台手机</span><button id="paFull">完整聊天 ›</button></div></div>';
document.body.appendChild(sh);
var log=$('#paLog', sh), inp=$('#paIn', sh), send=$('#paSend', sh);

/* ── 上下文：小獭看的是「你正在看的那一块」，只读本页已显示的本地数据 ──
   优先级：状态（快到上限）> 打开的二级页 > Tab 里阅读线上的那一块 > Tab 默认；深夜只改语气 */
var txt=function(s, r){ var e=$(s, r); return e?e.textContent.replace(/\s+/g,' ').trim():''; };
function topS3(){ var all=$$('.s3.on'); return all.length?all[all.length-1]:null; }
/* Tab 页：屏幕 42% 高度那条线上是哪一块 */
function atLine(){ var y=innerHeight*.42, best=null, bd=1e9;
  $$('.page.on .v3-sec, .page.on .v3-card, .page.on .lf-card, .page.on .h3-hero, .page.on .g3-feat, .page.on [id^="g3"], .page.on .m3-nums').forEach(function(el){
    var r=el.getBoundingClientRect(); if(r.height<20 || r.bottom<0 || r.top>innerHeight) return;
    var d=r.top<=y && r.bottom>=y ? 0 : Math.min(Math.abs(r.top-y), Math.abs(r.bottom-y)); if(d<bd){ bd=d; best=el; } });
  return best; }
var has=function(el, s){ return el && (el.matches(s) || !!el.closest(s)); };
function ctx(){
  var s3=topS3(), id=s3?s3.id:'', p=page();
  if(window.deckState==='warn') return {id:'warn', see:'快到今天的上限了', face:'hug', line:'快到上限啦。不急，我陪你把这局打完～',
    sug:['再玩 10 分钟就收','帮我收工','我有点停不下来']};
  if(id==='s3-record'){ var t=txt('#rdT')||'这一条', g=txt('#rdGm'); return {id:'rec:'+t, see:'「'+t+'」', face:'love',
    line:'这条我记得'+(g?'，是'+g+'那次':'')+'。想让我帮你做点什么？', hint:'要我帮你把这条写得更好吗？',
    sug:['帮我把这条写得更好','给它挑几个标签','那天我还玩了什么？']}; }
  if(id==='s3-calendar') return {id:'cal', see:'打卡日历', face:'proud', line:'连续 12 天了，这个火苗是你一点点养大的。', hint:'要我说说这个月吗？',
    sug:['帮我说说这个月','这个月哪天玩最久？','连续天数怎么才不断？']};
  if(id==='s3-memory' || id==='s3-desk') return {id:'mem', see:'我们的记忆', face:'love', line:'这些我都替你收着呢。', hint:'做一张回忆卡吗？',
    sug:['我们认识多久了？','我最常玩的是哪款？','做一张回忆卡']};
  if(id==='s3-foot') return {id:'foot', see:'足迹', face:'calm', line:'你走过的每一段，我都记在这儿。', hint:'要我说说这一段吗？',
    sug:['帮我说说这一段','这一段我最爱玩什么？','最长的一次是哪天？']};
  if(id==='s3-limit') return {id:'limit', see:'时长管家', face:'think', line:'定上限不是管你，是让你玩得更安心。', hint:'按你最近的习惯，我帮你算一个？',
    sug:['按我最近的习惯建议一个上限','周末放宽一点','超时了你会怎么提醒我？']};
  if(id==='s3-games') return {id:'games', see:'游戏管理', face:'focus', line:'21 款都在这，有几款好久没碰了。',
    sug:['哪款最近没碰了？','给原神改个昵称','按时长排一下']};
  if(id==='s3-moods') return {id:'moods', see:'心情', face:'calm', line:'心情不用每天都好，记下来就够了。', hint:'这周心情要我看看吗？',
    sug:['这周心情怎么样？','帮我选个此刻心情','哪天最开心？']};
  if(id==='s3-today') return {id:'today', see:'今天', face:'focus', line:'今天的每一局都在这儿。', sug:['今天玩得怎么样？','还能玩多久？','帮我生成本周小结']};
  if(id==='s3-trash') return {id:'trash', see:'回收站', face:'think', line:'放进来的还能捡回去，别担心。', sug:['回收站里有什么值得留下的？','30 天后会怎样？']};
  if(id==='s3-expr') return {id:'expr', see:'表情馆', face:'laugh', line:'表情都在这，想找哪种？', hint:'说个心情，我帮你找表情～',
    sug:['找一个「无语」的表情','我最常用哪个表情？','找个适合深夜的']};
  if(/^s3-(settings|notify|ai|about|profile|legal)$/.test(id)) return {id:'set', see:txt('.bar3 .tt', s3)||'设置', face:'ok', line:'设置的事也可以问我～',
    sug:['AI 会看到我什么？','提醒怎么设比较好？','怎么备份到新手机？']};
  var el=atLine();
  if(p==='home'){
    if(has(el,'.lf-day')) return {id:'h:day', see:'一个月前的今天', face:'love', line:'那天你可开心了。', sug:['一个月前的今天我在干嘛？','去年这时候呢？','把那天做成分享卡']};
    if(has(el,'.h3-week')) return {id:'h:week', see:'最近 7 天', face:'proud', line:'这一周每天都来了～', hint:'这周比上周少玩了一点哦', sug:['这周比上周玩得多吗？','帮我生成本周小结','哪天超时了？']};
    if(has(el,'.h3-lib')) return {id:'h:lib', see:'游戏库', face:'focus', line:'今天想玩哪款？', sug:['帮我开一局原神，45 分钟','哪款最近没碰了？','我最常玩的是哪款？']};
    if(has(el,'.h3-mem')) return {id:'h:mem', see:'最近留下的', face:'great', line:'最近的高光都在这～', sug:['找出上个月出金的那条','把这周做成一张分享卡','我最常贴哪个标签？']};
    if(has(el,'.lf-note')) return {id:'h:note', see:'今日小纸条', face:'goodnight', line:'今天辛苦啦。', sug:['读给我听','明天想玩多久？','今天玩得怎么样？']};
    return {id:'h', see:'今天的水池', face:night()?'sleepy':'happy', line:night()?'这么晚还没睡呀。要我帮你看看今天玩了多久吗？':'今天的水池我帮你看着～',
      sug:['今天还能玩多久？','帮我开一局原神，45 分钟','一个月前的今天我在干嘛？']};
  }
  if(p==='gallery'){
    var life=($('#g3Realm button.on')||{dataset:{}}).dataset.r==='life';
    if(has(el,'#g3Heat') || has(el,'.g3-heat')) return {id:'g:heat', see:'这个月的热力', face:'proud', line:'这个月 19 天都留下了东西。', sug:['帮我说说这个月','最爱周几玩？','把这个月做成分享卡']};
    var ft=has(el,'.g3-feat') ? txt('.g3-feat b, .g3-feat h3, .g3-feat .t', el.closest('.g3-feat')||el) : '';
    if(life) return {id:'g:life', see:ft?'「'+ft+'」':'生活', face:'calm', line:'生活这面墙，我也很喜欢。', sug:['找出最近一次散步','这个月见了几次朋友？','把这周做成一张分享卡']};
    return {id:'g:game', see:ft?'「'+ft+'」':'游戏藏品', face:'great', line:'这一页都是你的高光～', sug:['找出上个月出金的那条','我最常贴哪个标签？','把这周做成一张分享卡']};
  }
  if(p==='me'){
    if(has(el,'.m3-nums') || /记忆|局/.test(el?el.textContent.slice(0,40):'')) return {id:'m:mem', see:'我们的记忆', face:'love', line:'268 局，214 小时，我都记得。', sug:['我们认识多久了？','我最常玩的是哪款？','做一张回忆卡']};
    return {id:'m', see:'我', face:'proud', line:'第 128 天了，你一直在。', sug:['这周比上周玩得多吗？','把每日上限改成 2.5 小时','帮我生成本周小结']};
  }
  return {id:p, see:'', face:'happy', line:'嗨，我在～想让我帮你做点什么？', sug:['今天还能玩多久？','帮我生成本周小结']};
}

/* ── 记得你：上一次聊了什么、今天有没有问过心情（只存本机） ── */
var mem={}; try{ mem=JSON.parse(localStorage.getItem('gt_pet_mem')||'{}'); }catch(_){}
var saveMem=function(){ try{ localStorage.setItem('gt_pet_mem', JSON.stringify(mem)); }catch(_){} };
var today=function(){ var d=new Date(); return d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate(); };
var RECALL={start:'刚才帮你开了一局，玩得开心吗？', limit:'上限改好啦，今天感觉怎么样？', mood:'刚才的心情还好吗？', sad:'刚才你有点累，现在好些了吗？'};

var lastCtx=null;
function openAsk(q){
  poke(); var c=ctx(); lastCtx=c; react(c.face||'think', 1200);
  $('.pa-hd .av', sh).src=STK(c.face||cur||'happy');
  $('#paWhere', sh).innerHTML=(c.see?'<span class="see">正在看 · '+c.see+'</span>':'')+'只读这一页的本地数据';
  var s=$('#paSug', sh); s.innerHTML=c.sug.map(function(t){ return '<span class="chip">'+t+'</span>'; }).join('');
  if(!log.children.length || log.dataset.ctx!==c.id){
    if(log.children.length) log.insertAdjacentHTML('beforeend', '<div class="pa-sep">'+(c.see||'换了个地方')+'</div>');
    var r=mem.topic && Date.now()-mem.at<3*3600e3 && RECALL[mem.topic];
    bot(r && !log.dataset.ctx ? r : c.line); log.dataset.ctx=c.id;
    if(!q && hour()>=19 && mem.checkin!==today() && !c.id.indexOf('h') && c.id!=='warn') setTimeout(checkin, 900);
  }
  $('#paSkin', sh).classList.remove('on');
  sh.classList.add('on'); vib(6);
  if(q) setTimeout(function(){ ask(q); }, 380);
}
/* 晚上第一次打开：问一句今天过得怎么样（一天一次） */
function checkin(){ mem.checkin=today(); saveMem();
  var c=card('<div class="k"><img src="'+STK('hi')+'" alt="">今天过得怎么样？</div><div class="feel">'
    +[['great','超开心'],['ok','还不错'],['sleepy','有点累'],['cry','不太好']].map(function(f){ return '<button data-f="'+f[0]+'"><img src="'+STK(f[0], true)+'" alt=""><span>'+f[1]+'</span></button>'; }).join('')+'</div>', 'ck');
  c.addEventListener('click', function(e){ var b=e.target.closest('button'); if(!b || c.classList.contains('done')) return; c.classList.add('done'); vib(8);
    b.classList.add('on'); var f=b.dataset.f; react(f==='cry'?'hug':f, 2000);
    var L={great:'太好啦！那我把今天记成「超开心」的一天～', ok:'还不错就很好啦。平平稳稳也值得记一笔。',
      sleepy:'辛苦啦。今天就别熬了，我帮你盯着时间，到点叫你。', cry:'抱抱。不开心的时候，玩一会儿也没关系，我在这儿陪你。'};
    setTimeout(function(){ bot(L[f]); if(f==='cry' || f==='sleepy'){ mem.topic='sad'; mem.at=Date.now(); saveMem(); }
      setTimeout(function(){ confirmCard({what:'设此刻心情', k:f, v:b.querySelector('span').textContent, sub:'只你自己看得到 · 4 小时后自动收起', done:'记下了'}); }, 900); }, 500); });
}

/* ── 快速唤起：上下文变了、停留一会儿，小獭冒一句可以直接点的话 ── */
var hinted={}, ctxSeen='', ctxAt=0, hintQ='';
setInterval(function(){
  if(pet.classList.contains('hide') || sh.classList.contains('on') || pet.classList.contains('tuck') || down) return;
  var c=ctx(); if(c.id!==ctxSeen){ ctxSeen=c.id; ctxAt=Date.now(); return; }
  if(!c.hint || hinted[c.id] || Date.now()-ctxAt<1500 || sayOn || $('#tip3.on')) return;
  hinted[c.id]=1; hintQ=c.sug[0]; react(c.face, 3200); speak(c.hint, 4200, true); vib(4);
}, 600);
function closeAsk(){ sh.classList.remove('on'); }
$('.sh-back', sh).addEventListener('click', closeAsk);
$('#paFull', sh).addEventListener('click', function(){ closeAsk(); if(window.openS3) setTimeout(function(){ openS3('s3-otter'); }, 200); });
$('#paSug', sh).addEventListener('click', function(e){ var c=e.target.closest('.chip'); if(c) ask(c.textContent); });
inp.addEventListener('input', function(){ send.disabled=!inp.value.trim(); inp.style.height='auto'; inp.style.height=Math.min(96, inp.scrollHeight)+'px'; });
inp.addEventListener('keydown', function(e){ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); if(inp.value.trim()) ask(inp.value.trim()); } });
send.addEventListener('click', function(){ if(inp.value.trim()) ask(inp.value.trim()); });

/* 气泡 / 等待 / 流式 / 头像表情：与「和小獭聊天」同一套（v3.css .cm · .ct-dots · .ct-caret） */
var scrollLog=function(){ log.scrollTop=log.scrollHeight; };
function row(role, inner){
  var lastRow=log.lastElementChild, cont=lastRow && lastRow.classList.contains('cm') && lastRow.classList.contains(role);
  var r=document.createElement('div'); r.className='cm '+role+(cont?' cont':'');
  r.innerHTML=(role==='ot'?'<img class="cm-av" src="'+STK(cur||'happy', true)+'" alt="">':'')+'<div class="cm-b">'+(inner||'')+'</div>';
  if(cont) lastRow.classList.add('more'); log.appendChild(r); scrollLog(); return r;
}
/* 打字机：按字吐，标点停顿，末尾光标；feed() 可持续喂（流式） */
function typer(el, onDone){
  var q='', out='', ended=false, t=0, caret=document.createElement('i'); caret.className='ct-caret';
  var tx=document.createElement('span'); el.appendChild(tx); el.appendChild(caret);
  var tick=function(){ if(!q.length){ if(ended){ caret.remove(); if(onDone) onDone(out); return; } t=setTimeout(tick, 60); return; }
    var ch=q[0]; q=q.slice(1); out+=ch; tx.textContent=out; if(out.length%6===0) scrollLog();
    t=setTimeout(tick, R?0:/[。！？!?~～]/.test(ch)?220:/[，、,；：]/.test(ch)?110:22+Math.random()*26); };
  t=setTimeout(tick, 80);
  return {feed:function(s){ q+=s; }, end:function(){ ended=true; }};
}
function wait(){ var r=row('ot', '<span class="ct-dots"><i></i><i></i><i></i></span>'); r.classList.add('wait'); return r; }
function bot(t){
  var r=row('ot'); r.classList.add('live'); var b=$('.cm-b', r);
  var ty=typer(b, function(){ r.classList.remove('live'); var av=$('.cm-av', r); if(av) av.src=STK(cur||'happy', true); $('.pa-hd .av', sh).src=STK(cur||'happy'); scrollLog(); });
  /* 模拟流式：一小段一小段喂进去 */
  var i=0; (function feed(){ if(i>=t.length){ ty.end(); return; } var n=2+Math.floor(Math.random()*4); ty.feed(t.slice(i, i+n)); i+=n; setTimeout(feed, R?0:90); })();
  return r;
}
function bubble(text, me){ if(!me) return bot(text); var r=row('you'); $('.cm-b', r).textContent=text;
  setTimeout(function(){ r.classList.add('read'); }, 500); return r; }
function card(html, cls){ var c=document.createElement('div'); c.className='pa-card'+(cls?' '+cls:''); c.innerHTML=html; log.appendChild(c);
  setTimeout(function(){ log.scrollTop=log.scrollHeight; }, 30); return c; }
/* 确认卡：写操作一律要点头（约束 I6） */
function confirmCard(o){
  var c=card('<div class="k"><img src="'+STK(o.k||'ok')+'" alt="">需要你确认 · '+o.what+'</div><div class="v">'+o.v+'</div>'+(o.sub?'<div class="sub">'+o.sub+'</div>':'')
    +'<div class="acts"><button class="no">先不</button><button class="ok">'+(o.ok||'好')+'</button></div><div class="st"></div>');
  $('.ok', c).onclick=function(){ c.classList.add('done'); $('.st', c).textContent='✓ '+o.done; vib([8,30,14]); react('ok', 1400); var p=centerOf(c); float(p[0], p[1], ['✦','✧'], 4); if(o.run) setTimeout(o.run, 420); };
  $('.no', c).onclick=function(){ c.classList.add('done','nope'); $('.st', c).textContent='好，不动它'; react('calm', 1200); };
}

var remember=function(k){ mem.topic=k; mem.at=Date.now(); saveMem(); };
var RULES=[
  /* 情绪：先接住，再给一个能做的小事 */
  [/累|烦|难过|不开心|输了|连跪|压力/, function(){ react('hug', 2600); remember('sad'); var c=centerOf(pet); float(innerWidth/2, innerHeight*.5, ['♥','♡'], 4, 'pet-heart');
    bot('抱抱。输了也好、累了也好，都不是你的错。');
    setTimeout(function(){ var k=card('<div class="k"><img src="'+STK('hug')+'" alt="">小獭能帮你做的</div><div class="opts"><button data-a="stop">今天就到这，帮我收工</button><button data-a="note">把这份心情记下来</button><button data-a="talk">就想说说话</button></div>');
      k.addEventListener('click', function(e){ var b=e.target.closest('button'); if(!b || k.classList.contains('done')) return; k.classList.add('done'); b.classList.add('on'); vib(6);
        if(b.dataset.a==='stop') bot('好，今天辛苦啦。我把水池关了，明天见～');
        else if(b.dataset.a==='note') confirmCard({what:'存成草稿', k:'calm', v:'生活 · 「今天有点累，但还是撑过来了」', sub:'只存这台手机 · 你回头再改', done:'存进草稿箱了'});
        else bot('嗯，我听着。慢慢说，不急。'); }); }, 900); }],
  [/再玩\s*10|再玩一会/, function(){ react('ok'); bot('好，10 分钟。到点我轻轻叫你，不催～'); }],
  [/帮我收工|收工/, function(){ react('proud', 2400); bot('说停就停，这比赢一把还厉害。今天 1h 37m，准时收工 ✓'); }],
  [/停不下来/, function(){ react('hug'); bot('我懂，打得正上头嘛。要不我们约好：这局结束就收，我替你记着。'); }],
  /* 记录详情 */
  [/写得更好|润色|帮我写/, function(){ react('think'); bot('我试着改了一句，原来那句我也留着：');
    setTimeout(function(){ var c=card('<div class="k"><img src="'+STK('think')+'" alt="">帮你润一润 · 不会直接改</div><div class="cmp"><s>深渊十二层，第三次通关</s><b>第三次站上深渊十二层，这次手没抖。</b></div>'
      +'<div class="acts"><button class="no">保留原来的</button><button class="ok">用这句</button></div><div class="st"></div>');
      $('.ok', c).onclick=function(){ c.classList.add('done'); $('.st', c).textContent='✓ 已换上 · 可以撤销'; var t=$('#rdT'); if(t){ var old=t.textContent; t.textContent='第三次站上深渊十二层，这次手没抖。';
        toast('已换上小獭写的这句', {act:'撤销', cb:function(){ t.textContent=old; }}); } react('ok'); vib([8,30,14]); };
      $('.no', c).onclick=function(){ c.classList.add('done','nope'); $('.st', c).textContent='好，还是你写的最好'; react('calm'); }; }, 700); }],
  [/挑.*标签|标签建议/, function(){ react('focus'); bot('看图和文字，我觉得这几个合适：');
    setTimeout(function(){ confirmCard({what:'加标签', k:'great', v:'<span class="tg">通关</span><span class="tg">加油</span><span class="tg">超爽</span>', sub:'只从你已有的标签里挑', done:'标签加好了'}); }, 700); }],
  [/那天我还玩了/, function(){ react('focus'); bot('那天一共 3 局：星穹铁道 1h 10m、王者 40m，还有这局深渊 55m。'); }],
  /* 日历 / 足迹 / 记忆 */
  [/说说这个月/, function(){ react('proud'); bot('这个月 19 天都来了，最长连续 7 天。最爱周六晚上玩，最常贴「超爽」。比上个月少玩了 6 小时，节奏越来越稳啦～'); }],
  [/说说这一段/, function(){ react('calm'); bot('这一段 12 天，你主要在玩原神和星穹铁道，有 3 个晚上和朋友开黑。最晚一次玩到 1:20，后面几天就早多了。'); }],
  [/哪天玩最久|最长的一次/, function(){ react('shock'); bot('10.19 那天，3h 20m。第二天你说「下次不这样了」，后来真的没再超过。'); }],
  [/连续.*不断/, function(){ react('cheer'); bot('每天打开看一眼就算～哪怕不玩，我也帮你记上。'); }],
  [/认识多久/, function(){ react('love', 2400); bot('第 128 天啦。从 6.28 你第一次打开，到今天，268 局、214 小时。'); }],
  [/最常玩/, function(){ react('great'); bot('原神，86 小时。其次是星穹铁道 52 小时、王者荣耀 31 小时。'); }],
  [/回忆卡|分享卡/, function(){ react('happy'); bot('选好了最亮的几条，去分享卡里挑个主题吧～'); setTimeout(function(){ closeAsk(); if(window.openS3) openS3('s3-share'); }, 1400); }],
  /* 时长管家 */
  [/习惯.*上限|建议.*上限/, function(){ react('think'); bot('最近 4 周你平均每天 1h 52m，超时的 2 天都在周六。我建议工作日 2.5 小时，周末 3.5 小时。');
    setTimeout(function(){ remember('limit'); confirmCard({what:'改每日上限', k:'ok', v:'工作日 <s>3</s>→ 2.5 小时 · 周末 3.5 小时', sub:'从明天起生效 · 提醒照旧', done:'上限改好了',
      run:function(){ $$('.tkLimit').forEach(function(el){ el.textContent='2.5'; }); }}); }, 800); }],
  [/周末/, function(){ react('ok'); bot('周末放宽到 4 小时？'); setTimeout(function(){ confirmCard({what:'改周末上限', k:'ok', v:'周六、周日 <s>3</s>→ 4 小时', done:'周末上限改好了'}); }, 700); }],
  [/怎么提醒/, function(){ react('calm'); bot('到 85% 我轻轻冒个泡；到点了说一声；超时以后每 15 分钟提醒一次，不会弹窗吓你。'); }],
  /* 游戏 */
  [/没碰/, function(){ react('think'); bot('明日方舟 23 天没打开了，绝区零 11 天。要不要把它们挪到后面？'); }],
  [/昵称/, function(){ react('ok'); bot('叫它「提瓦特」怎么样？'); setTimeout(function(){ confirmCard({what:'改游戏昵称', k:'ok', v:'原神 → 提瓦特', sub:'只改显示名，记录不受影响', done:'改好了'}); }, 700); }],
  [/按时长排/, function(){ react('focus'); bot('原神 86h · 星穹铁道 52h · 王者荣耀 31h · 绝区零 18h · 明日方舟 9h'); }],
  /* 心情 */
  [/心情怎么样|哪天最开心/, function(){ react('love'); bot('这周 4 天「开心」，2 天「平静」，周三有点累。最开心是周六，那天你出金了～'); }],
  /* 回收站 / 表情 / 设置 */
  [/回收站里/, function(){ react('think'); bot('里面有 3 条，其中「和阿杰的五排」那条有照片，可能值得捡回来。'); }],
  [/30\s*天/, function(){ react('calm'); bot('放进回收站 30 天后才会真的删掉，在那之前随时能恢复。'); }],
  [/散步/, function(){ react('calm'); bot('最近一次是 10.29，绕湖走了一圈，5.2 公里。'); }],
  [/见了几次朋友/, function(){ react('love'); bot('这个月 4 次，每周都见了一次～'); }],
  [/最爱周几/, function(){ react('focus'); bot('周六晚上，8 点到 11 点最常来。'); }],
  [/哪天超时/, function(){ react('please'); bot('周四超了 20 分钟。其他 6 天都准时收工，很棒了。'); }],
  [/今天玩得怎么样/, function(){ react('proud'); bot('今天 2 局 1h 37m，王者赢了一把，原神没出金。在上限内收工 ✓'); }],
  [/表情|适合深夜/, function(){ react('laugh'); bot('这几个怎么样？');
    setTimeout(function(){ var c=card('<div class="k"><img src="'+STK('laugh')+'" alt="">找到的表情</div><div class="ex">'+['speechless','sleepy','goodnight','calm'].map(function(k){ return '<img src="'+STK(k, true)+'" alt="">'; }).join('')+'</div>'); }, 600); }],
  [/AI.*看到|隐私/, function(){ react('ok'); bot('我只看你问的那一页的本地数据，比如今天几局、多少分钟。照片默认不发，设备号、玩家 ID 从来不发。密钥只在这台手机。'); }],
  [/提醒怎么设/, function(){ react('ok'); bot('建议开「快到上限」和「超时」两个，晚上 11 点后的提醒我会说得更轻。'); }],
  [/备份/, function(){ react('ok'); bot('「备份与设置」里导出一个文件，新手机导入就好。AI 密钥不会进备份，到新手机重新填一次。'); }],
  [/读给我听/, function(){ react('goodnight'); bot('（读）今天 2 局，1h 37m，在上限内收工。早点睡，明天见～'); }],
  [/明天想玩多久/, function(){ react('think'); bot('明天周一，还是 2.5 小时左右？我帮你记着。'); }],
  [/还能玩|多久|玩了多少|时长/, function(){ react('focus');
    bot('今天 2 局，1h 37m。离 3 小时上限还有 1h 23m，节奏刚好～'); }],
  [/开一局|开战|开始玩/, function(t){ var g=/王者/.test(t)?['wzry','王者荣耀']:/铁道|星穹/.test(t)?['hsr','星穹铁道']:['ys','原神'];
    var m=(t.match(/(\d+)\s*分/)||[])[1]||45; react('cheer');
    bot('好呀，我帮你把计时准备好～');
    setTimeout(function(){ confirmCard({what:'开一局', k:'cheer', v:'<img src="assets/games/'+g[0]+'.webp" style="width:22px;height:22px;border-radius:6px;vertical-align:-5px;margin-right:6px">'+g[1]+' · 约定 '+m+' 分钟',
      sub:'到点前 5 分钟我会轻轻提醒你', ok:'开战', done:'已经开始计时',
      run:function(){ remember('start'); closeAsk(); if(window.enter) enter('timer'); toast('开战！小獭帮你看着 '+m+' 分钟', {tone:'win'}); }}); }, 700); }],
  [/上限/, function(t){ var h=(t.match(/(\d+(?:\.\d)?)\s*小时/)||[])[1]||'2.5'; react('think');
    bot('嗯，可以。改完从明天起按新的上限算。');
    setTimeout(function(){ confirmCard({what:'改每日上限', k:'ok', v:'<s>3 小时</s>→ '+h+' 小时', sub:'快到时 85% 提醒、超时每 15 分钟提醒都照旧', done:'每日上限已改成 '+h+' 小时',
      run:function(){ $$('.tkLimit').forEach(function(el){ el.textContent=h; }); }}); }, 700); }],
  [/心情/, function(){ react('love'); bot('那就贴一个「心动」？');
    setTimeout(function(){ confirmCard({what:'设此刻心情', k:'love', v:'心动 · 「今天的晚霞好好看」', sub:'4 小时后自动收起', done:'此刻心情换好了'}); }, 700); }],
  [/草稿|记下来|存一下/, function(){ react('ok'); bot('我把刚才说的整理成一条草稿，你回头再改～');
    setTimeout(function(){ confirmCard({what:'存成草稿', k:'ok', v:'游戏 · 「终于打过深渊了」', sub:'标签：通关 · 超爽', done:'存进草稿箱了'}); }, 700); }],
  [/找|出金|哪条/, function(){ react('focus'); bot('找到了，是 10.31 那条：');
    setTimeout(function(){ var c=card('<div class="k"><img src="'+STK('great')+'" alt="">藏品 · 10.31 23:41</div><div class="shot"><img src="assets/memories/game_gacha.webp" alt=""><div><div class="v">终于出金了</div><div class="sub">原神 · 超爽 · 抽卡 · 十连双金</div></div></div>');
      $('.shot', c).onclick=function(){ closeAsk(); if(window.openRecord) setTimeout(function(){ openRecord({img:'game_gacha', t:'终于出金了', g:'ys', d:'10.31 23:41', tags:['great','gacha']}); }, 220); }; }, 600); }],
  [/小结|周|比上周/, function(){ react('proud'); bot('这周 9h 12m，比上周少了 1h 40m，6 天在上限内收工～');
    setTimeout(function(){ var M=[95,0,40,120,160,25,97], mx=240;
      var c=card('<div class="k"><img src="'+STK('proud')+'" alt="">本周小结 · 10.27 – 11.2</div><div class="v">9h 12m · 14 局 · 准时收工 6 / 7</div>'
        +'<div class="bars">'+M.map(function(m,i){ return '<i class="'+(i===6?'now':m>150?'over':'')+'" style="--h:'+Math.max(6, m/mx*100)+'%;--i:'+i+'"></i>'; }).join('')+'</div>'
        +'<div class="acts"><button class="no">好的</button><button class="ok">做成分享卡</button></div>');
      $('.ok', c).onclick=function(){ closeAsk(); if(window.openS3) setTimeout(function(){ openS3('s3-share'); }, 220); };
      $('.no', c).onclick=function(){ c.querySelector('.acts').remove(); }; }, 700); }],
  [/标签/, function(){ react('great'); bot('你最常贴「超爽」，一共 23 次；其次是「抽卡」17 次。'); }],
  [/一个月前|那天|去年/, function(){ react('love'); bot('10.09 那天，你第三次通关深渊十二层，贴了「加油」。那晚你玩了 2h 12m。'); }],
  [/.*/, function(){ react('think'); bot('这个我还不太会，不过可以去完整聊天里慢慢说～'); }]
];
function ask(t){
  inp.value=''; send.disabled=true; inp.style.height='';
  bubble(t, true); $('#paSug', sh).innerHTML='';
  var typing=wait(); react('think', 6000); $('.pa-hd .av', sh).src=STK('think'); $('#paWhere', sh).classList.add('busy');
  setTimeout(function(){ typing.remove(); $('#paWhere', sh).classList.remove('busy'); for(var i=0;i<RULES.length;i++){ if(RULES[i][0].test(t)){ RULES[i][1](t); break; } } }, 900);
}
/* 按住说话（voice-in） */
var mic=$('#paMic', sh), lis=$('#paListen', sh), micT=null;
mic.addEventListener('pointerdown', function(e){ e.preventDefault(); mic.classList.add('on'); lis.classList.add('on'); vib(10); react('focus', 6000);
  micT=Date.now(); });
var micUp=function(){ if(!micT) return; var held=Date.now()-micT; micT=null; mic.classList.remove('on'); lis.classList.remove('on');
  if(held<400){ toast('按住说话，松手就好', {tone:'info'}); return; }
  var t='帮我开一局原神，玩 45 分钟'; inp.value=''; typeInto(inp, t, 28, function(){ send.disabled=false; }); vib(6); };
mic.addEventListener('pointerup', micUp); mic.addEventListener('pointerleave', micUp);

/* 形象：随机变 / 固定一个 */
var grid=$('#paGrid', sh);
grid.innerHTML=SKINS.map(function(k){ return '<button data-k="'+k+'"><img src="'+STK(k, true)+'" alt=""></button>'; }).join('');
function paintSkin(){ $$('.mode .chip', sh).forEach(function(c){ c.classList.toggle('on', c.dataset.m===cfg.mode); });
  $$('button', grid).forEach(function(b){ b.classList.toggle('on', cfg.mode==='fixed' && b.dataset.k===cfg.k); }); grid.style.opacity=cfg.mode==='fixed'?1:.45; }
$('#paSkinB', sh).addEventListener('click', function(){ $('#paSkin', sh).classList.toggle('on'); paintSkin(); vib(5); });
$$('.mode .chip', sh).forEach(function(c){ c.addEventListener('click', function(){ cfg.mode=c.dataset.m; saveCfg(); paintSkin(); homeFace();
  $('.pa-hd .av', sh).src=STK(cur); toast(cfg.mode==='random'?'小獭会跟着时间和心情换表情':'选一个你最喜欢的样子', {tone:'ok'}); }); });
grid.addEventListener('click', function(e){ var b=e.target.closest('button'); if(!b) return; cfg.mode='fixed'; cfg.k=b.dataset.k; saveCfg(); paintSkin();
  setFace(cfg.k); $('.pa-hd .av', sh).src=STK(cfg.k); poke(); vib(8); });

/* ═══ 场景 ═══════════════════════════════════════════════════════ */
var home=$('#page-home');
/* 深夜 */
if(night()){ document.body.classList.add('pet-night');
  safe('night', function(){ var hd=$('#page-timer .head'); if(hd){ var n=document.createElement('div'); n.className='lf-nite'; n.innerHTML='<img src="'+STK('sleepy', true)+'" alt="">夜深了 · 这局打完就睡吧'; hd.appendChild(n); }
    setTimeout(function(){ var tw=$('#tw'); if(tw) typeInto(tw, '夜深了，再玩也别过 12 点半哦，我也困了……', 42); }, 1800); }); }

/* 那天的你：一个月前的今天 */
safe('onthisday', function(){ var after=$('.h3-week', home); if(!after) return;
  // 日期与时长跟 App 同源：今天往前一个月 · 那局 132 分钟（2h 12m，与 v3.js 的「这一局 2 小时 12 分」一致）
  var d1=new Date(); d1.setDate(1); d1.setMonth(d1.getMonth()-1); d1.setDate(new Date().getDate());
  var md=(d1.getMonth()+1)+'.'+(d1.getDate()<10?'0':'')+d1.getDate();
  var c=document.createElement('div'); c.className='v3-card lf-card lf-day';
  c.innerHTML='<i class="sky"></i><div class="ph"><img src="assets/memories/game_boss.webp" alt=""></div><div class="tx"><div class="k">一个月前的今天 · '+md+'</div>'
    +'<b>深渊十二层，第三次通关</b><p>那晚你玩了 2h 12m，贴了「加油」。</p></div><img class="ot" src="'+STK('cheer')+'" alt="">';
  c.onclick=function(){ vib(6); if(window.openRecord) openRecord({img:'game_boss', t:'深渊十二层，第三次通关', g:'hsr', d:md, tags:['cheer','retry','clear']}, $('.ph img', c)); };
  after.after(c); });

/* 今日小纸条：晚上 9 点后（或收工后）出现 */
var NOTE=['今天 2 局，1h 37m，在上限内收工 ✓。王者赢了一把，原神没出金也没关系。早点睡，明天见。',
  '今天你只玩了 1 小时 37 分，比昨天少半小时。我把水池擦干净了，明天还在这儿等你～',
  '王者 52 分钟、原神 45 分钟，刚好停在你说好的地方。这样的你，小獭很喜欢。'];
if(hour()>=21 || hour()<5 || qv('note')==='1') safe('note', function(){ var hero=$('.h3-hero', home); if(!hero) return;
  var c=document.createElement('div'); c.className='lf-card lf-note'; var ni=0;
  c.innerHTML='<div class="k"><img src="'+STK('goodnight', true)+'" alt="">'+(new Date().getMonth()+1)+'.'+new Date().getDate()+' · 小獭的小纸条</div><p></p>'
    +'<div class="acts"><button class="rw"><svg viewBox="0 0 24 24"><path d="M12 3.5c.6 3.8 2.7 5.9 6.5 6.5-3.8.6-5.9 2.7-6.5 6.5-.6-3.8-2.7-5.9-6.5-6.5 3.8-.6 5.9-2.7 6.5-6.5z"/></svg>让小獭说说</button>'
    +'<button class="speak"><svg viewBox="0 0 24 24"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>读给我听</button></div>'
    +'<img class="sign" src="'+STK('love', true)+'" alt="">';
  hero.after(c); var p=$('p', c); p.textContent=NOTE[0];
  $('.rw', c).onclick=function(){ var b=this; if(b.classList.contains('busy')) return; b.classList.add('busy'); b.lastChild.textContent='小獭在想…'; vib(6);
    setTimeout(function(){ b.classList.remove('busy'); b.lastChild.textContent='换一句'; ni=(ni+1)%NOTE.length; typeInto(p, NOTE[ni], 38, function(){ var q=centerOf(b); float(q[0], q[1], ['✦','✧'], 4); }); }, 1100); };
  $('.speak', c).onclick=function(){ var b=this; if(b.classList.contains('on')) return; b.classList.add('on'); b.lastChild.textContent='正在读…'; vib(6);
    setTimeout(function(){ b.classList.remove('on'); b.lastChild.textContent='读给我听'; }, 3200); };
});

/* 全屏场景 */
function stage(o){
  var s=document.createElement('div'); s.className='lf-stage'; s.style.setProperty('--c', C[o.k]||C.cheer);
  s.innerHTML='<img class="ot" src="'+STK(o.k)+'" alt="">'+(o.num!=null?'<div class="num">0</div>':'')+'<h2>'+o.title+'</h2><p>'+o.body+'</p>'
    +(o.rows?'<div class="rows">'+o.rows.map(function(r){ return '<div><img src="'+STK(r[0], true)+'" alt="">'+r[1]+'</div>'; }).join('')+'</div>':'')
    +'<div class="btns"><button class="main">'+o.main+'</button>'+(o.sec?'<button class="sec">'+o.sec+'</button>':'')+'</div>';
  document.body.appendChild(s); void s.offsetWidth; s.classList.add('on');
  if(o.num!=null){ var el=$('.num', s), t0=performance.now();
    if(R) el.textContent=o.num; else setTimeout(function(){ (function f(now){ var q=Math.min(1,(now-t0-200)/900); if(q<0){ requestAnimationFrame(f); return; }
      el.textContent=Math.round(o.num*(1-Math.pow(1-q,3))); if(q<1) requestAnimationFrame(f); else { vib([10,30,20]); } })(performance.now()); }, 0); }
  if(o.party){ setTimeout(function(){ confetti(innerWidth/2, innerHeight*.36, 40); vib([8,40,8,40,24]); }, 520); }
  var bye=function(fn){ s.classList.remove('on'); setTimeout(function(){ s.remove(); }, 420); if(fn) fn(); };
  $('.main', s).onclick=function(){ bye(o.onMain); }; var sc=$('.sec', s); if(sc) sc.onclick=function(){ bye(o.onSec); };
}
var MS={
  streak7:{k:'cheer', num:7, title:'连续 7 天', body:'一整周每天都来看我。这个火苗，是你一点一点养大的。', main:'好耶', sec:'看看日历', party:1, onSec:function(){ openS3 && openS3('s3-calendar'); }},
  streak30:{k:'proud', num:30, title:'连续 30 天', body:'从 10.08 到今天，一天都没落下。小獭给你颁一枚小小的奖章。', main:'收进藏品', sec:'看看日历', party:1,
    onMain:function(){ toast('这一刻收进藏品了', {tone:'win'}); }, onSec:function(){ openS3 && openS3('s3-calendar'); }},
  streak100:{k:'great', num:100, title:'连续 100 天', body:'一百天。你和小獭，已经是老朋友了。', main:'收进藏品', sec:'好耶', party:1, onMain:function(){ toast('这一刻收进藏品了', {tone:'win'}); }},
  s100:{k:'laugh', num:100, title:'第 100 局', body:'第 100 局是王者荣耀，三连胜收工。我们认识的第 23 天。', main:'好耶', sec:'看看一路走来', party:1, onSec:function(){ openS3 && openS3('s3-memory'); }},
  ontime:{k:'relief', num:7, title:'一周都准时收工', body:'说好几点停，就几点停。这比赢十把排位还难。', main:'谢谢小獭', party:1}
};
window.gtMilestone=function(k){ if(MS[k]) stage(MS[k]); };

/* 欢迎回来：隔了 3 天以上再打开 */
var LAST='gt_last_open', gap=0;
try{ var lv=+localStorage.getItem(LAST)||0; if(lv) gap=Math.floor((Date.now()-lv)/864e5); localStorage.setItem(LAST, String(Date.now())); }catch(_){}
if(qv('back')) gap=+qv('back');
function afterBoot(fn){ var b=$('#boot'); if(!b || b.classList.contains('gone')) return setTimeout(fn, 600);
  var t=setInterval(function(){ if(b.classList.contains('gone')){ clearInterval(t); setTimeout(fn, 700); } }, 200); }
if(gap>=3) afterBoot(function(){ stage({k:'hug', title:'好久不见呀', body:'你不在的这 '+gap+' 天，我把水池擦干净了，藏品也都替你看着。',
  rows:[['calm','连续天数停在了 10.28 · 没关系，今天重新数'],['love','藏品里有 3 条还没加标签'],['cheer','今天想玩多久？我帮你看着']],
  main:'今天从头来', sec:'看看我们的记忆', onMain:function(){ react('cheer', 2000); speak('欢迎回来～', 2000); }, onSec:function(){ window.openS3 && openS3('s3-memory'); }}); });
else if(qv('ms')) afterBoot(function(){ window.gtMilestone(qv('ms')); });
})();
