// 사람끼리 직접 주고받는 소리와 영상: 보이스(마이크)와 TV 같이 보기.
// 방의 변화는 주인을 거쳐 전해지지만, 소리와 영상은 양이 많아서 보내는 사람이 받는 사람 한 명 한 명에게 직접 건다(PeerJS 의 call).
// 그래서 PeerJS 로 이어졌을 때만 쓸 수 있다(검사용 BroadcastChannel 연결에서는 못 쓴다).
//
// K = { peer() 내 PeerJS, targets() [{ id, pj }] 방에 있는 다른 사람들, whoIs(pj) 그 PeerJS 이름이 방의 누구인지,
//       voice(id, on) 누구의 목소리가 들리기 시작함/끊김, tv(stream, id) 누가 TV 영상을 보내기 시작함/끊음, toast(글) }
export function makeMedia(K) {
  let mic = null, tv = null;                           // 내 마이크, 내가 보내는 TV 영상
  const out = { voice: new Map(), tv: new Map() };     // 내가 건 것: PeerJS 이름 → call
  const inn = new Map();                               // 받은 것: 'voice:이름' | 'tv:이름' → { call, kind, from, audio, stream }
  const muted = new Set();                             // 내 쪽에서 소리를 끈 사람
  let bound = null, wantPlay = false;

  function drop(key) {
    const r = inn.get(key);
    if (!r) return;
    inn.delete(key);
    try { r.call.close(); } catch (_) { /* 무시 */ }
    if (r.audio) { r.audio.pause(); r.audio.srcObject = null; }
    if (r.kind === 'voice') K.voice(r.from, false); else K.tv(null, r.from);
  }
  function onCall(call) {
    const md = call.metadata || {}, kind = md.kind === 'tv' ? 'tv' : md.kind === 'voice' ? 'voice' : null;
    const from = K.whoIs(call.peer); // 방에 있는 사람이 건 것만 받는다
    if (!kind || !from) { try { call.close(); } catch (_) { /* 무시 */ } return; }
    const key = kind + ':' + from;
    drop(key);
    const rec = { call, kind, from, audio: null, stream: null };
    inn.set(key, rec);
    call.answer();
    call.on('stream', (s) => {
      if (inn.get(key) !== rec || rec.stream === s) return;
      rec.stream = s;
      if (kind === 'voice') {
        rec.audio = new Audio();
        rec.audio.srcObject = s; rec.audio.autoplay = true; rec.audio.muted = muted.has(from);
        const p = rec.audio.play(); if (p && p.catch) p.catch(() => { wantPlay = true; });
        K.voice(from, true);
      } else K.tv(s, from);
    });
    const end = () => { if (inn.get(key) === rec) drop(key); };
    call.on('close', end); call.on('error', end);
  }
  function bind() {
    const p = K.peer();
    if (!p || p === bound) return;
    bound = p;
    p.on('call', onCall);
  }
  // 지금 방에 있는 사람들에게 맞춘다: 아직 안 건 사람에게 걸고, 나간 사람은 끊는다
  function callAll(kind, stream) {
    const p = K.peer(), want = new Set(K.targets().map((t) => t.pj).filter(Boolean));
    for (const [pj, c] of [...out[kind]]) if (!stream || !want.has(pj)) { out[kind].delete(pj); try { c.close(); } catch (_) { /* 무시 */ } }
    if (!p || !stream) return;
    for (const pj of want) {
      if (out[kind].has(pj)) continue;
      let c = null;
      try { c = p.call(pj, stream, { metadata: { kind } }); } catch (_) { c = null; }
      if (!c) continue;
      out[kind].set(pj, c);
      const end = () => { if (out[kind].get(pj) === c) out[kind].delete(pj); };
      c.on('close', end); c.on('error', end);
    }
  }
  // 화면을 처음 누를 때: 막혀 있던 소리를 튼다
  addEventListener('pointerdown', () => { if (!wantPlay) return; wantPlay = false; for (const r of inn.values()) if (r.audio) r.audio.play().catch(() => {}); }, true);

  return {
    get can() { return !!K.peer(); },
    get micOn() { return !!mic; }, get tvOn() { return !!tv; },
    get voices() { return [...inn.values()].filter((r) => r.kind === 'voice' && r.stream).map((r) => r.from); },
    get tvFrom() { const r = [...inn.values()].find((x) => x.kind === 'tv' && x.stream); return r ? r.from : null; },
    isMuted: (id) => muted.has(id),
    // 내 마이크를 켜거나 끈다. 켜졌으면 true
    async setMic(on) {
      if (!on) {
        if (mic) for (const t of mic.getTracks()) t.stop();
        mic = null; callAll('voice', null);
        return false;
      }
      if (mic) return true;
      if (!K.peer()) { K.toast('지금 연결 방식에서는 보이스를 쓸 수 없어요'); return false; }
      try { mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false }); }
      catch (_) { mic = null; K.toast('마이크를 쓸 수 없어요. 브라우저에서 마이크를 허용해 주세요'); return false; }
      bind(); callAll('voice', mic);
      return true;
    },
    // 내가 넣은 TV 영상을 모두에게 보낸다 (null 이면 그만 보낸다)
    setTv(stream) { tv = stream || null; callAll('tv', null); if (tv) { bind(); callAll('tv', tv); } },
    // 다른 사람의 목소리를 내 쪽에서만 끄거나 켠다
    mute(id, on) { if (on) muted.add(id); else muted.delete(id); const r = inn.get('voice:' + id); if (r && r.audio) r.audio.muted = on; },
    // 방에 있는 사람이 바뀌었을 때: 새로 온 사람에게 걸고, 나간 사람 것은 정리한다
    refresh() {
      bind();
      if (mic) callAll('voice', mic);
      if (tv) callAll('tv', tv);
      const here = new Set(K.targets().map((t) => t.id));
      for (const [key, r] of [...inn]) if (!here.has(r.from)) drop(key);
    },
    // 방에서 나가거나 끊겼을 때 모두 정리한다
    stop() {
      if (mic) for (const t of mic.getTracks()) t.stop();
      mic = null; tv = null;
      callAll('voice', null); callAll('tv', null);
      for (const key of [...inn.keys()]) drop(key);
      bound = null;
    },
    // 받은 목소리의 상태 (자동 검사용)
    audioOf(id) { const r = inn.get('voice:' + id); return r && r.audio ? { muted: r.audio.muted, tracks: r.stream.getAudioTracks().length, live: r.stream.getAudioTracks().some((t) => t.readyState === 'live') } : null; },
  };
}
