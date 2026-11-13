// 창밖 낮과 밤, 눈 날씨, 크리스마스 자정 카운트다운과 불꽃놀이 검사. 실행: cd tree/tests && node sky.test.js
// window.__now 로 날짜·시각을 바꿔 가며 본다. 화면 사진은 out/sky-*.png
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8197, BASE = `http://localhost:${PORT}/tree/`, OUT = path.join(__dirname, 'out');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(60); } }
const errors = [];
const T = (p, fn, arg) => p.evaluate(fn, arg);
const ready = (p) => until(() => p.evaluate(() => !!(window.__tree && window.__sky && window.__tree.frames > 3)), 30000);
// 시계: 정한 시각에서부터 실제로 흐른 만큼 간다
const CLOCK = () => { window.__clk = { base: Date.now(), t0: performance.now() }; window.__now = () => window.__clk.base + (performance.now() - window.__clk.t0); };
const setNow = (p, y, mo, d, h, mi, s = 0) => T(p, (a) => { window.__clk = { base: new Date(a[0], a[1] - 1, a[2], a[3], a[4], a[5]).getTime(), t0: performance.now() }; window.__sky.refresh(); }, [y, mo, d, h, mi, s]);
async function open(ctx, url, at) {
  const p = await ctx.newPage();
  await p.addInitScript(CLOCK);
  if (at) await p.addInitScript((a) => { window.__clk.base = new Date(a[0], a[1] - 1, a[2], a[3], a[4], a[5] || 0).getTime(); }, at);
  await p.addInitScript(() => { window.__bare = true; });
  p.on('pageerror', (e) => { errors.push(e.message); console.log('   (페이지 오류)', e.message); });
  await p.goto(url); await ready(p);
  if (await p.isVisible('#lookDone')) await p.click('#lookDone');
  return p;
}
const sky = (p) => T(p, () => window.__sky.state);
const shot = (p, name) => p.screenshot({ path: path.join(OUT, `sky-${name}.png`) });
// 화면 사진의 네모 칸(비율) 평균 밝기와 색
async function meanColor(p, r) {
  const b64 = (await p.screenshot()).toString('base64');
  return T(p, async ([b64, r]) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(Math.round(r[0] * c.width), Math.round(r[1] * c.height), Math.round((r[2] - r[0]) * c.width), Math.round((r[3] - r[1]) * c.height)).data;
    let R = 0, G = 0, B = 0; const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) { R += d[i]; G += d[i + 1]; B += d[i + 2]; }
    R /= n; G /= n; B /= n;
    return { r: R, g: G, b: B, l: 0.2126 * R + 0.7152 * G + 0.0722 * B };
  }, [b64, r]);
}
const audit = (p) => p.evaluate(() => {
  const bad = [];
  for (const b of document.querySelectorAll('button, a')) {
    const r = b.getBoundingClientRect();
    if (!r.width || b.closest('[hidden]') || getComputedStyle(b).display === 'none') continue;
    const name = (b.textContent || b.getAttribute('aria-label') || '').trim();
    if (r.width < 43.5 || r.height < 43.5) bad.push(`${name}: ${Math.round(r.width)}×${Math.round(r.height)}`);
    if (!b.closest('.scroll') && (r.left < 0 || r.top < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5)) bad.push(`${name}: 화면 밖`);
  }
  return bad;
});
const place = (p, x, z) => T(p, ([x, z]) => { window.__tree.me.stop(); window.__tree.me.place(x, z); }, [x, z]);
const look = (p, dx, dz) => T(p, ([dx, dz]) => window.__tree.lookTo(dx, dz), [dx, dz]);
const pov = (p, fp) => T(p, (fp) => { if ((window.__tree.pov === 'fp') !== fp) window.__tree.setPov(fp); }, fp);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  try {
    const phone = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true };
    const ctx = await browser.newContext(phone);
    const A = await open(ctx, `${BASE}?net=bc&door=0&ns=sa`, [2026, 12, 20, 12, 0]);

    /* 정한 규칙 */
    const rules = await T(A, async () => {
      const m = await import('./sky.js');
      const at = (mo, d, h, mi = 0) => new Date(2026, mo - 1, d, h, mi).getTime();
      const dec = []; for (let d = 1; d <= 31; d++) for (let h = 0; h < 24; h++) dec.push(m.weatherAt(at(12, d, h)));
      const eve = []; for (const d of [24, 25]) for (let h = 0; h < 24; h++) eve.push(m.weatherAt(at(12, d, h)));
      const jul = []; for (let d = 1; d <= 31; d++) for (let h = 0; h < 24; h++) jul.push(m.weatherAt(at(7, d, h)));
      const fw = { words: m.fireWords('  메리   크리스마스 ').join('|'), long: m.fireWords('가나다라마바사아자차카타').join('|'), msg: m.fireMsg(15, 0, ''), msg2: m.fireMsg(30, 0, '안녕'), back: m.parseFire('fire:30:0:안 녕\u0007', 0), old: m.parseFire('fire', 0), bad: [m.parseFire('fire:20:0:', 0), m.parseFire('fire:15:99999999999999:', 0), m.parseFire('x', 0), m.parseFire(5, 0)] };
      const sameHour = [0, 13, 37, 59].every((mi) => m.weatherAt(at(12, 20, 15, mi)) === m.weatherAt(at(12, 20, 15)));
      return {
        noon: m.skyAt(at(12, 20, 12)), three: m.skyAt(at(12, 20, 3)), set: m.skyAt(at(12, 20, 17, 30)), rise: m.skyAt(at(12, 20, 7, 30)),
        d730: m.skyAt(at(12, 20, 8, 15)).day, d1650: m.skyAt(at(12, 20, 16, 45)).day, d1820: m.skyAt(at(12, 20, 18, 15)).day,
        decSnow: dec.filter((w) => w > 0).length / dec.length, decHeavy: dec.filter((w) => w === 2).length / dec.length,
        eveAll: eve.every((w) => w > 0), julClear: jul.every((w) => w === 0), sameHour, fw,
        x1: m.xmasPhase(new Date(2026, 11, 24, 23, 49, 59).getTime()).phase, x2: m.xmasPhase(new Date(2026, 11, 24, 23, 50, 1).getTime()).phase,
        x3: m.xmasPhase(new Date(2026, 11, 24, 23, 59, 51).getTime()).phase, x4: m.xmasPhase(new Date(2026, 11, 25, 0, 0, 0).getTime()).phase,
        x5: m.xmasPhase(new Date(2026, 11, 25, 0, 0, 41).getTime()).phase, xmas25: m.isXmas(new Date(2026, 11, 25, 15).getTime()), xmas26: m.isXmas(new Date(2026, 11, 26, 0, 1).getTime()),
      };
    });
    check('정오는 낮, 새벽 3시는 밤', rules.noon.day === 1 && rules.noon.phase === 'day' && rules.three.day === 0 && rules.three.phase === 'night', [rules.noon, rules.three]);
    check('해 뜨는 7:30·지는 17:30 은 해질녘 빛 (반쯤 밝음)', rules.set.phase === 'dusk' && rules.rise.phase === 'dusk' && rules.set.dusk > 0.8 && rules.rise.day > 0.3 && rules.rise.day < 0.7, [rules.rise, rules.set]);
    check('앞뒤 40분은 부드럽게 섞임 (8:15 거의 낮, 16:45 아직 낮, 18:15 밤)', rules.d730 > 0.95 && rules.d1650 > 0.95 && rules.d1820 < 0.05, rules);
    check('12월은 절반쯤 눈 (조금+함박눈 35~65%, 함박눈 10~30%)', rules.decSnow > 0.35 && rules.decSnow < 0.65 && rules.decHeavy > 0.1 && rules.decHeavy < 0.3, [rules.decSnow, rules.decHeavy]);
    check('12월 24~25일은 늘 눈, 7월은 늘 맑음', rules.eveAll && rules.julClear);
    check('날씨는 날짜와 시로 정해짐 (같은 시 안에서는 같음)', rules.sameHour);
    check('불꽃놀이 글자: 띄어쓰기로 나누고 긴 말은 다섯 자씩, 모두 열 자까지', rules.fw.words === '메리|크리스마스' && rules.fw.long === '가나다라마|바사아자차', rules.fw);
    check('불꽃놀이 소식: 기본은 예전 그대로 \'fire\', 글자·길이는 붙여 보내고, 이상한 값은 버림', rules.fw.msg === 'fire' && rules.fw.msg2 === 'fire:30:0:안녕' && rules.fw.back && rules.fw.back.sec === 30 && rules.fw.back.text === '안 녕' && rules.fw.old.sec === 15 && rules.fw.bad.every((b) => b === null), rules.fw);
    check('자정 장면 순서: 23:50 띠 → 23:59:50 숫자 → 0시 불꽃 → 40초 뒤 끝', rules.x1 === null && rules.x2 === 'band' && rules.x3 === 'count' && rules.x4 === 'show' && rules.x5 === null, rules);
    check('크리스마스(25일) 알아보기', rules.xmas25 && !rules.xmas26);

    /* 창: 모든 창이 하늘 그림으로 */
    check('모든 창(1~3층, 25개)이 하늘을 그리는 창이 됨', (await T(A, () => window.__sky.panes())) === 25, await T(A, () => window.__sky.panes()));

    /* 낮 */
    await setNow(A, 2026, 7, 10, 12, 0); await sleep(600);
    const day = await sky(A);
    check('7월 정오: 낮, 맑음, 별·달 없음, 조명은 원래 세기', day.day === 1 && day.weather === 0 && day.stars === 0 && day.moon === 0 && Math.abs(day.hemi - 1.35) < 1e-9 && Math.abs(day.sun - 1.9) < 1e-9, day);
    await until(async () => !(await T(A, () => window.__sky.snowShown)), 8000);
    check('맑은 날에는 눈이 내리지 않음', !(await T(A, () => window.__sky.snowShown)));
    const dayIn = await meanColor(A, [0.25, 0.3, 0.75, 0.55]);
    await shot(A, 'phone-day-iso');

    /* 해질녘 */
    await setNow(A, 2026, 7, 10, 17, 35); await sleep(600);
    const dusk = await sky(A);
    check('17:35: 해질녘 (주황~보라)', dusk.phase === 'dusk' && dusk.dusk > 0.8, dusk);
    await shot(A, 'phone-dusk-iso');

    /* 밤 */
    await setNow(A, 2026, 7, 10, 22, 0); await sleep(600);
    const night = await sky(A);
    check('밤: 별과 달, 창은 노란 불빛, 마당에 빛 웅덩이', night.day === 0 && night.stars > 0.5 && night.moon > 0.5 && (night.glass >> 16) > (night.glass & 255) + 60 && night.pool > 0.5, night);
    check('밤에도 집 안 조명은 낮의 70% 위 (하늘빛·햇빛)', night.hemi >= day.hemi * 0.7 && night.sun >= day.sun * 0.7 && night.hemi + night.sun >= (day.hemi + day.sun) * 0.7, [night.hemi, night.sun]);
    const nightIn = await meanColor(A, [0.25, 0.3, 0.75, 0.55]);
    check('화면에서도 밤의 집 안은 낮의 70% 넘게 밝음', nightIn.l >= dayIn.l * 0.7, [dayIn.l, nightIn.l]);
    await shot(A, 'phone-night-iso');

    /* 점등식과 같이: 하늘 밝기 × 점등식 밝기 */
    const base = await T(A, () => window.__party.bright());
    await T(A, () => window.__party.begin('light'));
    await sleep(3300);
    const mid = await T(A, () => window.__party.bright());
    check('밤의 점등식: 방이 밤 밝기보다 더 어두워짐 (곱해짐)', mid.hemi < base.hemi * 0.5, [base, mid]);
    await setNow(A, 2026, 7, 10, 12, 0); await sleep(700); // 점등식 중에 낮이 되어도
    check('점등식 중에는 하늘이 조명 바탕값을 바꾸지 않음', Math.abs((await T(A, () => window.__party.bright())).hemi / base.hemi - (await T(A, () => window.__sky.state)).hemi / base.hemi) < 1e-9 || (await T(A, () => window.__sky.state)).base[0] === night.base[0], await sky(A));
    check('점등식이 끝나면 조명이 정확히 원래 밤 값으로', await until(async () => !(await T(A, () => window.__party.show)) && Math.abs((await T(A, () => window.__party.bright())).hemi - base.hemi) < 1e-9, 9000), await T(A, () => window.__party.bright()));
    check('점등식이 끝나고 조금 뒤에 낮 밝기로 바뀜', await until(async () => Math.abs((await T(A, () => window.__party.bright())).hemi - 1.35) < 1e-9, 6000), await T(A, () => window.__party.bright()));

    /* 눈 */
    await setNow(A, 2026, 12, 24, 21, 0);
    check('12월 24일 밤: 눈이 내림 (마당 위 입자가 보임)', await until(async () => { const s = await sky(A); return s.weather > 0 && s.snow > 0.3 && await T(A, () => window.__sky.snowShown); }, 8000), await sky(A));
    await shot(A, 'phone-snow-night-iso');
    await pov(A, true); await place(A, 2.6, 9.0); await look(A, 0.25, -1); await sleep(900);
    check('1인칭에서는 하늘 돔이 보임', await T(A, () => window.__sky.dome));
    const yardSky = await meanColor(A, [0.05, 0.1, 0.95, 0.16]);
    check('마당 1인칭 밤하늘은 어두움', yardSky.l < 80, yardSky);
    await shot(A, 'phone-snow-night-fp-yard');
    await look(A, 0.1, 1); await sleep(600); await shot(A, 'phone-snow-night-fp-yard-south');
    await place(A, -1.2, -2.2); await look(A, -0.15, -1); await sleep(900);
    await shot(A, 'phone-snow-night-fp-window');
    await pov(A, false); await sleep(400);
    check('내려다보면 하늘 돔은 숨김', !(await T(A, () => window.__sky.dome)));
    await setNow(A, 2026, 12, 24, 13, 0); await sleep(700);
    await place(A, 2.6, 7.5); await sleep(500);
    await shot(A, 'phone-snow-day-iso');
    await pov(A, true); await look(A, 0.25, -1); await sleep(800); await shot(A, 'phone-snow-day-fp-yard');
    await place(A, -1.2, -2.2); await look(A, -0.15, -1); await sleep(800); await shot(A, 'phone-snow-day-fp-window');
    await pov(A, false);

    /* 자정: 띠 → 큰 숫자 → 메리 크리스마스와 불꽃 */
    await place(A, 1.75, 2.25);
    await T(A, () => { window.__xmasEv = 0; addEventListener('tree:xmas', () => { window.__xmasEv++; }); });
    await setNow(A, 2026, 12, 24, 23, 50, 5);
    check('23:50:05 위에 "크리스마스까지 9:55" 띠', await until(async () => (await T(A, () => window.__sky.band)) === '🎄 크리스마스까지 9:55', 2000), await T(A, () => window.__sky.band));
    await shot(A, 'phone-band');
    check('띠가 있어도 단추들은 화면 안·44px 이상', (await audit(A)).length === 0, await audit(A));
    await setNow(A, 2026, 12, 24, 23, 59, 49);
    await T(A, () => { window.__seen = []; new MutationObserver(() => { const t = document.getElementById('xmasBig').textContent; if (t && window.__seen[window.__seen.length - 1] !== t) window.__seen.push(t); }).observe(document.getElementById('xmasBig'), { childList: true, characterData: true, subtree: true }); });
    check('23:59:50 부터 큰 숫자 10', await until(async () => (await T(A, () => window.__sky.big)) === '10', 3000), await T(A, () => window.__sky.big));
    check('숫자가 뜨면 띠는 사라짐', (await T(A, () => window.__sky.band)) === null);
    await sleep(2200); await shot(A, 'phone-count');
    check('0시 정각: "메리 크리스마스! 🎄"', await until(async () => (await T(A, () => window.__sky.big)) === '메리 크리스마스! 🎄', 11000), await T(A, () => window.__seen));
    const seen = await T(A, () => window.__seen);
    check('10 → 1 까지 차례로 셈', JSON.stringify(seen.slice(0, 10)) === JSON.stringify(['10', '9', '8', '7', '6', '5', '4', '3', '2', '1']), seen);
    check('0시에 tree:xmas 사건이 한 번 옴 (선물 교환이 쓸 수 있게)', (await T(A, () => window.__xmasEv)) === 1);
    check('불꽃이 터짐', await until(async () => { const f = await T(A, () => window.__sky.fire); return f.visible && f.live > 20; }, 4000), await T(A, () => window.__sky.fire));
    const sm = await T(A, () => window.__sky.show);
    check('자정 불꽃놀이는 40초쯤', sm && sm.mid && sm.left > 33 && sm.left <= 40, sm);
    check('터질 때 방이 불꽃 색으로 물듦', await until(async () => (await T(A, () => window.__sky.fire)).tint !== 0xFFE4C4, 4000), await T(A, () => window.__sky.fire));
    await sleep(500); await shot(A, 'phone-fire-iso');
    await pov(A, true); await place(A, 2.6, 8.4); await look(A, 0.1, 1); await sleep(1600); await shot(A, 'phone-fire-fp-yard');
    await place(A, -1.2, -2.2); await look(A, -0.15, -1); await sleep(1200); await shot(A, 'phone-fire-fp-window');
    // 3층: 옥상 전망대
    await place(A, 3.5 + 32, 0.5); await sleep(500);
    check('3층에 올라감', (await T(A, () => window.__tree.level)) === 2, await T(A, () => window.__tree.level));
    await look(A, 0.1, 1); await T(A, () => { window.__tree.me.stop(); }); await sleep(400);
    check('3층 1인칭: 불꽃놀이 동안 천장이 걷힘', !(await T(A, () => window.__sky.ceil)));
    await T(A, () => { const W = window.__tree; W.lookTo(0.1, 1); }); await sleep(200);
    await T(A, () => { window.__sky.burst(true); window.__sky.burst(false); }); await sleep(1300);
    await shot(A, 'phone-fire-fp-3f');
    await pov(A, false); await sleep(300); await T(A, () => window.__sky.burst(true)); await sleep(1200);
    check('3층 내려다보기에서도 불꽃이 보임', (await T(A, () => window.__sky.fire)).live > 20);
    await shot(A, 'phone-fire-iso-3f');
    await setNow(A, 2026, 12, 25, 0, 0, 41);
    check('40초가 지나면 불꽃놀이가 끝남', await until(async () => !(await T(A, () => window.__sky.show)), 3000));
    await pov(A, true); await sleep(300);
    check('끝나면 3층 천장이 돌아옴 (1인칭)', await until(() => T(A, () => window.__sky.ceil), 4000));
    await pov(A, false); await place(A, 1.75, 2.25); await sleep(300);
    check('카운트다운 글이 남지 않음', await until(async () => (await T(A, () => window.__sky.big)) === '', 8000), await T(A, () => window.__sky.big));

    /* 25일: 트리 판의 불꽃놀이 단추, 친구에게도 */
    await T(A, () => window.__duo.invite());
    const room = (await T(A, () => window.__duo.inviteUrl())).split('#r=')[1];
    const B = await open(ctx, `${BASE}?net=bc&door=0&ns=sb#r=${room}`, [2026, 12, 25, 15, 0]);
    check('친구가 같은 방에 들어옴', await until(async () => (await T(A, () => window.__duo.count)) === 2 && (await T(B, () => window.__duo.mode)) === 'on', 15000));
    await setNow(A, 2026, 12, 25, 15, 0); await setNow(B, 2026, 12, 25, 15, 0);
    await A.tap('#tabs button[data-m="tree"]'); await sleep(500);
    check('25일: 트리 판에 "🎆 불꽃놀이" 단추, 44px 이상·화면 안', (await A.isVisible('#fireShow')) && (await audit(A)).length === 0, await audit(A));
    await shot(A, 'phone-fire-button');
    await A.tap('#fireShow'); await sleep(250);
    check('단추를 누르면 불꽃놀이 판(글자·길이·언제), 단추는 44px 이상·화면 안', (await A.isVisible('#firePop')) && (await A.isVisible('#fireText')) && (await audit(A)).length === 0, await audit(A));
    await shot(A, 'phone-fire-pop');
    await A.tap('#fireGo');
    check('터뜨리면 판이 닫히고 내 화면에 불꽃놀이', await until(async () => !!(await T(A, () => window.__sky.show)), 2000));
    check('친구 화면에도 불꽃놀이', await until(async () => !!(await T(B, () => window.__sky.show)) && (await T(B, () => window.__sky.fire)).live > 0, 5000));
    await sleep(800);
    await A.tap('#fireShow'); await sleep(250); await A.tap('#fireGo'); await sleep(300);
    await A.tap('#fireClose');
    check('30초 안에 다시 누르면 안내만 (소식을 다시 보내지 않음)', /30초에 한 번/.test(await A.textContent('#toast')), await A.textContent('#toast'));
    await A.tap('#tabs button[data-m="tree"]');
    await setNow(A, 2026, 12, 26, 9, 0); await setNow(B, 2026, 12, 26, 9, 0); await sleep(700);
    await B.tap('#tabs button[data-m="tree"]'); await sleep(400);
    check('26일: 꾸미는 친구(손님)에게는 불꽃놀이 단추가 없음', !(await B.isVisible('#fireShow')));
    await T(B, () => window.__sky.press()); await sleep(300);
    check('26일: 손님이 눌러도 안 됨 (안내만)', /크리스마스에만/.test(await B.textContent('#toast')), await B.textContent('#toast'));
    await B.tap('#tabs button[data-m="tree"]');
    await A.tap('#tabs button[data-m="tree"]'); await sleep(400);
    check('26일에도 방장에게는 불꽃놀이 단추가 있음', await A.isVisible('#fireShow'));
    await until(async () => !(await T(B, () => window.__sky.show)), 20000);
    await setNow(A, 2026, 12, 26, 9, 1); // 30초 간격이 지나도록 시계를 민다
    await A.tap('#fireShow'); await sleep(250);
    await A.fill('#fireText', '메리 크리스마스'); await A.tap('#fireSecs button[data-sec="30"]'); await A.tap('#fireGo');
    check('방장은 크리스마스가 아니어도 터뜨리고, 친구 화면에도 보임', await until(async () => !!(await T(A, () => window.__sky.show)) && !!(await T(B, () => window.__sky.show)), 5000));
    await A.tap('#tabs button[data-m="tree"]');

    /* 글자 불꽃, 길이, 예약 */
    const sb = await T(B, () => window.__sky.show);
    check('길이 30초와 글자가 친구에게도 전해짐 (메리 / 크리스마스)', sb && sb.left > 22 && sb.left <= 30.5 && sb.words.join('|') === '메리|크리스마스', sb);
    check('글자 모양 불꽃이 내 화면과 친구 화면에 터짐', await until(async () => (await T(A, () => window.__sky.word)) > 80 && (await T(B, () => window.__sky.word)) > 80, 6000), [await T(A, () => window.__sky.word), await T(B, () => window.__sky.word)]);
    await sleep(900); await shot(A, 'phone-fire-word');
    await pov(B, true); await place(B, 0, 0); await look(B, 0, 1);
    check('1인칭에서도 글자 불꽃', await until(async () => (await T(B, async () => { await new Promise((r) => setTimeout(r, 300)); return window.__sky.word; })) > 80, 8000));
    await sleep(900); await shot(B, 'phone-fire-word-fp'); await pov(B, false);
    await until(async () => !(await T(A, () => window.__sky.show)) && !(await T(B, () => window.__sky.show)), 40000);
    await setNow(A, 2026, 12, 26, 9, 5, 0); await setNow(B, 2026, 12, 26, 9, 5, 0);
    await A.tap('#tabs button[data-m="tree"]'); await sleep(300); await A.tap('#fireShow'); await sleep(250);
    await A.fill('#fireText', '생일 축하해'); await A.fill('#fireAt', '09:06'); await sleep(150);
    check('시각을 고르면 단추가 "9:06에 터뜨리기"', /9:06에 터뜨리기/.test(await A.textContent('#fireGo')), await A.textContent('#fireGo'));
    await A.tap('#fireGo'); await sleep(600);
    const pa = await T(A, () => window.__sky.plan), pb = await until(() => T(B, () => window.__sky.plan), 4000);
    check('예약: 바로 터지지 않고 나와 친구에게 예약이 잡힘', pa && pb && pa.mine && !pb.mine && pb.text === '생일 축하해' && pa.at === pb.at && !(await T(A, () => window.__sky.show)), [pa, pb]);
    check('예약: 화면 위에 "불꽃놀이까지 0:5x" 띠 (나와 친구)', /불꽃놀이까지 0:\d\d/.test(await T(A, () => window.__sky.fband) || '') && /불꽃놀이까지 0:\d\d/.test(await T(B, () => window.__sky.fband) || ''), [await T(A, () => window.__sky.fband), await T(B, () => window.__sky.fband)]);
    await shot(A, 'phone-fire-plan');
    await A.tap('#fireShow'); await sleep(250);
    check('예약해 두면 판에 "예약 취소"', await A.isVisible('#fireCancel') && (await audit(A)).length === 0, await audit(A));
    await A.tap('#fireCancel'); await sleep(500);
    check('예약 취소가 친구에게도 전해짐', !(await T(A, () => window.__sky.plan)) && !(await T(B, () => window.__sky.plan)) && !(await T(B, () => window.__sky.fband)));
    await A.fill('#fireAt', '09:06'); await A.tap('#fireGo'); await sleep(500);
    await A.tap('#tabs button[data-m="tree"]');
    await setNow(A, 2026, 12, 26, 9, 5, 58); await setNow(B, 2026, 12, 26, 9, 5, 58);
    check('예약한 시각이 되면 나와 친구 화면에 불꽃놀이, 띠는 사라짐', await until(async () => !!(await T(A, () => window.__sky.show)) && !!(await T(B, () => window.__sky.show)) && !(await T(A, () => window.__sky.fband)) && !(await T(B, () => window.__sky.plan)), 9000), [await T(A, () => window.__sky.show), await T(B, () => window.__sky.show)]);
    const wb = await T(B, () => window.__sky.show);
    check('예약한 글자도 그대로 (생일 / 축하해)', wb && wb.words.join('|') === '생일|축하해', wb);
    // 예약한 사람이 없어도(소식이 안 와도) 3초 뒤에는 저마다 터뜨린다
    await until(async () => !(await T(B, () => window.__sky.show)), 25000);
    await setNow(B, 2026, 12, 26, 9, 30, 0);
    await T(B, () => window.__sky.peer(`fire:15:${Math.floor(window.__now()) + 4000}:안녕`));
    check('예약 소식만 받고 터뜨리는 소식이 안 와도 때가 되면 터짐', (await T(B, () => !!window.__sky.plan)) && await until(async () => !!(await T(B, () => window.__sky.show)), 12000));
    check('이상한 소식은 받지 않음 (길이·시각·모양)', await T(B, () => ['fire:99:0:x', 'fire:15:1:x', `fire:15:${Math.floor(window.__now()) + 3 * 86400000}:x`, 'fire:15', 'fire:a:0:x'].every((v) => window.__sky.peer(v) === false)));
    await B.close();

    /* 0시 넘어 들어온 사람도 남은 불꽃놀이를 봄 */
    const L = await open(ctx, `${BASE}?net=bc&door=0&ns=sl`, [2026, 12, 25, 0, 0, 20]);
    check('0:00:20 에 들어와도 불꽃놀이 (남은 20초)', await until(async () => { const s = await T(L, () => window.__sky.show); return s && s.mid && s.left < 21; }, 3000), await T(L, () => window.__sky.show));
    await L.close();

    /* PC 화면 */
    const pc = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const P = await open(pc, `${BASE}?net=bc&door=0&ns=sp`, [2026, 12, 20, 12, 0]);
    const bg = {};
    for (const [name, h, mi, d] of [['day', 12, 0, 20], ['dusk', 17, 35, 20], ['night', 22, 0, 20], ['snow-night', 21, 0, 24]]) {
      await setNow(P, 2026, 12, d, h, mi); await sleep(900); await shot(P, 'pc-' + name + '-iso');
      bg[name] = await meanColor(P, [0.01, 0.07, 0.07, 0.2]); // 왼쪽 위 구석: 집 밖의 배경
    }
    check('낮 배경은 밝고 푸른 하늘', bg.day.b > bg.day.r + 15 && bg.day.l > 120, bg.day);
    check('해질녘 배경은 낮보다 붉고 어두움', bg.dusk.r - bg.dusk.b > bg.day.r - bg.day.b && bg.dusk.l < bg.day.l, bg.dusk);
    check('밤 배경은 짙은 남색', bg.night.l < 60 && bg.night.b > bg.night.r, bg.night);
    await place(P, 2.6, 8.8); await pov(P, true); await look(P, 0.25, -1); await sleep(900); await shot(P, 'pc-snow-night-fp-yard');
    await setNow(P, 2026, 12, 25, 0, 0, 2); await sleep(2500); await shot(P, 'pc-fire-fp-yard');
    await look(P, 0.1, 1); await sleep(1500); await shot(P, 'pc-fire-fp-yard-south');
    await pov(P, false); await sleep(1500); await shot(P, 'pc-fire-iso');
    check('PC 에서도 오류 없이 그려짐', (await T(P, () => window.__tree.frames)) > 30);
    await pc.close();

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
