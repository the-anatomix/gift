// 화면 다듬기(post.js)와 빛나는 것들 검사. 실행: cd tree/tests && node look.test.js
// 검사 기기(소프트웨어 WebGL)는 평소 화면 다듬기가 꺼지므로 ?fx=1 로 켜서 본다.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8233, BASE = `http://localhost:${PORT}/tree/`, OUT = path.join(__dirname, 'out');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(80); } }
const errors = [];
const T = (p, fn, a) => p.evaluate(fn, a);
async function open(ctx, q) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => { errors.push(e.message); console.log('   (페이지 오류)', e.message); });
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) { errors.push(m.text()); console.log('   (콘솔 오류)', m.text()); } });
  await p.goto(BASE + q);
  await until(() => T(p, () => !!(window.__tree && window.__tree.frames > 3)), 30000);
  if (await T(p, () => window.__tree.lookOpen)) await T(p, () => window.__tree.openLook(false));
  return p;
}
const frames = (p) => T(p, () => window.__tree.frames);
const look = (p) => T(p, () => ({ fx: window.__look.fx, glow: window.__look.glow, tilt: window.__look.tilt, q: window.__tree.quality, calls: window.__tree.calls }));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 760 }, hasTouch: true, isMobile: true });

    /* 그래픽 칩 없는 기기: 저절로 꺼짐 */
    const N = await open(ctx, '?ns=lk0');
    const n0 = await look(N);
    check('소프트웨어 WebGL 에서는 처음부터 화면 다듬기를 끔 (화질 mid, 빛 배수 1)', !n0.fx && n0.q === 'mid' && n0.glow === 1, n0);
    await N.close();

    /* 켜기 */
    const A = await open(ctx, '?fx=1&ns=lk1');
    const a = await look(A);
    check('?fx=1 이면 켜짐 (화질 high, 빛나는 것은 1 보다 밝게)', a.fx && a.q === 'high' && a.glow > 1.5, a);
    const f0 = await frames(A); await sleep(1500);
    check('켠 채로 계속 그려지고 오류 없음', (await frames(A)) > f0 && errors.length === 0, errors);
    check('그리기 호출 수는 방을 그린 것만 셈 (후처리 몇 번은 빼고)', a.calls > 20 && a.calls < 400, a.calls);
    check('내려다보는 시점에서는 미니어처 흐림이 켜짐', await until(async () => (await look(A)).tilt > 0.7, 4000), await look(A));
    check('불꽃이 일렁이는 시간 값이 흐름', await until(async () => { const t0 = await T(A, () => window.__look.time); await sleep(300); return (await T(A, () => window.__look.time)) > t0; }, 3000));
    await T(A, () => window.__tree.dispatch({ t: 'lights', set: 'multi', blink: 'on' }, 'load'));
    await sleep(800); await T(A, () => window.__tree.snapView());
    await A.screenshot({ path: path.join(OUT, 'look-fx-iso.png') });

    // 화면에 장면이 제대로 찍히는지 (까맣거나 한 색이 아님): 캔버스를 그대로 읽는다
    const varied = await T(A, () => new Promise((ok) => requestAnimationFrame(() => {
      const c = document.createElement('canvas'), s = document.getElementById('c'); c.width = 120; c.height = 240;
      const g = c.getContext('2d'); g.drawImage(s, 0, 0, c.width, c.height);
      const d = g.getImageData(0, 0, c.width, c.height).data, seen = new Set(); let lum = 0;
      for (let i = 0; i < d.length; i += 4) { seen.add((d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4)); lum += d[i] + d[i + 1] + d[i + 2]; }
      ok({ colors: seen.size, lum: lum / (d.length / 4) / 3 });
    })));
    check('켠 화면에 장면이 보임 (여러 색, 까맣지 않음)', varied.colors > 60 && varied.lum > 25, varied);

    /* 1인칭 */
    await T(A, () => window.__tree.setPov(true));
    check('1인칭에서는 미니어처 흐림이 꺼짐', await until(async () => (await look(A)).tilt === 0, 4000), await look(A));
    await T(A, () => { const t = window.__tree; t.me.place(-0.6, -1.2); t.aim(0.35, -0.25); });
    await sleep(1200);
    await A.screenshot({ path: path.join(OUT, 'look-fx-fire.png') });
    await T(A, () => window.__tree.setPov(false));

    /* 사진 */
    await T(A, () => window.__tree.snapView());
    await A.tap('#snap');
    check('켠 채로 사진 찍기: 미리보기가 뜸', await until(async () => { const ph = await T(A, () => window.__party.photo); return ph && ph.open && ph.ready; }, 9000), await T(A, () => window.__party.photo));
    check('사진에 장면이 찍힘 (한 가지 색이 아님)', (await T(A, () => window.__party.varied())) > 40, await T(A, () => window.__party.varied()));
    await A.tap('#photoClose');

    await A.close();

    /* 느려지면 한 단계씩 (검사 기기는 느려서 45 장쯤 그리면 저절로 내려가므로 새 화면에서 바로 본다) */
    const D = await open(ctx, '?fx=1&ns=lk4');
    check('새로 연 화면은 high', (await look(D)).q === 'high', await look(D));
    await T(D, () => window.__tree.stepDown());
    const m = await look(D), f1 = await frames(D); await sleep(1200);
    check('느린 기기: 첫 단계는 화면 다듬기만 끔 (mid, 빛 배수 1)', !m.fx && m.q === 'mid' && m.glow === 1 && (await frames(D)) > f1, m);
    await T(D, () => window.__tree.stepDown());
    const l = await look(D), f2 = await frames(D); await sleep(1200);
    check('다음 단계는 화질 낮추기 (low) 이고 계속 그려짐', !l.fx && l.q === 'low' && (await frames(D)) > f2, l);
    await D.close();

    /* ?fx=0 */
    const B = await open(ctx, '?fx=0&ns=lk2');
    const b = await look(B);
    check('?fx=0 이면 꺼짐', !b.fx && b.q === 'mid' && b.glow === 1, b);
    await B.close();

    /* lowerQuality 를 바로 부르면 low (예전과 같음) */
    const C = await open(ctx, '?fx=1&ns=lk3');
    await T(C, () => window.__tree.lowerQuality());
    const c = await look(C), f3 = await frames(C); await sleep(1200);
    check('lowerQuality() 는 바로 low 로 (화면 다듬기도 꺼짐)', c.q === 'low' && !c.fx && (await frames(C)) > f3, c);
    await C.close();

    check('오류 없음', errors.length === 0, errors);
  } catch (e) { console.log(e); results.push(false); } finally { await browser.close(); server.close(); }
  const bad = results.filter((x) => !x).length;
  console.log(`\n${results.length - bad}/${results.length} 통과`);
  process.exit(bad ? 1 : 0);
})();
