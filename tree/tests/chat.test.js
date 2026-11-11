// 채팅 검사 (말풍선, 지난 말 목록, 여러 명에게 전달). 실행: cd tree/tests && node chat.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8166, BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 12000) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() - t > ms) return false; await sleep(60); } }
const errors = [];
const ready = (p) => until(() => p.evaluate(() => !!(window.__tree && window.__duo && window.__tree.frames > 3)), 20000);
async function open(ctx, url) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => { errors.push(e.message); console.log('   (페이지 오류)', e.message); });
  await p.goto(url); await ready(p);
  if (await p.isVisible('#lookDone')) await p.click('#lookDone');
  return p;
}
const T = (p, fn, arg) => p.evaluate(fn, arg);
const bubs = (p) => T(p, () => window.__duo.bubbles);
const log = (p) => T(p, () => window.__duo.chatLog);
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

(async () => {
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(PORT);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const vp = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true };
    const ctx = await browser.newContext(vp);
    const A = await open(ctx, `${BASE}?net=bc&ns=ca`);
    check('아래 탭이 여섯 개(채팅 포함)이고 모두 화면 안·44px 이상', (await A.locator('#tabs button').count()) === 6 && (await A.isVisible('#tabs button[data-m="chat"]')) && (await audit(A)).length === 0, await audit(A));
    await A.tap('#tabs button[data-m="chat"]'); await sleep(300);
    check('채팅 탭을 누르면 입력칸과 보내기 단추가 나옴', (await A.isVisible('#chatIn')) && (await A.isVisible('#chatSend')) && (await A.textContent('#chatLog')).includes('아직 아무 말도') && (await audit(A)).length === 0, await audit(A));
    await A.fill('#chatIn', '안녕 메리 크리스마스');
    await A.press('#chatIn', 'Enter'); await sleep(300);
    let b = await bubs(A);
    const head = await T(A, () => window.__tree.screenOf(window.__tree.me.x, window.__tree.me.z, 1.72));
    check('글을 쓰고 Enter 를 누르면 내 머리 위에 말풍선이 뜸', b.length === 1 && b[0].who === 'me' && b[0].text === '안녕 메리 크리스마스' && Math.abs(b[0].x - head.x) < 30 && Math.abs(b[0].y - head.y) < 30, { b, head });
    check('지난 말에 "나"로 적히고 입력칸은 비워짐', JSON.stringify(await log(A)) === JSON.stringify(['나 안녕 메리 크리스마스']) && (await A.inputValue('#chatIn')) === '');
    await A.screenshot({ path: path.join(__dirname, 'out', 'chat-phone.png') });
    await A.fill('#chatIn', '   '); await A.tap('#chatSend'); await sleep(200);
    check('빈 글은 보내지지 않음', (await log(A)).length === 1);
    await sleep(700);
    await A.fill('#chatIn', '<b>굵게</b> <img src=x onerror=alert(1)>'); await A.tap('#chatSend'); await sleep(200);
    check('태그는 글자 그대로 보이고 실행되지 않음', (await log(A))[1] === '나 <b>굵게</b> <img src=x onerror=alert(1)>' && (await A.locator('#chatLog img, #chatLog .ln b + b, #bubbles img').count()) === 0 && errors.length === 0);
    await sleep(700);
    const two = await T(A, () => [window.__duo.say('하나'), window.__duo.say('둘')]);
    check('너무 빨리 이어 보내면 막힘', two[0] === true && two[1] === false && (await log(A)).length === 3 && (await A.textContent('#toast')).includes('천천히'), two);
    check('글 다듬기: 60자까지, 줄바꿈·겹친 빈칸은 한 칸으로', await T(A, () => { const c = window.__duo.cleanSay; return c('가'.repeat(100)).length === 60 && c('  a \n\n b\t c  ') === 'a b c' && c(5) === '' && c(null) === '' && c('\u0000\u0007') === ''; }));
    check('말풍선은 몇 초 뒤 사라짐', await until(async () => (await bubs(A)).length === 0, 9000));

    /* 여러 명 */
    await T(A, () => window.__duo.invite());
    await until(async () => (await T(A, () => window.__duo.mode)) === 'waiting');
    const room = (await T(A, () => window.__duo.inviteUrl())).split('#r=')[1], id = room.split('-')[0];
    const B = await open(ctx, `${BASE}?net=bc&ns=cb#r=${room}`);
    const C = await open(ctx, `${BASE}?net=bc&ns=cc#v=${id}`);
    await until(async () => (await T(A, () => window.__duo.count)) === 3 && (await T(B, () => window.__duo.others)).length === 2 && (await T(C, () => window.__duo.others)).length === 2, 20000);
    check('구경하는 사람에게도 채팅 탭이 있음 (탭 세 개)', (await C.isVisible('#tabs button[data-m="chat"]')) && (await T(C, () => [...document.querySelectorAll('#tabs button')].filter((x) => !x.hidden).length)) === 3 && (await audit(C)).length === 0, await audit(C));
    await A.fill('#chatIn', '다들 어서 와'); await A.tap('#chatSend');
    check('방장이 한 말이 꾸미는 사람과 구경하는 사람 모두에게 말풍선으로 보임', await until(async () => { const x = await bubs(B), y = await bubs(C); return x.some((q) => q.who === 'h' && q.text === '다들 어서 와') && y.some((q) => q.who === 'h' && q.text === '다들 어서 와'); }, 5000), { b: await bubs(B), c: await bubs(C) });
    const hb = await T(B, () => { const W = window.__tree, o = window.__duo.others.find((x) => x.id === 'h'); return W.screenOf(o.x, o.z, 1.72); });
    const bb = (await bubs(B)).find((q) => q.who === 'h');
    check('말풍선은 말한 사람 아바타 머리 위에 있음', Math.abs(bb.x - hb.x) < 30 && Math.abs(bb.y - hb.y) < 30, { bb, hb });
    check('지난 말에 "방장"으로 적히고, 채팅 탭이 닫혀 있으면 안 읽은 표시가 뜸', (await log(B)).includes('방장 다들 어서 와') && (await B.evaluate(() => document.querySelector('#tabs button[data-m="chat"]').classList.contains('new'))));
    await B.tap('#tabs button[data-m="chat"]'); await sleep(200);
    check('채팅 탭을 열면 안 읽은 표시가 사라짐', !(await B.evaluate(() => document.querySelector('#tabs button[data-m="chat"]').classList.contains('new'))));
    await C.tap('#tabs button[data-m="chat"]'); await C.fill('#chatIn', '구경 왔어요!'); await C.press('#chatIn', 'Enter');
    const cid = await T(C, () => window.__duo.me), cname = '친구' + parseInt(cid.slice(1), 36);
    check('구경하는 사람이 한 말도 방장과 다른 손님에게 보임', await until(async () => (await bubs(A)).some((q) => q.who === cid && q.text === '구경 왔어요!') && (await bubs(B)).some((q) => q.who === cid), 5000) && (await log(A)).includes(`${cname} 구경 왔어요!`) && (await log(B)).includes(`${cname} 구경 왔어요!`), { a: await log(A), cname });
    await sleep(400);
    await B.screenshot({ path: path.join(__dirname, 'out', 'chat-three.png') });
    // 손님이 마구 보낼 때
    const nA = (await log(A)).length;
    await T(B, () => { for (let k = 0; k < 6; k++) window.__duo.rawSay('도배 ' + k); });
    await sleep(900);
    check('손님이 한꺼번에 여러 개를 보내면 방장이 걸러서 하나만 전해짐', (await log(A)).length === nA + 1 && (await log(C)).filter((l) => l.includes('도배')).length === 1, await log(A));
    const nB = (await log(B)).length;
    await T(B, () => { for (const m of [{ t: 'say' }, { t: 'say', text: 5 }, { t: 'say', text: '   ' }, { t: 'say', id: 'zzz', text: '없는 사람' }, { t: 'say', id: 'h', text: '가'.repeat(200) }]) window.__duo.feed(m); });
    await sleep(200);
    const lb = await log(B);
    check('이상한 채팅 말은 버리고, 긴 글은 60자로 잘라 받음', lb.length === nB + 1 && lb[lb.length - 1] === '방장 ' + '가'.repeat(60) && errors.length === 0, lb.slice(-2));
    // 1인칭
    await B.tap('#tabs button[data-m="chat"]'); await B.tap('#pov'); await sleep(300);
    await T(B, () => window.__duo.say('1인칭에서 한 말')); await sleep(300);
    check('1인칭에서는 내 말풍선은 안 보이고 지난 말에만 적힘', !(await bubs(B)).some((q) => q.who === 'me') && (await log(B)).includes('나 1인칭에서 한 말') && await until(async () => (await bubs(A)).some((q) => q.text === '1인칭에서 한 말'), 4000));
    await C.close();
    check('나간 사람의 말풍선은 사라짐', await until(async () => !(await bubs(A)).some((q) => q.who === cid), 12000));
    await ctx.close();
    check('페이지 오류 없음', errors.length === 0, errors);
  } finally {
    await browser.close(); server.close();
  }
  const bad = results.filter((r) => !r).length;
  console.log(`\n${results.length - bad} / ${results.length} 통과`);
  process.exit(bad ? 1 : 0);
})();
