// 无头 Chrome 走查截图（手机尺寸 390×844 @2x），用来同时检查日 / 夜两套主题。
// 用法：node tools/shot.mjs <输出目录> <名字>=<查询串>[|<页面里执行的 JS>] ...
// 例：  node tools/shot.mjs /tmp/gtz L_me="theme=light&p=me" L_set="theme=light&s3=s3-settings|scrollTo(0,0)"
// 需要先在 docs/mockup 下起预览服务（默认端口 8766：python3 -m http.server 8766）。
import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// 任务也可以写在文件里（一行一个 名字=查询串|JS），传 @文件路径
const [out, ...args] = process.argv.slice(2);
const jobs = args.flatMap((a) => a.startsWith('@') ? readFileSync(a.slice(1), 'utf8').split('\n').filter((l) => l.trim()) : [a]);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'gtshot-'))}`, 'about:blank'], { stdio: 'ignore' });
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

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
// 截图时关掉常驻动效（`prefers-reduced-motion`）：原型里 20~26s 的极缓推拉 / 呼吸漂移
// 永远不停，拍到的那一帧会被放大 4~12%，跟 App 的静止画面逐像素比会整片发红。
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
for (const job of jobs) {
  const [name, rest] = job.split(/=(.*)/s);
  const [q, js] = rest.split('|');
  await send('Page.navigate', { url: `http://127.0.0.1:${process.env.PORT||8766}/index.html?${q}&t=${Date.now()}` });
  await sleep(3200);
  for (let i = 0; i < 30; i++) {
    const r = await send('Runtime.evaluate', { expression: '[...document.images].filter(i=>i.offsetParent).every(i=>i.complete)', returnByValue: true });
    if (r.result?.result?.value) break;
    await sleep(300);
  }
  await sleep(600);
  // 小獭动图（`assets/otter/expr/*.webp` 是 68 帧 webp）在截图里一直播，拍到的是随机一帧；
  // App 那侧落地的是首帧静帧（kb/assets.md §1），两边永远不会对上。这里把动图换成 `still/270/` 静帧
  // （= 首帧）再拍，画面才是同一帧。页面 JS 也可能换图，所以 `|JS` 之后再冻结一次。
  const freezeOtter = () => send('Runtime.evaluate', {
    expression: `[...document.images].forEach(i => { if (i.src.includes('/expr/anim/270/')) i.src = i.src.replace('/expr/anim/270/', '/expr/still/270/'); })`,
    awaitPromise: true,
  });
  await freezeOtter();
  await sleep(400);
  if (js) {
    const r = await send('Runtime.evaluate', { expression: js, awaitPromise: true, returnByValue: true });
    const v = r.result?.result?.value;
    if (typeof v === 'string' && v) console.log(`── ${name}\n${v}`);
    await sleep(1200);
    await freezeOtter();
    await sleep(400);
  }
  // 收尾：所有 transition 直接跳到终态、正在进行的关键帧动画（含 JS `.animate()`）跑完。
  // 不做这一步，页面切换 / 卡片浮起的中间态会被拍进来（版面看着「错乱」）。
  await send('Runtime.evaluate', {
    expression: `(() => {
      if (!document.getElementById('gt-settle')) {
        const s = document.createElement('style'); s.id = 'gt-settle';
        s.textContent = '*,*::before,*::after{transition:none!important}';
        document.head.appendChild(s);
      }
      for (const a of document.getAnimations()) { try { a.finish(); } catch (e) {} }
      return 1;
    })()`,
  });
  await sleep(250);
  // 连拍两帧，两帧一致才算「静止」；否则再等再拍（最多 5 轮），避免拍到过渡尾巴。
  let shot = '';
  for (let i = 0; i < 5; i++) {
    const a = await send('Page.captureScreenshot', { format: 'png' });
    await sleep(260);
    const b = await send('Page.captureScreenshot', { format: 'png' });
    shot = b.result.data;
    if (a.result.data === b.result.data) break;
  }
  writeFileSync(join(out, name + '.png'), Buffer.from(shot, 'base64'));
  console.log(name);
}
ws.close(); chrome.kill();
