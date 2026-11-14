// 둘이 찍기 전송 계층. 서버 없이 브라우저끼리 직접 잇는다. (kitchen/net.js 와 같은 모양, 폴더끼리 서로 불러 쓰지 않으려고 따로 둔다)
// 같은 모양의 두 가지 구현:
//   peer : PeerJS(WebRTC 데이터 채널). 상대를 찾는 데만 PeerJS 공개 브로커를 쓴다.
//   bc   : BroadcastChannel. 같은 기기·같은 브라우저 안에서만 통한다(자동 검사용, 주소에 ?net=bc).
// cb = { role(r), open(), msg(m), close(why), full() }
// 돌려주는 값 = { send(m), drop(), close() }
//
// 방 주인 정하기: 방 id 를 먼저 차지한 쪽이 주인(host), 이미 차지돼 있으면 손님(guest)으로 들어간다.
// 정원은 2명. 주인은 세 번째 연결에 {t:'full'} 만 보내고 끊는다.

const PREFIX = 'gbs-fourcut-';

function loadScript(src) {
  return new Promise((ok, no) => {
    if (window.Peer) return ok();
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = () => no(new Error('load'));
    document.head.appendChild(s);
  });
}

async function peerRoom(room, cb, opt) {
  let peer = null, conn = null, role = null, closed = false;
  const hostId = PREFIX + room;
  const o = opt.broker ? { host: opt.broker.host, port: opt.broker.port, path: '/', secure: false } : {};
  const fail = (why) => { if (!closed) cb.close(why); };

  function wire(c) {
    conn = c;
    c.on('open', () => { if (conn === c && !closed) cb.open(); });
    c.on('data', (d) => {
      if (conn !== c || closed || !d || typeof d !== 'object') return;
      if (d.t === 'full') { cb.full(); return; }
      cb.msg(d);
    });
    const gone = (why) => () => { if (conn === c) { conn = null; fail(why); } };
    c.on('close', gone('closed'));
    c.on('error', gone('error'));
  }
  function asHost() {
    peer = new window.Peer(hostId, o);
    peer.on('open', () => { role = 'host'; cb.role('host'); });
    peer.on('connection', (c) => {
      if (conn) { // 이미 두 명
        c.on('open', () => { try { c.send({ t: 'full' }); } catch (_) { /* 무시 */ } setTimeout(() => c.close(), 600); });
        return;
      }
      wire(c);
    });
    peer.on('disconnected', () => { if (!closed && !peer.destroyed) { try { peer.reconnect(); } catch (_) { /* 무시 */ } } });
    peer.on('error', (e) => {
      if (e.type === 'unavailable-id' && !role) { try { peer.destroy(); } catch (_) { /* 무시 */ } asGuest(); return; }
      if (!conn) fail(e.type || 'error');
    });
  }
  function asGuest() {
    peer = new window.Peer(o);
    peer.on('open', () => {
      role = 'guest'; cb.role('guest');
      wire(peer.connect(hostId, { reliable: true, serialization: 'json' }));
    });
    peer.on('error', (e) => { if (!conn || !conn.open) { conn = null; fail(e.type || 'error'); } });
  }

  const handle = {
    send(m) { if (conn && conn.open) { try { conn.send(m); } catch (_) { /* 무시 */ } } },
    drop() { const c = conn; conn = null; if (c) { try { c.close(); } catch (_) { /* 무시 */ } } },
    close() { closed = true; conn = null; if (peer) { try { peer.destroy(); } catch (_) { /* 무시 */ } } },
  };
  try { await loadScript('./vendor/peerjs.min.js'); } catch (e) { fail('load'); return handle; }
  if (!closed) asHost();
  return handle;
}

function bcRoom(room, cb) {
  const ch = new BroadcastChannel(PREFIX + room);
  const id = Math.random().toString(36).slice(2, 10);
  let role = null, other = null, closed = false;
  const post = (m) => { if (!closed) ch.postMessage(Object.assign({ from: id }, m)); };
  ch.onmessage = (ev) => {
    const m = ev.data;
    if (closed || !m || (m.to && m.to !== id)) return;
    if (m.x === 'probe') { if (role === 'host') post({ x: 'host', to: m.from }); }
    else if (m.x === 'host') { if (!role) { role = 'guest'; cb.role('guest'); post({ x: 'join', to: m.from }); } }
    else if (m.x === 'join') {
      if (role !== 'host') return;
      if (other && other !== m.from) post({ x: 'full', to: m.from });
      else { other = m.from; post({ x: 'accept', to: m.from }); cb.open(); }
    }
    else if (m.x === 'accept') { other = m.from; cb.open(); }
    else if (m.x === 'full') cb.full();
    else if (m.x === 'bye') { if (m.from === other) { other = null; cb.close('closed'); } }
    else if (m.x === 'data') { if (m.from === other) cb.msg(m.d); }
  };
  post({ x: 'probe' });
  setTimeout(() => { if (!role && !closed) { role = 'host'; cb.role('host'); } }, 300);
  const bye = () => { if (other) post({ x: 'bye', to: other }); };
  addEventListener('pagehide', bye);
  return {
    send(d) { if (other) post({ x: 'data', to: other, d }); },
    drop() { other = null; },
    close() { bye(); closed = true; removeEventListener('pagehide', bye); ch.close(); },
  };
}

export async function openRoom(kind, room, cb, opt = {}) {
  return kind === 'bc' ? bcRoom(room, cb) : peerRoom(room, cb, opt);
}
