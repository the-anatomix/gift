// 둘이 찍기: 초대 링크(#r=방id)로 두 사람이 같은 네 컷을 찍는다.
// 사진은 두 브라우저 사이의 데이터 채널로만 오간다. 서버에는 올라가지 않는다.
// 오가는 것 (모두 작은 JSON):
//   hello            연결되면 서로 한 번
//   cam  {ok}        내 카메라가 준비됐는지
//   cut  {i,g,last}  주인 → 손님. i번 컷 카운트다운을 지금 시작 (g 는 찍을 때마다 올라가는 번호)
//   req  {i}         손님 → 주인. i번 컷을 다시 찍자는 부탁
//   img  {i,g,k,n,d} 내 반쪽 사진(JPEG, base64)을 n 조각으로 나눈 것 중 k번째
//   opt  {frame,caption,date,dateText}  프레임·한마디·날짜
//   ping / bye       살아 있는지 확인 / 내가 나감
// 화면 쪽(app.js)은 h = { state(mode, role), cut(i,g,last), req(i), half(i,g,img), opt(o), cam(ok) } 로 받는다.
import { openRoom } from './net.js';

const q = new URLSearchParams(location.search);
const NET = q.get('net') === 'bc' ? 'bc' : 'peer';
const bm = /^(localhost|127\.0\.0\.1):(\d{2,5})$/.exec(q.get('broker') || ''); // 검사용 로컬 브로커만 허용
const OPT = bm ? { broker: { host: bm[1], port: +bm[2] } } : {};
const T = { connect: +q.get('ct') || 15000, silent: +q.get('st') || 20000, ping: 2000 };
const CHUNK = 12000, MAX_PARTS = 80; // 데이터 채널 한 번에 16KB 를 넘기지 않게 나눈다
const idx = (v) => Number.isInteger(v) && v >= 0 && v < 4;

export function createDuo(h) {
  let net = null, mode = 'off', role = null, gen = 0, last = 0, pingT = 0, connT = 0;
  let parts = {};
  // mode: off | connecting | waiting(주인이 친구를 기다림) | on | lost(친구가 나감) | full | fail
  const set = (m) => { mode = m; h.state(m, role); };
  const send = (m) => { if (net && mode === 'on') net.send(m); };

  function end(m) {
    clearInterval(pingT); clearTimeout(connT);
    const n = net; net = null; gen++; parts = {};
    if (n) n.close();
    set(m);
  }
  function onImg(m) {
    if (!idx(m.i) || !Number.isInteger(m.g) || !Number.isInteger(m.n) || !Number.isInteger(m.k)) return;
    if (m.n < 1 || m.n > MAX_PARTS || m.k < 0 || m.k >= m.n || typeof m.d !== 'string' || m.d.length > CHUNK) return;
    let p = parts[m.i];
    if (!p || p.g !== m.g || p.n !== m.n) p = parts[m.i] = { g: m.g, n: m.n, got: [], c: 0 };
    if (p.got[m.k] === undefined) p.c++;
    p.got[m.k] = m.d;
    if (p.c < p.n) return;
    delete parts[m.i];
    const b64 = p.got.join('');
    if (!/^[A-Za-z0-9+/]+=*$/.test(b64)) return; // 사진 말고 다른 것이 끼어들지 못하게
    const img = new Image();
    img.onload = () => h.half(m.i, m.g, img);
    img.src = 'data:image/jpeg;base64,' + b64;
  }
  function onMsg(m) {
    last = Date.now();
    if (m.t === 'img') onImg(m);
    else if (m.t === 'cut') { if (role === 'guest' && idx(m.i) && Number.isInteger(m.g)) h.cut(m.i, m.g, !!m.last); }
    else if (m.t === 'req') { if (role === 'host' && idx(m.i)) h.req(m.i); }
    else if (m.t === 'opt') h.opt({ frame: String(m.frame || ''), caption: String(m.caption || '').slice(0, 16), date: !!m.date,
      dateText: /^\d{4}\.\d{2}\.\d{2}$/.test(m.dateText) ? m.dateText : '' });
    else if (m.t === 'cam') h.cam(!!m.ok);
    else if (m.t === 'bye') end('lost');
  }

  return {
    get mode() { return mode; },
    get role() { return role; },
    send,
    async open(room) {
      if (net) end('off');
      const my = ++gen; role = null; set('connecting');
      connT = setTimeout(() => { if (my === gen && mode === 'connecting') end('fail'); }, T.connect);
      const n = await openRoom(NET, room, {
        role(r) { if (my !== gen) return; role = r; if (r === 'host') { clearTimeout(connT); set('waiting'); } else set('connecting'); },
        open() {
          if (my !== gen) return;
          clearTimeout(connT); last = Date.now(); set('on'); send({ t: 'hello', v: 1 });
          clearInterval(pingT);
          pingT = setInterval(() => { if (Date.now() - last > T.silent) end('lost'); else send({ t: 'ping' }); }, T.ping);
        },
        msg(m) { if (my === gen && mode === 'on') onMsg(m); },
        close() { if (my === gen) end(mode === 'on' ? 'lost' : 'fail'); },
        full() { if (my === gen) end('full'); },
      }, OPT);
      if (my !== gen) n.close(); else net = n;
    },
    // 내 반쪽 사진(data URL)을 조각내어 보낸다
    sendHalf(i, g, url) {
      const b = url.slice(url.indexOf(',') + 1), n = Math.ceil(b.length / CHUNK);
      if (n > MAX_PARTS) return;
      for (let k = 0; k < n; k++) send({ t: 'img', i, g, k, n, d: b.slice(k * CHUNK, (k + 1) * CHUNK) });
    },
    leave() { send({ t: 'bye' }); end('off'); },
  };
}
