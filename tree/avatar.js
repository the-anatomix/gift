// 치비 아바타. 머리가 큰 2.5등신 사람. 도형만으로 만든다(나중에 모델 파일로 바꿔 끼울 수 있다).
// 고를 수 있는 것: 성별(여자·남자), 옷과 색·소품(costume.js), 표정. 그리고 잠깐 하는 행동(손 흔들기, 춤 …).
import { THREE, M, put, ball, cap, cyl } from './kit.js';
import { OUTFITS, cleanExtra, suitOf, dressUp } from './costume.js';
import { okWords } from './state.js';
import { NOTE } from './catalog.js';
import { toWorld, levelOf, LADDERS, FLOOR_H, X0, Z0, CELL } from './path.js';

export const GENDERS = [{ id: 'f', name: '여자' }, { id: 'm', name: '남자' }];
export { OUTFITS }; // 옷 목록과 색·소품은 costume.js
// 표정: 고르면 바꿀 때까지 그 얼굴로 있다
export const FACES = [
  { id: 'smile', name: '기본', icon: '🙂' }, { id: 'happy', name: '활짝', icon: '😄' }, { id: 'wink', name: '윙크', icon: '😉' },
  { id: 'wow', name: '놀람', icon: '😮' }, { id: 'sad', name: '시무룩', icon: '😢' }, { id: 'angry', name: '뾰로통', icon: '😠' },
];
// 행동: 누르면 sec 초 동안 그 몸짓을 하고 돌아온다. 걸으면 그만둔다
export const ACTS = [
  { id: 'wave', name: '안녕', icon: '👋', sec: 2.4 }, { id: 'cheer', name: '만세', icon: '🙌', sec: 2.2 }, { id: 'clap', name: '박수', icon: '👏', sec: 2.4 },
  { id: 'jump', name: '폴짝', icon: '🐰', sec: 1.3 }, { id: 'dance', name: '춤', icon: '💃', sec: 4.6 }, { id: 'bow', name: '꾸벅', icon: '🙇', sec: 1.8 },
  { id: 'eat', name: '냠냠', icon: '😋', sec: 2.0 },
];
export const DEFAULT_LOOK = { gender: 'f', outfit: 'basic', face: 'smile', ...cleanExtra(null) };
// 저장된 값이나 상대가 보낸 값은 믿지 않고 아는 값만 받는다
export function cleanLook(l) {
  const v = l && typeof l === 'object' ? l : {};
  return {
    gender: GENDERS.some((g) => g.id === v.gender) ? v.gender : DEFAULT_LOOK.gender,
    outfit: OUTFITS.some((o) => o.id === v.outfit) ? v.outfit : DEFAULT_LOOK.outfit,
    face: FACES.some((x) => x.id === v.face) ? v.face : DEFAULT_LOOK.face,
    ...cleanExtra(v), // 색과 소품 (tint, hat, neck, eye, back)
    ...(okWords(v.name, NOTE.name) ? { name: v.name } : {}), // 닉네임 (names.js. 없으면 항목도 없다)
  };
}

const COL = {
  skin: 0xF8D9BC, hairF: 0x6B4630, hairM: 0x3B2A22, shoe: 0x5A3824,
  topF: 0xF2B544, skirtF: 0x3E7D5E, topM: 0x4F6FB8, pantsM: 0x4A3F36,
  red: 0xD23A30, fur: 0xFFF8EA, belt: 0x2B2420, gold: 0xE7B441,
  deer: 0x9A6A43, deerDark: 0x5E3F28, belly: 0xF3E2C3, antler: 0xD9B285, nose: 0xE23B2E,
};
const EYE = new THREE.MeshBasicMaterial({ color: 0x3B2619 });
const CHEEK = new THREE.MeshBasicMaterial({ color: 0xF2998C, transparent: true, opacity: 0.75 });
const MOUTH = new THREE.MeshBasicMaterial({ color: 0x8A3B34 });
const TEAR = new THREE.MeshBasicMaterial({ color: 0x8CCBF2 });

const SIZE = 1.25;   // 방 크기에 맞춘 전체 배율
const SPEED = 2.6;   // 걷는 빠르기 (1초에 가는 거리)
export const FLY_SPEED = 4.2; // 나는 빠르기 (fly.js)
export const BODY_R = 0.18;
export const HEIGHT = 1.16 * SIZE; // 머리끝까지 높이 (모자·뿔 제외)
// 사다리를 오르내리는 길 (세상 좌표). base = 사다리 밑, top = 2층 모서리. 걸리는 시간(초): 다가가기, 오르기, 올라서기
const LAD_T = [0.3, 1.15, 0.3];
const LAD = LADDERS.map((L) => {
  const z = Z0 + (L.foot[1] + 0.5) * CELL, edge = X0 + L.top[0] * CELL;
  return { base: [edge - 0.42, L.lv * FLOOR_H, z], top: [edge - 0.1, (L.lv + 1) * FLOOR_H, z] };
});

// 얼굴(눈, 눈썹, 입)을 머리에 붙인다. 표정마다 모양이 다르다. 돌려주는 값 = 깜빡일 수 있는(뜬) 눈들
const HEAD_R = 0.27;
function buildFace(head, id, deer) {
  // 머리 겉면 위의 자리와, 그 자리에서 겉면을 따라 눕는 기울기
  const on = (m, x, y, lift = 0.004) => {
    const q = 1 - (x / (HEAD_R * 1.06)) ** 2 - (y / (HEAD_R * 0.96)) ** 2, z = HEAD_R * Math.sqrt(Math.max(0.05, q));
    m.position.set(x, y, z + lift); m.rotation.set(-Math.atan2(y, z) * 0.8, Math.atan2(x, z) * 0.8, 0);
    head.add(m); return m;
  };
  const mesh = (geo, mat) => new THREE.Mesh(geo, mat);
  const arc = (r, tube = 0.0085) => new THREE.TorusGeometry(r, tube, 6, 14, Math.PI); // ∩ 모양
  const eyes = [];
  for (const s of [-1, 1]) {
    const x = 0.1 * s;
    if (id === 'happy' || (id === 'wink' && s === 1)) on(mesh(arc(0.033), EYE), x, -0.03);  // 웃느라 감은 눈
    else {
      const big = id === 'wow', e = put(ball(big ? 0.041 : 0.034, 10, 8), EYE, x, -0.015, 0.243, head, false);
      e.scale.set(1, big ? 1.12 : 1.3, 0.5); e.userData.sy = e.scale.y;
      eyes.push(e);
    }
    put(ball(0.045, 10, 8), CHEEK, 0.165 * s, -0.085, 0.2, head, false).scale.set(1.2, 0.7, 0.35);
    if (id === 'sad' || id === 'angry') { // 눈썹: 시무룩하면 안쪽이 올라가고, 뾰로통하면 안쪽이 내려간다
      const b = on(mesh(new THREE.BoxGeometry(0.072, 0.015, 0.012), EYE), x, id === 'sad' ? 0.052 : 0.047, 0.006);
      b.rotation.z = (id === 'sad' ? -0.36 : 0.42) * s;
    }
    if (id === 'wow') on(mesh(new THREE.BoxGeometry(0.06, 0.012, 0.012), EYE), x, 0.062, 0.006); // 놀라서 올라간 눈썹
  }
  if (id === 'sad') on(mesh(ball(0.016, 8, 6), TEAR), 0.118, -0.068, 0.012).scale.set(1, 1.35, 0.6); // 눈물 한 방울
  const my = deer ? -0.152 : -0.108; // 루돌프는 빨간 코 밑에
  if (id === 'happy') on(mesh(new THREE.CircleGeometry(0.046, 14, Math.PI, Math.PI), MOUTH), 0, my + 0.03, 0.007);   // 활짝 벌린 입
  else if (id === 'wow') on(mesh(ball(0.024, 10, 8), MOUTH), 0, my + 0.005, 0.002).scale.set(1, 1.3, 0.4);           // 동그란 입
  else if (id === 'sad' || id === 'angry') on(mesh(arc(id === 'sad' ? 0.03 : 0.024), MOUTH), 0, my - 0.012);         // 처진 입
  else on(mesh(arc(0.034), MOUTH), 0, my + 0.024).rotation.z = Math.PI;                                              // 웃는 입
  return eyes;
}

function build(L) {
  const f = L.gender === 'f', santa = L.outfit === 'santa', deer = L.outfit === 'rudolph';
  const hair = f ? COL.hairF : COL.hairM;
  const sp = suitOf(L) || {}; // 새 옷들의 색과 모양 (costume.js). 산타·루돌프는 아래에서 그대로 만든다
  const top = sp.top ?? (santa ? COL.red : deer ? COL.deer : f ? COL.topF : COL.topM);
  const bottom = sp.bottom ?? (santa ? COL.red : deer ? COL.deer : f ? COL.skirtF : COL.pantsM);
  const skirt = sp.skirt ?? (f && !deer);
  const legCol = sp.leg ?? (skirt ? (santa ? COL.fur : COL.skin) : bottom);
  const shoeCol = sp.shoe ?? (santa ? COL.belt : deer ? COL.deerDark : COL.shoe);
  const handCol = sp.hand ?? (deer ? COL.deerDark : COL.skin);
  const hood = deer ? COL.deer : sp.hood, hooded = hood != null; // 머리에 쓰는 모자(후드)

  const body = new THREE.Group();
  body.scale.setScalar(SIZE);

  // 다리 (엉덩이에서 앞뒤로 흔든다)
  const legs = [-1, 1].map((s) => {
    const hip = new THREE.Group();
    hip.position.set(0.085 * s, 0.27, 0);
    put(cap(0.07, 0.12), legCol, 0, -0.12, 0, hip);
    put(ball(0.085, 10, 8), shoeCol, 0, -0.235, 0.025, hip).scale.set(1, 0.6, 1.35);
    if (santa) put(cyl(0.082, 0.082, 0.04, 12), COL.fur, 0, -0.175, 0, hip); // 장화 털
    body.add(hip);
    return hip;
  });

  // 몸통
  put(cap(0.165, 0.1), top, 0, 0.44, 0, body).scale.set(1.08, 1, 0.92);
  if (skirt) {
    put(cyl(0.185, 0.25, 0.17, 16), bottom, 0, 0.3, 0, body).scale.set(1, 1, 0.92);
    if (santa) put(cyl(0.262, 0.262, 0.045, 16), COL.fur, 0, 0.225, 0, body).scale.set(1, 1, 0.92);
  }
  if (santa) {
    if (!skirt) put(cyl(0.165, 0.165, 0.055, 16), COL.fur, 0, 0.285, 0, body).scale.set(1.08, 1, 0.92); // 옷자락 털
    put(cyl(0.174, 0.174, 0.045, 16), COL.belt, 0, skirt ? 0.39 : 0.37, 0, body).scale.set(1.08, 1, 0.92);
    put(new THREE.BoxGeometry(0.07, 0.058, 0.02), COL.gold, 0, skirt ? 0.39 : 0.37, 0.163, body, false);
    put(new THREE.BoxGeometry(0.045, 0.17, 0.03), COL.fur, 0, 0.5, 0.146, body, false);              // 앞섶
    put(cyl(0.12, 0.145, 0.05, 14), COL.fur, 0, 0.635, 0, body);                                      // 깃
  }
  if (deer) {
    put(ball(0.125, 14, 10), COL.belly, 0, 0.43, 0.095, body, false).scale.set(1, 1.25, 0.6);        // 배
    put(ball(0.05, 10, 8), COL.belly, 0, 0.33, -0.16, body);                                         // 꼬리
  }

  // 팔 (어깨에서 앞뒤로 흔든다)
  const arms = [-1, 1].map((s) => {
    const sh = new THREE.Group();
    sh.position.set(0.19 * s, 0.56, 0);
    sh.rotation.z = 0.28 * s;
    put(cap(0.052, 0.13), top, 0, -0.1, 0, sh);
    put(ball(0.056, 10, 8), handCol, 0, -0.225, 0, sh);
    if (santa) put(cyl(0.062, 0.062, 0.045, 10), COL.fur, 0, -0.175, 0, sh);
    body.add(sh);
    return sh;
  });

  // 머리
  const head = new THREE.Group();
  head.position.set(0, 0.86, 0);
  body.add(head);
  const R = 0.27;
  put(ball(R, 22, 16), sp.skin ?? COL.skin, 0, 0, 0, head).scale.set(1.06, 0.96, 1);
  const eyes = buildFace(head, L.face, deer || !!sp.nose);
  if (deer) put(ball(0.046, 12, 10), COL.nose, 0, -0.072, 0.262, head);

  // 머리카락: 뒤로 기울인 반구. 루돌프는 그 자리에 모자(후드)를 쓴다.
  const hairM = M(hair);
  const cover = put(new THREE.SphereGeometry(R * (hooded ? 1.13 : 1.09), 22, 14, 0, Math.PI * 2, 0, Math.PI * (hooded ? 0.52 : f ? 0.56 : 0.5)),
    hooded ? M(hood) : hairM, 0, 0.005, -0.012, head);
  cover.rotation.x = hooded ? -0.42 : f ? -0.42 : -0.36;
  cover.scale.set(1.06, 1, 1.02);
  // 앞머리
  const bangY = hooded ? 0.105 : f ? 0.175 : santa || sp.head ? 0.13 : 0.2; // 모자 밑으로 살짝 보이게
  if (sp.bald) { /* 머리를 다 덮는 옷(헬멧, 눈사람): 머리카락을 만들지 않는다 */ } else if (f) {
    for (const s of [-1, 0, 1]) put(ball(0.1, 10, 8), hairM, 0.115 * s, bangY - Math.abs(s) * 0.02, 0.19 - Math.abs(s) * 0.03, head).scale.set(1.15, 0.62, 0.7);
    // 단발: 옆머리와 뒷머리
    for (const s of [-1, 1]) put(ball(0.13, 12, 10), hairM, 0.215 * s, -0.09, -0.03, head).scale.set(0.75, 1.5, 1.15);
    put(ball(0.2, 12, 10), hairM, 0, -0.1, -0.14, head).scale.set(1.25, 1.1, 0.8);
  } else if (!hooded) {
    // 짧은 머리: 한쪽으로 넘긴 앞머리 (루돌프 모자 안에서는 가려진다)
    put(ball(0.1, 10, 8), hairM, -0.07, bangY, 0.2, head).scale.set(1.5, 0.5, 0.7);
    put(ball(0.09, 10, 8), hairM, 0.11, bangY - 0.015, 0.185, head).scale.set(1.1, 0.5, 0.7);
  }

  if (santa) {
    // 산타 모자: 흰 테, 빨간 고깔, 끝에 방울
    const hat = new THREE.Group();
    hat.rotation.x = -0.22;
    head.add(hat);
    const brim = put(new THREE.TorusGeometry(0.262, 0.055, 8, 22), COL.fur, 0, 0.15, 0, hat);
    brim.rotation.x = Math.PI / 2; brim.scale.set(1.06, 1.02, 1);
    put(cyl(0.14, 0.262, 0.2, 16), COL.red, 0, 0.27, 0, hat).scale.set(1.06, 1, 1.02);
    put(cyl(0.045, 0.14, 0.24, 12), COL.red, 0.082, 0.455, 0, hat).rotation.z = -0.75;
    put(ball(0.068, 12, 10), COL.fur, 0.19, 0.565, 0, hat);
  }
  if (deer) {
    // 뿔, 귀
    for (const s of [-1, 1]) {
      put(cyl(0.02, 0.026, 0.2, 8), COL.antler, 0.125 * s, 0.37, -0.03, head).rotation.z = -0.3 * s;
      put(cyl(0.016, 0.02, 0.1, 8), COL.antler, 0.185 * s, 0.415, -0.03, head).rotation.z = -1.15 * s;
      put(cyl(0.016, 0.02, 0.09, 8), COL.antler, 0.12 * s, 0.45, -0.03, head).rotation.z = 0.45 * s;
      const ear = put(ball(0.07, 10, 8), COL.deer, 0.285 * s, 0.17, -0.03, head);
      ear.scale.set(1.25, 0.6, 0.45); ear.rotation.z = 0.5 * s;
    }
  }
  const parts = { body, legs, arms, head, eyes };
  parts.jets = dressUp(parts, L, { top, bottom }); // 새 옷의 꾸밈과 소품. jets = 날 때만 보이는 불꽃 (없으면 null)
  return parts;
}

export function makeAvatar(look) {
  const root = new THREE.Group(); // 자리와 방향
  let parts = null, px = 0, pz = 0;

  // 누가 나인지 알아보게 발밑에 두는 고리
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.29, 28), new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.55 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; ring.visible = false;
  root.add(ring);

  const A = {
    root, look: null, path: [], onArrive: null, moving: false, t: Math.random() * 6, blend: 0, face: 0,
    doing: null, blink: Math.random() * 4, // doing = 하고 있는 행동 { id, t, sec }
    hold: false, // 케이크를 들고 있는지 (두 팔을 앞으로 내민다)
    push: false, // 눈 뭉치를 굴리는 중인지 (몸을 숙이고 두 손으로 민다. snowman.js 가 켠다)
    hop: null,   // 사다리를 오르내리는 중 { pts: 세상 좌표 네 점, t, to: [x, z] }
    fly: null,   // 날고 있을 때 { y: 지금 높이(세상 좌표), to: 가려는 높이, mv: 이번에 옆으로 움직였는지 } (fly.js 가 켜고 끈다)
    rest: null,  // 누워 있는 자리 { pos: [x, y, z](발끝, 세상 좌표), ry, head: [x, y, z], id(침대), side }
    get climbing() { return !!A.hop; },
    get acting() { return A.doing ? A.doing.id : null; },
    get parts() { return parts; },
    // 행동을 시작한다. 아는 행동이 아니면 false
    act(id) { const a = ACTS.find((x) => x.id === id); if (!a) return false; A.doing = { id, t: 0, sec: a.sec }; return true; },
    // 자리 (x, z) 는 격자의 자리다. 화면에서는 toWorld 를 지나서 놓인다(2층이면 위로 올라간다)
    get x() { return px; }, get z() { return pz; },
    get level() { return levelOf(px); },
    place(x, z) { px = x; pz = z; A.hop = null; A.sync(); },
    sync() {
      if (A.rest) { root.position.set(A.rest.pos[0], A.rest.pos[1], A.rest.pos[2]); return; }
      const w = toWorld(px, pz); root.position.set(w[0], A.fly ? A.fly.y : w[1], w[2]);
    },
    // 눕는다 / 일어난다
    lie(rest) { A.path = []; A.onArrive = null; A.doing = null; A.rest = rest; A.sync(); root.rotation.y = A.face = rest.ry; A.animate(0, false); },
    rise() { if (!A.rest) return false; A.rest = null; A.sync(); A.animate(0, false); return true; },
    mark(on) { ring.visible = on; },
    walk(points) { A.path = points ? points.slice() : []; },
    stop() { A.path = []; },
    turnTo(dx, dz) { if (dx || dz) A.face = Math.atan2(dx, dz); },

    // 생김새를 바꾼다(몸을 새로 만든다). 자리와 방향은 그대로.
    setLook(l) {
      const was = A.look, name = (o) => { const { name: _n, ...rest } = o; return JSON.stringify(rest); };
      A.look = cleanLook(l);
      if (parts && was && was.name !== A.look.name && name(was) === name(A.look)) return; // 닉네임만 바뀌었으면 몸은 그대로
      if (parts) {
        root.remove(parts.body);
        parts.body.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      }
      parts = build(A.look);
      root.add(parts.body);
      A.animate(0, false);
    },

    // dt 초만큼 진행. 움직였으면 true.
    step(dt) {
      let moved = false, left = (A.fly ? FLY_SPEED : SPEED) * dt;
      if (A.rest && A.path.length) A.rise(); // 걸으려면 먼저 일어난다
      if (A.hop) { // 사다리를 타는 중: 밑(또는 위)까지 다가가고, 오르내리고, 올라선다
        const h = A.hop, T = LAD_T;
        h.t += dt;
        const k = h.t < T[0] ? 0 : h.t < T[0] + T[1] ? 1 : 2, t0 = k === 0 ? 0 : k === 1 ? T[0] : T[0] + T[1];
        const e = Math.min(1, (h.t - t0) / T[k]), a = h.pts[k], b = h.pts[k + 1];
        root.position.set(a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e, a[2] + (b[2] - a[2]) * e);
        if (k === 1) A.face = Math.PI / 2; else A.turnTo(b[0] - a[0], b[2] - a[2]); // 사다리에서는 사다리(동쪽)를 본다
        h.on = k === 1;
        if (h.t >= T[0] + T[1] + T[2]) { px = h.to[0]; pz = h.to[1]; A.hop = null; A.sync(); if (A.path.length && A.path[0][0] === h.to[0] && A.path[0][1] === h.to[1]) A.path.shift(); }
        A.animate(dt, true);
        if (!A.hop && !A.path.length && A.onArrive) { const f = A.onArrive; A.onArrive = null; f(); }
        return true;
      }
      while (A.path.length && left > 0) {
        const [tx, tz] = A.path[0];
        const la = levelOf(px), lb = levelOf(tx);
        if (Math.abs(la - lb) > 1) { A.place(tx, tz); A.path.shift(); moved = true; continue; } // 두 층을 한 번에 건너뛸 수는 없다(늦게 온 소식): 바로 옮긴다
        if (la !== lb && A.fly) { A.place(tx, tz); A.path.shift(); moved = true; continue; } // 날아서 층을 넘었다
        if (la !== lb) { // 다른 층으로 가는 점: 사다리를 탄다
          const up = lb > la, p = root.position, l = LAD[Math.min(la, lb)];
          A.hop = { t: 0, on: false, to: [tx, tz], pts: [[p.x, p.y, p.z], up ? l.base : l.top, up ? l.top : l.base, toWorld(tx, tz)] };
          A.doing = null; moved = true;
          break;
        }
        const dx = tx - px, dz = tz - pz, d = Math.hypot(dx, dz);
        if (d < 1e-4) { A.path.shift(); continue; }
        A.turnTo(dx, dz);
        const s = Math.min(d, left);
        px += (dx / d) * s; pz += (dz / d) * s;
        left -= s; moved = true;
        if (s >= d - 1e-6) A.path.shift();
      }
      if (moved && !A.hop) A.sync();
      A.animate(dt, moved);
      if (moved && !A.path.length && A.onArrive) { const f = A.onArrive; A.onArrive = null; f(); } // 다 걸어갔을 때 할 일
      return moved;
    },

    // 걷는 몸짓. moved 는 이번에 발을 옮겼는지.
    animate(dt, moved) {
      if (A.fly && A.fly.mv) moved = true;
      A.moving = moved;
      A.blend += ((moved ? 1 : 0) - A.blend) * Math.min(1, dt * 12);
      A.t += dt * (moved ? 11 : 2.2);
      const sw = Math.sin(A.t) * A.blend, { body, legs, arms, head, eyes } = parts;
      // 걷는 몸짓(기본). lx·ax = 다리·팔을 앞뒤로, az = 팔을 옆으로, by = 몸 높이, bx·bz = 몸 숙임·기울임, hx·hz = 고개
      const P = { lx: [sw * 0.75, -sw * 0.75], ax: [-sw * 0.65, sw * 0.65], az: [-0.28, 0.28],
        by: Math.abs(Math.sin(A.t)) * 0.045 * A.blend + Math.sin(A.t) * 0.006 * (1 - A.blend), bx: 0, bz: 0, hx: 0, hz: Math.sin(A.t * 0.5) * 0.035 * A.blend, as: 1 };
      let spin = 0;
      const act = A.doing;
      if (act) { act.t += dt; if (moved || act.t >= act.sec) A.doing = null; }
      if (A.doing) {
        // 행동의 몸짓 Q 를 기본 몸짓 위에 부드럽게 섞는다 (시작과 끝에서 e 가 0 → 1 → 0)
        const t = act.t, w = Math.max(0, Math.min(1, t / 0.18, (act.sec - t) / 0.22)), e = w * w * (3 - 2 * w);
        const Q = { lx: P.lx.slice(), ax: P.ax.slice(), az: P.az.slice(), by: P.by, bx: 0, bz: 0, hx: 0, hz: 0, as: 1 }; // as = 팔 길이(든 팔이 큰 머리에 가리지 않게 조금 뻗는다)
        if (act.id === 'wave') { Q.az[0] = -(1.95 + 0.4 * Math.sin(t * 13)); Q.hz = 0.1; Q.as = 1.35; }               // 오른손을 들어 흔든다
        else if (act.id === 'cheer') { const k = 2.2 + 0.16 * Math.sin(t * 10); Q.az = [-k, k]; Q.by = Math.abs(Math.sin(t * 8)) * 0.06; Q.hx = -0.12; Q.as = 1.35; }
        else if (act.id === 'clap') { const k = 0.52 + 0.23 * Math.cos(t * 17); Q.ax = [-1.25, -1.25]; Q.az = [k, -k]; Q.by = Math.abs(Math.sin(t * 8.5)) * 0.015; }
        else if (act.id === 'jump') { const h = Math.abs(Math.sin(Math.PI * t / 0.65)); Q.by = h * 0.3; Q.az = [-(0.5 + h * 1.6), 0.5 + h * 1.6]; Q.lx = [-0.3 * h, 0.3 * h]; Q.as = 1.25; }
        else if (act.id === 'dance') {
          const s = Math.sin(t * 6.5), u = Math.max(0, Math.min(1, (t - 2) / 1.2));
          Q.bz = s * 0.1; Q.by = Math.abs(s) * 0.05; Q.az = [-(1.45 + s * 0.75), 1.45 - s * 0.75]; Q.as = 1.25; Q.lx = [s * 0.25, -s * 0.25]; Q.hz = -s * 0.12;
          spin = u * u * (3 - 2 * u) * Math.PI * 2; // 가운데쯤에서 한 바퀴 돈다
        }
        else if (act.id === 'bow') { const k = Math.min(1, Math.sin(Math.PI * t / act.sec) * 1.7); Q.bx = 0.42 * k; Q.hx = 0.2 * k; Q.az = [-0.12, 0.12]; Q.lx = [-0.42 * k, -0.42 * k]; }
        else if (act.id === 'eat') { const c = Math.sin(t * 9); Q.ax[0] = -2.05 + 0.3 * Math.max(0, c); Q.az[0] = 0.5; Q.hx = 0.07 + 0.05 * c; Q.by = Math.abs(c) * 0.008; } // 한 손을 입으로 가져가 오물오물
        const mix = (a, b) => a + (b - a) * e;
        for (const k of ['lx', 'ax', 'az']) { P[k][0] = mix(P[k][0], Q[k][0]); P[k][1] = mix(P[k][1], Q[k][1]); }
        for (const k of ['by', 'bx', 'bz', 'hx', 'hz', 'as']) P[k] = mix(P[k], Q[k]);
      }
      if (A.hold) { P.ax = [-1.2, -1.2]; P.az = [0.16, -0.16]; P.as = 1.15; } // 무엇을 들고 있으면 두 팔은 그대로 앞으로
      if (A.push && !A.hold && !A.doing) { const c = Math.sin(A.t) * A.blend; P.ax = [-1.0 + 0.12 * c, -1.0 - 0.12 * c]; P.az = [0.22, -0.22]; P.bx = 0.2 + 0.03 * A.blend; P.hx = -0.16; P.as = 1.12; } // 눈 뭉치를 두 손으로 밀며 굴린다 (snowman.js)
      if (A.hop && A.hop.on) { // 사다리: 팔과 다리를 번갈아 올린다
        const c = Math.sin(A.hop.t * 11);
        P.ax = [-2.3 + 0.45 * c, -2.3 - 0.45 * c]; P.az = [-0.1, 0.1]; P.lx = [-0.55 * Math.max(0, c), -0.55 * Math.max(0, -c)]; P.by = 0; P.bx = 0.1; P.hx = -0.25; P.hz = 0; P.as = 1.1;
      }
      const fl = A.fly;
      if (fl) { // 날고 있다: 떠 있을 때는 두 팔을 벌려 손바닥으로 받치고, 나아갈 때는 몸을 앞으로 눕힌다
        fl.y += (fl.to - fl.y) * Math.min(1, dt * 10);
        fl.t = (fl.t || 0) + dt;
        const k = A.blend, b = Math.sin(fl.t * 2.6);
        P.lx = [0.12 + 0.45 * k + 0.05 * b, 0.02 + 0.4 * k - 0.05 * b]; P.ax = [0.75 * k, 0.75 * k]; P.az = [-0.55 + 0.3 * k, 0.55 - 0.3 * k];
        P.by = b * 0.025; P.bx = 0.08 + 0.62 * k; P.bz = 0; P.hx = -0.4 * k; P.hz = 0; P.as = 1; spin = 0;
        root.position.y = fl.y;
      }
      if (parts.jets) for (const m of parts.jets) { m.visible = !!fl; if (fl) m.scale.y = 0.75 + 0.5 * Math.abs(Math.sin(fl.t * 31 + m.id)) + 0.5 * A.blend; }
      let lying = 0;
      if (A.rest) { // 누웠다: 등을 대고 반듯이, 눈을 감는다
        lying = -Math.PI / 2;
        P.lx = [0, 0]; P.ax = [0, 0]; P.az = [-0.16, 0.16]; P.by = 0; P.bx = 0; P.bz = 0; P.hx = 0; P.hz = 0; P.as = 1; spin = 0;
      }
      if (A.rest && A.rest.sit) { lying = 0; P.lx = [-1.5, -1.5]; P.ax = [-0.55, -0.55]; P.az = [-0.12, 0.12]; } // 좌석에 앉았다 (cinema.js): 몸은 세우고 다리만 앞으로
      for (const k of [0, 1]) { legs[k].rotation.x = P.lx[k]; arms[k].rotation.x = P.ax[k]; arms[k].rotation.z = P.az[k]; arms[k].scale.y = P.as; }
      // 숙일 때는 엉덩이가 제자리에 있게 몸을 조금 뒤로 뺀다
      body.position.set(0, P.by + (lying ? Math.sin(A.t * 0.6) * 0.004 : 0), -Math.sin(P.bx) * 0.27 * SIZE);
      body.rotation.set(P.bx + lying, spin, P.bz);
      head.rotation.set(P.hx, 0, P.hz);
      // 눈 깜빡임
      A.blink += dt; if (A.blink > 4.2) A.blink = Math.random() * 1.2;
      for (const m of eyes) m.scale.y = m.userData.sy * (A.blink < 0.12 || (A.rest && !A.rest.sit) ? 0.15 : 1);
      // 가는 쪽으로 부드럽게 돌아선다
      let d = A.face - root.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      root.rotation.y += d * Math.min(1, dt * 14);
      if (A.rest) root.rotation.y = A.face = A.rest.ry;
    },
  };
  A.setLook(look);
  // 눈덩이에 맞은 모습: 머리와 두 어깨에 흰 눈 뭉치를 얹는다. on = false 면 털어 낸다.
  // 생김새를 바꿔 몸을 새로 만들었으면 다시 부르면 새 몸에 얹는다. 지금 얹혀 있는지는 A.snowy
  A.snowed = (on) => {
    const s = A.snowy;
    if (s && (!on || s.parts !== parts)) { for (const g of s.gs) { if (g.parent) g.parent.remove(g); g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); } A.snowy = null; }
    if (!on || A.snowy) return;
    const top = new THREE.Group(), sh = new THREE.Group(), w = M(0xFFFFFF);
    for (const [x, y, z, r] of [[0, 0.27, 0.02, 0.15], [-0.12, 0.23, -0.04, 0.11], [0.13, 0.22, 0.05, 0.1], [0.04, 0.33, -0.05, 0.09], [-0.05, 0.2, 0.17, 0.07]]) put(ball(r, 10, 8), w, x, y, z, top).scale.y = 0.75;
    for (const s2 of [-1, 1]) for (const [x, y, z, r] of [[0.17, 0.63, 0, 0.085], [0.11, 0.66, 0.05, 0.065], [0.21, 0.6, -0.04, 0.06]]) put(ball(r, 10, 8), w, x * s2, y, z, sh).scale.y = 0.8;
    parts.head.add(top); parts.body.add(sh);
    A.snowy = { parts, gs: [top, sh] };
  };
  return A;
}

export { SPEED };
