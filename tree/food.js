// 냉장고와 먹기. 냉장고 문을 열어 음식·음료를 꺼내고, 손에 들고 한 입씩 먹는다.
// 방의 상태(state.js)는 건드리지 않는다. 누가 무엇을 들고 몇 입 남았는지, 어느 냉장고가 열렸는지는 놀이 소식(fx)으로만 오간다:
//   { k: 'food', v: 'o:냉장고id' }      냉장고 문을 열었다 (열어 둔 동안 몇 초마다 다시 보낸다)
//   { k: 'food', v: 'c:냉장고id' }      닫았다
//   { k: 'food', v: 'h:종류:남은 입' }  이것을 들고 있다. 남은 입이 줄었으면 한 입 먹은 것이다 (들고 있는 동안 몇 초마다 다시 보낸다)
//   { k: 'food', v: 'x' }               도로 넣었다
// 와인 냉장고(가구 'wine')도 같은 방식이다. 문 소식은 그대로이고, 꺼내 따르는 순간에는 'h:종류:남은 입:p' 로 보내 받는 쪽도 따르는 모습을 본다.
// 먹는 몸짓은 행동 "냠냠"(avatar.js 의 eat)을 그대로 쓰고, 그 소식({ k: 'act', v: 'eat' })은 app.js 의 doAct 가 보낸다.
// K (app.js 가 준다): scene, me, avatar(id) → 친구 아바타, itemObj(id), S(), approach(id, then), mode(), setMode(m), act(행동), fx(소식),
//   online() → 같이 있는지, toast, dirty, ray(px, py), resized(), busy() → 케이크를 들고 있는지
import { THREE, M, put, rbox, cyl, ball } from './kit.js';
import { kindOf } from './state.js';
import { addShape } from './furniture.js';
import { sfx } from './sfx.js';

const TAU = Math.PI * 2;
// n = 몇 입, sip = 마시는 것, fx = 먹을 때 날리는 것(부스러기 색) 또는 'steam'(김)·'fizz'(탄산 방울), say = 한 입 먹을 때 뜨는 말, snd = 한 입의 소리(sfx.js)
// wine = 와인 냉장고에서 꺼내는 것('glass' 와인잔·'flute' 길쭉한 잔). col = 술 색, bottle = 병 색, foil = 병목 색. 상표는 없다
export const FOODS = [
  { id: 'cake', snd: 'soft', name: '케이크', icon: '🍰', n: 3, fx: 0xF3D9A4, say: '냠냠', done: '🍰 케이크를 다 먹었어요. 접시만 남았네요' },
  { id: 'cookie', snd: 'crisp', name: '쿠키', icon: '🍪', n: 3, fx: 0xB9793E, say: '바삭', done: '🍪 쿠키를 다 먹었어요. 부스러기만 남았어요' },
  { id: 'tangerine', snd: 'soft', name: '귤', icon: '🍊', n: 4, fx: 0xF39A2B, say: '새콤', first: '까는 중', done: '🍊 귤을 다 먹었어요. 껍질만 남았어요' },
  { id: 'berry', snd: 'soft', name: '딸기', icon: '🍓', n: 2, fx: 0xE23B2E, say: '달콤', done: '🍓 딸기를 먹었어요. 꼭지만 남았어요' },
  { id: 'chicken', snd: 'crisp', name: '치킨', icon: '🍗', n: 3, fx: 0xC9792E, say: '바삭', done: '🍗 치킨을 다 먹었어요. 뼈만 남았어요' },
  { id: 'pizza', snd: 'cheese', name: '피자', icon: '🍕', n: 3, fx: 0xF2C14E, say: '쭈욱', done: '🍕 피자를 다 먹었어요. 꼬다리만 남았어요' },
  { id: 'sandwich', snd: 'bite', name: '샌드위치', icon: '🥪', n: 3, fx: 0xF3E3C0, say: '와앙', done: '🥪 샌드위치를 다 먹었어요' },
  { id: 'pudding', snd: 'soft', name: '푸딩', icon: '🍮', n: 3, fx: 0xF6D36B, say: '탱글', done: '🍮 푸딩을 다 먹었어요. 접시만 남았네요' },
  { id: 'icecream', snd: 'lick', name: '아이스크림', icon: '🍦', n: 4, fx: 0xFFD9E2, say: '할짝', done: '🍦 아이스크림을 다 먹었어요' },
  { id: 'choco', snd: 'snap', name: '초콜릿', icon: '🍫', n: 3, fx: 0x5A3824, say: '똑', done: '🍫 초콜릿을 다 먹었어요. 포장지만 남았어요' },
  { id: 'cocoa', snd: 'slurp', name: '코코아', icon: '☕', n: 4, sip: true, fx: 'steam', say: '호로록', done: '☕ 코코아를 다 마셨어요. 따뜻해요' },
  { id: 'milk', snd: 'gulp', name: '우유', icon: '🥛', n: 3, sip: true, fx: 0xFFFFFF, say: '꿀꺽', done: '🥛 우유를 다 마셨어요. 입가에 우유가 묻었어요' },
  { id: 'juice', snd: 'straw', name: '주스', icon: '🧃', n: 3, sip: true, fx: 0xF7A531, say: '쪼옥', done: '🧃 주스를 다 마셨어요' },
  { id: 'soda', snd: 'straw', name: '탄산', icon: '🥤', n: 3, sip: true, fx: 'fizz', say: '캬~', done: '🥤 탄산을 다 마셨어요. 얼음만 남았어요' },
  { id: 'water', snd: 'gulp', name: '물', icon: '💧', n: 2, sip: true, fx: 0x8FD0F0, say: '꿀꺽', done: '💧 물을 다 마셨어요. 빈 병이에요' },
  // 영화관 매점 (cine: 냉장고에는 없고 팝콘 기계에서 꺼낸다. cinema.js). 좌석에 앉은 채로도 먹는다
  { id: 'popcorn', snd: 'crisp', name: '팝콘', icon: '🍿', n: 5, cine: true, fx: 0xFFE9A8, say: '바삭', done: '🍿 팝콘을 다 먹었어요. 빈 통만 남았어요' },
  // 와인 냉장고
  { id: 'red', snd: 'gulp', name: '레드 와인', icon: '🍷', n: 4, sip: true, wine: 'glass', col: 0x7A1528, bottle: 0x1F3A2A, foil: 0x7A1528, fx: 0x7A1528, say: '음~', done: '🍷 레드 와인을 다 마셨어요. 빈 잔이에요' },
  { id: 'white', snd: 'gulp', name: '화이트 와인', icon: '🥂', n: 4, sip: true, wine: 'glass', col: 0xF0E2A2, bottle: 0x9DB36A, foil: 0xE8DFC0, fx: 0xF0E2A2, say: '상큼', done: '🥂 화이트 와인을 다 마셨어요. 빈 잔이에요' },
  { id: 'rose', snd: 'gulp', name: '로제 와인', icon: '🌸', n: 4, sip: true, wine: 'glass', col: 0xF2A3AC, bottle: 0xF4B6BC, foil: 0xD9717F, fx: 0xF2A3AC, say: '향긋', done: '🌸 로제 와인을 다 마셨어요. 빈 잔이에요' },
  { id: 'bubbly', snd: 'gulp', name: '스파클링', icon: '🍾', n: 4, sip: true, wine: 'flute', col: 0xF6E9B4, bottle: 0x1B3325, foil: 0xE7B441, fx: 'fizz', say: '톡톡', done: '🍾 스파클링 와인을 다 마셨어요. 빈 잔이에요' },
  { id: 'grape', snd: 'gulp', name: '포도주스', icon: '🍇', n: 4, sip: true, wine: 'glass', col: 0x5B2A7A, bottle: 0x3B1D55, foil: 0xC9B6E4, fx: 0x5B2A7A, say: '달콤', done: '🍇 포도주스를 다 마셨어요(무알코올). 빈 잔이에요' },
];
const WINES = FOODS.filter((f) => f.wine), PANTRY = FOODS.filter((f) => !f.wine && !f.cine);
const lying = (a) => !!a.rest && !a.rest.sit; // 누워 있는지 (좌석에 앉은 것은 아니다: 앉아서는 들고 먹을 수 있다)
const BY = new Map(FOODS.map((f) => [f.id, f]));
const HAND = 2.1; // 손에 들었을 때의 배율 (머리가 큰 캐릭터에 맞춘다. 선반에서는 1.3)
const ID_RE = /^[\w-]{1,24}$/;

/* ───────── 음식 모양 (모양과 재질은 모두가 나눠 쓴다) ───────── */
const GEO = {};
const geo = (k, f) => GEO[k] || (GEO[k] = f());
const mesh = (g, k, f, mat, x = 0, y = 0, z = 0) => put(geo(k, f), mat, x, y, z, g, false);
const GLASS = new THREE.MeshLambertMaterial({ color: 0xDDF1F7, transparent: true, opacity: 0.38, depthWrite: false });
const ICE = new THREE.MeshLambertMaterial({ color: 0xF2FBFF, transparent: true, opacity: 0.7, depthWrite: false });
const MUG = new THREE.MeshLambertMaterial({ color: 0xC8443A, side: THREE.DoubleSide });
const GLASS_2 = new THREE.MeshLambertMaterial({ color: 0xE6F6FA, transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide });

// 위에서 본 세모 조각(바깥 가장자리가 z = 0, 뾰족한 끝이 z = -R). k = 남은 비율. 먹은 쪽은 베어 문 자국처럼 둥글게 파인다
function wedgeGeo(R, w, h, k) {
  const s = new THREE.Shape();
  s.moveTo(-w, 0); s.lineTo(w, 0);
  if (k >= 1) s.lineTo(0, -R);
  else {
    const y = -R * k, x = w * (1 - k) + 0.004, d = Math.min(0.022, R * k * 0.45);
    s.lineTo(x, y); s.quadraticCurveTo(x * 0.5, y + d, 0, y + d * 0.25); s.quadraticCurveTo(-x * 0.5, y + d, -x, y);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 5 });
  g.rotateX(Math.PI / 2); g.translate(0, h, 0);
  return g;
}
// 둥근 과자(앞을 보고 서 있다). bites = [[각도, 크기]] 만큼 가장자리가 둥글게 베어져 있다
function biteDisc(R, h, bites) {
  const s = new THREE.Shape(), n = 48;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, ux = Math.cos(a), uy = Math.sin(a);
    let r = R;
    for (const [ba, b] of bites) {
      const uc = ux * Math.cos(ba) * R + uy * Math.sin(ba) * R, disc = uc * uc - R * R + b * b;
      if (disc > 0) { const t = uc - Math.sqrt(disc); if (t > 0 && t < r) r = t; }
    }
    if (i) s.lineTo(ux * r, uy * r); else s.moveTo(ux * r, uy * r);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false });
  g.translate(0, R, -h / 2);
  return g;
}
const plate = (g) => mesh(g, 'plate', () => cyl(0.078, 0.055, 0.012, 16), 0xFFFAF2, 0, 0.006, 0);
const crumbs = (g, col) => { const c = new THREE.Group(); for (const [x, z] of [[0.02, 0.01], [-0.025, -0.015], [0.005, -0.03]]) mesh(c, 'crumb', () => cyl(0.007, 0.007, 0.004, 6), col, x, 0.014, z); g.add(c); return c; };
// 컵에 든 음료. 음료 높이가 남은 양(k)을 따라 내려간다. 돌려주는 것: 높이를 맞추는 함수(음료 윗면의 y 를 돌려준다)
function cup(g, r, h, col, mat = GLASS) {
  mesh(g, `cup${r}:${h}`, () => new THREE.CylinderGeometry(r, r * 0.86, h, 14, 1, true), mat, 0, h / 2, 0);
  mesh(g, `cupB${r}`, () => cyl(r * 0.86, r * 0.86, 0.006, 14), mat === GLASS ? 0xE4F2F6 : 0xFFFAF2, 0, 0.003, 0);
  const liq = mesh(g, `liq${r}`, () => cyl(r * 0.8, r * 0.8, 1, 14), col);
  return (k) => { const lh = Math.max(0.003, (h - 0.016) * k); liq.scale.y = lh; liq.position.y = 0.006 + lh / 2; return 0.006 + lh; };
}
const straw = (g, x, h, col) => { const m = mesh(g, 'straw' + h, () => cyl(0.004, 0.004, h, 6), col, x, h / 2 + 0.006, 0); m.rotation.z = -0.16; return m; };
// 와인잔(flute = 길쭉한 잔): 받침·다리·볼록한 몸. 술 높이가 남은 양(k)을 따라 내려간다
function wineGlass(g, col, flute) {
  const r = flute ? 0.021 : 0.036, bh = flute ? 0.092 : 0.066, sh = flute ? 0.05 : 0.056, y0 = 0.004 + sh, full = flute ? 0.8 : 0.58;
  mesh(g, 'wgFoot', () => cyl(0.027, 0.029, 0.004, 14), GLASS, 0, 0.002, 0);
  mesh(g, 'wgStem' + sh, () => cyl(0.0045, 0.0045, sh, 6), GLASS, 0, 0.004 + sh / 2, 0);
  const P = flute ? [[0.005, 0], [0.8, 0.22], [1, 0.65], [0.92, 1]] : [[0.005, 0], [0.82, 0.2], [1, 0.5], [0.8, 1]];
  mesh(g, 'wgBowl' + r, () => new THREE.LatheGeometry(P.map(([x, y], i) => new THREE.Vector2(i ? x * r : x, y * bh)), 14), GLASS_2, 0, y0, 0);
  const liq = mesh(g, 'wgLiq' + r, () => { const c = new THREE.CylinderGeometry(r * 0.86, r * 0.3, 1, 14); c.translate(0, 0.5, 0); return c; }, col, 0, y0 + 0.003, 0);
  return (k) => { const lh = bh * full * Math.max(0, Math.min(1, k)); liq.visible = k > 0.01; liq.scale.set(0.45 + 0.55 * Math.min(1, k * 1.6), Math.max(0.002, lh), 0.45 + 0.55 * Math.min(1, k * 1.6)); return y0 + 0.003 + lh; };
}
// 와인병 하나(바닥이 0, 위로 선다). 몸은 한 조각, 병목의 색 띠와 흰 딱지가 붙는다
const bottleGeo = () => geo('bottle', () => new THREE.LatheGeometry([[0, 0], [0.03, 0], [0.031, 0.008], [0.031, 0.118], [0.024, 0.146], [0.0115, 0.168], [0.0115, 0.215], [0, 0.215]].map(([x, y]) => new THREE.Vector2(x, y)), 12));
function makeBottle(f) {
  const g = new THREE.Group();
  mesh(g, 'bottleB', bottleGeo, f.bottle);
  mesh(g, 'bottleF', () => cyl(0.0135, 0.0135, 0.045, 10), f.foil, 0, 0.194, 0);
  mesh(g, 'bottleL', () => new THREE.CylinderGeometry(0.0318, 0.0318, 0.05, 12, 1, true), 0xFFF6E6, 0, 0.07, 0);
  return g;
}
// 세모 조각을 남은 입마다 다른 모양으로 바꿔 끼운다
const swap = (m, key, R, w, h, left, n) => { m.geometry = geo(`${key}${left}`, () => wedgeGeo(R, w, h, left / n)); m.visible = left > 0; };

// 종류마다: 묶음 g 에 모양을 만들고, 남은 입(left)에 맞추는 함수를 돌려준다. 손바닥 위(0, 0, 0)에 얹힌다. 앞(+z)이 몸 바깥쪽이다
const MODEL = {
  cake(g, n) { // 접시 위의 조각 케이크: 뾰족한 끝부터 줄고, 다 먹으면 접시와 부스러기
    plate(g);
    const w = new THREE.Group(); w.position.set(0, 0.012, 0.052); g.add(w);
    const sp = mesh(w, 'cakeS' + n, () => wedgeGeo(0.105, 0.045, 0.044, 1), 0xE8C48A), cr = mesh(w, 'cakeC' + n, () => wedgeGeo(0.105, 0.047, 0.012, 1), 0xFFF6EE, 0, 0.044, 0);
    const berry = mesh(w, 'cone', () => new THREE.ConeGeometry(0.014, 0.026, 8), 0xE23B2E, 0, 0.069, -0.03); berry.rotation.x = Math.PI;
    const cb = crumbs(g, 0xE8C48A);
    return (left) => { swap(sp, 'cakeS', 0.105, 0.045, 0.044, left, n); swap(cr, 'cakeC', 0.105, 0.047, 0.012, left, n); berry.visible = left > 1; cb.visible = left === 0; };
  },
  cookie(g, n) { // 초코칩 쿠키: 베어 문 자국이 하나씩 늘고, 다 먹으면 아무것도 안 남는다
    const B = [[], [[0.9, 0.034], [2.5, 0.036], [-0.5, 0.03]], [[0.9, 0.034]], []], R = 0.055;
    const disc = mesh(g, 'cookie3', () => biteDisc(R, 0.014, B[3]), 0xD79A55, 0, 0.004, 0);
    const chips = [[0.6, 0.03], [2.0, 0.035], [3.4, 0.026], [4.6, 0.036], [5.5, 0.012]].map(([a, r]) => { const m = mesh(g, 'chip', () => ball(0.007, 6, 5), 0x4A2C1A, Math.cos(a) * r, R + 0.004 + Math.sin(a) * r, 0.007); m.userData.at = [Math.cos(a) * r, Math.sin(a) * r]; return m; });
    return (left) => {
      disc.visible = left > 0;
      if (left > 0) disc.geometry = geo('cookie' + left, () => biteDisc(R, 0.014, B[left]));
      for (const c of chips) c.visible = left > 0 && B[left].every(([a, b]) => Math.hypot(c.userData.at[0] - Math.cos(a) * R, c.userData.at[1] - Math.sin(a) * R) > b + 0.006);
    };
  },
  tangerine(g, n) { // 귤: 첫 입은 껍질을 까고, 그다음부터 알맹이가 두 쪽씩 준다. 껍질이 남는다
    const whole = mesh(g, 'tang', () => ball(0.043, 14, 10), 0xF39A2B, 0, 0.038, 0); whole.scale.y = 0.86;
    const leaf = mesh(g, 'leaf', () => ball(0.012, 6, 5), 0x3E9A7E, 0, 0.076, 0); leaf.scale.set(1.5, 0.4, 1.5);
    const peel = mesh(g, 'peel', () => cyl(0.056, 0.05, 0.006, 6), 0xF08A1C, 0, 0.003, 0);
    const segs = [0, 1, 2, 3, 4, 5].map((i) => { const a = (i / 6) * TAU, m = mesh(g, 'seg', () => ball(0.02, 8, 6), 0xFFB347, Math.cos(a) * 0.021, 0.03, Math.sin(a) * 0.021); m.scale.set(0.85, 1.25, 0.85); return m; });
    return (left) => { whole.visible = leaf.visible = left === n; peel.visible = left < n; segs.forEach((m, i) => { m.visible = left < n && i < left * 2; }); };
  },
  berry(g, n) { // 딸기: 반쯤 베어 물고, 꼭지만 남는다
    const body = mesh(g, 'berry', () => { const c = new THREE.ConeGeometry(0.03, 0.06, 10); c.rotateX(Math.PI); c.translate(0, -0.03, 0); return c; }, 0xE23B2E, 0, 0.07, 0);
    const top = mesh(g, 'leaf', () => ball(0.012, 6, 5), 0x3E9A7E, 0, 0.072, 0); top.scale.set(2, 0.5, 2);
    return (left) => { body.visible = left > 0; body.scale.y = left === n ? 1 : 0.5; };
  },
  chicken(g, n) { // 닭다리: 살이 줄어들고 뼈만 남는다
    mesh(g, 'bone', () => cyl(0.007, 0.007, 0.07, 6), 0xFFF6E6, 0, 0.035, 0);
    for (const x of [-0.007, 0.007]) mesh(g, 'knob', () => ball(0.009, 6, 5), 0xFFF6E6, x, 0.004, 0);
    const meat = mesh(g, 'meat', () => ball(0.04, 12, 10), 0xC9792E, 0, 0.09, 0);
    return (left) => { const k = left / n; meat.visible = left > 0; meat.scale.set(0.5 + 0.5 * k, 0.6 + 0.7 * k, 0.5 + 0.5 * k); meat.position.y = 0.06 + 0.035 * k; };
  },
  pizza(g, n) { // 피자 한 조각: 뾰족한 끝부터 베어 물고, 꼬다리(빵 테두리)가 남는다
    const w = new THREE.Group(); w.position.set(0, 0.004, 0.06); w.rotation.x = 0.25; g.add(w);
    const ch = mesh(w, 'pizza' + n, () => wedgeGeo(0.13, 0.055, 0.009, 1), 0xF2C14E);
    mesh(w, 'crust', () => { const c = cyl(0.011, 0.011, 0.12, 8); c.rotateZ(Math.PI / 2); return c; }, 0xC98D4B, 0, 0.007, 0.004);
    const pep = [[0.02, -0.03], [-0.018, -0.05], [0.004, -0.085]].map(([x, z]) => mesh(w, 'pep', () => cyl(0.012, 0.012, 0.003, 8), 0xC0392B, x, 0.0105, z));
    return (left) => { swap(ch, 'pizza', 0.13, 0.055, 0.009, left, n); pep.forEach((m) => { m.visible = -m.position.z < 0.13 * (left / n) - 0.03; }); };
  },
  sandwich(g, n) { // 세모 샌드위치: 빵·채소·햄이 겹쳐 있고 같이 베어진다
    const w = new THREE.Group(); w.position.set(0, 0.004, 0.05); g.add(w);
    const L = [['swB', 0.05, 0.014, 0xF3E3C0, 0], ['swG', 0.054, 0.006, 0x6FBF5B, 0.014], ['swH', 0.051, 0.008, 0xF29B9B, 0.02], ['swB', 0.05, 0.014, 0xF3E3C0, 0.028]].map(([k, ww, h, col, y]) => [mesh(w, k + n, () => wedgeGeo(0.1, ww, h, 1), col, 0, y, 0), k, ww, h]);
    return (left) => { for (const [m, k, ww, h] of L) swap(m, k, 0.1, ww, h, left, n); };
  },
  pudding(g, n) { // 푸딩: 숟가락으로 떠먹은 만큼 낮아지고, 먹을 때 탱글거린다
    plate(g);
    const body = new THREE.Group(); body.position.y = 0.012; g.add(body);
    mesh(body, 'pud', () => { const c = cyl(0.03, 0.044, 0.05, 14); c.translate(0, 0.025, 0); return c; }, 0xF6D36B);
    const top = mesh(body, 'pudT', () => cyl(0.031, 0.031, 0.008, 14), 0x8A4B1E, 0, 0.053, 0);
    const smear = mesh(g, 'pudS', () => cyl(0.03, 0.03, 0.003, 10), 0x8A4B1E, 0, 0.0135, 0);
    g.userData.jig = body;
    return (left) => { const k = left / n; body.visible = left > 0; body.scale.y = 0.35 + 0.65 * k; top.visible = left === n; smear.visible = left === 0; };
  },
  icecream(g, n) { // 콘 아이스크림: 위 덩이, 아래 덩이, 콘 순서로 없어진다
    const cone = mesh(g, 'icone', () => { const c = new THREE.ConeGeometry(0.03, 0.09, 10); c.rotateX(Math.PI); c.translate(0, 0.045, 0); return c; }, 0xD9A566);
    const s1 = mesh(g, 'scoop', () => ball(0.036, 12, 10), 0xFFB7C5, 0, 0.105, 0), s2 = mesh(g, 'scoop', () => ball(0.036, 12, 10), 0xFFF6E6, 0, 0.15, 0); s2.scale.setScalar(0.82);
    return (left) => { s2.visible = left > 3; s1.visible = left > 1; s1.scale.setScalar(left > 2 ? 1 : 0.7); cone.visible = left > 0; cone.scale.y = left > 1 ? 1 : 0.6; };
  },
  choco(g, n) { // 판 초콜릿: 한 줄씩 똑 떼어 먹고 포장지가 남는다
    const wrap = mesh(g, 'wrap', () => new THREE.BoxGeometry(0.056, 0.036, 0.014), 0xB8323A, 0, 0.018, 0);
    const rows = [0, 1, 2].map((i) => mesh(g, 'chocoR', () => new THREE.BoxGeometry(0.05, 0.02, 0.01), 0x5A3824, 0, 0.047 + i * 0.022, 0));
    return (left) => { rows.forEach((m, i) => { m.visible = i < left; }); wrap.scale.set(1, left ? 1 : 0.55, left ? 1 : 1.6); wrap.position.y = left ? 0.018 : 0.01; };
  },
  cocoa(g, n) { // 머그잔 코코아: 마실 때마다 높이가 내려가고 김이 난다. 마시멜로는 첫 모금에 없어진다
    const level = cup(g, 0.04, 0.078, 0x6B3F22, MUG);
    mesh(g, 'handle', () => new THREE.TorusGeometry(0.02, 0.006, 6, 10), 0xC8443A, 0.05, 0.04, 0);
    const mm = [[-0.012, 0.006], [0.012, -0.008]].map(([x, z]) => mesh(g, 'mallow', () => cyl(0.009, 0.009, 0.008, 8), 0xFFFAF2, x, 0, z));
    return (left) => { const y = level(left / n); mm.forEach((m) => { m.visible = left === n; m.position.y = y + 0.003; }); };
  },
  milk(g, n) { const level = cup(g, 0.032, 0.1, 0xFFFFFF); return (left) => level(left / n); }, // 유리잔 우유
  juice(g, n) { // 주스: 빨대와 잔에 꽂은 귤 조각
    const level = cup(g, 0.032, 0.1, 0xF7A531);
    straw(g, 0.01, 0.13, 0xE23B2E);
    const sl = mesh(g, 'slice', () => { const c = cyl(0.022, 0.022, 0.005, 12); c.rotateX(Math.PI / 2); return c; }, 0xFFB347, -0.03, 0.1, 0);
    return (left) => { level(left / n); sl.visible = left > 0; };
  },
  soda(g, n) { // 탄산: 얼음이 음료 위에 떠 있다가 바닥에 남는다. 방울이 올라온다
    const level = cup(g, 0.034, 0.115, 0x5A2E1A);
    straw(g, -0.008, 0.15, 0xFFFFFF);
    const ice = [[0.01, 0.008, 0.3], [-0.012, -0.006, 0.9]].map(([x, z, r]) => { const m = mesh(g, 'ice', () => new THREE.BoxGeometry(0.018, 0.018, 0.018), ICE, x, 0, z); m.rotation.set(r, r * 2, 0); return m; });
    return (left) => { const y = level(left / n); ice.forEach((m, i) => { m.position.y = Math.max(0.016, y - 0.006 - i * 0.004); }); };
  },
  water(g, n) { // 물병: 병 안의 물이 내려가고 빈 병이 남는다
    const level = cup(g, 0.028, 0.105, 0x8FD0F0);
    mesh(g, 'neck', () => cyl(0.012, 0.026, 0.022, 12), GLASS, 0, 0.116, 0);
    mesh(g, 'cap', () => cyl(0.013, 0.013, 0.014, 10), 0x3D7FD9, 0, 0.134, 0);
    return (left) => level(left / n);
  },
};
MODEL.popcorn = (g, n) => { // 팝콘 통: 빨강·하양 띠의 통에 수북한 팝콘이 먹을수록 내려가고, 빈 통이 남는다
  mesh(g, 'pcBucket', () => { const c = new THREE.CylinderGeometry(0.05, 0.036, 0.1, 12, 1, true); c.translate(0, 0.05, 0); return c; }, new THREE.MeshLambertMaterial({ color: 0xC8332B, side: THREE.DoubleSide }));
  mesh(g, 'pcBand', () => new THREE.CylinderGeometry(0.0478, 0.0436, 0.03, 12, 1, true), 0xFFF4E0, 0, 0.065, 0);
  mesh(g, 'pcBase', () => cyl(0.036, 0.036, 0.004, 12), 0xC8332B, 0, 0.002, 0);
  const heap = mesh(g, 'pcHeap', () => ball(0.046, 9, 6), 0xFFE9A8), tops = [[0.018, 0.012], [-0.02, 0.006], [0.002, -0.02], [-0.006, 0.022]].map(([x, z]) => mesh(g, 'pcBit', () => ball(0.016, 6, 5), 0xFFF6D0, x, 0, z));
  return (left) => { const k = left / n, y = 0.03 + 0.07 * k; heap.visible = left > 0; heap.position.y = y; heap.scale.set(0.82 + 0.18 * k, 0.5, 0.82 + 0.18 * k); tops.forEach((m, i) => { m.visible = left > i; m.position.y = y + 0.022; }); };
};
for (const f of WINES) MODEL[f.id] = (g, n) => { const level = wineGlass(g, f.col, f.wine === 'flute'); return (left) => level(left / n); };
// 음식 하나의 모양 { g, set(left) }
function makeFood(kind, left) {
  const f = BY.get(kind), g = new THREE.Group(), set = MODEL[kind](g, f.n);
  set(left);
  return { g, set };
}

/* ───────── 와인 냉장고 (가구 'wine'. 1 × 1, 유리문 안에 병이 눕혀 있다) ─────────
   늘 보이는 것: 몸·안쪽 벽·선반. 닫힌 모양(shut) = 닫힌 유리문 + 병 묶음(그리기 한 번). 열리는 모양은 처음 열 때 만든다(냉장고와 같은 약속: userData.fridge) */
const CELLAR = { H: 1.3, rows: 5, y: (i) => 0.105 + i * 0.225, z: 0.2, s: 0.85 };
const PANE = new THREE.MeshLambertMaterial({ color: 0xBFE3EE, transparent: true, opacity: 0.2, depthWrite: false });
const UNIT = new THREE.BoxGeometry(1, 1, 1), tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler();
const boxes = (list, col) => { // 상자 여러 개를 한 번에 그린다 [[w, h, d, x, y, z]]
  const m = new THREE.InstancedMesh(UNIT, M(col), list.length);
  list.forEach(([w, h, d, x, y, z], i) => m.setMatrixAt(i, tmpM.compose(new THREE.Vector3(x, y, z), tmpQ.identity(), new THREE.Vector3(w, h, d))));
  return m;
};
function cellarDoor(at) { // 유리문 (왼쪽 경첩이 0)
  const H = CELLAR.H, d = new THREE.Group();
  d.add(boxes([[0.04, H - 0.04, 0.07, 0.02, H / 2, 0.005], [0.04, H - 0.04, 0.07, 0.44, H / 2, 0.005], [0.46, 0.05, 0.07, 0.23, 0.045, 0.005], [0.46, 0.05, 0.07, 0.23, H - 0.045, 0.005]], 0x2B2420));
  put(new THREE.BoxGeometry(0.38, H - 0.14, 0.008), PANE, 0.23, H / 2, 0.034, d, false);
  put(cyl(0.01, 0.01, 0.3, 6), 0xC9A45A, 0.425, H * 0.55, 0.05, d, false);
  d.position.set(-0.23, 0, CELLAR.z); at.add(d);
  return d;
}
// 병이 놓이는 자리: 칸마다 한 종류, 둘씩 병목을 마주 보게 눕힌다
const cellarSlots = () => { const out = []; for (let i = 0; i < CELLAR.rows; i++) for (const s of [-1, 1]) out.push({ f: WINES[i % WINES.length], x: 0.185 * s, y: CELLAR.y(i) + 0.006 + 0.031 * CELLAR.s, rz: s < 0 ? -Math.PI / 2 : Math.PI / 2 }); return out; };
addShape('wine', (g) => {
  const H = CELLAR.H;
  put(rbox(0.46, H, 0.4, 0.02), 0x2B2420, 0, H / 2, -0.03, g);
  put(new THREE.PlaneGeometry(0.38, H - 0.14), 0x4A342A, 0, H / 2, 0.172, g, false);
  g.add(boxes(Array.from({ length: CELLAR.rows }, (_, i) => [0.38, 0.012, 0.06, 0, CELLAR.y(i), 0.2]), 0x8A5F3F));
  const shut = new THREE.Group(); g.add(shut);
  cellarDoor(shut);
  const slots = cellarSlots(), rack = new THREE.InstancedMesh(bottleGeo(), M(0xFFFFFF), slots.length), tint = new THREE.Color();
  slots.forEach((p, i) => { rack.setMatrixAt(i, tmpM.compose(new THREE.Vector3(p.x, p.y, CELLAR.z), tmpQ.setFromEuler(tmpE.set(0, 0, p.rz)), new THREE.Vector3(CELLAR.s, CELLAR.s, CELLAR.s))); rack.setColorAt(i, tint.setHex(p.f.bottle)); });
  shut.add(rack);
  let open = null;
  g.userData.fridge = {
    shut, wine: true,
    open() {
      if (open) return open;
      const root = new THREE.Group(), inside = new THREE.Group();
      const glow = put(new THREE.BoxGeometry(0.3, 0.02, 0.03), new THREE.MeshBasicMaterial({ color: 0xFFF1C9 }), 0, H - 0.085, 0.19, root, false); // 안쪽 등
      put(new THREE.PlaneGeometry(0.38, H - 0.14), new THREE.MeshBasicMaterial({ color: 0xFFDFA6, transparent: true, opacity: 0.5, depthWrite: false }), 0, H / 2, 0.174, root, false); // 불빛을 받은 안쪽 벽
      const door = cellarDoor(root);
      for (const p of slots) { const b = makeBottle(p.f); b.scale.setScalar(CELLAR.s); b.rotation.z = p.rz; b.position.set(p.x, p.y, CELLAR.z); b.userData.food = p.f.id; inside.add(b); }
      root.add(inside); root.visible = false; g.add(root);
      return (open = { root, door, inside, glow, stocked: true, spillSize: [0.5, 0.6, 0.56] });
    },
  };
});

/* ───────── 한 입 먹을 때 뜨는 말 (작은 그림 한 장씩, 말마다 하나) ───────── */
const WORDS = new Map();
function wordTex(text) {
  let t = WORDS.get(text);
  if (t) return t;
  const c = document.createElement('canvas'); c.width = 192; c.height = 80;
  const x = c.getContext('2d');
  x.font = '900 44px system-ui, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 9; x.lineJoin = 'round'; x.strokeStyle = '#FFFAF2'; x.strokeText(text, 96, 42);
  x.fillStyle = '#7A4A2B'; x.fillText(text, 96, 42);
  t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  WORDS.set(text, t);
  return t;
}

export function makeFoodPlay(K) {
  const $ = (id) => document.getElementById(id);
  let clock = 0;

  /* ───────── 부스러기·김·방울: 점 한 묶음으로 그린다(그리기 한 번) ───────── */
  const N = 96, pos = new Float32Array(N * 3).fill(-999), col = new Float32Array(N * 3), live = [];
  let nextP = 0;
  const dots = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.beginPath(); x.arc(16, 16, 14, 0, TAU); x.fill();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ size: 5, sizeAttenuation: false, vertexColors: true, map: new THREE.CanvasTexture(c), alphaTest: 0.5, transparent: true, opacity: 0.92 }));
    p.frustumCulled = false; p.visible = false; K.scene.add(p);
    return p;
  })();
  const tint = new THREE.Color();
  function spark(x, y, z, hex, vx, vy, vz, life, grav) {
    const i = nextP; nextP = (nextP + 1) % N;
    const old = live.findIndex((p) => p.i === i); if (old >= 0) live.splice(old, 1);
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    tint.setHex(hex); col[i * 3] = tint.r; col[i * 3 + 1] = tint.g; col[i * 3 + 2] = tint.b;
    live.push({ i, vx, vy, vz, life, grav });
    dots.geometry.attributes.color.needsUpdate = true;
  }
  function tickDots(dt) {
    if (!live.length) { dots.visible = false; return; }
    dots.visible = true;
    for (let k = live.length - 1; k >= 0; k--) {
      const p = live[k], j = p.i * 3;
      p.life -= dt; p.vy -= p.grav * dt;
      if (p.life <= 0) { pos[j + 1] = -999; live.splice(k, 1); continue; }
      pos[j] += p.vx * dt; pos[j + 1] += p.vy * dt; pos[j + 2] += p.vz * dt;
    }
    dots.geometry.attributes.position.needsUpdate = true;
  }

  /* ───────── 손에 든 음식 ───────── */
  // 든 사람(나는 'me', 친구는 그 사람 id) → { who, kind, f, left(남은 입), shown(보이는 입), g, set, pend(한 입이 입에 닿기까지), bt(먹는 몸짓 시간), end(다 먹고 남은 것이 보이는 시간), seen, wait, word, puff }
  const held = new Map();
  const avatarOf = (who) => (who === 'me' ? K.me : K.avatar(who));
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), qt = new THREE.Quaternion(), XAXIS = new THREE.Vector3(1, 0, 0);
  const rnd = (a) => (Math.random() - 0.5) * a;

  function give(who, kind, left) {
    drop(who);
    const f = BY.get(kind), m = makeFood(kind, left);
    const h = { who, kind, f, left, shown: left, g: m.g, set: m.set, pend: null, bt: null, end: null, seen: clock, wait: 0, word: null, wt: 0, puff: 0, drain: null, pour: null, cheer: null, lv: left };
    held.set(who, h);
    K.dirty();
    return h;
  }
  function drop(who) {
    const h = held.get(who);
    if (!h) return false;
    if (h.g.parent) h.g.parent.remove(h.g);
    if (h.word) { K.scene.remove(h.word); h.word.material.dispose(); }
    held.delete(who);
    K.dirty();
    return true;
  }
  // 입 자리 (세상 좌표)
  function mouthOf(a, out) {
    a.parts.head.getWorldPosition(out);
    a.root.getWorldDirection(v2);
    return out.addScaledVector(v2, 0.3).add(v1.set(0, -0.12, 0));
  }
  // 한 입이 입에 닿았다: 모양이 줄고, 부스러기가 날리고, 말이 뜬다
  function land(h, a) {
    const first = h.shown === h.f.n;
    h.pend = null;
    if (h.f.sip) h.drain = { from: h.lv, t: 0 }; // 마시는 것은 꿀꺽꿀꺽 조금씩 내려간다
    h.shown = h.left; if (!h.drain) h.set(h.lv = h.shown);
    sfx(h.kind === 'pizza' && h.shown === 0 ? 'crisp' : first && h.kind === 'tangerine' ? 'peel' : h.f.snd, h.who === 'me' ? null : a);
    if (h.kind === 'soda') sfx('fizz', h.who === 'me' ? null : a, 0.5);
    const m = mouthOf(a, new THREE.Vector3()), fx = a.root.visible ? h.f.fx : null; // 다른 층에 있거나 숨은 사람의 부스러기는 보이지 않는다
    if (typeof fx === 'number') for (let k = 0; k < (h.f.sip ? 3 : 7); k++) spark(m.x + rnd(0.08), m.y + rnd(0.04), m.z + rnd(0.08), fx, rnd(0.5), h.f.sip ? 0 : 0.5 + Math.random() * 0.5, rnd(0.5), 0.7 + Math.random() * 0.3, 3.2);
    if (h.kind === 'pizza' && h.shown > 0 && fx) for (let k = 0; k < 5; k++) spark(m.x, m.y - k * 0.03, m.z, 0xFBE08A, 0, -0.05, 0, 0.5 + k * 0.05, 0.4); // 늘어나는 치즈
    if (h.kind === 'milk') stache(a);
    say(h, a, first && h.f.first ? h.f.first : h.f.say);
    if (h.shown === 0) {
      h.end = 1.7;
      if (h.who === 'me') K.toast(h.f.done);
    }
    K.dirty();
  }
  function say(h, a, text) {
    if (!h.word) { h.word = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false })); h.word.renderOrder = 20; h.word.scale.set(0.96, 0.4, 1); K.scene.add(h.word); }
    h.word.material.map = wordTex(text); h.word.material.needsUpdate = true;
    h.wt = 1; h.said = text;
  }
  // 우유를 마시면 입가에 잠깐 우유가 묻는다
  const marks = [];
  function stache(a) {
    let s = marks.find((x) => x.a === a && x.m.parent === a.parts.head);
    if (!s) { s = { a, m: mesh(a.parts.head, 'stache', () => ball(0.034, 8, 6), 0xFFFFFF, 0, -0.118, 0.238), t: 0 }; s.m.scale.set(1.5, 0.3, 0.4); marks.push(s); }
    s.t = 4.5;
  }

  // 손에 든 것을 팔에 붙이고 늘 바로 서 있게 한다. 먹을 때는 입 쪽으로 기울인다
  function hold(h, a, dt) {
    const arm = a.parts.arms[0];
    if (h.g.parent !== arm) arm.add(h.g);
    h.g.visible = !lying(a); // 누워 있을 때는 보이지 않는다 (좌석에 앉아서는 들고 있다)
    // 그냥 들고 있을 때: 팔을 앞으로 내밀어 든다 (걷는 몸짓 뒤에 덮어쓴다. 먹는 몸짓·케이크·사다리가 먼저다)
    const sipping = h.f.sip && a.acting === 'eat'; // 마시는 몸짓은 여기서 정한다 (냠냠의 오물오물 대신 잔을 들어 기울인다)
    const free = !lying(a) && !a.hop && !a.hold && !a.push && (!a.doing || sipping);
    if (free) { arm.rotation.x = -1.05 + 0.04 * Math.sin(clock * 2 + (h.who.length || 1)); arm.rotation.z = 0.12; arm.scale.y = 1; }
    let tilt = 0;
    if (h.bt !== null) {
      h.bt += dt;
      const t = h.bt, w = Math.max(0, Math.min(1, (t - 0.12) / 0.3, (1.5 - t) / 0.4));
      const e = w * w * (3 - 2 * w);
      tilt = (h.f.sip ? -0.8 : -0.18) * e;
      if (h.f.sip && free) { // 잔을 입으로 올리고, 고개를 젖히며 잔을 더 기울였다가, 내린다
        const u = Math.max(0, Math.min(1, (t - 0.4) / 0.35, (1.35 - t) / 0.3)), back = u * u * (3 - 2 * u);
        arm.rotation.x = -1.05 - 0.92 * e - 0.1 * back; arm.rotation.z = 0.12 + 0.36 * e; arm.scale.y = 1 + 0.06 * e;
        a.parts.head.rotation.x = -0.26 * back + 0.05 * (e - back);
        tilt = -0.55 * e - 0.5 * back;
      }
      if (t > 1.6) h.bt = null;
      const j = h.g.userData.jig; if (j) j.scale.x = j.scale.z = 1 + 0.1 * Math.sin(t * 28) * Math.max(0, 1 - t / 1.2); // 푸딩이 탱글거린다
    }
    if (h.cheer !== null) { // 건배: 잔을 앞으로 쭉 내밀어 부딪힌다 (cheers.js)
      h.cheer += dt;
      const t = h.cheer, w = Math.max(0, Math.min(1, t / 0.38, (1.25 - t) / 0.35)), e = w * w * (3 - 2 * w), hit = Math.max(0, 1 - Math.abs(t - 0.45) / 0.12);
      if (!lying(a) && !a.hop && !a.hold) { arm.rotation.x = -1.05 - 0.42 * e + 0.07 * hit; arm.rotation.z = 0.12 - 0.3 * e; arm.scale.y = 1 + 0.42 * e; a.parts.head.rotation.x = -0.08 * e; }
      tilt = 0.22 * e;
      if (t > 1.3) h.cheer = null;
    }
    arm.getWorldQuaternion(q1); a.root.getWorldQuaternion(q2);
    h.g.quaternion.copy(q1.invert()).multiply(q2).multiply(qt.setFromAxisAngle(XAXIS, tilt));
    h.g.position.set(0.012, -0.262, 0.04);
    h.g.scale.set(HAND, HAND / (arm.scale.y || 1), HAND);
  }

  // 와인: 병을 기울여 잔에 따른다. 스파클링은 먼저 코르크가 "뻥" 하고 튄다
  function pourStart(h) {
    const b = makeBottle(h.f), a = avatarOf(h.who), far = h.who === 'me' ? null : a;
    b.scale.setScalar(0.62); b.position.set(0.133, 0.236, 0); b.rotation.z = 1.1;
    const st = mesh(h.g, 'stream', () => { const c = cyl(0.0035, 0.0035, 1, 6); c.translate(0, -0.5, 0); return c; }, h.f.col, 0.012, 0.178, 0); st.visible = false;
    h.g.add(b);
    h.pour = { t: 0, b, st, off: h.f.fx === 'fizz' ? 0.42 : 0, snd: false };
    h.set(h.lv = 0);
    if (h.pour.off) { sfx('cork', far); if (a && a.root.visible) { b.getWorldPosition(v1); for (let k = 0; k < 9; k++) spark(v1.x + rnd(0.05), v1.y + 0.1, v1.z + rnd(0.05), k % 3 ? 0xFFF6DA : 0xE7B441, rnd(0.9), 1.1 + Math.random() * 0.9, rnd(0.9), 0.6 + Math.random() * 0.3, 3.4); } }
  }
  function tickPour(h, a, dt) {
    const p = h.pour, t = (p.t += dt) - p.off;
    const k = Math.max(0, Math.min(1, (t - 0.25) / 0.8)), tip = Math.max(0, Math.min(1, t / 0.25, (1.3 - t) / 0.2));
    if (t > 0 && !p.snd) { p.snd = true; sfx('wine', h.who === 'me' ? null : a); }
    p.b.rotation.z = 1.1 + 0.9 * tip * tip * (3 - 2 * tip);
    const top = h.set(h.lv = h.shown * k) || 0.07;
    p.st.visible = t > 0.25 && t < 1.08; p.st.scale.y = Math.max(0.01, 0.178 - top);
    if (!a.rest && !a.hop && !a.hold) { const o = a.parts.arms[1]; o.rotation.x = -1.5 - 0.25 * tip; o.rotation.z = -0.5; } // 다른 손으로 병을 든다
    if (t >= 1.3) { h.g.remove(p.b); h.g.remove(p.st); h.pour = null; h.set(h.lv = h.shown); }
    K.dirty();
  }

  /* ───────── 냉장고 문 ───────── */
  // 냉장고 id → { who: Map(연 사람 → 마지막으로 들은 때), a(0 닫힘 … 1 열림), g(가구 묶음), o(열리는 모양) }
  const doors = new Map();
  let mine = null; // 내가 연 냉장고 id
  const fridgeOf = (id) => { const it = K.S().items.get(id), g = K.itemObj(id); return it && g && kindOf(it.k).snack && g.userData.fridge ? g : null; };
  // 선반에 음식을 진열한다 (처음 열 때 한 번)
  function stock(o) {
    const [sw, sd, sz] = o.spillSize || [1.0, 0.85, 0.68];
    o.spill = new THREE.Mesh(geo('spill' + sw, () => { const p = new THREE.PlaneGeometry(sw, sd); p.rotateX(-Math.PI / 2); return p; }), new THREE.MeshBasicMaterial({ color: 0xFFF1BF, transparent: true, opacity: 0, depthWrite: false }));
    o.spill.position.set(0, 0.014, sz); o.root.add(o.spill); // 바닥에 비치는 냉장고 불빛
    if (o.stocked) return; // 와인 냉장고는 병을 스스로 채워 둔다
    const ROWS = [0.125, 0.557, 0.957, 1.357], per = [4, 4, 4, 3];
    let i = 0;
    [...PANTRY].reverse().forEach((f) => { // 음료가 아래 칸, 먹을 것이 위 칸
      let row = 0, n = i; while (n >= per[row]) { n -= per[row]; row++; }
      const m = makeFood(f.id, f.n);
      m.g.scale.setScalar(1.3); m.g.position.set((n - (per[row] - 1) / 2) * 0.205, ROWS[row], 0.02); m.g.userData.food = f.id;
      o.inside.add(m.g); i++;
    });
  }
  function swing(id, who, open) {
    let d = doors.get(id);
    const snd = (n) => { const g = fridgeOf(id); if (g) sfx((g.userData.fridge.wine ? 'cellar' : 'fridge') + n, who === 'me' ? null : g); };
    if (!open) { if (d && d.who.delete(who) && !d.who.size) snd('Shut'); return; }
    const g = fridgeOf(id);
    if (!g) return;
    if (!d) { d = { who: new Map(), a: 0, g, o: null }; doors.set(id, d); }
    if (!d.who.size) snd('Open');
    d.who.set(who, clock);
  }
  function tickDoors(dt) {
    for (const [id, d] of doors) {
      const g = fridgeOf(id);
      if (g !== d.g) { // 냉장고를 치웠다
        if (d.o) { d.o.root.visible = false; d.g.userData.fridge.shut.visible = true; }
        doors.delete(id); if (mine === id) shut(); K.dirty(); continue;
      }
      for (const [w, t] of d.who) if (w !== 'me' && (clock - t > 12 || !K.avatar(w))) d.who.delete(w); // 소식이 끊긴 사람
      const goal = d.who.size ? 1 : 0;
      if (d.a === goal && goal === 1) continue;
      if (!d.o) { d.o = g.userData.fridge.open(); if (!d.o.spill) stock(d.o); }
      d.a = goal ? Math.min(1, d.a + dt * 2.6) : Math.max(0, d.a - dt * 3.2);
      const e = d.a * d.a * (3 - 2 * d.a);
      d.o.door.rotation.y = -2.0 * e;
      d.o.spill.material.opacity = 0.3 * e;
      d.o.root.visible = d.a > 0; g.userData.fridge.shut.visible = d.a <= 0;
      K.dirty();
      if (d.a <= 0) doors.delete(id);
    }
  }

  /* ───────── 고르는 판 ───────── */
  const style = document.createElement('style');
  style.textContent = `
#fridgeP .fg{display:grid;grid-template-columns:repeat(5,1fr);gap:5px}
#fridgeP .fd{min-width:0;min-height:54px;padding:2px 0;border-radius:12px;border:1.5px solid var(--line);background:#fff;cursor:pointer;font:inherit;
  font-size:11px;font-weight:800;color:var(--choc);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;white-space:nowrap;overflow:hidden}
#fridgeP .fd b{font-size:22px;line-height:1.15}
#fridgeP .fd:active{transform:scale(.95)}
#fridgeP .fd[aria-pressed=true]{border-color:var(--choc);background:#FFF1D6}
#fridgeP .row .btn{flex:1}`;
  document.head.appendChild(style);
  let variant = () => {};
  const panel = document.createElement('div');
  panel.id = 'fridgeP'; panel.className = 'sheet'; panel.hidden = true; panel.setAttribute('aria-label', '냉장고');
  {
    const h = document.createElement('h2'), ttl = document.createTextNode('🧊 냉장고'), s = document.createElement('small'); s.textContent = '꺼낼 것을 골라요'; h.append(ttl, s);
    const list = (id, kinds) => {
      const grid = document.createElement('div'); grid.className = 'fg'; grid.id = id;
      for (const f of kinds) {
        const b = document.createElement('button'), i = document.createElement('b');
        b.type = 'button'; b.className = 'fd'; b.dataset.v = f.id; i.textContent = f.icon; b.append(i, f.name);
        b.addEventListener('click', () => take(f.id));
        grid.appendChild(b);
      }
      return grid;
    };
    const grid = list('fridgeList', PANTRY), wgrid = list('wineList', WINES); wgrid.hidden = true;
    // 어느 냉장고를 열었느냐에 따라 목록을 바꾼다
    variant = (wine) => { grid.hidden = wine; wgrid.hidden = !wine; ttl.data = wine ? '🍷 와인 냉장고' : '🧊 냉장고'; s.textContent = wine ? '잔에 따라요 · 🍇 무알코올' : '꺼낼 것을 골라요'; };
    const row = document.createElement('div'); row.className = 'row';
    const back = document.createElement('button'); back.type = 'button'; back.className = 'btn'; back.id = 'fridgeBack'; back.textContent = '↩️ 도로 넣기';
    back.addEventListener('click', () => { stow(); K.toast('냉장고에 도로 넣었어요'); });
    const close = document.createElement('button'); close.type = 'button'; close.className = 'btn main'; close.id = 'fridgeClose'; close.textContent = '닫기';
    close.addEventListener('click', () => { if (K.mode() === 'fridge') K.setMode(null); });
    row.append(back, close);
    panel.append(h, grid, wgrid, row);
    $('bottom').insertBefore(panel, $('tabs'));
  }
  function paint() {
    const h = held.get('me'), has = !!h && h.shown > 0;
    $('fridgeBack').hidden = !has;
    for (const b of panel.querySelectorAll('.fd')) b.setAttribute('aria-pressed', String(has && b.dataset.v === h.kind));
    K.resized();
  }

  /* ───────── 내가 하는 일 ───────── */
  const tell = (v) => { if (K.online()) K.fx({ k: 'food', v }); };
  // 냉장고 앞으로 가서 연다
  function open(id) {
    if (!fridgeOf(id)) return false;
    K.approach(id, () => { if (K.mode() === null && fridgeOf(id)) openNow(id); });
    return true;
  }
  function openNow(id) {
    if (!fridgeOf(id)) return false;
    if (K.mode() !== null) K.setMode(null);
    K.setMode('fridge');
    if (K.mode() !== 'fridge') return false;
    mine = id; sentDoor = clock;
    variant(!!fridgeOf(id).userData.fridge.wine);
    swing(id, 'me', true); tell('o:' + id);
    paint();
    return true;
  }
  function shut() {
    if (!mine) return;
    const id = mine; mine = null;
    swing(id, 'me', false); tell('c:' + id);
    if (K.mode() === 'fridge') K.setMode(null);
  }
  // 하나 꺼내 든다 (들고 있던 것은 도로 넣는다)
  function take(kind) {
    const f = BY.get(kind);
    if (!f) return false;
    if (K.busy()) { K.toast('케이크를 내려놓고 꺼내요'); return false; }
    const h = give('me', kind, f.n); sentHold = clock;
    if (f.wine) { pourStart(h); h.wait = h.pour.off + 1.25; } else sfx('pop');
    tell(`h:${kind}:${f.n}${f.wine ? ':p' : ''}`);
    shut();
    K.toast(f.wine ? `${f.icon} ${f.name}${f.id === 'grape' ? '를' : '을'} 잔에 따랐어요! 마시기 단추${matchMedia('(pointer: fine)').matches ? '나 스페이스바' : ''}를 눌러요` : `${f.icon} ${f.name} 꺼냈어요! ${f.sip ? '마시기' : '먹기'} 단추${matchMedia('(pointer: fine)').matches ? '나 스페이스바' : ''}를 눌러요`);
    return true;
  }
  function stow() {
    if (!drop('me')) return false;
    tell('x'); paint();
    return true;
  }
  // 한 입 먹는다 (한 모금 마신다)
  function bite() {
    const h = held.get('me');
    if (!h || h.left <= 0 || h.wait > 0 || h.pour) return false;
    if (lying(K.me) || !K.act('eat')) return false;
    h.left--; h.wait = 1.0; h.pend = 0; h.bt = 0; sentHold = clock;
    tell(`h:${h.kind}:${h.left}`);
    return true;
  }
  let sentDoor = 0, sentHold = 0;

  /* ───────── 친구에게서 온 소식 ───────── */
  function peerFx(m, who) {
    const v = m && m.v;
    if (typeof v !== 'string' || v.length > 40 || !K.avatar(who)) return false;
    if (v === 'x') { drop(who); return true; }
    const [t, a, b, c] = v.split(':');
    if (t === 'o' || t === 'c') {
      if (!ID_RE.test(a || '') || b !== undefined || !fridgeOf(a)) return false;
      swing(a, who, t === 'o');
      return true;
    }
    if (t !== 'h') return false;
    const f = BY.get(a), left = Number(b);
    if (!f || !/^\d$/.test(b || '') || left > f.n) return false;
    const h = held.get(who);
    if (!h || h.kind !== a || left > h.left) { if (left > 0) { const n = give(who, a, left); if (c === 'p' && f.wine && left === f.n) pourStart(n); } else if (h) drop(who); return true; }
    h.seen = clock;
    if (left < h.left) { h.left = left; h.pend = 0; h.bt = 0; } // 한 입 먹었다
    return true;
  }

  function tick(dt) {
    clock += dt;
    // 냉장고: 판을 닫았거나 멀어졌으면 문을 닫는다
    if (mine) {
      const g = fridgeOf(mine);
      if (K.mode() !== 'fridge') shut();
      else if (!g || g.getWorldPosition(v1).distanceTo(K.me.root.position) > 2.2) shut();
      else if (clock - sentDoor > 4) { sentDoor = clock; tell('o:' + mine); }
    }
    tickDoors(dt);
    for (const [who, h] of held) {
      const a = avatarOf(who);
      if (!a || !a.parts) { drop(who); continue; }
      if (who !== 'me' && clock - h.seen > 14 && h.end === null) { drop(who); continue; } // 소식이 끊겼다
      if (who === 'me') {
        if (a.hold) { stow(); continue; } // 케이크를 들면 음식은 내려놓는다
        if (h.end === null && clock - sentHold > 4) { sentHold = clock; tell(`h:${h.kind}:${h.left}`); }
      }
      h.wait = Math.max(0, h.wait - dt);
      hold(h, a, dt);
      if (h.pour) tickPour(h, a, dt);
      if (h.pend !== null && (h.pend += dt) >= 0.45) land(h, a);
      if (h.drain) { const k = Math.min(1, (h.drain.t += dt) / 0.5); h.set(h.lv = h.drain.from + (h.shown - h.drain.from) * k); if (k >= 1) h.drain = null; K.dirty(); }
      // 김과 탄산 방울은 들고 있는 동안 계속 난다
      if (h.shown > 0 && !h.pour && (h.f.fx === 'steam' || h.f.fx === 'fizz') && h.g.visible && a.root.visible && (h.puff -= dt) <= 0) {
        const steam = h.f.fx === 'steam';
        h.puff = steam ? 0.28 : 0.16;
        h.g.getWorldPosition(v1);
        if (steam) spark(v1.x + rnd(0.03), v1.y + 0.12, v1.z + rnd(0.03), 0xFFFFFF, rnd(0.05), 0.2, rnd(0.05), 0.9, -0.05);
        else spark(v1.x + rnd(0.04), v1.y + 0.14, v1.z + rnd(0.04), 0xFFF3D6, rnd(0.15), 0.35, rnd(0.15), 0.35, 1.2);
      }
      if (h.wt > 0) { // 뜨는 말: 머리 위로 떠오르며 흐려진다
        h.wt = Math.max(0, h.wt - dt / 0.95);
        a.parts.head.getWorldPosition(v1);
        h.word.position.set(v1.x, v1.y + 0.58 + (1 - h.wt) * 0.28, v1.z);
        h.word.material.opacity = Math.min(1, h.wt * 2.2);
        h.word.visible = h.wt > 0 && a.root.visible;
      }
      if (h.end !== null && (h.end -= dt) <= 0) { if (h.f.sip) sfx(h.f.wine ? 'glassDown' : 'cupDown', who === 'me' ? null : a); drop(who); if (who === 'me') paint(); }
    }
    for (let k = marks.length - 1; k >= 0; k--) { const s = marks[k]; if ((s.t -= dt) <= 0 || s.m.parent !== s.a.parts.head) { if (s.m.parent) s.m.parent.remove(s.m); marks.splice(k, 1); K.dirty(); } }
    tickDots(dt);
  }

  const rc = new THREE.Raycaster();
  return {
    tick, peerFx, open, bite, stow, take, // take(kind): 손에 든다 (피자 조각은 pizza.js 가 부른다)
    label: '🧊 냉장고 열기',
    labelOf: (k) => (k === 'wine' ? '🍷 와인 냉장고 열기' : '🧊 냉장고 열기'),
    // 건배(cheers.js)가 쓰는 것: 그 사람이 든 마실 것(없으면 null), 잔 내밀기, 잔의 자리, 반짝이
    drink(who) { const h = held.get(who), a = h && avatarOf(who); return h && a && h.f.sip && h.left > 0 && h.end === null && !h.pour && !a.rest && h.g.visible ? { kind: h.kind, name: h.f.name, icon: h.f.icon } : null; },
    clink(who) { const h = held.get(who); if (h) h.cheer = 0; },
    glassAt(who, out) { const h = held.get(who); if (!h) return null; h.g.getWorldPosition(out); out.y += 0.2; return out; },
    spark,
    // 들고 있는 것이 있으면 먹기가 먼저다 (app.js 의 nearAction)
    action() {
      const h = held.get('me');
      if (!h || lying(K.me)) return null;
      if (h.left <= 0) return { label: `${h.f.icon} 잘 ${h.f.sip ? '마셨어요' : '먹었어요'}`, run() {} }; // 빈 그릇이 남아 있는 동안에는 다른 일이 잘못 눌리지 않게
      return { label: `${h.f.icon} ${h.f.name} ${h.f.sip ? '마시기' : '먹기'} ${'●'.repeat(h.left)}${'○'.repeat(h.f.n - h.left)}`, run: bite };
    },
    // 열린 냉장고 안의 음식을 직접 누른다
    tap(px, py) {
      const d = mine && doors.get(mine);
      if (!d || !d.o) return false;
      rc.ray.copy(K.ray(px, py));
      const hit = rc.intersectObjects(d.o.inside.children, true)[0];
      if (!hit) return false;
      let o = hit.object; while (o && !o.userData.food) o = o.parent;
      return !!o && take(o.userData.food);
    },
    test: {
      kinds: PANTRY.map((f) => ({ id: f.id, n: f.n, sip: !!f.sip })),
      wines: WINES.map((f) => ({ id: f.id, n: f.n, glass: f.wine, name: f.name })),
      // 와인: 따르는 중인지, 잔 속 높이(0~남은 입), 든 팔과 머리의 각도, 건배 중인지
      get glass() { const h = held.get('me'); return h ? { pouring: !!h.pour, level: h.lv, armX: K.me.parts.arms[0].rotation.x, headX: K.me.parts.head.rotation.x, cheer: h.cheer !== null, bottle: !!(h.pour && h.pour.b.parent) } : null; },
      glassOf(who) { const h = held.get(who), a = K.avatar(who); return h && a ? { pouring: !!h.pour, level: h.lv, armX: a.parts.arms[0].rotation.x, cheer: h.cheer !== null } : null; },
      get holding() { const h = held.get('me'); return h ? { kind: h.kind, left: h.left, shown: h.shown, said: h.said || '', ending: h.end !== null, ready: h.wait <= 0 && h.pend === null } : null; },
      get others() { return [...held].filter(([w]) => w !== 'me').map(([who, h]) => ({ who, kind: h.kind, left: h.left, shown: h.shown, said: h.said || '', ending: h.end !== null, onArm: h.g.parent === (K.avatar(who) && K.avatar(who).parts.arms[0]) })); },
      get doors() { return [...doors].map(([id, d]) => ({ id, a: d.a, who: [...d.who.keys()], angle: d.o ? d.o.door.rotation.y : 0, shelf: d.o ? d.o.inside.children.length : 0, lit: d.o ? d.o.spill.material.opacity : 0 })); },
      get open() { return mine; }, get sparks() { return live.length; },
      get stache() { return marks.length; },
      // 손에 든 모양에서 지금 보이는 조각 수, 화면에서 손에 든 것의 자리(세상 좌표)
      get shape() { const h = held.get('me'); if (!h) return null; let n = 0, sig = ''; h.g.traverse((o) => { if (o.isMesh && o.visible && o.parent.visible) { n++; sig += `${o.geometry.uuid.slice(0, 4)}${(o.scale.y * o.parent.scale.y).toFixed(2)}${o.position.y.toFixed(3)}|`; } }); const p = h.g.getWorldPosition(new THREE.Vector3()); return { n, sig, y: p.y, up: new THREE.Vector3(0, 1, 0).applyQuaternion(h.g.getWorldQuaternion(new THREE.Quaternion())).y }; },
      shelfPoint(kind) { const d = mine && doors.get(mine); const o = d && d.o && d.o.inside.children.find((c) => c.userData.food === kind); return o ? o.getWorldPosition(new THREE.Vector3()).toArray() : null; },
      meshes(id) { const g = K.itemObj(id); let n = 0; if (g) g.traverseVisible((o) => { if (o.isMesh) n++; }); return n; }, // 그 가구를 그리는 조각 수 (보이는 것만)
      take, openNow, peerFx, bite, stow,
    },
  };
}
