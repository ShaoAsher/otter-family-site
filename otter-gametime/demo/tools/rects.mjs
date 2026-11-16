// 原型 DOM 量尺：把一页里所有可见文本、有底色的盒子、图片的矩形与字号 dump 成 JSON。
// 用法（先起预览服务，默认 8766）：node tools/rects.mjs <输出目录> <名字>=<查询串>
// 与 app 侧 lib/dev/layout_probe.dart 的 gt_layout.json 对表（kb/fidelity.md）。
// 只量「当前最上层的那一屏」：有 .s3.on 就量它，否则量 .page.on —— 底下被盖住的页不参与。
import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [out, ...args] = process.argv.slice(2);
// 任务也可以写在文件里（一行一个 名字=查询串|JS），传 @文件路径；与 shot.mjs 一致。
const jobs = args.flatMap((a) => a.startsWith('@') ? readFileSync(a.slice(1), 'utf8').split('\n').filter((l) => l.trim()) : [a]);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'gtrect-'))}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws;
for (let i = 0; i < 40 && !ws; i++) {
  await sleep(250);
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    const page = list.find((t) => t.type === 'page');
    if (page) ws = new WebSocket(page.webSocketDebuggerUrl);
  } catch {}
}
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const wait = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

const SCRIPT = `(() => {
  const root = document.querySelector('.s3.on') || document.querySelector('.page.on') || document.body;
  const items = [];
  const vis = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return false;
    }
    return true;
  };
  const inView = (r) => r.width > 0.5 && r.height > 0.5 && r.bottom > 0 && r.top < innerHeight;
  const push = (el, kind, r, extra) => {
    if (!inView(r)) return;
    const cs = getComputedStyle(el);
    items.push({
      kind,
      cls: (el.className || '').toString().slice(0, 70),
      x: +(r.x ?? r.left).toFixed(2), y: +(r.y ?? r.top).toFixed(2),
      w: +r.width.toFixed(2), h: +r.height.toFixed(2),
      fs: parseFloat(cs.fontSize), fw: cs.fontWeight, ff: cs.fontFamily.split(',')[0].replace(/["']/g, ''),
      color: cs.color, bg: cs.backgroundColor,
      ...extra,
    });
  };
  // 文本：逐文本节点量 Range，拿到字形盒（与 Flutter Text 的 size 同一量级）
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent.replace(/\\s+/g, ' ').trim();
    if (!t) continue;
    const p = n.parentElement;
    if (!p || !vis(p)) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    const rects = [...range.getClientRects()].filter(inView);
    if (!rects.length) continue;
    const r = rects[0];
    const cs = getComputedStyle(p);
    items.push({
      kind: 'text', cls: (p.className || '').toString().slice(0, 70), text: t,
      x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2),
      fs: parseFloat(cs.fontSize), fw: cs.fontWeight, ff: cs.fontFamily.split(',')[0].replace(/["']/g, ''),
      color: cs.color,
    });
  }
  // 盒子 / 图片 / 图标：拿容器几何，用来核对卡片、按钮、贴纸的位置与大小
  for (const el of root.querySelectorAll('*')) {
    if (!vis(el)) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (!inView(r)) continue;
    const bg = cs.backgroundColor;
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && !bg.endsWith(', 0)')) push(el, 'box', r, {});
    if (cs.backgroundImage && cs.backgroundImage !== 'none') push(el, 'bgimg', r, { img: cs.backgroundImage.slice(0, 90) });
    if (el.tagName === 'IMG') push(el, 'img', r, { src: el.getAttribute('src') });
    if (el.tagName.toLowerCase() === 'svg') push(el, 'svg', r, {});
  }
  return JSON.stringify({ size: [innerWidth, innerHeight], root: root.id, items });
})()`;

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
// 量尺与 shot.mjs 同条件：关掉常驻动效，量到的才是静止态。
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
for (const job of jobs) {
  const [name, rest] = job.split(/=(.*)/s);
  const [q, js] = rest.split('|');
  await send('Page.navigate', { url: `http://127.0.0.1:${process.env.PORT || 8766}/index.html?${q}&t=${Date.now()}` });
  await sleep(3200);
  // 与 shot.mjs 一致：小獭动图换成 `still/270/` 静帧，同一帧量才有意义。
  await sleep(300);
  await send('Runtime.evaluate', {
    expression: `[...document.images].forEach(i => { if (i.src.includes('/expr/anim/270/')) i.src = i.src.replace('/expr/anim/270/', '/expr/still/270/'); })`,
  });
  // 与 shot.mjs 一致：先跑任务里的 JS（比如 openRecord 把详情页填上），再量这一屏
  if (js) {
    await send('Runtime.evaluate', { expression: js, awaitPromise: true, returnByValue: true });
    await sleep(1200);
  }
  const r = await send('Runtime.evaluate', { expression: SCRIPT, returnByValue: true, awaitPromise: true });
  writeFileSync(join(out, name + '.json'), r.result?.result?.value ?? '{}');
  console.log(name);
}
ws.close(); chrome.kill();
