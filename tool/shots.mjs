#!/usr/bin/env node
// 官网截图：无头 Chrome 打开 App 的交互原型（?embed&nosplash），按 #win 窗口区域截图，cwebp 转 WebP。
// 视口 1282×802、DPR 2，窗口 1280×800 → 2560×1600。各 App 的 tool/site.sh shots 调用。
//
//   node tool/shots.mjs <原型 index.html> <清单.json> <输出目录>
//
// 清单：[[文件名, 查询参数, 载入后执行的脚本?, 额外等待毫秒?], …]，文件名不带扩展名。
// 需要 Google Chrome 与 cwebp。
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const [page, list, out] = process.argv.slice(2);
if (!page || !list || !out) {
  console.error('用法：node tool/shots.mjs <原型 index.html> <清单.json> <输出目录>');
  process.exit(1);
}
const PAGE = 'file://' + resolve(page);
const SHOTS = JSON.parse(readFileSync(list, 'utf8'));
const OUT = resolve(out);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const prof = mkdtempSync(join(tmpdir(), 'otter-shots-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', `--user-data-dir=${prof}`,
  `--remote-debugging-port=${PORT}`, '--window-size=1282,802', 'about:blank'], { stdio: 'ignore' });

let ws, seq = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => {
  const id = ++seq;
  pending.set(id, { res, rej });
  ws.send(JSON.stringify({ id, method, params }));
});

try {
  let targets;
  for (let i = 0; i < 50; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); break; } catch { await sleep(200); }
  }
  const tab = targets.find((t) => t.type === 'page');
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.method === 'Runtime.exceptionThrown') console.error('✗ 页面报错', m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
  });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1282, height: 802, deviceScaleFactor: 2, mobile: false });
  mkdirSync(OUT, { recursive: true });
  for (const [name, qs, js, extra = 0] of SHOTS) {
    await send('Page.navigate', { url: `${PAGE}?embed&nosplash${qs ? '&' + qs : ''}` });
    await sleep(2600);
    if (js) { await send('Runtime.evaluate', { expression: js }); await sleep(extra); }
    const { result } = await send('Runtime.evaluate', {
      expression: 'JSON.stringify((r=>({x:r.left,y:r.top,w:r.width,h:r.height}))(document.getElementById("win").getBoundingClientRect()))',
      returnByValue: true,
    });
    const r = JSON.parse(result.value);
    const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 } });
    const png = join(prof, `${name}.png`);
    writeFileSync(png, Buffer.from(data, 'base64'));
    execFileSync('cwebp', ['-quiet', '-q', '84', '-resize', '2560', '1600', png, '-o', join(OUT, `${name}.webp`)]);
    console.log('✓', name);
  }
} finally {
  ws && ws.close();
  chrome.kill();
  await sleep(300);
  rmSync(prof, { recursive: true, force: true });
}
