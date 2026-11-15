// 이웃: 내 집, 친구 목록(내 집에 왔던 사람들), 이웃집 목록(내가 가 본 친구 집). 모두 이 기기에만 남긴다(서버가 없다).
//
// 내 집 (home = { id, key, open })
//   처음 친구를 초대할 때 방 이름과 열쇠가 정해지고, 그 뒤로는 바뀌지 않는다: 친구가 저장해 둔 이웃집 주소가 계속 통하게.
//   open = 집을 열어 두었는지(같이 꾸미는 방으로 있는지). "혼자 놀기"로 닫으면 false 이고, 다시 초대하면 같은 주소로 연다.
// 친구 목록 (friends = [{ tag, dev, name, at, auto, ban }], 내 집의 방장일 때만 쌓는다)
//   tag = 그 친구의 이 방 표(admin.js 의 tag: 초인종에 실려 온 비밀표에서 만든 것), dev = 기기 이름, name = 닉네임, at = 마지막으로 온 때.
//   auto = 다음부터 초인종 없이 들어온다(자동 입장). 표(tag)로만 가린다: 남이 기기 이름만 알아서는 흉내 낼 수 없다(표는 비밀표를 알아야 만든다).
//   ban = 내보낸 사람(다시 못 들어온다). 표나 기기 이름 어느 쪽이 맞아도 막는다.
// 이웃집 (hoods = [{ id, key, view, name, at }])
//   내가 들어가 본 친구 집. key 가 있으면 같이 꾸미는 사람으로, 없으면 구경(view)으로 들어간다. name = 그 집 방장의 닉네임.
//
// K = { store, key(k) }
const ROOM = /^[a-z0-9]{6,20}$/, KEY = /^[a-z0-9]{4,12}$/, DEV = /^[a-z0-9]{6,24}$/, TAG = /^[a-f0-9]{20}$/;
export const FRIENDS = 60, HOODS = 20; // 기억해 두는 친구 수, 이웃집 수

export function makeHood(K) {
  const FR = K.key('friends'), HD = K.key('hoods'), HOME = K.key('home');
  const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  const num = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

  /* ───────── 내 집 ───────── */
  let home = (() => { const h = K.store.get(HOME); return h && typeof h === 'object' && ROOM.test(h.id || '') && KEY.test(h.key || '') ? { id: h.id, key: h.key, open: h.open === true } : null; })();
  const saveHome = () => { if (home) K.store.set(HOME, home); else K.store.del(HOME); };

  /* ───────── 친구 목록 ───────── */
  let friends = (() => {
    const a = K.store.get(FR);
    return (Array.isArray(a) ? a : []).filter((r) => r && typeof r === 'object').map((r) => ({ tag: TAG.test(r.tag || '') ? r.tag : '', dev: DEV.test(r.dev || '') ? r.dev : '', name: str(r.name, 12), at: num(r.at), auto: r.auto === true, ban: r.ban === true }))
      .filter((r) => r.tag || r.dev).slice(0, FRIENDS);
  })();
  const saveFr = () => K.store.set(FR, friends);
  const idOf = (r) => r.tag || 'd:' + r.dev; // 목록에서 한 사람을 가리키는 이름
  const find = (tag, dev) => friends.find((r) => (tag && r.tag === tag) || (dev && r.dev === dev)) || null;
  const byId = (id) => friends.find((r) => idOf(r) === id) || null;
  // 왔던 사람을 적어 둔다 (이름·때를 고친다). 너무 많아지면 오래된 사람부터 지운다(자동 입장·내보낸 사람은 남긴다)
  function seen(p) {
    const tag = TAG.test(p.tag || '') ? p.tag : '', dev = DEV.test(p.dev || '') ? p.dev : '';
    if (!tag && !dev) return null;
    let r = find(tag, dev);
    if (!r) { r = { tag, dev, name: '', at: 0, auto: false, ban: false }; friends.push(r); }
    if (tag) r.tag = tag;
    if (dev) r.dev = dev;
    if (p.name) r.name = str(p.name, 12);
    r.at = Date.now();
    if (friends.length > FRIENDS) {
      const old = friends.filter((x) => x !== r && !x.auto && !x.ban).sort((a, b) => a.at - b.at)[0] || friends.filter((x) => x !== r).sort((a, b) => a.at - b.at)[0];
      friends = friends.filter((x) => x !== old);
    }
    saveFr();
    return r;
  }

  /* ───────── 이웃집 ───────── */
  let hoods = (() => {
    const a = K.store.get(HD);
    return (Array.isArray(a) ? a : []).filter((h) => h && typeof h === 'object' && ROOM.test(h.id || '')).map((h) => ({ id: h.id, key: KEY.test(h.key || '') ? h.key : '', view: h.view === true, name: str(h.name, 12), at: num(h.at) })).slice(0, HOODS);
  })();
  const saveHd = () => K.store.set(HD, hoods);

  return {
    // 내 집
    get home() { return home; },
    setHome(id, key, open) { if (!ROOM.test(id) || !KEY.test(key)) return; home = { id, key, open: !!open }; saveHome(); },
    setOpen(on) { if (home && home.open !== !!on) { home.open = !!on; saveHome(); } },
    isHome: (id) => !!home && home.id === id,

    // 친구 목록 (최근에 온 순)
    get friends() { return [...friends].sort((a, b) => b.at - a.at).map((r) => ({ id: idOf(r), tag: r.tag, dev: r.dev, name: r.name, at: r.at, auto: r.auto, ban: r.ban })); },
    seen, idOf: (tag, dev) => { const r = find(tag, dev); return r ? idOf(r) : ''; },
    // 초인종 없이 들여도 되는 표인지 / 내보낸 사람인지
    autoOk: (tag) => { const r = tag ? friends.find((x) => x.tag === tag) : null; return !!r && r.auto && !r.ban; },
    banned: (dev, tag) => friends.some((r) => r.ban && ((tag && r.tag === tag) || (dev && r.dev === dev))),
    setAuto(id, on) { const r = byId(id); if (!r || !r.tag || (on && r.ban)) return false; r.auto = !!on; saveFr(); return true; },
    setBan(id, on) { const r = byId(id); if (!r) return false; r.ban = !!on; if (on) r.auto = false; saveFr(); return true; },
    ban(dev, tag) { const r = seen({ dev, tag }); if (r) { r.ban = true; r.auto = false; saveFr(); } },
    forget(id) { const r = byId(id); if (!r) return false; friends = friends.filter((x) => x !== r); saveFr(); return true; },

    // 이웃집 (최근에 간 순)
    get hoods() { return [...hoods].sort((a, b) => b.at - a.at).map((h) => ({ ...h })); },
    has: (id) => hoods.some((h) => h.id === id),
    // 들어가 본 집을 적어 둔다. 열쇠는 한 번 받았으면 구경 링크로 다시 가도 남긴다. 돌려주는 값 = 목록에서 밀려난 집의 방 이름들
    visit(p) {
      if (!ROOM.test(p.id || '') || (home && home.id === p.id)) return [];
      let h = hoods.find((x) => x.id === p.id);
      if (!h) { h = { id: p.id, key: '', view: true, name: '', at: 0 }; hoods.push(h); }
      if (KEY.test(p.key || '')) { h.key = p.key; h.view = false; }
      if (p.name) h.name = str(p.name, 12);
      h.at = Date.now();
      const out = [];
      while (hoods.length > HOODS) { const old = hoods.filter((x) => x !== h).sort((a, b) => a.at - b.at)[0]; hoods = hoods.filter((x) => x !== old); out.push(old.id); }
      saveHd();
      return out;
    },
    leave(id) { const n = hoods.length; hoods = hoods.filter((h) => h.id !== id); if (hoods.length !== n) saveHd(); return hoods.length !== n; },
    // 그 집으로 가는 주소의 # 뒷부분
    hashOf: (h) => (h.key ? '#r=' + h.id + '-' + h.key : '#v=' + h.id),
  };
}
