(() => {
  const root = document.getElementById("demo");
  if (!root) return;

  const otter = document.getElementById("demoOtter");
  const pond = document.getElementById("demoPond");
  const bubble = document.getElementById("demoBubble");
  const timeEl = document.getElementById("demoTime");
  const hintEl = document.getElementById("demoHint");
  const statusEl = document.getElementById("demoStatus");
  const btnPrimary = document.getElementById("demoPrimary");
  const btnSecondary = document.getElementById("demoSecondary");
  const chipA = document.getElementById("chipLive");
  const chipB = document.getElementById("chipMem");

  const lines = {
    home: [
      "今天这池水，刚刚好。",
      "点我一下，我在听。",
      "想开战的话，我陪你记着。",
    ],
    battle: [
      "专心打，我帮你看着时间。",
      "这局有点燃起来了。",
      "收工了随时叫我。",
    ],
    done: [
      "漂亮。收进藏品了。",
      "今晚值得留下来。",
      "休息一下？我守着水位。",
    ],
  };

  const faces = {
    home: ["media/expr/happy.webp", "media/expr/wave.webp", "media/expr/ask.webp"],
    battle: ["media/expr/focus.webp", "media/expr/busy.webp", "media/expr/proud.webp"],
    done: ["media/expr/celebrate.webp", "media/expr/proud.webp", "media/expr/happy.webp"],
  };

  let mode = "home";
  let battleStart = 0;
  let raf = 0;
  let lineI = 0;
  let bubbleTimer = 0;

  const fmt = (sec) => {
    const h = String(Math.floor(sec / 3600)).padStart(2, "0");
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  const showBubble = (text) => {
    if (!bubble) return;
    bubble.textContent = text;
    bubble.classList.add("on");
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.remove("on"), 2400);
  };

  const setFace = () => {
    const list = faces[mode] || faces.home;
    otter.src = list[lineI % list.length];
  };

  const setMode = (next) => {
    mode = next;
    root.dataset.mode = mode;
    lineI = 0;
    setFace();

    if (mode === "home") {
      statusEl.textContent = "此刻";
      hintEl.textContent = "今日水位慢慢涨起来了";
      timeEl.textContent = "2h 16m";
      btnPrimary.textContent = "开战";
      btnPrimary.className = "btn btn-solid";
      btnSecondary.hidden = true;
      if (chipA) chipA.querySelector("em").textContent = "待命";
      cancelAnimationFrame(raf);
    }

    if (mode === "battle") {
      statusEl.textContent = "开战中";
      hintEl.textContent = "时间在烧，小獭陪着";
      btnPrimary.textContent = "收工";
      btnPrimary.className = "btn btn-ember";
      btnSecondary.hidden = false;
      btnSecondary.textContent = "继续盯着";
      battleStart = performance.now() - 12 * 60 * 1000;
      if (chipA) chipA.querySelector("em").textContent = "计时中";
      const tick = (now) => {
        const sec = Math.floor((now - battleStart) / 1000);
        timeEl.textContent = fmt(sec);
        if (chipA) chipA.querySelector("em").textContent = fmt(sec);
        raf = requestAnimationFrame(tick);
      };
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
      showBubble(lines.battle[0]);
    }

    if (mode === "done") {
      statusEl.textContent = "收工";
      hintEl.textContent = "高光已进藏品墙";
      timeEl.textContent = "本局 48m";
      btnPrimary.textContent = "再来一局";
      btnPrimary.className = "btn btn-solid";
      btnSecondary.hidden = false;
      btnSecondary.textContent = "回此刻";
      cancelAnimationFrame(raf);
      if (chipA) chipA.querySelector("em").textContent = "已收工";
      if (chipB) chipB.querySelector("em").textContent = "今晚 Boss 战";
      showBubble(lines.done[0]);
      pond.classList.add("pop");
      setTimeout(() => pond.classList.remove("pop"), 560);
    }
  };

  const poke = () => {
    const arr = lines[mode] || lines.home;
    lineI = (lineI + 1) % arr.length;
    setFace();
    pond.classList.add("pop");
    setTimeout(() => pond.classList.remove("pop"), 560);
    showBubble(arr[lineI]);
  };

  pond.addEventListener("click", poke);
  pond.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      poke();
    }
  });

  btnPrimary.addEventListener("click", () => {
    if (mode === "home") setMode("battle");
    else if (mode === "battle") setMode("done");
    else setMode("battle");
  });

  btnSecondary.addEventListener("click", () => {
    if (mode === "done") setMode("home");
    else if (mode === "battle") poke();
  });

  setMode("home");
  setTimeout(() => showBubble("点池子里的我，或直接开战。"), 900);
})();
