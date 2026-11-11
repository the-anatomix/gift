// 치비 아바타. 머리가 큰 2.5등신 사람. 도형만으로 만든다(나중에 모델 파일로 바꿔 끼울 수 있다).
// 고를 수 있는 것: 성별(여자·남자), 옷(평상복·산타·루돌프).
import { THREE, M, put, ball, cap, cyl } from './kit.js';

export const GENDERS = [{ id: 'f', name: '여자' }, { id: 'm', name: '남자' }];
export const OUTFITS = [{ id: 'basic', name: '평상복' }, { id: 'santa', name: '🎅 산타' }, { id: 'rudolph', name: '🦌 루돌프' }];
export const DEFAULT_LOOK = { gender: 'f', outfit: 'basic' };
// 저장된 값이나 상대가 보낸 값은 믿지 않고 아는 값만 받는다
export function cleanLook(l) {
  const v = l && typeof l === 'object' ? l : {};
  return {
    gender: GENDERS.some((g) => g.id === v.gender) ? v.gender : DEFAULT_LOOK.gender,
    outfit: OUTFITS.some((o) => o.id === v.outfit) ? v.outfit : DEFAULT_LOOK.outfit,
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

const SIZE = 1.25;   // 방 크기에 맞춘 전체 배율
const SPEED = 2.6;   // 걷는 빠르기 (1초에 가는 거리)
export const BODY_R = 0.18;
export const HEIGHT = 1.16 * SIZE; // 머리끝까지 높이 (모자·뿔 제외)

function build(L) {
  const f = L.gender === 'f', santa = L.outfit === 'santa', deer = L.outfit === 'rudolph';
  const hair = f ? COL.hairF : COL.hairM;
  const top = santa ? COL.red : deer ? COL.deer : f ? COL.topF : COL.topM;
  const bottom = santa ? COL.red : deer ? COL.deer : f ? COL.skirtF : COL.pantsM;
  const skirt = f && !deer;
  const legCol = skirt ? (santa ? COL.fur : COL.skin) : bottom;
  const shoeCol = santa ? COL.belt : deer ? COL.deerDark : COL.shoe;
  const handCol = deer ? COL.deerDark : COL.skin;

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
  put(ball(R, 22, 16), COL.skin, 0, 0, 0, head).scale.set(1.06, 0.96, 1);
  for (const s of [-1, 1]) {
    put(ball(0.034, 10, 8), EYE, 0.1 * s, -0.015, 0.243, head, false).scale.set(1, 1.3, 0.5);
    put(ball(0.045, 10, 8), CHEEK, 0.165 * s, -0.085, 0.2, head, false).scale.set(1.2, 0.7, 0.35);
  }
  if (deer) put(ball(0.046, 12, 10), COL.nose, 0, -0.072, 0.262, head);

  // 머리카락: 뒤로 기울인 반구. 루돌프는 그 자리에 모자(후드)를 쓴다.
  const hairM = M(hair);
  const cover = put(new THREE.SphereGeometry(R * (deer ? 1.13 : 1.09), 22, 14, 0, Math.PI * 2, 0, Math.PI * (deer ? 0.52 : f ? 0.56 : 0.5)),
    deer ? M(COL.deer) : hairM, 0, 0.005, -0.012, head);
  cover.rotation.x = deer ? -0.42 : f ? -0.42 : -0.36;
  cover.scale.set(1.06, 1, 1.02);
  // 앞머리
  const bangY = deer ? 0.105 : f ? 0.175 : santa ? 0.13 : 0.2; // 모자 밑으로 살짝 보이게
  if (f) {
    for (const s of [-1, 0, 1]) put(ball(0.1, 10, 8), hairM, 0.115 * s, bangY - Math.abs(s) * 0.02, 0.19 - Math.abs(s) * 0.03, head).scale.set(1.15, 0.62, 0.7);
    // 단발: 옆머리와 뒷머리
    for (const s of [-1, 1]) put(ball(0.13, 12, 10), hairM, 0.215 * s, -0.09, -0.03, head).scale.set(0.75, 1.5, 1.15);
    put(ball(0.2, 12, 10), hairM, 0, -0.1, -0.14, head).scale.set(1.25, 1.1, 0.8);
  } else if (!deer) {
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
  return { body, legs, arms, head };
}

export function makeAvatar(look) {
  const root = new THREE.Group(); // 자리와 방향
  let parts = null;

  // 누가 나인지 알아보게 발밑에 두는 고리
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.29, 28), new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.55 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; ring.visible = false;
  root.add(ring);

  const A = {
    root, look: null, path: [], onArrive: null, moving: false, t: Math.random() * 6, blend: 0, face: 0,
    get x() { return root.position.x; }, get z() { return root.position.z; },
    place(x, z) { root.position.set(x, 0, z); },
    mark(on) { ring.visible = on; },
    walk(points) { A.path = points ? points.slice() : []; },
    stop() { A.path = []; },
    turnTo(dx, dz) { if (dx || dz) A.face = Math.atan2(dx, dz); },

    // 생김새를 바꾼다(몸을 새로 만든다). 자리와 방향은 그대로.
    setLook(l) {
      A.look = cleanLook(l);
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
      let moved = false, left = SPEED * dt;
      while (A.path.length && left > 0) {
        const [tx, tz] = A.path[0];
        const dx = tx - root.position.x, dz = tz - root.position.z, d = Math.hypot(dx, dz);
        if (d < 1e-4) { A.path.shift(); continue; }
        A.turnTo(dx, dz);
        const s = Math.min(d, left);
        root.position.x += (dx / d) * s; root.position.z += (dz / d) * s;
        left -= s; moved = true;
        if (s >= d - 1e-6) A.path.shift();
      }
      A.animate(dt, moved);
      if (moved && !A.path.length && A.onArrive) { const f = A.onArrive; A.onArrive = null; f(); } // 다 걸어갔을 때 할 일
      return moved;
    },

    // 걷는 몸짓. moved 는 이번에 발을 옮겼는지.
    animate(dt, moved) {
      A.moving = moved;
      A.blend += ((moved ? 1 : 0) - A.blend) * Math.min(1, dt * 12);
      A.t += dt * (moved ? 11 : 2.2);
      const sw = Math.sin(A.t) * A.blend, { body, legs, arms, head } = parts;
      legs[0].rotation.x = sw * 0.75; legs[1].rotation.x = -sw * 0.75;
      arms[0].rotation.x = -sw * 0.65; arms[1].rotation.x = sw * 0.65;
      body.position.y = Math.abs(Math.sin(A.t)) * 0.045 * A.blend + Math.sin(A.t) * 0.006 * (1 - A.blend);
      head.rotation.z = Math.sin(A.t * 0.5) * 0.035 * A.blend;
      // 가는 쪽으로 부드럽게 돌아선다
      let d = A.face - root.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      root.rotation.y += d * Math.min(1, dt * 14);
    },
  };
  A.setLook(look);
  return A;
}

export { SPEED };
