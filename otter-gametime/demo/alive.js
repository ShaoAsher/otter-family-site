/* ═══════════════════════════════════════════════════════════════════
   有数据的二级页：日历 · 足迹 · 编辑资料 · 游戏管理
   只在 v3.js 渲染好的骨架上加一层：主角卡、点开有回应、小獭跟着情绪换表情。
   v3.js 调 GtAlive(ctx) 注入工具；HTML 在加载时就插好，原有逻辑不动。
   ═══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
var FLAME='<svg viewBox="0 0 24 24"><path d="M12 2.8c.6 3.2 4.9 5.6 4.9 10.4A4.9 4.9 0 0 1 12 18.1a4.9 4.9 0 0 1-4.9-4.9c0-2.2 1.1-3.6 2.2-4.6.2 1.6 1 2.6 2 3-.5-3.3.2-6.3.7-8.8z"/><path d="M12 21.2c-2.2 0-3.6-1.5-3.6-3.3 0-1.6 1.1-2.6 2-3.3.2 1 .7 1.6 1.4 1.9-.2-1.3.2-2.6.9-3.6 1.1 1.4 2.9 2.9 2.9 5 0 1.8-1.4 3.3-3.6 3.3z" class="in"/></svg>';
var WK='日一二三四五六';
var pad=function(n){ return (n<10?'0':'')+n; };
var fm=function(m){ return (m>=60?Math.floor(m/60)+'h ':'')+(m%60)+'m'; };

/* ── 加载时插好的骨架 ── */
var swap=function(page, sel, html){ var p=document.getElementById(page), o=p&&p.querySelector(sel); if(!o) return;
  var w=document.createElement('div'); w.innerHTML=html; o.replaceWith.apply(o, [].slice.call(w.children)); };
swap('s3-calendar', '.ft-big',
  '<div class="v3-card al-hero ca-hero" id="caHero">'
  +'<div class="ca-fl">'+FLAME+'</div>'
  +'<div class="tx"><small>连续打卡</small><b><em data-n="12">12</em> 天</b><p id="caLine">再坚持 11 天，就追平你最长的 23 天</p>'
  +'<div class="ca-rec"><i style="--w:52%"></i><span style="--x:52%"></span></div></div>'
  +'<img class="ot" src="assets/otter/expr/anim/270/proud.webp" alt="">'
  +'<div class="al-chips"><span>打卡率 <b>86%</b></span><span>本月超时 <b class="hot">2</b> 天</span><span>今天 <b>1h 37m</b></span></div></div>');
swap('s3-calendar', '.ot-card:last-child', '<div class="v3-card ca-sum" id="caSum"></div>');
swap('s3-foot', '.ft-big',
  '<div class="v3-card al-hero fp-hero" id="fpHero">'
  +'<div class="tx"><small>2026 · 你的足迹</small><b><em data-n="186">186</em> 天</b><p>这么多天里都有你的痕迹<br>最长一口气连着 23 天</p></div>'
  +'<img class="ot" data-ot="foot" src="assets/otter/expr/anim/270/love.webp" alt="">'
  +'<div class="al-chips"><span>游戏 <b data-n="132">132</b> 天</span><span>生活 <b data-n="54">54</b> 天</span><span>藏品 <b data-n="46">46</b> 件</span></div></div>');
(function(){ var y=document.getElementById('ftYear'); if(!y) return;
  var lg=document.createElement('div'); lg.className='fp-lg';
  lg.innerHTML='<span>少</span><i></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i><span>多</span><i class="life"></i><span>生活</span><em>点格子看那一天</em>';
  y.after(lg);
  var mo=document.querySelector('#s3-foot .grp'); if(mo){ mo.id='fpMonths'; mo.classList.add('fp-months'); }
  var bd=document.querySelector('#s3-foot .bd'); if(bd){ var lb=document.createElement('div'); lb.className='lb3'; lb.textContent='回头看看';
    var mm=document.createElement('div'); mm.className='v3-card fp-mem'; mm.id='fpMem'; bd.appendChild(lb); bd.appendChild(mm); }
})();
(function(){ var bd=document.querySelector('#s3-profile .bd'); if(!bd) return;
  var c=document.createElement('div'); c.className='v3-card pf-card'; c.id='pfCard';
  c.innerHTML='<img class="av" id="pfCv" src="assets/avatars/avatar_01.webp" alt=""><div class="tx"><b id="pfCn">旅人</b><span class="tt">常驻旅人</span><p id="pfCb" class="no">还没写简介</p></div>'
    +'<div class="pf-ot"><span class="say" id="pfSay">这是别人看到的你</span><img id="pfOt" src="assets/otter/expr/anim/270/hi.webp" alt=""></div>';
  bd.insertBefore(c, bd.firstChild);
})();
(function(){ var g=document.getElementById('gm3'); if(!g) return;
  var c=document.createElement('div'); c.className='v3-card gm-top'; c.id='gmTop'; g.parentNode.insertBefore(c, g.previousElementSibling);
})();

window.GtAlive=function(ctx){
  var $=ctx.$, $$=ctx.$$, STK=ctx.STK, OT=ctx.OT_EXPR, ALL=ctx.ALL, ITEMS=ctx.ITEMS, HOOK=ctx.S3_HOOKS, R=ctx.REDUCED,
    vib=ctx.vib, tip=ctx.tip, sparkle=ctx.sparkle, burst=ctx.burst, centerOf=ctx.centerOf, openRecord=ctx.openRecord, openS3=ctx.openS3;
  var game=function(id){ return ALL.filter(function(a){ return a[0]===id; })[0] || ALL[0]; };
  var chain=function(id, fn){ var old=HOOK[id]; HOOK[id]=function(){ if(old) old(); fn(); }; };
  /* 数字从 0 滚上来；同一页只滚第一次 */
  var roll=function(root){ $$('[data-n]', root).forEach(function(el){ var to=+el.dataset.n; if(R){ el.textContent=to; return; }
    var t0=performance.now(); (function f(now){ var p=Math.min(1,(now-t0)/900), e=1-Math.pow(1-p,3);
      el.textContent=Math.round(to*e); if(p<1) requestAnimationFrame(f); })(t0); }); };
  var pop=function(el){ if(!el||R) return; el.classList.remove('al-pop'); void el.offsetWidth; el.classList.add('al-pop'); };
  /* 同一处的小獭换表情：不和上一张重复 */
  var face=function(img, pool, small){ var last=img.dataset.k, c=pool.filter(function(k){ return k!==last; }); if(!c.length) c=pool;
    var k=c[Math.floor(Math.random()*c.length)]; img.dataset.k=k; img.src=STK(k, small?false:undefined); pop(img); return k; };

  /* ═══ 日历 ═══ */
  var moodOf=function(mins, over, d){ var p=over?['grind','night','sleepy']:mins>=120?['great','proud','grind','story']:mins>=70?['happy','cheer','coop','gacha']:['calm','relief','grind','ok'];
    return p[d%p.length]; };
  var itemOf=function(d){ var L=ITEMS.game.filter(function(x){ return x.img||x.cover; }); return d%4===0 ? L[(d/4)%L.length] : null; };
  var paintDay=function(cell){
    var box=$('#calDay'); if(!box || !cell) return;
    var ym=$('#calTt').textContent.match(/(\d+) 年 (\d+) 月/), d=+cell.querySelector('span').textContent;
    var over=cell.classList.contains('over'), today=cell.classList.contains('now');
    var mins=today?97:over?200+d:40+(d*37)%110, k=moodOf(mins, over, d), x=OT[k], it=today?null:itemOf(d);
    var m=document.createElement('div'); m.className='ca-more'; m.style.setProperty('--c', x.c);
    m.innerHTML='<img class="ot" src="'+STK(k)+'" alt=""><div class="mt"><b>'+(today?'今天':'那天')+'的心情 · '+x.n+'</b><small>'+x.say+'</small></div>'
      +(it?'<button class="it"><img src="'+(it.img?'assets/memories/'+it.img+'.webp':'assets/games/'+it.cover+'.webp')+'" alt=""><span>记了 1 条</span></button>'
        :'<span class="none">'+(today?'今天还没记':'那天没留藏品')+'</span>');
    box.appendChild(m); box.classList.add('rich'); box.style.setProperty('--c', x.c);
    var b=m.querySelector('.it'); if(b && openRecord) b.onclick=function(e){ e.stopPropagation(); openRecord({img:it.img, cover:it.cover, g:it.g, t:it.t, d:ym[2]+'.'+d, tags:it.tags}, b); };
    if(!R) m.animate([{opacity:0, transform:'translateY(8px)'},{opacity:1, transform:'none'}], {duration:420, easing:'cubic-bezier(.22,1,.36,1)'});
  };
  var g=$('#calGd');
  if(g){
    g.addEventListener('click', function(e){ var c=e.target.closest('.c.on'); if(c) setTimeout(function(){ paintDay(c); }, 0); });
    /* 左右滑换月 */
    var sx=null, sy=0;
    g.addEventListener('pointerdown', function(e){ sx=e.clientX; sy=e.clientY; });
    g.addEventListener('pointerup', function(e){ if(sx==null) return; var dx=e.clientX-sx, dy=e.clientY-sy; sx=null;
      if(Math.abs(dx)>50 && Math.abs(dx)>Math.abs(dy)*1.4){ var b=$(dx>0?'#calPrev':'#calNext'); if(b && !b.disabled) b.click(); } });
  }
  /* 这一段：每周时长柱 + 小獭一句话；跟着月份变 */
  var paintSum=function(){
    var s=$('#caSum'), t=$('#calTt'); if(!s||!t) return;
    var mt=t.textContent.match(/(\d+) 年 (\d+) 月/), y=+mt[1], m=+mt[2], cur=y===2026 && m===11;
    if(cur){ s.innerHTML='<div class="k">这一段 · '+m+' 月</div><div class="ca-new"><img src="'+STK('cheer')+'" alt=""><p><b>'+m+' 月才刚开始</b><small>玩了 2 天 · 共 1h 37m · 都在上限内。慢慢来，这个月的格子还空着呢</small></p></div>';
      return; }
    var seed=y*12+m, wk=[0,1,2,3,4].map(function(i){ return 3+((seed*7+i*11)%9)+((seed+i)%3)*.5; }), tot=wk.reduce(function(a,b){ return a+b; },0);
    var fix={10:{tot:41.6, g:'ys'}}[m];
    if(fix){ wk=wk.map(function(h){ return Math.round(h*fix.tot/tot*2)/2; }); tot=fix.tot; }
    var max=Math.max.apply(null, wk), mi=wk.indexOf(max), top=game(fix?fix.g:['ys','hsr','zzz','wzry'][seed%4]);
    var k=tot>40?'grind':tot>34?'proud':'happy';
    var line=tot>40?'这个月玩得挺猛，第 '+(mi+1)+' 周最上头':tot>34?'节奏稳稳的，第 '+(mi+1)+' 周玩得最多':'不紧不慢，刚刚好';
    s.innerHTML='<div class="k">这一段 · '+m+' 月<span>'+tot.toFixed(1)+' 小时</span></div>'
      +'<div class="ca-bars">'+wk.map(function(h,i){ return '<div class="w'+(i===mi?' top':'')+'" style="--h:'+Math.round(h/max*100)+'%;--i:'+i+'"><em>'+h.toFixed(1)+'h</em><i></i><span>第 '+(i+1)+' 周</span></div>'; }).join('')+'</div>'
      +'<div class="ca-say"><img src="'+STK(k)+'" alt=""><p>'+line+'<small>最常玩 <img src="assets/games/'+top[0]+'.webp" alt="">'+top[1]+' · 最长一局 3h 20m</small></p></div>';
  };
  var tt=$('#calTt'); if(tt) new MutationObserver(paintSum).observe(tt, {childList:true, characterData:true, subtree:true});
  chain('s3-calendar', function(){ paintSum(); roll($('#caHero'));
    var r=$('#caHero .ca-rec'); if(r){ r.classList.remove('go'); void r.offsetWidth; r.classList.add('go'); }
    var now=$('#calGd .c.now'); if(now && !$('#calDay .ca-more')) paintDay(now); });
  var fl=$('#caHero .ca-fl'); if(fl) fl.onclick=function(){ var p=centerOf(fl); if(!R) burst(p[0], p[1]-10, ['·','✦'], 6, 1.4); vib(8);
    tip(fl, '已经连着 12 天啦，今晚记得来打个卡', {mood:'proud', ms:2200}); };

  /* ═══ 足迹 ═══ */
  var FT_N=7*44, FT_TODAY=FT_N-11, T0=new Date(2026,10,2);
  var cellDay=function(i){ var d=new Date(T0.getTime()-(FT_TODAY-i)*864e5); return d; };
  var cellInfo=function(el, i){ var lv=+(el.className.match(/l(\d)/)||[0,0])[1], life=el.classList.contains('life');
    var dt=cellDay(i), lbl=(dt.getMonth()+1)+'.'+pad(dt.getDate())+' 周'+WK[dt.getDay()];
    if(life){ var L=ITEMS.life[i%ITEMS.life.length]; return {lbl:lbl, t:'记了一件生活小事', s:L.t||L.note, k:tagsOf(L)[0]}; }
    if(!lv) return {lbl:lbl, t:'这天歇着', s:'没开局，也挺好', k:'nap'};
    var gm=game(['ys','hsr','zzz','wzry','mrfz'][i%5]), mins=[0,35,70,120,190][lv];
    return {lbl:lbl, t:gm[1]+' · '+fm(mins+(i%30)), s:['轻轻玩了一会儿','状态正好','玩得很投入','上头了，记得休息'][lv-1], k:moodOf(mins, lv===4 && i%3===0, i), g:gm[0]};
  };
  var tagsOf=function(it){ return (it && it.tags || []).map(function(t){ return typeof t==='object'?t.k:t; }); };
  var ftTip=null;
  var showCell=function(el, i){
    var y=$('#ftYear'), info=cellInfo(el, i), x=OT[info.k]||OT.calm;
    $$('#ftYear i.sel').forEach(function(c){ c.classList.remove('sel'); }); el.classList.add('sel');
    if(!ftTip){ ftTip=document.createElement('div'); ftTip.className='fp-tip'; y.parentNode.appendChild(ftTip); }
    ftTip.style.setProperty('--c', x.c);
    ftTip.innerHTML='<img src="'+STK(info.k)+'" alt=""><div><small>'+info.lbl+'</small><b>'+info.t+'</b><span>'+info.s+'</span></div>';
    var cr=y.parentNode.getBoundingClientRect(), r=el.getBoundingClientRect(), w=232;
    var left=Math.max(8, Math.min(cr.width-w-8, r.left-cr.left+r.width/2-w/2));
    ftTip.style.left=left+'px'; ftTip.style.top=(y.offsetTop+y.offsetHeight+4)+'px'; ftTip.style.setProperty('--ax', (r.left-cr.left+r.width/2-left)+'px');
    ftTip.classList.remove('on'); void ftTip.offsetWidth; ftTip.classList.add('on'); vib(5);
  };
  var y=$('#ftYear');
  if(y){ y.parentNode.style.position='relative';
    y.addEventListener('click', function(e){ var c=e.target.closest('i'); if(!c) return; var i=[].indexOf.call(y.children, c); if(i>FT_TODAY) return; showCell(c, i); });
    y.addEventListener('scroll', function(){ if(ftTip) ftTip.classList.remove('on'); }, {passive:true}); }
  var MONTHS=[
    {m:'十月', s:'19 天 · 12 件藏品', k:'gacha', top:[['gacha',4],['great',3],['calm',2]], im:['game_gacha','game_boss','life_sunset'], best:'10.18 · 星穹铁道 3h 20m', say:'抽卡抽得最多的一个月，运气还不错'},
    {m:'九月', s:'22 天 · 9 件藏品', k:'clear', top:[['clear',3],['coop',2],['happy',2]], im:['game_city','life_friends'], best:'9.14 · 绝区零 2h 50m', say:'通关了三次，是闯关的一个月'},
    {m:'八月', s:'17 天 · 7 件藏品', k:'night', top:[['night',3],['grind',2],['cry',1]], im:['life_rain'], best:'8.09 · 原神 4h 05m', say:'暑假第一次超时，小獭记着呢'}
  ];
  var paintMonths=function(){
    var box=$('#fpMonths'); if(!box || box.dataset.al) return; box.dataset.al=1;
    box.innerHTML=MONTHS.map(function(x, i){
      return '<div class="fp-mo" style="--c:'+OT[x.k].c+'"><div class="rw" role="button"><img class="xf" src="'+STK(x.k, false)+'" alt=""><span class="l">'+x.m+'<small>'+x.s+' · 贴得最多的是「'+OT[x.k].n+'」</small></span><span class="r">›</span></div>'
        +'<div class="fp-ex"><div><div class="fp-tops">'+x.top.map(function(t){ return '<span><img src="'+STK(t[0], false)+'" alt="">'+OT[t[0]].n+'<b>×'+t[1]+'</b></span>'; }).join('')+'</div>'
        +'<div class="fp-ims">'+x.im.map(function(m){ return '<img src="assets/memories/'+m+'.webp" alt="">'; }).join('')+'</div>'
        +'<p><img src="'+STK(x.k)+'" alt="">'+x.say+'<small>最长的一天 '+x.best+'</small></p></div></div></div>';
    }).join('');
    $$('.fp-mo', box).forEach(function(mo){ mo.querySelector('.rw').onclick=function(){ var on=!mo.classList.contains('on');
      $$('.fp-mo', box).forEach(function(o){ o.classList.toggle('on', o===mo && on); }); if(on) pop(mo.querySelector('.xf')); vib(5); }; });
  };
  var paintMem=function(){
    var mm=$('#fpMem'); if(!mm || mm.dataset.al) return; mm.dataset.al=1;
    var it=ITEMS.life.filter(function(x){ return x.img==='life_rain'; })[0] || ITEMS.life[0];
    mm.innerHTML='<img class="cv" src="assets/memories/'+it.img+'.webp" alt=""><div class="tx"><small>10 天前 · '+it.d+'</small><b>'+it.t+'</b><span>那天你贴了「'+OT.love.n+'」</span></div><img class="ot" src="'+STK('love')+'" alt="">';
    mm.onclick=function(){ if(openRecord) openRecord(it, mm.querySelector('.cv')); };
  };
  chain('s3-foot', function(){
    paintMonths(); paintMem(); roll($('#fpHero'));
    var y=$('#ftYear'); if(!y) return; if(ftTip) ftTip.classList.remove('on');
    $$('i', y).forEach(function(c, i){ c.style.setProperty('--col', Math.floor(i/7)); });
    if(!R){ y.classList.remove('fp-in'); void y.offsetWidth; y.classList.add('fp-in'); }
  });

  /* ═══ 编辑资料：上面那张卡就是别人看到的你 ═══ */
  var pc=$('#pfCard');
  if(pc){
    var ot=$('#pfOt'), say=$('#pfSay');
    var talk=function(pool, text){ face(ot, pool); say.textContent=text; pop(say); };
    var ins=$$('#s3-profile .grp .pf-in'), nick=ins[0], bio=ins[1];
    var cnt=document.createElement('small'); cnt.className='pf-cnt'; cnt.textContent='0/30';
    if(bio){ bio.maxLength=30; bio.parentNode.appendChild(cnt); }
    if(nick) nick.maxLength=12;
    var tmr=0, calm=function(fn){ clearTimeout(tmr); tmr=setTimeout(fn, 420); };
    if(nick) nick.addEventListener('input', function(){ var v=nick.value.trim(); $('#pfCn').textContent=v||'还没名字'; $('#pfCn').classList.toggle('no', !v);
      calm(function(){ if(!v) talk(['please','think'], '起个名字吧，我好叫你'); else talk(['happy','ok','shy'], v+'，好名字～'); }); });
    if(bio) bio.addEventListener('input', function(){ var v=bio.value.trim(); $('#pfCb').textContent=v||'还没写简介'; $('#pfCb').classList.toggle('no', !v);
      cnt.textContent=bio.value.length+'/30'; cnt.classList.toggle('warn', bio.value.length>=26);
      calm(function(){ if(v) talk(['think','love','proud'], v.length>18?'写得真认真，我记住了':'嗯，很像你'); }); });
    $$('#s3-profile .grp .rw img + .l + .pf-in').forEach(function(x){ x.addEventListener('change', function(){ if(x.value.trim()) talk(['ok','cheer'], '记下了，以后分享卡上能用'); }); });
    var av=$('#pfAv'); if(av) av.addEventListener('click', function(e){ var im=e.target.closest('img'); if(!im) return;
      var cv=$('#pfCv'); cv.src=im.src; pop(cv);
      var p=centerOf(cv); if(!R) sparkle(p[0], p[1], {c:'61,220,255', n:8, r:44});
      talk(['love','shy','happy','proud'], ['这个造型好看！','换了个新样子，差点没认出来','嗯，就是这个感觉'][Math.floor(Math.random()*3)]); });
    chain('s3-profile', function(){ var on=$('#pfAv img.on'); if(on) $('#pfCv').src=on.src; face(ot, ['hi','happy']); say.textContent='这是别人看到的你'; });
  }

  /* ═══ 游戏管理：时长条 + 陪你最久的那款 ═══ */
  var HRS=function(i){ return i<8?120-i*13:0; };
  chain('s3-games', function(){
    var gm=$('#gm3'); if(!gm) return;
    if(!gm.dataset.al){ gm.dataset.al=1;
      $$('.g:not(.add)', gm).forEach(function(x, i){ var h=HRS(i); x.style.setProperty('--i', Math.min(i, 16));
        if(h){ var b=document.createElement('div'); b.className='gm-bar'; b.style.setProperty('--b', ALL[i][2]); b.innerHTML='<i style="--w:'+Math.round(h/HRS(0)*100)+'%"></i>'; x.querySelector('.hr').before(b); }
        x.addEventListener('click', function(){ var a=ALL[i]; pop(x.querySelector('.bx')); vib(5);
          tip(x.querySelector('.bx'), h?a[1]+' · 累计 '+h+' 小时，'+(i<3?'最近常玩':'有一阵没开了'):a[1]+' · 还没有记录，开一局试试', {mood:h?(i<3?'love':'think'):'hi', ms:2000}); }); });
      var top=$('#gmTop'), t3=ALL.slice(0,3);
      if(top) top.innerHTML='<div class="st">'+t3.map(function(a, i){ return '<img src="assets/games/'+a[0]+'.webp" style="--i:'+i+'" alt="">'; }).join('')+'</div>'
        +'<div class="tx"><small>陪你最久的</small><b>'+t3[0][1]+'</b><span>累计 <em data-n="'+HRS(0)+'">'+HRS(0)+'</em> 小时 · 其次是 '+t3[1][1]+'、'+t3[2][1]+'</span></div><img class="ot" src="'+STK('love')+'" alt="">';
    }
    roll($('#gmTop'));
    if(!R){ gm.classList.remove('al-in'); void gm.offsetWidth; gm.classList.add('al-in'); }
  });
};
})();
