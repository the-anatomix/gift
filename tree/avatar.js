// 치비 아바타. 머리가 큰 2.5등신 사람. 도형만으로 만든다(나중에 모델 파일로 바꿔 끼울 수 있다).
import { THREE, M, put, ball, cap } from './kit.js';

export const LOOKS = {
  skin: [0xF8D9BC, 0xEFC49E, 0xD9A377, 0xA9744F],
  hair: [0x3B2A22, 0x6B4630, 0xC98A4B, 0xE8C36A, 0x2E2E3A, 0xD98AA0],
  style: ['bob', 'short', 'buns', 'pony'],
  top: [0xD9483B, 0x3E9A7E, 0x4F6FB8, 0xF2B544, 0xFFF8EA, 0x8A6BBE],
  bottom: [0x3F4E6B, 0x5A3824, 0x6E7F5B, 0x8C8C96],
};
export const DEFAULT_LOOK = { skin: 0xF8D9BC, hair: 0x6B4630, style: 'bob', top: 0xD9483B, bottom: 0x3F4E6B };

const SIZE = 1.25;   // 방 크기에 맞춘 전체 배율
const SPEED = 2.3;   // 걷는 빠르기 (1초에 가는 거리)
export const BODY_R = 0.18;

export function makeAvatar(look = {}) {
  const L = { ...DEFAULT_LOOK, ...look };
  const root = new THREE.Group();           // 자리와 방향
  const body = new THREE.Group();           // 걸을 때 통통 튀는 부분
  body.scale.setScalar(SIZE);
  root.add(body);

  // 다리 (엉덩이에서 앞뒤로 흔든다)
  const legs = [-1, 1].map((s) => {
    const hip = new THREE.Group();
    hip.position.set(0.085 * s, 0.27, 0);
    put(cap(0.07, 0.12), L.bottom, 0, -0.12, 0, hip);
    const shoe = put(ball(0.085, 10, 8), 0x5A3824, 0, -0.235, 0.025, hip);
    shoe.scale.set(1, 0.6, 1.35);
    body.add(hip);
    return hip;
  });

  // 몸통
  const torso = put(cap(0.165, 0.1), L.top, 0, 0.44, 0, body);
  torso.scale.set(1.08, 1, 0.92);

  // 팔 (어깨에서 앞뒤로 흔든다)
  const arms = [-1, 1].map((s) => {
    const sh = new THREE.Group();
    sh.position.set(0.19 * s, 0.56, 0);
    sh.rotation.z = 0.28 * s;
    put(cap(0.052, 0.13), L.top, 0, -0.1, 0, sh);
    put(ball(0.056, 10, 8), L.skin, 0, -0.225, 0, sh);
    body.add(sh);
    return sh;
  });

  // 머리
  const head = new THREE.Group();
  head.position.set(0, 0.86, 0);
  body.add(head);
  const R = 0.27;
  put(ball(R, 22, 16), L.skin, 0, 0, 0, head).scale.set(1.06, 0.96, 1);
  // 얼굴
  const dark = new THREE.MeshBasicMaterial({ color: 0x3B2619 });
  for (const s of [-1, 1]) {
    put(ball(0.034, 10, 8), dark, 0.1 * s, -0.015, 0.243, head, false).scale.set(1, 1.3, 0.5);
    put(ball(0.045, 10, 8), new THREE.MeshBasicMaterial({ color: 0xF2998C, transparent: true, opacity: 0.75 }), 0.165 * s, -0.085, 0.2, head, false).scale.set(1.2, 0.7, 0.35);
  }
  // 머리카락: 뒤로 기울인 반구 + 앞머리
  const hairM = M(L.hair);
  const hairCap = put(new THREE.SphereGeometry(R * 1.09, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.56), hairM, 0, 0.005, -0.012, head);
  hairCap.rotation.x = -0.42;
  hairCap.scale.set(1.06, 1, 1.02);
  for (const s of [-1, 0, 1]) {
    const f = put(ball(0.1, 10, 8), hairM, 0.115 * s, 0.175 - Math.abs(s) * 0.02, 0.19 - Math.abs(s) * 0.03, head);
    f.scale.set(1.15, 0.62, 0.7);
  }
  if (L.style === 'bob') {
    for (const s of [-1, 1]) put(ball(0.13, 12, 10), hairM, 0.215 * s, -0.09, -0.03, head).scale.set(0.75, 1.5, 1.15);
    put(ball(0.2, 12, 10), hairM, 0, -0.1, -0.14, head).scale.set(1.25, 1.1, 0.8);
  } else if (L.style === 'buns') {
    for (const s of [-1, 1]) put(ball(0.105, 12, 10), hairM, 0.19 * s, 0.25, -0.04, head);
  } else if (L.style === 'pony') {
    put(ball(0.07, 10, 8), M(L.top), 0, 0.2, -0.26, head);
    const tail = put(ball(0.11, 12, 10), hairM, 0, 0.02, -0.34, head);
    tail.scale.set(0.8, 1.9, 0.75); tail.rotation.x = 0.35;
  }

  // 발밑 그림자 대신 쓸 표시 (누가 나인지 알아보게)
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.27, 28), new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.55 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.022; ring.visible = false;
  root.add(ring);

  const A = {
    root, look: L, path: [], moving: false, t: Math.random() * 6, blend: 0, face: 0,
    get x() { return root.position.x; }, get z() { return root.position.z; },
    place(x, z) { root.position.set(x, 0, z); },
    mark(on) { ring.visible = on; },
    walk(points) { A.path = points ? points.slice() : []; },
    stop() { A.path = []; },
    turnTo(dx, dz) { if (dx || dz) A.face = Math.atan2(dx, dz); },

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
      return moved;
    },

    // 걷는 몸짓. moved 는 이번에 발을 옮겼는지.
    animate(dt, moved) {
      A.moving = moved;
      A.blend += ((moved ? 1 : 0) - A.blend) * Math.min(1, dt * 12);
      A.t += dt * (moved ? 11 : 2.2);
      const sw = Math.sin(A.t) * A.blend;
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
  return A;
}
