// 자랑 카드(만든 과정 포함) 검사. 실행: cd kitchen/tests && node brag.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8147, BASE = `http://localhost:${PORT}/kitchen/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(80); } }
async function open(ctx, url) { const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('   (페이지 오류)', e.message)); await p.goto(url); await until(() => p.evaluate(() => !!(window.__kitchen && window.__duo && window.__gift && window.__brag))); return p; }
const st = (p, s, d) => p.evaluate(({ s, d }) => window.__kitchen.dispatch({ t: 'st', s, d }), { s, d });
const tab = async (p, n) => { await p.click(`#tabs button:text-is("${n}")`); await sleep(1100); };
const save = async (p, name) => fs.writeFileSync(path.join(__dirname, 'out', name), Buffer.from((await p.evaluate(() => window.__brag.canvas.toDataURL('image/png'))).split(',')[1], 'base64'));

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((rq, r) => { let p = decodeURIComponent(rq.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    const A = await open(ctx, BASE);
    // 각 자리에서 만들기 (그 자리에 있을 때 판정이 뜨고, 잠시 뒤 과정 사진이 찍힌다)
    await tab(A, '반죽'); await st(A, 'dough', { p: 1, perf: 1 }); await sleep(900);
    await tab(A, '자르기'); for (let i = 0; i < 5; i++) { await st(A, 'cut', { cut: i, ok: i === 2 ? 0 : 1 }); await sleep(120); } await sleep(900);
    await tab(A, '굽기'); await st(A, 'oven', { start: 1 }); await st(A, 'oven', { out: 0.675 }); await sleep(900);
    await tab(A, '초콜릿');
    await A.mouse.move(187, 280); await A.mouse.down(); await A.mouse.move(187, 430, { steps: 8 }); await A.mouse.up(); await sleep(1200);
    const snd = await A.evaluate(() => Object.assign({}, window.__sfx.played));
    check('효과음: 자르기·오븐·띵·퐁당 소리가 났음', snd.cut === 5 && snd.oven === 1 && snd.ding === 1 && snd.dip >= 1 && snd.plop === 1, snd);
    check('PERFECT / GOOD 판정에는 소리가 없음', !snd.perfect && !snd.good, snd);
    const have = await A.evaluate(() => Object.keys(window.__kitchen.shots).sort());
    check('네 자리의 과정 사진이 저절로 찍힘', JSON.stringify(have) === JSON.stringify(['choco', 'cut', 'dough', 'oven']), have);
    const filled = await A.evaluate(() => { const c = window.__kitchen.shots.cut, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4000) if (Math.abs(d[i] - 251) > 6 || Math.abs(d[i + 1] - 239) > 6) n++; return { w: c.width, h: c.height, n }; });
    check('과정 사진에 실제 화면이 담김 (360×360)', filled.w === 360 && filled.h === 360 && filled.n > 20, filled);
    await A.evaluate(() => { const K = window.__kitchen; K.dispatch({ t: 'text', v: '메리' }); for (let i = 0; i < 10; i++) K.dispatch({ t: 'grain', k: i % 4, s: 0.06 + i * 0.04, u: (i % 3 - 1) * 0.02, sp: i, sc: 1, c: 0, st: K.me + '1', id: K.me + '1.' + i }); });
    // 토핑·반죽은 손가락으로 문질러야 소리가 난다
    await tab(A, '토핑');
    const sc = await A.evaluate(() => window.__kitchen.stickScreen());
    await A.mouse.move(sc.tip.x, sc.tip.y + 30); await A.mouse.down(); await A.mouse.move(sc.tip.x, sc.tip.y + 160, { steps: 10 }); await A.mouse.up();
    check('효과음: 토핑을 뿌리면 톡톡 소리', (await A.evaluate(() => window.__sfx.played.tick || 0)) >= 1);
    const sb = await A.locator('#snd').boundingBox();
    check('소리 끄기 버튼이 화면 안·44px 이상', sb && sb.width >= 44 && sb.height >= 44 && sb.x >= 0 && sb.x + sb.width <= 375, sb);
    await A.tap('#snd');
    const before = await A.evaluate(() => window.__sfx.played.tick);
    await A.mouse.move(sc.tip.x, sc.tip.y + 60); await A.mouse.down(); await A.mouse.move(sc.tip.x, sc.tip.y + 200, { steps: 10 }); await A.mouse.up();
    check('소리를 끄면 효과음이 나지 않음', (await A.evaluate(() => window.__sfx.muted && window.__bgm.muted)) && (await A.evaluate(() => window.__sfx.played.tick)) === before);
    await A.tap('#snd');
    check('다시 누르면 소리가 켜짐', await A.evaluate(() => !window.__sfx.muted && !window.__bgm.muted));
    await tab(A, '포장'); await A.tap('#packDone'); await until(() => A.isVisible('#letter'), 15000);
    await A.fill('#ltTo', '사랑하는 지우에게'); await A.fill('#ltFrom', '너를 아끼는 민서가'); await A.fill('#ltMsg', '내가 직접 만들었어. 맛있게 먹어!');
    const url = await A.evaluate(() => window.__gift.giftUrl());
    check('효과음: 포장 완료 소리', (await A.evaluate(() => window.__sfx.played.pack || 0)) === 1);
    const lb = await A.locator('#ltBrag').boundingBox();
    check('편지 쓰기 칸 안에도 "자랑 카드" 버튼이 있음 (화면 안·44px 이상)', lb && lb.height >= 44 && lb.x >= 0 && lb.x + lb.width <= 375 && lb.y + lb.height <= 812, lb);
    await A.tap('#ltBrag');
    check('편지 칸의 자랑 카드 버튼을 누르면 카드가 열림', await until(() => A.evaluate(() => !document.getElementById('brag').hidden && document.getElementById('letter').hidden), 6000));
    await A.tap('#bgClose'); await sleep(300);
    const bb = await A.locator('#packBrag').boundingBox();
    check('포장 뒤 "만든 과정 자랑 카드" 버튼이 화면 안·44px 이상', bb && bb.height >= 44 && bb.x >= 0 && bb.x + bb.width <= 375 && bb.y + bb.height <= 812, bb);
    await A.tap('#packBrag');
    check('만든 사람의 자랑 카드가 만들어짐', await until(() => A.evaluate(() => { const i = document.getElementById('bgImg'); return !document.getElementById('brag').hidden && i.naturalWidth === 1080 && window.__brag.hasScene(); }), 8000));
    const px = await A.evaluate(() => { const d = window.__brag.canvas.getContext('2d'); const n = (x, y) => Array.from(d.getImageData(x, y, 1, 1).data); return { frame: n(72, 1030), thumb: n(160, 800) }; });
    check('카드에 과정 사진 틀(흰 테두리)이 그려짐', px.frame[0] > 245 && px.frame[1] > 245, px);
    check('찍은 뒤에도 주방 화면이 그대로 (무대로 바뀐 채 남지 않음)', await A.evaluate(() => window.__kitchen.stage === false && !window.__kitchen.presenting && document.getElementById('c').width > 0));
    await sleep(500);
    await save(A, 'brag-mine.png');
    await A.screenshot({ path: path.join(__dirname, 'out', 'brag-mine-sheet.png') });
    await A.setInputFiles('#bgFile', path.join(__dirname, 'face.png'));
    await until(() => A.evaluate(() => window.__brag.hasPhoto()), 5000); await sleep(400);
    await save(A, 'brag-mine-photo.png');
    await A.tap('#bgClose');

    // 받는 사람 카드에 만든 과정 결과가 담긴다
    const ctx2 = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    const R = await open(ctx2, url);
    const p = await R.evaluate((u) => window.__gift.readGift(u.split('#g=')[1]).p, url);
    check('선물 링크에 자리별 결과가 담김 (반죽 PERFECT, 자르기 GOOD, 굽기 PERFECT)', p && p[0] === 2 && p[1] === 1 && p[2] === 2 && p[3] >= 1, p);
    await R.tap('#rcOpen'); await until(() => R.isVisible('#rcBrag'), 9000); await sleep(1500);
    await R.tap('#rcBrag');
    await until(() => R.evaluate(() => window.__brag.hasScene() && document.getElementById('bgImg').naturalWidth === 1080), 8000); await sleep(500);
    const chip = await R.evaluate(() => Array.from(window.__brag.canvas.getContext('2d').getImageData(80, 869, 1, 1).data));
    check('받는 사람 카드에 "만든 과정" 줄이 그려짐', chip[0] > 240 && chip[1] > 235, chip);
    await save(R, 'brag-recv-process.png');
    await ctx2.close(); await ctx.close();
  } catch (e) { check('검사 도중 오류 없음', false, String(e && e.message).slice(0, 300)); }
  await browser.close(); server.close();
  const fail = results.filter((x) => !x).length;
  console.log(`\n합계: ${results.length}개 중 통과 ${results.length - fail}, 실패 ${fail}`);
  process.exitCode = fail ? 1 : 0;
})();
