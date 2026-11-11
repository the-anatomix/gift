// 같이 꾸미기 전송 계층. 서버 없이 브라우저끼리 직접 잇는다. (주방의 net.js 를 여러 명용으로 넓힌 것)
// 같은 모양의 두 가지 구현:
//   peer : PeerJS(WebRTC 데이터 채널). 상대를 찾는 데만 PeerJS 공개 브로커를 쓴다.
//   bc   : BroadcastChannel. 같은 기기·같은 브라우저 안에서만 통한다(자동 검사용, 주소에 ?net=bc).
//
// 방 주인 정하기: 방 id 를 먼저 차지한 쪽이 주인(host), 이미 차지돼 있으면 손님(guest)으로 들어간다.
// 손님은 주인하고만 이어지고, 주인이 모두를 이어 준다. 정원(opt.cap, 주인 포함)이 차면 {t:'full'} 만 보내고 끊는다.
//
// cb = { role(r), close(why), full(),
//        open(), msg(m)                    손님: 주인과 이어짐 / 주인이 보낸 말
//        join(pid), leave(pid), msg(m, pid)  주인: 손님이 들어옴·나감 / 그 손님이 보낸 말 }
// 돌려주는 값 = { send(m, to), drop(to), close(), peer(), pj(), remote(pid) }   주인은 to(pid)가 없으면 모두에게

const PREFIX = 'nolja-tree-';

function loadScript(src) {
  return new Promise((ok, no) => {
    if (window.Peer) return ok();
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = () => no(new Error('load'));
    document.head.appendChild(s);
  });
}

async function peerRoom(room, cb, opt) {
  let peer = null, role = null, closed = false, seq = 0;
  let conn = null;               // 손님: 주인과의 연결
  const conns = new Map();       // 주인: pid → 연결
  const hostId = PREFIX + room, cap = opt.cap || 8;
  const o = opt.broker ? { host: opt.broker.host, port: opt.broker.port, path: '/', secure: false } : {};
  const fail = (why) => { if (!closed) cb.close(why); };
  const put = (c, m) => { if (c && c.open) { try { c.send(m); } catch (_) { /* 무시 */ } } };

  function asHost() {
    peer = new window.Peer(hostId, o);
    peer.on('open', () => { role = 'host'; cb.role('host'); });
    peer.on('connection', (c) => {
      if (conns.size >= cap - 1) { // 정원이 참
        c.on('open', () => { put(c, { t: 'full' }); setTimeout(() => c.close(), 600); });
        return;
      }
      const pid = 'g' + (++seq).toString(36);
      conns.set(pid, c);
      c.on('open', () => { if (conns.get(pid) === c && !closed) cb.join(pid); });
      c.on('data', (d) => { if (conns.get(pid) === c && !closed && d && typeof d === 'object') cb.msg(d, pid); });
      const gone = () => { if (conns.get(pid) === c) { conns.delete(pid); if (!closed) cb.leave(pid); } };
      c.on('close', gone); c.on('error', gone);
    });
    peer.on('disconnected', () => { if (!closed && !peer.destroyed) { try { peer.reconnect(); } catch (_) { /* 무시 */ } } });
    peer.on('error', (e) => {
      if (e.type === 'unavailable-id' && !role) { try { peer.destroy(); } catch (_) { /* 무시 */ } asGuest(); return; }
      if (!conns.size) fail(e.type || 'error');
    });
  }
  function asGuest() {
    peer = new window.Peer(o);
    peer.on('open', () => {
      role = 'guest'; cb.role('guest');
      const c = peer.connect(hostId, { reliable: true, serialization: 'json' });
      conn = c;
      c.on('open', () => { if (conn === c && !closed) cb.open(); });
      c.on('data', (d) => {
        if (conn !== c || closed || !d || typeof d !== 'object') return;
        if (d.t === 'full') { cb.full(); return; }
        cb.msg(d);
      });
      const gone = (why) => () => { if (conn === c) { conn = null; fail(why); } };
      c.on('close', gone('closed')); c.on('error', gone('error'));
    });
    peer.on('error', (e) => { if (!conn || !conn.open) { conn = null; fail(e.type || 'error'); } });
  }

  const handle = {
    send(m, to) {
      if (role !== 'host') put(conn, m);
      else if (to) put(conns.get(to), m);
      else for (const c of conns.values()) put(c, m);
    },
    drop(to) {
      if (role !== 'host') { const c = conn; conn = null; if (c) { try { c.close(); } catch (_) { /* 무시 */ } } return; }
      for (const pid of to ? [to] : [...conns.keys()]) { const c = conns.get(pid); conns.delete(pid); if (c) { try { c.close(); } catch (_) { /* 무시 */ } } }
    },
    close() { closed = true; conn = null; conns.clear(); if (peer) { try { peer.destroy(); } catch (_) { /* 무시 */ } } },
    // 소리와 영상을 직접 주고받을 때 쓴다(media.js): 내 PeerJS, 내 PeerJS 이름, 손님 pid 의 PeerJS 이름
    peer: () => (closed ? null : peer), pj: () => (peer && peer.id) || '', remote: (pid) => { const c = conns.get(pid); return c ? c.peer : ''; },
  };
  try { await loadScript('./vendor/peerjs.min.js'); } catch (e) { fail('load'); return handle; }
  if (!closed) asHost();
  return handle;
}

function bcRoom(room, cb, opt) {
  const ch = new BroadcastChannel(PREFIX + room);
  const id = Math.random().toString(36).slice(2, 10), cap = opt.cap || 8;
  let role = null, host = null, closed = false, seq = 0;
  const pids = new Map();        // 주인: 상대의 채널 이름 → pid
  const post = (m) => { if (!closed) ch.postMessage(Object.assign({ from: id }, m)); };
  ch.onmessage = (ev) => {
    const m = ev.data;
    if (closed || !m || (m.to && m.to !== id)) return;
    if (m.x === 'probe') { if (role === 'host') post({ x: 'host', to: m.from }); }
    else if (m.x === 'host') { if (!role) { role = 'guest'; cb.role('guest'); post({ x: 'join', to: m.from }); } }
    else if (m.x === 'join') {
      if (role !== 'host') return;
      if (!pids.has(m.from) && pids.size >= cap - 1) { post({ x: 'full', to: m.from }); return; }
      if (!pids.has(m.from)) pids.set(m.from, 'g' + (++seq).toString(36));
      post({ x: 'accept', to: m.from });
      cb.join(pids.get(m.from));
    }
    else if (m.x === 'accept') { host = m.from; cb.open(); }
    else if (m.x === 'full') cb.full();
    else if (m.x === 'bye') {
      if (role === 'host') { const pid = pids.get(m.from); if (pid) { pids.delete(m.from); cb.leave(pid); } }
      else if (m.from === host) { host = null; cb.close('closed'); }
    }
    else if (m.x === 'data') {
      if (role === 'host') { const pid = pids.get(m.from); if (pid) cb.msg(m.d, pid); }
      else if (m.from === host) cb.msg(m.d);
    }
  };
  post({ x: 'probe' });
  setTimeout(() => { if (!role && !closed) { role = 'host'; cb.role('host'); } }, 300);
  const bye = () => { if (role === 'host') { for (const to of pids.keys()) post({ x: 'bye', to }); } else if (host) post({ x: 'bye', to: host }); };
  addEventListener('pagehide', bye);
  return {
    send(d, to) {
      if (role !== 'host') { if (host) post({ x: 'data', to: host, d }); return; }
      for (const [chan, pid] of pids) if (!to || pid === to) post({ x: 'data', to: chan, d });
    },
    drop(to) {
      if (role !== 'host') { host = null; return; }
      for (const [chan, pid] of [...pids]) if (!to || pid === to) pids.delete(chan);
    },
    close() { bye(); closed = true; removeEventListener('pagehide', bye); ch.close(); },
    peer: () => null, pj: () => '', remote: () => '', // 이 연결로는 소리와 영상을 보낼 수 없다
  };
}

export async function openRoom(kind, room, cb, opt = {}) {
  return kind === 'bc' ? bcRoom(room, cb, opt) : peerRoom(room, cb, opt);
}
