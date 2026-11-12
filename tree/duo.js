// 같이 꾸미기: 방 만들기, 들어가기, 끊김과 다시 연결, 주고받는 말의 규칙.
// 방의 내용(가구·장식)은 모른다. 필요한 것은 K(app.js 가 넘겨주는 창구)에 묻는다.
//
// 사람은 여럿(주인 포함 CAP 명까지)이고, 그중 ECAP 명까지만 방을 꾸밀 수 있다. 나머지는 구경(돌아다니기만).
// 손님은 주인하고만 이어져 있고, 주인이 모두의 말을 서로에게 전해 준다. 주인이 기준이다.
//   손님 → 주인  { t: 'knock', dev, look, want }                    초인종: 들어가도 되는지 묻는다 (dev = 기기마다 만든 이름)
//   주인 → 손님  { t: 'admit' } / { t: 'deny', why }                 들어오세요 / 안 돼요 (why: 'no' 돌려보냄, 'ban' 내보낸 사람, 'kick' 지금 내보냄)
//   손님 → 주인  { t: 'hello', state, look, pos, mine, want, key }   (허락받은 뒤) 들어오면서 내 방과 바라는 역할(want: 'edit' | 'view')을 알린다
//   주인 → 손님  { t: 'state', state, you: { id, edit, slot }, peers }   정해진 방과 내 역할, 지금 있는 사람들 (다시 맞출 때도 이것)
//   주인 → 손님  { t: 'join', id, look, pos, pj } { t: 'gone', id }     다른 사람이 들어오고 나감 (pj = 그 사람의 PeerJS 이름: 소리·영상을 직접 걸 때 쓴다)
//   서로         { t: 'op', op }                                        방의 변화 하나. 구경하는 사람이 보낸 것은 주인이 받지 않는다
//                                                                       (VIEW_OPS 는 받는다: 촛불 불기, 케이크 먹기, 방명록 남기기, 이 방 최고 기록)
//   손님 → 주인  { t: 'sync' }                                          방이 달라진 것 같으니 통째로 다시 달라
//   서로         { t: 'look', look } { t: 'pos', x, z } { t: 'fx', k, v } { t: 'say', text }   주인이 전해 줄 때는 누구 것인지 id 를 붙인다
//   서로         { t: 'ping', h }                                       h = 방의 지문
// 공동 관리자 (admin.js): 방장이 지정한 기기는 초인종 없이 들어오고, 문 앞 사람을 들이거나 돌려보내고 방 안 사람을 내보낼 수 있다
//   손님 → 주인  knock 에 tk(그 기기의 이 방 전용 비밀표)와 auto(초인종을 누르지 않고 스스로 보낸 것)가 붙는다. 주인은 tk 의 지문이 방의 공동 관리자 표에 있으면 바로 들인다
//   주인 → 손님  { t: 'noadm' }                                         스스로 보낸 knock 인데 공동 관리자가 아니다: 초인종을 눌러야 한다
//   주인 → 손님  { t: 'adms', ids, door, key }                          지금 방 안의 공동 관리자들(ids). 공동 관리자에게는 문 앞 사람들(door)과 방 열쇠(key)도 준다
//   손님 → 주인  { t: 'boss', a: 'admit' | 'deny' | 'kick', id }        공동 관리자가 한 일. 주인은 보낸 사람이 공동 관리자일 때만 따른다
//   공동 관리자 지정·해제({ t: 'op', op: { t: 'adm' } })는 손님이 보내면 받지 않는다(방장만 한다)
// 꾸밀 수 있는 사람인지는 방 열쇠(key)로 가린다. "같이 꾸미기" 링크에만 열쇠가 들어 있다.
// 어느 쪽 방을 쓸지는 state.js 의 guestWins 가 정한다(처음 온 사람은 주인 방을 받고, 헤어져 혼자 꾸민 쪽이 있으면 그쪽).
// 둘이 같은 순간에 같은 자리를 바꾸면 주인 쪽 결과로 맞춘다. 지문이 거듭 다르면 손님이 통째로 다시 받는다.
import { openRoom } from './net.js';
import { NOTE } from './catalog.js';
import { GIFT } from './catalog.js';

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
export const DOOR = Q.get('door') !== '0'; // 초인종을 누르고 허락받아야 들어오는지 (검사용 ?door=0 은 바로 들어온다)
export const ROOM_RE = /^[a-z0-9]{6,20}$/;
const VIEW_OPS = new Set(['cakeBlow', 'cakeEat', 'note', 'best']); // 구경하는 사람도 할 수 있는 변화
VIEW_OPS.add('star'); // 꼭대기 별 달기도 구경하는 사람이 할 수 있다 (coop.js)
VIEW_OPS.add('gift'); VIEW_OPS.add('giftOpen'); // 트리 밑 선물 두기·열기 (gift.js)
VIEW_OPS.add('snowman'); // 마당에서 같이 만든 눈사람 놓기 (state.js 가 마당 칸·개수를 따로 막는다)
const rnd = (n) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, (x) => 'abcdefghijkmnpqrstuvwxyz23456789'[x % 32]).join(''); };

export function makeDuo(K) {
  // mode: solo(혼자) | connecting(잇는 중) | waiting(주인으로 기다림) | door(문 앞: 초인종을 누르고 기다림) | on(같이 노는 중)
  //       | lost(끊김) | full(방이 참) | away(구경 왔는데 주인이 없음) | denied(들어갈 수 없음)
  let mode = 'solo', room = null, role = null, link = null, key = '', want = 'edit';
  let canEdit = true, myId = 'h', count = 1; // 내가 꾸밀 수 있는지, 내 이름, 방에 있는 사람 수
  let why = '', rang = false;                // 들어갈 수 없는 까닭, 초인종을 눌렀는지
  let admIds = new Set(), doorList = []; // 손님: 주인이 알려 준 공동 관리자들과 (내가 공동 관리자일 때) 문 앞 사람들
  const adm = (p) => !!p && !!p.tag && !!K.isAdm && K.isAdm(p.tag); // 주인: 그 손님이 공동 관리자인지 (tk 를 받아 확인한 표로만 가린다)
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
    link = null; room = id; role = null; peers.clear(); admIds = new Set(); doorList = [];
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
        rang = false;
        set('door'); // 문 앞에 섰다. 초인종을 눌러 허락을 받아야 들어간다
        if (!DOOR) knock();
        else if (K.hasPass && K.hasPass()) knock(true); // 공동 관리자는 초인종 없이 바로 들어간다
      },
      join(pid) { if (my === gen) peers.set(pid, { edit: false, hello: false, last: performance.now(), slot: freeSlot() }); },
      leave(pid) { if (my === gen) left(pid); },
      msg(m, pid) { if (my !== gen) return; if (role === 'host') { fromGuest(m, pid); tell(); } else fromHost(m); },
      close() { if (my === gen && mode !== 'full' && mode !== 'solo' && mode !== 'away' && mode !== 'denied') lost(); },
      full() { if (my !== gen) return; clearTimeout(connectT); gen++; try { h.close(); } catch (_) { /* 무시 */ } if (link === h) link = null; set('full'); },
    }, OPT);
    if (my !== gen) { if (mode !== 'full' && mode !== 'away' && mode !== 'denied') h.close(); return; }
    link = h;
  }

  // 손님: 초인종을 누른다
  function knock(auto = false) {
    if (mode !== 'door' || !link) return;
    rang = true;
    link.send({ t: 'knock', dev: K.dev(), look: K.snapshot().look, want, ...(K.card ? { tk: K.card() } : {}), ...(auto ? { auto: true } : {}) });
    K.status();
  }
  // 손님: 들어갈 수 없다는 답을 받았다
  function denied(w) {
    why = w === 'ban' || w === 'kick' ? w : 'no';
    gen++; clearTimeout(connectT); clearTimeout(retryT);
    const l = link; link = null;
    if (l) setTimeout(() => { try { l.close(); } catch (_) { /* 무시 */ } }, 0);
    K.peersGone(); count = 1; role = null;
    set('denied');
  }
  // 주인: 문 앞의 손님을 들인다 / 돌려보낸다 / 방 안의 사람을 내보낸다
  function admit(pid) {
    const p = peers.get(pid);
    if (!p || p.ok) return;
    p.ok = true; p.asked = false;
    link.send({ t: 'admit' }, pid);
    tell(); K.status();
  }
  function turnAway(pid, w = 'no') {
    const p = peers.get(pid);
    if (!p) return;
    link.send({ t: 'deny', why: w }, pid);
    setTimeout(() => { if (link && role === 'host' && peers.get(pid) === p) { link.drop(pid); left(pid); } }, 400); // 답이 건너간 뒤에 끊는다
    p.asked = false; p.out = true;
    tell(); K.status();
  }
  // 주인: 공동 관리자가 바뀌었거나 문 앞 사람이 바뀌었으면 알린다. 공동 관리자는 열쇠 없이도 꾸밀 수 있다(해제되면 열쇠로 들어온 사람만 그대로)
  function tell() {
    if (role !== 'host' || !link) return;
    const ids = [...peers].filter(([, p]) => p.hello && adm(p)).map(([id]) => id);
    const door = [...peers].filter(([, p]) => p.asked && !p.ok).map(([id, p]) => ({ id, want: p.want }));
    for (const [pid, p] of peers) {
      if (!p.hello) continue;
      const a = adm(p), e = a || (!!p.byKey && p.edit);
      if (e !== p.edit) { p.edit = e; link.send(stateMsg(pid), pid); K.status(); }
      const msg = JSON.stringify(a ? { ids, door, key } : { ids });
      if (msg === p.told || (p.told === undefined && msg === '{"ids":[]}')) continue;
      p.told = msg;
      link.send({ t: 'adms', ...JSON.parse(msg) }, pid);
    }
  }
  // 주인: 방 안의 사람을 내보내고, 같은 기기로는 다시 못 들어오게 한다 (공동 관리자였으면 해제한다)
  function kick(pid) {
    const p = peers.get(pid);
    if (!p || role !== 'host') return;
    if (p.dev) K.ban(p.dev);
    if (adm(p) && K.admSet) K.admSet(p.tag, false);
    turnAway(pid, 'kick');
  }

  // 주인: 손님 한 명이 나감
  function left(pid) {
    const p = peers.get(pid);
    if (!p) return;
    peers.delete(pid);
    if (!p.hello) { tell(); K.status(); return; }
    K.peerGone(pid);
    relay({ t: 'gone', id: pid });
    count = peers.size + 1;
    K.toast(p.edit ? '친구가 나갔어요. 방은 그대로예요' : '구경하던 친구가 나갔어요');
    tell();
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
    if (m.t === 'knock') { // 초인종
      if (p.ok || p.out) return;
      p.dev = typeof m.dev === 'string' && /^[a-z0-9]{6,24}$/.test(m.dev) ? m.dev : '';
      p.want = m.want === 'view' ? 'view' : 'edit';
      if (p.dev && K.banned(p.dev)) { turnAway(pid, 'ban'); return; }
      p.tag = K.tagOf ? K.tagOf(m.tk) : ''; // 받은 비밀표의 지문 (손님이 말한 표는 믿지 않고 직접 만든다)
      if (adm(p)) { admit(pid); K.toast('공동 관리자가 들어와요 🔑'); return; } // 공동 관리자: 초인종도 방장의 허락도 없이 바로
      if (m.auto === true) { link.send({ t: 'noadm' }, pid); return; }           // 공동 관리자가 아닌데 스스로 온 것: 초인종을 누르게 한다
      const again = p.asked;
      p.asked = true;
      K.bell(again); // 딩동
      relay({ t: 'fx', id: pid, k: 'bell', v: 1 });
      if (!DOOR) admit(pid); // 문 없이 여는 검사용. 평소에는 전에 들인 친구라도 올 때마다 방장이 문을 열어 줘야 들어온다
      else K.status();
      return;
    }
    if (m.t === 'hello') {
      if (p.hello || !p.ok) return; // 허락받은 사람만, 들어올 때 한 번만 받는다 (역할이 중간에 바뀌지 않게)
      p.byKey = m.want === 'edit' && (m.key || '') === key;
      p.edit = adm(p) || (p.byKey && editors() < ECAP); // 열쇠가 맞고 자리가 남아 있을 때만 꾸밀 수 있다 (공동 관리자는 언제나)
      const first = true;
      p.hello = true;
      const adopted = p.edit && isObj(m.state) && K.preferPeer(m.state, m.mine === true);
      if (adopted) K.adopt(m.state);
      const info = K.peerJoin(pid, { look: m.look, pos: m.pos, pj: link.remote(pid) });
      link.send(stateMsg(pid), pid);
      if (adopted) for (const o of others(pid)) link.send(stateMsg(o), o);
      if (first) relay({ t: 'join', id: pid, look: info.look, pos: info.pos, pj: info.pj }, pid);
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
        if (m.op.t === 'adm') { link.send(stateMsg(pid), pid); return; } // 공동 관리자 지정·해제는 방장만 한다
        if (m.op.t === 'note' && performance.now() - (p.noted || -1e9) < NOTE.gap - 500) { link.send(stateMsg(pid), pid); return; } // 방명록은 한 사람이 NOTE.gap 에 한 번 (오는 길에 늦어지는 것을 조금 봐준다)
        if (m.op.t === 'gift') { if (performance.now() - (p.gifted || -1e9) < GIFT.gap - 500) { link.send(stateMsg(pid), pid); return; } p.gifted = performance.now(); } // 선물도 한 사람이 GIFT.gap 에 한 번
        if ((!p.edit && !VIEW_OPS.has(m.op.t)) || (m.op.by !== undefined && m.op.by !== pid) || !K.peerOp(m.op)) link.send(stateMsg(pid), pid); // by 가 붙은 변화(케이크 들기)는 자기 이름으로만 할 수 있다 // 구경하는 사람이 보냈거나(촛불 불기와 케이크 먹기는 된다) 내 방에 들어맞지 않는 변화: 주인 방으로 되돌린다
        else { if (m.op.t === 'note') p.noted = performance.now(); relay({ t: 'op', op: m.op }, pid); }
        break;
      case 'sync': link.send(stateMsg(pid), pid); break;
      case 'look': { const lk = K.peerLook(pid, m.look); if (lk) relay({ t: 'look', id: pid, look: lk }, pid); break; }
      case 'pos': if (K.peerPos(pid, m.x, m.z)) relay({ t: 'pos', id: pid, x: m.x, z: m.z }, pid); break;
      case 'fx': if (K.peerFx(m, pid)) relay({ t: 'fx', id: pid, k: m.k, v: m.v }, pid); break;
      case 'say': { // 채팅: 너무 잦으면 버린다
        const now = performance.now();
        if (now - (p.said || 0) < 300) return;
        const text = K.peerSay(pid, m.text);
        if (text) { p.said = now; relay({ t: 'say', id: pid, text }, pid); }
        break;
      }
      case 'ping': if (typeof m.h === 'string' && m.h === K.hash() && p.edit) K.synced(); break;
      case 'boss': { // 공동 관리자가 한 일: 들이기·돌려보내기·내보내기 (방장과 다른 공동 관리자는 내보내지 못한다)
        const q = typeof m.id === 'string' ? peers.get(m.id) : null;
        if (!adm(p) || !q || q === p) return;
        if (m.a === 'admit') admit(m.id);
        else if (m.a === 'deny') { if (q.asked && !q.ok) turnAway(m.id, 'no'); }
        else if (m.a === 'kick') { if (q.hello && !adm(q)) kick(m.id); }
        break;
      }
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
      case 'fx': K.peerFx(m, typeof m.id === 'string' ? m.id : 'h'); break;
      case 'say': K.peerSay(typeof m.id === 'string' ? m.id : 'h', m.text); break;
      case 'admit': if (mode === 'door') K.admitted(); break; // 문이 열린다. 다 들어가면 app.js 가 enter() 를 부른다
      case 'deny': denied(m.why); break;
      case 'noadm': if (mode === 'door') { rang = false; if (K.passLost) K.passLost(); K.status(); } break; // 공동 관리자가 아니게 됐다: 초인종을 눌러야 한다
      case 'adms': {
        if (!Array.isArray(m.ids)) return;
        admIds = new Set(m.ids.filter((x) => typeof x === 'string').slice(0, 16));
        doorList = (Array.isArray(m.door) ? m.door : []).filter(isObj).slice(0, 8).map((k) => ({ id: String(k.id), want: k.want === 'view' ? 'view' : 'edit' }));
        // 공동 관리자가 받은 방 열쇠: 다음부터는 꾸미는 사람으로 들어오고, 방장이 없으면 방을 대신 맡을 수 있다
        if (typeof m.key === 'string' && /^[a-z0-9]{4,12}$/.test(m.key) && m.key !== key && K.gotKey) { key = m.key; want = 'edit'; K.gotKey(key); }
        K.status();
        break;
      }
      case 'ping':
        if (typeof m.h !== 'string' || mode !== 'on') return;
        if (m.h === K.hash()) { misses = 0; if (canEdit) K.synced(); }
        else if (++misses >= 3) { misses = 0; link.send({ t: 'sync' }); }
        break;
    }
  }

  setInterval(() => {
    // 문 앞에서 기다리는 사람과 그 사람을 기다리게 한 주인도 서로 살아 있다고 알린다 (안 그러면 기다리다 끊긴 줄 안다)
    if (!link || !(mode === 'on' || mode === 'door' || (role === 'host' && peers.size))) return;
    link.send(mode === 'door' ? { t: 'ping' } : { t: 'ping', h: K.hash() });
    tell();
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
    get why() { return why; }, get rang() { return rang; },
    // 소리와 영상을 직접 주고받는 데 쓰는 내 PeerJS (방 안에 들어와 있을 때만)
    peer() { return link && mode === 'on' ? link.peer() : null; },
    pj() { return link ? link.pj() : ''; },
    // 주인: 문 앞에서 기다리는 사람들 / 방 안에 있는 사람들
    // (공동 관리자인 손님에게는 주인이 알려 준 문 앞 사람들이 나온다)
    get knocks() { return role === 'host' ? [...peers].filter(([, p]) => p.asked && !p.ok).map(([id, p]) => ({ id, want: p.want })) : mode === 'on' ? doorList : []; },
    get people() { return role === 'host' ? [...peers].filter(([, p]) => p.hello).map(([id, p]) => ({ id, edit: p.edit })) : []; },
    // 지금 방 안에 있는 공동 관리자들(id). 주인: 그 사람들의 표(admTags), 표를 받아 둔 사람들(tagged: 지정할 수 있는 사람)
    get admins() { return role === 'host' ? [...peers].filter(([, p]) => p.hello && adm(p)).map(([id]) => id) : mode === 'on' ? [...admIds] : []; },
    get admTags() { return role === 'host' ? [...peers.values()].filter((p) => p.hello && adm(p)).map((p) => p.tag) : []; },
    get tagged() { return role === 'host' ? [...peers].filter(([, p]) => p.hello && p.tag).map(([id]) => id) : []; },
    // 주인(방장): 방 안의 사람을 공동 관리자로 지정하거나 해제한다. 예전 화면을 쓰는 사람(표가 없다)은 지정할 수 없다
    grant(pid, on) { const p = peers.get(pid); if (role !== 'host' || !p || !p.hello || !p.tag || !K.admSet) return false; K.admSet(p.tag, !!on); tell(); K.status(); return true; },
    told() { tell(); }, // 주인: 공동 관리자 표가 바뀌었으니 다시 알린다
    knock: () => knock(),
    // 문 앞의 손님을 들인다 / 돌려보낸다 / 방 안의 사람을 내보낸다. 공동 관리자인 손님은 주인에게 부탁한다
    admit(pid) { if (role === 'host') admit(pid); else if (link && mode === 'on') link.send({ t: 'boss', a: 'admit', id: pid }); },
    deny(pid) { if (role === 'host') turnAway(pid, 'no'); else if (link && mode === 'on') link.send({ t: 'boss', a: 'deny', id: pid }); },
    kick(pid) { if (role === 'host') kick(pid); else if (link && mode === 'on') link.send({ t: 'boss', a: 'kick', id: pid }); },
    // 손님: 허락받고 문을 지나 들어간다
    enter() { if (mode !== 'door' || !link) return; set('on'); link.send({ t: 'hello', ...K.snapshot(), want, key }); },
    start,
    // 새 방을 만들고 주인으로 기다린다
    create() { const id = rnd(10); start(id, { key: rnd(6), want: 'edit' }); return id; },
    retry() { if (room) { retries = 0; start(room); } },
    // 방에서 나간다 (연결만 끊는다. 저장을 어떻게 할지는 app.js 가 정한다)
    leave() {
      gen++; clearTimeout(connectT); clearTimeout(retryT);
      if (link) link.close();
      link = null; room = null; role = null; peers.clear(); count = 1; canEdit = true; myId = 'h'; admIds = new Set(); doorList = [];
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
