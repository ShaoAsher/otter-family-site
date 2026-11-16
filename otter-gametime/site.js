(() => {
  const root = document.documentElement;
  const nav = document.getElementById("nav");
  const timer = document.getElementById("liveTimer");

  const reveal = () => {
    const nodes = [...document.querySelectorAll("[data-in]")];
    if (!root.classList.contains("motion") || !("IntersectionObserver" in window)) {
      nodes.forEach((n) => {
        n.style.visibility = "visible";
      });
      root.classList.add("ready");
      return;
    }

    nodes.forEach((n) => {
      n.style.opacity = "0";
      n.style.transform = "translateY(18px)";
      n.style.transition = "opacity 700ms cubic-bezier(.22,1,.36,1), transform 700ms cubic-bezier(.22,1,.36,1)";
      n.style.visibility = "visible";
    });

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target;
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
          io.unobserve(el);
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" }
    );
    nodes.forEach((n) => io.observe(n));
    root.classList.add("ready");
  };

  const onScroll = () => {
    if (!nav) return;
    nav.classList.toggle("scrolled", window.scrollY > 8);
  };

  let t0 = performance.now();
  const tick = (now) => {
    if (!timer) return;
    const sec = Math.floor((now - t0) / 1000) % 360000;
    const h = String(Math.floor(sec / 3600)).padStart(2, "0");
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    const label = timer.querySelector("small");
    timer.firstChild.textContent = `${h}:${m}:${s}`;
    if (label && !label.isConnected) timer.appendChild(label);
    // keep IN BATTLE label
    if (!timer.querySelector("small")) {
      const sm = document.createElement("small");
      sm.textContent = "IN BATTLE";
      timer.appendChild(sm);
    }
    requestAnimationFrame(tick);
  };

  // Fix timer text node without wiping <small>
  const startTimer = () => {
    if (!timer) return;
    const small = timer.querySelector("small");
    const text = document.createTextNode("00:00:00");
    timer.textContent = "";
    timer.appendChild(text);
    if (small) timer.appendChild(small);
    else {
      const sm = document.createElement("small");
      sm.textContent = "IN BATTLE";
      timer.appendChild(sm);
    }
    const run = (now) => {
      const sec = Math.floor((now - t0) / 1000);
      const h = String(Math.floor(sec / 3600)).padStart(2, "0");
      const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
      const s = String(sec % 60).padStart(2, "0");
      text.textContent = `${h}:${m}:${s}`;
      requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  reveal();
  startTimer();
})();
