// 검사에 같이 쓰는 것: 작은 정적 서버, 화면 없는 브라우저, 통과/실패 줄.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const OUT = path.join(__dirname, 'out');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 6000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(50); } }

// run(이름, 포트, async ({ BASE, browser, check, phone, shot }) => { … })
async function run(name, port, body) {
  const results = [];
  const check = (what, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${what}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
  fs.mkdirSync(OUT, { recursive: true });
  const server = http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } });
  }).listen(port);
  const browser = await chromium.launch();
  const BASE = `http://localhost:${port}/wish/`;
  // 폰 크기 화면. at 을 주면 그 시각(현지)에서 시작하고, 시계는 검사에서 직접 움직인다.
  const phone = async (o = {}) => {
    const ctx = await browser.newContext({ viewport: { width: o.w || 390, height: o.h || 844 }, hasTouch: true, isMobile: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: o.calm ? 'reduce' : 'no-preference', permissions: o.clip ? ['clipboard-read', 'clipboard-write'] : [] });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { console.log('   (페이지 오류)', e.message); results.push(false); });
    if (o.at) await page.clock.install({ time: new Date(o.at) });
    return { ctx, page };
  };
  const go = async (page, hash = '') => { await page.goto(BASE + hash); await until(() => page.evaluate(() => !!window.__wish)); };
  const shot = (page, file) => page.screenshot({ path: path.join(OUT, file) });
  try { await body({ BASE, browser, check, phone, go, shot }); }
  catch (e) { check('검사 도중 오류 없음', false, String(e && e.stack)); }
  await browser.close(); server.close();
  const fail = results.filter((x) => !x).length;
  console.log(`\n${name} 합계: ${results.length}개 중 통과 ${results.length - fail}, 실패 ${fail}`);
  process.exitCode = fail ? 1 : 0;
}
module.exports = { run, sleep, until, OUT };
