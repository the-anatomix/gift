// 새해 검사: 12월 31일의 띠 → 자정 카운트다운과 불꽃 → "새해 첫 해까지" 띠 → 7:30 해돋이(큰 해·인사) · 마스터 판의 "🌅 새해 해돋이" 미리 보기와 친구에게 전해지는 것
// 실행: cd tree/tests && node newyear.test.js   (window.__now 로 날짜·시각을 바꿔 가며 본다. 화면 사진은 out/newyear-*.png)
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8231, BASE = `http://localhost:${PORT}/tree/`, OUT = path.join(__dirname, 'out');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const HASH = 'de94e28d7a302b52374831e94e8c70adddf861c691e77ab53f0646f55543a3e7';
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(60); } }
const errors = [];
const T = (p, fn, arg) => p.evaluate(fn, arg);
const ready = (p) => until(() => p.evaluate(() => !!(window.__tree && window.__sky && window.__tree.frames > 3)), 30000);
const CLOCK = () => { window.__clk = { base: Date.now(), t0: performance.now() }; window.__now = () => window.__clk.base + (performance.now() - window.__clk.t0); };
const setNow = (p, y, mo, d, h, mi, s = 0) => T(p, (a) => { window.__clk = { base: new Date(a[0], a[1] - 1, a[2], a[3], a[4], a[5]).getTime(), t0: performance.now() }; window.__sky.refresh(); }, [y, mo, d, h, mi, s]);
async function open(ctx, url, at, master) {
  const p = await ctx.newPage();
  await p.addInitScript(CLOCK);
  await p.addInitScript((a) => { window.__clk.base = new Date(a[0], a[1] - 1, a[2], a[3], a[4], a[5] || 0).getTime(); }, at);
  await p.addInitScript((mk) => { window.__bare = true; if (mk) localStorage.setItem('tree.master.' + new URLSearchParams(location.search).get('ns'), mk); }, master ? HASH : '');
  p.on('pageerror', (e) => { errors.push(e.message); console.log('   (페이지 오류)', e.message); });
  await p.goto(url); await ready(p);
  if (await p.isVisible('#lookDone')) await p.click('#lookDone');
  return p;
}
const band = (p) => T(p, () => window.__sky.band);
const bigText = (p) => T(p, () => window.__sky.big);
const rise = (p) => T(p, () => window.__sky.rise);
const shot = (p, name) => p.screenshot({ path: path.join(OUT, `newyear-${name}.png`) });
const serve = () => http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = serve();
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    /* 규칙 (화면과 상관없는 계산) */
    const A = await open(ctx, `${BASE}?net=bc&door=0&ns=na`, [2026, 12, 30, 15, 0], true);
    const rules = await T(A, async () => {
      const m = await import('./sky.js'), at = (...a) => new Date(...a).getTime(), ph = (...a) => { const r = m.nyPhase(at(...a)); return [r.phase, Math.round(r.left)]; };
      return {
        ny: [m.nyAt(at(2026, 11, 31, 12)) === at(2027, 0, 1), m.nyAt(at(2027, 0, 1, 5)) === at(2027, 0, 1), m.nyAt(at(2026, 6, 1)) === at(2027, 0, 1), m.nyAt(at(2027, 5, 30)) === at(2027, 0, 1)],
        sun: m.firstSunAt(at(2026, 11, 31, 12)) === at(2027, 0, 1, 7, 30),
        ph: [ph(2026, 11, 30, 23, 0), ph(2026, 11, 31, 0, 0, 1), ph(2026, 11, 31, 23, 59, 55), ph(2027, 0, 1, 0, 0, 30), ph(2027, 0, 1, 0, 1, 0), ph(2027, 0, 1, 7, 29, 0), ph(2027, 0, 1, 7, 31, 0), ph(2027, 0, 1, 7, 46, 0), ph(2027, 0, 2, 0, 0, 0), ph(2026, 11, 25, 0, 0, 5)],
        rise: [m.riseAt(120), m.riseAt(60), m.riseAt(-90), m.riseAt(-400), m.riseAt(-899).map((v) => +v.toFixed(2)), m.riseAt(-901)],
      };
    });
    check('새해 0시: 12월에는 다음 해, 1월에는 그해, 7월부터는 다음 해 · 첫 해는 1월 1일 7:30', rules.ny.every(Boolean) && rules.sun, rules);
    check('때마다 보일 것: 30일 없음 · 31일 띠 · 23:59:55 큰 숫자 · 0시 불꽃 · 그 뒤 기다림 · 7:30 해돋이 · 7:46 부터 없음 · 크리스마스에는 없음',
      JSON.stringify(rules.ph.map((r) => r[0])) === '[null,"band","count","show","wait","wait","dawn",null,null,null]' && rules.ph[2][1] === 5 && rules.ph[5][1] === 60 && rules.ph[6][1] === -60, rules.ph);
    check('큰 해: 해 뜨기 60초 전부터 150초 동안 떠오르고, 15분 뒤에 사라짐', JSON.stringify(rules.rise.slice(0, 4)) === '[[0,0],[0,1],[1,1],[1,1]]' && rules.rise[4][1] < 0.05 && rules.rise[5][1] === 0, rules.rise);

    /* 12월 30일: 아무것도 없음 → 31일: 띠 */
    check('12월 30일에는 띠가 없음', (await band(A)) === null && (await rise(A))[1] === 0);
    await setNow(A, 2026, 12, 31, 18, 47, 20);
    check('12월 31일에는 위에 "🎆 새해까지 5:12:40" 띠', await until(async () => (await band(A)) === '🎆 새해까지 5:12:40', 3000), await band(A));
    await setNow(A, 2026, 12, 31, 23, 54, 30);
    check('한 시간 안쪽이면 분:초로', await until(async () => /^🎆 새해까지 5:(30|29)$/.test(await band(A)), 3000), await band(A));
    await shot(A, 'band');

    /* 자정 */
    await T(A, () => { window.__seen = []; window.__ev = []; new MutationObserver(() => { const t = document.getElementById('xmasBig').textContent; if (t && window.__seen[window.__seen.length - 1] !== t) window.__seen.push(t); }).observe(document.getElementById('xmasBig'), { childList: true, characterData: true, subtree: true }); for (const n of ['tree:newyear', 'tree:firstsun']) window.addEventListener(n, (e) => window.__ev.push([n, e.detail.at])); });
    await setNow(A, 2026, 12, 31, 23, 59, 54);
    check('23:59:50 부터 큰 숫자가 줄어들고 띠는 숨음', await until(async () => /^[1-6]$/.test(await bigText(A)), 4000) && (await band(A)) === null, await bigText(A));
    check('0시 정각에 "새해 복 많이 받으세요! 🎆" 와 불꽃놀이 60초', await until(async () => (await bigText(A)).includes('새해 복 많이'), 12000) && await until(async () => { const s = await T(A, () => window.__sky.show); return s && s.mid && s.left > 40 && s.left <= 60; }, 3000), await T(A, () => window.__sky.show));
    check('숫자가 차례로 줄었고 tree:newyear 사건이 한 번 옴', await T(A, () => { const n = window.__seen.filter((t) => /^\d+$/.test(t)).map(Number); return n.length >= 3 && n.every((v, i) => !i || v < n[i - 1]) && window.__ev.length === 1 && window.__ev[0][0] === 'tree:newyear' && window.__ev[0][1] === new Date(2027, 0, 1).getTime(); }), await T(A, () => [window.__seen, window.__ev]));
    check('불꽃이 실제로 터짐', await until(async () => (await T(A, () => window.__sky.fire)).live > 0, 6000));
    await sleep(600); await shot(A, 'midnight');

    /* 첫 해를 기다림 */
    await setNow(A, 2027, 1, 1, 0, 1, 10);
    check('불꽃이 끝나면 "🌅 새해 첫 해까지 7:28:50" 띠, 큰 해는 아직 없음', await until(async () => /^🌅 새해 첫 해까지 7:28:(50|49)$/.test(await band(A)), 4000) && (await rise(A))[1] === 0, await band(A));
    await setNow(A, 2027, 1, 1, 7, 29, 30);
    check('해 뜨기 1분 전부터 큰 해가 떠오르기 시작', await until(async () => { const r = await rise(A); return r[1] === 1 && r[0] > 0.02 && r[0] < 0.4; }, 4000) && /첫 해까지 0:(30|29|28)/.test(await band(A)), [await rise(A), await band(A)]);
    await T(A, () => document.getElementById('pov').click()); await sleep(500);
    await setNow(A, 2027, 1, 1, 7, 29, 57);
    check('7:30 에 "새해 첫 해가 떴어요! 🌅" 와 tree:firstsun 사건', await until(async () => (await bigText(A)).includes('첫 해가 떴어요'), 8000) && await T(A, () => window.__ev.length === 2 && window.__ev[1][0] === 'tree:firstsun' && window.__ev[1][1] === new Date(2027, 0, 1, 7, 30).getTime()) && (await band(A)) === '🌅 새해 첫 해가 떠올랐어요', [await bigText(A), await band(A)]);
    await setNow(A, 2027, 1, 1, 7, 31, 20);
    check('해가 다 떠오름 (높이 1)', await until(async () => (await rise(A))[0] > 0.9, 4000), await rise(A));
    await T(A, () => window.__tree.aim(Math.PI + 0.22, 0.12)); await sleep(700); await shot(A, 'sunrise-eye');
    await T(A, () => document.getElementById('pov').click()); await sleep(600); await shot(A, 'sunrise-top');
    check('인사는 몇 초 뒤에 사라지고, 띠는 2분 뒤에 사라짐', await until(async () => (await bigText(A)) === '', 12000) && (await setNow(A, 2027, 1, 1, 7, 32, 5), await until(async () => (await band(A)) === null, 4000)), [await bigText(A), await band(A)]);
    await setNow(A, 2027, 1, 1, 7, 46, 0);
    check('15분 뒤에는 큰 해가 사라지고 보통 아침 하늘', await until(async () => (await rise(A))[1] === 0, 4000), await rise(A));
    await setNow(A, 2027, 1, 1, 0, 0, 20);
    check('0시 40초 안에 들어온 사람은 남은 불꽃을 봄', await until(async () => { const s = await T(A, () => window.__sky.show); return s && s.mid && s.left > 30 && s.left < 41; }, 4000));

    /* 미리 보기 (마스터 판) */
    await setNow(A, 2026, 11, 20, 14, 0, 0);
    await until(async () => !(await T(A, () => window.__sky.show)), 4000);
    await T(A, () => window.__duo.invite());
    await until(() => T(A, () => window.__duo.mode === 'waiting'));
    const room = (await T(A, () => window.__duo.inviteUrl())).split('#r=')[1];
    const B = await open(ctx, `${BASE}?net=bc&door=0&ns=nb#r=${room}`, [2026, 11, 20, 14, 0], false);
    await until(async () => (await T(A, () => window.__duo.count)) === 2, 20000);
    check('마스터키가 없는 친구에게는 해돋이 단추가 없고, 눌러도 안 됨', !(await B.isVisible('#dawnShow')) && !(await T(B, () => window.__tree.dawn && window.__tree.dawn())) && !(await T(B, () => window.__sky.demo)));
    await A.bringToFront();
    await A.tap('#tabs button[data-m="master"]'); await sleep(300);
    const bad = await T(A, () => [...document.querySelectorAll('#masterP button')].filter((b) => b.getBoundingClientRect().width && !b.closest('[hidden]')).map((b) => [b.textContent, b.getBoundingClientRect()]).filter(([, r]) => r.width < 43.5 || r.height < 43.5 || r.left < 0 || r.right > innerWidth + 0.5).map(([t]) => t));
    check('마스터 판에 "🌅 새해 해돋이" 단추 (화면 안·44px 이상)', (await A.isVisible('#dawnShow')) && bad.length === 0, bad);
    await A.tap('#dawnShow');
    check('누르면 판이 닫히고 큰 숫자 10부터', await until(async () => /^(10|9|8)$/.test(await bigText(A)), 3000) && (await T(A, () => window.__tree.mode)) === null, await bigText(A));
    check('친구 화면에서도 같이 시작됨', await until(async () => { const d = await T(B, () => window.__sky.demo); return d && d.sec < 6; }, 4000), await T(B, () => window.__sky.demo));
    check('하는 동안 다시 누를 수 없음', !(await T(A, () => window.__tree.dawn())));
    check('10초 뒤 새해 인사와 불꽃', await until(async () => (await bigText(A)).includes('새해 복 많이'), 14000) && await until(async () => !!(await T(A, () => window.__sky.show)), 2000));
    const s0 = await T(A, () => window.__sky.state);
    check('처음에는 낮 2시인데도 밤하늘', s0.day < 0.05 && s0.stars > 0.5, s0);
    check('하늘이 밝아 오며 해가 떠오름', await until(async () => { const r = await rise(A), s = await T(A, () => window.__sky.state); return r[0] > 0.3 && r[1] > 0.9 && s.day > 0.1 && s.dusk > 0.4; }, 40000), [await rise(A), await T(A, () => window.__sky.demo)]);
    await shot(A, 'demo-rise');
    check('"새해 첫 해가 떴어요! 🌅"', await until(async () => (await bigText(A)).includes('첫 해가 떴어요'), 20000) && await until(async () => (await bigText(B)).includes('첫 해가 떴어요'), 6000));
    await sleep(500); await shot(A, 'demo-sun');
    check('70초 뒤 끝나면 원래 하늘(낮)로 돌아오고 큰 해·글자가 사라짐', await until(async () => !(await T(A, () => window.__sky.demo)), 30000) && await until(async () => { const s = await T(A, () => window.__sky.state); return s.day > 0.98 && (await rise(A))[1] === 0 && (await bigText(A)) === ''; }, 4000) && await until(async () => !(await T(B, () => window.__sky.demo)), 8000), [await T(A, () => window.__sky.state.day), await rise(A)]);
    check('페이지 오류 없음', errors.length === 0, errors);
  } catch (e) {
    console.log('검사 중 오류', e); results.push(false);
  } finally {
    await browser.close(); server.close();
  }
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok} / ${results.length} 통과`);
  process.exit(ok === results.length ? 0 : 1);
})();
