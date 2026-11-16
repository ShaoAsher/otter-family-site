/* ═══════════════════════════════════════════════════════════════════
   v3 · 此刻 / 藏品 / 我 / 二级页 —— 交互
   依赖主脚本的全局：GAMES / deckIdx / deckState / tkRatio / tkMood /
   MOOD_WSPD / LiveRing / brandOf / enter / layout / deckLocked。
   每一段都自带空值保护：一段抛错不能拖垮整页。
   ═══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
var $=function(s,r){return (r||document).querySelector(s);};
var $$=function(s,r){return [].slice.call((r||document).querySelectorAll(s));};
var vib=function(n){ if(navigator.vibrate) navigator.vibrate(n); };
var REDUCED=window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
function safe(name,fn){ try{ fn(); }catch(e){ console.warn('[v3] '+name, e); } }

/* 全部 21 款（名字 + 兜底主色；真主色由 brandOf 从图标取） */
var ALL=[
  ['hsr','星穹铁道','124,140,255'],['ys','原神','232,196,120'],['zzz','绝区零','200,240,60'],
  ['wzry','王者荣耀','90,150,255'],['mrfz','明日方舟','120,200,230'],['mc','我的世界','110,200,90'],
  ['bh3','崩坏3','255,120,170'],['lolm','英雄联盟手游','90,170,255'],['valorant','无畏契约','255,80,90'],
  ['hpjy','和平精英','240,190,90'],['sky','光·遇','255,200,150'],['yys','阴阳师','200,90,90'],
  ['dnf','地下城','255,150,60'],['aqtw','暗区突围','150,170,120'],['jcc','金铲铲','255,200,80'],
  ['lkwg','洛克王国','120,200,255'],['danzai','蛋仔派对','255,170,210'],['sjzx','世界之星','170,140,255'],
  ['hyxz','火影忍者','255,140,60'],['wjdr','无尽冬日','150,210,255'],['xxle','消消乐','255,120,200']
];
/* ═══ 小獭表情登记表（唯一来源）═══════════════════════════════════
   表情 = 心情 = 标签：此刻心情、藏品标签、筛选、分享卡、反馈里的小獭，全部从这张表取。
   g 分组：mood 心情 · game 游戏 · social 社交 · life 生活 · food 美食 · trip 出行 · study 学习。
   120 枚，key 与素材来自水獭家族素材库；这张表由 tools/expr_table.py 生成（同时写 app 的 gt_expr.dart），别手改。
   assets/otter/expr  逐帧动态表情：一直播放；_s 是动图第一帧（列表与减弱动效时用），从素材库 webp/anim/270 + still/270 拷贝 */
var EXPR_GROUPS=[['mood','心情'],['game','游戏'],['social','社交'],['life','生活'],['food','美食'],['trip','出行'],['study','学习']];
var OT_EXPR={
  happy:{n:'开心', say:'开心就要大声记下来', c:'255,180,120', g:'mood'},
  laugh:{n:'大笑', say:'哈哈哈哈停不下来', c:'255,200,100', g:'mood'},
  smile:{n:'微笑', say:'嘴角偷偷翘起来了', c:'255,190,150', g:'mood'},
  cheer:{n:'欢呼', say:'耶！这一下值得欢呼', c:'110,231,168', g:'mood'},
  great:{n:'超棒', say:'爽到起飞！小獭陪你一起蹦', c:'255,210,122', g:'mood'},
  proud:{n:'骄傲', say:'哼哼，这波是我的高光', c:'255,170,90', g:'mood'},
  love:{n:'喜欢', say:'这一刻，心动了', c:'255,138,184', g:'mood'},
  shy:{n:'害羞', say:'被夸了，有点不好意思', c:'255,150,180', g:'mood'},
  calm:{n:'平静', say:'慢慢来，喝口热的', c:'120,200,255', g:'mood'},
  relief:{n:'松口气', say:'呼…总算过了，喝口水', c:'150,220,170', g:'mood'},
  sleepy:{n:'犯困', say:'困了就早点睡呀', c:'190,150,255', g:'mood'},
  nap:{n:'打盹', say:'眯一会儿，充个电', c:'150,190,255', g:'mood'},
  goodnight:{n:'晚安', say:'晚安，明天见', c:'170,150,255', g:'mood'},
  morning:{n:'早安', say:'早上好，今天也元气满满', c:'255,200,110', g:'mood'},
  cry:{n:'哭泣', say:'破防也没关系，抱抱', c:'124,140,255', g:'mood'},
  sad:{n:'难过', say:'今天有点低落，没关系', c:'130,150,210', g:'mood'},
  scared:{n:'害怕', say:'别、别过来……', c:'140,160,230', g:'mood'},
  shock:{n:'震惊', say:'等等…这也太离谱了', c:'255,220,90', g:'mood'},
  bashful:{n:'扭捏', say:'那个……就是……', c:'255,170,170', g:'mood'},
  angry:{n:'生气', say:'不服？下一局打回来', c:'255,107,44', g:'mood'},
  pout:{n:'嘟嘴', say:'哼，不理你了', c:'255,140,160', g:'mood'},
  speechless:{n:'无语', say:'……行吧', c:'160,170,200', g:'mood'},
  start:{n:'开局', say:'新的一局，冲！', c:'61,220,255', g:'game'},
  loading:{n:'加载中', say:'读条中，先喝口水', c:'150,180,230', g:'game'},
  victory:{n:'胜利', say:'赢了！奖杯拿好', c:'255,210,122', g:'game'},
  defeat:{n:'失败', say:'输了也没关系，下次稳住', c:'150,150,180', g:'game'},
  rank:{n:'上分', say:'上分，冲！', c:'255,90,110', g:'game'},
  highlight:{n:'高光', say:'这一下必须截图', c:'255,220,90', g:'game'},
  gacha:{n:'抽卡', say:'这一抽，出金吧', c:'255,210,122', g:'game'},
  queue:{n:'排队', say:'前面还有好多人……', c:'150,180,230', g:'game'},
  grind:{n:'刷本', say:'日常刷完，收工', c:'255,159,67', g:'game'},
  focus:{n:'专注', say:'先别吵，这一把很关键', c:'96,210,230', g:'game'},
  rage:{n:'暴怒', say:'手柄差点飞出去！', c:'255,80,60', g:'game'},
  win:{n:'连胜', say:'连胜中，手感火热', c:'255,150,60', g:'game'},
  lose:{n:'连败', say:'连跪了…歇一会儿吧', c:'140,150,180', g:'game'},
  pause:{n:'暂停', say:'先停一下，喘口气', c:'160,190,220', g:'game'},
  retry:{n:'重试', say:'再来一次，这次稳住', c:'124,140,255', g:'game'},
  quest:{n:'任务', say:'今日任务，接下了', c:'110,231,168', g:'game'},
  hi:{n:'打招呼', say:'嗨～小獭在这儿等你呢', c:'255,200,150', g:'social'},
  bye:{n:'再见', say:'今天就到这儿，拜拜', c:'170,180,220', g:'social'},
  ok:{n:'好的', say:'收到，马上安排', c:'110,231,168', g:'social'},
  please:{n:'拜托', say:'拜托拜托，就这一次', c:'255,190,140', g:'social'},
  thanks:{n:'谢谢', say:'谢谢你，真的', c:'255,160,180', g:'social'},
  hug:{n:'拥抱', say:'过来，给你一个抱抱', c:'255,160,170', g:'social'},
  friends:{n:'好友', say:'和朋友在一起真好', c:'190,150,255', g:'social'},
  solo:{n:'独处', say:'一个人也挺好', c:'255,180,120', g:'social'},
  coop:{n:'开黑', say:'和队友一起才好玩', c:'61,220,255', g:'social'},
  wave:{n:'挥手', say:'我在这儿，看得见吗', c:'150,210,255', g:'social'},
  salute:{n:'敬礼', say:'收到，长官！', c:'120,180,255', g:'social'},
  gg:{n:'寄了', say:'没事，下一局', c:'150,150,180', g:'social'},
  welcome:{n:'欢迎', say:'欢迎回来', c:'255,180,120', g:'social'},
  sorry:{n:'道歉', say:'对不起，是我没做好', c:'170,170,200', g:'social'},
  bath:{n:'泡澡', say:'泡一泡，什么都不想', c:'120,210,230', g:'life'},
  stroll:{n:'散步', say:'出去走走，风很舒服', c:'120,200,255', g:'life'},
  sport:{n:'运动', say:'出一身汗，舒服', c:'110,231,168', g:'life'},
  movie:{n:'看电影', say:'散场后还在想那一幕', c:'255,138,184', g:'life'},
  music:{n:'听歌', say:'这首单曲循环', c:'96,210,230', g:'life'},
  story:{n:'追剧', say:'这段剧情好戳我', c:'155,123,240', g:'life'},
  night:{n:'夜晚', say:'这么晚还在玩呀', c:'190,150,255', g:'life'},
  clear:{n:'天晴', say:'终于打过去了，天都晴了', c:'110,231,168', g:'life'},
  weekend:{n:'周末', say:'周末，彻底放松', c:'255,200,110', g:'life'},
  clean:{n:'打扫', say:'收拾干净，心情也亮了', c:'130,210,200', g:'life'},
  outfit:{n:'穿搭', say:'今天这身怎么样', c:'255,150,200', g:'life'},
  sleep:{n:'入睡', say:'盖好被子，好梦', c:'150,140,230', g:'life'},
  drink:{n:'喝水', say:'玩久了，记得喝水', c:'100,190,255', g:'life'},
  relax:{n:'放松', say:'嘘，偷偷摸一会儿', c:'130,200,230', g:'life'},
  rot:{n:'摆烂', say:'今天就躺着吧', c:'170,160,190', g:'life'},
  sick:{n:'生病', say:'不舒服就别硬撑', c:'160,200,180', g:'life'},
  rain:{n:'下雨', say:'下雨天，适合在家玩', c:'120,160,220', g:'life'},
  snow:{n:'下雪', say:'下雪啦，窗外好安静', c:'200,220,255', g:'life'},
  wind:{n:'吹风', say:'风好大，心也飘了', c:'150,210,200', g:'life'},
  birthday:{n:'生日', say:'生日快乐！许个愿吧', c:'255,150,180', g:'life'},
  celebrate:{n:'庆祝', say:'干杯！这一刻值得庆祝', c:'255,200,90', g:'life'},
  lucky:{n:'好运', say:'今天运气爆棚', c:'110,220,140', g:'life'},
  cook:{n:'下厨', say:'自己做的最香', c:'255,170,90', g:'food'},
  cafe:{n:'喝咖啡', say:'来一杯，慢慢喝', c:'200,160,120', g:'food'},
  milktea:{n:'奶茶', say:'一口下去，满血复活', c:'220,170,130', g:'food'},
  eat:{n:'干饭', say:'干饭时间到！', c:'255,180,100', g:'food'},
  burger:{n:'汉堡', say:'大口咬下去', c:'240,160,80', g:'food'},
  noodles:{n:'面条', say:'吸溜，一碗热面', c:'255,200,120', g:'food'},
  rice:{n:'米饭', say:'一碗白米饭，最踏实', c:'240,220,180', g:'food'},
  dessert:{n:'甜点', say:'甜的东西让人开心', c:'255,170,200', g:'food'},
  fruit:{n:'水果', say:'吃点水果补补', c:'140,220,120', g:'food'},
  tea:{n:'泡茶', say:'泡壶茶，慢下来', c:'150,200,140', g:'food'},
  feast:{n:'大餐', say:'今天吃顿好的', c:'255,190,80', g:'food'},
  snack:{n:'零食', say:'边玩边吃最快乐', c:'255,190,120', g:'food'},
  hungry:{n:'饿了', say:'肚子咕咕叫了', c:'255,160,100', g:'food'},
  yum:{n:'好吃', say:'好吃到眯眼', c:'255,150,150', g:'food'},
  travel:{n:'出行', say:'说走就走', c:'110,231,168', g:'trip'},
  hike:{n:'徒步', say:'一步一步，往上走', c:'130,190,140', g:'trip'},
  beach:{n:'海边', say:'听海浪的声音', c:'100,200,240', g:'trip'},
  mountain:{n:'登山', say:'登顶啦！', c:'120,170,150', g:'trip'},
  city:{n:'城市', say:'在城市里逛一逛', c:'150,170,210', g:'trip'},
  photo:{n:'拍照', say:'咔嚓，留个纪念', c:'255,200,120', g:'trip'},
  souvenir:{n:'纪念品', say:'带个小东西回去', c:'255,170,150', g:'trip'},
  luggage:{n:'行李', say:'收拾行李，准备出发', c:'200,170,130', g:'trip'},
  sunset:{n:'日落', say:'晚霞好漂亮', c:'255,140,90', g:'trip'},
  camping:{n:'露营', say:'帐篷、篝火和星星', c:'255,170,90', g:'trip'},
  map:{n:'看地图', say:'下一站去哪儿', c:'120,200,180', g:'trip'},
  arrive:{n:'抵达', say:'到啦！', c:'110,220,200', g:'trip'},
  jog:{n:'跑步', say:'跑起来，风在耳边', c:'110,231,168', g:'trip'},
  stretch:{n:'拉伸', say:'伸个懒腰，舒展一下', c:'150,210,170', g:'trip'},
  yoga:{n:'瑜伽', say:'深呼吸，静下来', c:'180,160,240', g:'trip'},
  ball:{n:'球类', say:'来一场球', c:'255,170,90', g:'trip'},
  sweat:{n:'流汗', say:'汗都出来了', c:'120,200,255', g:'trip'},
  heal:{n:'康复', say:'慢慢会好起来的', c:'150,210,190', g:'trip'},
  study:{n:'学习', say:'认真起来的样子很帅', c:'120,180,255', g:'study'},
  think:{n:'思考', say:'让我想想……', c:'130,190,255', g:'study'},
  write:{n:'书写', say:'写下来就不会忘', c:'150,180,230', g:'study'},
  read:{n:'阅读', say:'翻几页，慢慢看', c:'140,170,240', g:'study'},
  busy:{n:'忙碌', say:'事情好多，一件件来', c:'255,170,90', g:'study'},
  deadline:{n:'赶截止', say:'来不及了来不及了', c:'255,110,90', g:'study'},
  done:{n:'完成', say:'搞定！打个大勾', c:'110,231,168', g:'study'},
  review:{n:'复盘', say:'回头看看，下次更好', c:'130,180,230', g:'study'},
  note:{n:'记笔记', say:'这个要记下来', c:'255,200,120', g:'study'},
  ask:{n:'提问', say:'我有个问题！', c:'130,200,255', g:'study'},
  idea:{n:'灵感', say:'灵光一闪！', c:'255,220,90', g:'study'},
  plan:{n:'计划', say:'先排个计划', c:'120,200,170', g:'study'},
  meeting:{n:'开会', say:'开会中，稍等', c:'150,170,210', g:'study'},
  overtime:{n:'加班', say:'辛苦了，早点收工', c:'150,140,220', g:'study'}
};
var EXPR_KEYS=function(g){ return Object.keys(OT_EXPR).filter(function(k){ return !g || OT_EXPR[k].g===g; }); };
/* 标签 = 表情 key，或自定义 {k:表情, n:自己起的名字} */
var tagKey=function(t){ return t && typeof t==='object' ? t.k : t; };
var tagName=function(t){ return t && typeof t==='object' && t.n ? t.n : (OT_EXPR[tagKey(t)]||{}).n||''; };
var tagsOf=function(it){ return (it && it.tags) || []; };
var mainTag=function(it){ return tagKey(tagsOf(it)[0]); };
/* STK(key, live)：live=false 给静帧，其余给动图 */
var STK=function(k, live){ return 'assets/otter/expr/'+(live===false?'still/270/':'anim/270/')+k+'.webp'; };
/* 标签胶囊：小獭表情 + 名字 */
function tagChip(t, cls, live){ var k=tagKey(t), x=OT_EXPR[k]; if(!x) return '';
  return '<span class="chip tg'+(cls?' '+cls:'')+'" data-k="'+k+'" style="--c:'+x.c+'"><img class="av" src="'+STK(k, live?undefined:false)+'" alt=""><span>'+tagName(t)+'</span></span>'; }
/* ═══ 小獭表情编排表（App `GtCast` 同一张表）══════════════════════════
   每个「场景」一池表情，按时段 / 状态挑；同一场景不连着重复。
   页面不再写死表情 key —— 想让小獭出场，先在这里给场景起个名字。
   挥手（hi / wave）只留给打招呼；think 只留给「在想」，不当万能脸。 */
var OT_POOL={
  /* 此刻 */
  home:function(h){ return h<5||h>=23?['night','sleepy','goodnight']:h<10?['morning','hi','cheer']:h<17?['happy','cheer','proud','hi']:['happy','love','hi','cheer']; },
  greet:function(h){ return h<5||h>=23?['sleepy','night']:['hi','happy','cheer']; },
  back:['welcome','hug','love'],                 /* 隔了好几天回来 */
  /* 开战：按住 → 开局 → 计时里程碑 → 接近 / 超上限 */
  charge:['focus','start'],
  start:['start','rank','focus'],
  run:['focus','grind'],
  run30:['cheer','win'], run60:['drink','stretch'], run90:['calm','relax'], run120:['please','pause'],
  near:['shock','scared'],
  over:['pout','please'],
  /* 收工：按这一局的样子 */
  doneShort:['relief','ok'], doneMid:['cheer','great','happy'], doneLong:['grind','proud'],
  doneOver:['hug','thanks'], doneNight:['goodnight','sleep'], mile:['celebrate','proud','victory'],
  /* 记忆：上一次的心情 / 战绩 */
  memoWin:['proud','win','laugh'], memoLose:['hug','gg','retry'], memoOver:['please','pout'], memoGacha:['gacha','lucky'],
  /* 反馈 */
  think:['think','loading','idea'], oops:['sorry','speechless'],
  settings:['calm','proud','relief'], weekly:['proud','happy'], foot:['love','hi','happy'],
  share:['happy','cheer','love'], aiOn:['cheer','focus','happy']
};
var OT_LAST={};
function otSrc(k, small){ return 'assets/otter/expr/'+(small?'still/270/':'anim/270/')+k+'.webp'; }
function otPick(ctx){ var p=OT_POOL[ctx]; if(typeof p==='function') p=p(new Date().getHours()); p=p||['happy'];
  var c=p.filter(function(k){ return k!==OT_LAST[ctx]; }); if(!c.length) c=p;
  var k=c[Math.floor(Math.random()*c.length)]; OT_LAST[ctx]=k; return k; }
function otPaint(root){ $$('img[data-ot]', root||document).forEach(function(im){ im.src=otSrc(otPick(im.dataset.ot)); }); }
var HOME_K='hi';
var EXPR_IMG=function(k, cls){ var x=OT_EXPR[k]; return x?'<img class="'+(cls||'xp')+'" src="'+STK(k)+'" alt="'+x.n+'">':''; };
function brandize(el, img, fallback){
  el.style.setProperty('--b', fallback);
  var go=function(){ if(window.brandOf) brandOf(img, function(c){ el.style.setProperty('--b', c); }); };
  if(img.complete) go(); else img.addEventListener('load', go);
}

/* ═══ 反馈体系（唯一入口）══════════════════════════════════════════
   toast(msg, {tone, act, cb, ms})   底部胶囊：小獭表情随语气换；带操作时有倒计时条，可下滑关掉
   tip(el, text, {mood, once, ms})   锚点气泡：指向某个元素，点哪都消失
   ask({title, body, mood, ok, no, danger, hold, onOk, onNo})  确认弹窗：不可逆操作 hold=true 按住确认
   语气 tone：ok 完成 · info 告知 · warn 提醒 · undo 可撤销 · win 高光 · oops 出错 · love 温柔 */
/* 语气 → 表情池（编排表里的 t_*），不再一个语气钉死一张脸 */
OT_POOL.t_ok=['happy','ok','smile']; OT_POOL.t_info=['calm','note','hi']; OT_POOL.t_warn=['shock','scared'];
OT_POOL.t_undo=['relief','ok']; OT_POOL.t_win=['great','cheer','celebrate']; OT_POOL.t_oops=OT_POOL.oops; OT_POOL.t_love=['love','hug'];
var TONE_VIB={ok:8, info:0, warn:[10,40,10], undo:12, win:[8,30,14], oops:[20,40,20], love:6};
var toastT=null;
function guessTone(m){
  if(/上限|超过|不能|先收工|失败|没有/.test(m)) return 'warn';
  if(/彩蛋|多了|建好|收进|导出|开战/.test(m)) return 'win';
  if(/复制|存好|存到|已|好了|更新/.test(m)) return 'ok';
  return 'info';
}
/* 长句自动分成"主句 + 补充"两层：第一个逗号/句号前是结论，后面降一级 */
function toastSplit(m, sub){
  if(sub) return [m, sub];
  if(m.length<=14) return [m, ''];
  var i=m.search(/[，。；·]/);
  return (i>=4 && i<m.length-3) ? [m.slice(0,i), m.slice(i+1).trim()] : [m, ''];
}
function toast(msg, a, b){
  var t=$('#toast3'); if(!t) return;
  var o=(a && typeof a==='object')?a:{act:a, cb:b};
  var tone=o.tone||(o.act?'undo':guessTone(msg)), ms=o.ms||Math.max(o.act?4800:2800, 1600+String(msg).length*120);
  clearTimeout(t._byeT); var was=t.classList.contains('on') && !t.classList.contains('bye');
  t.className='toast3 '+tone+(o.act?' has-act':'');
  var parts=toastSplit(String(msg), o.sub);
  $('#toast3T').textContent=parts[0]; $('#toast3S').textContent=parts[1];
  var m=$('#toast3M'), mk=o.mood||otPick('t_'+tone); if(m.getAttribute('src')!==STK(mk)) m.src=STK(mk);
  var act=$('#toast3A'); act.textContent=o.act||'';
  act.onclick=function(e){ e.stopPropagation(); hide(); vib(8); if(o.cb) o.cb(); };
  var bar=$('#toast3B'); bar.style.setProperty('--ms', ms+'ms');
  void t.offsetWidth; t.classList.add('on'); if(was) t.classList.add('bump');
  if(TONE_VIB[tone]) vib(TONE_VIB[tone]);
  if(tone==='win' || tone==='love') setTimeout(function(){ var c=centerOf(m); sparkle(c[0], c[1]-6, {c:getComputedStyle(t).getPropertyValue('--tc').trim(), n:7, r:40}); }, 260);
  clearTimeout(toastT); toastT=setTimeout(hide, ms);
  function hide(){ clearTimeout(toastT); if(!t.classList.contains('on')) return;
    t.classList.remove('bump'); t.classList.add('bye');
    t._byeT=setTimeout(function(){ t.classList.remove('on','bye'); }, 260); }
  t._hide=hide;
}
window.v3toast=toast;
/* 反馈层必须是 body 的直接子节点：二级页在另一个层叠上下文里，z-index 再高也盖不过 */
safe('fb-layer', function(){ ['toast3','dlg3','tip3'].forEach(function(id){ var el=document.getElementById(id); if(el) document.body.appendChild(el); }); });
safe('toast-swipe', function(){
  var t=$('#toast3'), y0=null, dy=0; if(!t) return;
  t.addEventListener('pointerdown', function(e){ if(e.target.id==='toast3A') return; y0=e.clientY; dy=0; t.style.transition='none'; });
  window.addEventListener('pointermove', function(e){ if(y0===null) return; dy=Math.max(-8, e.clientY-y0); t.style.transform='translateY('+dy+'px)'; });
  window.addEventListener('pointerup', function(){ if(y0===null) return; y0=null; t.style.transition=''; t.style.transform='';
    if(dy>28 && t._hide) t._hide(); });
});

/* 锚点提示 */
var TIP_SEEN={}, tipT=null;
function tip(el, text, o){
  o=o||{}; var t=$('#tip3'); if(!t||!el||askCur||$('.page.on > .sk-layer')) return;
  if(o.once){ if(TIP_SEEN[o.once]) return; TIP_SEEN[o.once]=1; }
  var r=el.getBoundingClientRect(); if(!r.width) return;
  t.querySelector('img').src=STK((o.mood||'happy'));
  $('#tip3T').textContent=text;
  t.classList.remove('on','below'); t.style.left='0px'; t.style.top='0px';
  var w=t.offsetWidth, h=t.offsetHeight, below=r.top < h+80;
  var x=Math.max(12, Math.min(innerWidth-w-12, r.left+r.width/2-w/2));
  t.style.left=x+'px'; t.style.top=(below? r.bottom+12 : r.top-h-12)+'px';
  t.style.setProperty('--ax', Math.max(18, Math.min(w-18, r.left+r.width/2-x))+'px');
  t.classList.toggle('below', below);
  var ring=$('#tipRing'); if(!ring){ ring=document.createElement('i'); ring.id='tipRing'; ring.className='tip-ring'; document.body.appendChild(ring); }
  var rad=parseFloat(getComputedStyle(el).borderTopLeftRadius)||12;
  ring.style.cssText='left:'+(r.left-5)+'px;top:'+(r.top-5)+'px;width:'+(r.width+10)+'px;height:'+(r.height+10)+'px;border-radius:'+(rad+5)+'px';
  void t.offsetWidth; t.classList.add('on'); ring.classList.add('on');
  clearTimeout(tipT); tipT=setTimeout(tipHide, o.ms||Math.max(3600, 1800+text.length*130));
}
function tipHide(){ clearTimeout(tipT); var t=$('#tip3'), r=$('#tipRing'); if(t) t.classList.remove('on'); if(r) r.classList.remove('on'); }
window.v3tip=tip;
document.addEventListener('pointerdown', function(){ var t=$('#tip3'); if(t && t.classList.contains('on')) tipHide(); }, true);

/* 确认弹窗 */
var askCur=null;
function ask(o){
  var d=$('#dlg3'); if(!d) return; askCur=o; clearTimeout(d._o); clearTimeout(d._t);
  tipHide();
  var mood=o.mood||(o.danger?'cry':'calm');
  d.style.setProperty('--mc', (OT_EXPR[mood]||OT_EXPR.calm).c);
  $('#dlgOt').src=STK(mood);
  $('#dlgT').textContent=o.title||'确定吗？';
  $('#dlgP').textContent=o.body||''; $('#dlgP').hidden=!o.body;
  $('#dlgOkT').textContent=o.ok||'确定';
  $('#dlgNo').textContent=o.no||'再想想';
  $('#dlgAlt').hidden=!o.alt; $('#dlgAlt').textContent=o.alt||'';
  var ok=$('#dlgOk'); ok.classList.toggle('danger', !!o.danger); ok.classList.toggle('hold', !!o.hold);
  $('#dlgHint').textContent=o.hold?'按住按钮 1 秒确认，松手就取消':''; $('#dlgHint').classList.remove('hi');
  d.classList.remove('out','out-ok','out-no','phew','holding'); d.classList.toggle('danger', !!o.danger);
  d.classList.add('on'); vib(o.danger?[8,30,8]:6);
}
function askClose(okd){
  var d=$('#dlg3'), o=askCur; if(!d||!o) return; askCur=null;
  var wait=okd?240:420;
  if(!okd && o.danger && !REDUCED){ $('#dlgOt').src=STK('relief'); $('#dlgT').textContent='呼…还好还好'; d.classList.add('phew'); }
  d._o=setTimeout(function(){ d.classList.add('out', okd?'out-ok':'out-no'); }, okd?0:180);
  d._t=setTimeout(function(){ d.classList.remove('on','out','out-ok','out-no','phew','holding'); }, wait);
  if(okd){ if(o.onOk) setTimeout(o.onOk, 120); } else if(o.onNo) o.onNo();
}
window.v3ask=ask;
safe('ask', function(){
  var d=$('#dlg3'), ok=$('#dlgOk'); if(!d) return;
  $('#dlgBack').onclick=function(){ askClose(false); };
  $('#dlgNo').onclick=function(){ askClose(false); };
  /* 第三个选项（可选）：文字钮，走「取消」的退场但执行 onAlt，比如「不保存，直接离开」 */
  $('#dlgAlt').onclick=function(){ var o=askCur; if(!o) return; var f=o.onAlt; o.onNo=null; askClose(false); if(f) setTimeout(f, 120); };
  var holdT=null, t0=0;
  var cancelHold=function(early){ if(!ok.classList.contains('holding')) return; ok.classList.remove('holding'); d.classList.remove('holding'); clearTimeout(holdT);
    if(early && performance.now()-t0<900){ ok.classList.remove('nudge'); void ok.offsetWidth; ok.classList.add('nudge'); $('#dlgHint').classList.add('hi'); vib(14); } };
  ok.addEventListener('pointerdown', function(){ if(!askCur || !askCur.hold) return;
    t0=performance.now(); ok.classList.add('holding'); d.classList.add('holding'); vib(6);
    holdT=setTimeout(function(){ ok.classList.remove('holding'); d.classList.remove('holding'); ok.classList.add('done'); vib([10,30,20]);
      var c=centerOf(ok); sparkle(c[0], c[1], {c:'255,90,110', n:8, r:56});
      setTimeout(function(){ ok.classList.remove('done'); askClose(true); }, 260); }, 900); });
  ok.addEventListener('pointerup', function(){ cancelHold(true); });
  ok.addEventListener('pointerleave', function(){ cancelHold(true); });
  ok.addEventListener('click', function(){ if(askCur && !askCur.hold) askClose(true); });
  document.addEventListener('keydown', function(e){ if(e.key==='Escape' && askCur) askClose(false); });
});

/* ── 打字机（小獭说话） ──────────────────────────────────────── */
var typeT=null;
function typeInto(el, text, speed){
  if(!el) return; clearInterval(typeT); var i=0; el.textContent='';
  if(REDUCED){ el.textContent=text; return; }
  typeT=setInterval(function(){ el.textContent=text.slice(0, ++i); if(i>=text.length) clearInterval(typeT); }, speed||42);
}

/* ── 情绪工具：飞行 / 粒子 / 彩纸 ────────────────────────────── */
/* 从 a 元素飞到 b 元素（保持 cover 裁切，用 left/top/width/height 插值；只用于低频瞬间） */
function fly(a, b, src, opt, done){
  if(REDUCED || !a || !b){ if(done) done(); return; }
  var ra=a.getBoundingClientRect(), rb=b.getBoundingClientRect(); opt=opt||{};
  var g=document.createElement('img'); g.className='fly3'; g.src=src||a.currentSrc||a.src;
  var r0=getComputedStyle(a).borderRadius||'16px', r1=opt.radius||getComputedStyle(b).borderRadius||'16px';
  document.body.appendChild(g);
  var midY=Math.min(ra.top,rb.top)-(opt.arc||0);
  var kf=[{left:ra.left+'px',top:ra.top+'px',width:ra.width+'px',height:ra.height+'px',borderRadius:r0}];
  if(opt.arc) kf.push({left:(ra.left+rb.left)/2+'px',top:midY+'px',width:(ra.width+rb.width)/2*1.15+'px',height:(ra.height+rb.height)/2*1.15+'px',borderRadius:r0,transform:'rotate(-8deg)',offset:.5});
  kf.push({left:rb.left+'px',top:rb.top+'px',width:rb.width+'px',height:rb.height+'px',borderRadius:r1,transform:'rotate(0)'});
  var an=g.animate(kf,{duration:opt.ms||520, easing:'cubic-bezier(.2,0,0,1)', fill:'forwards'});
  an.onfinish=function(){ if(done) done(); setTimeout(function(){ g.remove(); }, opt.hold||0); };
}
/* 从 (x,y) 往上飘一把字符粒子 */
function burst(x, y, chars, n, spread){
  if(REDUCED) return;
  for(var i=0;i<(n||6);i++){ (function(){
    var p=document.createElement('span'); p.className='pt3'; p.textContent=chars[Math.floor(Math.random()*chars.length)];
    p.style.left=x+'px'; p.style.top=y+'px'; document.body.appendChild(p);
    var a=-Math.PI/2+(Math.random()-.5)*(spread||1.8), d=50+Math.random()*70, dx=Math.cos(a)*d, dy=Math.sin(a)*d;
    p.animate([
      {transform:'translate(-50%,-50%) scale(.3)', opacity:0},
      {transform:'translate(calc(-50% + '+dx*.55+'px), calc(-50% + '+dy*.55+'px)) scale(1.15)', opacity:1, offset:.3},
      {transform:'translate(calc(-50% + '+dx+'px), calc(-50% + '+(dy-34)+'px)) scale(.7) rotate('+(Math.random()*40-20)+'deg)', opacity:0}
    ],{duration:900+Math.random()*500, easing:'cubic-bezier(.2,0,0,1)'}).onfinish=function(){ p.remove(); };
  })(); }
}
/* Duolingo 式彩纸：只给"站上领奖台""发布成功"这种低频高光 */
function confetti(x, y, n){
  if(REDUCED) return;
  var pal=['#3DDCFF','#9B7BF0','#FF6B2C','#FFD27A','#FF8AB8','#6EE7A8'];
  for(var i=0;i<(n||18);i++){ (function(){
    var c=document.createElement('i'); c.className='cf3'; c.style.background=pal[Math.floor(Math.random()*pal.length)];
    c.style.left=x+'px'; c.style.top=y+'px'; document.body.appendChild(c);
    var dx=(Math.random()-.5)*260, up=-(80+Math.random()*120), fall=160+Math.random()*160, rot=Math.random()*720-360;
    c.animate([
      {transform:'translate(0,0) rotate(0)', opacity:1},
      {transform:'translate('+dx*.6+'px,'+up+'px) rotate('+rot*.5+'deg)', opacity:1, offset:.35},
      {transform:'translate('+dx+'px,'+fall+'px) rotate('+rot+'deg)', opacity:0}
    ],{duration:1300+Math.random()*600, easing:'cubic-bezier(.2,.6,.4,1)'}).onfinish=function(){ c.remove(); };
  })(); }
}
function centerOf(el){ var r=el.getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2]; }

/* 星光绽放：一圈光环 + 打着旋往外飞、会眨眼的四角星 + 细碎光点。o.c 主色 'r,g,b' */
var SPK_SVG='<svg viewBox="0 0 24 24"><path d="M12 0C13 7 17 11 24 12C17 13 13 17 12 24C11 17 7 13 0 12C7 11 11 7 12 0Z"/></svg>';
function sparkle(x, y, o){
  if(REDUCED || !Element.prototype.animate) return;
  o=o||{}; var c=o.c||'61,220,255', n=o.n||9, R=o.r||64;
  var pal=['rgb('+c+')','rgb('+c+')','#FFFFFF','#FFE6A0'];
  var add=function(el){ el.style.left=x+'px'; el.style.top=y+'px'; document.body.appendChild(el); return el; };
  var ring=add(document.createElement('i')); ring.className='spk-ring'; ring.style.setProperty('--c', c);
  ring.animate([{transform:'translate(-50%,-50%) scale(.2)', opacity:.9, borderWidth:'3px'},
    {transform:'translate(-50%,-50%) scale('+(R/22)+')', opacity:0, borderWidth:'.5px'}],
    {duration:620, easing:'cubic-bezier(.15,.7,.3,1)'}).onfinish=function(){ ring.remove(); };
  var core=add(document.createElement('i')); core.className='spk-core'; core.style.setProperty('--c', c);
  core.animate([{transform:'translate(-50%,-50%) scale(.4)', opacity:1},{transform:'translate(-50%,-50%) scale(1.8)', opacity:0}],
    {duration:420, easing:'ease-out'}).onfinish=function(){ core.remove(); };
  var swirl=o.dir||(Math.random()<.5?-1:1);
  for(var i=0;i<n;i++){ (function(i){
    var s=add(document.createElement('i')); s.className='spk'; s.innerHTML=SPK_SVG;
    var sz=7+Math.random()*9; s.style.width=s.style.height=sz+'px'; s.style.color=pal[i%pal.length];
    var a=(i/n)*Math.PI*2+(Math.random()-.5)*.5, d=R*(.55+Math.random()*.55);
    var dx=Math.cos(a)*d, dy=Math.sin(a)*d*(Math.sin(a)>0?.55:1);
    var px=-Math.sin(a)*d*.35*swirl, py=Math.cos(a)*d*.35*swirl, rot=swirl*(120+Math.random()*160);
    var T=function(k,sc,r){ return 'translate(calc(-50% + '+k[0]+'px), calc(-50% + '+k[1]+'px)) scale('+sc+') rotate('+r+'deg)'; };
    s.animate([
      {transform:T([0,0],0,0), opacity:0},
      {transform:T([dx*.45+px,dy*.45+py],1.35,rot*.35), opacity:1, offset:.28},
      {transform:T([dx*.8+px*.5,dy*.8+py*.5],.55,rot*.6), opacity:.85, offset:.52},
      {transform:T([dx*.95,dy*.95+4],1.05,rot*.8), opacity:1, offset:.7},
      {transform:T([dx,dy+14],0,rot), opacity:0}
    ],{duration:900+Math.random()*450, delay:i*18, easing:'cubic-bezier(.2,.7,.3,1)', fill:'backwards'}).onfinish=function(){ s.remove(); };
  })(i); }
  for(var j=0;j<6;j++){ (function(){
    var p=add(document.createElement('i')); p.className='spk-dot'; p.style.background=p.style.color=pal[Math.floor(Math.random()*pal.length)];
    var a=Math.random()*Math.PI*2, d=R*(1+Math.random()*.5);
    p.animate([{transform:'translate(-50%,-50%) scale(1)', opacity:1},
      {transform:'translate(calc(-50% + '+Math.cos(a)*d+'px), calc(-50% + '+(Math.sin(a)*d*.7+10)+'px)) scale(.2)', opacity:0}],
      {duration:560+Math.random()*240, easing:'cubic-bezier(.1,.8,.3,1)'}).onfinish=function(){ p.remove(); };
  })(); }
}
window.v3sparkle=sparkle;

/* ═══ GtTabs：全局页签/分段钮公共组件 ═══════════════════════════════
   容器加 data-tabs（值 realm = 游戏/生活这种大切换，会多一层颜色晕染），
   子项可带 data-peek（小獭候选池：逗号分隔的 key，或 @game / @life / @mood 取整组；每次随机，不重复最近三次）、data-c（主色）。切换时五个层次：
   滑块挤压拉伸滑过去并扫一道光 → 小獭从页签上沿探头 → 星光绽放 →
   旧页签往反方向轻轻一让 → 新页签果冻回弹。业务只管改 .on，动效由这里接管 */
function tabItems(g){ return [].filter.call(g.children, function(c){ return !c.classList.contains('pill') && !c.classList.contains('sep') && c.tagName!=='IMG'; }); }
function tabIdx(g){ var it=tabItems(g); for(var i=0;i<it.length;i++) if(it[i].classList.contains('on')) return i; return -1; }
var PEEK_RECENT=[];
function peekPick(spec){
  var pool=[];
  String(spec||'').split(',').forEach(function(s){ s=s.trim();
    if(s.charAt(0)==='@') pool=pool.concat(EXPR_KEYS().filter(function(k){ return OT_EXPR[k].g===s.slice(1); }));
    else if(OT_EXPR[s]) pool.push(s); });
  if(!pool.length) return null;
  var fresh=pool.filter(function(k){ return PEEK_RECENT.indexOf(k)<0; }); if(!fresh.length) fresh=pool;
  var k=fresh[Math.floor(Math.random()*fresh.length)];
  PEEK_RECENT.push(k); if(PEEK_RECENT.length>3) PEEK_RECENT.shift();
  return k;
}
function tabPeek(on, spec){
  var key=peekPick(spec); if(!key) return;
  var r=on.getBoundingClientRect(), sz=Math.round(Math.min(56, Math.max(40, r.height*1.25)));
  var box=document.createElement('div'); box.className='tab-peek';
  box.style.cssText='left:'+(r.left+r.width/2-sz/2)+'px;top:'+(r.top-sz+3)+'px;width:'+sz+'px;height:'+sz+'px';
  box.innerHTML='<img src="'+STK(key)+'" alt="">';
  document.body.appendChild(box); setTimeout(function(){ box.remove(); }, 1450);
}
function tabFx(g, prev){
  var it=tabItems(g), cur=tabIdx(g), on=it[cur]; if(!on) return;
  var dir=prev<0?1:(cur>prev?1:-1), c=on.dataset.c||g.dataset.c||'61,220,255';
  var pill=g.querySelector(':scope > .pill'), pseudo=!pill && g.classList.contains('ntv');
  if(prev>=0 && prev!==cur && (pill||pseudo)){
    var from=pseudo?prev*it[0].offsetWidth:it[prev].offsetLeft-pill.offsetLeft, to=pseudo?cur*it[0].offsetWidth:on.offsetLeft-pill.offsetLeft;
    var kf=[{transform:'translateX('+from+'px)'},
      {transform:'translateX('+(from+(to-from)*.45)+'px) scaleX(1.24) scaleY(.84)', offset:.36},
      {transform:'translateX('+(to+dir*6)+'px) scaleX(.93) scaleY(1.07)', offset:.7},
      {transform:'translateX('+(to-dir*1.5)+'px) scaleX(1.01) scaleY(.99)', offset:.86},
      {transform:'translateX('+to+'px)'}];
    try{ (pseudo?g:pill).animate(kf, pseudo?{duration:560, easing:'cubic-bezier(.3,.7,.3,1)', pseudoElement:'::before'}:{duration:560, easing:'cubic-bezier(.3,.7,.3,1)'}); }catch(err){}
  }
  var shine=pill||on; shine.classList.remove('tab-shine'); void shine.offsetWidth; shine.classList.add('tab-shine');
  setTimeout(function(){ shine.classList.remove('tab-shine'); }, 1000);
  on.animate([{transform:'scale(.9, 1.08)'},{transform:'scale(1.08, .94)', offset:.4},{transform:'scale(.98, 1.02)', offset:.7},{transform:'none'}],
    {duration:520, easing:'cubic-bezier(.34,1.45,.64,1)'});
  if(prev>=0 && it[prev] && prev!==cur) it[prev].animate([{transform:'none'},{transform:'translateX('+(-dir*4)+'px) scale(.96)', offset:.35},{transform:'none'}],
    {duration:420, easing:'ease-out'});
  if(on.dataset.peek) tabPeek(on, on.dataset.peek);
  var p=centerOf(on); sparkle(p[0], p[1], {c:c, dir:dir, n:g.dataset.tabs==='realm'?11:8, r:g.dataset.tabs==='realm'?72:54});
  if(g.dataset.tabs==='realm'){ var ink=document.createElement('i'); ink.className='realm-ink'; ink.style.setProperty('--ink-c', c);
    ink.style.left=p[0]+'px'; ink.style.top=p[1]+'px'; document.body.appendChild(ink); setTimeout(function(){ ink.remove(); }, 900); }
}
safe('gt-tabs', function(){
  var pick=function(e){ var g=e.target.closest('[data-tabs]'); if(!g) return null;
    var b=e.target; while(b && b.parentElement!==g) b=b.parentElement;
    return (b && tabItems(g).indexOf(b)>=0)?[g,b]:null; };
  document.addEventListener('click', function(e){ var m=pick(e); if(m) m[0]._prev=tabIdx(m[0]); }, true);
  document.addEventListener('click', function(e){ var m=pick(e); if(!m) return; var g=m[0], b=m[1];
    if(g.hasAttribute('data-auto')) tabItems(g).forEach(function(x){ x.classList.toggle('on', x===b); });
    if(REDUCED || !Element.prototype.animate) return;
    if(tabIdx(g)===g._prev){ b.animate([{transform:'scale(.94)'},{transform:'scale(1.03)', offset:.6},{transform:'none'}], {duration:300, easing:'cubic-bezier(.34,1.45,.64,1)'}); return; }
    tabFx(g, g._prev);
  });
});
window.v3tabs=tabFx;

/* ═══ 二级页 ═══════════════════════════════════════════════════════ */
var stack=[];
function openS3(id){
  var s=document.getElementById(id); if(!s) return;
  s.style.zIndex=String(90+stack.length); s.scrollTop=0;
  s.classList.add('on'); stack.push(s); vib(6);
  var hook=S3_HOOKS[id]; if(hook) safe('hook '+id, hook);
  riseIn(s, id==='s3-record'?null:'.bd > *');
  if(!REDUCED){ s.classList.remove('nav-in'); void s.offsetWidth; s.classList.add('nav-in');
    clearTimeout(s._navT); s._navT=setTimeout(function(){ s.classList.remove('nav-in'); }, 800); }
}
/* ═══ GtNavBar：全局二级页头部统一 ═════════════════════════════════
   左：圆形图标钮（返回 = 左箭头 / 关闭 = 叉）；中：17px 标题；右：胶囊文字钮或圆形图标钮，空位占位保持标题居中。
   滚动后转实底 + 发丝线，底边一条渐变进度线跟着读到哪；按返回时箭头往回一闪 */
var NAV_IC={
  back:'<svg viewBox="0 0 24 24"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>',
  close:'<svg viewBox="0 0 24 24"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
  plus:'<svg viewBox="0 0 24 24"><path d="M12 5.5v13M5.5 12h13"/></svg>'
};
safe('nav-bars', function(){
  $$('.s3 .bar3').forEach(function(b){
    var bk=b.querySelector('.ib');
    if(bk){ var cls=bk.id==='cpClose'||/✕|×/.test(bk.textContent); bk.innerHTML=cls?NAV_IC.close:NAV_IC.back; bk.classList.add('nav-b', cls?'is-x':'is-back'); }
    var a=b.querySelector('.act');
    if(a){ var t=a.textContent.trim();
      if(!t) a.classList.add('empty');
      else if(t==='＋' || t==='+'){ a.innerHTML=NAV_IC.plus; a.classList.add('ico'); a.setAttribute('aria-label','新建'); }
      else a.classList.add('pill'); }
    if(!b.querySelector('.bar-prog')){ var p=document.createElement('i'); p.className='bar-prog'; b.appendChild(p); }
  });
  $$('.s3').forEach(function(s){ if(s.id==='s3-record') return; var bar=s.querySelector('.bar3'); if(!bar) return;
    s.addEventListener('scroll', function(){ var y=s.scrollTop, max=s.scrollHeight-s.clientHeight;
      bar.classList.toggle('scrolled', y>6); bar.style.setProperty('--sp', max>40?Math.min(1, y/max):0); }, {passive:true}); });
  document.addEventListener('pointerdown', function(e){ var b=e.target.closest('.nav-b'); if(!b || REDUCED) return;
    var sv=b.querySelector('svg'); if(sv) sv.animate(b.classList.contains('is-x')?[{transform:'none'},{transform:'rotate(90deg) scale(.8)'}]:[{transform:'none'},{transform:'translateX(-4px)'}],
      {duration:220, easing:'cubic-bezier(.3,.7,.3,1)', fill:'forwards'}); }, true);
  document.addEventListener('pointerup', function(){ $$('.nav-b svg').forEach(function(sv){ sv.getAnimations().forEach(function(a){ a.cancel(); }); }); }, true);
});
/* 进二级页 / 弹层：内容块跟在滑入后面依次浮起，和游戏/生活切换同一条弹簧曲线 */
function riseIn(box, sel){
  if(REDUCED || !sel) return;
  var kids=$$(sel, box).filter(function(el){ return el.offsetParent!==null; }).slice(0, 10);
  kids.forEach(function(el,i){ el.style.setProperty('--ri', i); });
  box.classList.remove('rise'); void box.offsetWidth; box.classList.add('rise');
  clearTimeout(box._riseT); box._riseT=setTimeout(function(){ box.classList.remove('rise'); }, 1100);
}
function closeTop(){ var s=stack.pop(); if(!s) return; s.classList.remove('on');
  tipHide();
  $$('video', s).forEach(function(v){ v.pause(); });
  if(s.classList.contains('zoom')) setTimeout(function(){ s.classList.remove('zoom'); }, 300); }
window.openS3=openS3; window.closeTop=closeTop;
safe('ot-paint', function(){ HOME_K=otPick('home'); otPaint(); });
document.addEventListener('click', function(e){
  var b=e.target.closest('[data-back]'); if(b){ closeTop(); return; }
  var o=e.target.closest('[data-s3]');
  if(o){
    if(o.classList.contains('h3-streak')){ var c=centerOf(o); burst(c[0],c[1],['✦','✧'],7,1.4);
      setTimeout(function(){ openS3(o.dataset.s3); }, 260); return; }
    openS3(o.dataset.s3); return; }
  var g=e.target.closest('[data-goto]'); if(g && window.enter){ while(stack.length) closeTop(); enter(g.dataset.goto); }
});
$$('[data-sw3]').forEach(function(s){ s.addEventListener('click', function(){ s.classList.toggle('on'); vib(5); }); });
/* 选中类小控件（筛选胶囊、分段钮、表情格）统一一个轻弹，手感和游戏/生活切换一致 */
document.addEventListener('click', function(e){
  if(REDUCED || !Element.prototype.animate) return;
  var el=e.target.closest('.chip, .g3-realm button, .xp-grid button, .pf-av > *');
  if(!el || el.closest('.g3-feat') || el.closest('[data-tabs]')) return;
  el.animate([{transform:'scale(.92)'},{transform:'scale(1.05)', offset:.55},{transform:'scale(1)'}],
    {duration:320, easing:'cubic-bezier(.34,1.45,.64,1)'});
}, true);

var S3_HOOKS={};

/* ═══ 此刻 ═════════════════════════════════════════════════════════ */
var pondRing=null, h3Sel=0;
var LINES={
  idle:['今天已经玩了 1 小时 37 分，节奏刚刚好～','想玩就去吧，我帮你看着时间。','昨天你说想推主线，今天要不要试试？','起来伸个懒腰再开局，好不好？'],
  timing:['冲呀！我在旁边帮你数着。','这一局手感不错嘛～','记得眨眨眼，屏幕会等你。'],
  warn:['快到上限啦，打完这把就收工吧？','我有点担心你的眼睛……','超啦超啦！今天就到这里好不好？']
};
var lineI=0, lastPhase='';

/* ═══ 小獭的记忆：开场白先说「上一次」═══════════════════════════════
   读三样东西：离开了几天 · 最近一条藏品的心情 · 上一局有没有超上限。
   优先级：深夜 > 好久不见 > 超上限 > 那条藏品的心情；都没有就退回日常话。
   走查用 `memo=away|over|lose|win|gacha|night` 指定一种。 */
var MEMO_DEMO=(location.search.match(/[?&]memo=(\w+)/)||[])[1], MEMO=null;
function memoLine(){
  if(MEMO) return MEMO;
  var h=new Date().getHours(), last=(ITEMS.game||[])[0]||{}, tags=tagsOf(last).map(tagKey);
  var gn=((ALL.filter(function(g){ return g[0]===last.g; })[0])||[])[1]||'那款游戏';
  var LOSE=['gg','lose','defeat','cry','rage','sad'], WIN=['victory','win','great','cheer','proud'];
  var has=function(a){ return tags.some(function(k){ return a.indexOf(k)>=0; }); };
  var s=MEMO_DEMO || (h<5||h>=23 ? 'night' : tags.indexOf('gacha')>=0 ? 'gacha' : has(LOSE) ? 'lose' : has(WIN) ? 'win' : '');
  var T={
    night:['home', '夜深了，再玩也别过 12 点半哦，我也困了……'],
    away:['back', '好久不见！上次是 4 天前打的「原神」，小屋一直给你留着灯'],
    over:['memoOver', '昨天多玩了 40 分钟，今天我们早点收，好不好？'],
    lose:['memoLose', '昨天王者连跪那几把还记得吗？今天先热热身，不急着上分'],
    win:['memoWin', '昨天三连胜收工，手感还热乎吗？'],
    gacha:['memoGacha', last.d ? last.d.replace('昨天','昨晚 ')+' 在「'+gn+'」终于出金了！今天还想再抽一发吗？' : '上次终于出金了！今天还想再抽一发吗？']
  }[s];
  MEMO = T ? {k:otPick(T[0]), t:T[1]} : {k:otPick('home'), t:LINES.idle[0]};
  return MEMO;
}
function phase(){ var s=window.deckState||'idle'; return s==='warn'?'warn':s==='timing'?'timing':'idle'; }

safe('home', function(){
  var cv=$('#h3Ring'); if(!cv || !window.LiveRing) return;
  pondRing=new LiveRing(cv,{ratio:0, stroke:4, color:'61,220,255'});
  setTimeout(function(){ pondRing.set({ratio:.54}); }, 400);

  // 日期 + 问候按时段
  var d=new Date(), h=d.getHours(), wk='日一二三四五六'[d.getDay()];
  var dt=$('#h3Date'); if(dt) dt.textContent=(d.getMonth()+1)+' 月 '+d.getDate()+' 日 · 周'+wk;
  var gr=$('#h3Greet'); if(gr) gr.innerHTML=(h<5?'夜深了':h<11?'早上好':h<14?'中午好':h<18?'下午好':'晚上好')+'，<em>旅人</em>';

  // 今天分给了谁
  setTimeout(function(){ $$('#h3Split .bar i').forEach(function(i){ i.style.width=i.dataset.w+'%'; }); }, 500);

  // 最近七天七颗火苗（以今天收尾，周一也不会只有一格）
  var days=$('#h3Days'), on=[1,1,1,1,1,1,1], ti=6, F='<svg viewBox="0 0 24 24"><path fill="#FF9F43" d="M12 2c1 3.2 4.6 5 4.6 9.6A4.6 4.6 0 0 1 12 22a6 6 0 0 1-6-6c0-3 1.8-4.6 3-6.4.3 1.8 1.2 2.8 2.2 3.2C10.6 9.2 11 5.4 12 2z"/></svg>';
  var wd='日一二三四五六', lbl=[0,1,2,3,4,5,6].map(function(k){ return wd[(d.getDay()-6+k+7)%7]; });
  if(days) lbl.forEach(function(l,i){
    var x=document.createElement('div');
    x.className='d'+(on[i]?' on':'')+(i===ti?' today':'');
    x.innerHTML='<div class="f">'+F+'</div><span>'+(i===ti?'今天':l)+'</span>';
    x.querySelector('svg').style.transitionDelay=(i*80)+'ms';
    days.appendChild(x);
  });

  // 游戏库
  var lib=$('#h3Lib');
  if(lib) ALL.slice(0,10).forEach(function(g,i){
    var x=document.createElement('div'); x.className='g'+(i===0?' on':''); x.dataset.i=i;
    x.innerHTML='<div class="bx"><img src="assets/games/'+g[0]+'.webp" alt=""></div><div class="nm">'+g[1]+'</div>';
    brandize(x.querySelector('.bx'), x.querySelector('img'), g[2]);
    x.addEventListener('click', function(){
      if(window.deckLocked && deckLocked()){ toast('正在开战中，先收工再换游戏'); return; }
      $$('.g', lib).forEach(function(n){ n.classList.toggle('on', n===x); });
      var im=x.querySelector('img'), cover=$('#h3NowImg'), cr=cover.getBoundingClientRect();
      vib(8);
      if(cr.bottom>0 && cr.top<innerHeight){
        cover.style.opacity='0';
        fly(im, cover, im.src, {arc:70, ms:560}, function(){ setNow(i, true); cover.style.opacity='';
          var c=centerOf(cover); burst(c[0],c[1],['✦','✧'],5,2.4); });
      } else setNow(i, true);
    });
    lib.appendChild(x);
  });
  var more=document.createElement('div'); more.className='g'; more.dataset.s3='s3-games';
  more.innerHTML='<div class="bx" style="display:grid;place-items:center;background:rgba(255,255,255,.05);font-size:20px;color:var(--mid)">⋯</div><div class="nm">全部</div>';
  if(lib) lib.appendChild(more);

  // 最近留下的：拍立得
  var mem=$('#h3Mem');
  [['game_gacha','终于出金了','昨天 23:41','ys','-4deg'],['life_ramen','一个人的晚饭','10.28','', '3deg'],
   ['game_boss','深渊第三次通关','10.30','hsr','-2deg'],['life_sunset','窗外的晚霞','10.26','','4deg']]
  .forEach(function(m, i){
    var mk=['great','happy','cheer','calm'][i];
    var x=document.createElement('div'); x.className='pola'; x.style.setProperty('--r',m[4]);
    x.innerHTML='<div class="ph"><img src="assets/memories/'+m[0]+'.webp" alt="">'
      +(m[3]?'<img class="gi" src="assets/games/'+m[3]+'.webp" alt="">':'')+'</div>'
      +'<div class="cp">'+m[1]+'</div><div class="dt">'+m[2]+'</div>';
    x.addEventListener('click', function(){ openRecord({img:m[0], t:m[1], g:m[3], d:m[2], tags:[mk, m[3]?['gacha','clear'][i>>1]:['solo','stroll'][i>>1]]}, x.querySelector('.ph img')); });
    if(mem) mem.appendChild(x);
  });

  // 点小獭：她跳一下 + 换一句
  var pond=$('#h3Pond');
  if(pond) pond.addEventListener('click', function(e){
    pond.classList.remove('poke'); void pond.offsetWidth; pond.classList.add('poke');
    var bowl=pond.querySelector('.bowl'), br=bowl.getBoundingClientRect();
    var rp=document.createElement('i'); rp.className='rip3';
    rp.style.left=(e.clientX-br.left)+'px'; rp.style.top=(e.clientY-br.top)+'px';
    bowl.appendChild(rp); setTimeout(function(){ rp.remove(); }, 950);
    var ph=phase(), c=centerOf(pond);
    burst(c[0], c[1]-30, ph==='warn'?['·','!','·']:['✦','✧','·'], 7);
    vib(10);
    setTimeout(function(){ otOpenChat($('#h3Otter')); }, 320);
  });
  var hb=$('#h3Bubble'); if(hb) hb.addEventListener('click', function(){ vib(6); otOpenChat($('#h3Otter')); });

  var go=$('#h3Go');
  if(go) go.addEventListener('click', function(){
    if(!(window.deckLocked && deckLocked())){ window.deckIdx=h3Sel % (window.GAMES||[1]).length; }
    enter('timer');
  });
  setNow(0, false);
  if(!(window.GtEmpty && GtEmpty.on('home'))) setTimeout(function(){ var m=memoLine(); HOME_K=m.k; typeInto($('#tw'), m.t); }, 900);

  // 拍立得：页面纵向滚 / 横向拨都会让它们轻轻一晃
  var memRow=$('#h3Mem'), lastY=scrollY, lastX=0, swT=null;
  var sway=function(v){ if(!memRow||REDUCED) return; memRow.style.setProperty('--sw', Math.max(-7,Math.min(7,v)).toFixed(1)+'deg');
    clearTimeout(swT); swT=setTimeout(function(){ memRow.style.setProperty('--sw','0deg'); }, 140); };
  addEventListener('scroll', function(){ if(document.body.dataset.page!=='home') return; sway((scrollY-lastY)*.5); lastY=scrollY; }, {passive:true});
  if(memRow) memRow.addEventListener('scroll', function(){ sway((memRow.scrollLeft-lastX)*.35); lastX=memRow.scrollLeft; }, {passive:true});
});

/* 进首页：环从 0 长出来、今日读数从 0 数上去 */
var counting=false, EH=!!(window.GtEmpty && GtEmpty.on('home'));
function introHome(){
  if(pondRing){ pondRing.p=0; }
  var td=$('#h3Today'); if(!td || REDUCED || EH) return;
  counting=true; var to=97, t0=performance.now();
  (function f(now){ var p=Math.min(1,(now-t0)/1100), m=Math.round(to*(1-Math.pow(1-p,3)));
    td.textContent=(m>=60?Math.floor(m/60)+'h ':'')+(m%60)+'m';
    if(p<1) requestAnimationFrame(f); else counting=false; })(t0);
}

function setNow(i, anim){
  h3Sel=i;
  var g=ALL[i], card=$('#h3Now'); if(!card) return;
  var img=$('#h3NowImg'); img.src='assets/games/'+g[0]+'.webp';
  $('#h3NowNm').textContent=g[1];
  $('#h3NowS').textContent=['昨天 2 局 · 平均 48m','今天 1 局 · 45m','3 天前 · 1h 10m','今天 1 局 · 52m','上周 · 2 局','上月 · 1 局'][i%6];
  card.style.setProperty('--brand', g[2]);
  img.onload=function(){ if(window.brandOf) brandOf(img,function(c){ card.style.setProperty('--brand',c); }); };
  // 主脚本的 GAMES 只有前 6 款；超出时开战页回落到第 1 张
  if(window.GAMES && i<GAMES.length) window.deckIdx=i;
  if(anim){ card.classList.remove('swap'); void card.offsetWidth; card.classList.add('swap'); }
}

/* 此刻的大小獭：待机用开场白定下的脸；开战中 / 接近 / 超上限各从编排表抽一次（同一态内不换） */
var HF={c:'', k:''};
function homeFace(ph){
  if(ph==='idle'){ HF.c=''; return HOME_K; }
  var c=ph==='warn' ? (window.tkMood==='over'?'over':'near') : 'run';
  if(HF.c!==c){ HF.c=c; HF.k=otPick(c); }
  return HF.k;
}

/* 与开战页同步：状态 / 水位 / 小獭表情 / 接着玩卡 */
function syncHome(){
  var ph=phase(), r=window.tkRatio||0, locked=ph!=='idle';
  if(EH && !locked){ if(pondRing) pondRing.set({ratio:.02, comet:false, color:'61,220,255', speed:1}); return; }
  var lv=locked?Math.max(.54,r):.54;
  var w=$('#h3Water'); if(w) w.style.setProperty('--lv', Math.min(1,lv)*0.86);
  if(pondRing) pondRing.set({ratio:lv, comet:locked,
    color: ph==='warn'?'255,59,78':locked?'255,107,44':'61,220,255',
    speed: locked?((window.MOOD_WSPD||{})[window.tkMood]||1):1});
  var ot=$('#h3Otter'), want=otSrc(homeFace(ph));
  if(ot && ot.getAttribute('src')!==want) ot.setAttribute('src', want);
  var lim=window.kWaterLimitHours||3, used=locked?lv*lim*60:97, left=Math.round(lim*60-used);
  var fm=function(m){ m=Math.max(0,Math.round(m)); return (m>=60?Math.floor(m/60)+'h ':'')+(m%60)+'m'; };
  var td=$('#h3Today'); if(td && !(counting && !locked)) td.textContent=fm(used);
  var hn=$('#h3Hint'); if(hn) hn.textContent= ph==='warn' ? (left<0?'已经超了 '+fm(-left)+'，小獭在等你收工':'只剩 '+fm(left)+'，准备收工吧')
    : locked ? '正在开战 · 还剩 '+fm(left) : '还能安心玩 '+fm(left);
  var cap=$('#h3NowCapT'), go=$('#h3Go'), s=$('#h3NowS');
  if(cap) cap.textContent= ph==='warn'?'接近上限':locked?'开战中':'接着玩';
  if(go) go.textContent= locked?'回到战场':'开战';
  if(locked && s){ var tm=$('#page-timer [data-go] .tm'); if(tm) s.textContent='这一局 '+tm.textContent; }
  if(ph!==lastPhase){
    if(lastPhase) typeInto($('#tw'), LINES[ph][0]);
    lastPhase=ph;
  }
}
setInterval(function(){ safe('sync', syncHome); }, 500);

/* ═══ 藏品 ═════════════════════════════════════════════════════════ */
var ITEMS={
  game:[
    {img:'game_gacha', t:'终于出金了', d:'昨天 23:41', g:'ys', tags:['great','gacha',{k:'love', n:'十连双金'}], hl:'高光', feat:true, f:'day'},
    {img:'game_boss', t:'深渊十二层，第三次通关', d:'10.30 周四', g:'hsr', tags:['cheer','retry','clear'], h:230, f:'week'},
    {note:'排位连跪三把，先睡了。明天再说。', d:'10.29', g:'wzry', tags:['gg','rank'], f:'week'},
    {img:'game_city', t:'天台对决 · 五连胜', d:'10.28', g:'zzz', tags:['laugh','coop'], h:190, video:'0:24', f:'week'},
    {cover:'hsr', t:'主线推到第三幕', d:'10.27', g:'hsr', tags:['shock','story'], h:170, f:'month'},
    {note:'今天只做了日常，十五分钟，挺好的。', d:'10.25', g:'ys', tags:['calm','grind'], f:'month'},
    {cover:'mrfz', t:'危机合约 18 级', d:'10.22', g:'mrfz', tags:['angry','retry'], h:200, f:'month'},
    {note:'凌晨两点还在打，但真的很爽。', d:'10.21', g:'zzz', tags:['grind','night'], f:'month'},
    // 一个月前的那条（首屏 lf-day 打开的就是它）：同一条「深渊十二层」在画廊里再出现一次，排在最后
    {img:'game_boss', t:'深渊十二层，第三次通关', d:'10.09', g:'hsr', tags:['cheer','retry','clear'], h:230, f:'month'}
  ],
  life:[
    {img:'life_sunset', t:'窗外的晚霞', d:'10.31 周五', tags:['calm','stroll'], hl:'今日精选', feat:true, f:'day'},
    {img:'life_ramen', t:'一个人的晚饭', d:'10.30', tags:['happy','solo'], h:220, f:'week'},
    {note:'绕湖走了一圈，5.2 公里。风很舒服。', d:'10.29', tags:['sport','stroll'], f:'week'},
    {img:'life_friends', t:'周末桌游局', d:'10.26', tags:['laugh','friends'], h:190, live:true, f:'week'},
    {img:'life_rain', t:'雨停了，便利店还亮着', d:'10.24', tags:['love','stroll'], h:240, f:'month'},
    {note:'妈妈打电话来，聊了四十分钟。', d:'10.20', tags:['hug',{k:'love', n:'想家'}], f:'month'},
    {note:'楼下新开的咖啡店，拿铁刚好。', d:'10.19', tags:['calm','cafe'], f:'month'},
    {note:'看完电影走出来，街上还在下雨。', d:'10.18', tags:['love','movie'], f:'month'}
  ]
};
if(window.GtEmpty && GtEmpty.on('gallery')) ITEMS={game:[], life:[]};
var realm='game', when='all', tagF=null, seen={};
if(window.GtEmpty) GtEmpty.fns.galAll=function(){ when='all'; tagF=null; renderChips(); renderFall(); };
document.body.dataset.realm='game';

/* 筛选：分类（游戏 / 生活）× 时间 × 标签，三者可以叠加 */
function renderChips(){
  var box=$('#g3Chips'); if(!box) return; box.innerHTML='';
  [['all','全部'],['day','今天'],['week','本周'],['month','本月']].forEach(function(c){
    var x=document.createElement('span'); x.className='chip'+(when===c[0]?' on':''); x.textContent=c[1];
    x.onclick=function(){ if(when===c[0]) return; when=c[0]; renderChips(); renderFall(); vib(5); };
    box.appendChild(x);
  });
  var tb=$('#g3Tags'); if(!tb) return; tb.innerHTML='';
  var cnt={}; ITEMS[realm].forEach(function(it){ tagsOf(it).forEach(function(t){ var k=tagKey(t); cnt[k]=(cnt[k]||0)+1; }); });
  Object.keys(cnt).sort(function(a,b){ return cnt[b]-cnt[a]; }).forEach(function(k){
    var w=document.createElement('div'); w.innerHTML=tagChip(k, tagF===k?'on':''); var x=w.firstChild;
    x.insertAdjacentHTML('beforeend', '<small>'+cnt[k]+'</small>');
    if(tagF===k) x.querySelector('img').src=STK(k);
    x.onclick=function(){ tagF=tagF===k?null:k; tipHide(); renderChips(); renderFall(); vib(5); };
    tb.appendChild(x);
  });
  var on=tb.querySelector('.on'); if(on && on.scrollIntoView) on.scrollIntoView({block:'nearest', inline:'center', behavior:REDUCED?'auto':'smooth'});
}
function match(it){
  if(tagF && !tagsOf(it).some(function(t){ return tagKey(t)===tagF; })) return false;
  if(when==='all') return true;
  var rank={day:0,week:1,month:2}; return rank[it.f]<=rank[when];
}
var MEDIA_KIND={game_gacha:'video', game_city:'video', life_sunset:'video', game_boss:'live', life_rain:'live', life_friends:'live'};
var MEDIA_DUR={game_gacha:9, game_city:12, life_sunset:9};
var MEDIA_AR={game_boss:720/576, life_sunset:720/576, game_city:16/9, game_gacha:16/9};
var MD_IC={
  play:'<svg viewBox="0 0 24 24"><path d="M8 5.2v13.6c0 .8.9 1.3 1.6.8l10-6.8a1 1 0 0 0 0-1.6l-10-6.8C8.9 3.9 8 4.4 8 5.2z"/></svg>',
  pause:'<svg viewBox="0 0 24 24"><rect x="6.5" y="5" width="4" height="14" rx="1.4"/><rect x="13.5" y="5" width="4" height="14" rx="1.4"/></svg>',
  mute:'<svg viewBox="0 0 24 24" class="ln"><path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3zM16 9.5l5 5M21 9.5l-5 5"/></svg>',
  vol:'<svg viewBox="0 0 24 24" class="ln"><path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3zM16 9a4.5 4.5 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>',
  rot:'<svg viewBox="0 0 24 24" class="ln"><rect x="7" y="3.5" width="10" height="17" rx="2.5"/><path d="M3.5 14.5a8.5 8.5 0 0 0 5 5.5M20.5 9.5a8.5 8.5 0 0 0-5-5.5"/><path d="M8.5 20l-.3-2.6 2.5.4M15.5 4l.3 2.6-2.5-.4"/></svg>',
  full:'<svg viewBox="0 0 24 24" class="ln"><path d="M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15"/></svg>',
  replay:'<svg viewBox="0 0 24 24" class="ln"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v4h4"/></svg>'
};
function shotHtml(it){
  var gi=it.g?'<img class="gi" src="assets/games/'+it.g+'.webp" alt="">':'';
  var mt=mainTag(it), mx=mt?EXPR_IMG(mt,'mx'):'';
  var ln=tagsOf(it).slice(1,2).map(tagName)[0]||'';
  if(it.note) return '<div class="q">'+it.note+'</div><div class="meta has-mx">'+gi+'<span class="d">'+it.d+(ln?' · '+ln:'')+'</span>'+mx+'</div>';
  var src=it.img?'assets/memories/'+it.img+'.webp':'assets/games/'+it.cover+'.webp';
  var badge=it.img&&MEDIA_KIND[it.img]?mediaBadge(mediaOf(it.img)):'';
  return '<img class="ph" src="'+src+'" alt="" style="height:'+(it.h||200)+'px'+(it.cover?';filter:saturate(1.2)':'')+'">'
    +badge+gi+mx+'<div class="meta'+(mx?' has-mx':'')+'"><div class="t">'+it.t+'</div><div class="d">'+it.d+(ln?' · '+ln:'')+'</div></div>';
}
function renderFeat(){
  var f=$('#g3Feat'); if(!f) return;
  var it=ITEMS[realm].filter(function(x){return x.feat;})[0];
  f.style.display=(when==='all'&&!tagF&&it)?'':'none';
  if(!it) return;
  var key=realm+':feat';
  f.className='g3-feat fx in'+(seen[key]?'':' dev'); seen[key]=1;
  var mt=mainTag(it), sub=tagsOf(it)[1], sx=OT_EXPR[tagKey(sub)];
  f.innerHTML='<img class="bg" src="assets/memories/'+it.img+'.webp" alt="">'
    +'<div class="tag"><span class="hl">'+it.hl+'</span>'+(sx?'<span class="ln-dot" style="--c:'+sx.c+'"><i></i>'+tagName(sub)+'</span>':'')+'</div>'
    +(mt?'<div class="fmx" style="--mc:'+OT_EXPR[mt].c+'">'+EXPR_IMG(mt)+'<span>'+tagName(tagsOf(it)[0])+'</span></div>':'')
    +'<div class="meta"><div style="flex:1"><div class="d">'+it.d+'</div><div class="t">'+it.t+'</div></div>'
    +(it.g?'<img class="gi" src="assets/games/'+it.g+'.webp" alt="">':'')+'</div>';
  f.onclick=function(){ openRecord(it, f.querySelector('img.bg')); };
}
function renderFall(){
  renderFeat();
  var fall=$('#g3Fall'), cols=$$('#g3Fall .col'); if(cols.length<2) return;
  cols.forEach(function(c){ c.innerHTML=''; });
  var list=ITEMS[realm].filter(function(it){ return match(it) && !(it.feat && when==='all' && !tagF); });
  var hs=[0,0];
  fall.classList.toggle('ge-empty', !list.length);
  if(!list.length){
    // 整个分类都空 → 整页空态；只是筛选没结果 → 行内空态
    cols[0].innerHTML='<div style="grid-column:span 2">'+(!ITEMS[realm].length ? GtEmpty.html('gallery.'+realm)
      : tagF ? GtEmpty.html('gallery.tag', {k:tagF, vars:{tag:OT_EXPR[tagF].n}}) : GtEmpty.html('gallery.when'))+'</div>';
    return;
  }
  list.forEach(function(it, i){
    var x=document.createElement('div'); x.className='shot3'+(it.note?' note':'');
    var key=realm+':'+it.t+it.note;
    if(!seen[key] && !it.note) x.classList.add('dev');
    seen[key]=1;
    x.innerHTML=shotHtml(it);
    x.style.setProperty('--i', i);
    if(!REDUCED) x.classList.add('in');
    var ph=x.querySelector('.ph'); if(ph && x.classList.contains('dev')) ph.style.animationDelay=(i*110)+'ms';
    var k=hs[0]<=hs[1]?0:1; cols[k].appendChild(x); hs[k]+=(it.note?130:(it.h||200))+12;
    bindShot(x, it); it._el=x;
  });
  if(fall){ fall.classList.remove('realm-in'); void fall.offsetWidth; fall.classList.add('realm-in'); }
}
/* 点开 = 详情；长按 = 移到回收站（可撤销） */
function bindShot(x, it){
  var t=null, long=false;
  x.addEventListener('pointerdown', function(){ long=false; x.classList.add('hold');
    t=setTimeout(function(){ long=true; x.classList.remove('hold'); vib(20); trashItem(it, x); }, 600); });
  var up=function(){ clearTimeout(t); x.classList.remove('hold'); };
  x.addEventListener('pointerup', up); x.addEventListener('pointerleave', up); x.addEventListener('pointercancel', up);
  x.addEventListener('click', function(){ if(!long) openRecord(it, it.note?null:x.querySelector('.ph')); });
}
/* 游戏/生活切换 —— 一次切换五个层次：
   胶囊挤压拉伸滑过去 → 小獭举着这一侧的道具从胶囊后探头 → 颜色从按钮处晕开 →
   内容按方向退场再从另一侧错落入场 → 热力格波浪换色、数字滚动 */
function setRealm(r, quiet){
  var prev=realm, dir=r==='life'?1:-1;
  realm=r; tagF=null; when='all'; document.body.dataset.realm=r;
  $$('#g3Realm button').forEach(function(b){ b.classList.toggle('on', b.dataset.r===r); });
  var g3=$('#page-gallery'); if(g3) g3.style.setProperty('--dir', dir);
  var stage=$('#g3Fall'), foot=$('.g3-foot'), feat=$('#g3Feat'), chips=$('#g3Filter');
  var paint=function(){ renderHeat(!quiet); renderChips(); renderFall();
    [stage, chips, foot, feat].forEach(function(el){ if(!el||REDUCED) return; el.classList.remove('realm-in','realm-out'); void el.offsetWidth; el.classList.add('realm-in'); }); };
  if(!quiet && stage && !REDUCED && prev!==r){
    [stage, chips, feat].forEach(function(el){ if(el){ el.classList.remove('realm-in'); el.classList.add('realm-out'); } });
    realmFx(r, dir);
    setTimeout(paint, 200);
  } else paint();
  vib(quiet?0:[6,24,10]);
}
/* 胶囊、探头、星光、晕染交给 GtTabs；这里只补藏品页独有的数字滚动 */
function realmFx(r, dir){
  $$('#g3Realm button small').forEach(function(s){ var to=+s.textContent||0, t0=performance.now();
    (function f(now){ var p=Math.min(1,(now-t0)/520), e=1-Math.pow(1-p,3); s.textContent=Math.round(to*e); if(p<1) requestAnimationFrame(f); })(t0); });
}
/* 从详情页 / 表情馆跳回藏品，只看某个标签 */
function galleryTag(k, r){
  while(stack.length) closeTop(); if(window.enter) enter('gallery');
  setTimeout(function(){ if(r && r!==realm) setRealm(r, true);
    tagF=k; when='all'; renderChips(); renderFall();
    var c=$('#g3Tags .chip.on'); if(c && c.scrollIntoView) c.scrollIntoView({inline:'center', block:'nearest', behavior:REDUCED?'auto':'smooth'});
    toast('只看「'+OT_EXPR[k].n+'」', {tone:'info'}); }, 320);
}
window.v3publish=function(it, r){
  ITEMS[r].splice(1,0,it); seen={};
  if(window.enter) enter('gallery');
  setRealm(r, true);
  setTimeout(function(){
    var card=$('#g3Fall .shot3'); if(!card) return;
    card.classList.add('fresh'); card.scrollIntoView({block:'center', behavior:REDUCED?'auto':'smooth'});
    setTimeout(function(){ var c=centerOf(card); confetti(c[0], c[1], 22); toast('收进藏品了 · 小獭帮你贴好了标签'); }, 450);
  }, 420);
};
function renderHeat(wave){
  var h=$('#g3Heat'); if(!h) return; h.innerHTML='';
  // 与 App 的 gallery_compiler 同一条算法：按 ITEMS 的日期算出 35 格热力、
  // 「这个月 N 天」、最长连续、最爱周几。写死数字会在换月 / 数据变化后和 App 对不上。
  var t=new Date(), today=new Date(t.getFullYear(),t.getMonth(),t.getDate());
  var offs=[], per={};
  ITEMS[realm].forEach(function(it){
    var d=it.d||'', off=null, m=d.match(/^(\d{1,2})\.(\d{1,2})/);
    if(/昨天/.test(d)) off=-1; else if(/今天/.test(d)) off=0;
    else if(m){ var dt=new Date(today.getFullYear(), +m[1]-1, +m[2]); if(dt>today) dt.setFullYear(dt.getFullYear()-1);
      off=Math.round((dt-today)/86400000); }
    if(off===null || off>0 || off<-400) return;
    offs.push(off); per[off]=(per[off]||0)+1;
  });
  for(var i=0;i<35;i++){ var c=per[i-34]||0, lv=c===0?0:c<=2?1:c<=4?2:3;
    var x=document.createElement('i');
    x.className=(lv?'l'+lv:'')+(wave&&!REDUCED?' wv':'');
    x.style.setProperty('--d', ((i%7)+Math.floor(i/7))*28+'ms'); h.appendChild(x); }
  // 这个月有记录的天数（同一格只算一天）
  var md=0, seenDay={};
  offs.forEach(function(o){ var d=new Date(today); d.setDate(d.getDate()+o);
    if(d.getMonth()!==today.getMonth()) return; var k=d.getDate(); if(seenDay[k]) return; seenDay[k]=1; md++; });
  // 最长连续（只看最近 31 天，和 App 一致）
  var best=0, run=0;
  for(var o2=-30;o2<=0;o2++){ if((per[o2]||0)>0){ run++; if(run>best) best=run; } else run=0; }
  // 最爱周几：按条目顺序累加，平票时留先出现的那个（同 App 的 reduce）
  var wk={}, order=[];
  offs.forEach(function(o){ var d=new Date(today); d.setDate(d.getDate()+o); var w=d.getDay();
    if(!(w in wk)){ wk[w]=0; order.push(w); } wk[w]++; });
  var bw=null; order.forEach(function(w){ if(bw===null||wk[w]>wk[bw]) bw=w; });
  var NAMES=['周日','周一','周二','周三','周四','周五','周六'];
  var n=$('#g3FootN'); if(n) n.textContent=String(md);
  var s=$('#g3FootS'); if(s) s.textContent=best===0?'这个月还空着':'最长连续 '+best+' 天 · 最爱'+(bw===null?'今天':NAMES[bw]);
}
safe('gallery', function(){
  var rb=$('#g3Realm'); if(!rb) return;
  rb.addEventListener('click', function(e){ var b=e.target.closest('button'); if(b && b.dataset.r!==realm) setRealm(b.dataset.r); });
  renderHeat(); renderChips(); renderFall();
  // 精选卡视差
  addEventListener('scroll', function(){
    if(document.body.dataset.page!=='gallery') return;
    var bg=$('#g3Feat img.bg'); if(!bg||REDUCED) return;
    var r=bg.parentElement.getBoundingClientRect(); bg.style.transform='translateY('+(r.top*-0.12).toFixed(1)+'px)';
  }, {passive:true});
});

/* ═══ 记录详情 ═════════════════════════════════════════════════════ */
var AI_REVIEW={
  game_boss:'这一局 2 小时 12 分，比你平均长了 40 分钟，但换来了第三次满星。下次可以先打上半，休息十分钟再打下半，手感会更稳。',
  game_gacha:'深夜 23 点出金，难怪这么开心！不过这周已经两次过了 23 点，明天早点开局吧。',
  _:'这一刻被你好好收藏起来了。小獭觉得，你记录生活的样子很温柔。'
};
function openRecord(it, srcEl){
  var name=ALL.filter(function(g){return g[0]===it.g;})[0];
  var src=it.img?'assets/memories/'+it.img+'.webp':it.cover?'assets/games/'+it.cover+'.webp':it.note?'':'assets/memories/life_ramen.webp';
  var heroBox=$('#s3-record .rd-hero'), hero=$('#rdImg');
  if(it.note && !it.img && !it.cover){ if(heroBox) heroBox.classList.add('note'); if(hero){ hero.removeAttribute('src'); hero.alt=''; } }
  else { if(heroBox) heroBox.classList.remove('note'); if(hero){ hero.src=src; hero.alt=it.t||''; } }
  $('#rdT').textContent=it.t||(it.note||'').slice(0,18);
  var gi=$('#rdGi'); gi.style.display=it.g?'':'none'; if(it.g) gi.src='assets/games/'+it.g+'.webp';
  var tgs=tagsOf(it), mt=mainTag(it), mo=OT_EXPR[mt];
  $('#rdGm').textContent=(name?name[1]:'生活')+(tgs[1]?' · '+tagName(tgs[1]):'');
  window.CUR_REC=it;
  var fl=$('#rdFeel');
  if(fl){ fl.style.display=mo?'':'none';
    if(mo) fl.style.setProperty('--mc', mo.c); else fl.style.removeProperty('--mc');
    fl.innerHTML=mo?'<div class="mo">'+EXPR_IMG(mt)+'<div><small>那一刻</small><b>'+tagName(tgs[0])+'</b><p>'+mo.say+'</p></div></div>':'';
    var mf=fl.querySelector('.mo'); if(mf) mf.onclick=function(){ window.EX_PICK=mt; openS3('s3-expr'); };
    fl.classList.remove('in'); void fl.offsetWidth; fl.classList.add('in'); }
  var isGame=!!it.g, st=$('#s3-record .rd-stats'), tg=$('#s3-record .rd-tags');
  var cell=function(v,l){ return '<div class="v3-card"><b>'+v+'</b><span>'+l+'</span></div>'; };
  if(st) st.innerHTML= isGame ? cell(it.dur||'2h 12m','这一局')+cell('20:12','开始')+cell((it.d||'10.30').split(' ')[0],'那天')
    : cell((it.d||'10.31').split(' ')[0],'那天')+cell('18:47','拍下')+cell(tgs.length||0,'个标签');
  if(tg){ tg.innerHTML=tgs.map(function(t){ return tagChip(t); }).join('');
    $$('.chip', tg).forEach(function(c, i){ c.style.setProperty('--i', i);
      c.onclick=function(){ galleryTag(c.dataset.k, isGame?'game':'life'); }; }); }
  var hd=$('#s3-record .rd-ai .hd2'); if(hd){ var label=hd.querySelector('span')||hd.lastChild; if(label) label.textContent= isGame?'小獭的复盘':'小獭想说'; }
  var s3=$('#s3-record'), rb=$('#s3-record .bar3');
  if(rb) rb.classList.remove('solid');
  $$('#s3-record, #s3-record .bd').forEach(function(el){ el.scrollTop=0; });
  $$('#s3-record .rd-block').forEach(function(el,i){ el.style.setProperty('--i', i); el.classList.remove('in'); void el.offsetWidth; el.classList.add('in'); });
  if(srcEl && !it.note && !REDUCED){
    s3.classList.add('zoom'); hero.style.opacity='0';
    openS3('s3-record');
    requestAnimationFrame(function(){ fly(srcEl, hero, src, {ms:460, radius:'0px', hold:60}, function(){ hero.style.opacity=''; }); });
  } else openS3('s3-record');
  heroMedia(it);
  setTimeout(function(){ typeInto($('#rdAi'), AI_REVIEW[it.img]||AI_REVIEW._, 30); }, 450);
  var hk=HERO.list[0]&&HERO.list[0].kind, htx={video:'点中间播放，拖小獭快进；右下角全屏看', live:'按住图片，看看那两秒的实况', photo:'点图片全屏看，左右滑还有更多'}[hk];
  if(!it.note && htx) setTimeout(function(){ if(stack[stack.length-1]===s3) tip($('#rdImg'), htx, {mood:'happy', once:'rd-hero-'+hk, ms:3200}); }, 1100);
}
window.openRecord=openRecord;
safe('record', function(){
  var c=$('#rdCap'); if(c) c.onclick=function(){ toast('文案已复制：「第三次站上十二层，这次很稳。」'); };
  var cp=$('#rdCopy'); if(cp) cp.onclick=function(){ var t=($('#rdT').textContent||'')+' '+($('#rdAi').textContent||'');
    if(navigator.clipboard) navigator.clipboard.writeText(t).catch(function(){}); toast('正文复制好了', {tone:'ok'}); };
  var dl=$('#rdDel'); if(dl) dl.onclick=function(){ var it=window.CUR_REC; if(!it) return;
    var mt=mainTag(it);
    ask({ mood:'cry', danger:true, ok:'放进回收站', no:'留着',
      title:'把「'+($('#rdT').textContent||'这一条')+'」放进回收站？',
      body:'它会在回收站待 30 天，后悔了随时能找回来。'+(mt?'贴着的「'+tagName(tagsOf(it)[0])+'」也会一起收着。':''),
      onOk:function(){ closeTop(); setTimeout(function(){ trashItem(it, it._el && it._el.isConnected ? it._el : null); }, 320); } }); };
  /* 滚过封面后顶栏转实底并显示标题，避免游戏名和返回键叠在一起 */
  var s3=$('#s3-record'), bar=$('#s3-record .bar3'), tt=$('#s3-record .bar3 .tt');
  var onScroll=function(e){ var y=e.target.scrollTop||0; var on=y>150;
    if(bar.classList.contains('solid')!==on){ bar.classList.toggle('solid', on); if(tt) tt.textContent=on?($('#rdT').textContent||''):''; } };
  if(s3 && bar){ s3.addEventListener('scroll', onScroll, true); }
});

/* ═══ 记一条 ═══════════════════════════════════════════════════════
   记忆点：小獭从输入框角落探头帮你写 —— 骨架闪光 → 打字 → 顺手贴好标签。
   标签 = 表情 = 心情：默认几枚常用的，「＋ 表情」能从全部表情里挑并改个名字，最多 3 枚，第一枚盖章在输入框角上。
   发布：按钮画勾 → 封面缩成一张卡飞走 → 藏品页落位发光。 */
var TAG_MAX=3;
var CP={
  game:{ media:['game_gacha','game_boss','game_city'],
    defs:['great','gacha','clear','highlight','rank','coop','grind','gg'],
    caps:[['金光亮起','金光亮起的那一秒，心跳比画面还快。',['great','gacha']],['凌晨的祭坛','凌晨的祭坛，终于等到你。',['love','gacha','night']],['写进今天','这一抽，值得写进今天。',['proud','gacha']]]},
  life:{ media:['life_ramen','life_sunset','life_rain','life_friends'],
    defs:['happy','calm','solo','stroll','friends','cafe','milktea','movie'],
    caps:[['一个人的晚饭','一个人的晚饭，也要好好吃。',['calm','solo']],['今天的奖励','热汤和冰汽水，是今天的奖励。',['happy','solo',{k:'love',n:'小确幸'}]],['碗里很安静','窗外的城市很吵，碗里很安静。',['relief','solo']]]}
};

/* 表情选择器：分组页签（全部 / 心情 / 游戏 / 生活）+ 网格；选中的那枚换成动图。发布贴标签、设心情、表情馆共用 */
function exprPicker(box, opt){
  opt=opt||{}; var cur=opt.sel||null, grp='all', mark=opt.mark||function(){ return false; };
  box.classList.add('xp');
  box.innerHTML='<div class="xp-tabs" data-tabs>'+[['all','全部']].concat(EXPR_GROUPS).map(function(g){
      return '<span class="chip'+(g[0]==='all'?' on':'')+'" data-g="'+g[0]+'">'+g[1]+'<small>'+EXPR_KEYS(g[0]==='all'?null:g[0]).length+'</small></span>'; }).join('')
    +'</div><div class="xp-grid"></div>';
  var tabs=box.querySelector('.xp-tabs'), grid=box.querySelector('.xp-grid');
  var paint=function(anim){
    grid.innerHTML=EXPR_KEYS(grp==='all'?null:grp).map(function(k, i){ var x=OT_EXPR[k], on=k===cur;
      return '<button data-k="'+k+'" class="'+(on?'on':'')+(mark(k)?' mk':'')+'" style="--i:'+Math.min(i,16)+';--mc:'+x.c+'">'
        +'<img src="'+STK(k, on?undefined:false)+'" alt="" loading="lazy"><span>'+x.n+'</span></button>'; }).join('');
    if(anim && !REDUCED){ grid.classList.remove('in'); void grid.offsetWidth; grid.classList.add('in'); }
  };
  var set=function(k){ cur=k;
    $$('button', grid).forEach(function(b){ var on=b.dataset.k===k; b.classList.toggle('on', on);
      var im=b.querySelector('img'), want=STK(b.dataset.k, on?undefined:false); if(im.getAttribute('src')!==want) im.setAttribute('src', want); }); };
  tabs.addEventListener('click', function(e){ var c=e.target.closest('.chip'); if(!c || c.dataset.g===grp) return;
    $$('.chip', tabs).forEach(function(x){ x.classList.toggle('on', x===c); }); grp=c.dataset.g; paint(true); vib(5); });
  grid.addEventListener('click', function(e){ var b=e.target.closest('button'); if(!b) return;
    set(b.dataset.k); if(opt.onPick) opt.onPick(b.dataset.k, b);
    if(b.scrollIntoView) b.scrollIntoView({block:'nearest', behavior:REDUCED?'auto':'smooth'}); });
  paint(true);
  return { set:set, repaint:function(){ paint(false); }, get:function(){ return cur; } };
}
var LIFE_LINK=['附近','附近的拉面店','今天 19:40 · 小雨 18°'];
window.cpLinkTo=null;
safe('compose', function(){
  var box=$('#cp3'); if(!box) return;
  /* cpSess：关联的那一局（游戏必选，见 link.js）；cpGuess：是不是小獭替你猜的；cpDraftId：从哪份草稿接着写 */
  var cpRealm='game', media=[], capK=0, cpSess=null, cpGuess=false, cpDraftId=null;
  var tx=$('#cpText'), tt=$('#cpTitle'), cnt=$('#cpCnt'), sp=$('#cpSpark'), cb=$('#cpBox'), pub=$('#cpPub');
  var rb=$('#s3-compose .g3-realm');

  var count=function(){ var n=tx.value.length; cnt.textContent=n+'/300'; cnt.classList.toggle('warn', n>270);
    tx.style.height='auto'; tx.style.height=Math.max(96, tx.scrollHeight)+'px'; };
  tx.addEventListener('input', count);

  /* 媒体格：点开全屏预览（可设封面 / 移除）；长按 0.32 秒拎起来拖动排序，第一张就是封面 */
  var mediaDrag=null, dragged=false;
  var renderMedia=function(){
    var m=$('#cpMedia'); m.innerHTML=''; m.classList.remove('sorting');
    media.forEach(function(f,i){ var d=document.createElement('div'), md=mediaOf(f); d.className='tile '+md.kind; d.dataset.f=f;
      d.innerHTML='<img src="'+md.src+'" alt="" draggable="false">'+mediaBadge(md)+'<span class="cv-b">封面</span><button class="x" aria-label="移除">×</button>';
      d.querySelector('.x').onclick=function(e){ e.stopPropagation(); d.classList.add('gone'); vib(6);
        setTimeout(function(){ media.splice(media.indexOf(f),1); renderMedia(); }, 240); };
      d.onclick=function(){ if(dragged){ dragged=false; return; }
        vwOpen(media.slice(), media.indexOf(f), d.querySelector('img'), {cap:media.length>1?'长按缩略图可以拖动排序':'', edit:{
          cover:function(j){ var x=media.splice(j,1)[0]; media.unshift(x); renderMedia(); },
          remove:function(j){ media.splice(j,1); renderMedia(); } }}); };
      d.addEventListener('pointerdown', function(e){ if(e.target.closest('.x') || e.button>0) return; mediaDown(e, d); });
      m.appendChild(d); });
    var pool=CP[cpRealm].media.filter(function(f){ return media.indexOf(f)<0; });
    if(media.length<9){ var a=document.createElement('div'); a.className='add';
      a.innerHTML='<b>＋</b><span style="font-size:12px">照片 / 视频 / 实况</span><small>'+media.length+' / 9</small>';
      a.onclick=function(){ if(!pool.length){ toast('演示素材用完啦'); return; } media.push(pool[0]); renderMedia(); vib(8);
        if(media.length===2) setTimeout(function(){ tip($('#cpMedia .tile:last-child'), '长按可以拖动排序，第一张是封面', {mood:'happy', once:'cp-sort', ms:3000}); }, 450); };
      m.appendChild(a); }
  };
  var flipTiles=function(m, change, skip){
    var ts=$$('.tile', m), r0=ts.map(function(t){ return t.getBoundingClientRect(); }); change();
    if(REDUCED) return; ts.forEach(function(t, i){ if(t===skip) return; var r=t.getBoundingClientRect(), a=r0[i];
      if(Math.abs(a.left-r.left)<1 && Math.abs(a.top-r.top)<1 && Math.abs(a.width-r.width)<1) return;
      t.animate([{transform:'translate('+(a.left-r.left)+'px,'+(a.top-r.top)+'px) scale('+(a.width/r.width)+','+(a.height/r.height)+')', transformOrigin:'0 0'},
        {transform:'none', transformOrigin:'0 0'}], {duration:320, easing:'cubic-bezier(.2,.9,.3,1.1)'}); });
  };
  var mediaDown=function(e, d){
    if(media.length<2) return;
    var m=$('#cpMedia'), x0=e.clientX, y0=e.clientY, t=setTimeout(function(){ lift(); }, 320), st={d:d, t:t, x:x0, y:y0};
    mediaDrag=st;
    var lift=function(){ st.on=true; dragged=true; vib(12); tipHide();
      flipTiles(m, function(){ m.classList.add('sorting'); });
      d.classList.add('lifted'); st.idx=$$('.tile', m).indexOf(d); st.from=st.idx;
      var sl=slot(d); st.ox=st.x-sl.x; st.oy=st.y-sl.y; place(); };
    var slot=function(o){ var mr=m.getBoundingClientRect(); return {x:mr.left+o.offsetLeft, y:mr.top+o.offsetTop, w:o.offsetWidth, h:o.offsetHeight}; };
    var place=function(){ var sl=slot(d); d.style.transform='translate('+(st.x-st.ox-sl.x)+'px,'+(st.y-st.oy-sl.y)+'px) scale(1.08) rotate(-2deg)'; };
    st.move=function(ev){ st.x=ev.clientX; st.y=ev.clientY;
      if(!st.on){ if(Math.abs(st.x-x0)>8 || Math.abs(st.y-y0)>8){ clearTimeout(t); done(); } return; }
      ev.preventDefault(); place();
      var ts=$$('.tile', m), best=-1, bd=1e9;
      ts.forEach(function(o, i){ var r=slot(o), cx=r.x+r.w/2, cy=r.y+r.h/2;
        var dd=Math.hypot(st.x-cx, st.y-cy); if(dd<bd){ bd=dd; best=i; } });
      if(best>=0 && best!==st.idx){ var tgt=ts[best];
        flipTiles(m, function(){ if(best>st.idx) tgt.after(d); else tgt.before(d); }, d);
        st.idx=best; place(); vib(4); } };
    var done=function(){ window.removeEventListener('pointermove', st.move); window.removeEventListener('pointerup', st.up); window.removeEventListener('pointercancel', st.up);
      document.removeEventListener('touchmove', st.tm); mediaDrag=null; };
    st.up=function(){ clearTimeout(t); done(); if(!st.on) return; setTimeout(function(){ dragged=false; }, 350);
      d.classList.remove('lifted'); d.classList.add('settle'); d.style.transform='';
      var order=$$('.tile', m).map(function(o){ return o.dataset.f; }), coverCh=order[0]!==media[0];
      setTimeout(function(){ d.classList.remove('settle'); flipTiles(m, function(){ m.classList.remove('sorting'); });
        media.length=0; Array.prototype.push.apply(media, order);
        setTimeout(function(){ renderMedia(); }, 330);
        if(st.idx!==st.from){ vib([6,20,10]); if(coverCh){ var c=centerOf(m.firstElementChild); sparkle(c[0], c[1], {c:'255,210,122', n:8, r:60}); toast('封面换好了', {tone:'ok'}); } } }, 260); };
    st.tm=function(ev){ if(st.on) ev.preventDefault(); };
    window.addEventListener('pointermove', st.move, {passive:false}); window.addEventListener('pointerup', st.up); window.addEventListener('pointercancel', st.up);
    document.addEventListener('touchmove', st.tm, {passive:false});
  };

  /* 标签：已选的排在前面（第一枚是主标签，盖章），后面是这个分区的默认标签，最后「＋ 表情」 */
  var tags=[], stamp=$('#cpStamp'), tagOpt=$('#cpTagOpt');
  var hasTag=function(k){ for(var i=0;i<tags.length;i++) if(tagKey(tags[i])===k) return i; return -1; };
  var paintStamp=function(pop){ var k=tagKey(tags[0]); cb.classList.toggle('mooded', !!k);
    tagOpt.textContent=k?OT_EXPR[k].say:'标签就是那一刻的心情 · 最多 '+TAG_MAX+' 个'; tagOpt.classList.toggle('talk', !!k);
    if(k && pop!==false){ stamp.src=STK(k); stamp.classList.remove('in'); void stamp.offsetWidth; stamp.classList.add('in'); } };
  var renderTags=function(fresh){
    var T=$('#cpTags'), keys=tags.map(tagKey), list=tags.slice();
    CP[cpRealm].defs.forEach(function(k){ if(keys.indexOf(k)<0) list.push(k); });
    T.innerHTML=list.map(function(t, i){ var k=tagKey(t), on=i<tags.length;
      return tagChip(t, (on?'on':'')+(on&&i===0?' main':'')+(fresh&&fresh.indexOf(k)>=0?' sug':''), on); }).join('')
      +'<span class="chip tg-add" data-sh3="sh3-tag"><b>＋</b>表情<small>'+tags.length+'/'+TAG_MAX+'</small></span>';
    T.classList.toggle('full', tags.length>=TAG_MAX);
  };
  var toggleTag=function(t, from){
    var k=tagKey(t), i=hasTag(k);
    if(i>=0){ tags.splice(i,1); vib(5); }
    else { if(tags.length>=TAG_MAX){ toast('最多贴 '+TAG_MAX+' 个，先点掉一个', {tone:'info'}); vib(12); return false; }
      tags.push(t); vib([6,24,10]);
      if(from){ var p=centerOf(from); burst(p[0]-24, p[1]-6, ['✦','✧'], 5, 1.6); } }
    renderTags(); paintStamp(i<0 && tags.length===1 || i===0);
    var nc=$('#cpTags .chip[data-k="'+k+'"]'); if(nc && i<0) nc.classList.add('pop');
    return true;
  };
  $('#cpTags').addEventListener('click', function(e){ var c=e.target.closest('.chip.tg'); if(!c) return;
    var k=c.dataset.k, i=hasTag(k); toggleTag(i>=0?tags[i]:k, c); });
  window.cpAddTag=function(t){ var i=hasTag(tagKey(t)); if(i>=0){ tags[i]=t; renderTags(); paintStamp(i===0); return true; }
    return toggleTag(t, $('#cpTags .tg-add')); };
  window.cpTags=function(){ return tags.slice(); };
  stamp.onclick=function(){ if(tags.length){ toggleTag(tags[0]); } };

  var paintLink=function(){
    var k=$('#cpLink'), ic=$('#cpLinkIc'), l=cpRealm==='game'&&cpSess?gtSessLabel(cpSess):null;
    k.classList.toggle('empty', cpRealm==='game' && !l); k.classList.toggle('fresh', !!(cpSess && cpSess.fresh && cpRealm==='game'));
    if(l){ ic.innerHTML='<img src="assets/games/'+cpSess.g+'.webp" alt="">';
      $('#cpLinkT').innerHTML=l.t+(cpGuess?'<em class="cp-guess">小獭猜的</em>':'');
      $('#cpLinkS').textContent=cpSess.fresh?'刚收工的这一局 · '+l.s.replace('刚收工 · ',''):l.s;
      k.style.setProperty('--b', l.c); $('#cpLinkSw').textContent='重新选择'; }
    else if(cpRealm==='game'){ ic.innerHTML='<svg viewBox="0 0 24 24"><path d="M12 5.5v13M5.5 12h13"/></svg>';
      $('#cpLinkT').textContent='选择关联的一局'; $('#cpLinkS').textContent='游戏藏品要挂在一局计时记录上 · 必选';
      k.style.removeProperty('--b'); $('#cpLinkSw').textContent='去选择'; }
    else { ic.textContent=LIFE_LINK[0]; $('#cpLinkT').textContent=LIFE_LINK[1]; $('#cpLinkS').textContent=LIFE_LINK[2];
      k.style.removeProperty('--b'); $('#cpLinkSw').textContent='改地点'; }
    k.classList.remove('swap'); void k.offsetWidth; k.classList.add('swap');
  };
  var pickSess=function(){ if(!window.gtLinkPick) return;
    gtLinkPick({sel:cpSess&&cpSess.id, cb:function(x){ var ch=!cpSess || x.id!==cpSess.id; cpSess=x; cpGuess=false; paintLink();
      if(ch) toast('关联到「'+gtSessLabel(x).t+'」', {tone:'ok'}); }}); };
  $('#cpLink').onclick=function(){ if(cpRealm==='game'){ pickSess(); vib(6); } else toast('演示：这里会打开地点选择'); };

  var setCp=function(r, keep){ cpRealm=r; box.classList.toggle('life', r==='life');
    $$('button', rb).forEach(function(x){ x.classList.toggle('on', x.dataset.r===r); });
    rb.querySelector('.pill').style.transform=r==='life'?'translateX(100%)':'';
    rb.querySelector('.pill').style.background=r==='life'?'rgb(255,138,184)':'';
    $('#cpHint').textContent=r==='game'?'小獭会看图和这局时长帮你写':'小獭会看图帮你写';
    tt.placeholder=r==='game'?'给这一局起个名字':'给这一刻起个名字';
    if(!keep){ media=[CP[r].media[0]]; tx.value=''; tt.value=''; capK=0; sp.textContent='帮我想一句'; tags=[]; paintStamp(false); cpDraftId=null; }
    /* 游戏：收工带过来的那局优先且不算猜；否则预选最近一局还没记过的，标「小獭猜的」 */
    if(r==='game' && !cpSess){ cpSess=window.CP_FRESH||(window.gtSessGuess?gtSessGuess():null); cpGuess=!window.CP_FRESH && !!cpSess; window.CP_FRESH=null; }
    count(); renderMedia(); renderTags(); paintLink();
    pub.classList.remove('ok'); pub.textContent='收进藏品';
    if(!REDUCED){ box.classList.remove('realm-in'); void box.offsetWidth; box.classList.add('realm-in'); }
  };
  rb.addEventListener('click', function(e){ var b=e.target.closest('button'); if(!b || b.dataset.r===cpRealm) return;
    setCp(b.dataset.r); vib(6); });
  S3_HOOKS['s3-compose']=function(){ cpSess=null; setCp(window.CP_FRESH?'game':(document.body.dataset.realm==='life'?'life':'game'));
    if(window.GT_DRAFTS && GT_DRAFTS.length && !cpDraftId) setTimeout(function(){ tip($('#cpDraft'), '还有 '+GT_DRAFTS.length+' 份草稿没写完', {mood:'hug', once:'cp-drafts', ms:2600}); }, 700); };
  /* 收工「记一条这局」：du 形如「48 分钟」「1.2 小时」 */
  window.cpLinkTo=function(f, du){
    var n=parseFloat(du)||1, m=/小时/.test(du)?Math.round(n*60):Math.round(n);
    window.CP_FRESH=window.gtSessFresh?gtSessFresh(f, m):null; document.body.dataset.realm='game';
  };

  /* 草稿：取当前内容 / 从草稿接着写（手上没存的先存一份） */
  var dirty=function(){ return !!(tx.value.trim() || tt.value.trim() || tags.length || media.length>1); };
  var snap=function(){ return {id:cpDraftId||'d'+Date.now(), realm:cpRealm, title:tt.value.trim(), text:tx.value.trim(), media:media.slice(), tags:tags.slice(),
    sess:cpRealm==='game'&&cpSess?cpSess.id:null}; };
  window.cpLoad=function(d){
    if(dirty() && cpDraftId!==d.id){ gtDraftSave(snap()); toast('刚才写的也先存进草稿了', {tone:'ok'}); }
    cpDraftId=d.id; cpSess=d.sess?gtSessById(d.sess):null; cpGuess=false;
    setCp(d.realm, true); media=d.media.slice(); tt.value=d.title; tx.value=d.text; tags=d.tags.slice();
    count(); renderMedia(); renderTags(); paintStamp(!!tags.length); paintLink();
    sp.textContent=tx.value?'换一句':'帮我想一句';
  };

  sp.onclick=function(){
    if(cb.classList.contains('busy')) return;
    cb.classList.add('busy'); sp.classList.add('busy'); sp.textContent='小獭在想…'; vib(6);
    setTimeout(function(){
      cb.classList.remove('busy'); sp.classList.remove('busy'); sp.textContent='换一句';
      var c=CP[cpRealm].caps[capK++%CP[cpRealm].caps.length], i=0;
      tt.value=c[0]; tx.value='';
      var t=setInterval(function(){ tx.value=c[1].slice(0,++i); count();
        if(i>=c[1].length){ clearInterval(t); count();
          if(!tags.length){ tags=c[2].slice(0, TAG_MAX); renderTags(c[2].map(tagKey)); paintStamp(); }
          var p=centerOf(sp); burst(p[0],p[1],['✦','✧'],5,1.6);
          $('#cpHint').textContent=tags.length?'顺手贴了「'+tags.map(tagName).join('」「')+'」，不对就点掉':'写好了'; } }, REDUCED?0:38);
    }, 1100);
  };

  $('#cpDraft').onclick=function(){ openS3('s3-drafts'); };
  /* 返回：没写东西直接走；写了就用公共弹窗问一句（存草稿 / 继续写 / 不保存） */
  $('#cpClose').onclick=function(){
    if(!dirty()){ closeTop(); return; }
    ask({ mood:'shock', title:'这一条还没收进藏品', body:'存成草稿，下次在「草稿」里接着写；不保存的话，刚写的就没了。',
      ok:'存草稿', no:'继续写', alt:'不保存，直接离开',
      onOk:function(){ gtDraftSave(snap()); closeTop(); vib([6,24,10]);
        setTimeout(function(){ toast('草稿存好了', {tone:'ok', act:'去看看', cb:function(){ openS3('s3-drafts'); }}); }, 300); },
      onAlt:function(){ closeTop(); } }); };

  pub.onclick=function(){
    if(pub.classList.contains('ok')) return;
    /* 游戏藏品不能不挂局：卡片抖一下，直接打开选择 */
    if(cpRealm==='game' && !cpSess){ var lk=$('#cpLink'); lk.classList.remove('nudge'); void lk.offsetWidth; lk.classList.add('nudge'); vib(14);
      toast('先选这条记的是哪一局', {tone:'info'}); setTimeout(pickSess, 380); return; }
    var text=tx.value.trim()||tt.value.trim()||CP[cpRealm].caps[0][1];
    pub.classList.add('ok'); pub.innerHTML='<span class="ck"></span>收好了'; vib([10,40,18]);
    var cv=$('#cpMedia img'), it={img:media[0]||CP[cpRealm].media[0], t:(tt.value.trim()||(text.length>16?text.slice(0,16)+'…':text)), d:'刚刚', tags:tags.slice(), h:210, f:'day'};
    if(cpRealm==='game'){ it.g=cpSess.g; gtSessMark(cpSess.id); }
    if(cpDraftId){ gtDraftDel(cpDraftId); cpDraftId=null; }
    setTimeout(function(){
      if(cv && !REDUCED){ var r=cv.getBoundingClientRect(), g=cv.cloneNode(); g.className='fly3';
        Object.assign(g.style,{left:r.left+'px', top:r.top+'px', width:r.width+'px', height:r.height+'px', borderRadius:'16px'});
        document.body.appendChild(g);
        g.animate([{transform:'none', opacity:1},{transform:'translate(0,-40px) scale(.7) rotate(-6deg)', opacity:1, offset:.4},
          {transform:'translate('+(innerWidth*0.52-r.left-r.width/2)+'px,'+(innerHeight-r.top-r.height/2)+'px) scale(.08) rotate(12deg)', opacity:.6}],
          {duration:700, easing:'cubic-bezier(.5,0,.3,1)', fill:'forwards'}).onfinish=function(){ g.remove(); };
      }
      setTimeout(function(){ while(stack.length) closeTop(); window.v3publish(it, cpRealm); }, REDUCED?0:520);
    }, 420);
  };
});

/* ═══ 心情状态：独立于藏品，像微信状态 —— 头部、最近的心情、表情馆共用一份 ═══ */
var MOOD_SUG={great:['爽到起飞','今天是欧皇'],happy:['心情不错～','和朋友玩得很开心'],calm:['慢慢来','泡杯茶歇一下'],
  grr:['不服，再来','今天手感不对'],cry:['破防了…','需要一个抱抱'],sleepy:['困成一团','先睡了，明天见'],
  love:['被治愈了','今天也很喜欢这个世界'],shock:['什么情况！','我人傻了'],cheer:['冲冲冲','今晚上分']};
var DUR_N={'4h':'4 小时内有效', today:'今天内有效', ever:'一直有效'};
var MOOD=window.GtEmpty && GtEmpty.on('me') ? null : {k:'happy', t:'和朋友开黑到很晚', d:'today', at:Date.now()-2*3600e3};
var MD_HIST=[{w:'二',k:'great',t:'星穹铁道十连，出金了'},{w:'三',k:'angry',t:'深渊 12 层，又差一口气'},{w:'四',k:'calm',t:'一个人的晚饭，慢慢吃'},
  {w:'五',k:'sleepy',t:'加班到很晚，没开游戏'},{w:'六',k:'great',t:'排位连胜 5 把'},{w:'日',k:'love',t:'雨停了，出门散了会步'}];
var escH=function(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); };
function agoText(t){ var m=Math.round((Date.now()-t)/6e4); return m<1?'刚刚':m<60?m+' 分钟前':Math.floor(m/60)+' 小时前'; }
function exStats(){
  var st={}; Object.keys(OT_EXPR).forEach(function(k){ st[k]={n:0, d:''}; });
  ['game','life'].forEach(function(r){ ITEMS[r].forEach(function(it){ tagsOf(it).forEach(function(t){ var s=st[tagKey(t)]; if(!s) return;
    s.n++; s.tag=(s.tag||0)+1; if(!s.d) s.d=(it.d||'').split(' ')[0]; }); }); });
  MD_HIST.forEach(function(h){ st[h.k].n++; if(!st[h.k].d) st[h.k].d='周'+h.w; });
  if(MOOD){ st[MOOD.k].n++; st[MOOD.k].d='今天'; }
  return st;
}
/* 头部：卡片底色、光晕、文案旁的小獭动图 */
function paintHeadMood(anim){
  var card=$('#m3Id'), st=$('#m3St'), tx=$('#m3StTx'), av=$('#m3MoodAv'); if(!card||!tx) return;
  if(MOOD){ var x=OT_EXPR[MOOD.k]; card.style.setProperty('--mc', x.c); card.classList.add('has-mood');
    av.src=STK(MOOD.k); av.alt=x.n;
    tx.innerHTML='<b>'+x.n+'</b><span>'+escH(MOOD.t||x.say)+'</span><small>'+agoText(MOOD.at)+'</small>';
  } else { card.classList.remove('has-mood'); card.style.removeProperty('--mc'); tx.innerHTML='<b>＋</b><span>设个心情状态</span>'; }
  st.classList.toggle('empty', !MOOD);
  if(anim){ card.classList.remove('md-in'); void card.offsetWidth; card.classList.add('md-in'); }
}
/* 最近的心情：6 天历史 + 今天 = 此刻状态 */
function paintMood(){
  var wk=$('#mdWk'); if(!wk) return;
  var days=MD_HIST.concat([{w:'今天',k:MOOD&&MOOD.k,t:MOOD?(MOOD.t||'此刻的心情'):''}]), cnt={};
  days.forEach(function(d){ if(d.k) cnt[d.k]=(cnt[d.k]||0)+1; });
  var order=Object.keys(cnt).sort(function(a,b){ return cnt[b]-cnt[a]; }), n=days.filter(function(d){ return d.k; }).length;
  var big=$('#mdBig'), card=$('#m3Mood');
  var summary=function(){ var k=order[0], x=OT_EXPR[k];
    big.src=STK(k); card.style.setProperty('--mc', x.c);
    $('#mdDay').textContent='这一周 · '+n+' 天留了心情';
    $('#mdTt').textContent='多半是「'+x.n+'」';
    $('#mdSay').textContent=order.slice(0,3).map(function(k){ return OT_EXPR[k].n+' '+cnt[k]+' 天'; }).join(' · ')+(MOOD?'':' · 今天还空着');
    $$('#mdWk > i').forEach(function(c){ c.classList.remove('on'); }); };
  wk.innerHTML=days.map(function(d,i){ var x=OT_EXPR[d.k];
    return '<i style="--i:'+i+(x?';--mc:'+x.c:'')+'" class="'+(x?'':'emp')+(i===6?' td':'')+'">'
      +(x?'<img src="'+STK(d.k, false)+'" alt="'+x.n+'">':'<em>+</em>')+'<small>'+d.w+'</small></i>'; }).join('');
  $$('#mdWk > i').forEach(function(c,i){ var d=days[i];
    c.onclick=function(){
      if(!d.k){ openSheet('sh3-mood'); return; }
      if(c.classList.contains('on')){ summary(); return; }
      var x=OT_EXPR[d.k]; summary(); c.classList.add('on'); c.querySelector('img').src=STK(d.k);
      big.src=STK(d.k); card.style.setProperty('--mc', x.c);
      $('#mdDay').textContent=(i===6?'今天 · '+agoText(MOOD.at):'周'+d.w); $('#mdTt').textContent=x.n; $('#mdSay').textContent=d.t;
      big.classList.remove('pop'); void big.offsetWidth; big.classList.add('pop'); vib(6);
    }; });
  $('#mdBar').innerHTML=order.map(function(k){ var x=OT_EXPR[k];
    return '<i style="flex:'+cnt[k]+';--mc:'+x.c+'" title="'+x.n+'"><span>'+x.n+'</span></i>'; }).join('');
  var ls=$('#mdList');
  if(ls){ var rows=days.map(function(d,i){ return [d,i]; }).reverse();
    ls.innerHTML=rows.map(function(r,j){ var d=r[0], x=OT_EXPR[d.k];
      return '<div class="rw md-row'+(x?'':' emp')+'" data-i="'+r[1]+'" style="--i:'+j+(x?';--mc:'+x.c:'')+'">'
        +(x?'<img src="'+STK(d.k, false)+'" alt="">':'<em>+</em>')
        +'<span class="l">'+(r[1]===6?'今天':'周'+d.w)+(x?' · <b>'+x.n+'</b>':'')+'<small>'+(x?escH(d.t||x.say):'还没留心情，点一下补上')+'</small></span><span class="r">›</span></div>'; }).join('');
    $$('#mdList .md-row').forEach(function(row){ row.onclick=function(){
      var c=$$('#mdWk > i')[+row.dataset.i]; if(c) c.click();
      var sc=$('#s3-moods .bd'); if(sc && sc.scrollTo) sc.scrollTo({top:0, behavior:REDUCED?'auto':'smooth'}); }; });
    ls.classList.remove('in'); void ls.offsetWidth; ls.classList.add('in'); }
  summary();
}
S3_HOOKS['s3-moods']=function(){ paintMood(); };
function paintMeEx(){ paintHeadMood(); paintMood(); }
safe('me-ex', paintMeEx);
setInterval(function(){ if(MOOD && document.body.dataset.page==='me') safe('mood-ago', function(){ var s=$('#m3St small'); if(s) s.textContent=agoText(MOOD.at); }); }, 30000);

/* 此刻心情弹层 */
var mdSel={k:'happy', d:'today'};
function mdPick(k, user){
  mdSel.k=k; var x=OT_EXPR[k], pv=$('#mdPrev');
  $('#sh3-mood .md-sh').style.setProperty('--mc', x.c);
  if(window.MD_PK) MD_PK.set(k);
  $('#mdPImg').src=STK(k); $('#mdPNm').textContent=x.n;
  $('#mdSug').innerHTML=(MOOD_SUG[k]||[x.say]).map(function(s){ return '<span class="chip">'+s+'</span>'; }).join('');
  $$('#mdSug .chip').forEach(function(c){ c.onclick=function(){ $('#mdIn').value=c.textContent; mdText(); vib(5); }; });
  if(user){ pv.classList.remove('pop'); void pv.offsetWidth; pv.classList.add('pop'); vib(6); }
  mdText();
}
function mdText(){
  var v=$('#mdIn').value.trim(); $('#mdN').textContent=v.length+'/24';
  $('#mdPTx').textContent=v||OT_EXPR[mdSel.k].say; $('#mdPTx').classList.toggle('ph', !v);
  $('#mdPDur').textContent=DUR_N[mdSel.d];
}
safe('mood-sheet', function(){
  var inp=$('#mdIn'); if(!inp) return;
  inp.addEventListener('input', mdText);
  $$('#mdDur .chip').forEach(function(c){ c.onclick=function(){ mdSel.d=c.dataset.d; $$('#mdDur .chip').forEach(function(x){ x.classList.toggle('on', x===c); }); mdText(); vib(5); }; });
  $('#mdExp').onclick=function(){ closeSheet($('#sh3-mood')); window.EX_PICK=mdSel.k; setTimeout(function(){ openS3('s3-expr'); }, 200); };
  $('#mdHist').onclick=function(){ closeSheet($('#sh3-mood')); setTimeout(function(){ openS3('s3-moods'); }, 220); };
  $('#mdSet').onclick=function(){ openSheet('sh3-mood'); };
  $('#mdClear').onclick=function(){ var was=MOOD; MOOD=null; closeSheet($('#sh3-mood')); paintHeadMood(true); paintMood(); vib(8);
    toast('心情清掉了', {act:'撤销', cb:function(){ MOOD=was; paintHeadMood(true); paintMood(); toast('心情回来了', {tone:'love'}); }}); };
  $('#mdOk').onclick=function(){
    var was=MOOD&&MOOD.k, x=OT_EXPR[mdSel.k];
    MOOD={k:mdSel.k, t:inp.value.trim(), d:mdSel.d, at:Date.now()};
    var onMe=document.body.dataset.page==='me' && !stack.length, src=$('#mdPImg'), dst=$('#m3MoodAv');
    var land=function(){ paintHeadMood(true); paintMood();
      var c=centerOf(dst); burst(c[0], c[1], ['✦','✧'], 6, 1.6); vib([8,30,14]); };
    if(onMe){ var y=$('#m3Id').getBoundingClientRect().top; if(y<0||y>innerHeight*.6) scrollTo({top:scrollY+y-90, behavior:'auto'});
      fly(src, dst, STK(mdSel.k), {arc:60, ms:620, radius:'12px'}, land); }
    closeSheet($('#sh3-mood'));
    if(!onMe) land();
    toast(was===mdSel.k?'心情已更新 · '+DUR_N[mdSel.d]:'此刻是「'+x.n+'」· '+DUR_N[mdSel.d]);
  };
});

/* 通知预览：每种提醒配一个表情 */
safe('nt-prev', function(){
  var pv=$('#ntPrev'); if(!pv) return;
  var N=[['每日提醒','晚上好～今天还没开战哦，来打个招呼吧'],['连续天数','连续 12 天的火苗快灭了…今天来留一笔好不好'],
    ['快到上限','这一局已经 2 小时 50 分了，离上限只剩 10 分钟'],['深夜','23:30 了，收工睡觉吧，明天的你会感谢今天的你']], i=0;
  pv.addEventListener('click', function(){ i=(i+1)%N.length; var bn=pv.querySelector('.bn');
    bn.classList.remove('in'); void bn.offsetWidth; bn.classList.add('in');
    bn.querySelector('b').textContent='小獭 · '+N[i][0]; bn.querySelector('p').textContent=N[i][1]; vib([6,30,6]); });
});
/* 关于页：戳小獭会换表情，全部戳一遍有彩蛋 */
safe('about-ot', function(){
  var im=$('#s3-about .ab-ot'); if(!im) return;
  var ks=Object.keys(OT_EXPR), i=0, seen={};
  im.style.cursor='pointer';
  im.addEventListener('click', function(){ var k=ks[i++%ks.length]; seen[k]=1; im.src=STK(k);
    if(!REDUCED) im.animate([{transform:'scale(.85) rotate(-6deg)'},{transform:'scale(1.08) rotate(3deg)',offset:.6},{transform:'none'}],{duration:450,easing:'cubic-bezier(.3,1.5,.5,1)'});
    var p=centerOf(im); burst(p[0], p[1]-30, ['✦'], 4, 1.5); vib(6);
    if(Object.keys(seen).length===ks.length && !im.dataset.egg){ im.dataset.egg=1; setTimeout(function(){ toast('彩蛋：你把小獭的 '+ks.length+' 种表情都看了一遍 ✦'); confetti(p[0], p[1], 16); }, 300); } });
});
S3_HOOKS['s3-expr']=function(){
  var st=exStats(), ks=EXPR_KEYS(), cur=null;
  $('#exN').textContent=ks.length+' 个';
  var hero=$('#exHero'), big=$('#exBig'), dock=$('#exDock'), s3=$('#s3-expr');
  var docked=function(){ return dock.classList.contains('show'); };
  var paintDock=function(img, nm, say, c, setTx, setOn){
    dock.style.setProperty('--mc', c); $('#exDkImg').src=img; $('#exDkNm').textContent=nm; $('#exDkSay').textContent=say;
    var b=$('#exDkSet'); b.hidden=!setTx; if(setTx){ b.textContent=setTx; b.classList.toggle('ghost', !!setOn); }
    if(docked()){ dock.classList.remove('pop'); void dock.offsetWidth; dock.classList.add('pop'); }
  };
  var show=function(k, from){
    var x=OT_EXPR[k], s=st[k], now=!!(MOOD&&MOOD.k===k); cur=k; hero.style.setProperty('--mc', x.c);
    big.src=STK(k); $('#exNm').textContent=x.n; $('#exSay').textContent=x.say;
    $('#exCnt').textContent=(s.n?'用过 '+s.n+' 次 · 最近 '+s.d:'还没用过')+' · '+EXPR_GROUPS.filter(function(g){ return g[0]===x.g; })[0][1];
    $('#exSet').textContent=now?'这就是此刻的心情':'设为此刻心情';
    $('#exSet').classList.toggle('ghost', now);
    $('#exGo').textContent=s.tag?'看贴着它的 '+s.tag+' 件藏品 ›':'还没有藏品贴过它';
    $('#exGo').classList.toggle('off', !s.tag);
    hero.classList.remove('pop'); void hero.offsetWidth; hero.classList.add('pop');
    paintDock(STK(k), x.n, x.say, x.c, now?'此刻心情':'设为心情', now);
    if(pk) pk.set(k);
    if(from){ var p=centerOf(docked()?$('#exDkImg'):big); burst(p[0], p[1]-20, ['✦','✧'], 5, 1.6); }
  };
  var bar=$('#s3-expr .bar3');
  var syncDock=function(){ var top=bar.getBoundingClientRect().bottom; dock.style.setProperty('--dock-top', (top+8)+'px');
    dock.classList.toggle('show', big.getBoundingClientRect().bottom < top+24); };
  if(!s3._dockBound){ s3._dockBound=1; s3.addEventListener('scroll', function(){ syncDock(); }, {passive:true}); }
  dock.classList.remove('show');
  $('#exDkSet').onclick=function(){ if(!cur || (MOOD&&MOOD.k===cur)) return; window.MD_PICK=cur; openSheet('sh3-mood'); };
  var pk=null; pk=exprPicker($('#exPick'), {sel:null, mark:function(k){ return !!st[k].n; }, onPick:function(k){ show(k, true); vib(8); }});
  $('#exSet').onclick=function(){ if(MOOD&&MOOD.k===cur) return; window.MD_PICK=cur; openSheet('sh3-mood'); };
  $('#exGo').onclick=function(){ if(!st[cur].tag) return; var k=cur;
    var has=function(r){ return ITEMS[r].some(function(it){ return tagsOf(it).map(tagKey).indexOf(k)>=0; }); };
    galleryTag(k, has(realm)?realm:(has('game')?'game':'life')); };
  var pick=window.EX_PICK; window.EX_PICK=null;
  show(pick && st[pick] ? pick : (MOOD&&MOOD.k)||'happy', !!pick);
  setTimeout(function(){ var c=$('#exPick .xp-grid button:not(.on)'); if(c) tip(c, '点一下，小獭就换上这个表情', {mood:'happy', once:'ex-grid'}); }, 900);
};

/* ═══ 我 ═══════════════════════════════════════════════════════════ */
var meRing=null;
function countUp(){
  $$('#s3-memory [data-c3]').forEach(function(el){
    var to=+el.dataset.c3, t0=performance.now();
    (function f(now){ var p=Math.min(1,(now-t0)/900), e=1-Math.pow(1-p,3);
      el.textContent=Math.round(to*e); if(p<1) requestAnimationFrame(f); })(t0);
  });
}
function introMe(){
  if(window.GtEmpty && GtEmpty.on('me')){ if(meRing){ meRing.p=0; meRing.set({ratio:.02}); } countUp(); return; }
  if(meRing){ meRing.p=0; meRing.set({ratio:.86}); }
  var bars=$$('#m3Bars .b'), mins=[95,160,25,170,120,240,97], max=240;
  bars.forEach(function(b,i){ var c=b.querySelector('.col'); c.style.height='0px';
    setTimeout(function(){ c.style.height=(mins[i]?Math.max(10,mins[i]/max*78):6)+'px'; }, 80+i*70); });
  var bg=$('#m3Budget'); if(bg){ bg.style.width='0'; setTimeout(function(){ bg.style.width='62%'; }, 200); }
  $$('#m3Pod .st').forEach(function(s,i){ s.style.height='0'; setTimeout(function(){ s.style.height=s.dataset.h+'px'; }, 300+[1,0,2][i]*160); });
  countUp();
  // 第一次站上领奖台：彩纸（每次进 App 只放一次，不打扰）
  if(!window.__podCf){ window.__podCf=1; setTimeout(function(){
    var first=$('#m3Pod .p.first .ic'); if(!first) return; var r=first.getBoundingClientRect();
    if(r.top<innerHeight && r.bottom>0){ confetti(r.left+r.width/2, r.top+r.height/2, 24); }
    else window.__podCf=0; }, 1300); }
}
safe('me', function(){
  var cv=$('#m3Ring'); if(cv && window.LiveRing) meRing=new LiveRing(cv,{ratio:0, stroke:4, color:'155,123,240'});
  var bars=$('#m3Bars'); if(bars){
    var mins=[95,160,25,170,120,240,97], ti=6, lim=180, dd=new Date().getDay();
    [0,1,2,3,4,5,6].map(function(k){ return '日一二三四五六'[(dd-6+k+7)%7]; }).forEach(function(l,i){
      var b=document.createElement('div');
      b.className='b'+(mins[i]===0?' empty':'')+(mins[i]>lim?' over':'')+(i===ti?' today':'');
      var m=mins[i]; b.innerHTML='<span class="h">'+(m?(m>=60?Math.floor(m/60)+'h':'')+(m%60?m%60+'m':''):'—')+'</span><div class="col"></div><span class="l">'+(i===ti?'今':l)+'</span>';
      b.onclick=function(){ $$('.b',bars).forEach(function(x){x.classList.toggle('sel',x===b);}); vib(5); };
      bars.appendChild(b);
    });
  }
  var pod=$('#m3Pod'); if(pod){
    [['hsr','星穹铁道','86h',62,'2'],['ys','原神','112h',92,'1'],['wzry','王者荣耀','41h',42,'3']].forEach(function(p){
      var x=document.createElement('div'); x.className='p'+(p[4]==='1'?' first':'');
      x.innerHTML='<span class="crown">'+(p[4]==='1'?'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#FFD27A" d="M3 8l4.5 3.5L12 5l4.5 6.5L21 8l-2 10H5z"/></svg>':'')+'</span><div class="ic"><img src="assets/games/'+p[0]+'.webp" alt=""></div>'
        +'<div class="nm">'+p[1]+'</div><div class="hr">'+p[2]+'</div><div class="st" data-h="'+p[3]+'">'+p[4]+'</div>';
      var g=ALL.filter(function(a){return a[0]===p[0];})[0];
      brandize(x.querySelector('.ic'), x.querySelector('img'), g[2]);
      x.querySelector('.st').style.setProperty('--b', g[2]);
      var ic=x.querySelector('.ic');
      ic.addEventListener('click', function(){ var c=centerOf(ic); if(p[4]==='1') confetti(c[0],c[1],16); else burst(c[0],c[1],['✦','✧'],5); vib(8);
        if(!REDUCED) ic.animate([{transform:'translateY(0) scale(1)'},{transform:'translateY(-12px) scale(1.08)',offset:.4},{transform:'none'}],{duration:500,easing:'cubic-bezier(.34,1.45,.64,1)'}); });
      new MutationObserver(function(){ x.querySelector('.st').style.setProperty('--b', ic.style.getPropertyValue('--b')); }).observe(ic,{attributes:true});
      pod.appendChild(x);
    });
  }
  var cp=function(){ if(navigator.clipboard) navigator.clipboard.writeText('91C3').catch(function(){}); toast('本机 ID 尾号已复制'); };
  var u=$('#m3Uid'); if(u) u.onclick=cp;
  var su=$('#setUid'); if(su) su.onclick=cp;
});

/* ═══ 二级页内容 ═══════════════════════════════════════════════════ */
S3_HOOKS['s3-foot']=function(){
  var y=$('#ftYear'); if(!y || y.children.length) return;
  for(var i=0;i<7*44;i++){ var x=document.createElement('i'), v=(i*37+11)%17;
    x.className= i>7*44-10?'' : v>15?'life' : v>12?'l4':v>9?'l3':v>6?'l2':v>3?'l1':''; y.appendChild(x); }
  setTimeout(function(){ y.scrollLeft=y.scrollWidth; }, 50);
};
var CAL_TODAY=new Date(2026,10,2), calM=new Date(2026,10,1), CAL_STREAK=new Date(2026,9,22);
var CAL_PICK=['ys','hsr','wzry','zzz','ys','hsr','mrfz'];
function calRender(dir){
  var g=$('#calGd'); if(!g) return;
  var y=calM.getFullYear(), m=calM.getMonth(), days=new Date(y,m+1,0).getDate(), lead=(new Date(y,m,1).getDay()+6)%7;
  $('#calTt').textContent=y+' 年 '+(m+1)+' 月';
  var isCur=y===CAL_TODAY.getFullYear() && m===CAL_TODAY.getMonth();
  $('#calNext').disabled=isCur; $('#calNext').style.opacity=isCur?.3:'';
  g.innerHTML='';
  for(var b=0;b<lead;b++) g.appendChild(document.createElement('div'));
  for(var d=1; d<=days; d++){
    var dt=new Date(y,m,d), future=dt>CAL_TODAY, today=isCur && d===CAL_TODAY.getDate();
    var seed=d+m*31, streak=dt>=CAL_STREAK && !future;
    var played=streak || (!future && (seed*7%5)!==0), over=played && (seed%14===4);
    if(today){ played=true; over=false; }
    var x=document.createElement('div'), gid=today?'hsr':CAL_PICK[seed%7];
    x.className='c'+(played?' on':'')+(today?' now':'')+(over?' over':'')+(future?' fut':'')+(streak?' stk':'');
    if(streak) x.style.setProperty('--si', Math.round((dt-CAL_STREAK)/864e5));
    x.innerHTML=(played?'<img src="assets/games/'+gid+'.webp" alt="">':'')+'<span>'+d+'</span>';
    if(played) (function(x, dt, gid, over, today){ x.addEventListener('click', function(){ calPick(x, dt, gid, over, today); }); })(x, dt, gid, over, today);
    g.appendChild(x);
  }
  if(dir && !REDUCED) g.animate([{transform:'translateX('+(dir*24)+'px)',opacity:0},{transform:'none',opacity:1}],{duration:280,easing:'cubic-bezier(.2,0,0,1)'});
}
function calPick(x, dt, gid, over, today){
  $$('#calGd .c').forEach(function(c){ c.classList.toggle('sel', c===x); });
  var day=dt.getDate(), nm=ALL.filter(function(a){return a[0]===gid;})[0][1], mins=today?97:over?200+day:40+(day*37)%110;
  var box=$('#calDay'); if(!box) return;
  var lbl=(dt.getMonth()+1)+' 月 '+day+' 日 · '+(today?'今天':'周'+'日一二三四五六'[dt.getDay()]);
  box.innerHTML='<img src="assets/games/'+gid+'.webp" alt=""><div class="tx"><b>'+lbl+'</b><small>'+nm+' · '+(1+day%3)+' 局'+(over?' · <span style="color:var(--live)">超出上限 '+(mins-180)+'m</span>':' · 在上限内')+'</small></div>'
    +'<span class="du"'+(over?' style="color:var(--live)"':'')+'>'+Math.floor(mins/60)+'h '+(mins%60)+'m</span>';
  if(!REDUCED) box.animate([{transform:'translateY(6px)',opacity:.4},{transform:'none',opacity:1}],{duration:260,easing:'cubic-bezier(.2,0,0,1)'});
  if(over){ var c=centerOf(x); burst(c[0],c[1],['·','!'],4,1.2); }
  vib(6);
}
S3_HOOKS['s3-calendar']=function(){ if(!$('#calGd').children.length) calRender(0); };
/* 今日记录：24 小时轴上的色块 ↔ 下面的每一局，互相点亮 */
var TD_SES=[{g:'ys',s:'13:30',e:'14:15',m:45,img:'game_gacha',t:'午休抽了一发'},{g:'wzry',s:'20:12',e:'21:04',m:52,img:'game_city',t:'三连胜收工'}];
S3_HOOKS['s3-today']=function(){
  var day=$('#tdDay'), list=$('#tdList'); if(!day) return;
  var hm=function(s){ var p=s.split(':'); return +p[0]+p[1]/60; }, fm=function(m){ return (m>=60?Math.floor(m/60)+'h ':'')+(m%60)+'m'; };
  var lim=(window.kWaterLimitHours||3)*60, tot=TD_SES.reduce(function(a,x){ return a+x.m; },0);
  $('#tdSum').textContent=fm(tot);
  $('#tdLeft').innerHTML=tot<lim?'还能安心玩<br><em>'+fm(lim-tot)+'</em>':'已超出<br><em style="color:var(--live)">'+fm(tot-lim)+'</em>';
  $$('#tdDay b').forEach(function(b){ b.remove(); }); list.innerHTML='';
  var now=new Date(), nh=now.getHours()+now.getMinutes()/60; $('#tdNow').style.left=(nh/24*100)+'%';
  var pick=function(i){ $$('#tdDay b').forEach(function(b,j){ b.classList.toggle('on', j===i); });
    $$('#tdList .it').forEach(function(r,j){ r.classList.toggle('on', j===i); }); vib(5); };
  TD_SES.forEach(function(x,i){
    var g=ALL.filter(function(a){ return a[0]===x.g; })[0], a=hm(x.s), b=hm(x.e);
    var blk=document.createElement('b'); blk.style.cssText='left:'+(a/24*100)+'%;width:'+Math.max(1.2,(b-a)/24*100)+'%;--b:'+g[2]+';--i:'+i;
    blk.onclick=function(){ pick(i); var r=$$('#tdList .it')[i]; if(r) r.scrollIntoView({block:'nearest', behavior:REDUCED?'auto':'smooth'}); };
    day.appendChild(blk);
    var r=document.createElement('div'); r.className='it'; r.style.setProperty('--b', g[2]); r.style.setProperty('--i', i);
    r.innerHTML='<div class="tm"><b>'+x.s+'</b><small>'+x.e+'</small></div><i class="dot"></i>'
      +'<div class="v3-card bd2"><img src="assets/games/'+x.g+'.webp" alt=""><div class="tx"><b>'+g[1]+'</b><small>'+x.t+'</small>'
      +'<div class="pr"><i style="width:'+Math.round(x.m/lim*100)+'%"></i></div></div><span class="du">'+fm(x.m)+'</span></div>';
    r.querySelector('.bd2').onclick=function(){ pick(i); openRecord({img:x.img, g:x.g, t:g[1]+' · '+x.t, d:'今天 '+x.s, tags:[]}); };
    list.appendChild(r);
  });
  $('#tdN').textContent=TD_SES.length+' 局 · 点时间轴上的色块也能找到那一局';
};
safe('calendar', function(){
  var p=$('#calPrev'), n=$('#calNext'); if(!p) return;
  p.onclick=function(){ calM=new Date(calM.getFullYear(), calM.getMonth()-1, 1); calRender(-1); vib(5); };
  n.onclick=function(){ if(n.disabled) return; calM=new Date(calM.getFullYear(), calM.getMonth()+1, 1); calRender(1); vib(5); };
});
S3_HOOKS['s3-profile']=function(){
  var g=$('#pfAv'); if(!g || g.children.length) return;
  for(var i=1;i<=22;i++){ (function(n){ var p=(n<10?'0':'')+n, im=document.createElement('img');
    im.src='assets/avatars/avatar_'+p+'.webp'; im.alt='头像 '+n; if(n===1) im.className='on';
    im.onclick=function(){ $$('img',g).forEach(function(x){x.classList.toggle('on',x===im);}); var a=$('#m3Av'); if(a) a.src=im.src; vib(6); };
    g.appendChild(im); })(i); }
};
S3_HOOKS['s3-games']=function(){
  var g=$('#gm3'); if(!g || g.children.length) return;
  ALL.forEach(function(a,i){ var x=document.createElement('div'); x.className='g';
    x.innerHTML='<div class="bx"><img src="assets/games/'+a[0]+'.webp" alt=""></div><div class="nm">'+a[1]+'</div><div class="hr">'+(i<8?(120-i*13)+'h':'')+'</div>';
    brandize(x.querySelector('.bx'), x.querySelector('img'), a[2]); g.appendChild(x); });
  var ad=document.createElement('div'); ad.className='g add'; ad.dataset.sh3='sh3-games'; ad.style.cursor='pointer'; ad.innerHTML='<div class="bx">＋</div><div class="nm">添加</div>'; g.appendChild(ad);
};
var lmRing=null;
function paintLimit(){
  var h=window.kWaterLimitHours||3, v=$('#lmV'), m=$('#lmMood');
  if(v) v.textContent=h.toFixed(1);
  if(m) m.textContent= h<=1.5?'很克制':h<=3?'刚刚好':h<=5?'有点放纵':'小獭会担心';
  var col= h<=3?'61,220,255': h<=5?'255,107,44':'255,59,78';
  if(lmRing) lmRing.set({ratio:h/8, color:col, speed: h<=3?1:h<=5?1.6:2.4});
  $$('.tkLimit').forEach(function(e){ e.textContent=h%1?h.toFixed(1):String(h); });
  var ot=$('#lmOt'), say=$('#lmSay'), lv=h<=1.5?0:h<=3?1:h<=5?2:3;
  if(ot){ var src=STK(['great','happy','shock','angry'][lv], true);
    if(ot.getAttribute('src')!==src) ot.setAttribute('src',src);
    ot.parentNode.dataset.lv=lv; ot.classList.remove('hop'); void ot.offsetWidth; ot.classList.add('hop'); }
  if(say) say.textContent=[ '这么克制，我要给你鼓掌！', fmH(h)+'，刚刚好～', fmH(h)+'……记得中途喝口水', fmH(h)+'？我会一直盯着你的！' ][lv];
  $$('#lmPre .chip').forEach(function(c){ c.classList.toggle('on', +c.dataset.h===h); });
}
function fmH(h){ return (h%1? h.toFixed(1):['','一','两','三','四','五','六','七','八'][h]||h)+(h%1?' 小时':'小时'); }
S3_HOOKS['s3-limit']=function(){
  var cv=$('#lmRing'); if(!lmRing && cv && window.LiveRing) lmRing=new LiveRing(cv,{ratio:0, stroke:7});
  paintLimit();
};
safe('limit', function(){
  var st=function(d){ window.kWaterLimitHours=Math.max(.5,Math.min(8,(window.kWaterLimitHours||3)+d)); paintLimit(); vib(6);
    if(window.paintTodayRing) paintTodayRing(); };
  var dn=$('#lmDn'), up=$('#lmUp'); if(dn) dn.onclick=function(){ st(-.5); }; if(up) up.onclick=function(){ st(.5); };
  $$('#lmPre .chip').forEach(function(c){ c.onclick=function(){ st(+c.dataset.h-(window.kWaterLimitHours||3)); }; });
});
safe('export', function(){
  var r=$('#setExport'); if(!r) return;
  r.onclick=function(){ if(r.classList.contains('busy')) return;
    r.classList.add('busy'); var sm=r.querySelector('small'), old=sm.textContent; sm.textContent='正在打包 46 件藏品…';
    setTimeout(function(){ r.classList.remove('busy'); sm.textContent='刚刚 · 12.6 MB';
      toast('备份导出好了 · 46 件藏品都在里面', {tone:'win'}); }, 1450); };
  var rs=$('#bkRestore'); if(rs) rs.onclick=function(){
    ask({ mood:'shock', danger:true, hold:true, title:'用备份覆盖这台手机？',
      body:'会换成 10 月 28 日那份备份里的内容，之后新记的藏品会被替换掉。建议先导出一份当前的。',
      ok:'恢复备份', no:'先不了',
      onOk:function(){ rs.classList.add('busy'); var l=rs.querySelector('.l'); var o=l.textContent; l.textContent='正在恢复…';
        setTimeout(function(){ rs.classList.remove('busy'); l.textContent=o; toast('恢复好了，小獭把东西都摆回原位了', {tone:'ok'}); }, 1300); } }); };
});
safe('otter-poke', function(){
  var im=$('#otImg'); if(!im) return;
  im.addEventListener('click', function(){ var c=centerOf(im); burst(c[0],c[1]-20,['✦','✧','·'],7); vib(10);
    if(!REDUCED) im.animate([{transform:'scale(1)'},{transform:'scale(.92,1.08) translateY(-14px)',offset:.3},{transform:'scale(1.04,.96)',offset:.7},{transform:'none'}],{duration:600,easing:'cubic-bezier(.34,1.45,.64,1)'}); });
});
/* ═══ 回收站 ══════════════════════════════════════════════════════
   删 → 卡片飞进回收站图标（可撤销）；回收站里点一下恢复，长按 / 选择模式彻底删除（按住确认）。 */
var TRASH=[
  {img:'game_city', t:'天台对决', from:'游戏 · 排位', left:27},
  {img:'life_rain', t:'雨停了', from:'生活 · 散步', left:12},
  {cover:'dnf', t:'地下城 · 一局', from:'游戏 · 刷本', left:4}
];
if(window.GtEmpty && GtEmpty.on('trash')) TRASH=[];
var trSelMode=false, trPick={};
function trThumb(x){ return x.img?'assets/memories/'+x.img+'.webp':x.cover?'assets/games/'+x.cover+'.webp':''; }
function trashCount(){ $$('[data-tr-n]').forEach(function(el){ el.textContent=TRASH.length?TRASH.length+' 项 ›':'空 ›'; }); }
function paintTrash(){
  var L=$('#trList'); if(!L) return;
  var n=TRASH.length, soon=TRASH.reduce(function(m,x){ return Math.min(m,x.left); }, 99);
  $('#trSum').textContent=n?n+' 件在这里等你':'都收拾干净了';
  $('#trSub').textContent=n?(soon<=5?'最早的一件 '+soon+' 天后就会被清除，记得看看':'最早的一件 '+soon+' 天后会被清除'):'删掉的藏品会在这里待 30 天';
  $('#trOt').src=STK((!n?'happy':soon<=5?'shock':'calm'));
  $('#trHero').style.setProperty('--mc', OT_EXPR[!n?'happy':soon<=5?'shock':'calm'].c);
  $('#trEmpty').hidden=!!n; if(!n && !$('#trEmpty .ge')) GtEmpty.mount($('#trEmpty'), 'trash'); $('#trClear').hidden=!n || trSelMode; $('#trLb').hidden=!n; $('#trHero').hidden=!n;
  $('#trSel').textContent=trSelMode?'完成':'选择'; $('#trSel').style.visibility=n?'':'hidden';
  L.classList.toggle('sel', trSelMode);
  L.innerHTML=TRASH.map(function(x,i){ var p=x.left/30, R=15, C=2*Math.PI*R, warn=x.left<=5;
    return '<div class="tr-row'+(trPick[i]?' on':'')+(warn?' warn':'')+'" data-i="'+i+'" style="--i:'+i+'">'
      +'<i class="ck"></i><img src="'+trThumb(x)+'" alt="">'
      +'<div class="tx"><b>'+x.t+'</b><small>'+x.from+'</small></div>'
      +'<div class="left"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="'+R+'" class="bg"/><circle cx="18" cy="18" r="'+R+'" class="fg" style="stroke-dasharray:'+C+';stroke-dashoffset:'+(C*(1-p))+'"/></svg><span>'+x.left+'<em>天</em></span></div>'
      +'<button class="rs">恢复</button></div>'; }).join('');
  $$('#trList .tr-row').forEach(function(r){ var i=+r.dataset.i, t=null, long=false;
    r.addEventListener('pointerdown', function(){ long=false; if(trSelMode) return; t=setTimeout(function(){ long=true; vib(16); trDelete([i]); }, 550); });
    var up=function(){ clearTimeout(t); }; r.addEventListener('pointerup', up); r.addEventListener('pointerleave', up);
    r.addEventListener('click', function(e){ if(long) return;
      if(trSelMode){ trPick[i]=!trPick[i]; r.classList.toggle('on', !!trPick[i]); trBar(); vib(5); return; }
      trRestore([i], r); }); });
  trBar(); trashCount();
}
function trBar(){ var ks=Object.keys(trPick).filter(function(k){ return trPick[k]; }), n=ks.length;
  var b=$('#trBar'); if(!b) return; b.classList.toggle('on', trSelMode);
  $('#trBarRs').textContent=n?'恢复 '+n+' 件':'全部恢复'; $('#trBarDel').textContent=n?'彻底删除 '+n+' 件':'全部清空'; }
function trRestore(idx, rowEl){
  var items=idx.map(function(i){ return TRASH[i]; });
  var rows=idx.map(function(i){ return $('#trList .tr-row[data-i="'+i+'"]'); }).filter(Boolean);
  rows.forEach(function(r){ r.classList.add('fly'); });
  var c=rows[0]?centerOf(rows[0]):[innerWidth/2, innerHeight/2]; burst(c[0], c[1], ['✦','✧'], 6, 1.6);
  setTimeout(function(){
    TRASH=TRASH.filter(function(x){ return items.indexOf(x)<0; });
    items.forEach(function(x){ if(x._el){ x._el.style.display=''; requestAnimationFrame(function(){ x._el.classList.remove('gone'); }); } });
    trPick={}; if(!TRASH.length) trSelMode=false; paintTrash();
    toast(items.length>1?items.length+' 件回到藏品了':'「'+items[0].t+'」回到藏品了', {tone:'ok', act:'去看看', cb:function(){ while(stack.length) closeTop(); enter('gallery'); }, ms:3600});
  }, 380);
}
function trDelete(idx){
  var all=idx.length===TRASH.length && idx.length>1, one=idx.length===1?TRASH[idx[0]]:null;
  ask({ mood:'cry', danger:true, hold:true,
    title: one?'彻底删除「'+one.t+'」？':(all?'清空回收站？':'彻底删除 '+idx.length+' 件？'),
    body: '删掉以后，小獭也找不回来了。图片、文字和那一刻的心情都会一起消失。',
    ok: one?'彻底删除':(all?'全部清空':'彻底删除'), no:'留着吧',
    onOk:function(){
      var rows=idx.map(function(i){ return $('#trList .tr-row[data-i="'+i+'"]'); }).filter(Boolean);
      rows.forEach(function(r){ r.classList.add('dust'); });
      setTimeout(function(){ var gone=idx.map(function(i){ return TRASH[i]; });
        TRASH=TRASH.filter(function(x){ return gone.indexOf(x)<0; }); trPick={}; if(!TRASH.length) trSelMode=false; paintTrash();
        toast(all||!TRASH.length?'回收站清空了，轻装上阵':'删掉了，不会再出现', {tone:'info'}); }, 520); } });
}
/* 从藏品删除：卡片缩小飞进页头回收站图标，图标「吞下」并弹一下；可撤销 */
function trashItem(it, el){
  var ic=$('#page-gallery .acts [data-s3="s3-trash"]');
  if(!el && it.feat){ var fe=$('#g3Feat'); if(fe && fe.style.display!=='none') el=fe; }
  var rec={img:it.img, cover:it.cover, t:it.t||(it.note||'').slice(0,12)||'一条记录', from:(it.g?'游戏':'生活')+(mainTag(it)?' · '+tagName(tagsOf(it)[0]):''), left:30, _el:el};
  TRASH.unshift(rec);
  if(el && ic && !REDUCED && document.body.dataset.page==='gallery'){
    var a=el.getBoundingClientRect(), b=ic.getBoundingClientRect(), g=el.cloneNode(true);
    g.className=el.className+' tr-ghost'; g.style.cssText='position:fixed;left:'+a.left+'px;top:'+a.top+'px;width:'+a.width+'px;height:'+a.height+'px;margin:0;z-index:150;pointer-events:none';
    document.body.appendChild(g);
    var dx=b.left+b.width/2-(a.left+a.width/2), dy=b.top+b.height/2-(a.top+a.height/2);
    g.animate([{transform:'none', opacity:1, borderRadius:'18px'},
      {transform:'translate('+dx*.35+'px,'+(dy*.35-40)+'px) scale(.6) rotate(-6deg)', opacity:1, offset:.45},
      {transform:'translate('+dx+'px,'+dy+'px) scale(.06) rotate(-18deg)', opacity:.4, borderRadius:'50%'}],
      {duration:620, easing:'cubic-bezier(.5,0,.3,1)'}).onfinish=function(){ g.remove();
        ic.animate([{transform:'scale(1)'},{transform:'scale(1.25,.8)', offset:.3},{transform:'scale(.92,1.1)', offset:.6},{transform:'scale(1)'}],{duration:480, easing:'ease-out'});
        var pl=document.createElement('i'); pl.className='tr-plus'; pl.textContent='+1';
        pl.style.left=(b.left+b.width/2)+'px'; pl.style.top=(b.top-6)+'px'; document.body.appendChild(pl);
        setTimeout(function(){ pl.remove(); }, 820);
        trashCount(); };
  } else trashCount();
  if(el){ el.classList.add('gone'); setTimeout(function(){ el.style.display='none'; }, 300); }
  toast('放进回收站了，30 天内都能找回', {act:'撤销', cb:function(){
    TRASH=TRASH.filter(function(x){ return x!==rec; }); trashCount();
    if(el){ el.style.display=''; requestAnimationFrame(function(){ el.classList.remove('gone'); }); } }});
}
window.trashItem=trashItem;
S3_HOOKS['s3-trash']=function(){ trSelMode=false; trPick={}; paintTrash();
  setTimeout(function(){ var r=$('#trList .tr-row'); if(r) tip(r.querySelector('.rs'), '点一下就能恢复，长按可以彻底删除', {mood:'calm', once:'trash'}); }, 700); };
safe('trash', function(){
  $('#trSel').onclick=function(){ trSelMode=!trSelMode; trPick={}; paintTrash(); vib(6); };
  $('#trClear').onclick=function(){ trDelete(TRASH.map(function(_,i){ return i; })); };
  $('#trBarRs').onclick=function(){ var ks=Object.keys(trPick).filter(function(k){ return trPick[k]; }).map(Number);
    trRestore(ks.length?ks:TRASH.map(function(_,i){ return i; })); };
  $('#trBarDel').onclick=function(){ var ks=Object.keys(trPick).filter(function(k){ return trPick[k]; }).map(Number);
    trDelete(ks.length?ks:TRASH.map(function(_,i){ return i; })); };
  trashCount();
});

/* ═══ 开战页微调：今日记录带图标、点开看详情、待机时提示「按住」 ═══ */
safe('timer-tweak', function(){
  var rows=$$('#page-timer .today .row'), gs=['ys','wzry'], imgs=['game_gacha','game_city'];
  rows.forEach(function(r,i){
    if(r.querySelector('.gi')) return;
    r.insertAdjacentHTML('afterbegin','<img class="gi" src="assets/games/'+gs[i%2]+'.webp" alt="">');
    var fb=ALL.filter(function(a){return a[0]===gs[i%2];})[0][2];
    brandize(r, r.querySelector('.gi'), fb);
    r.addEventListener('click', function(){ openRecord({img:imgs[i%2], g:gs[i%2], t:r.querySelector('.nm').textContent+' · 今天', tags:[['happy','cheer'][i%2]]}); });
  });
  var cta=$('#page-timer .cta'); if(cta && !cta.querySelector('.hold')) cta.insertAdjacentHTML('beforeend','<span class="hold">按住开战</span>');
});

/* ═══ 底部弹层：打开 / 关闭 / 下拉关闭 ═════════════════════════════ */
var SH_HOOKS={};
function openSheet(id){ var s=document.getElementById(id); if(!s) return; s.classList.add('on'); vib(6);
  var h=SH_HOOKS[id]; if(h) safe('sheet '+id, h);
  riseIn(s, '.sh-panel > *:not(.sh-grab):not(.sh-hd)'); }
function closeSheet(s){ s=s||$('.sh3.on'); if(s) s.classList.remove('on'); }
SH_HOOKS['sh3-mood']=function(){
  var pick=window.MD_PICK; window.MD_PICK=null;
  mdSel={k:pick||(MOOD&&MOOD.k)||'happy', d:(MOOD&&MOOD.d)||'today'};
  var inp=$('#mdIn'); inp.value=pick?'':(MOOD&&MOOD.t)||'';
  window.MD_PK=exprPicker($('#mdPick'), {sel:mdSel.k, onPick:function(k){ mdPick(k, true); }});
  $('#mdClear').style.display=MOOD?'':'none';
  $$('#mdDur .chip').forEach(function(c){ c.classList.toggle('on', c.dataset.d===mdSel.d); });
  mdPick(mdSel.k, false); mdText();
};
document.addEventListener('click', function(e){
  var o=e.target.closest('[data-sh3]'); if(o){ e.stopPropagation(); SH_CTX=o; openSheet(o.dataset.sh3); return; }
  var c=e.target.closest('[data-shclose]'); if(c) closeSheet(c.closest('.sh3'));
}, true);
var SH_CTX=null;
$$('.sh3').forEach(function(s){
  var p=s.querySelector('.sh-panel'), g=s.querySelector('.sh-grab'), y0=null, dy=0;
  g.addEventListener('pointerdown', function(e){ y0=e.clientY; dy=0; p.classList.add('drag'); g.setPointerCapture(e.pointerId); });
  g.addEventListener('pointermove', function(e){ if(y0===null) return; dy=Math.max(0,e.clientY-y0); p.style.transform='translateY('+dy+'px)'; });
  g.addEventListener('pointerup', function(){ p.classList.remove('drag'); p.style.transform=''; if(dy>90) closeSheet(s); y0=null; });
});

/* ── 选游戏 ─────────────────────────────────────────────────── */
var CATS={'全部':null,'RPG':['hsr','ys','bh3','yys','lkwg'],'MOBA':['wzry','lolm'],'射击':['valorant','hpjy','aqtw'],'策略':['mrfz','jcc','wjdr'],'休闲':['mc','sky','danzai','xxle','sjzx'],'动作':['zzz','dnf','hyxz']};
var sgCat='全部', sgPick={};
function sgRender(){
  var grid=$('#sgGrid'); if(!grid) return; grid.innerHTML='';
  var q=($('#sgQ').value||'').trim();
  var list=ALL.filter(function(a){ return (!CATS[sgCat]||CATS[sgCat].indexOf(a[0])>=0) && (!q||a[1].indexOf(q)>=0); });
  if(!list.length){ grid.innerHTML='<div style="grid-column:span 4">'+GtEmpty.html('games.search', {vars:{q:q}})+'</div>'; return; }
  list.forEach(function(a,i){
    var x=document.createElement('div'); x.className='g'+(sgPick[a[0]]?' on':'')+(ALL.indexOf(a)<6?' have':'');
    x.innerHTML='<div class="bx"><img src="assets/games/'+a[0]+'.webp" alt=""></div><span class="ck">✓</span><div class="nm">'+a[1]+'</div>';
    brandize(x.querySelector('.bx'), x.querySelector('img'), a[2]);
    x.querySelector('.ck').style.background='rgb('+a[2]+')';
    if(!REDUCED) x.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:260,delay:i*18,easing:'ease-out',fill:'backwards'});
    x.onclick=function(){ sgPick[a[0]]=!sgPick[a[0]]; x.classList.toggle('on'); vib(5); sgCount();
      if(sgPick[a[0]]){ var c=centerOf(x); burst(c[0],c[1]-10,['✦'],3,2); } };
    grid.appendChild(x);
  });
}
function sgCount(){ var n=Object.keys(sgPick).filter(function(k){return sgPick[k];}).length, b=$('#sgOk');
  b.disabled=!n; b.textContent=n?'添加 '+n+' 款':'选好了'; }
SH_HOOKS['sh3-games']=function(){
  sgPick={}; sgCat='全部'; $('#sgQ').value=''; sgCount();
  var cs=$('#sgCats'); cs.innerHTML='';
  Object.keys(CATS).forEach(function(k){ var c=document.createElement('span'); c.className='chip'+(k===sgCat?' on':''); c.textContent=k;
    c.onclick=function(){ sgCat=k; $$('.chip',cs).forEach(function(x){x.classList.toggle('on',x===c);}); sgRender(); vib(4); }; cs.appendChild(c); });
  sgRender();
};
safe('sg', function(){
  var q=$('#sgQ'); if(q) q.addEventListener('input', sgRender);
  var ok=$('#sgOk'); if(ok) ok.onclick=function(){ var n=Object.keys(sgPick).filter(function(k){return sgPick[k];}).length;
    var c=centerOf(ok); confetti(c[0],c[1],16); closeSheet(); toast('游戏库多了 '+n+' 款，小獭记住了'); };
});

/* ── 贴标签：从全部表情里挑一枚，名字可以改成自己的说法（存成 {k, n}） ── */
var tgSel={k:'happy', pk:null};
function tgPaint(pop){
  var x=OT_EXPR[tgSel.k], pv=$('#tgPrev'); pv.style.setProperty('--mc', x.c);
  $('#tgPImg').src=STK(tgSel.k); $('#tgSay').textContent=x.say;
  if(pop && !REDUCED){ pv.classList.remove('pop'); void pv.offsetWidth; pv.classList.add('pop'); }
}
SH_HOOKS['sh3-tag']=function(){
  var have=(window.cpTags?cpTags():[]).map(tagKey), inp=$('#tgIn');
  tgSel.k=EXPR_KEYS().filter(function(k){ return have.indexOf(k)<0; })[0]||'happy';
  inp.value=OT_EXPR[tgSel.k].n; inp.dataset.auto='1';
  tgSel.pk=exprPicker($('#tgPick'), {sel:tgSel.k, mark:function(k){ return have.indexOf(k)>=0; },
    onPick:function(k){ tgSel.k=k; if(inp.dataset.auto) inp.value=OT_EXPR[k].n; tgPaint(true); vib(6); }});
  tgPaint(false);
};
safe('tag-sheet', function(){
  var inp=$('#tgIn'); if(!inp) return;
  inp.addEventListener('input', function(){ if(inp.value.trim()) delete inp.dataset.auto; else inp.dataset.auto='1'; });
  $('#tgOk').onclick=function(){
    var nm=inp.value.trim(), x=OT_EXPR[tgSel.k], t=(!nm||nm===x.n)?tgSel.k:{k:tgSel.k, n:nm};
    var c=centerOf($('#tgPImg')); burst(c[0], c[1]-10, ['✦','✧'], 6, 1.6);
    closeSheet($('#sh3-tag'));
    setTimeout(function(){ if(window.cpAddTag && cpAddTag(t)) toast('贴上了「'+tagName(t)+'」', {tone:'ok'}); }, 220);
  };
});

/* ── 关联对局选择（link.js）· 草稿箱（drafts.js） ── */
if(window.GtLink) safe('link', function(){ GtLink({'$':$, '$$':$$, vib:vib, openSheet:openSheet, closeSheet:closeSheet, sparkle:sparkle, centerOf:centerOf, REDUCED:REDUCED}); });
if(window.GtDrafts) safe('drafts', function(){ GtDrafts({'$':$, '$$':$$, STK:STK, OT_EXPR:OT_EXPR, tagKey:tagKey, tagName:tagName, mediaOf:mediaOf,
  ask:ask, toast:toast, vib:vib, openS3:openS3, closeTop:closeTop, S3_HOOKS:S3_HOOKS, REDUCED:REDUCED}); });
/* ── 日历 / 足迹 / 编辑资料 / 游戏管理的情绪层（alive.js） ── */
if(window.GtAlive) safe('alive', function(){ GtAlive({'$':$, '$$':$$, STK:STK, OT_EXPR:OT_EXPR, ALL:ALL, ITEMS:ITEMS, S3_HOOKS:S3_HOOKS, REDUCED:REDUCED,
  vib:vib, tip:tip, sparkle:sparkle, burst:burst, centerOf:centerOf, openRecord:openRecord, openS3:openS3}); });
/* ──「我」页的游戏档案（mine.js） ── */
if(window.GtMine) safe('mine', function(){ GtMine({'$':$, '$$':$$, STK:STK, OT_EXPR:OT_EXPR, ITEMS:ITEMS, tagKey:tagKey, tip:tip, vib:vib, REDUCED:REDUCED, openS3:openS3}); });
/* ── 记忆页 +「我」页的精彩 / 入口（memory.js） ── */
if(window.GtMemory) safe('memory', function(){ GtMemory({'$':$, '$$':$$, STK:STK, OT_EXPR:OT_EXPR, ITEMS:ITEMS, tagKey:tagKey, tip:tip, vib:vib, REDUCED:REDUCED,
  openS3:openS3, openRecord:openRecord, introMe:introMe, S3_HOOKS:S3_HOOKS}); });
/* ── 家族标：启动 / 关于 / 桌面（brand.js） ── */
if(window.GtBrand) safe('brand', function(){ GtBrand({'$':$, vib:vib, tip:tip, toast:toast, REDUCED:REDUCED, openS3:openS3, S3_HOOKS:S3_HOOKS}); });
/* ── 分享卡：版式 × 主题，见 share.js ── */
if(window.GtShare) safe('share', function(){ GtShare({'$':$, '$$':$$, OT_EXPR:OT_EXPR, EXPR_KEYS:EXPR_KEYS, tagsOf:tagsOf, mainTag:mainTag, tagName:tagName, tagKey:tagKey, STK:STK, recMedia:recMedia, mediaOf:mediaOf, fmtT:fmtT, brandize:brandize, typeInto:typeInto, ALL:ALL, ITEMS:ITEMS, S3_HOOKS:S3_HOOKS, safe:safe, REDUCED:REDUCED, vib:vib, toast:toast, confetti:confetti, centerOf:centerOf, openS3:openS3}); });

/* ── 全屏预览：点详情头图进入，左右滑、双击放大、长按播实况 ── */
/* ═══ GtMedia：图片 / 视频 / 实况 三件套 ════════════════════════════
   mediaOf(f)            一个素材的描述：kind = photo | video | live，clip = 视频或实况片段
   GtPlayer(host, m, o)  视频播放器：大播放钮带涟漪；进度条的拖柄是小獭，播放时小跑、拖动时专注；倍速 / 静音 / 全屏；看完小獭欢呼
   GtLive(host, m, o)    实况图：长按（或点角标）播 2 秒，角标三圈声纹跟着跳
   vwOpen(list, i, from, o)  全屏预览：从缩略图飞入、左右滑切换、下拉飞回、双击放大；编辑模式可设封面 / 移除 */
function mediaOf(f){
  if(f && f.kind) return f;
  var k=MEDIA_KIND[f]||'photo';
  return {f:f, kind:k, src:'assets/memories/'+f+'.webp', ar:MEDIA_AR[f]||720/900, dur:MEDIA_DUR[f]||0,
    clip:k==='video'?'assets/memories/video/'+f+'.mp4':k==='live'?'assets/memories/live/'+f+'.mp4':null,
    poster:k==='video'?'assets/memories/video/'+f+'.jpg':null};
}
function fmtT(s){ s=Math.max(0, Math.floor(s||0)); return Math.floor(s/60)+':'+('0'+s%60).slice(-2); }
function mediaBadge(m){
  if(m.kind==='video') return '<span class="md-bdg vid">'+MD_IC.play+fmtT(m.dur)+'</span>';
  if(m.kind==='live') return '<span class="md-bdg live"><i class="lv"><b></b><b></b><b></b></i>实况</span>';
  return '';
}

var GP_SPEEDS=[[0.5,'sleepy','慢慢看，小獭快睡着了'],[0.75,'calm','放慢一点，细节都在'],[1,'happy','正常速度'],[1.25,'proud','稍微快一点'],[1.5,'great','快进模式，冲！'],[2,'shock','两倍速，小獭跟不上了']];
function vwLand(on){
  var vw=$('#vw3'); if(!vw || vw.classList.contains('land')===on) return;
  tipHide(); vw.classList.add('turning'); vw.classList.toggle('land', on); vib(on?[6,20,10]:8);
  var k=$('#vwLand'); if(k) k.textContent=on?'竖屏':'';
  setTimeout(function(){ vw.classList.remove('turning'); }, 520);
}
window.vwLand=vwLand;
function GtPlayer(host, m, o){
  o=o||{}; var el=document.createElement('div'); el.className='gp ui'+(o.compact?' compact':''); el.dataset.st='idle';
  el.innerHTML='<video playsinline muted preload="metadata" poster="'+(m.poster||m.src)+'" src="'+m.clip+'"></video>'
    +'<button class="gp-big" aria-label="播放"><i class="rp"></i><i class="rp r2"></i><span class="ic">'+MD_IC.play+'</span></button>'
    +'<div class="gp-bar">'
    +  '<button class="gp-pp" aria-label="播放或暂停">'+MD_IC.play+'</button><span class="gp-t">0:00</span>'
    +  '<div class="gp-track"><i class="gp-rail"><i class="gp-buf"></i><i class="gp-fill"></i></i><span class="gp-knob"><img alt=""></span><span class="gp-tip">0:00</span></div>'
    +  '<span class="gp-d">'+fmtT(m.dur)+'</span>'
    +  '<button class="gp-sp" aria-label="倍速">1×</button>'
    +  (o.compact?'<button class="gp-fs" aria-label="全屏看">'+MD_IC.full+'</button>'
               :'<button class="gp-mu" aria-label="声音">'+MD_IC.mute+'</button><button class="gp-rot" aria-label="横屏 / 竖屏">'+MD_IC.rot+'</button>')
    +'</div>'
    +'<div class="gp-spd" role="dialog" aria-label="播放速度"><div class="hd"><img alt=""><span><b>播放速度</b><small></small></span></div><div class="opts"><i class="pill"></i>'
    +  GP_SPEEDS.map(function(x, i){ return '<button data-i="'+i+'">'+x[0]+'×</button>'; }).join('')+'</div></div>'
    +'<span class="gp-flash"></span>'
    +'<div class="gp-end"><img alt=""><b>看完啦</b><button class="gp-re">'+MD_IC.replay+'再看一遍</button></div>';
  host.appendChild(el);
  var v=el.querySelector('video'), knob=el.querySelector('.gp-knob img'), tr=el.querySelector('.gp-track'), tip=el.querySelector('.gp-tip');
  var raf=0, hideT=0, scrub=false, lastSec=-1, mood='';
  var face=function(k){ if(k!==mood){ mood=k; knob.src=STK(k); } };
  face('calm');
  var paint=function(){ var d=v.duration||m.dur||1, t=v.currentTime||0;
    el.style.setProperty('--p', Math.min(1, t/d)); el.querySelector('.gp-t').textContent=fmtT(t);
    if(v.buffered && v.buffered.length) el.style.setProperty('--b', Math.min(1, v.buffered.end(v.buffered.length-1)/d)); };
  var loop=function(){ paint(); if(!v.paused) raf=requestAnimationFrame(loop); };
  var showUi=function(){ el.classList.add('ui'); clearTimeout(hideT);
    if(!v.paused) hideT=setTimeout(function(){ if(!scrub && !el.classList.contains('spd-on')) el.classList.remove('ui'); }, 2600); };
  var setSt=function(st){ el.dataset.st=st; var pl=st==='play';
    el.querySelector('.gp-pp').innerHTML=pl?MD_IC.pause:MD_IC.play; el.querySelector('.gp-big .ic').innerHTML=pl?MD_IC.pause:MD_IC.play;
    if(!scrub) face(pl?'happy':'calm'); };
  var play=function(){ el.classList.remove('ended'); var pr=v.play(); if(pr && pr.catch) pr.catch(function(){}); };
  var pause=function(){ v.pause(); };
  v.addEventListener('play', function(){ setSt('play'); cancelAnimationFrame(raf); loop(); showUi(); host.classList.add('playing'); });
  v.addEventListener('pause', function(){ if(el.dataset.st!=='idle') setSt('pause'); cancelAnimationFrame(raf); paint(); showUi(); });
  v.addEventListener('loadedmetadata', function(){ el.querySelector('.gp-d').textContent=fmtT(v.duration); paint(); });
  v.addEventListener('ended', function(){ setSt('pause'); el.classList.add('ended'); var im=el.querySelector('.gp-end img'); im.src=STK('great');
    setTimeout(function(){ var c=centerOf(im); sparkle(c[0], c[1], {c:'255,210,122', n:10, r:64}); }, 220); vib([8,30,14]); });
  var toggle=function(e){ if(e) e.stopPropagation();
    var big=el.querySelector('.gp-big'); big.classList.remove('pop'); void big.offsetWidth; big.classList.add('pop');
    if(v.paused){ play(); var c=centerOf(big); sparkle(c[0], c[1], {c:'61,220,255', n:6, r:46}); } else pause(); vib(6); };
  el.querySelector('.gp-big').onclick=toggle; el.querySelector('.gp-pp').onclick=toggle;
  v.addEventListener('click', function(e){ e.stopPropagation(); if(el.dataset.st==='idle'){ toggle(); return; }
    if(el.classList.contains('ui') && !v.paused){ clearTimeout(hideT); el.classList.remove('ui'); } else showUi(); });
  var seek=function(e){ var r=tr.getBoundingClientRect(), land=!!el.closest('.vw3.land'),
      p=Math.max(0, Math.min(1, land?(e.clientY-r.top)/r.height:(e.clientX-r.left)/r.width)), d=v.duration||m.dur||1;
    try{ v.currentTime=p*d; }catch(err){}
    el.style.setProperty('--p', p); tip.textContent=fmtT(p*d); el.querySelector('.gp-t').textContent=fmtT(p*d);
    var sec=Math.floor(p*d); if(sec!==lastSec){ lastSec=sec; vib(3); } };
  tr.addEventListener('pointerdown', function(e){ e.stopPropagation(); scrub=true; el.classList.add('scrub'); face('focus');
    try{ tr.setPointerCapture(e.pointerId); }catch(err){} seek(e); showUi(); });
  tr.addEventListener('pointermove', function(e){ if(scrub) seek(e); });
  var endScrub=function(){ if(!scrub) return; scrub=false; el.classList.remove('scrub'); face(v.paused?'calm':'happy'); showUi();
    if(el.dataset.st==='idle') setSt('pause'); };
  tr.addEventListener('pointerup', endScrub); tr.addEventListener('pointercancel', endScrub);
  tr.addEventListener('click', function(e){ e.stopPropagation(); });
  /* 倍速：弹出选择层，小獭表情跟着速度变；选中后画面中间闪一下倍数 */
  var sp=el.querySelector('.gp-sp'), spd=el.querySelector('.gp-spd'), spI=2;
  var paintSpd=function(i, pre){ var x=GP_SPEEDS[i]; spd.style.setProperty('--i', i);
    spd.querySelector('.hd img').src=STK(x[1]); spd.querySelector('small').textContent=x[2];
    $$('.opts button', spd).forEach(function(b, j){ b.classList.toggle('on', j===i); });
    if(!pre){ var im=spd.querySelector('.hd img'); im.classList.remove('bob'); void im.offsetWidth; im.classList.add('bob'); } };
  var spOpen=function(on){ el.classList.toggle('spd-on', on); if(on){ clearTimeout(hideT); el.classList.add('ui'); paintSpd(spI, true); } else showUi(); };
  sp.onclick=function(e){ e.stopPropagation(); spOpen(!el.classList.contains('spd-on')); vib(5); };
  var setRate=function(i, quiet){ spI=i; var r=GP_SPEEDS[i][0]; v.playbackRate=r; v.defaultPlaybackRate=r; paintSpd(i, quiet);
    sp.textContent=r+'×'; el.classList.toggle('fast', r>1); el.classList.toggle('slow', r<1); el.style.setProperty('--trot', (0.5/r)+'s');
    if(quiet) return; sp.classList.remove('pop'); void sp.offsetWidth; sp.classList.add('pop');
    var fl=el.querySelector('.gp-flash'); fl.textContent=r+'×'; fl.classList.remove('on'); void fl.offsetWidth; fl.classList.add('on'); };
  $$('.opts button', spd).forEach(function(b){ b.onclick=function(e){ e.stopPropagation(); var i=+b.dataset.i; if(i===spI){ spOpen(false); return; }
    vib(i>spI?6:4); setRate(i);
    if(GP_SPEEDS[i][0]>1){ var c=centerOf(b); sparkle(c[0], c[1], {c:'61,220,255', n:5, r:34}); }
    setTimeout(function(){ spOpen(false); }, 380); }; });
  spd.addEventListener('click', function(e){ e.stopPropagation(); });
  el.addEventListener('click', function(){ if(el.classList.contains('spd-on')) spOpen(false); });
  /* 横竖屏：只在全屏预览里有，整层转 90°，进度条跟着按竖向坐标算 */
  var rot=el.querySelector('.gp-rot'); if(rot) rot.onclick=function(e){ e.stopPropagation(); var vw=el.closest('.vw3'); if(!vw) return; vwLand(!vw.classList.contains('land')); showUi(); };
  var mu=el.querySelector('.gp-mu'); if(mu) mu.onclick=function(e){ e.stopPropagation(); v.muted=!v.muted; mu.innerHTML=v.muted?MD_IC.mute:MD_IC.vol;
    mu.classList.remove('pop'); void mu.offsetWidth; mu.classList.add('pop'); vib(5); showUi(); };
  var fs=el.querySelector('.gp-fs'); if(fs) fs.onclick=function(e){ e.stopPropagation(); var t=v.currentTime, was=!v.paused; pause(); if(o.onExpand) o.onExpand(t, was, spI); };
  el.querySelector('.gp-re').onclick=function(e){ e.stopPropagation(); v.currentTime=0; play(); vib(6); };
  el.addEventListener('pointerdown', function(e){ if(e.target.closest('.gp-bar, .gp-big, .gp-end, .gp-spd')) e.stopPropagation(); });
  return {el:el, video:v, play:play, pause:pause, rate:function(i){ setRate(i, true); }, seek:function(t){ try{ v.currentTime=t; }catch(err){} paint(); },
    destroy:function(){ v.pause(); cancelAnimationFrame(raf); clearTimeout(hideT); host.classList.remove('playing'); el.remove(); }};
}

function GtLive(host, m, o){
  o=o||{}; var el=document.createElement('div'); el.className='gl';
  el.innerHTML='<video playsinline muted preload="auto" src="'+m.clip+'"></video>'
    +'<button class="gl-bdg" aria-label="播放实况"><i class="lv"><b></b><b></b><b></b></i>实况</button>'+(o.hint?'<span class="gl-hint">长按看实况</span>':'');
  host.appendChild(el);
  var v=el.querySelector('video'), t=0, on=false;
  var start=function(){ if(on) return; on=true; el.classList.add('on'); host.classList.add('live-on');
    try{ v.currentTime=0; }catch(err){} var pr=v.play(); if(pr && pr.catch) pr.catch(function(){}); vib(12); };
  var stop=function(){ if(!on) return; on=false; el.classList.remove('on'); host.classList.remove('live-on'); };
  v.addEventListener('ended', stop);
  var down=function(e){ if(e.target.closest('button, .gp')) return; host._long=false; clearTimeout(t); t=setTimeout(function(){ host._long=true; start(); }, 280); };
  var up=function(){ clearTimeout(t); };
  host.addEventListener('pointerdown', down); host.addEventListener('pointerup', up); host.addEventListener('pointerleave', up); host.addEventListener('pointercancel', up);
  el.querySelector('.gl-bdg').addEventListener('click', function(e){ e.stopPropagation(); start(); });
  return {el:el, play:start, stop:stop, destroy:function(){ v.pause(); stop();
    host.removeEventListener('pointerdown', down); host.removeEventListener('pointerup', up); host.removeEventListener('pointerleave', up); host.removeEventListener('pointercancel', up); el.remove(); }};
}

/* 全屏预览 */
var VW={list:[], i:0, from:null, o:{}, parts:[]};
function vwBox(i){ var s=$('#vwTrack').children[i]; return s && s.querySelector('.vw-m'); }
function vwFlip(from, to, back, done){
  if(REDUCED || !from || !to || !from.isConnected){ if(done) done(); return; }
  var a=from.getBoundingClientRect(), b=to.getBoundingClientRect(); if(!a.width || !b.width){ if(done) done(); return; }
  var s=Math.max(a.width/b.width, a.height/b.height), ix=Math.max(0, (b.width-a.width/s)/2), iy=Math.max(0, (b.height-a.height/s)/2);
  var dx=(a.left+a.width/2)-(b.left+b.width/2), dy=(a.top+a.height/2)-(b.top+b.height/2);
  var r0=(parseFloat(getComputedStyle(from).borderTopLeftRadius)||0)/s;
  var kA={transform:'translate('+dx+'px,'+dy+'px) scale('+s+')', clipPath:'inset('+iy+'px '+ix+'px round '+r0+'px)'}, kB={transform:'none', clipPath:'inset(0px 0px round 0px)'};
  var an=to.animate(back?[kB,kA]:[kA,kB], {duration:back?340:440, easing:back?'cubic-bezier(.4,0,.2,1)':'cubic-bezier(.2,.9,.25,1.05)', fill:back?'forwards':'none'});
  an.onfinish=function(){ if(done) done(); };
}
function vwChrome(){
  var m=VW.list[VW.i], k=$('#vwKind');
  k.innerHTML=m.kind==='video'?MD_IC.play+'视频 · '+fmtT(m.dur):m.kind==='live'?'<i class="lv"><b></b><b></b><b></b></i>实况 · 长按播放':'照片';
  k.className='vw-kind '+m.kind;
  $$('#vwDots i').forEach(function(d, j){ d.classList.toggle('on', j===VW.i); });
  $('#vwIdx').textContent=(VW.i+1)+' / '+VW.list.length;
  var cv=$('#vwCover'); if(cv){ var isC=VW.i===0; cv.disabled=isC; cv.querySelector('span').textContent=isC?'已是封面':'设为封面'; }
}
function vwGo(i, instant){
  VW.i=Math.max(0, Math.min(VW.list.length-1, i)); var tr=$('#vwTrack');
  tr.style.transition=instant?'none':''; tr.style.transform='translateX('+(-VW.i*100)+'%)';
  VW.parts.forEach(function(p, j){ if(p && p.pause && j!==VW.i) p.pause(); if(p && p.stop && j!==VW.i) p.stop(); });
  $$('#vwTrack .vw-m.zoomed').forEach(function(z){ z.classList.remove('zoomed'); });
  vwChrome();
}
function vwBuild(){
  var tr=$('#vwTrack'); VW.parts.forEach(function(p){ if(p) p.destroy(); }); VW.parts=[]; tr.innerHTML='';
  $('#vwDots').innerHTML=VW.list.length>1?VW.list.map(function(){ return '<i></i>'; }).join(''):'';
  VW.list.forEach(function(m){ var sl=document.createElement('div'); sl.className='vw-sl';
    var box=document.createElement('div'); box.className='vw-m '+m.kind; box.style.aspectRatio=String(m.ar||.8);
    box.innerHTML='<img src="'+m.src+'" alt="">'; sl.appendChild(box); tr.appendChild(sl);
    VW.parts.push(m.kind==='video'?GtPlayer(box, m):m.kind==='live'?GtLive(box, m):null);
    if(m.kind==='photo'){ var last=0; box.addEventListener('click', function(e){ var n=Date.now();
      if(n-last<300){ var r=box.getBoundingClientRect(); box.style.transformOrigin=((e.clientX-r.left)/r.width*100)+'% '+((e.clientY-r.top)/r.height*100)+'%';
        box.classList.toggle('zoomed'); vib(5); last=0; } else { last=n; setTimeout(function(){ if(last===n) $('#vw3').classList.toggle('bare'); }, 300); } }); }
  });
}
function vwOpen(list, i, from, o){
  var vw=$('#vw3'); if(!vw) return; tipHide();
  VW.list=list.map(mediaOf); VW.o=o||{}; VW.from=from||null;
  vwBuild(); vw.classList.remove('bare','out'); vw.classList.add('on'); vw.style.setProperty('--bg', 1);
  $('#vwCap').textContent=VW.o.cap||''; $('#vwEdit').hidden=!VW.o.edit;
  vwGo(i||0, true);
  var p=VW.parts[VW.i]; if(p && p.seek && VW.o.at) p.seek(VW.o.at); if(p && p.rate && VW.o.rate!=null) p.rate(VW.o.rate);
  requestAnimationFrame(function(){ vwFlip(from, vwBox(VW.i), false, function(){ if(p && p.play && VW.o.autoplay) p.play();
    var rb=p && p.el && p.el.querySelector('.gp-rot'); if(rb) setTimeout(function(){ if(vw.classList.contains('on') && !vw.classList.contains('land')) tip(rb, '横过来看更带劲，倍速也能选', {mood:'happy', once:'gp-rot', ms:2800}); }, 700); }); });
  vib(6);
}
function vwClose(){
  var vw=$('#vw3'); if(!vw.classList.contains('on')) return;
  VW.parts.forEach(function(p){ if(p && p.pause) p.pause(); });
  var to=VW.i===0?VW.from:null, box=vwBox(VW.i);
  vw.classList.add('out');
  var fin=function(){ vw.classList.remove('on','out','land'); vw.style.removeProperty('--bg'); VW.parts.forEach(function(p){ if(p) p.destroy(); }); VW.parts=[]; $('#vwTrack').innerHTML=''; };
  if(to && box) vwFlip(to, box, true, fin); else setTimeout(fin, 240);
}
window.vwOpen=vwOpen;
safe('viewer', function(){
  var vw=$('#vw3'), tr=$('#vwTrack'); if(!vw) return;
  $('#vwClose').onclick=function(){ if(vw.classList.contains('land')){ vwLand(false); return; } vwClose(); };
  document.addEventListener('keydown', function(e){ if(!vw.classList.contains('on')) return;
    if(e.key==='Escape'){ if(vw.classList.contains('land')) vwLand(false); else vwClose(); } if(e.key==='ArrowRight') vwGo(VW.i+1); if(e.key==='ArrowLeft') vwGo(VW.i-1); });
  var x0=0, y0=0, mode='', dx=0, dy=0;
  tr.addEventListener('pointerdown', function(e){ if(vw.classList.contains('land')) return; if(e.target.closest('.gp-bar, .gp-big, .gp-end, .gp-spd, button')) return; if(e.target.closest('.vw-m.zoomed')) return;
    x0=e.clientX; y0=e.clientY; mode='?'; dx=dy=0; });
  window.addEventListener('pointermove', function(e){ if(!mode) return; dx=e.clientX-x0; dy=e.clientY-y0;
    if(mode==='?'){ if(Math.abs(dx)<8 && Math.abs(dy)<8) return; mode=Math.abs(dx)>Math.abs(dy)?'h':(dy>0?'v':''); if(!mode) return; }
    if(mode==='h'){ var edge=(VW.i===0 && dx>0)||(VW.i===VW.list.length-1 && dx<0); tr.style.transition='none';
      tr.style.transform='translateX(calc('+(-VW.i*100)+'% + '+(edge?dx*.3:dx)+'px))'; }
    if(mode==='v'){ var b=vwBox(VW.i), k=Math.max(0, dy); if(b){ b.style.transition='none'; b.style.transform='translate('+dx*.4+'px,'+k+'px) scale('+Math.max(.7, 1-k/900)+')'; }
      vw.style.setProperty('--bg', Math.max(.15, 1-k/420)); vw.classList.add('bare'); } });
  window.addEventListener('pointerup', function(){ if(!mode) return; var md=mode; mode='';
    if(md==='h'){ tr.style.transition=''; if(Math.abs(dx)>60) vwGo(VW.i+(dx<0?1:-1)); else vwGo(VW.i); if(Math.abs(dx)>60) vib(4); }
    if(md==='v'){ var b=vwBox(VW.i);
      if(dy>110){ if(b){ b.style.transition=''; } vwClose(); if(b) setTimeout(function(){ b.style.transform=''; }, 400); }
      else { if(b){ b.style.transition='transform .4s cubic-bezier(.3,1.4,.5,1)'; b.style.transform=''; } vw.style.setProperty('--bg', 1); vw.classList.remove('bare'); } } });
  $('#vwCover').onclick=function(){ if(VW.o.edit && VW.o.edit.cover){ VW.o.edit.cover(VW.i); var m=VW.list.splice(VW.i,1)[0]; VW.list.unshift(m);
    vwBuild(); vwGo(0, true); var c=centerOf($('#vwCover')); sparkle(c[0], c[1], {c:'255,210,122', n:8, r:50}); toast('设为封面了', {tone:'ok'}); vib([6,20,10]); } };
  $('#vwRm').onclick=function(){ if(!VW.o.edit || !VW.o.edit.remove) return; var i=VW.i; VW.o.edit.remove(i); VW.list.splice(i,1);
    var b=vwBox(i); if(b && !REDUCED) b.animate([{transform:'none', opacity:1},{transform:'translateY(60px) scale(.8)', opacity:0}], {duration:260, easing:'ease-in'});
    vib(8); setTimeout(function(){ if(!VW.list.length){ VW.from=null; vwClose(); return; } vwBuild(); vwGo(Math.min(i, VW.list.length-1), true); }, 240); };
});

/* 藏品详情头图：按素材类型挂播放器 / 实况；点开全屏 */
var HERO={p:null, list:[]};
function recMedia(it){
  if(!it.img) return it.cover?[{kind:'photo', src:'assets/games/'+it.cover+'.webp', ar:1}]:[];
  var pool=it.img.indexOf('game_')===0?['game_gacha','game_boss','game_city']:['life_ramen','life_sunset','life_rain','life_friends'];
  return [it.img].concat(pool.filter(function(f){ return f!==it.img; }).slice(0,2)).map(mediaOf);
}
function heroMedia(it){
  var box=$('#s3-record .rd-hero'); if(!box) return;
  if(HERO.p){ HERO.p.destroy(); HERO.p=null; }
  $$('.rd-cnt, .gl, .gp', box).forEach(function(x){ x.remove(); }); box.classList.remove('playing','live-on');
  HERO.list=recMedia(it); if(!HERO.list.length || (it.note && !it.img)) return;
  var m=HERO.list[0];
  if(m.kind==='video') HERO.p=GtPlayer(box, m, {compact:true, onExpand:function(t, was, ri){ vwOpen(HERO.list, 0, box.querySelector('video'), {cap:$('#rdT').textContent, at:t, rate:ri, autoplay:true}); }});
  else if(m.kind==='live') HERO.p=GtLive(box, m, {hint:true});
  if(HERO.list.length>1) box.insertAdjacentHTML('beforeend', '<span class="rd-cnt"><svg viewBox="0 0 24 24"><rect x="3.5" y="6.5" width="13" height="13" rx="2.5"/><path d="M7.5 3.5h10a3 3 0 0 1 3 3v10"/></svg>1 / '+HERO.list.length+'</span>');
}
safe('hero-media', function(){
  var box=$('#s3-record .rd-hero'); if(!box) return;
  box.addEventListener('click', function(e){ if(box._long){ box._long=false; return; } if(e.target.closest('.gp, .gl-bdg') || box.classList.contains('note')) return;
    if(!HERO.list.length) return; vwOpen(HERO.list, 0, $('#rdImg'), {cap:$('#rdT').textContent}); });
});

/* ── 设置 / 关于 / AI / 通知 / 法律 ─────────────────────────── */
/* 小獭音效：WebAudio 现场合成，和 App 的 GtSound 六种一一对应 */
var AUD=null;
function sfx(kind){
  try{ AUD=AUD||new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return; }
  var t0=AUD.currentTime+.02;
  var note=function(f, at, dur, type, vol){ var o=AUD.createOscillator(), g=AUD.createGain();
    o.type=type||'sine'; o.frequency.setValueAtTime(f, t0+at);
    g.gain.setValueAtTime(0, t0+at); g.gain.linearRampToValueAtTime(vol||.18, t0+at+.015); g.gain.exponentialRampToValueAtTime(.0001, t0+at+dur);
    o.connect(g); g.connect(AUD.destination); o.start(t0+at); o.stop(t0+at+dur+.02); };
  ({ celebrate:function(){ [523,659,784,1047].forEach(function(f,i){ note(f, i*.09, .5, 'triangle'); }); },
     store:function(){ note(392,0,.18,'triangle'); note(784,.12,.45,'sine',.2); note(1175,.2,.5,'sine',.08); },
     start:function(){ note(440,0,.12,'sine'); note(660,.09,.22,'sine'); },
     end:function(){ note(660,0,.12,'sine'); note(440,.09,.28,'sine'); },
     near:function(){ note(880,0,.25,'sine',.14); note(880,.32,.25,'sine',.14); },
     over:function(){ [0,.18,.36].forEach(function(at){ note(988, at, .14, 'square', .07); }); }
  })[kind]();
}
window.v3sfx=sfx;

S3_HOOKS['s3-settings']=function(){
  otPaint($('#s3-settings'));
  $$('#stBar i').forEach(function(b,i){ b.classList.remove('in'); void b.offsetWidth; setTimeout(function(){ b.classList.add('in'); }, 260+i*120); });
  var on=$('#aiMaster') && $('#aiMaster').classList.contains('on'), cur=AI_CONNS.filter(function(c){ return c.on; })[0];
  $('#setAiS').textContent=on?(cur?cur.n:'未选连接')+' · 复盘、标签、文案、问候、聊天':'已关闭 · 不会发出任何 AI 请求';
  $('#setAiDot').className='st-dot'+(on?'':' off');
};
/* 设置里的行：按下时图标小跳一下 */
document.addEventListener('pointerdown', function(e){
  var r=e.target.closest('.s3 .rw[role="button"]'); if(!r || REDUCED) return;
  var ic=r.querySelector('.si'); if(ic) ic.animate([{transform:'none'},{transform:'scale(.86) rotate(-8deg)', offset:.4},{transform:'scale(1.08) rotate(4deg)', offset:.75},{transform:'none'}], {duration:420, easing:'cubic-bezier(.34,1.45,.64,1)'});
}, true);

var LEGAL={
  privacy:{t:'隐私政策', rt:'约 2 分钟读完', s:[
    ['我们收集什么','水獭游时不需要注册，也没有账号。你记下的每一局、每一张图、每一句话，都只保存在这台手机里。'],
    ['本机设备码','为了让备份文件能认出是哪台手机导出的，我们会生成一个本机设备码（Android 用 ANDROID_ID，iOS 用 IDFV，取不到时随机生成）。它不会离开你的手机。'],
    ['AI 功能','AI 是可选的。打开后，复盘、标签、文案和问候会由你自己填写的厂商地址直接生成，请求从手机直连厂商，不经过我们的服务器。密钥只存在这台手机上。'],
    ['通知','提醒在本机定时触发，内容不会上传。你可以随时在系统设置里关掉通知权限。'],
    ['你的权利','你可以随时导出存档、删除任意记录（会先进回收站待 30 天），或卸载 App 清空全部数据。']]},
  terms:{t:'用户协议', rt:'约 1 分钟读完', s:[
    ['欢迎来玩','水獭游时是一个帮你记下游戏和生活时间的小工具。它不评判你玩了多久，只帮你看见时间花在了哪里。'],
    ['你的内容','你记下的内容归你所有。导出的存档可以带去新手机，也可以自己保管。'],
    ['AI 生成的内容','AI 给出的永远是草稿，发布与否由你决定。请不要把它当作专业建议。'],
    ['小小的约定','请不要用水獭游时记录违法内容，也不要尝试破解或篡改 App。'],
    ['联系我们','有任何疑问，都可以在「关于水獭游时」里找到我们。']]}
};
function openLegal(k){
  var L=LEGAL[k]; if(!L) return;
  $('#lgT').textContent=L.t; $('#lgRt').textContent=L.rt;
  $('#lgBody').innerHTML=L.s.map(function(x,i){ return '<section class="lg-sec"><h3><em>'+String(i+1).padStart(2,'0')+'</em>'+x[0]+'</h3><p>'+x[1]+'</p></section>'; }).join('');
  $('#lgEnd').classList.remove('on'); openS3('s3-legal');
}
document.addEventListener('click', function(e){ var l=e.target.closest('[data-legal]'); if(l) openLegal(l.dataset.legal); });
safe('legal', function(){
  var s3=$('#s3-legal'), end=$('#lgEnd'); if(!s3) return;
  s3.addEventListener('scroll', function(){ if(end.classList.contains('on')) return;
    if(s3.scrollTop+s3.clientHeight > s3.scrollHeight-40){ end.classList.add('on'); vib(8);
      var c=centerOf(end.querySelector('img')); sparkle(c[0], c[1], {c:'110,231,168', n:7, r:46}); } });
});

safe('about', function(){
  var d=$('#abDev'); if(d) d.onclick=function(){ if(navigator.clipboard) navigator.clipboard.writeText('A7C2-91F0-3B6E').catch(function(){});
    var v=$('#abDevV'); v.classList.remove('copied'); void v.offsetWidth; v.classList.add('copied');
    toast('本机设备码已复制', {tone:'ok'}); vib(8); };
  var ob=$('#abOnb'); if(ob) ob.onclick=function(){ showOnboard(); };
  var lg=$('#s3-about .ab-logo'); if(lg) lg.addEventListener('click', function(){ var c=centerOf(lg); sparkle(c[0],c[1],{c:'61,220,255', n:10, r:70}); vib(10); lg.classList.remove('tick'); void lg.offsetWidth; lg.classList.add('tick'); });
  var ck=$('#abChk'), nt=$('#abNote'); if(ck) ck.onclick=function(){ if(ck.classList.contains('busy')) return;
    ck.classList.add('busy'); ck.querySelector('span').textContent='检查中'; nt.textContent='小獭在对照打包配置…';
    setTimeout(function(){ ck.classList.remove('busy'); ck.classList.add('ok'); ck.querySelector('span').textContent='已是最新';
      nt.textContent='0.90.1 (91) 就是现在最新的版本'; var c=centerOf(ck); sparkle(c[0],c[1],{c:'110,231,168', n:8, r:56});
      toast('已是最新版本', {tone:'ok'}); setTimeout(function(){ ck.classList.remove('ok'); ck.querySelector('span').textContent='检查版本'; }, 2600); }, 1200); };
});

/* AI 连接：一条连接 = 名称 + 地址 + 模型 + 密钥；只有一条「使用中」 */
var AI_CONNS=[
  {n:'我的豆包', lg:'豆', c:'61,220,255', url:'https://ark.cn-beijing.volces.com/api/v3', m:'doubao-seed-1.6', k:'sk-ark-7Hq2', on:true, ok:true},
  {n:'DeepSeek 官方', lg:'D', c:'110,150,255', url:'https://api.deepseek.com/v1', m:'deepseek-chat', k:'sk-ds-91fA', on:false, ok:true}
];
var AI_PRE=[['豆包','豆','61,220,255','https://ark.cn-beijing.volces.com/api/v3','doubao-seed-1.6'],['DeepSeek','D','110,150,255','https://api.deepseek.com/v1','deepseek-chat'],
  ['Kimi','K','255,170,90','https://api.moonshot.cn/v1','moonshot-v1-8k'],['通义千问','通','150,120,255','https://dashscope.aliyuncs.com/compatible-mode/v1','qwen-plus'],
  ['智谱','智','110,231,168','https://open.bigmodel.cn/api/paas/v4','glm-4-flash'],['OpenAI','O','200,200,210','https://api.openai.com/v1','gpt-4.1-mini'],
  ['Claude','C','255,180,120','','claude-haiku-4-5'],['Gemini','G','120,200,255','','gemini-2.5-flash']];
var cnCur=null; window.AI_CONNS=AI_CONNS;
function paintConns(){
  var box=$('#aiConns'); if(!box) return; box.innerHTML='';
  AI_CONNS.forEach(function(c, i){ var r=document.createElement('div'); r.className='rw cn-row'+(c.on?' on':''); r.setAttribute('role','button');
    r.innerHTML='<span class="cn-lg" style="--c:'+c.c+'">'+c.lg+'</span><span class="l">'+c.n+'<small>'+c.m+' · '+(c.ok?'可用':'还不能用 · 地址 / 模型 / 密钥没填全')+'</small></span>'
      +(c.on?'<span class="cn-badge">使用中</span>':(c.ok?'<button class="cn-use">设为当前</button>':''));
    r.onclick=function(e){ if(e.target.closest('.cn-use')){ AI_CONNS.forEach(function(x){ x.on=x===c; }); paintConns(); paintAiSt();
        var nr=box.children[i], p=centerOf(nr.querySelector('.cn-lg')); sparkle(p[0],p[1],{c:c.c, n:8, r:48}); vib([6,20,10]);
        toast('现在用「'+c.n+'」', {tone:'ok'}); return; }
      editConn(c); };
    box.appendChild(r); });
}
function paintAiSt(){
  var on=$('#aiMaster').classList.contains('on'), cur=AI_CONNS.filter(function(c){ return c.on; })[0];
  $('#aiMs').textContent=on?'已开启 · '+(cur?cur.n:'先选一条连接'):'已关闭 · 不会发出任何 AI 请求';
  $('#aiStT').textContent=on?'小獭在线':'小獭在休息';
  $('#aiStS').textContent=on?(cur?cur.n+' · '+cur.m+' · 连续失败 0 次':'还没有可用的连接'):'打开总开关，复盘和文案才会出现';
  $('#aiDot').className='dot'+(on?'':' off');
  $('#s3-ai .ai-st img').src=otSrc(on?otPick('aiOn'):'sleepy');
  if(window.ctPaintMode) ctPaintMode();
  $('#aiBody').classList.toggle('off', !on);
}
function editConn(c, pre){
  cnCur=c||null; var d=c||{n:pre?pre[0]:'', lg:pre?pre[1]:'+', c:pre?pre[2]:'160,170,200', url:pre?pre[3]:'', m:pre?pre[4]:'', k:''};
  $('#cnTitle').textContent=c?'连接设置':'新建连接';
  $('#cnName').value=d.n; $('#cnUrl').value=d.url; $('#cnModel').value=d.m; $('#cnKey').value=d.k; $('#cnKey').type='password';
  $('#cnLg').textContent=d.lg; $('#cnPrev').style.setProperty('--c', d.c); $('#cnNm').textContent=d.n||'自定义连接';
  $('#cnSt').textContent=c?'上次测试：可用':'填好密钥就能测试'; $('#cnOt').src=STK('calm');
  $('#cnRes').className='cn-res'; $('#cnRes').textContent=''; $('#cnDel').parentElement.style.display=c?'':'none';
  openSheet('sh3-conn');
}
safe('ai', function(){
  if(!$('#aiConns')) return;
  paintConns();
  var pre=$('#aiPre');
  AI_PRE.forEach(function(p){ var b=document.createElement('button'); b.style.setProperty('--c', p[2]);
    b.innerHTML='<span class="cn-lg">'+p[1]+'</span>'+p[0]; b.onclick=function(){ editConn(null, p); }; pre.appendChild(b); });
  var cu=document.createElement('button'); cu.className='cu'; cu.innerHTML='<span class="cn-lg">＋</span>自定义'; cu.onclick=function(){ editConn(null); }; pre.appendChild(cu);
  var ms=$('#aiMaster'); ms.onclick=function(){ ms.classList.toggle('on'); paintAiSt(); vib(ms.classList.contains('on')?[6,20,10]:8);
    if(ms.classList.contains('on')){ var c=centerOf(ms); sparkle(c[0],c[1],{c:'190,150,255', n:8, r:50}); } };
  paintAiSt();
  $('#cnName').addEventListener('input', function(){ $('#cnNm').textContent=this.value||'自定义连接'; });
  $('#cnEye').onclick=function(){ var k=$('#cnKey'); k.type=k.type==='password'?'text':'password'; this.classList.toggle('on'); vib(4); };
  var n=0, t=$('#cnTest');
  t.onclick=function(){ if(t.classList.contains('busy')) return;
    var res=$('#cnRes');
    if(!$('#cnUrl').value || !$('#cnModel').value || !$('#cnKey').value){ res.className='cn-res bad on'; res.textContent='地址、模型名、密钥都要填'; $('#cnOt').src=STK('shock');
      t.classList.remove('nudge'); void t.offsetWidth; t.classList.add('nudge'); vib(20); return; }
    n++; t.classList.add('busy'); t.querySelector('span').textContent='测试中…'; $('#cnOt').src=STK('focus'); $('#cnSt').textContent='小獭在连线…'; res.className='cn-res';
    setTimeout(function(){ t.classList.remove('busy'); t.querySelector('span').textContent='再测一次'; var ok=n%3!==0;
      res.className='cn-res on '+(ok?'ok':'bad');
      res.textContent=ok?'连接成功 · 模型回复：「你好呀，我在。」 · 延迟 420ms':'没连上 · 401 Unauthorized，密钥好像不对';
      $('#cnOt').src=STK(ok?'great':'cry'); $('#cnSt').textContent=ok?'可用 · 刚刚测试':'不可用 · 刚刚测试';
      if(ok){ var c=centerOf($('#cnOt')); sparkle(c[0],c[1],{c:'110,231,168', n:9, r:52}); } vib(ok?[8,30,14]:[20,40,20]); }, 1200); };
  $('#cnSave').onclick=function(){
    var nm=$('#cnName').value||'自定义连接', ok=!!($('#cnUrl').value && $('#cnModel').value && $('#cnKey').value);
    if(cnCur){ cnCur.n=nm; cnCur.url=$('#cnUrl').value; cnCur.m=$('#cnModel').value; cnCur.k=$('#cnKey').value; cnCur.ok=ok; }
    else AI_CONNS.push({n:nm, lg:$('#cnLg').textContent, c:$('#cnPrev').style.getPropertyValue('--c')||'160,170,200', url:$('#cnUrl').value, m:$('#cnModel').value||'未填模型', k:$('#cnKey').value, on:false, ok:ok});
    var tgt=cnCur||AI_CONNS[AI_CONNS.length-1]; if(tgt) tgt.real=ok && $('#cnKey').value.length>=16;
    closeSheet(); paintConns(); paintAiSt(); toast(ok?'连接存好了':'先存着，密钥填好就能用', {tone:ok?'ok':'info'}); };
  $('#cnDel').onclick=function(){ if(!cnCur) return; var c=cnCur;
    ask({mood:'cry', danger:true, title:'删除「'+c.n+'」？', body:'密钥会一并从这台手机上清除。', ok:'删除', no:'留着',
      onOk:function(){ AI_CONNS.splice(AI_CONNS.indexOf(c),1); if(c.on && AI_CONNS[0]) AI_CONNS[0].on=true; closeSheet(); paintConns(); paintAiSt(); toast('连接删掉了', {tone:'undo'}); } }); };
});

safe('notify', function(){
  $$('#ntSnd [data-snd]').forEach(function(r){ r.onclick=function(){
    $$('#ntSnd [data-snd]').forEach(function(x){ x.classList.toggle('on',x===r); x.classList.remove('play'); });
    if(r.querySelector('.l').firstChild.textContent!=='静音'){ r.classList.add('play'); setTimeout(function(){ r.classList.remove('play'); }, 1200); sfx('store'); }
    vib(6); }; });
  var v=$('#ntVib'); if(v) $$('span',v).forEach(function(s,i){ s.onclick=function(){
    $$('span',v).forEach(function(x){x.classList.toggle('on',x===s);}); v.style.setProperty('--i',i);
    v.classList.remove('shake'); void v.offsetWidth; v.classList.add('shake'); vib([6,14,30][i]); }; });
  $$('#ntTry button').forEach(function(b){ b.onclick=function(){
    b.classList.remove('play'); void b.offsetWidth; b.classList.add('play'); setTimeout(function(){ b.classList.remove('play'); }, 1100);
    sfx(b.dataset.snd); tabPeek(b, b.dataset.m); var c=centerOf(b); sparkle(c[0], c[1], {c:getComputedStyle(b).getPropertyValue('--c').trim(), n:6, r:40});
    vib(b.dataset.snd==='over'?[20,40,20]:8); }; });
  var pb=$('#ntPermB'), ps=$('#ntPermS'); if(pb) pb.onclick=function(){ if(pb.classList.contains('ok')) return;
    pb.classList.add('busy'); pb.textContent='';
    setTimeout(function(){ pb.classList.remove('busy'); pb.classList.add('ok'); pb.textContent='已允许'; ps.textContent='已允许，提醒可正常送达';
      $('#ntPerm').classList.add('granted'); var c=centerOf(pb); sparkle(c[0],c[1],{c:'110,231,168', n:8, r:46});
      toast('通知开好了，到点小獭会来敲你', {tone:'ok'}); vib([8,30,14]); }, 900); };
});

/* ── 和小獭聊天（chat-gen：只在用户发送时调用；AI 没开就是本地陪聊） ──────────────
   记忆点：她会「听」——你打字时她专注地看着输入框；回复是一个字一个字冒出来的，标点处会停顿；
   回完换上对应表情，偶尔甩一张表情贴纸，再给两个接话的小选项。 */
var OT_REPLY=[
  [/玩得多|多久|时长/, '今天 1 小时 37 分，离 3 小时上限还有 1 小时 23 分。节奏很好哦～', 'happy', ['那我再玩一局？','帮我想个收工理由']],
  [/收工|理由|睡/, '收工理由：明天的你会感谢今天的你。还有，我想听你讲讲今天的高光～', 'calm', ['今天的高光是…','好吧，收工！']],
  [/最爱|哪款|喜欢/, '这周你在星穹铁道上花了 4.8 小时，是最多的一款。第三次通关深渊那天你超开心！', 'proud', ['那天确实超爽','其他游戏呢？']],
  [/笑话/, '为什么水獭睡觉要手牵手？因为怕一觉醒来，漂到别的游戏里去了。', 'love', ['再来一个','哈哈哈哈']],
  [/累|烦|难过|输|跪/, '抱抱。连跪的时候先放下手柄，喝口水，我陪你待一会儿。', 'relief', ['好，休息一下','再试最后一局']],
  [/赢|上分|通关|出金|欧|超神/, '真的假的！快把这一刻收进藏品，我要裱起来！', 'great', ['去记一条','还想听你夸我']],
  [/再玩|一局/, '可以呀～不过这局打完就到 2 小时 30 分了，我会在快到上限时轻轻提醒你。', 'focus', ['好的，开战','算了今天收工']],
  [/好吧|收工|休息/, '好耶，今天也是自律的一天！小獭给你盖个章 ✦', 'cheer', ['明天见','今天表现几分？']],
  [/.*/, '嗯嗯，我记下了。要不要把这一刻收进藏品？', 'happy', ['好呀','不用啦']]
];
var CT_STK=['happy','great','love','cry','shock','sleepy','proud','angry','hug','thanks','hungry','goodnight'];
var CT_STK_REPLY={happy:['你开心我就开心～','happy'], great:['击掌！这一刻我们一起记住','great'], love:['我也最喜欢你啦','love'], cry:['不哭不哭，我在呢','relief'],
  shock:['发生什么了？！快跟我说','shock'], sleepy:['困了就睡吧，明天见～','sleepy'], proud:['你最棒了，骄傲！','proud'], angry:['谁惹你了？我去咬他','angry'],
  hug:['抱抱！今天辛苦啦','hug'], thanks:['跟我还客气什么～','shy'], hungry:['我也饿了，一起去找吃的','yum'], goodnight:['晚安，明天见～','goodnight']};
var CT={busy:false, stop:null, hist:[], typingT:0};

function ctConn(){
  var ms=$('#aiMaster'), cs=$('#aiChatSw'), c=AI_CONNS.filter(function(x){ return x.on; })[0];
  var on=!ms||ms.classList.contains('on'), chat=!cs||cs.classList.contains('on');
  return {ai:on&&chat&&!!c&&c.ok, on:on, chat:chat, c:c};
}
function ctPaintMode(){
  var st=ctConn(), md=$('#ctMode'); if(!md) return;
  var txt=!st.on?['AI 没开','现在是小獭的本地陪聊，只会说几句','去开启']
    : !st.chat?['「和小獭聊天」关着','在 AI 设置里打开后，就能真正聊起来','去打开']
    : !st.c||!st.c.ok?['连接还不能用','填好地址、模型和密钥就能聊','去填写'] : null;
  md.hidden=!txt;
  if(txt) md.innerHTML='<img src="'+otSrc('sleepy', true)+'" alt=""><span><b>'+txt[0]+'</b><small>'+txt[1]+'</small></span><em>'+txt[2]+' ›</em>';
  $('#ctModel').textContent=st.ai?st.c.n:'本地';
  $('#ctModel').classList.toggle('off', !st.ai);
  if(!CT.busy) $('#ctSt').textContent=st.ai?'在线 · '+st.c.m:'本地陪聊';
  $('#ctOn').classList.toggle('off', !st.ai);
  $('#ctFoot').textContent=st.ai?'由「'+st.c.n+'」生成 · 只在你发送时调用 · 密钥只存在这台手机':'AI 未开启 · 小獭用本机话术陪你';
}
window.ctPaintMode=ctPaintMode;

/* 小獭换表情：大图和头像一起，带一下弹跳 */
function ctFace(k){
  var im=$('#otImg'), av=$('#ctAv'); if(!im) return;
  var src=otSrc(k); if(im.getAttribute('src')!==src){ im.src=src;
    if(!REDUCED) im.animate([{transform:'scale(.88) translateY(6px)'},{transform:'scale(1.05) translateY(-4px)',offset:.6},{transform:'none'}],{duration:420,easing:'cubic-bezier(.3,1.5,.5,1)'}); }
  var as=otSrc(k==='hi'?'happy':k==='think'?'focus':k, true);
  if(av.getAttribute('src')!==as){ av.src=as; av.parentNode.classList.remove('pop'); void av.offsetWidth; av.parentNode.classList.add('pop'); }
}
function ctStatus(t, busy){ var s=$('#ctSt'); s.textContent=t; s.classList.toggle('busy', !!busy); }
function ctScroll(force){ var s3=$('#s3-otter'); if(!s3) return;
  if(force || s3.scrollHeight-s3.scrollTop-s3.clientHeight<160) s3.scrollTo({top:s3.scrollHeight, behavior:REDUCED?'auto':'smooth'}); }
function ctEsc(t){ return String(t).replace(/[&<>]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]; }); }

function ctRow(role, inner, cls){
  var log=$('#otLog'), last=log.lastElementChild, row=document.createElement('div');
  var cont=last && last.classList.contains(role) && !last.classList.contains('sys');
  row.className='cm '+role+(cls?' '+cls:'')+(cont?' cont':'');
  row.innerHTML=(role==='ot'?'<img class="cm-av" src="'+otSrc('happy', true)+'" alt="">':'')+'<div class="cm-b">'+inner+'</div>';
  log.appendChild(row); $('#s3-otter').classList.add('chatting');
  if(cont && last) last.classList.add('more');
  return row;
}
/* 打字机：按字吐出，标点处停顿；外部可以不断喂新文字（流式），最后 end() */
function ctTyper(el, onDone){
  var q='', out='', ended=false, t=0, caret=document.createElement('i'); caret.className='ct-caret';
  var txt=document.createElement('span'); el.appendChild(txt); el.appendChild(caret);
  var tick=function(){ if(!q.length){ if(ended){ caret.remove(); onDone && onDone(out); return; } t=setTimeout(tick, 60); return; }
    var ch=q[0]; q=q.slice(1); out+=ch; txt.textContent=out; if(out.length%6===0) ctScroll();
    t=setTimeout(tick, REDUCED?0:/[。！？!?~～]/.test(ch)?220:/[，、,；：]/.test(ch)?110:22+Math.random()*26); };
  t=setTimeout(tick, 80);
  return {feed:function(s){ q+=s; }, end:function(){ ended=true; }, kill:function(){ clearTimeout(t); q=''; caret.remove(); out+='…'; txt.textContent=out; onDone && onDone(out, true); },
    text:function(){ return out+q; }};
}
function ctMoodOf(t){ return /抱|累|难过|哭|不哭/.test(t)?'relief':/哇|！！|超|棒|耶|击掌/.test(t)?'great':/喜欢|爱/.test(t)?'love':/嗯|好的|可以/.test(t)?'happy':'hi'; }

/* 真连接：OpenAI 兼容 /chat/completions 流式；失败就交给调用方显示错误 */
function ctRemote(c, onDelta){
  var ctl=window.AbortController?new AbortController():null;
  var sys='你是「小獭」，水獭游时里陪玩家的水獭小助手。语气温柔俏皮，回答简短（80 字以内），可以用「～」。只根据下面的本机数据回答，不编造：'
    +'今天已玩 1 小时 37 分，上限 3 小时；连续记录 12 天；本周玩得最多的是崩坏：星穹铁道 4.8 小时；最近的藏品：终于出金了、深渊第三次通关。不提供运势占卜类内容。';
  var body={model:c.m, stream:true, messages:[{role:'system', content:sys}].concat(CT.hist.slice(-10))};
  var p=fetch(c.url.replace(/\/$/,'')+'/chat/completions', {method:'POST', signal:ctl&&ctl.signal,
      headers:{'Content-Type':'application/json', 'Authorization':'Bearer '+c.k}, body:JSON.stringify(body)})
    .then(function(r){ if(!r.ok) return r.text().then(function(t){ throw new Error(r.status+' '+(t||'').slice(0,80)); });
      var rd=r.body.getReader(), dec=new TextDecoder(), buf='';
      var pump=function(){ return rd.read().then(function(x){ if(x.done) return;
        buf+=dec.decode(x.value, {stream:true}); var ls=buf.split('\n'); buf=ls.pop();
        ls.forEach(function(l){ l=l.trim(); if(l.indexOf('data:')!==0) return; var d=l.slice(5).trim(); if(d==='[DONE]') return;
          try{ var j=JSON.parse(d), s=j.choices&&j.choices[0]&&j.choices[0].delta&&j.choices[0].delta.content; if(s) onDelta(s); }catch(e){} });
        return pump(); }); };
      return pump(); });
  return {done:p, abort:function(){ if(ctl) ctl.abort(); }};
}

function ctSug(row, list){
  if(!list || !list.length) return;
  var w=document.createElement('div'); w.className='cm-sug';
  list.forEach(function(t, i){ var b=document.createElement('button'); b.textContent=t; b.style.setProperty('--i', i);
    b.onclick=function(){ w.classList.add('used'); b.classList.add('picked'); otSend(t); }; w.appendChild(b); });
  row.appendChild(w);
}
function ctBusy(on){
  CT.busy=on; var sd=$('#otSend'); sd.classList.toggle('stop', on); sd.disabled=!on && !$('#otIn').value.trim();
  sd.setAttribute('aria-label', on?'停止':'发送'); $('#ctDock').classList.toggle('busy', on);
}

function otSend(text, stk){
  text=(text||'').trim(); if((!text && !stk) || CT.busy) return;
  tipHide();
  $$('#otLog .cm-sug:not(.used)').forEach(function(w){ w.classList.add('used'); });
  var me=ctRow('you', stk?'<img class="cm-stk" src="'+otSrc(stk)+'" alt="">':ctEsc(text), stk?'stk':'');
  if(!REDUCED){ var sd=$('#otSend'), c=centerOf(sd); sparkle(c[0], c[1], {c:'61,220,255', n:5, r:30}); }
  CT.hist.push({role:'user', content:stk?'[发了一个「'+OT_EXPR[stk].n+'」表情]':text});
  ctScroll(true); vib(6); ctBusy(true);
  var st=ctConn();
  /* 已读 → 思考中 */
  setTimeout(function(){ me.classList.add('read'); }, 350);
  ctFace('think'); ctStatus('正在想', true);
  var row=ctRow('ot', '<span class="ct-dots"><i></i><i></i><i></i></span>', 'wait'); ctScroll(true);
  var b=row.querySelector('.cm-b'), hit, reply, mood, sugs, remote=null, killed=false;
  if(stk){ var sr=CT_STK_REPLY[stk]; reply=sr[0]; mood=sr[1]; sugs=null; }
  else { hit=OT_REPLY.filter(function(p){ return p[0].test(text); })[0]; reply=hit[1]; mood=hit[2]; sugs=hit[3]; }
  var finish=function(out, stopped){
    CT.stop=null; ctBusy(false); row.classList.remove('live');
    CT.hist.push({role:'assistant', content:out});
    var k=mood||ctMoodOf(out); ctFace(k); ctStatus(st.ai?'在线 · '+st.c.m:'本地陪聊');
    if(stopped){ row.classList.add('stopped'); return; }
    if(stk || (hit && hit[2]==='great') || (hit && hit[2]==='love')) setTimeout(function(){
      var sr=ctRow('ot', '<img class="cm-stk" src="'+otSrc(k)+'" alt="">', 'stk'); ctScroll(true); vib(8);
      if(k==='great' && !REDUCED){ var c=centerOf(sr.querySelector('.cm-stk')); sparkle(c[0], c[1], {c:'255,210,122', n:9, r:60}); } }, 260);
    if(sugs) setTimeout(function(){ ctSug(row, sugs); ctScroll(); }, stk?0:380);
  };
  var start=function(){
    b.innerHTML=''; row.classList.remove('wait'); row.classList.add('live'); ctStatus('正在输入', true); ctFace('happy');
    var ty=ctTyper(b, function(out, stopped){ finish(out, stopped); });
    CT.stop=function(){ killed=true; if(remote) remote.abort(); ty.kill(); };
    if(st.ai && st.c.real){
      remote=ctRemote(st.c, function(d){ ty.feed(d); });
      mood=null; sugs=null;
      remote.done.then(function(){ if(!ty.text()) ty.feed('嗯……我刚刚走神了，再说一次好不好？'); ty.end(); })
        .catch(function(e){ if(killed) return; ty.kill(); row.classList.remove('stopped'); row.classList.add('err'); setTimeout(function(){ ctScroll(true); }, 60);
          b.innerHTML='<b>没连上「'+ctEsc(st.c.n)+'」</b><small>'+ctEsc(String(e.message||e).slice(0,90))+'</small><span class="cm-acts"><button data-act="retry">再试一次</button><button data-act="set">去 AI 设置</button></span>';
          ctFace('cry'); ctStatus('连接出错了'); CT.hist.pop();
          b.querySelector('[data-act="retry"]').onclick=function(){ row.remove(); me.remove(); CT.hist.pop(); otSend(text, stk); };
          b.querySelector('[data-act="set"]').onclick=function(){ openS3('s3-ai'); }; });
    } else { ty.feed(reply); ty.end(); }
  };
  setTimeout(start, st.ai?700+Math.random()*500:500+Math.random()*400);
  CT.stop=function(){ killed=true; row.remove(); ctBusy(false); ctFace('happy'); ctStatus(st.ai?'在线 · '+st.c.m:'本地陪聊'); CT.hist.pop(); };
}

/* 从别处（首页小獭）带着她飞进聊天页 */
function otOpenChat(src){
  var go=function(){ openS3('s3-otter'); };
  if(src && !REDUCED && window.fly){ go(); requestAnimationFrame(function(){ var dst=$('#otImg'); if(!dst) return; dst.style.opacity='0';
      fly(src, dst, src.getAttribute('src'), {ms:520, radius:'0px', hold:40}, function(){ dst.style.opacity=''; }); }); }
  else go();
}
window.otOpenChat=otOpenChat;

S3_HOOKS['s3-otter']=function(){
  ctPaintMode(); var k=otPick('greet'); ctFace(k);
  var h=new Date().getHours(), hi=h<5||h>=23?'这么晚还没睡呀～':h<11?'早上好呀～':h<14?'中午好～':h<18?'下午好呀～':'晚上好呀～';
  typeInto($('#otSay'), hi+(CT.hist.length?'我们接着聊？':'今天已经打了两局，想聊点什么都可以。'), 36);
  setTimeout(function(){ if(stack[stack.length-1]===$('#s3-otter') && !CT.hist.length) tip($('#otIn'), '直接打字，或者点上面的话题', {mood:'happy', once:'ct-first', ms:2600}); }, 1400);
};
safe('chat', function(){
  var inp=$('#otIn'), send=$('#otSend'), stk=$('#ctStk'); if(!inp) return;
  var grow=function(){ inp.style.height='auto'; inp.style.height=Math.min(112, inp.scrollHeight)+'px'; };
  var go=function(){ if(CT.busy){ if(CT.stop) CT.stop(); vib(8); return; } var v=inp.value; if(!v.trim()) return; inp.value=''; grow(); send.disabled=true; otSend(v); };
  send.onclick=go;
  inp.addEventListener('keydown', function(e){ if(e.key==='Enter' && !e.shiftKey && !e.isComposing){ e.preventDefault(); go(); } });
  /* 你在打字，她在听 */
  inp.addEventListener('input', function(){ grow(); var has=!!inp.value.trim(); if(!CT.busy) send.disabled=!has;
    send.classList.toggle('ready', has);
    if(CT.busy) return; ctFace(has?'focus':'happy'); ctStatus(has?'在听你说…':(ctConn().ai?'在线 · '+ctConn().c.m:'本地陪聊'), has);
    clearTimeout(CT.typingT); CT.typingT=setTimeout(function(){ if(!CT.busy){ ctFace('happy'); ctPaintMode(); $('#ctSt').classList.remove('busy'); } }, 2200); });
  inp.addEventListener('focus', function(){ $('#ctDock').classList.add('focus'); stk.classList.remove('on'); $('#ctEmo').classList.remove('on'); });
  inp.addEventListener('blur', function(){ $('#ctDock').classList.remove('focus'); });
  $$('#otQuick .chip').forEach(function(c){ c.onclick=function(){ c.classList.remove('tap'); void c.offsetWidth; c.classList.add('tap'); otSend(c.textContent); }; });
  /* 表情贴纸 */
  stk.innerHTML=CT_STK.map(function(k, i){ return '<button data-k="'+k+'" style="--i:'+i+'"><img src="'+otSrc(k, true)+'" alt="'+OT_EXPR[k].n+'"><span>'+OT_EXPR[k].n+'</span></button>'; }).join('');
  $('#ctEmo').onclick=function(){ var on=!stk.classList.contains('on'); stk.classList.toggle('on', on); this.classList.toggle('on', on); vib(5); if(on) ctScroll(true); };
  $$('button', stk).forEach(function(b){ b.onclick=function(){ if(CT.busy) return; stk.classList.remove('on'); $('#ctEmo').classList.remove('on'); otSend('', b.dataset.k); }; });
  /* 长按气泡复制 */
  var lp=0; $('#otLog').addEventListener('pointerdown', function(e){ var bb=e.target.closest('.cm-b'); if(!bb || e.target.closest('button')) return;
    lp=setTimeout(function(){ var t=bb.textContent.trim(); if(navigator.clipboard) navigator.clipboard.writeText(t).catch(function(){});
      bb.classList.remove('copied'); void bb.offsetWidth; bb.classList.add('copied'); vib(12); toast('复制好了', {tone:'ok'}); }, 480); });
  ['pointerup','pointerleave','pointercancel'].forEach(function(n){ $('#otLog').addEventListener(n, function(){ clearTimeout(lp); }); });
  $('#ctMode').onclick=function(){ openS3('s3-ai'); };
  $('#ctModel').onclick=function(){ openS3('s3-ai'); };
  var BR=['你最近三天都在 20 点后开局，平均一局 48 分钟，比上周短了 12 分钟。周六最容易玩超，要不要临时把上限调到 4 小时？',
    '连续第 12 天记录啦，火苗越来越旺。这周收工都很干脆，小獭给你一朵小红花。','这周星穹铁道玩了 4.8 小时，是最多的一款；「一人食」贴了 3 次，要好好吃饭哦。'], bi=0;
  var rf=$('#otRefresh'); rf.onclick=function(){ var p=$('#ctBrief'); rf.classList.remove('spin'); void rf.offsetWidth; rf.classList.add('spin');
    p.classList.add('out'); setTimeout(function(){ bi=(bi+1)%BR.length; p.textContent=BR[bi]; p.classList.remove('out'); }, 220); vib(5); };
  var cs=$('#aiChatSw'); if(cs) cs.addEventListener('click', function(){ setTimeout(ctPaintMode, 0); });
  ctPaintMode();
});

/* ── 新手引导 ───────────────────────────────────────────────── */
var obI=0;
function obGo(i){
  obI=i; $('#obTrack').style.transform='translateX('+(-i*100)+'%)';
  $$('#obTrack .ob-slide').forEach(function(s,k){ s.classList.toggle('on', k===i); });
  $$('#obDots i').forEach(function(d,k){ d.classList.toggle('on', k===i); });
  $('#obNext').textContent= i===2?'开始记录':'下一步';
}
function showOnboard(){
  var ob=$('#ob3'); if(!ob) return;
  $$('#ob3 img[data-src]').forEach(function(im){ if(im.src) return; im.onerror=function(){ im.onerror=null; im.src=im.dataset.fb; im.style.objectFit='contain'; }; im.src=im.dataset.src; });
  while(stack.length) closeTop();
  ob.classList.remove('out'); ob.classList.add('on'); obGo(0);
}
function hideOnboard(){ var ob=$('#ob3'); ob.classList.add('out'); setTimeout(function(){ ob.classList.remove('on','out'); }, 450);
  var c=[innerWidth/2, innerHeight*.4]; setTimeout(function(){ confetti(c[0],c[1],26); }, 300); }
window.showOnboard=showOnboard;
safe('onboard', function(){
  var nx=$('#obNext'); if(!nx) return;
  nx.onclick=function(){ if(obI<2){ obGo(obI+1); vib(6); } else hideOnboard(); };
  $('#obSkip').onclick=hideOnboard;
  var tr=$('#obTrack'), x0=null;
  tr.addEventListener('pointerdown', function(e){ x0=e.clientX; });
  tr.addEventListener('pointerup', function(e){ if(x0===null) return; var dx=e.clientX-x0; if(Math.abs(dx)>40) obGo(Math.max(0,Math.min(2,obI+(dx<0?1:-1)))); x0=null; });
  if(/onboard/.test(location.search)) setTimeout(showOnboard, 2400);
});

/* ═══ 开战页 · 情绪反馈 ════════════════════════════════════════════
   不改原有状态机，只包一层 setState / layout，在五个瞬间叠反馈。 */
safe('timer-emotion', function(){
  var page=$('#page-timer'), stage=$('#stage'), btn=$('#page-timer [data-go]');
  if(!page || !stage || !btn || !window.setState || !window.layout) return;
  var tint=document.createElement('div'); tint.className='tk-tint'; page.insertBefore(tint, page.firstChild);
  var selDisc=function(){ return $('#stage .disc.sel'); };
  var brandOfSel=function(){ var d=selDisc(); return d ? (getComputedStyle(d).getPropertyValue('--brand').trim()||'61,220,255') : '61,220,255'; };
  var curGame=function(){ return (window.GAMES||[])[window.deckIdx||0]||{f:'ys',n:'原神'}; };

  /* ① 换卡：弹一下 + 品牌光一闪 + 背景染成这款游戏的颜色 */
  var lastIdx=null;
  var _layout=window.layout;
  window.layout=function(){ _layout.apply(this, arguments);
    var d=selDisc(); if(!d) return;
    if(lastIdx!==null && lastIdx!==window.deckIdx && !REDUCED){
      d.animate([{scale:.92},{scale:1.06, offset:.55},{scale:1}],{duration:520, easing:'cubic-bezier(.34,1.5,.64,1)', delay:80});
      var f=document.createElement('i'); f.className='tk-flash'; d.appendChild(f);
      f.animate([{opacity:0},{opacity:1, offset:.3},{opacity:0}],{duration:700, easing:'ease-out'}).onfinish=function(){ f.remove(); };
    }
    lastIdx=window.deckIdx;
    setTimeout(function(){ tint.style.setProperty('--tint', brandOfSel()); }, 60);
  };
  window.layout();

  /* 横滑：跟手 + 回弹 */
  var sx=null;
  stage.addEventListener('pointerdown', function(e){ if(deckLocked()) return; sx=e.clientX; stage.classList.add('drag'); });
  stage.addEventListener('pointermove', function(e){ if(sx===null) return; var dx=e.clientX-sx; stage.style.translate=(dx*0.22)+'px 0'; });
  var rel=function(){ sx=null; stage.classList.remove('drag'); stage.style.translate=''; };
  stage.addEventListener('pointerup', rel); stage.addEventListener('pointerleave', rel); stage.addEventListener('pointercancel', rel);

  /* 待机点选中卡：卡片蹦一下，提示「按住」 */
  var wasSel=null;
  stage.addEventListener('pointerdown', function(e){ wasSel=e.target.closest('.disc.sel'); }, true);
  stage.addEventListener('click', function(e){
    var d=e.target.closest('.disc'); if(!d || d!==wasSel || deckState!=='idle') return;
    if(!REDUCED) d.animate([{rotate:'0deg'},{rotate:'-4deg'},{rotate:'3deg'},{rotate:'0deg'}],{duration:420, easing:'ease-in-out'});
    var p=centerOf(d); burst(p[0], p[1]-40, ['✦','✧'], 5, 1.4);
    var h=$('#page-timer .cta .hold'); if(h){ h.classList.remove('nudge'); void h.offsetWidth; h.classList.add('nudge'); }
    vib(6);
  });

  /* ② 蓄力：按钮充能 + 卡片握紧 + 光点向卡片聚拢 */
  var chargeT=null, grip=null;
  var stopCharge=function(fail){
    clearInterval(chargeT); chargeT=null;
    if(grip){ grip.cancel(); grip=null; }
    var d=selDisc();
    if(fail && d && !REDUCED) d.animate([{scale:1.04},{scale:.97, offset:.5},{scale:1}],{duration:380, easing:'ease-out'});
  };
  btn.addEventListener('pointerdown', function(){
    if(deckLocked()) return;
    if(!btn.querySelector('.chg')) btn.insertAdjacentHTML('afterbegin','<span class="chg"></span>');
    var d=selDisc(); if(!d || REDUCED) return;
    var col=brandOfSel();
    grip=d.animate([{scale:1, filter:'brightness(1)'},{scale:1.06, filter:'brightness(1.25)'}],{duration:850, easing:'cubic-bezier(.3,0,.6,1)', fill:'forwards'});
    var c=centerOf(d), n=0;
    chargeT=setInterval(function(){
      if(++n%3===0) vib(4);
      var a=Math.random()*Math.PI*2, r=110+Math.random()*60, dot=document.createElement('i');
      dot.className='tk-dot'; dot.style.setProperty('--c', col); dot.style.left=(c[0]+Math.cos(a)*r)+'px'; dot.style.top=(c[1]+Math.sin(a)*r)+'px';
      document.body.appendChild(dot);
      dot.animate([{transform:'none', opacity:0},{opacity:1, offset:.3},{transform:'translate('+(-Math.cos(a)*r)+'px,'+(-Math.sin(a)*r)+'px) scale(.3)', opacity:0}],
        {duration:520, easing:'cubic-bezier(.5,0,.9,.6)'}).onfinish=function(){ dot.remove(); };
    }, 60);
  });
  ['pointerup','pointerleave','pointercancel'].forEach(function(ev){ btn.addEventListener(ev, function(){
    if(chargeT) stopCharge(deckState==='idle'||deckState==='done'); }); });

  /* 收工前先记下这一局（原 click 会清零） */
  var sess={};
  document.addEventListener('click', function(e){
    if(!e.target.closest('#page-timer [data-go]') || !deckLocked()) return;
    var tm=btn.querySelector('.tm'); sess={tm:tm?tm.textContent:'00:00', mood:window.tkMood||'calm', g:curGame(), b:brandOfSel()};
  }, true);

  /* ③ 开战 ④ 接近上限 ⑤ 收工 */
  var _ss=window.setState;
  window.setState=function(n){ var p=deckState; _ss.apply(this, arguments);
    if(p===n) return;
    if((p==='idle'||p==='done') && n==='timing') onStart();
    else if(p==='timing' && n==='warn') onWarn();
    else if((p==='timing'||p==='warn') && n==='done') onDone();
  };

  function onStart(){
    stopCharge(false);
    var d=selDisc(); if(!d) return; var c=centerOf(d);
    vib([18,30,40]);
    if(REDUCED){ toast('开战！小獭帮你看着时间'); return; }
    var w=document.createElement('i'); w.className='tk-wave'; w.style.left=c[0]+'px'; w.style.top=c[1]+'px'; document.body.appendChild(w);
    w.animate([{transform:'scale(.4)', opacity:1},{transform:'scale(4.2)', opacity:0}],{duration:760, easing:'cubic-bezier(.2,0,0,1)'}).onfinish=function(){ w.remove(); };
    var st=document.createElement('div'); st.className='tk-stamp'; st.textContent='开战！'; st.style.top=c[1]+'px'; document.body.appendChild(st);
    st.animate([{transform:'scale(2.6) rotate(-14deg)', opacity:0},{transform:'scale(.92) rotate(-6deg)', opacity:1, offset:.28},{transform:'scale(1) rotate(-6deg)', opacity:1, offset:.4},
      {transform:'scale(1) rotate(-6deg)', opacity:1, offset:.75},{transform:'translateY(-40px) scale(1.05) rotate(-6deg)', opacity:0}],
      {duration:1300, easing:'cubic-bezier(.2,.8,.3,1)'}).onfinish=function(){ st.remove(); };
    burst(c[0], c[1], ['✦','✧','·'], 10, 2.4);
    stage.animate([{translate:'0 0'},{translate:'-5px 2px'},{translate:'4px -2px'},{translate:'-2px 1px'},{translate:'0 0'}],{duration:280, delay:180});
    d.animate([{scale:1.06},{scale:1}],{duration:420, easing:'cubic-bezier(.34,1.5,.64,1)'});
    startToastT=setTimeout(function(){ toast('开战！小獭帮你看着时间', {tone:'win'}); }, 700);
  }
  var startToastT=null;

  function onWarn(){
    var d=selDisc(); vib([30,60,30]);
    if(d && !REDUCED) d.animate([{rotate:'0deg'},{rotate:'-3deg'},{rotate:'3deg'},{rotate:'-2deg'},{rotate:'0deg'}],{duration:600, easing:'ease-in-out'});
    toast(window.tkMood==='over'?'已经超过上限啦，这局打完就收工吧':'快到上限啦，这局打完就收工吧～');
  }

  /* 收工小结 */
  var done=document.createElement('div'); done.className='tk-done'; done.id='tkDone';
  done.innerHTML='<div class="bk"></div><div class="cd"><img class="ot" src="assets/otter/expr/anim/270/happy.webp" alt="">'
    +'<div class="ml" id="tdMile"></div><div class="k">收 工 ！</div><div class="du"><b id="tdDu">0</b><small id="tdU">分钟</small></div>'
    +'<div class="gm"><img id="tdGi" src="" alt=""><span id="tdGm"></span></div>'
    +'<div class="say" id="tdSay"></div><div class="chips" id="tdChips"></div>'
    +'<div class="acts"><button class="slab ghost" id="tdOk">好的</button><button class="slab" id="tdRec">记一条这局</button></div></div>';
  document.body.appendChild(done);
  var SAY={calm:'收得干脆！节奏刚刚好，小獭给你盖个章 ✓', focus:'玩得尽兴又知道停，这就是高手～',
    near:'卡在上限前收工，自律值拉满！', over:'超了一点点，但你主动按下了收工，这一下很了不起。'};
  var closeDone=function(){ done.classList.remove('on'); };
  done.querySelector('.bk').onclick=closeDone; $('#tdOk').onclick=closeDone;
  $('#tdRec').onclick=function(){ closeDone(); if(window.cpLinkTo) window.cpLinkTo(sess.g.f, $('#tdDu').textContent+' '+$('#tdU').textContent);
    setTimeout(function(){ openS3('s3-compose'); }, 200); };

  function minsOf(tm){ var p=tm.split(':').map(Number); return p.length===3 ? p[0]*60+p[1] : p[0]; }
  /* 收工的脸按这一局的样子挑：超上限先抱抱 · 深夜说晚安 · 再按时长；碰上里程碑就庆祝 */
  function doneScene(m, mood, mile){
    var h=new Date().getHours();
    return mile ? 'mile' : mood==='over' ? 'doneOver' : (h>=23||h<5) ? 'doneNight' : m<30 ? 'doneShort' : m<90 ? 'doneMid' : 'doneLong';
  }
  function onDone(){
    clearTimeout(startToastT); var t3=$('#toast3'); if(t3 && t3._hide) t3._hide();
    var g=sess.g||curGame(), m=Math.max(1, minsOf(sess.tm||'00:00')), mood=sess.mood||'calm';
    var mile=window.tkMile ? window.tkMile(m) : null;
    var cd=done.querySelector('.cd'); cd.style.setProperty('--b', sess.b||'61,220,255');
    cd.classList.toggle('mile', !!mile);
    done.querySelector('.ot').src=STK(otPick(doneScene(m, mood, mile)));
    var ml=$('#tdMile'); if(ml) ml.innerHTML= mile ? '<i class="fl"><svg viewBox="0 0 24 24"><path d="M12 2c1 3.2 4.6 5 4.6 9.6A4.6 4.6 0 0 1 12 22a6 6 0 0 1-6-6c0-3 1.8-4.6 3-6.4.3 1.8 1.2 2.8 2.2 3.2C10.6 9.2 11 5.4 12 2z"/></svg></i><b>'+mile.t+'</b><small>'+mile.s+'</small>' : '';
    $('#tdGi').src='assets/games/'+g.f+'.webp'; $('#tdGm').textContent=g.n;
    var big=m>=60, val=big?(m/60).toFixed(1):m; $('#tdU').textContent=big?'小时':'分钟';
    $('#tdChips').innerHTML='<span>今天第 3 局</span><span>连续 12 天保住了</span>'+(mood==='calm'||mood==='focus'?'<span>没超上限</span>':'');
    $('#tdSay').textContent='';
    done.classList.add('on'); vib([12,50,24]);
    var duEl=$('#tdDu'), t0=performance.now(), target=parseFloat(val);
    (function up(t){ var k=Math.min(1,(t-t0)/800), v=target*(1-Math.pow(1-k,3)); duEl.textContent=big?v.toFixed(1):Math.round(v);
      if(k<1) requestAnimationFrame(up); })(t0);
    setTimeout(function(){ typeInto($('#tdSay'), SAY[mood], 34); }, 650);
    setTimeout(function(){ var c=centerOf(cd); confetti(c[0], c[1]-120, mile?48:26); burst(c[0], c[1]-150, ['✦','✧'], mile?12:7, 2.2); }, 420);
    if(mile) setTimeout(function(){ vib([10,40,10,40,30]); var c=centerOf($('#tdMile')); confetti(c[0], c[1], 24); }, 1250);
    var rows=$('#page-timer .today .row');
    if(rows){ var now=new Date(), e=now.getHours()+':'+('0'+now.getMinutes()).slice(-2);
      var r=document.createElement('div'); r.className='row fresh'; r.style.setProperty('--b', sess.b||'61,220,255');
      r.innerHTML='<img class="gi" src="assets/games/'+g.f+'.webp" alt=""><div><div class="nm">'+g.n+'</div><div class="tm">刚刚 – '+e+'</div></div><div class="du">'+(big?val+'h':m+'m')+'</div>';
      rows.parentNode.insertBefore(r, rows);
      r.addEventListener('click', function(){ openRecord({img:'game_gacha', g:g.f, t:g.n+' · 刚刚', tags:['happy']}); });
    }
  }
});

/* 开战页的小獭搭子 + 这局的约定（battle.js）：要等收工小结建好再接 */
if(window.GtBattle) safe('battle', function(){ GtBattle({'$':$, '$$':$$, STK:STK, OT_EXPR:OT_EXPR, otPick:otPick, OT_POOL:OT_POOL, vib:vib, toast:toast, sparkle:sparkle, centerOf:centerOf, REDUCED:REDUCED}); });

/* ═══ 换页钩子：进场重播 ═══════════════════════════════════════════ */
if(typeof window.enter==='function'){
  var orig=window.enter;
  window.enter=function(name){
    orig(name);
    while(stack.length) closeTop();
    tipHide();
    if(name==='me') setTimeout(function(){ if(meRing){ meRing.p=0; meRing.set({ratio:window.GtEmpty && GtEmpty.on('me')?.02:.86}); } if(window.meReplay) meReplay(); }, 120);
    if(name==='home'){ HOME_K=MEMO?MEMO.k:otPick('home'); safe('introHome', introHome); }
    otPaint($('#page-'+name));
    if(name==='gallery') safe('gal', function(){ seen={}; renderFall();
      setTimeout(function(){ var c=$('#g3Fall .shot3'); if(c && document.body.dataset.page==='gallery') tip(c, '长按卡片，可以把它放进回收站', {mood:'calm', once:'gal-long'}); }, 1400); });
  };
  // nav 按钮绑的是旧引用：重新绑一次
  $$('nav button').forEach(function(b){ var n=b.cloneNode(true); b.parentNode.replaceChild(n,b);
    n.addEventListener('click', function(){ if(n.dataset.page!==window.currentPage) window.enter(n.dataset.page); }); });
}
})();
