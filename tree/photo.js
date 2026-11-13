// 액자에 내 사진 넣기: 벽에 건 그림(catalog.js 의 play: 'pic') 앞에서 "🖼️ 사진 바꾸기" → 사진첩에서 고르기 → 액자에 건다.
//   방의 상태(state.js)에는 사진의 지문만 들어간다: { t: 'pic', id: 액자, h: 지문 }, '' 이면 원래 그림. 그래서 방은 작고 검증도 그대로다.
//   사진 자체는 따로 다닌다. 고른 사진은 액자 비율(PIC.w × PIC.h)에 맞춰 가운데를 잘라 작게 줄인 JPEG(data URL, PIC.max 글자까지)이고,
//     서로         { t: 'photo', h, d }     사진 한 장. 받는 쪽은 형식·크기·지문을 다시 확인한다
//     서로         { t: 'photoq', h }       그 지문의 사진이 없으니 달라 (방이 그 지문을 쓰고 있을 때만 준다)
//   로 같은 방 사람끼리만 주고받는다(duo.js 가 주인을 거쳐 전한다). 서버로는 보내지 않는다.
//   기기마다 IndexedDB 에 남겨서(동영상을 기억하는 곳과 같은 곳: play.js) 방을 다시 열어도 그대로이고, 나중에 온 사람은 없는 사진을 달라고 한다.
//   꾸밀 수 있는 사람만 바꾼다(구경하는 사람이 보낸 'pic' 변화는 주인이 받지 않는다: duo.js).
//
// K = { key(k), S() 방 상태, op(o) 변화 하나(받아들여졌으면 true), canEdit(), toast(m), online() 방에 같이 있는지, send(m) 방 사람들에게(손님이면 주인에게),
//       play 놀이 창구(play.js), setPose(p), close(), changed() 사진이 새로 생겼다(다시 그리기) }
import { PIC } from './catalog.js';

const RE = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/;
// 주고받을 수 있는 사진인지: JPEG data URL, PIC.max 글자까지
export const okPhoto = (d) => typeof d === 'string' && d.length >= 100 && d.length <= PIC.max && RE.test(d);
const okHash = (h) => typeof h === 'string' && /^[a-z0-9]{8,16}$/.test(h);
// 사진의 지문 (영문 소문자·숫자 14자). 같은 사진은 어느 기기에서나 같은 지문이다
export function hashOf(d) {
  let a = 0xdeadbeef, b = 0x41c6ce57;
  for (let i = 0; i < d.length; i++) { const c = d.charCodeAt(i); a = Math.imul(a ^ c, 2654435761); b = Math.imul(b ^ c, 1597334677); }
  a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909);
  b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
  return (b >>> 0).toString(36).padStart(7, '0') + (a >>> 0).toString(36).padStart(7, '0');
}
// 고른 사진 파일을 액자 비율에 맞춰 가운데를 잘라 작게 줄인다. 돌려주는 값 = JPEG data URL (못 읽으면 null)
export async function shrink(file) {
  if (!(file instanceof Blob)) return null;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => no(new Error('img')); im.src = url; });
    const sw = img.naturalWidth, sh = img.naturalHeight;
    if (!sw || !sh) return null;
    for (let scale = 1; scale > 0.3; scale *= 0.75) { // 그래도 크면 더 작게
      const c = document.createElement('canvas'), w = c.width = Math.round(PIC.w * scale), h = c.height = Math.round(PIC.h * scale);
      const g = c.getContext('2d'), s = Math.max(w / sw, h / sh);
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      g.drawImage(img, (w - sw * s) / 2, (h - sh * s) / 2, sw * s, sh * s);
      for (const q of [0.82, 0.68, 0.5]) { const d = c.toDataURL('image/jpeg', q); if (okPhoto(d)) return d; }
    }
    return null;
  } catch (_) { return null; } finally { URL.revokeObjectURL(url); }
}

export function makePhotos(K) {
  const mem = new Map();   // 지문 → 사진 (지금 기기가 알고 있는 것)
  const miss = new Map();  // 없는 사진: 지문 → { db: 0 안 찾아봄 | 1 찾는 중 | 2 기기에 없음, asked: 마지막으로 달라고 한 때 }
  const used = () => new Set(K.S().pics.values());
  /* ───────── 기기에 기억하기 ───────── */
  const DB = 'nolja-tree', PFX = K.key('pic') + ':';
  function db(mode, fn) {
    return new Promise((ok) => {
      let rq;
      try { rq = indexedDB.open(DB, 1); } catch (_) { ok(null); return; }
      rq.onupgradeneeded = () => rq.result.createObjectStore('files');
      rq.onerror = () => ok(null);
      rq.onsuccess = () => {
        try {
          const tx = rq.result.transaction('files', mode), r = fn(tx.objectStore('files'));
          tx.oncomplete = () => { ok(r ? r.result : null); rq.result.close(); };
          tx.onerror = tx.onabort = () => { ok(null); rq.result.close(); };
        } catch (_) { ok(null); }
      };
    });
  }
  function keep(h, d) {
    mem.delete(h); mem.set(h, d); miss.delete(h);
    db('readwrite', (s) => s.put({ d, at: Date.now() }, PFX + h));
    if (mem.size > 60) { const u = used(); for (const k of [...mem.keys()]) { if (mem.size <= 40) break; if (!u.has(k)) mem.delete(k); } } // 쓰이지 않는 것은 오래된 것부터 잊는다
    K.changed();
  }
  // 기기에 쌓인 것 정리: 지금 방이 쓰지 않는 사진은 최근 PIC.keep 장만 남긴다 (다른 방의 것일 수 있어 바로 지우지는 않는다)
  async function tidy() {
    const range = IDBKeyRange.bound(PFX, PFX + '￿');
    const [keys, vals] = await Promise.all([db('readonly', (s) => s.getAllKeys(range)), db('readonly', (s) => s.getAll(range))]);
    if (!Array.isArray(keys) || !Array.isArray(vals) || keys.length !== vals.length) return;
    const u = used(), spare = keys.map((k, n) => ({ k, at: (vals[n] && vals[n].at) || 0 })).filter((r) => !u.has(String(r.k).slice(PFX.length))).sort((p, q) => q.at - p.at).slice(PIC.keep);
    if (spare.length) db('readwrite', (s) => { for (const r of spare) s.delete(r.k); });
  }
  setTimeout(tidy, 8000);

  /* ───────── 주고받기 ───────── */
  // 받은 사진 한 장. trusted = 주인이 보냈거나 꾸밀 수 있는 손님이 보낸 것(곧 걸 사진일 수 있다). 아니면 방이 쓰는 지문일 때만 받는다. 새로 받았으면 true
  function recv(m, trusted) {
    if (!m || !okHash(m.h) || !okPhoto(m.d) || mem.has(m.h) || hashOf(m.d) !== m.h) return false;
    if (!trusted && !used().has(m.h)) return false;
    keep(m.h, m.d);
    return true;
  }
  // 누가 달라고 한 사진 (방이 쓰는 것이고 내가 갖고 있을 때만)
  const give = (h) => (okHash(h) && used().has(h) && mem.get(h)) || null;
  let acc = 0;
  function tick(dt) {
    acc += dt;
    if (acc < 0.5) return;
    acc = 0;
    const now = performance.now();
    for (const h of used()) {
      if (mem.has(h)) continue;
      let st = miss.get(h);
      if (!st) { st = { db: 0, asked: -1e9 }; miss.set(h, st); }
      if (st.db === 0) { // 먼저 이 기기에서 찾는다
        st.db = 1;
        db('readonly', (s) => s.get(PFX + h)).then((v) => {
          if (v && okPhoto(v.d) && hashOf(v.d) === h) { mem.set(h, v.d); miss.delete(h); K.changed(); } else st.db = 2;
        });
      } else if (st.db === 2 && K.online() && now - st.asked > 4000) { st.asked = now; K.send({ t: 'photoq', h }); } // 없으면 같이 있는 사람에게 달라고 한다
    }
  }

  /* ───────── 고르기 ───────── */
  let busy = false;
  // 액자 id 에 사진 파일을 넣는다. 됐으면 지문을 돌려준다
  async function choose(id, file) {
    if (!K.canEdit()) { K.toast('구경하는 중에는 사진을 바꿀 수 없어요'); return null; }
    if (busy) return null;
    busy = true;
    let d = null;
    try { d = await shrink(file); } finally { busy = false; }
    if (!d) { K.toast('이 사진은 넣을 수 없어요. 다른 사진을 골라 주세요'); return null; }
    const h = hashOf(d);
    if (!mem.has(h)) keep(h, d);
    if (K.online()) K.send({ t: 'photo', h, d }); // 사진을 먼저 보내고, 그 지문을 건다
    if (K.S().pics.get(id) === h) return h;
    if (!K.op({ t: 'pic', id, h })) { K.toast('지금은 사진을 바꿀 수 없어요'); return null; }
    K.toast('🖼️ 액자에 사진을 걸었어요');
    return h;
  }
  function reset(id) {
    if (!K.canEdit()) return false;
    if (!K.op({ t: 'pic', id, h: '' })) return false;
    K.toast('원래 그림으로 되돌렸어요');
    return true;
  }
  const file = document.getElementById('picFile');
  file.addEventListener('change', async () => {
    const f = file.files && file.files[0], id = K.play.kind === 'pic' ? K.play.id : null; // 지금 보고 있는 액자에 넣는다
    file.value = '';
    if (f && id) { await choose(id, f); if (K.play.kind === 'pic') K.play.refresh(K.play.id); }
  });
  // 그림 앞에 서서 보는 놀이 (play.js 의 판을 쓴다)
  const v3 = [0, 0, 0];
  const kind = {
    start(c) {
      if (!K.canEdit()) return false;
      const at = (x, y, z) => { c.g.updateMatrixWorld(); const p = c.g.localToWorld(c.g.position.clone().set(x, y, z)); v3[0] = p.x; v3[1] = p.y; v3[2] = p.z; return [...v3]; };
      // 액자가 가로로 넉넉히 들어오는 거리에 선다 (세로로 든 폰에서는 더 물러선다)
      const fov = innerWidth < innerHeight ? 58 : 38, hf = Math.atan(Math.tan(fov * Math.PI / 360) * innerWidth / innerHeight);
      const d = Math.max(1.2, Math.min(3.4, 0.43 / 0.6 / Math.tan(hf)));
      K.setPose({ pos: at(0, 1.58, d - 0.2), at: at(0, 1.6, -0.2), fov, inside: true });
      kind.paint(c);
    },
    paint(c) {
      const has = K.S().pics.has(c.id);
      K.play.panel('🖼️ 액자', has ? '내가 고른 사진이 걸려 있어요. 같이 있는 사람들에게도 보여요.' : '사진첩에서 고른 사진을 이 액자에 걸 수 있어요. 같이 있는 사람들에게도 보여요.', [
        { label: has ? '다른 사진 고르기' : '🖼️ 사진 고르기', main: true, id: 'playGo', fn: () => file.click() },
        ...(has ? [{ label: '원래 그림으로', id: 'picReset', fn: () => { reset(c.id); kind.paint(c); } }] : []),
        { label: '그만 보기', id: 'playQuit', fn: () => K.close() },
      ]);
    },
    tick() {}, tap() {}, stop() {},
  };
  K.play.add('pic', kind);

  return {
    get: (h) => mem.get(h) || null, // 그 지문의 사진 (아직 없으면 null)
    recv, give, tick, choose, reset, tidy,
    onOp(op) { if (K.play.kind === 'pic' && K.play.id === op.id) K.play.refresh(op.id); }, // 보고 있는 액자를 누가 바꿨다
    get count() { return mem.size; },
  };
}
