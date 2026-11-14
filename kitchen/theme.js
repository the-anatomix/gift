// 계절 판 설정. 주방의 색과 계절 소품은 여기 한 곳에서 바꾼다.
// 새 판을 만들 때: THEMES 에 항목을 하나 더 넣고 colors / ui / props 를 채운 뒤, seasonOf 에 날짜를 적는다.
// 어느 판으로 열지는 themeId 가 정한다: 주소의 ?theme=이름 > 선물 링크에 적힌 판 > 오늘 날짜.

// 화면에 계정 이름을 표기할 자리. 확정되면 여기만 채운다(비워 두면 아무것도 나오지 않는다).
export const SITE = { account: '' };

const base = {
  id: 'base',
  name: '기본',
  // 3D 주방 색
  colors: {
    cream: 0xFBF3E4, wall: 0xF4E4CA, floor: 0xE6CDAA, slab: 0xD3B48C, top: 0x7A5137, wood: 0xC99A6B,
    choc: 0x5A3824, dark: 0x3B2619, accent: 0xD9483B, accentSoft: 0xE8776A, dough: 0xF1D9A8, biscuit: 0xDDAA66,
    metal: 0xD9D0C3, white: 0xFFFAF0, window: 0xFFF1CC, ovenGlow: 0xF7B25A,
  },
  // 화면(버튼·배경) 색. index.html 의 CSS 변수로 들어간다.
  ui: { '--bg': '#FFF8EC', '--choc': '#5A3824', '--accent': '#D9483B' },
  // 계절 소품. k = { THREE, scene, put, rbox, cyl, C, TOP_Y } 로 도형을 놓는다.
  // 움직이는 소품이 있으면 함수를 돌려준다. 주방이 쉬는 동안에도 1초에 열 번쯤 tick(지금 시각)으로 불린다.
  props(k) {
    // 러그
    k.put(k.rbox(1.9, 0.025, 0.6, 0.012), k.C.accent, 0.1, 0.02, 1.9, k.scene, false);
    k.put(k.rbox(1.6, 0.027, 0.36, 0.012), k.C.accentSoft, 0.1, 0.021, 1.9, k.scene, false);
  },
};

/* ───────── 크리스마스 판 ───────── */
const X = { green: 0x2F6B4F, deep: 0x1F5A41, red: 0xC8372D, gold: 0xE7B441, snow: 0xFFFFFF, night: 0x34507A };
// 작은 트리: 화분 + 세 단 + 별 + 방울. 주방 바닥과 받는 화면의 받침 위에서 같이 쓴다.
function tree(k, parent, x, z, s) {
  const g = new k.THREE.Group(); g.name = 'tree'; g.position.set(x, 0, z); g.scale.setScalar(s); parent.add(g);
  k.put(k.cyl(0.13, 0.1, 0.16, 12), X.red, 0, 0.08, 0, g);
  k.put(k.cyl(0.04, 0.04, 0.14, 8), k.C.top, 0, 0.22, 0, g, false);
  const tiers = [[0.36, 0.44, 0.48], [0.28, 0.38, 0.74], [0.2, 0.34, 0.98]]; // 반지름, 높이, 가운데 높이
  const balls = [X.red, X.gold, 0xFFF6E2];
  tiers.forEach(([r, h, y], i) => {
    k.put(k.cyl(0, r, h, 9), i === 1 ? X.green : X.deep, 0, y, 0, g);
    const n = 6 - i;
    for (let j = 0; j < n; j++) { // 방울은 단마다 아래쪽 가장자리에 돌려 단다
      const a = (j / n) * Math.PI * 2 + i * 0.7, f = 0.22, rr = r * (1 - f) + 0.012;
      k.put(new k.THREE.SphereGeometry(0.03, 8, 6), balls[(i + j) % 3], Math.cos(a) * rr, y - h / 2 + h * f, Math.sin(a) * rr, g, false);
    }
  });
  const star = k.put(new k.THREE.OctahedronGeometry(0.07), new k.THREE.MeshBasicMaterial({ color: 0xFFD866 }), 0, 1.2, 0, g, false); star.scale.set(1, 1.25, 0.6);
  return g;
}
// 선물 상자 하나 (리본 한 줄)
function present(k, parent, x, z, w, h, hex, rib, ry) {
  const g = new k.THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; parent.add(g);
  k.put(k.rbox(w, h, w, 0.012), hex, 0, h / 2, 0, g);
  k.put(new k.THREE.BoxGeometry(w * 0.2, h + 0.006, w + 0.006), rib, 0, h / 2, 0, g, false);
  k.put(new k.THREE.BoxGeometry(w + 0.006, h + 0.006, w * 0.2), rib, 0, h / 2, 0, g, false);
  return g;
}
const xmas = {
  id: 'xmas',
  name: '크리스마스',
  tag: '🎄 크리스마스 판', // 위 막대에 붙는 이름표
  colors: Object.assign({}, base.colors, {
    wall: 0xD9E3CC, floor: 0xE3CBA6, slab: 0xC9AE86, accent: X.red, accentSoft: 0xE0695C,
    window: X.night, stageRing: X.green,
  }),
  ui: {
    '--bg': '#F7F5EA', '--choc': '#1F5A41', '--accent': '#C8372D',
    '--bg1': '#FDFCF6', '--bg2': '#EEF1E2', '--bg3': '#D9E3CC', '--rv1': '#FBFBF4', '--rv2': '#E3ECDA', '--rv3': '#BCD0B8',
  },
  // 포장 상자 · 글자색 · 스프링클 색 (개수는 기본 판과 같게 둔다. 선물 링크에는 번호만 담긴다)
  boxes: [
    { name: '크림', hex: 0xFFF1DA, ribbon: X.red },
    { name: '빨강', hex: X.red, ribbon: X.gold },
    { name: '초록', hex: X.deep, ribbon: X.gold },
    { name: '금빛', hex: 0xEBC25E, ribbon: X.red },
  ],
  textColors: [
    { name: '크림', css: '#FFF6E2' }, { name: '초콜릿', css: '#5A3824' }, { name: '빨강', css: '#D0392E' },
    { name: '초록', css: '#2F7A55' }, { name: '금빛', css: '#F2C24B' },
  ],
  sprinkle: { dot: '#C8372D', colors: [0xFFFFFF, 0xD0392E, 0xF2C24B, 0x3C8F63, 0x1F6A48] },
  // 받는 화면과 자랑 카드
  snow: true,                       // 받는 화면에 눈이 내린다(CSS)
  hello: '크리스마스 선물이 도착했어요.',
  orn: '❄',                         // 편지지 머리 장식
  sparks: ['✨', '❄️', '⭐'],
  card: { bg: ['#FBFBF4', '#E3ECDA', '#BCD0B8'], accent: '#C8372D', tape: 'rgba(200,55,45,.5)', foot: '#4F6B58', orn: '❄', label: ' · 크리스마스 판', snow: true },
  props(k) {
    const T = k.THREE, root = new T.Group(); root.name = 'season'; k.scene.add(root);
    const basic = (hex) => new T.MeshBasicMaterial({ color: hex });
    // 러그: 초록 바탕에 크림색 안쪽
    k.put(k.rbox(1.9, 0.025, 0.6, 0.012), X.green, 0.1, 0.02, 1.9, root, false);
    k.put(k.rbox(1.6, 0.027, 0.36, 0.012), 0xF4EAD2, 0.1, 0.021, 1.9, root, false);
    // 트리와 선물: 조리대에 가리지 않는 앞쪽 바닥 구석
    tree(k, root, 1.82, 1.72, 0.92);
    present(k, root, 1.42, 2.02, 0.2, 0.16, X.red, X.gold, 0.3);
    present(k, root, 1.62, 2.16, 0.15, 0.12, 0xFFF1DA, X.red, -0.4);
    // 리스: 창과 선반 사이 벽
    const wr = new T.Group(); wr.name = 'wreath'; wr.position.set(0.02, 2.14, -2.105); root.add(wr);
    k.put(new T.TorusGeometry(0.19, 0.06, 7, 16), X.deep, 0, 0, 0, wr);
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + 0.5; k.put(new T.SphereGeometry(0.024, 8, 6), X.red, Math.cos(a) * 0.19, Math.sin(a) * 0.19, 0.055, wr, false); }
    for (const sx of [-1, 1]) { const b = k.put(new T.SphereGeometry(0.06, 8, 6), X.red, sx * 0.055, -0.2, 0.05, wr, false); b.scale.set(1, 0.6, 0.45); b.rotation.z = sx * 0.5; }
    k.put(new T.SphereGeometry(0.028, 8, 6), X.gold, 0, -0.2, 0.065, wr, false);
    // 꼬마전구: 뒷벽 위쪽에 늘어뜨린 줄. 색마다 재질 하나를 같이 써서 반짝일 때 재질 색만 바꾼다
    const li = new T.Group(); li.name = 'lights'; root.add(li);
    const pins = [-2.05, -1.03, 0, 1.03, 2.06], pts = [], Y = 2.56, Z = -2.13;
    for (let i = 0; i < pins.length - 1; i++) for (let j = 0; j < 6; j++) { const f = j / 6; pts.push(new T.Vector3(pins[i] + (pins[i + 1] - pins[i]) * f, Y - Math.sin(f * Math.PI) * 0.13, Z)); }
    pts.push(new T.Vector3(pins[pins.length - 1], Y, Z));
    k.put(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 48, 0.006, 4), X.deep, 0, 0, 0, li, false);
    const BULB = [[0xFF5A4A, 0x9E3A32], [0xFFD866, 0xA88A3C], [0x6FD08A, 0x3F7A52], [0xFFF6E2, 0xB3AC9C]]; // 켜진 색, 꺼진 색
    const bulbM = BULB.map((c) => basic(c[0])), bulbG = new T.SphereGeometry(0.034, 8, 6);
    pts.forEach((p, i) => { if (i % 6) { const b = k.put(bulbG, bulbM[i % 4], p.x, p.y - 0.035, p.z + 0.01, li, false); b.scale.y = 1.25; } });
    // 눈 내리는 창: 밤하늘 유리(colors.window) 위에 달, 쌓인 눈, 눈송이
    const sn = new T.Group(); sn.name = 'snow'; sn.position.set(-0.95, 1.95, -2.083); root.add(sn);
    k.put(new T.CircleGeometry(0.07, 14), basic(0xFFF3C4), 0.28, 0.2, 0, sn, false);
    const white = basic(X.snow);
    for (const [x, r] of [[-0.3, 0.2], [0.05, 0.26], [0.34, 0.16]]) { const m = k.put(new T.CircleGeometry(r, 14, 0, Math.PI), white, x, -0.36, 0.0005, sn, false); m.scale.y = 0.4; }
    const N = 24, flakes = new T.InstancedMesh(new T.CircleGeometry(0.013, 6), white, N), mat4 = new T.Matrix4();
    const fl = Array.from({ length: N }, (_, i) => ({ x: ((i * 0.618) % 1 - 0.5) * 0.86, ph: (i * 0.377) % 1, v: 0.05 + (i % 5) * 0.012, s: 0.7 + (i % 3) * 0.3 }));
    flakes.frustumCulled = false; sn.add(flakes);
    function snowAt(t) { // t 초
      fl.forEach((f, i) => {
        const y = 0.35 - ((f.ph + t * f.v) % 1) * 0.7, x = Math.max(-0.44, Math.min(0.44, f.x + Math.sin(t * 0.8 + i) * 0.025));
        mat4.makeScale(f.s, f.s, 1).setPosition(x, y, 0.001); flakes.setMatrixAt(i, mat4);
      });
      flakes.instanceMatrix.needsUpdate = true;
    }
    snowAt(0);
    return (now) => {
      snowAt(now / 1000);
      const step = Math.floor(now / 700); // 전구는 색 두 가지씩 번갈아 어두워진다
      bulbM.forEach((m, i) => m.color.setHex(BULB[i][(i + step) % 4 === 0 ? 1 : 0]));
    };
  },
  // 받는 화면·자랑 카드의 둥근 받침 위에 놓는 소품. g 는 받침(가운데가 0,0, 윗면이 y=0)
  stage(k, g) {
    tree(k, g, -0.42, -0.2, 0.5);
    present(k, g, 0.46, 0.1, 0.13, 0.1, X.red, X.gold, 0.4);
    present(k, g, 0.36, 0.3, 0.1, 0.08, X.deep, X.gold, -0.3);
  },
};

export const THEMES = { base, xmas };
export const DEFAULT_THEME = 'base';
const has = (id) => typeof id === 'string' && Object.prototype.hasOwnProperty.call(THEMES, id);

// 날짜로 정하는 판: 12월 1일부터 25일까지는 크리스마스 판 (기기의 현지 날짜)
export function seasonOf(date) {
  return date.getMonth() === 11 && date.getDate() <= 25 ? 'xmas' : DEFAULT_THEME;
}
// 선물 링크(#g=…)에 적힌 판. 적혀 있지 않은 예전 링크는 기본 판이다
function giftTheme(txt) {
  try {
    const s = atob(txt.replace(/-/g, '+').replace(/_/g, '/'));
    const o = JSON.parse(new TextDecoder().decode(Uint8Array.from(s, (c) => c.charCodeAt(0))));
    return o && has(o.t) ? o.t : DEFAULT_THEME;
  } catch (_) { return DEFAULT_THEME; }
}
// 어느 판으로 열지: 주소의 ?theme= 이 가장 먼저, 다음은 선물 링크에 적힌 판(만든 사람의 판 그대로), 없으면 날짜
export function themeId(search, hash, date) {
  const q = new URLSearchParams(search).get('theme');
  if (has(q)) return q;
  const m = /^#g=([A-Za-z0-9_-]+)$/.exec(hash || '');
  return m ? giftTheme(m[1]) : seasonOf(date);
}
let picked = null; // 한 번 정하면 화면을 닫을 때까지 바꾸지 않는다
export function pickTheme() {
  return picked || (picked = THEMES[themeId(location.search, location.hash, new Date())]);
}
// 초대·이어 굽기 링크에 붙일 주소 뒷부분: 날짜로 정해진 계절 판이면 ?theme= 을 적어 상대도 같은 판으로 열리게 한다
export function themeSearch() {
  const t = pickTheme(), q = new URLSearchParams(location.search);
  if (t.id === DEFAULT_THEME || q.get('theme') === t.id) return location.search;
  q.set('theme', t.id);
  return '?' + q.toString();
}
