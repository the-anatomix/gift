// 의상: 옷(전신), 색, 소품(모자·목·안경·등)의 목록과 모양, 그리고 고르는 판.
// 생김새(look)에 들어가는 값: outfit(옷), tint(색), hat, neck, eye, back(소품). 빈 글자 '' 는 "없음/기본"이다.
// avatar.js 의 build 가 suitOf(색과 큰 모양)와 dressUp(꾸밈과 소품)을 부른다. 새 옷을 더하려면 OUTFITS 에 한 줄, SUITS 에 색, EXTRA 에 꾸밈.
import { THREE, M, put, ball, cyl, rbox } from './kit.js';

export const HOST_OUTFIT = 'jet'; // 방장만 입을 수 있는 비행 슈트 (fly.js)
export const OUTFITS = [
  { id: 'basic', name: '평상복' }, { id: 'santa', name: '🎅 산타' }, { id: 'rudolph', name: '🦌 루돌프' },
  { id: 'snowman', name: '⛄ 눈사람' }, { id: 'elf', name: '🧝 엘프' }, { id: 'penguin', name: '🐧 펭귄' }, { id: 'bear', name: '🐻 곰 잠옷' },
  { id: 'hanbok', name: '🎎 한복' }, { id: 'suit', name: '🤵 정장' }, { id: 'hoodie', name: '🧥 후드티' }, { id: 'padding', name: '🧣 패딩' },
  { id: HOST_OUTFIT, name: '🚀 비행 슈트' },
];
// 색: 옷의 바탕색(평상복 윗옷, 엘프, 곰 잠옷, 한복 저고리, 정장, 후드티, 패딩)과 털모자·야구모자·목도리·가방·망토의 색을 바꾼다
export const TINTS = [
  { id: '', name: '기본 색', hex: null }, { id: 'red', name: '빨강', hex: 0xD9483B }, { id: 'orange', name: '주황', hex: 0xF08A3C }, { id: 'yellow', name: '노랑', hex: 0xF2C94C },
  { id: 'green', name: '초록', hex: 0x4FA36B }, { id: 'blue', name: '파랑', hex: 0x4F7FD0 }, { id: 'purple', name: '보라', hex: 0x8C6BC8 }, { id: 'pink', name: '분홍', hex: 0xF08DB0 },
  { id: 'white', name: '하양', hex: 0xF4F1EA }, { id: 'black', name: '검정', hex: 0x3A3A44 },
];
const NONE = { id: '', name: '없음', icon: '🚫' };
export const HATS = [NONE, { id: 'beanie', name: '털모자', icon: '🧶' }, { id: 'cap', name: '야구모자', icon: '🧢' }, { id: 'party', name: '고깔', icon: '🥳' },
  { id: 'ribbon', name: '리본', icon: '🎀' }, { id: 'crown', name: '왕관', icon: '👑' }, { id: 'muff', name: '귀마개', icon: '🎧' }];
export const NECKS = [NONE, { id: 'scarf', name: '목도리', icon: '🧣' }, { id: 'bow', name: '나비넥타이', icon: '🎗️' }, { id: 'bell', name: '방울', icon: '🔔' }];
export const EYES = [NONE, { id: 'round', name: '안경', icon: '👓' }, { id: 'sun', name: '선글라스', icon: '🕶️' }];
export const BACKS = [NONE, { id: 'pack', name: '가방', icon: '🎒' }, { id: 'wing', name: '날개', icon: '🪽' }, { id: 'cape', name: '망토', icon: '🦸' }];
const SLOTS = { tint: TINTS, hat: HATS, neck: NECKS, eye: EYES, back: BACKS };

// 저장된 값이나 상대가 보낸 값에서 색과 소품만 골라 아는 값으로 맞춘다
export function cleanExtra(v) {
  const o = {};
  for (const k in SLOTS) o[k] = v && typeof v[k] === 'string' && SLOTS[k].some((x) => x.id === v[k]) ? v[k] : '';
  return o;
}

const C = {
  skin: 0xF8D9BC, white: 0xFFFFFF, cream: 0xF3E2C3, fur: 0xFFF8EA, black: 0x2B2420, gold: 0xE7B441, red: 0xD23A30, orange: 0xF2A23A,
  jet: 0xC2261F, jetDark: 0x8E1A16, jetGold: 0xE2B33C,
};
const GLOW = new THREE.MeshBasicMaterial({ color: 0xBFF4FF });
const FLAME = new THREE.MeshBasicMaterial({ color: 0xFFC65A, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
const HALO = new THREE.MeshBasicMaterial({ color: 0x8FE4FF, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending });
const LENS = new THREE.MeshBasicMaterial({ color: 0x23262E });
const tintOf = (L, d) => { const t = TINTS.find((x) => x.id === L.tint); return t && t.hex != null ? t.hex : d; };
const shade = (hex, k) => ((Math.round(((hex >> 16) & 255) * k) << 16) | (Math.round(((hex >> 8) & 255) * k) << 8) | Math.round((hex & 255) * k));

// 옷의 색과 큰 모양. 없는 값은 avatar.js 의 기본(성별에 따른 평상복)을 쓴다.
// top·bottom·leg·shoe·hand = 색, skirt = 치마인지, hood = 머리를 덮는 후드의 색, bald = 머리카락을 안 만든다, skin = 얼굴색,
// nose = 얼굴 가운데에 코가 붙는다(입을 조금 내린다), head = 머리에 쓰는 것이 달려 있다(모자 소품을 못 쓴다), mask = 얼굴을 가린다(안경을 못 쓴다)
const SUITS = {
  basic: (L) => (L.tint ? { top: tintOf(L) } : null),
  snowman: () => ({ top: C.white, bottom: C.white, skirt: false, leg: C.white, shoe: 0x3A3A44, hand: C.red, hood: C.white, bald: true, skin: 0xFDFDFB, nose: true, head: true }),
  elf: (L, f) => { const t = tintOf(L, 0x2F8F4E); return { top: t, bottom: t, skirt: f, leg: f ? C.fur : C.red, shoe: 0x8C2F2A, head: true }; },
  penguin: () => ({ top: 0x2E3A4C, bottom: 0x2E3A4C, skirt: false, leg: 0x2E3A4C, shoe: C.orange, hand: 0x2E3A4C, hood: 0x2E3A4C, head: true }),
  bear: (L) => { const t = tintOf(L, 0xB98452); return { top: t, bottom: t, skirt: false, leg: t, shoe: shade(t, 0.7), hand: t, hood: t, head: true }; },
  hanbok: (L, f) => (f ? { top: tintOf(L, 0xF7E3A1), bottom: 0xD9455A, skirt: true, leg: 0xD9455A, shoe: C.fur }
    : { top: tintOf(L, 0x6FA5C9), bottom: 0xECE6D8, skirt: false, leg: 0xECE6D8, shoe: C.black }),
  suit: (L, f) => { const t = tintOf(L, 0x2F3A52); return { top: t, bottom: t, skirt: f, leg: f ? C.skin : t, shoe: 0x1E1E24 }; },
  hoodie: (L) => ({ top: tintOf(L, 0x8E9BD6), bottom: 0x4A6FA5, skirt: false, leg: 0x4A6FA5, shoe: 0xF4F1EA }),
  padding: (L) => ({ top: tintOf(L, 0xF08A3C), bottom: 0x3A3F4A, skirt: false, leg: 0x3A3F4A, shoe: 0x5A3824 }),
  jet: () => ({ top: C.jet, bottom: C.jet, skirt: false, leg: C.jet, shoe: C.jetDark, hand: C.jetGold, bald: true, head: true, mask: true }),
};
export function suitOf(L) { const f = SUITS[L.outfit]; return f ? f(L, L.gender === 'f') : null; }
const headgear = (L) => L.outfit === 'santa' || L.outfit === 'rudolph' || !!(suitOf(L) || {}).head;
const masked = (L) => !!(suitOf(L) || {}).mask;
// 그 옷에서 그 소품을 쓸 수 있는지 (모자가 달린 옷에는 모자를, 얼굴을 가리는 옷에는 안경을 못 쓴다)
export const canWear = (L, slot) => (slot === 'hat' ? !headgear(L) : slot === 'eye' ? !masked(L) : slot === 'back' || slot === 'neck' ? L.outfit !== HOST_OUTFIT : true);

const torus = (r, tube, seg = 18) => new THREE.TorusGeometry(r, tube, 8, seg);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const flat = (m, sx, sy, sz) => { m.scale.set(sx, sy, sz); return m; };
const ring = (geo, col, y, parent, sx = 1.08, sz = 0.92) => { const m = put(geo, col, 0, y, 0, parent); m.rotation.x = Math.PI / 2; m.scale.set(sx, sz, 1); return m; };

// 옷마다 더 붙는 꾸밈. p = { body, legs, arms, head }, c = { top, bottom }(지금 옷의 색)
const EXTRA = {
  snowman({ body, head }) {
    flat(put(ball(0.21, 16, 12), C.white, 0, 0.4, 0, body), 1, 0.95, 0.95);                                 // 둥근 몸
    for (const y of [0.5, 0.42, 0.34]) put(ball(0.022, 8, 6), C.black, 0, y, 0.2 - Math.abs(y - 0.42) * 0.35, body, false); // 단추
    put(cyl(0, 0.032, 0.13, 8), C.orange, 0, -0.065, 0.32, head).rotation.x = Math.PI / 2;                 // 당근 코
    const hat = new THREE.Group(); hat.rotation.x = -0.16; head.add(hat);
    put(cyl(0.2, 0.2, 0.022, 18), C.black, 0, 0.268, 0, hat); put(cyl(0.125, 0.135, 0.17, 16), C.black, 0, 0.36, 0, hat);
    put(cyl(0.138, 0.138, 0.035, 16), C.red, 0, 0.3, 0, hat, false);
  },
  elf({ body, head }, c) {
    put(cyl(0.1, 0.2, 0.07, 8), M(C.red, true), 0, 0.615, 0, body);                                          // 뾰족한 깃
    flat(put(cyl(0.176, 0.176, 0.04, 16), C.black, 0, 0.38, 0, body), 1.08, 1, 0.92);
    put(box(0.07, 0.058, 0.02), C.gold, 0, 0.38, 0.165, body, false);
    const hat = new THREE.Group(); hat.rotation.x = -0.2; head.add(hat);
    put(cyl(0.02, 0.255, 0.34, 14), c.top, 0, 0.36, 0, hat);
    ring(torus(0.25, 0.03), C.red, 0.2, hat, 1.04, 1);
    put(ball(0.04, 10, 8), C.gold, 0, 0.54, 0, hat);
    for (const s of [-1, 1]) put(cyl(0, 0.045, 0.14, 6), C.skin, 0.31 * s, 0.03, 0, head).rotation.z = -1.2 * s; // 뾰족한 귀
  },
  penguin({ body, head }) {
    flat(put(ball(0.13, 14, 10), C.white, 0, 0.43, 0.09, body, false), 1.05, 1.3, 0.6);
    put(cyl(0, 0.05, 0.1, 8), C.orange, 0, 0.19, 0.3, head).rotation.x = Math.PI / 2;                       // 부리
    for (const s of [-1, 1]) put(ball(0.03, 8, 6), C.white, 0.1 * s, 0.25, 0.235, head, false).scale.z = 0.5;
  },
  bear({ body, head }, c) {
    flat(put(ball(0.125, 14, 10), C.cream, 0, 0.43, 0.095, body, false), 1, 1.25, 0.6);
    put(ball(0.055, 10, 8), c.top, 0, 0.33, -0.16, body);
    for (const s of [-1, 1]) {
      flat(put(ball(0.08, 10, 8), c.top, 0.2 * s, 0.27, -0.03, head), 1, 1, 0.6);
      flat(put(ball(0.045, 8, 6), C.cream, 0.2 * s, 0.27, 0.005, head, false), 1, 1, 0.5);
    }
  },
  hanbok({ body }, c, L) {
    if (L.gender === 'f') flat(put(cyl(0.17, 0.3, 0.32, 16), c.bottom, 0, 0.245, 0, body), 1, 1, 0.92); // 긴 치마
    else flat(put(cyl(0.17, 0.2, 0.2, 14), shade(c.top, 0.72), 0, 0.42, 0, body), 1.1, 1, 0.95);         // 배자(조끼)
    for (const s of [-1, 1]) put(box(0.034, 0.2, 0.02), C.white, 0.045 * s, 0.545, L.gender === 'f' ? 0.15 : 0.166, body, false).rotation.z = 0.5 * s; // 동정
    const z = L.gender === 'f' ? 0.166 : 0.19;
    put(box(0.03, 0.2, 0.014), C.red, 0.05, 0.4, z, body, false).rotation.z = 0.14;                         // 고름
    put(box(0.03, 0.13, 0.014), C.red, 0.09, 0.43, z, body, false).rotation.z = 0.5;
  },
  suit({ body }, c) {
    put(box(0.085, 0.2, 0.02), C.white, 0, 0.51, 0.146, body, false);                                       // 셔츠
    put(box(0.034, 0.16, 0.02), C.red, 0, 0.5, 0.156, body, false);                                         // 넥타이
    put(cyl(0.115, 0.14, 0.045, 14), C.white, 0, 0.635, 0, body);
    for (const s of [-1, 1]) put(box(0.05, 0.17, 0.016), shade(c.top, 0.6), 0.066 * s, 0.53, 0.153, body, false).rotation.z = -0.32 * s; // 깃
  },
  hoodie({ body }, c) {
    flat(put(ball(0.14, 12, 10), c.top, 0, 0.63, -0.13, body), 1.2, 0.8, 0.8);                              // 뒤로 젖힌 모자
    put(rbox(0.2, 0.085, 0.03, 0.012), shade(c.top, 0.82), 0, 0.37, 0.152, body, false);                    // 앞주머니
    for (const s of [-1, 1]) put(cyl(0.008, 0.008, 0.1, 6), C.white, 0.04 * s, 0.55, 0.16, body, false);
  },
  padding({ body, arms }, c) {
    for (const y of [0.35, 0.445, 0.54]) ring(torus(0.14, 0.058), c.top, y, body);                          // 올록볼록한 몸
    put(cyl(0.12, 0.15, 0.085, 14), shade(c.top, 0.85), 0, 0.64, 0, body);
    for (const a of arms) flat(put(ball(0.068, 10, 8), c.top, 0, -0.09, 0, a), 1, 1.45, 1);
  },
  // 방장의 비행 슈트: 빨강 몸에 금색 마디, 가슴과 손바닥의 둥근 빛, 가로로 긴 눈 빛. 날 때는 손과 발에서 불꽃이 나온다
  jet({ body, legs, arms, head }) {
    flat(put(ball(0.302, 22, 16), C.jet, 0, 0.005, -0.005, head), 1.06, 0.98, 1.02);                        // 헬멧
    flat(put(ball(0.2, 18, 14), 0x2A2F3A, 0, -0.01, 0.17, head, false), 1.12, 0.62, 0.76);                  // 어두운 얼굴 가리개(바이저)
    for (const s2 of [-1, 1]) put(cyl(0.012, 0.05, 0.16, 6), C.jetGold, 0.3 * s2, 0.1, -0.05, head).rotation.set(-0.5, 0, -0.35 * s2); // 옆 지느러미
    for (const s of [-1, 1]) put(box(0.082, 0.02, 0.02), GLOW, 0.085 * s, -0.005, 0.312, head, false).rotation.set(0, 0.28 * s, -0.12 * s); // 눈 빛
    const core = put(cyl(0.046, 0.046, 0.02, 16), GLOW, 0, 0.5, 0.152, body, false); core.rotation.x = Math.PI / 2; // 가슴의 둥근 빛
    put(torus(0.056, 0.013, 16), C.jetGold, 0, 0.5, 0.152, body, false);
    flat(put(cyl(0.174, 0.174, 0.045, 16), C.jetGold, 0, 0.37, 0, body), 1.08, 1, 0.92);
    const jets = [];
    for (const a of arms) {
      put(ball(0.074, 10, 8), C.jetGold, 0, 0.005, 0, a);                                                  // 어깨
      put(ball(0.03, 8, 6), GLOW, 0, -0.262, 0.036, a, false).scale.z = 0.5;                                // 손바닥의 빛
      jets.push(put(cyl(0.042, 0.004, 0.2, 8), FLAME, 0, -0.39, 0, a, false), put(ball(0.085, 8, 6), HALO, 0, -0.31, 0, a, false));
    }
    for (const l of legs) {
      put(cyl(0.079, 0.079, 0.075, 10), C.jetGold, 0, -0.13, 0, l);                                        // 정강이 마디
      jets.push(put(cyl(0.052, 0.004, 0.24, 8), FLAME, 0, -0.4, 0.02, l, false), put(ball(0.1, 8, 6), HALO, 0, -0.31, 0.02, l, false));
    }
    for (const m of jets) m.visible = false;
    return jets;
  },
};

// 소품
const HAT = {
  beanie(g, c) {
    const m = put(new THREE.SphereGeometry(0.305, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.44), c, 0, 0.01, -0.01, g); m.scale.set(1.06, 1, 1.02);
    ring(torus(0.285, 0.036, 20), shade(c, 0.82), 0.075, g, 1.06, 1.02);
    put(ball(0.062, 10, 8), C.fur, 0, 0.335, 0, g);
  },
  cap(g, c) {
    const m = put(new THREE.SphereGeometry(0.3, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), c, 0, 0.02, -0.01, g); m.scale.set(1.06, 1, 1.02);
    flat(put(cyl(0.17, 0.17, 0.018, 16), shade(c, 0.8), 0, 0.11, 0.27, g), 1, 1, 0.85).rotation.x = 0.18;
  },
  party(g) { put(cyl(0.008, 0.115, 0.27, 12), 0xF08DB0, 0, 0.395, 0, g); put(ball(0.034, 8, 6), C.gold, 0, 0.535, 0, g); ring(torus(0.112, 0.016, 14), C.gold, 0.268, g, 1, 1); },
  ribbon(g) {
    for (const s of [-1, 1]) flat(put(ball(0.07, 10, 8), C.red, 0.13 + 0.062 * s, 0.25, 0.07, g), 1, 0.8, 0.45).rotation.z = 0.35 * s;
    put(ball(0.034, 8, 6), 0xA82A24, 0.13, 0.25, 0.085, g, false);
  },
  crown(g) {
    put(cyl(0.135, 0.115, 0.085, 10), M(C.gold, true), 0, 0.305, 0, g);
    for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5; put(cyl(0, 0.03, 0.065, 4), M(C.gold, true), Math.sin(a) * 0.128, 0.375, Math.cos(a) * 0.128, g, false); }
    put(ball(0.02, 8, 6), C.red, 0, 0.305, 0.128, g, false);
  },
  muff(g) {
    const b = put(new THREE.TorusGeometry(0.3, 0.018, 6, 18, Math.PI), 0x8A6A52, 0, 0, 0, g); b.scale.set(1.04, 1.02, 1);
    for (const s of [-1, 1]) flat(put(ball(0.085, 10, 8), C.fur, 0.3 * s, -0.01, 0, g), 0.55, 1, 1);
  },
};
const NECK = {
  scarf(g, c) {
    ring(torus(0.125, 0.05), c, 0.645, g);
    put(rbox(0.075, 0.2, 0.035, 0.015), c, 0.075, 0.54, 0.15, g).rotation.z = 0.12;
  },
  bow(g) {
    for (const s of [-1, 1]) put(cyl(0.012, 0.04, 0.07, 6), C.red, 0.04 * s, 0.6, 0.158, g, false).rotation.z = -Math.PI / 2 * s;
    put(ball(0.02, 8, 6), 0xA82A24, 0, 0.6, 0.162, g, false);
  },
  bell(g) { ring(torus(0.128, 0.016), C.red, 0.625, g); put(ball(0.038, 10, 8), C.gold, 0, 0.59, 0.158, g, false); },
};
const EYE = {
  round(g) {
    for (const s of [-1, 1]) put(torus(0.052, 0.009, 14), C.black, 0.1 * s, -0.015, 0.262, g, false).rotation.y = 0.33 * s;
    put(box(0.07, 0.01, 0.01), C.black, 0, -0.005, 0.276, g, false);
  },
  sun(g) {
    for (const s of [-1, 1]) flat(put(ball(0.062, 12, 8), LENS, 0.1 * s, -0.015, 0.25, g, false), 1.05, 0.8, 0.42).rotation.y = 0.33 * s;
    put(box(0.07, 0.012, 0.012), LENS, 0, -0.002, 0.275, g, false);
  },
};
const BACK = {
  pack(g, c) {
    put(rbox(0.25, 0.27, 0.12, 0.045), c, 0, 0.47, -0.2, g);
    put(rbox(0.17, 0.1, 0.03, 0.012), shade(c, 0.8), 0, 0.42, -0.268, g, false);
    for (const s of [-1, 1]) flat(put(torus(0.1, 0.016, 12), shade(c, 0.7), 0.1 * s, 0.5, -0.02, g, false), 0.5, 1.15, 1).rotation.y = Math.PI / 2;
  },
  wing(g) {
    for (const s of [-1, 1]) {
      const w = new THREE.Group(); w.position.set(0.07 * s, 0.56, -0.16); w.rotation.set(0.1, -0.5 * s, -0.35 * s); g.add(w);
      flat(put(ball(0.15, 12, 8), C.white, 0.14 * s, 0.05, 0, w), 1.25, 0.72, 0.16);
      flat(put(ball(0.12, 12, 8), C.white, 0.11 * s, -0.08, 0, w), 1.05, 0.62, 0.14).rotation.z = 0.5 * s;
    }
  },
  cape(g, c) {
    const m = put(box(0.4, 0.46, 0.018), c, 0, 0.4, -0.2, g); m.rotation.x = 0.16;
    put(cyl(0.13, 0.16, 0.04, 14), c, 0, 0.635, 0, g);
  },
};
const ACC_COL = { beanie: 0xD9483B, cap: 0x4F7FD0, scarf: 0xD23A30, pack: 0x4FA36B, cape: 0xB02F3A };

// 몸에 옷의 꾸밈과 소품을 붙인다. 돌려주는 값 = 날 때만 보이는 불꽃들(비행 슈트일 때만), 없으면 null
export function dressUp(p, L, c) {
  const jets = EXTRA[L.outfit] ? EXTRA[L.outfit](p, c, L) || null : null;
  const acc = (set, id, slot, parent) => { if (id && set[id] && canWear(L, slot)) set[id](parent, tintOf(L, ACC_COL[id] ?? 0)); };
  acc(HAT, L.hat, 'hat', p.head); acc(EYE, L.eye, 'eye', p.head);
  acc(NECK, L.neck, 'neck', p.body); acc(BACK, L.back, 'back', p.body);
  return jets;
}

/* ───────── 고르는 판 (#look 안) ─────────
   K = { $, picks(box, list, cls, onPick), look(), setLook(patch), isHost(), toast(msg), measure() }
   옷 · 색 · 모자 · 목 · 안경 · 등 여섯 갈래를 단추로 바꿔 가며 한 줄 목록에서 고른다(폰에서 판이 높아지지 않게). */
export function makeWardrobe(K) {
  const css = document.createElement('style');
  css.textContent = '#cosTabs{gap:4px}#cosTabs .chip{font-size:12.5px;min-height:44px}'
    + '#look .scroll .chip{flex:none;padding:0 12px;white-space:nowrap}#look .scroll .chip[data-lock="1"]{opacity:.55}'
    + '#look .scroll{min-height:48px;align-items:center}#look .scroll .sw{margin:3px 2px}';
  document.head.appendChild(css);
  const tabs = K.$('cosTabs'), outfitBox = K.$('pickOutfit');
  const TABS = [{ id: 'outfit', name: '옷' }, { id: 'tint', name: '색' }, { id: 'hat', name: '모자' }, { id: 'neck', name: '목' }, { id: 'eye', name: '안경' }, { id: 'back', name: '등' }];
  const hex = (h) => '#' + h.toString(16).padStart(6, '0');
  const boxes = { outfit: outfitBox };
  let tab = 'outfit';
  K.picks(outfitBox, OUTFITS, 'chip', (v) => K.setLook({ outfit: v }));
  let after = outfitBox;
  for (const k in SLOTS) {
    const b = document.createElement('div');
    b.className = 'scroll'; b.id = 'pick' + k[0].toUpperCase() + k.slice(1); b.hidden = true;
    b.setAttribute('role', 'group'); b.setAttribute('aria-label', TABS.find((t) => t.id === k).name);
    after.after(b); after = b; boxes[k] = b;
    const list = k === 'tint' ? TINTS.map((t) => ({ id: t.id, name: t.name, css: t.hex == null ? 'conic-gradient(#F2B544,#4F6FB8,#3E7D5E,#D23A30,#F2B544)' : hex(t.hex) })) : SLOTS[k];
    K.picks(b, list, k === 'tint' ? 'sw' : 'pick', (v) => {
      if (v && k !== 'tint' && !canWear(K.look(), k)) K.toast(k === 'hat' ? '이 옷에는 모자가 달려 있어요. 다른 옷에서 보여요' : '이 옷에서는 가려져요. 다른 옷에서 보여요');
      K.setLook({ [k]: v });
    });
  }
  K.picks(tabs, TABS, 'chip', (v) => { tab = v; paint(); K.measure(); });
  function paint() {
    const L = K.look(), host = K.isHost();
    for (const k in boxes) boxes[k].hidden = k !== tab;
    for (const b of tabs.children) b.setAttribute('aria-pressed', String(b.dataset.v === tab));
    for (const k in boxes) for (const b of boxes[k].children) b.setAttribute('aria-pressed', String(b.dataset.v === (k === 'outfit' ? L.outfit : L[k])));
    const jet = outfitBox.querySelector(`[data-v="${HOST_OUTFIT}"]`); // 방장이 아니면 잠겨 보인다
    jet.hidden = !host; jet.dataset.lock = host ? '' : '1'; jet.setAttribute('aria-label', host ? '비행 슈트' : '비행 슈트 (잠김: 방장만 입을 수 있어요)');
  }
  return {
    paint,
    // 고른 생김새를 지금 입을 수 있는 것으로 맞춘다: 방장이 아니면 비행 슈트를 못 입는다
    allow(L, was) {
      if (L.outfit !== HOST_OUTFIT || K.isHost()) return L;
      K.toast('입을 수 없는 옷이에요');
      return { ...L, outfit: was && was.outfit !== HOST_OUTFIT ? was.outfit : 'basic' };
    },
    get tab() { return tab; }, set tab(v) { if (boxes[v]) { tab = v; paint(); K.measure(); } },
  };
}
