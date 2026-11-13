// 공동 관리자: 방장이 지정한 사람은 다음부터 초인종 없이 들어오고, 방장에 가까운 일을 할 수 있다.
//   할 수 있는 일: 문 앞 사람 들이기·돌려보내기, 방 안 사람 내보내기(방장과 다른 공동 관리자는 빼고), 꾸미기(열쇠 없이도),
//                  불 켜고 끄기, 3층을 영화관으로 바꾸기, 아무 날에나 불꽃놀이.  지정·해제는 방을 만든 방장만 한다.
//
// 누구인지 가리는 법 (서버가 없어서 기기에 남긴 비밀값으로 가린다):
//   기기마다 비밀값 sec 를 하나 만들어 그 기기에만 둔다(어디에도 보내지 않는다).
//   방마다 비밀표 tk = SHA-256(sec | 방 이름) 의 앞 32자. 초인종(knock)을 보낼 때 그때의 주인 한 사람에게만 건넨다.
//   방에 적어 두는 것은 표 tag = SHA-256(tk) 의 앞 20자뿐이다(S.adm). 방의 상태는 모든 사람이 받지만 표에서 비밀표를 거꾸로 구할 수는 없어서,
//   방 안의 다른 사람이 표를 보고 공동 관리자를 흉내 낼 수 없다. 방이 다르면 표도 달라서 방끼리 같은 사람인지 알 수 없다.
//   한계는 NEXT.md 의 "공동 관리자" 절에 적어 둔다(주인 자리를 대신 맡은 기기는 비밀표를 본다, 기기를 바꾸거나 저장을 지우면 다시 지정해야 한다).
//
// K = { store, key(k), room() 지금 방 이름(없으면 null), mine() 내가 만든 방인지, S() 방 상태, duo() 연결, op(o), toast(m), paint() 화면 다시 그리기, max 최대 수 }

// SHA-256 (16진 글자). crypto.subtle 은 기다려야 하고 https 에서만 돼서, 짧은 글자에 쓸 작은 것을 따로 둔다.
const KS = new Uint32Array(64);
{
  let n = 0;
  for (let c = 2; n < 64; c++) { let p = true; for (let d = 2; d * d <= c; d++) if (c % d === 0) { p = false; break; } if (p) KS[n++] = (Math.cbrt(c) % 1) * 4294967296; }
}
export function sha256(text) {
  const src = new TextEncoder().encode(text), len = src.length, total = ((len + 9 + 63) >> 6) << 6;
  const m = new Uint8Array(total), w = new Uint32Array(64), dv = new DataView(m.buffer);
  m.set(src); m[len] = 0x80;
  dv.setUint32(total - 8, Math.floor(len / 536870912)); dv.setUint32(total - 4, (len << 3) >>> 0);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const rr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < total; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15], b = w[i - 2];
      w[i] = (w[i - 16] + (rr(a, 7) ^ rr(a, 18) ^ (a >>> 3)) + w[i - 7] + (rr(b, 17) ^ rr(b, 19) ^ (b >>> 10))) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + KS[i] + w[i]) >>> 0;
      const t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }
  return Array.from(h, (x) => x.toString(16).padStart(8, '0')).join('');
}

export function makeAdmin(K) {
  const SEC = K.key('sec'), PASS = K.key('pass');
  let sec = K.store.get(SEC);
  if (typeof sec !== 'string' || !/^[a-f0-9]{48}$/.test(sec)) {
    sec = Array.from(crypto.getRandomValues(new Uint8Array(24)), (x) => x.toString(16).padStart(2, '0')).join('');
    K.store.set(SEC, sec);
  }
  // 비밀표에서 방에 적는 표를 만든다 (모양이 이상하면 '')
  const tagOf = (tk) => (typeof tk === 'string' && /^[a-f0-9]{32}$/.test(tk) ? sha256('nolja-tree-adm|' + tk).slice(0, 20) : '');
  const cards = new Map();
  // 이 방에서 쓰는 내 비밀표와 표
  function card() {
    const r = K.room();
    if (!r) return null;
    let c = cards.get(r);
    if (!c) { const tk = sha256(sec + '|' + r).slice(0, 32); c = { tk, tag: tagOf(tk) }; cards.set(r, c); }
    return c;
  }
  // 초인종 없이 들어갈 수 있다고 알고 있는 방들 (이 기기에만 남긴다. 아니게 됐으면 주인이 알려 준다)
  const passes = () => { const a = K.store.get(PASS); return Array.isArray(a) ? a.filter((x) => typeof x === 'string').slice(-20) : []; };
  function setPass(on) {
    const r = K.room(), list = passes();
    if (!r || list.includes(r) === on) return;
    K.store.set(PASS, on ? [...list, r] : list.filter((x) => x !== r));
  }
  // 방장인지: 지금 방의 주인 자리에 있거나, 혼자 노는 내 방 (app.js 의 예전 판정과 같다. 공동 관리자는 들어가지 않는다)
  const isHost = () => { const d = K.duo(); return d.role === 'host' || (!d.role && (!K.room() || K.mine())); };
  // 내가 이 방의 공동 관리자인지 (손님으로 들어와 있을 때)
  const isMe = () => { const c = card(), d = K.duo(); return !!c && d.mode === 'on' && d.role !== 'host' && K.S().adm.has(c.tag); };
  const A = {
    tagOf, isHost, isMe,
    tk: () => { const c = card(); return c ? c.tk : ''; },
    get tag() { const c = card(); return c ? c.tag : ''; },
    // 방장이거나 공동 관리자: 불·영화관·불꽃놀이·문 열어 주기·내보내기
    canManage: () => isHost() || isMe(),
    // 공동 관리자를 지정·해제할 수 있는지: 방을 만든 방장만 (주인 자리를 잠깐 대신 맡은 사람은 못 한다)
    isOwner: () => { const d = K.duo(); return d.role === 'host' && K.mine(); },
    hasPass: () => { const r = K.room(); return !!r && passes().includes(r); },
    passLost: () => setPass(false),
    // 방장: 방 안의 사람 pid 를 지정(on)하거나 해제한다
    grant(pid, on) {
      if (!A.isOwner()) return false;
      if (on && K.S().adm.size >= K.max) { K.toast(`공동 관리자는 ${K.max}명까지예요`); return false; }
      if (!K.duo().grant(pid, on)) { K.toast('이 친구는 지정할 수 없어요. 친구가 새로 고친 뒤에 다시 해 보세요'); return false; }
      K.toast(on ? '공동 관리자로 지정했어요 🔑 다음부터 초인종 없이 들어와요' : '공동 관리자에서 해제했어요');
      return true;
    },
    // 방장: 지금 방에 없는 공동 관리자들 (표)
    absent() { const here = new Set(K.duo().admTags); return [...K.S().adm].filter((t) => !here.has(t)); },
    clearAbsent() {
      if (!A.isOwner()) return 0;
      const list = A.absent();
      for (const tag of list) K.op({ t: 'adm', tag, on: false });
      if (list.length) K.toast('지금 없는 공동 관리자를 모두 해제했어요');
      return list.length;
    },
    // 방의 공동 관리자 표가 바뀌었다 (지정·해제, 또는 방을 통째로 받았다). 내 것이면 알리고, 다음에 초인종 없이 들어올지 적어 둔다
    onChange(op, from) {
      const d = K.duo(), c = card();
      if (d.role === 'host') { d.told(); K.paint(); return; }
      if (!c || d.mode !== 'on') return;
      const mine = K.S().adm.has(c.tag);
      setPass(mine);
      K.paint(); // 위 표시의 🔑, 사람 목록의 단추
      if (op && op.tag === c.tag && from === 'peer') K.toast(mine ? '방장이 공동 관리자로 지정했어요 🔑 다음부터 초인종 없이 들어와요' : '공동 관리자에서 해제됐어요');
    },
  };
  return A;
}
