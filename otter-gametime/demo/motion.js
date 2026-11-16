/* ═══════════════════════════════════════════════════════════════════
   情绪时刻（GSAP）：CSS 管常驻漂移与切页进场，这里只管「状态变了」的那一下。
   天空吸一口气：开战 / 接近上限 / 深夜切换时，四团色光一起鼓起再落回（back.out 回弹），
   让情绪变化有一个能被感知的瞬间，而不是颜色悄悄换掉。
   减少动态效果：matchMedia 下整段不注册（颜色本身的过渡仍由 CSS 完成）。
   App 端对应：ui/surface/gt_day_sky.dart 的 GtDaySky._breath（时长 / 曲线 / 错开同值）。
   ═══════════════════════════════════════════════════════════════════ */
(function(){
  if(!window.gsap) return;
  var STATES=['s-timing','s-warn','pet-night'];
  var stateOf=function(){ var b=document.body.classList; return STATES.filter(function(c){ return b.contains(c); }).join(' '); };
  var mm=gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', function(){
    if(document.body.classList.contains('reduce')) return;
    var last=stateOf();
    var breathe=function(){
      var blobs=document.querySelectorAll('.sky i');
      if(!blobs.length) return;
      // 漂移的 transform 归 CSS 动画（动画层会盖住行内 transform），这里只推 --br，由独立的 scale 属性读
      gsap.timeline()
        .to(blobs, {'--br':1.22, duration:.5, ease:'power2.out', stagger:{each:.06, from:'random'}})
        .to(blobs, {'--br':1, duration:1.1, ease:'back.out(1.6)'}, '>-.1');
    };
    var mo=new MutationObserver(function(){ var now=stateOf(); if(now!==last){ last=now; breathe(); } });
    mo.observe(document.body, {attributes:true, attributeFilter:['class']});
    return function(){ mo.disconnect(); };
  });
})();
