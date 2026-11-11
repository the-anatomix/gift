// 둘이 같이 꾸미기: 방 만들기, 들어가기, 끊김과 다시 연결, 주고받는 말의 규칙.
// 방의 내용(가구·장식)은 모른다. 필요한 것은 K(app.js 가 넘겨주는 창구)에 묻는다.
//
// 방 주인(host)이 기준이다.
//   손님 → 주인  { t: 'hello', state, look, pos, mine }   들어오면서 내가 가진 방을 알린다
//   주인 → 손님  { t: 'state', state, look, pos }         어느 쪽 방을 쓸지 정해서 통째로 돌려준다 (다시 맞출 때도 이것)
//   서로         { t: 'op', op }                    방의 변화 하나 (가구 놓기, 장식 달기 …)
//   손님 → 주인  { t: 'sync' }                      방이 서로 달라진 것 같으니 통째로 다시 달라
//   서로         { t: 'look', look } { t: 'pos', x, z } { t: 'fx', k, v } { t: 'ping', h }
// 어느 쪽 방을 쓸지는 state.js 의 guestWins 가 정한다(처음 온 사람은 상대 방을 받고, 헤어져 혼자 꾸민 쪽이 있으면 그쪽).
// 둘이 같은 순간에 같은 자리를 바꾸면 주인 쪽 결과로 맞춘다. ping 에 방의 지문(h)이 들어 있어서,
// 지문이 같으면 "지금 둘의 방이 같다"고 적어 두고(K.synced), 손님은 거듭 다르면 통째로 다시 받는다.
import { openRoom } from './net.js';

const Q = new URLSearchParams(location.search);
const NET = Q.get('net') === 'bc' ? 'bc' : 'peer';
const num = (k, d) => { const v = parseInt(Q.get(k), 10); return v > 0 ? v : d; };
// connect: 이만큼 기다려도 안 이어지면 포기, silent: 이만큼 소식이 없으면 끊긴 것으로 본다
const T = { connect: num('ct', 12000), silent: num('st', 9000), ping: 2000, retry: num('rt', 3000) };
const OPT = {};
{ // 검사용: ?broker=localhost:포트 (localhost 만 허용)
  const m = /^localhost:(\d{2,5})$/.exec(Q.get('broker') || '');
  if (m) OPT.broker = { host: 'localhost', port: +m[1] };
}
export const ROOM_RE = /^[a-z0-9]{6,20}$/;

export function makeDuo(K) {
  // mode: solo(혼자) | connecting(잇는 중) | waiting(주인으로 기다림) | on(같이 노는 중) | lost(끊김) | full(방이 참)
  let mode = 'solo', room = null, role = null, link = null;
  let gen = 0, tries = 0, last = 0, connectT = 0, retryT = 0, retries = 0, misses = 0;
  const set = (m) => { mode = m; K.status(); };
  const send = (m) => { if (link && mode === 'on') link.send(m); };
  const isObj = (m) => !!m && typeof m === 'object';

  async function start(id, again) {
    const my = ++gen;
    tries = again ? tries + 1 : 1;
    clearTimeout(connectT); clearTimeout(retryT);
    if (link) link.close();
    link = null; room = id; role = null;
    set('connecting');
    // 정해진 시간 안에 이어지지 않으면 끊긴 것으로 본다 (주인으로 기다리는 중이면 그대로 둔다)
    connectT = setTimeout(() => { if (my === gen && mode === 'connecting') lost(); }, T.connect);
    const h = await openRoom(NET, id, {
      role(r) { if (my !== gen) return; role = r; if (r === 'host') { clearTimeout(connectT); set('waiting'); } },
      open() {
        if (my !== gen) return;
        clearTimeout(connectT); last = performance.now(); tries = 0; retries = 0; misses = 0;
        set('on');
        if (role === 'guest') h.send({ t: 'hello', ...K.snapshot() });
      },
      msg(m) { if (my === gen) onMsg(m); },
      close() { if (my === gen && mode !== 'full' && mode !== 'solo') lost(); },
      full() { if (my !== gen) return; clearTimeout(connectT); gen++; try { h.close(); } catch (_) { /* 무시 */ } if (link === h) link = null; set('full'); },
    }, OPT);
    if (my !== gen) { if (mode !== 'full') h.close(); return; }
    link = h;
  }

  function lost() {
    clearTimeout(connectT);
    // 처음 들어가다 실패하면 한 번은 바로 다시 해 본다
    if (mode === 'connecting' && tries === 1 && room) { start(room, true); return; }
    const was = mode;
    K.peerGone();
    if (role === 'host') { // 주인은 방을 지키며 다시 기다린다
      if (link) link.drop();
      if (was === 'on') K.toast('친구가 나갔어요. 방은 그대로예요');
      set('waiting');
      return;
    }
    if (link) { link.close(); link = null; }
    gen++;
    if (was === 'on') K.toast('연결이 끊겼어요. 혼자 이어서 꾸며요');
    set('lost');
    // 손님은 몇 번 스스로 다시 들어가 본다 (주인이 나갔으면 이때 내가 주인이 된다)
    if (room && retries < 3) { const id = room; retryT = setTimeout(() => { if (mode === 'lost' && room === id) { retries++; start(id); } }, T.retry); }
  }

  function onMsg(m) {
    if (!isObj(m) || typeof m.t !== 'string') return;
    last = performance.now();
    switch (m.t) {
      case 'hello': { // 주인: 더 최근에 꾸민 쪽을 고르고, 정한 방을 통째로 돌려준다
        if (role !== 'host') return;
        if (isObj(m.state) && K.preferPeer(m.state, m.mine === true)) K.adopt(m.state);
        K.peerJoin(m);
        link.send({ t: 'state', ...K.snapshot() });
        K.synced();
        K.toast('친구가 들어왔어요!');
        break;
      }
      case 'state':
        if (role !== 'guest' || !isObj(m.state)) return;
        K.adopt(m.state);
        if (!K.hasPeer()) K.toast('친구 방에 들어왔어요!');
        K.peerJoin(m);
        misses = 0;
        break;
      case 'op':
        if (!isObj(m.op)) return;
        if (!K.peerOp(m.op)) { // 내 방에는 들어맞지 않는 변화: 주인 쪽으로 맞춘다
          if (role === 'host') link.send({ t: 'state', ...K.snapshot() }); else link.send({ t: 'sync' });
        }
        break;
      case 'sync': if (role === 'host') link.send({ t: 'state', ...K.snapshot() }); break;
      case 'look': K.peerLook(m.look); break;
      case 'fx': K.peerFx(m); break; // 친구가 논 소식 (다트 점수, 캐럴 …)
      case 'pos': K.peerPos(m.x, m.z); break;
      case 'ping':
        if (typeof m.h !== 'string') return;
        if (m.h === K.hash()) { misses = 0; K.synced(); }
        else if (role === 'guest' && ++misses >= 3) { misses = 0; link.send({ t: 'sync' }); }
        break;
    }
  }

  setInterval(() => {
    if (mode !== 'on') return;
    send({ t: 'ping', h: K.hash() });
    if (!document.hidden && performance.now() - last > T.silent) lost();
  }, T.ping);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    last = performance.now();
    if (mode === 'lost' && room) { retries = 0; start(room); } // 돌아왔을 때 다시 들어가 본다
  });

  return {
    get mode() { return mode; }, get room() { return room; }, get role() { return role; }, get net() { return NET; },
    start,
    // 새 방을 만들고 주인으로 기다린다
    create() {
      const a = new Uint8Array(10); crypto.getRandomValues(a);
      const id = Array.from(a, (x) => 'abcdefghijkmnpqrstuvwxyz23456789'[x % 32]).join('');
      start(id);
      return id;
    },
    retry() { if (room) { retries = 0; start(room); } },
    // 방에서 나간다 (연결만 끊는다. 저장을 어떻게 할지는 app.js 가 정한다)
    leave() {
      gen++; clearTimeout(connectT); clearTimeout(retryT);
      if (link) link.close();
      link = null; room = null; role = null;
      K.peerGone();
      set('solo');
    },
    op(op) { send({ t: 'op', op }); },
    look(look) { send({ t: 'look', look }); },
    fx(m) { send({ t: 'fx', k: m.k, v: m.v }); },
    pos(x, z) { send({ t: 'pos', x, z }); },
    inviteUrl() { return room ? location.origin + location.pathname + '#r=' + room : ''; },
    feed: onMsg, // 자동 검사에서 상대가 보낸 말을 흉내 낸다
  };
}
