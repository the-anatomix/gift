// 전송 계층(net.js) 주인 쪽 정원 검사: 가짜 PeerJS 로 "이어지는 중에 멈춘 연결 시도" 를 만들어,
// 그런 시도가 쌓여도 방이 찼다고 하지 않는지, 오래된 시도는 버리는지, 실제로 이어진 사람으로 정원이 차면 막는지 본다.
// (예전에는 손님이 느린 연결로 몇 번 다시 시도하면 아무도 없는데 "방이 찼어요" 가 떴다)
// 실행: cd tree/tests && node net.test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8237, BASE = `http://localhost:${PORT}/tree/`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const results = [];
const check = (name, ok, d) => { results.push(!!ok); console.log(`${ok ? '통과' : '실패'}  ${name}${!ok && d !== undefined ? '  → ' + JSON.stringify(d) : ''}`); };
const server = http.createServer((q, s) => { let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith(path.sep)) f += 'index.html'; fs.readFile(f, (e, b) => { if (e) { s.writeHead(404); s.end(); } else { s.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); s.end(b); } }); });

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch();
  const errors = [];
  try {
    const p = await browser.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(BASE + 'tests/blank.html'); // 없는 쪽(404)이라도 같은 주소에서 net.js 를 불러올 수 있으면 된다
    const r = await p.evaluate(async (base) => {
      const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
      class Em { constructor() { this.h = {}; } on(e, f) { (this.h[e] = this.h[e] || []).push(f); return this; } emit(e, ...a) { for (const f of this.h[e] || []) f(...a); } }
      class Conn extends Em {
        constructor(n) { super(); this.peer = 'pj-' + n; this.open = false; this.sent = []; this.shut = false; }
        send(m) { this.sent.push(m); }
        up() { this.open = true; this.emit('open'); }
        close() { if (this.shut) return; this.shut = true; this.open = false; this.emit('close'); }
      }
      class Peer extends Em { constructor(id) { super(); this.id = id; window.__host = this; setTimeout(() => this.emit('open'), 0); } destroy() { this.destroyed = true; } reconnect() {} }
      window.Peer = Peer;
      const { openRoom } = await import(base + 'net.js');
      const ev = { join: [], leave: [], full: 0 };
      const h = await openRoom('peer', 'nettest01', { role() {}, close() {}, full() { ev.full++; }, open() {}, msg() {}, join(pid) { ev.join.push(pid); }, leave(pid) { ev.leave.push(pid); } }, { cap: 3, pend: 400 });
      await wait(20);
      let n = 0;
      const come = () => { const c = new Conn(++n); window.__host.emit('connection', c); return c; };
      const out = {};
      // 1) 멈춘 시도 다섯 개가 쌓여도 진짜 손님은 들어온다
      const stuck = [come(), come(), come(), come(), come()];
      const a = come(); a.up();
      out.stuckThenJoin = ev.join.length === 1 && !a.sent.some((m) => m.t === 'full');
      // 2) PEND 가 지나면 멈춘 시도는 닫히고 버려진다
      await wait(600);
      out.stuckClosed = stuck.every((c) => c.shut) && !a.shut;
      out.noLeaveForStuck = ev.leave.length === 0;
      // 3) 실제로 이어진 사람으로 정원(주인 포함 3명)이 차면 다음 사람은 {t:'full'} 을 받는다
      const b = come(); b.up();
      const c3 = come(); c3.up();
      out.fullWhenLive = ev.join.length === 2 && c3.sent.some((m) => m.t === 'full') && !b.sent.some((m) => m.t === 'full');
      await wait(700);
      out.fullClosed = c3.shut;
      // 4) 한 명이 나가면 자리가 나서 다음 사람이 들어온다
      a.close();
      const d = come(); d.up();
      out.leaveThenJoin = ev.leave.length === 1 && ev.join.length === 3 && !d.sent.some((m) => m.t === 'full');
      // 5) 보내기는 이어진 사람에게만 간다
      h.send({ t: 'hi' });
      out.sendLive = b.sent.some((m) => m.t === 'hi') && d.sent.some((m) => m.t === 'hi') && !a.sent.some((m) => m.t === 'hi');
      // 6) 끊기(drop) 한 사람은 나감으로 치고 자리가 빈다
      h.drop(ev.join[1]);
      const e2 = come(); e2.up();
      out.dropFrees = b.shut && ev.join.length === 4 && !e2.sent.some((m) => m.t === 'full');
      h.close();
      return out;
    }, BASE);
    check('이어지는 중에 멈춘 시도가 쌓여도 진짜 손님은 들어옴 (방이 찼다고 하지 않음)', r.stuckThenJoin, r);
    check('오래된 시도는 닫고 버림 (나감 알림은 없음)', r.stuckClosed && r.noLeaveForStuck, r);
    check('실제로 이어진 사람으로 정원이 차면 다음 사람은 "방이 참" 을 받고 끊김', r.fullWhenLive && r.fullClosed, r);
    check('한 명이 나가면 다음 사람이 들어옴', r.leaveThenJoin, r);
    check('보내기는 이어진 사람에게만', r.sendLive, r);
    check('주인이 끊은 사람 자리는 빔', r.dropFrees, r);
    check('페이지 오류 없음', errors.length === 0, errors);
  } finally {
    await browser.close(); server.close();
  }
  const pass = results.filter(Boolean).length;
  console.log(`\n${pass}/${results.length} 통과`);
  process.exit(pass === results.length ? 0 : 1);
})();
