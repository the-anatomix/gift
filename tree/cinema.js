// 3층 영화관: 큰 스크린, 계단식 좌석, 통로 유도등, 팝콘 기계, 벽에 거는 그림.
//   가구의 종류와 배치는 catalog.js(FURNITURE 의 screen·seat·seat2·seat3·guide·popcorn·art1~5, CINEMA), 여기는 모양과 영화관으로 바꾸기.
//   스크린은 TV 와 같은 화면 재질(TV_MAT)을 크게 비춘다. 그래서 TV 에 넣은 동영상·같이 보기가 그대로 스크린에도 나온다(놀이는 play.js 의 tv).
//   새 방의 3층은 다락방이다(catalog.js 의 STARTER_UP). 예전에 영화관으로 열린 방은 그대로다.
//   영화관 소품은 가구 탭의 목록에서 누구나 골라 직접 놓는다. 한 번에 차리는 "🎬 3층을 영화관으로 바꾸기"는 마스터키를 켠 사람의 마스터 탭에만 있다:
//   두 번 누르면 3층의 가구를 치우고 영화관을 차린다(가구 치우기·놓기 변화를 하나씩 보내서 모두에게 같게 된다).
//   그림은 모두 직접 그린 캔버스 그림이다(겨울 언덕, 트리, 추상화, 눈사람, 오로라).
//
//   3층에 스크린이 있는 동안은 방도 영화관답게 바뀐다(room.js 의 setTheater: 어두운 벽·카펫 바닥·창과 줄 장식 없이). 여기서는 벽 등·영사실과 빛줄기·비상구 표시를 붙인다.
//   가구가 아니라 방의 일부라서 가구 수는 그대로이고, 예전에 차린 영화관도 그대로 열린다(가구 종류 이름은 바뀌지 않았다).
//   그림 앞에서는 자기 사진으로 바꿀 수 있다(photo.js). 여기서는 그 사진을 액자에 비춘다.
//
// K = { S() 방 상태, kindOf(k), levelOfCell(i), op(o), newId(), isMaster() 영화관으로 바꿀 권한이 있는지(마스터키를 켰거나 마스터가 🎬 를 열어 줌: master.js 의 CINE), canEdit(), approach(id, then), popcorn() 팝콘 한 통을 꺼내 든다, mode(), measure(), toast(m),
//       itemObj(id) 가구 모양, wallShown(lv, side) 그 층의 그 벽(n·s·w·e)이 지금 보이는지, dirty(),
//       photo(h) 그 지문의 사진(data URL), room(room.js), showing() 스크린에 동영상이 나오는지, level() 내가 있는 층 }
import { THREE, T, L, put, rbox, cyl, ball, bake, soft } from './kit.js';
import { addShape, TV_MAT } from './furniture.js';
import { CINEMA, MAX_ITEMS } from './catalog.js';
import { FLOOR_DI, NX, NZ, X0, X1, Z0, CELL, LADDERS } from './path.js';
import { WALL_H } from './room.js';

export const SCREEN = { w: 3.6, h: 2.025, y: 1.4, far: 9 }; // 스크린 화면의 크기와 가운데 높이 (16:9), far = 볼 때 물러서는 가장 먼 거리(세로 화면에서는 뒷줄 뒤까지 물러서야 다 보인다)
const VELVET = 0xA02C36, VELVET_L = 0xB83A44, VELVET_D = 0x6B1C25, STEP = 0x2E2636, SHELL = 0x1E1A22, FRAME = 0x8A5F3F, GOLD = 0xE7B441;
const GLOW = 0xFFC766;   // 유도등·발밑 등의 빛 색
const WALL_TOP = WALL_H; // 벽 높이 (막과 매단 표시가 여기까지 올라간다)

/* ───────── 그림 (한 번만 그려서 같은 그림은 재질 하나를 나눠 쓴다) ───────── */
const W = 192, H = 144;
const PAINT = {
  art1(g) { // 겨울 언덕: 분홍빛 하늘, 눈 덮인 언덕, 불 켜진 오두막, 전나무
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#8FB8E8'); sky.addColorStop(0.6, '#F7C9C0'); sky.addColorStop(1, '#FFE9D2');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    g.fillStyle = '#FFF6E0'; g.beginPath(); g.arc(150, 34, 13, 0, 7); g.fill();
    g.fillStyle = '#DCE6F5'; g.beginPath(); g.ellipse(50, 128, 110, 46, 0, 0, 7); g.fill();
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.ellipse(150, 140, 110, 50, 0, 0, 7); g.fill();
    g.fillStyle = '#8A4B3A'; g.fillRect(112, 84, 34, 22);
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.moveTo(106, 86); g.lineTo(129, 66); g.lineTo(152, 86); g.fill();
    g.fillStyle = '#FFD86B'; g.fillRect(124, 91, 10, 9);
    for (const [x, y, s] of [[30, 100, 1], [52, 108, 0.8], [172, 104, 0.9]]) { g.fillStyle = '#2F7D5B'; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x, y - (34 - k * 9) * s); g.lineTo(x - (8 + k * 4) * s, y - (16 - k * 8) * s); g.lineTo(x + (8 + k * 4) * s, y - (16 - k * 8) * s); g.fill(); } g.fillStyle = '#6B4630'; g.fillRect(x - 2, y, 4, 7 * s); }
  },
  art2(g) { // 트리: 짙은 밤 배경, 장식과 별
    g.fillStyle = '#17324A'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#FFFFFF'; for (let k = 0; k < 26; k++) { g.beginPath(); g.arc((k * 67) % W, (k * 41) % (H - 20), 1.2, 0, 7); g.fill(); }
    g.fillStyle = '#EEF4FA'; g.fillRect(0, H - 16, W, 16);
    g.fillStyle = '#6B4630'; g.fillRect(90, 112, 12, 18);
    g.fillStyle = '#2E8B62'; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(96, 22 + k * 24); g.lineTo(96 - 24 - k * 11, 62 + k * 26); g.lineTo(96 + 24 + k * 11, 62 + k * 26); g.fill(); }
    const dots = ['#E7493F', '#FFD24A', '#6FB6FF', '#FF9BC1'];
    [[88, 50], [106, 56], [78, 78], [98, 84], [116, 80], [70, 106], [90, 108], [110, 104], [126, 108]].forEach(([x, y], k) => { g.fillStyle = dots[k % 4]; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); });
    g.fillStyle = '#FFD24A'; g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 4.5 : 10; g.lineTo(96 + Math.cos(a) * r, 20 + Math.sin(a) * r); } g.fill();
  },
  art3(g) { // 추상화: 색 네모와 동그라미, 굵은 선
    g.fillStyle = '#F4EBDD'; g.fillRect(0, 0, W, H);
    for (const [x, y, w, h, c] of [[10, 12, 70, 54, '#D9483B'], [90, 12, 92, 30, '#2F6DB5'], [90, 50, 40, 82, '#F2C230'], [10, 76, 70, 56, '#2E8B62'], [138, 50, 44, 82, '#1F2A44']]) { g.fillStyle = c; g.fillRect(x, y, w, h); }
    g.fillStyle = '#F4EBDD'; g.beginPath(); g.arc(46, 40, 16, 0, 7); g.fill();
    g.fillStyle = '#F2C230'; g.beginPath(); g.arc(160, 92, 13, 0, 7); g.fill();
    g.strokeStyle = '#1F2A44'; g.lineWidth = 5; g.beginPath(); g.moveTo(18, 124); g.lineTo(74, 84); g.stroke();
  },
  art4(g) { // 눈사람: 파란 밤, 눈송이
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#27407A'); sky.addColorStop(1, '#5E86C9');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    g.fillStyle = '#FFFFFF'; for (let k = 0; k < 30; k++) { g.beginPath(); g.arc((k * 53 + 11) % W, (k * 29 + 7) % (H - 24), 1.6 + (k % 3) * 0.5, 0, 7); g.fill(); }
    g.beginPath(); g.ellipse(96, 150, 140, 36, 0, 0, 7); g.fill();
    for (const [y, r] of [[104, 26], [68, 19], [42, 13]]) { g.beginPath(); g.arc(96, y, r, 0, 7); g.fill(); }
    g.fillStyle = '#2A2420'; for (const [x, y] of [[91, 39], [101, 39], [96, 62], [96, 72], [96, 98]]) { g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); }
    g.fillRect(84, 26, 24, 5); g.fillRect(88, 12, 16, 15);
    g.fillStyle = '#F08A2C'; g.beginPath(); g.moveTo(96, 43); g.lineTo(112, 46); g.lineTo(96, 48); g.fill();
    g.fillStyle = '#D9483B'; g.fillRect(82, 52, 28, 6); g.fillRect(104, 54, 6, 18);
  },
  art5(g) { // 오로라: 밤하늘의 초록·보랏빛 띠, 별, 눈밭과 전나무 그림자
    g.fillStyle = '#0D1B3A'; g.fillRect(0, 0, W, H);
    for (const [c, y0, amp] of [['rgba(92,240,170,0.55)', 40, 16], ['rgba(150,120,255,0.45)', 60, 12], ['rgba(110,220,255,0.35)', 26, 10]]) {
      g.strokeStyle = c; g.lineWidth = 16; g.lineCap = 'round'; g.beginPath();
      for (let x = -10; x <= W + 10; x += 8) { const y = y0 + Math.sin(x / 26 + amp) * amp + x * 0.08; if (x === -10) g.moveTo(x, y); else g.lineTo(x, y); }
      g.stroke();
    }
    g.fillStyle = '#FFFFFF'; for (let k = 0; k < 34; k++) { g.beginPath(); g.arc((k * 71 + 5) % W, (k * 37 + 3) % 90, 1, 0, 7); g.fill(); }
    g.fillStyle = '#E6EEF8'; g.beginPath(); g.ellipse(96, 150, 150, 40, 0, 0, 7); g.fill();
    g.fillStyle = '#0A2A2A'; for (const [x, s] of [[24, 1], [44, 0.7], [150, 0.9], [172, 1.1]]) { g.beginPath(); g.moveTo(x, 118 - 40 * s); g.lineTo(x - 11 * s, 120); g.lineTo(x + 11 * s, 120); g.fill(); }
  },
};
const artMats = new Map();
function artMat(k) {
  let m = artMats.get(k);
  if (!m) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    PAINT[k](c.getContext('2d'));
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    m = new THREE.MeshLambertMaterial({ map: tex }); // 방 불을 끄면 그림도 어두워진다
    artMats.set(k, m);
  }
  return m;
}

/* ───────── 모양 (바닥 자리 한가운데가 (0, 0), 앞쪽이 +z) ───────── */
// 판 여러 장을 한 덩어리로 (그리기 한 번). list = [{ w, h, x, y, z, ry }]
function planes(list) {
  const pos = [], nor = [], uv = [], idx = [];
  for (const p of list) {
    const g = new THREE.PlaneGeometry(p.w, p.h);
    if (p.ry) g.rotateY(p.ry);
    g.translate(p.x, p.y, p.z);
    const b = pos.length / 3;
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); uv.push(...g.attributes.uv.array);
    for (const i of g.index.array) idx.push(b + i);
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}
// 작은 그림 한 장으로 만든 스스로 빛나는 재질 (줄 번호, 비상구 표시)
function signMat(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return new THREE.MeshBasicMaterial({ map: tex });
}
// 스크린: 8 × 1. 낮은 무대 단, 검은 테와 화면, 양옆으로 걷어 둔 붉은 주름 막, 위의 드림막
addShape('screen', (g) => {
  const top = WALL_TOP - 0.04;
  put(new THREE.BoxGeometry(4.0, 0.18, 0.5), 0x4A3328, 0, 0.09, 0, g);                                     // 무대 단
  put(new THREE.BoxGeometry(3.96, 0.02, 0.02), L(GLOW), 0, 0.186, 0.243, g, false).receiveShadow = false;  // 무대 앞 끝의 발밑 등
  put(rbox(SCREEN.w + 0.24, SCREEN.h + 0.24, 0.07, 0.02), 0x141114, 0, SCREEN.y, -0.2, g);
  const scr = put(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h), TV_MAT, 0, SCREEN.y, -0.16, g, false);
  scr.receiveShadow = false;
  for (const s of [-1, 1]) {
    // 걷어 둔 막: 주름 기둥 넷이 앞뒤로 어긋나 있다
    [[1.9, -0.13, 0.2], [2.04, -0.07, 0.18], [2.17, -0.12, 0.18], [2.29, -0.06, 0.16]].forEach(([x, z, w], k) => put(rbox(w, top - 0.18, 0.16, 0.07), T(k % 2 ? VELVET : VELVET_L, 'pleat'), x * s, (top + 0.18) / 2, z, g, k % 2 === 0));
    put(rbox(0.62, 0.07, 0.24, 0.03), GOLD, 2.1 * s, 0.95, -0.08, g, false);                               // 묶는 끈
    put(ball(0.05, 8, 6), GOLD, 2.36 * s, 0.9, 0.02, g, false);
  }
  put(new THREE.BoxGeometry(4.86, 0.24, 0.24), T(VELVET_D, 'pleat'), 0, top - 0.12, -0.08, g, false);        // 드림막
  put(new THREE.BoxGeometry(4.86, 0.035, 0.25), GOLD, 0, top - 0.255, -0.08, g, false);
  g.userData.scr = SCREEN; // play.js 의 TV 보기가 이 크기에 맞춰 물러선다
});
// 좌석: 4 × 2, 팔걸이와 컵홀더가 있는 접이식 벨벳 의자 두 자리. rise = 밑에 깔린 단의 높이 (뒷줄일수록 높다). 단 앞에는 발밑 등, 양 끝에는 줄 번호
const rowMats = new Map();
const rowMat = (ch) => {
  if (!rowMats.has(ch)) rowMats.set(ch, signMat(64, 64, (c) => {
    c.fillStyle = '#17131C'; c.fillRect(0, 0, 64, 64);
    c.strokeStyle = '#E7B441'; c.lineWidth = 4; c.strokeRect(5, 5, 54, 54);
    c.fillStyle = '#FFD98A'; c.font = 'bold 42px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ch, 32, 35);
  }));
  return rowMats.get(ch);
};
const seatShape = (rise, row) => (g) => {
  if (rise) {
    put(new THREE.BoxGeometry(1.98, rise, 0.98), STEP, 0, rise / 2, 0, g);
    put(new THREE.BoxGeometry(1.9, 0.02, 0.02), L(GLOW), 0, rise - 0.012, 0.495, g, false).receiveShadow = false;
  }
  for (const sx of [-0.47, 0.47]) {
    put(rbox(0.76, 0.15, 0.56, 0.06), VELVET, sx, rise + 0.265, 0.1, g);                                    // 내려 둔 앉는 판
    put(new THREE.BoxGeometry(0.72, 0.05, 0.52), SHELL, sx, rise + 0.17, 0.1, g, false);
    const back = put(rbox(0.76, 0.72, 0.15, 0.07), VELVET, sx, rise + 0.66, -0.33, g); back.rotation.x = -0.14; // 살짝 젖혀진 등받이
    const head = put(rbox(0.6, 0.17, 0.17, 0.06), VELVET_L, sx, rise + 1.03, -0.385, g, false); head.rotation.x = -0.14;
    const shell = put(new THREE.BoxGeometry(0.8, 0.86, 0.04), SHELL, sx, rise + 0.6, -0.44, g, false); shell.rotation.x = -0.14;
  }
  for (const x of [-0.93, 0, 0.93]) {
    put(new THREE.BoxGeometry(0.09, 0.46, 0.56), SHELL, x, rise + 0.23, 0.04, g, x !== 0);                 // 팔걸이 기둥
    put(rbox(0.13, 0.055, 0.66, 0.025), 0x3B2A22, x, rise + 0.485, 0.06, g, false);                         // 팔걸이
    put(cyl(0.052, 0.045, 0.05, 10), 0x0F0D12, x, rise + 0.53, 0.33, g, false);                             // 컵홀더
    put(cyl(0.04, 0.04, 0.012, 10), 0x4A4652, x, rise + 0.552, 0.33, g, false);
  }
  const tag = new THREE.Mesh(planes([-1, 1].map((s) => ({ w: 0.2, h: 0.2, x: 0.977 * s, y: rise + 0.24, z: 0.08, ry: s * Math.PI / 2 }))), rowMat(row));
  tag.castShadow = false; tag.receiveShadow = false; g.add(tag);
};
addShape('seat', seatShape(0, 'A')); addShape('seat2', seatShape(0.2, 'B')); addShape('seat3', seatShape(0.4, 'C'));
// 유도등: 6 × 2, 통로 양쪽 가장자리의 빛나는 줄과 점 (밟고 지나간다)
addShape('guide', (g) => {
  for (const s of [-1, 1]) {
    put(new THREE.BoxGeometry(2.9, 0.012, 0.03), L(GLOW), 0, 0.016, 0.47 * s, g, false).receiveShadow = false;
    for (let k = 0; k < 6; k++) put(new THREE.BoxGeometry(0.07, 0.014, 0.07), L(0xFFE9B8), -1.25 + k * 0.5, 0.018, 0.47 * s, g, false).receiveShadow = false;
  }
});
// 매점(종류 이름은 예전 그대로 popcorn): 2 × 1, 줄무늬 판매대 위의 팝콘 기계와 음료 컵, 팝콘 통
addShape('popcorn', (g) => {
  put(rbox(0.96, 0.78, 0.42, 0.04), 0xC8332B, 0, 0.39, 0, g);
  for (let k = 0; k < 5; k++) put(new THREE.BoxGeometry(0.09, 0.7, 0.012), 0xFFF4E0, -0.38 + k * 0.19, 0.4, 0.211, g, false); // 빨강·하양 줄무늬
  put(new THREE.BoxGeometry(1.0, 0.05, 0.47), 0xFFF1D6, 0, 0.805, 0, g, false);
  put(new THREE.BoxGeometry(1.0, 0.025, 0.475), GOLD, 0, 0.77, 0, g, false);
  // 팝콘 기계 (왼쪽)
  put(new THREE.BoxGeometry(0.5, 0.42, 0.34), new THREE.MeshLambertMaterial({ color: 0xFFF7DA, transparent: true, opacity: 0.4 }), -0.22, 1.04, 0, g, false);
  for (const [x, z] of [[-0.46, -0.16], [-0.46, 0.16], [0.02, -0.16], [0.02, 0.16]]) put(new THREE.BoxGeometry(0.025, 0.42, 0.025), GOLD, x, 1.04, z, g, false);
  put(ball(0.2, 10, 7), 0xFFE08A, -0.22, 0.86, 0, g, false).scale.set(1.1, 0.6, 0.72);
  put(cyl(0.07, 0.05, 0.08, 8), 0x4A4652, -0.22, 1.19, 0, g, false);                                       // 튀기는 솥
  put(rbox(0.56, 0.11, 0.4, 0.03), 0xC8332B, -0.22, 1.305, 0, g);
  put(cyl(0.045, 0.045, 0.03, 10), GOLD, -0.22, 1.375, 0, g, false);
  // 음료 컵 둘과 팝콘 통 (오른쪽)
  for (const [x, z, c] of [[0.2, 0.08, 0x2F6DB5], [0.33, -0.06, 0xC8332B]]) {
    put(cyl(0.045, 0.034, 0.14, 10), 0xFFFFFF, x, 0.9, z, g, false);
    put(cyl(0.046, 0.04, 0.05, 10), c, x, 0.9, z, g, false);
    put(cyl(0.048, 0.048, 0.012, 10), 0xEDEDED, x, 0.976, z, g, false);
    put(cyl(0.006, 0.006, 0.1, 5), c, x + 0.012, 1.02, z, g, false).rotation.z = -0.25;
  }
  put(cyl(0.075, 0.052, 0.16, 10), 0xC8332B, 0.41, 0.91, 0.12, g, false);
  put(cyl(0.077, 0.066, 0.05, 10), 0xFFF4E0, 0.41, 0.93, 0.12, g, false);
  put(ball(0.075, 8, 6), 0xFFE08A, 0.41, 0.995, 0.12, g, false).scale.set(1, 0.6, 1);
});
// 그림: 2 × 1, 벽에 붙는 나무 액자 (칸의 뒤쪽 끝에 걸린다). 그림 판(userData.pic)은 사진을 넣으면 그 사진으로 바뀐다 (photo.js)
for (const k of Object.keys(PAINT)) addShape(k, (g) => {
  put(rbox(0.86, 0.66, 0.05, 0.02), k === 'art3' ? 0x2A2420 : k === 'art2' ? GOLD : FRAME, 0, 1.62, -0.215, g);
  g.userData.pic = put(new THREE.PlaneGeometry(0.74, 0.54), artMat(k), 0, 1.62, -0.186, g, false);
});

/* ───────── 영화관일 때 3층에 붙는 것들: 벽 등, 영사실 창과 빛줄기, 비상구 표시 (가구가 아니라 방의 일부) ───────── */
// f = room.floors[2] { g, walls }. 돌려주는 값 = { parts: [묶음들], beam, lens: [x, y, z](층 기준) }
function buildFixtures(f) {
  const parts = [];
  const washMat = new THREE.MeshBasicMaterial({ map: soft(), color: 0xFFB56B, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending });
  const fx = (w) => { const p = new THREE.Group(); w.upper.add(p); parts.push(p); return p; };
  // 벽 등: 북·남쪽 벽에 다섯 개씩. 금빛 받침과 빛나는 갓, 벽에 번지는 빛(벽마다 한 덩어리)
  for (const side of ['n', 's']) {
    const w = f.walls[side], p = fx(w), xs = [-2.25, 1.0, 3.5, 6.0, 9.25].map((v) => w.at(v)), z = w.front;
    for (const x of xs) {
      put(new THREE.BoxGeometry(0.07, 0.16, 0.05), GOLD, x, 2.12, z + 0.025, p, false);
      put(cyl(0.075, 0.045, 0.17, 8), L(0xFFDFA8), x, 2.2, z + 0.085, p, false);
      put(cyl(0.05, 0.05, 0.02, 8), GOLD, x, 2.105, z + 0.085, p, false);
    }
    bake(p, 0, false);
    const wash = new THREE.Mesh(planes(xs.map((x) => ({ w: 1.1, h: 1.5, x, y: 2.05, z: z + 0.012 }))), washMat);
    wash.castShadow = false; wash.receiveShadow = false; wash.renderOrder = 2; wash.raycast = () => {}; p.add(wash);
  }
  // 영사실: 뒤쪽(동쪽) 벽 높은 곳의 어두운 상자, 불 켜진 창, 렌즈
  const LZ = 0.5, LY = 2.2;
  {
    const w = f.walls.e, p = fx(w), x = w.at(LZ), z = w.front;
    put(rbox(1.7, 0.66, 0.2, 0.04), 0x1C1820, x, LY, z + 0.1, p);
    put(new THREE.BoxGeometry(1.76, 0.05, 0.24), GOLD, x, LY - 0.35, z + 0.1, p, false);
    put(new THREE.BoxGeometry(0.34, 0.2, 0.02), L(0xFFE2A0), x - 0.5, LY + 0.02, z + 0.2, p, false);          // 영사 기사의 창
    put(new THREE.BoxGeometry(0.34, 0.2, 0.02), L(0x55618F), x + 0.5, LY + 0.02, z + 0.2, p, false);
    put(cyl(0.1, 0.12, 0.1, 12), 0x2B2630, x, LY, z + 0.24, p, false).rotation.x = Math.PI / 2;               // 렌즈 통
    put(cyl(0.07, 0.07, 0.02, 12), L(0xEAF2FF), x, LY, z + 0.295, p, false).rotation.x = Math.PI / 2;
    bake(p, 0, false);
  }
  // 영사기 빛줄기: 렌즈에서 스크린까지 퍼지는 옅은 빛 (스크린에 동영상이 나올 때만 보인다)
  const cone = new THREE.BufferGeometry();
  cone.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -0.5, -0.5, 1, 0.5, -0.5, 1, 0.5, 0.5, 1, -0.5, 0.5, 1], 3));
  cone.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1]);
  const beam = new THREE.Mesh(cone, new THREE.MeshBasicMaterial({ color: 0xCFE0FF, transparent: true, opacity: 0.075, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  beam.castShadow = false; beam.receiveShadow = false; beam.visible = false; beam.renderOrder = 4; beam.raycast = () => {}; beam.frustumCulled = false;
  f.g.add(beam);
  // 비상구 표시: 2층으로 내려가는 구멍(이 방의 출입구) 위에 매단 초록 표시. 글자 없이 그림만
  {
    const [hi, hj] = LADDERS[1].foot, hx = X0 + (hi + 0.5) * CELL, hz = Z0 + (hj + 0.5) * CELL, p = new THREE.Group();
    f.g.add(p); parts.push(p);
    put(new THREE.BoxGeometry(0.06, 0.3, 0.66), 0x14301F, hx, 2.3, hz, p, false);
    for (const s of [-1, 1]) put(new THREE.BoxGeometry(0.02, WALL_TOP - 2.44, 0.02), 0x2A2630, hx, (WALL_TOP + 2.44) / 2, hz + s * 0.24, p, false);
    bake(p, 0, false);
    const sign = new THREE.Mesh(planes([-1, 1].map((s) => ({ w: 0.6, h: 0.24, x: hx + s * 0.032, y: 2.3, z: hz, ry: s * Math.PI / 2 }))), signMat(160, 64, (c) => {
      c.fillStyle = '#12A150'; c.fillRect(0, 0, 160, 64);
      c.fillStyle = '#FFFFFF'; c.fillRect(104, 8, 40, 50);                       // 문
      c.fillStyle = '#12A150'; c.fillRect(110, 14, 28, 44);
      c.strokeStyle = '#FFFFFF'; c.lineWidth = 7; c.lineCap = 'round'; c.lineJoin = 'round';
      c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(84, 15, 7, 0, 7); c.fill(); // 달려 나가는 사람
      c.beginPath(); c.moveTo(80, 26); c.lineTo(70, 40); c.stroke();            // 몸
      c.beginPath(); c.moveTo(80, 28); c.lineTo(94, 32); c.lineTo(100, 26); c.stroke(); // 앞 팔
      c.beginPath(); c.moveTo(78, 28); c.lineTo(64, 26); c.lineTo(58, 34); c.stroke();  // 뒤 팔
      c.beginPath(); c.moveTo(70, 40); c.lineTo(84, 46); c.lineTo(84, 58); c.stroke();  // 앞 다리
      c.beginPath(); c.moveTo(70, 40); c.lineTo(60, 50); c.lineTo(46, 52); c.stroke();  // 뒷 다리
      c.beginPath(); c.moveTo(34, 20); c.lineTo(14, 32); c.lineTo(34, 44); c.closePath(); c.fill(); c.fillRect(30, 28, 12, 8); // 화살표
    }));
    sign.castShadow = false; sign.receiveShadow = false; sign.raycast = () => {}; p.add(sign);
  }
  return { parts, beam, lens: [X1 - 0.33, LY, LZ] };
}

export function makeCinema(K) {
  const lv3 = (it) => K.levelOfCell(it.i) === 2;
  // 한 번에 영화관을 차리는 단추. 마스터키를 켠 사람의 마스터 탭(master.js 의 #masterP)에만 있다. 다른 사람은 가구 탭의 영화관 소품으로 직접 차린다
  const row = document.createElement('div'), btn = document.createElement('button');
  row.className = 'row'; row.id = 'cineRow'; row.hidden = true;
  btn.type = 'button'; btn.className = 'btn'; btn.id = 'cineBtn'; btn.style.flex = '1';
  row.appendChild(btn);
  let armed = 0; // 한 번 누른 때 (5초 안에 한 번 더 누르면 바꾼다)
  const label = () => { btn.textContent = armed ? `한 번 더 누르면 3층 가구 ${[...K.S().items.values()].filter(lv3).length}개를 치우고 영화관을 차려요` : '🎬 3층을 영화관으로 바꾸기'; btn.classList.toggle('main', !!armed); };
  label();
  // 3층의 가구를 모두 치우고 영화관을 차린다. 놓은 가구 수를 돌려준다 (못 했으면 -1)
  function convert() {
    if (!K.isMaster() || !K.canEdit()) return -1;
    const S = K.S(), old = [...S.items.values()].filter(lv3).map((it) => it.id);
    if (S.items.size - old.length + CINEMA.length > MAX_ITEMS) { K.toast('가구가 너무 많아서 영화관을 차릴 수 없어요. 다른 층의 가구를 조금 치워 주세요'); return -1; }
    for (const id of old) K.op({ t: 'del', id });
    let n = 0;
    for (const [k, a, j, r] of CINEMA) if (K.op({ t: 'put', id: K.newId(), k, i: 2 * FLOOR_DI + a, j, r })) n++;
    K.toast('🎬 3층이 영화관이 됐어요! 스크린 앞에서 영화를 틀어 보세요');
    return n;
  }
  btn.addEventListener('click', () => {
    if (armed && performance.now() - armed < 5000) { armed = 0; label(); convert(); return; }
    armed = performance.now(); label();
  });
  let fix = null; // 영화관일 때 3층에 붙는 것들 (처음 영화관이 될 때 만든다)
  const v3 = new THREE.Vector3(), v3b = new THREE.Vector3();
  // 액자에 넣은 사진의 재질 (지문마다 하나. 그림이 다 읽히면 mat 이 생긴다)
  const picMats = new Map();
  function picMat(h) {
    let r = picMats.get(h);
    if (!r) {
      const d = K.photo(h);
      if (!d) return null;
      r = { mat: null }; picMats.set(h, r);
      const img = new Image();
      img.onload = () => {
        if (picMats.get(h) !== r || !img.naturalWidth || img.naturalWidth > 2048 || img.naturalHeight > 2048) return;
        const tex = new THREE.Texture(img);
        tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.needsUpdate = true;
        r.mat = new THREE.MeshLambertMaterial({ map: tex }); // 방 불을 끄면 사진도 어두워진다
        K.dirty();
      };
      img.src = d;
    }
    return r.mat;
  }
  return {
    convert,
    // 그 가구로 할 수 있는 일의 이름 (영화관 가구가 아니면 null)
    label(it) { return it.k === 'screen' ? '🎬 영화 보기' : K.kindOf(it.k).munch ? '🍿 팝콘 꺼내기' : null; },
    // 가구를 눌렀을 때: 팝콘 기계면 가서 팝콘 한 통을 꺼내 든다 (들고 다니며 한 입씩 먹는다: food.js)
    use(id) {
      const it = K.S().items.get(id);
      if (!it || !K.kindOf(it.k).munch) return false;
      K.approach(id, () => { if (K.mode() === null) K.popcorn(); });
      return true;
    },
    // 3층에 영화관(스크린)이 있는지
    artShown(id) { const g = K.itemObj(id); return !!g && g.children[0].visible; }, // 그 그림이 지금 보이는지 (벽과 같이 숨는다)
    // 그 액자에 지금 걸려 보이는 사진의 지문 ('' = 원래 그림), 사진 그림의 크기 (자동 검사용)
    picShown(id) { const g = K.itemObj(id), m = g && g.userData.pic && g.userData.pic.material; for (const [h, r] of picMats) if (r.mat === m) return { h, w: r.mat.map.image.naturalWidth, hgt: r.mat.map.image.naturalHeight }; return { h: '' }; },
    get theater() { return K.room.theater; }, get beam() { return !!(fix && fix.beam.visible); }, get fixtures() { return fix ? fix.parts.filter((p) => p.visible).length : 0; },
    get has() { for (const it of K.S().items.values()) if (it.k === 'screen' && lv3(it)) return true; return false; },
    tick() {
      const show = K.isMaster() && K.canEdit(), panel = document.getElementById('masterP');
      if (panel && row.parentNode !== panel) panel.insertBefore(row, panel.lastChild); // 마스터 탭이 만들어진 뒤에 그 안에 넣는다 (맨 아래 '마스터키 끄기' 줄 위)
      if (armed && performance.now() - armed >= 5000) { armed = 0; label(); }
      if (row.hidden !== !show) { row.hidden = !show; if (K.mode() === 'master') K.measure(); }
      const S = K.S();
      let screen = null, live = 0;
      for (const it of S.items.values()) {
        if (it.k === 'screen' && lv3(it)) screen = screen || it;
        if (!PAINT[it.k]) continue;
        const g = K.itemObj(it.id), lv = K.levelOfCell(it.i), a = it.i - lv * FLOOR_DI;
        if (!g) continue;
        // 벽에 건 그림은 그 벽이 내려가 있을 때(화면을 돌려 벽 뒤에서 볼 때) 같이 숨긴다. 안 그러면 액자 뒷면이 허공에 뜬다
        const side = it.r === 0 && it.j === 0 ? 'n' : it.r === 2 && it.j === NZ - 1 ? 's' : it.r === 1 && a === 0 ? 'w' : it.r === 3 && a === NX - 1 ? 'e' : null;
        const on = !side || K.wallShown(lv, side);
        if (g.children[0].visible !== on) { for (const c of g.children) c.visible = on; K.dirty(); }
        // 사진을 넣은 액자는 그 사진을 보여 준다 (아직 사진을 못 받았으면 원래 그림)
        const h = S.pics.get(it.id), m = (h && picMat(h)) || artMat(it.k), pl = g.userData.pic;
        if (h) live++;
        if (pl && pl.material !== m) { pl.material = m; K.dirty(); }
      }
      if (picMats.size > live || (!live && picMats.size)) { const u = new Set(S.pics.values()); for (const [h, r] of [...picMats]) if (!u.has(h)) { picMats.delete(h); if (r.mat) { r.mat.map.dispose(); r.mat.dispose(); } } } // 안 쓰는 사진 그림은 버린다
      // 3층에 스크린이 있는 동안은 3층이 영화관답게 된다: 어두운 벽·카펫, 벽 등, 영사실, 비상구 표시
      if (K.room.setTheater(!!screen)) {
        if (screen && !fix) fix = buildFixtures(K.room.floors[2]);
        if (fix) for (const p of fix.parts) p.visible = !!screen;
        K.dirty();
      }
      // 영사기 빛줄기: 스크린에 동영상이 나오는 동안, 렌즈에서 스크린까지
      const g = screen && K.itemObj(screen.id), lit = !!(fix && g && K.showing() && K.level() === 2);
      if (fix && fix.beam.visible !== lit) { fix.beam.visible = lit; K.dirty(); }
      if (lit) {
        const f = K.room.floors[2], b = fix.beam;
        g.updateMatrixWorld();
        const to = g.localToWorld(v3.set(0, SCREEN.y, -0.16)), d = f.g.worldToLocal(v3b.copy(to)).sub(b.position.set(...fix.lens)).length();
        if (Math.abs(b.scale.z - d) > 1e-3 || !b.userData.to || b.userData.to.distanceToSquared(to) > 1e-6) { b.userData.to = to.clone(); b.lookAt(to); b.scale.set(SCREEN.w, SCREEN.h, d); K.dirty(); }
      }
    },
  };
}
