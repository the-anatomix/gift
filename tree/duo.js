// 같이 꾸미기: 방 만들기, 들어가기, 끊김과 다시 연결, 주고받는 말의 규칙.
// 방의 내용(가구·장식)은 모른다. 필요한 것은 K(app.js 가 넘겨주는 창구)에 묻는다.
//
// 사람은 여럿(주인 포함 CAP 명까지)이고, 그중 ECAP 명까지만 방을 꾸밀 수 있다. 나머지는 구경(돌아다니기만).
// 손님은 주인하고만 이어져 있고, 주인이 모두의 말을 서로에게 전해 준다. 주인이 기준이다.
//   손님 → 주인  { t: 'hello', state, look, pos, mine, want, key }   들어오면서 내 방과 바라는 역할(want: 'edit' | 'view')을 알린다
//   주인 → 손님  { t: 'state', state, you: { id, edit, slot }, peers }   정해진 방과 내 역할, 지금 있는 사람들 (다시 맞출 때도 이것)
//   주인 → 손님  { t: 'join', id, look, pos } { t: 'gone', id }         다른 사람이 들어오고 나감
//   서로         { t: 'op', op }                                        방의 변화 하나. 구경하는 사람이 보낸 것은 주인이 받지 않는다
//   손님 → 주인  { t: 'sync' }                                          방이 달라진 것 같으니 통째로 다시 달라
//   서로         { t: 'look', look } { t: 'pos', x, z } { t: 'fx', k, v } { t: 'say', text }   주인이 전해 줄 때는 누구 것인지 id 를 붙인다
//   서로         { t: 'ping', h }                                       h = 방의 지문
// 꾸밀 수 있는 사람인지는 방 열쇠(key)로 가린다. "같이 꾸미기" 링크에만 열쇠가 들어 있다.
// 어느 쪽 방을 쓸지는 state.js 의 guestWins 가 정한다(처음 온 사람은 주인 방을 받고, 헤어져 혼자 꾸민 쪽이 있으면 그쪽).
// 둘이 같은 순간에 같은 자리를 바꾸면 주인 쪽 결과로 맞춘다. 지문이 거듭 다르면 손님이 통째로 다시 받는다.
import { openRoom } from './net.js';

const Q = new URLSearchParams(location.search);
const NET = Q.get('net') === 'bc' ? 'bc' : 'peer';
const num = (k, d) => { const v = parseInt(Q.get(k), 10); return v > 0 ? v : d; };
// connect: 이만큼 기다려도 안 이어지면 포기, silent: 이만큼 소식이 없으면 끊긴 것으로 본다
const T = { connect: num('ct', 12000), silent: num('st', 9000), ping: 2000, retry: num('rt', 3000) };
export const CAP = num('cap', 8);    // 방에 들어올 수 있는 사람 수 (주인 포함)
export const ECAP = num('ecap', 4);  // 그중 꾸밀 수 있는 사람 수 (주인 포함)
const OPT = { cap: CAP };
{ // 검사용: ?broker=localhost:포트 (localhost 만 허용)
  const m = /^localhost:(\d{2,5})$/.exec(Q.get('broker') || '');
  if (m) OPT.broker = { host: 'localhost', port: +m[1] };
}
export const ROOM_RE = /^[a-z0-9]{6,20}$/;
const rnd = (n) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, (x) => 'abcdefghijkmnpqrstuvwxyz23456789'[x % 32]).join(''); };

export function makeDuo(K) {
  // mode: solo(혼자) | connecting(잇는 중) | waiting(주인으로 기다림) | on(같이 노는 중) | lost(끊김) | full(방이 참) | away(구경 왔는데 주인이 없음)
  let mode = 'solo', room = null, role = null, link = null, key = '', want = 'edit';
  let canEdit = true, myId = 'h', count = 1; // 내가 꾸밀 수 있는지, 내 이름, 방에 있는 사람 수
  let gen = 0, tries = 0, last = 0, connectT = 0, retryT = 0, retries = 0, misses = 0;
  const peers = new Map(); // 주인만: pid → { edit, hello, last, slot }
  const set = (m) => { mode = m; K.status(); };
  const isObj = (m) => !!m && typeof m === 'object';
  const editors = () => { let n = 1; for (const p of peers.values()) if (p.edit) n++; return n; };
  const freeSlot = () => { const used = new Set([...peers.values()].map((p) => p.slot)); let s = 1; while (used.has(s)) s++; return s; };
  const stateMsg = (pid) => { const p = peers.get(pid); return { t: 'state', ...K.snapshot(), you: { id: pid, edit: p.edit, slot: p.slot }, peers: K.roster(pid) }; };
  const others = (pid) => [...peers.keys()].filter((x) => x !== pid && peers.get(x).hello);
  const relay = (m, from) => { for (const pid of others(from)) link.send(m, pid); };

  async function start(id, opt = {}, again = false) {
    const my = ++gen;
    tries = again ? tries + 1 : 1;
    clearTimeout(connectT); clearTimeout(retryT);
    if (link) link.close();
    link = null; room = id; role = null; peers.clear();
    if (opt.key !== undefined) key = opt.key;
    if (opt.want) want = opt.want;
    set('connecting');
    // 정해진 시간 안에 이어지지 않으면 끊긴 것으로 본다 (주인으로 기다리는 중이면 그대로 둔다)
    connectT = setTimeout(() => { if (my === gen && mode === 'connecting') lost(); }, T.connect);
    const h = await openRoom(NET, id, {
      role(r) {
        if (my !== gen) return;
        role = r;
        if (r !== 'host') return;
        clearTimeout(connectT);
        if (want === 'view') { // 구경 온 사람은 방을 대신 맡지 않는다. 주인이 올 때까지 가끔 다시 와 본다.
          gen++; role = null;
          setTimeout(() => { try { h.close(); } catch (_) { /* 무시 */ } if (link === h) link = null; }, 0);
          set('away');
          retryT = setTimeout(() => { if (mode === 'away' && room === id) start(id); }, T.retry * 3);
          return;
        }
        myId = 'h'; canEdit = true; count = 1;
        K.setRole(true, 0);
        set('waiting');
      },
      open() { // 손님: 주인과 이어짐
        if (my !== gen) return;
        clearTimeout(connectT); last = performance.now(); tries = 0; retries = 0; misses = 0;
        set('on');
        h.send({ t: 'hello', ...K.snapshot(), want, key });
      },
      join(pid) { if (my === gen) peers.set(pid, { edit: false, hello: false, last: performance.now(), slot: freeSlot() }); },
      leave(pid) { if (my === gen) left(pid); },
      msg(m, pid) { if (my !== gen) return; if (role === 'host') fromGuest(m, pid); else fromHost(m); },
      close() { if (my === gen && mode !== 'full' && mode !== 'solo' && mode !== 'away') lost(); },
      full() { if (my !== gen) return; clearTimeout(connectT); gen++; try { h.close(); } catch (_) { /* 무시 */ } if (link === h) link = null; set('full'); },
    }, OPT);
    if (my !== gen) { if (mode !== 'full' && mode !== 'away') h.close(); return; }
    link = h;
  }

  // 주인: 손님 한 명이 나감
  function left(pid) {
    const p = peers.get(pid);
    if (!p) return;
    peers.delete(pid);
    if (!p.hello) return;
    K.peerGone(pid);
    relay({ t: 'gone', id: pid });
    count = peers.size + 1;
    K.toast(p.edit ? '친구가 나갔어요. 방은 그대로예요' : '구경하던 친구가 나갔어요');
    set(peers.size ? 'on' : 'waiting');
  }

  function lost() {
    clearTimeout(connectT);
    // 처음 들어가다 실패하면 한 번은 바로 다시 해 본다
    if (mode === 'connecting' && tries === 1 && room) { start(room, {}, true); return; }
    const was = mode;
    if (role === 'host') { // 주인은 방을 지키며 다시 기다린다
      for (const pid of [...peers.keys()]) { if (link) link.drop(pid); left(pid); }
      set('waiting');
      return;
    }
    K.peersGone();
    count = 1;
    if (link) { link.close(); link = null; }
    gen++;
    if (was === 'on') K.toast('연결이 끊겼어요. 다시 이어 보는 중…');
    set('lost');
    // 손님은 몇 번 스스로 다시 들어가 본다 (주인이 나갔으면 꾸미는 사람 중 먼저 들어온 쪽이 주인이 된다)
    if (room && retries < 3) { const id = room; retryT = setTimeout(() => { if (mode === 'lost' && room === id) { retries++; start(id); } }, T.retry); }
  }

  // 주인이 손님의 말을 받음
  function fromGuest(m, pid) {
    const p = peers.get(pid);
    if (!p || !isObj(m) || typeof m.t !== 'string') return;
    p.last = performance.now();
    if (m.t === 'hello') {
      if (p.hello) return; // 인사는 들어올 때 한 번만 받는다 (역할이 중간에 바뀌지 않게)
      p.edit = m.want === 'edit' && (m.key || '') === key && editors() < ECAP; // 열쇠가 맞고 자리가 남아 있을 때만 꾸밀 수 있다
      const first = true;
      p.hello = true;
      const adopted = p.edit && isObj(m.state) && K.preferPeer(m.state, m.mine === true);
      if (adopted) K.adopt(m.state);
      const info = K.peerJoin(pid, m);
      link.send(stateMsg(pid), pid);
      if (adopted) for (const o of others(pid)) link.send(stateMsg(o), o);
      if (first) relay({ t: 'join', id: pid, look: info.look, pos: info.pos }, pid);
      K.synced();
      count = peers.size + 1;
      if (first) K.toast(p.edit ? '친구가 들어왔어요!' : '친구가 구경하러 왔어요!');
      set('on');
      return;
    }
    if (!p.hello) return;
    switch (m.t) {
      case 'op':
        if (!isObj(m.op)) return;
        if (!p.edit || !K.peerOp(m.op)) link.send(stateMsg(pid), pid); // 구경하는 사람이 보냈거나 내 방에 들어맞지 않는 변화: 주인 방으로 되돌린다
        else relay({ t: 'op', op: m.op }, pid);
        break;
      case 'sync': link.send(stateMsg(pid), pid); break;
      case 'look': { const lk = K.peerLook(pid, m.look); if (lk) relay({ t: 'look', id: pid, look: lk }, pid); break; }
      case 'pos': if (K.peerPos(pid, m.x, m.z)) relay({ t: 'pos', id: pid, x: m.x, z: m.z }, pid); break;
      case 'fx': if (K.peerFx(m)) relay({ t: 'fx', id: pid, k: m.k, v: m.v }, pid); break;
      case 'say': { // 채팅: 너무 잦으면 버린다
        const now = performance.now();
        if (now - (p.said || 0) < 300) return;
        const text = K.peerSay(pid, m.text);
        if (text) { p.said = now; relay({ t: 'say', id: pid, text }, pid); }
        break;
      }
      case 'ping': if (typeof m.h === 'string' && m.h === K.hash() && p.edit) K.synced(); break;
    }
  }

  // 손님이 주인의 말을 받음
  function fromHost(m) {
    if (!isObj(m) || typeof m.t !== 'string') return;
    last = performance.now();
    switch (m.t) {
      case 'state': {
        if (!isObj(m.state)) return;
        const first = count === 1;
        if (isObj(m.you)) { myId = String(m.you.id); canEdit = m.you.edit === true; K.setRole(canEdit, m.you.slot | 0); }
        K.adopt(m.state);
        if (Array.isArray(m.peers)) { K.setRoster(m.peers); count = K.peerCount() + 1; }
        if (first) K.toast(canEdit ? '친구 방에 들어왔어요!' : '친구 방을 구경하는 중이에요');
        misses = 0;
        K.status();
        break;
      }
      case 'join': if (typeof m.id === 'string' && m.id !== myId) { K.peerJoin(m.id, m); count = K.peerCount() + 1; K.status(); } break;
      case 'gone': if (typeof m.id === 'string') { K.peerGone(m.id); count = K.peerCount() + 1; K.status(); } break;
      case 'op':
        if (!isObj(m.op)) return;
        if (!K.peerOp(m.op)) link.send({ t: 'sync' });
        break;
      case 'look': K.peerLook(typeof m.id === 'string' ? m.id : 'h', m.look); break;
      case 'pos': K.peerPos(typeof m.id === 'string' ? m.id : 'h', m.x, m.z); break;
      case 'fx': K.peerFx(m); break;
      case 'say': K.peerSay(typeof m.id === 'string' ? m.id : 'h', m.text); break;
      case 'ping':
        if (typeof m.h !== 'string') return;
        if (m.h === K.hash()) { misses = 0; if (canEdit) K.synced(); }
        else if (++misses >= 3) { misses = 0; link.send({ t: 'sync' }); }
        break;
    }
  }

  setInterval(() => {
    if (mode !== 'on' || !link) return;
    link.send({ t: 'ping', h: K.hash() });
    if (document.hidden) return;
    const now = performance.now();
    if (role === 'host') { for (const [pid, p] of [...peers]) if (now - p.last > T.silent) { link.drop(pid); left(pid); } }
    else if (now - last > T.silent) lost();
  }, T.ping);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    last = performance.now();
    for (const p of peers.values()) p.last = last;
    if ((mode === 'lost' || mode === 'away') && room) { retries = 0; start(room); } // 돌아왔을 때 다시 들어가 본다
  });

  const out = (m) => { if (!link || mode !== 'on') return; if (role === 'host') link.send({ ...m, id: 'h' }); else link.send(m); };
  return {
    get mode() { return mode; }, get room() { return room; }, get role() { return role; }, get net() { return NET; },
    get canEdit() { return canEdit; }, get count() { return count; }, get key() { return key; }, get me() { return myId; },
    get editors() { return role === 'host' ? editors() : 0; },
    start,
    // 새 방을 만들고 주인으로 기다린다
    create() { const id = rnd(10); start(id, { key: rnd(6), want: 'edit' }); return id; },
    retry() { if (room) { retries = 0; start(room); } },
    // 방에서 나간다 (연결만 끊는다. 저장을 어떻게 할지는 app.js 가 정한다)
    leave() {
      gen++; clearTimeout(connectT); clearTimeout(retryT);
      if (link) link.close();
      link = null; room = null; role = null; peers.clear(); count = 1; canEdit = true; myId = 'h';
      K.peersGone();
      set('solo');
    },
    op(op) { if (link && mode === 'on') link.send({ t: 'op', op }); },
    look(look) { out({ t: 'look', look }); },
    pos(x, z) { out({ t: 'pos', x, z }); },
    fx(m) { out({ t: 'fx', k: m.k, v: m.v }); },
    say(text) { out({ t: 'say', text }); },
    // 초대 링크. edit = 같이 꾸미기(열쇠가 들어 있다), 아니면 구경
    inviteUrl(edit = true) {
      if (!room) return '';
      const base = location.origin + location.pathname;
      return edit ? base + '#r=' + room + (key ? '-' + key : '') : base + '#v=' + room;
    },
    feed(m, pid) { if (role === 'host') fromGuest(m, pid || [...peers.keys()][0]); else fromHost(m); }, // 자동 검사에서 상대가 보낸 말을 흉내 낸다
  };
}
