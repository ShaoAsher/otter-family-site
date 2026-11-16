/* ═══ 草稿箱 ═══════════════════════════════════════════════════════
   发布页没发出去的内容：返回时选「存草稿」、或点右上「草稿」都会进这里；点一份回到发布页接着写，发出去后自动移除。
   只存在本机（原型里存在内存）。本文件在 v3.js 之前加载：页面 HTML 先插入，让 v3.js 统一处理头部；交互由 GtDrafts(ctx) 接上。 */
(function(){
'use strict';

/* 一份草稿：realm · 标题 · 正文 · 媒体 · 标签 · 关联的那局 id · 多久前 */
var GT_DRAFTS=[
  {id:'d1', realm:'game', title:'终于等到你', text:'90 抽小保底歪了，第二个大保底的时候手都在抖……', media:['game_gacha','game_city'], tags:['gacha','great'], sess:'s6', at:'昨天 22:14'},
  {id:'d2', realm:'life', title:'', text:'下雨天的拉面店，窗户上都是雾', media:[], tags:['calm'], sess:null, at:'3 天前'}
];
if(window.GtEmpty && GtEmpty.on('drafts')) GT_DRAFTS.length=0;
window.GT_DRAFTS=GT_DRAFTS;
window.gtDraftSave=function(d){
  var i=GT_DRAFTS.map(function(x){ return x.id; }).indexOf(d.id);
  d.at='刚刚'; if(i>=0) GT_DRAFTS.splice(i, 1);
  GT_DRAFTS.unshift(d); window.gtDraftBadge && window.gtDraftBadge(); return d;
};
window.gtDraftDel=function(id){
  var i=GT_DRAFTS.map(function(x){ return x.id; }).indexOf(id), d=null;
  if(i>=0) d=GT_DRAFTS.splice(i, 1)[0]; window.gtDraftBadge && window.gtDraftBadge(); return d;
};

var pg=document.createElement('div'); pg.className='s3'; pg.id='s3-drafts';
pg.innerHTML='<div class="bar3"><button class="ib" data-back aria-label="返回">‹</button><div class="tt">草稿箱</div><span class="act"></span></div>'
  +'<div class="bd"><div class="df-hd"><img id="dfOt" src="assets/otter/expr/anim/270/hug.webp" alt=""><div><b id="dfN">2 份没写完</b><small>写到一半的，小獭都帮你收着 · 只存在这台手机</small></div></div>'
  +'<div class="df-list" id="dfList"></div></div>';
document.body.appendChild(pg);

window.GtDrafts=function(ctx){
  var $=ctx.$, $$=ctx.$$, STK=ctx.STK, OT_EXPR=ctx.OT_EXPR, tagKey=ctx.tagKey, tagName=ctx.tagName, mediaOf=ctx.mediaOf,
    ask=ctx.ask, toast=ctx.toast, vib=ctx.vib, openS3=ctx.openS3, closeTop=ctx.closeTop, S3_HOOKS=ctx.S3_HOOKS, REDUCED=ctx.REDUCED;
  var esc=function(s){ return String(s||'').replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); };

  var card=function(d, i){
    var x=d.sess && window.gtSessById ? window.gtSessById(d.sess) : null, lb=x?window.gtSessLabel(x):null;
    var k=tagKey(d.tags[0]), mo=OT_EXPR[k], md=d.media[0]?mediaOf(d.media[0]):null;
    var cover=md?'<img src="'+md.src+'" alt="">'+(d.media.length>1?'<b>'+d.media.length+'</b>':'')
      :'<i class="q">「</i>';
    return '<div class="df-card" data-id="'+d.id+'" role="button" style="--i:'+Math.min(i,8)+(mo?';--mc:'+mo.c:'')+'">'
      +'<div class="cv'+(md?'':' txt')+'">'+cover+'</div>'
      +'<div class="tx"><b>'+(esc(d.title)||'<span class="no">还没起名字</span>')+'</b><p>'+(esc(d.text)||'<span class="no">还没写正文</span>')+'</p>'
      +'<div class="mt"><span class="rl '+d.realm+'">'+(d.realm==='game'?'游戏':'生活')+'</span>'
      +(lb?'<span class="lk"><img src="assets/games/'+x.g+'.webp" alt="">'+esc(lb.t.split(' · ')[0])+'</span>':(d.realm==='game'?'<span class="lk miss">还没关联对局</span>':''))
      +'<span class="tg">'+d.tags.map(function(t){ var kk=tagKey(t); return OT_EXPR[kk]?'<img src="'+STK(kk, false)+'" alt="'+esc(tagName(t))+'">':''; }).join('')+'</span>'
      +'<small>'+d.at+'</small></div></div>'
      +'<button class="del" aria-label="删除这份草稿"><svg viewBox="0 0 24 24"><path d="M5 7h14M9.5 7V5h5v2M7 7l1 12h8l1-12"/></svg></button></div>';
  };
  var paint=function(anim){
    var L=$('#dfList'), n=GT_DRAFTS.length;
    $('#dfN').textContent=n?n+' 份没写完':'草稿箱是空的';
    $('#dfOt').src=STK(n?'hug':'nap');
    $('#dfOt').closest('.df-hd').hidden=!n;
    L.innerHTML=n?GT_DRAFTS.map(card).join('')
      :GtEmpty.html('drafts');
    L.classList.toggle('in', !!anim && !REDUCED);
  };
  /* 发布页右上角「草稿 n」 */
  window.gtDraftBadge=function(){ var a=$('#cpDraft'); if(a) a.textContent=GT_DRAFTS.length?'草稿 '+GT_DRAFTS.length:'草稿'; };
  window.gtDraftBadge();

  S3_HOOKS['s3-drafts']=function(){ paint(true); };

  $('#dfList').addEventListener('click', function(e){
    var c=e.target.closest('.df-card'); if(!c) return; var id=c.dataset.id, d=GT_DRAFTS.filter(function(x){ return x.id===id; })[0]; if(!d) return;
    if(e.target.closest('.del')){
      ask({mood:'cry', danger:true, title:'删掉这份草稿？', body:'删了就找不回来了，小獭会有点舍不得。', ok:'删掉', no:'留着',
        onOk:function(){ c.classList.add('gone'); vib([8,30,8]);
          setTimeout(function(){ var gone=window.gtDraftDel(id); paint(false);
            toast('草稿删掉了', {act:'撤销', cb:function(){ if(gone){ GT_DRAFTS.splice(0, 0, gone); window.gtDraftBadge(); paint(false); } }}); }, 260); } });
      return; }
    /* 接着写：发布页在下面就直接回去，否则打开它；手上正在写的先存一份 */
    vib(6); c.classList.add('pick');
    var under=$('#s3-compose').classList.contains('on');
    setTimeout(function(){
      if(under){ closeTop(); } else openS3('s3-compose');
      setTimeout(function(){ if(window.cpLoad) window.cpLoad(d); }, under?60:40);
    }, REDUCED?0:180);
  });
};
})();
