(() => {
  const root = document.documentElement;
  const nav = document.getElementById("nav");
  const phone = document.getElementById("phone3d");
  const stage = document.getElementById("stage");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const reveal = () => {
    const nodes = [...document.querySelectorAll("[data-in]")];
    if (!root.classList.contains("motion") || reduce) {
      nodes.forEach((n) => { n.style.visibility = "visible"; });
      root.classList.add("ready");
      return;
    }
    nodes.forEach((n) => {
      n.style.opacity = "0";
      n.style.transform = "translateY(22px) scale(.985)";
      n.style.transition = "opacity 780ms cubic-bezier(.22,1,.36,1), transform 780ms cubic-bezier(.22,1,.36,1)";
      n.style.visibility = "visible";
    });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target;
        el.style.opacity = "1";
        el.style.transform = "translateY(0) scale(1)";
        io.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    nodes.forEach((n, i) => {
      n.style.transitionDelay = `${Math.min(i % 4, 3) * 60}ms`;
      io.observe(n);
    });
    root.classList.add("ready");
  };

  const onScroll = () => {
    if (!nav) return;
    nav.classList.toggle("scrolled", window.scrollY > 8);
  };

  // pointer tilt for phone
  if (phone && stage && !reduce) {
    let tx = 0, ty = 0, cx = 0, cy = 0;
    const loop = () => {
      cx += (tx - cx) * 0.12;
      cy += (ty - cy) * 0.12;
      phone.style.transform = `rotateX(${cy}deg) rotateY(${cx}deg)`;
      requestAnimationFrame(loop);
    };
    stage.addEventListener("pointermove", (e) => {
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      tx = x * 14;
      ty = -y * 10;
    });
    stage.addEventListener("pointerleave", () => { tx = 0; ty = 0; });
    requestAnimationFrame(loop);
  }

  // store placeholders: keep slots, no dead-end toast
  document.querySelectorAll("[data-store]").forEach((a) => {
    a.addEventListener("click", (e) => {
      if (!a.dataset.hrefReady) e.preventDefault();
    });
  });

  // hydrate changelog from family.json when available
  const list = document.getElementById("changelog");
  if (list) {
    fetch("../family.json")
      .then((r) => r.json())
      .then((d) => {
        const rows = d?.apps?.["otter-gametime"]?.changelog;
        if (!Array.isArray(rows) || !rows.length) return;
        list.innerHTML = rows.slice(0, 5).map((c) => `
          <li>
            <b>v${c.version}</b>
            <time datetime="${c.date}">${String(c.date).slice(5)}</time>
            <span>${c.zh}</span>
          </li>`).join("");
      })
      .catch(() => {});
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  reveal();
})();
