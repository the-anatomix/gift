// 집 밖: 초대받은 사람이 처음 보는 장면. 눈 내리는 밤의 집 앞에서 초인종을 누르고, 문이 열리면 걸어 들어간다.
// 집 안과 겹치지 않게 멀리(z 쪽으로 OZ 만큼) 떨어뜨려 짓고, 문 앞에 있을 때만 보이게 한다.
import { THREE, M, put, rbox, cyl, ball } from './kit.js';

const OZ = 70;                 // 집 밖 장면이 놓인 자리 (집 안은 z -4 ~ 5)
const lit = (hex) => new THREE.MeshBasicMaterial({ color: hex });

export function buildOutside(scene) {
  const g = new THREE.Group();
  g.position.z = OZ; g.visible = false;
  scene.add(g);
  const SNOW = 0xF2F6FB, WALL = 0xE9D9BF, ROOF = 0x8A4A3A, WOOD = 0x7A5137;
  put(new THREE.BoxGeometry(40, 0.2, 30), SNOW, 0, -0.1, 4, g, false);                      // 눈 덮인 마당
  put(new THREE.BoxGeometry(1.6, 0.02, 7), 0xD9C9B4, 0, 0.011, 3.6, g, false);              // 현관으로 가는 길
  // 집 앞면
  put(rbox(9, 3, 0.4, 0.05), WALL, 0, 1.5, -0.2, g, false);
  put(new THREE.BoxGeometry(9.1, 0.5, 0.45), 0xC9B190, 0, 0.25, -0.18, g, false);
  const roof = new THREE.Shape(); roof.moveTo(-5.1, 0); roof.lineTo(0, 2.2); roof.lineTo(5.1, 0); roof.closePath();
  const rm = put(new THREE.ExtrudeGeometry(roof, { depth: 1.2, bevelEnabled: false }), ROOF, 0, 3, -0.9, g, false);
  for (const s of [-1, 1]) { const sn = put(new THREE.BoxGeometry(5.7, 0.14, 1.3), SNOW, 2.55 * s, 4.16, -0.3, g, false); sn.rotation.z = -0.407 * s; } // 지붕 위 눈
  put(rbox(0.7, 1.3, 0.7, 0.03), 0xB5523F, 2.6, 4.3, -0.5, g, false); put(new THREE.BoxGeometry(0.8, 0.12, 0.8), SNOW, 2.6, 5.0, -0.5, g, false); // 굴뚝
  rm.castShadow = false;
  // 불 켜진 창
  for (const x of [-2.9, 2.9]) {
    put(rbox(1.7, 1.4, 0.1, 0.03), 0xFFF8EA, x, 1.75, 0.02, g, false);
    put(new THREE.BoxGeometry(1.5, 1.2, 0.02), lit(0xFFD98A), x, 1.75, 0.08, g, false);
    put(new THREE.BoxGeometry(0.06, 1.2, 0.03), 0xFFF8EA, x, 1.75, 0.1, g, false); put(new THREE.BoxGeometry(1.5, 0.06, 0.03), 0xFFF8EA, x, 1.75, 0.1, g, false);
    put(new THREE.BoxGeometry(1.9, 0.1, 0.3), SNOW, x, 1.02, 0.14, g, false);
  }
  // 문 (왼쪽 모서리를 축으로 안쪽으로 열린다)
  put(rbox(1.3, 2.3, 0.12, 0.03), WOOD, 0, 1.15, 0.02, g, false);
  put(new THREE.BoxGeometry(1.06, 2.1, 0.02), 0x1F1722, 0, 1.07, 0.03, g, false);            // 문 안쪽 어둠
  const hinge = new THREE.Group(); hinge.position.set(-0.53, 0, 0.09); g.add(hinge);
  put(rbox(1.06, 2.1, 0.07, 0.02), 0xB5523F, 0.53, 1.07, 0, hinge, false);
  put(ball(0.05, 10, 8), 0xE7B441, 0.95, 1.05, 0.06, hinge, false);
  const wr = put(new THREE.TorusGeometry(0.2, 0.07, 8, 16), M(0x2F7D56, true), 0.53, 1.55, 0.06, hinge, false); wr.scale.z = 0.6;
  put(rbox(0.16, 0.08, 0.04, 0.02), 0xD23A30, 0.53, 1.36, 0.08, hinge, false);
  put(new THREE.BoxGeometry(1.2, 0.03, 0.6), 0x8A5F3F, 0, 0.02, 0.5, g, false);              // 발판
  // 초인종: 문 오른쪽의 작은 판과 빛나는 단추
  const bell = new THREE.Group(); bell.position.set(0.95, 1.25, 0.06); g.add(bell);
  put(rbox(0.16, 0.24, 0.05, 0.02), 0x5A3824, 0, 0, 0, bell, false);
  const btn = put(ball(0.045, 12, 10), lit(0xFFE08A), 0, 0, 0.035, bell, false);
  const hitBox = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.3), new THREE.MeshBasicMaterial({ visible: false })); // 누르기 쉽게 넉넉한 자리
  bell.add(hitBox);
  // 현관 등
  put(cyl(0.02, 0.02, 0.25, 6), 0x2B2420, -0.95, 2.05, 0.2, g, false).rotation.x = Math.PI / 2;
  put(ball(0.1, 10, 8), lit(0xFFE2A8), -0.95, 2.0, 0.34, g, false);
  const lamp = new THREE.PointLight(0xFFC27A, 3, 7, 1.5); lamp.position.set(0, 2.1, 1.2); g.add(lamp);
  // 마당: 나무, 눈사람, 울타리
  for (const [x, z, s] of [[-3.6, 2.6, 1], [3.9, 3.3, 0.8], [-5.2, 4.6, 0.7]]) {
    put(cyl(0.08 * s, 0.1 * s, 0.4 * s, 8), WOOD, x, 0.2 * s, z, g, false);
    put(new THREE.ConeGeometry(0.7 * s, 1.1 * s, 9), M(0x2F7D56, true), x, 0.85 * s, z, g, false);
    put(new THREE.ConeGeometry(0.5 * s, 0.9 * s, 9), M(0x3A9163, true), x, 1.45 * s, z, g, false);
    put(new THREE.ConeGeometry(0.28 * s, 0.3 * s, 9), SNOW, x, 1.82 * s, z, g, false);
  }
  put(ball(0.34, 14, 10), 0xFFFAF2, 2.2, 0.3, 2.4, g, false); put(ball(0.25, 14, 10), 0xFFFAF2, 2.2, 0.78, 2.4, g, false); put(ball(0.18, 14, 10), 0xFFFAF2, 2.2, 1.14, 2.4, g, false);
  put(new THREE.ConeGeometry(0.035, 0.16, 8), 0xF28C28, 2.2, 1.14, 2.62, g, false).rotation.x = Math.PI / 2;
  put(new THREE.TorusGeometry(0.19, 0.05, 8, 16), 0xD23A30, 2.2, 0.98, 2.4, g, false).rotation.x = Math.PI / 2;
  for (let x = -7; x <= 7; x += 0.7) if (Math.abs(x) > 1.2) { put(new THREE.BoxGeometry(0.1, 0.7, 0.06), 0xFFF8EA, x, 0.35, 6.4, g, false); }
  for (const s of [-1, 1]) put(new THREE.BoxGeometry(5.9, 0.08, 0.05), 0xFFF8EA, 4.2 * s, 0.45, 6.4, g, false);
  // 내리는 눈
  const N = 260, pos = new Float32Array(N * 3), sp = new Float32Array(N);
  for (let k = 0; k < N; k++) { pos[k * 3] = (Math.random() - 0.5) * 16; pos[k * 3 + 1] = Math.random() * 7; pos[k * 3 + 2] = Math.random() * 9 - 0.5; sp[k] = 0.5 + Math.random() * 0.7; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const snow = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xFFFFFF, size: 0.07, transparent: true, opacity: 0.9 }));
  snow.frustumCulled = false; g.add(snow);

  let t = 0, opening = null;   // opening = { t, done } 문이 열리며 걸어 들어가는 중
  const portrait = () => window.innerWidth < window.innerHeight;
  const stand = () => (portrait() ? 12.5 : 8); // 문에서 떨어져 서는 거리 (집 모양이 한눈에 보이게. 세로 화면은 좌우가 좁아서 더 멀리)
  // 멀리서는 지붕까지 보이게 조금 올려다보고, 문에 다가갈수록 문을 본다
  const pose = (z) => ({ pos: [0.25, 1.5, OZ + z], at: [0.35, 1.35 + Math.min(1, z / 8) * 0.9, OZ - 2], fov: portrait() ? 70 : 55 });
  return {
    get shown() { return g.visible; }, get opening() { return !!opening; },
    show(on) { g.visible = on; if (on) { hinge.rotation.y = 0; opening = null; } },
    pose: () => pose(stand()),
    // 화면에서 쏜 선이 초인종에 닿는지
    hitBell: (ray) => ray.intersectObject(hitBox, false).length > 0,
    bellPoint() { const v = new THREE.Vector3(); btn.getWorldPosition(v); return [v.x, v.y, v.z]; },
    // 문이 열리고 안으로 걸어 들어간다. 다 들어가면 done 을 부른다. 돌려주는 값 = 그동안의 카메라 자리를 주는 함수
    open(done) { opening = { t: 0, done }; },
    // dt 초 진행. 걸어 들어가는 중이면 그때의 카메라 자리를 돌려준다
    tick(dt) {
      if (!g.visible) return null;
      t += dt;
      btn.scale.setScalar(1 + 0.12 * Math.sin(t * 4)); // 단추가 깜빡이듯 숨쉰다
      for (let k = 0; k < N; k++) { // 눈
        pos[k * 3 + 1] -= sp[k] * dt; pos[k * 3] += Math.sin(t + k) * 0.12 * dt;
        if (pos[k * 3 + 1] < 0) pos[k * 3 + 1] = 7;
      }
      sg.attributes.position.needsUpdate = true;
      if (!opening) return null;
      opening.t += dt;
      const a = Math.min(1, opening.t / 0.9), b = Math.max(0, Math.min(1, (opening.t - 0.3) / 1.8));
      hinge.rotation.y = -1.75 * (a * a * (3 - 2 * a));
      const p = pose(stand() - (stand() - 0.5) * (b * b * (3 - 2 * b)));
      if (b >= 1) { const d = opening.done; opening = null; d(); return null; } // 다 들어갔다: 이제 카메라는 방 안의 것
      return p;
    },
  };
}
