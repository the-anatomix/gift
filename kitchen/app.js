// 갓 구운 선물 · 미니 주방
// 정적 파일만 사용한다. three.js 는 ./vendor 에 함께 들어 있다(MIT).
import * as THREE from './vendor/three.module.min.js';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { pickTheme, SITE } from './theme.js';
import { stations as STATION_MODS } from './stations/index.js';

const $ = (id) => document.getElementById(id);
const canvas = $('c');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ───────── 렌더러 ───────── */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
} catch (e) {
  window.__fallback();
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;

const scene = new THREE.Scene();
const FOV = 32;
const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60);

/* ───────── 색 ───────── */
const THEME = pickTheme();
const C = THEME.colors; // 색과 계절 소품은 theme.js 한 곳에서 바꾼다
for (const k in THEME.ui) document.documentElement.style.setProperty(k, THEME.ui[k]);
if (SITE.account) { const a = $('account'); a.textContent = SITE.account; a.hidden = false; }
const CHOCO = [
  { name: '밀크', hex: 0x7B4A2D },
  { name: '다크', hex: 0x3E2418 },
  { name: '화이트', hex: 0xF6E9D2 },
  { name: '딸기', hex: 0xF2A0AE },
  { name: '말차', hex: 0x9DB86A },
];
const TEXT_COLORS = [
  { name: '크림', css: '#FFF6E2' }, { name: '초콜릿', css: '#5A3824' }, { name: '빨강', css: '#D9483B' },
  { name: '분홍', css: '#F28B9B' }, { name: '노랑', css: '#F6C85F' },
];
const KINDS = [
  { id: 'sprinkle', name: '스프링클', dot: '#F28B9B', step: 9, colors: [0xFFFFFF, 0xF28B9B, 0xF6C85F, 0x9AD0C2, 0xD9483B] },
  { id: 'heart', name: '하트', dot: '#E8505B', step: 15, colors: [0xE8505B, 0xF7A1B0] },
  { id: 'star', name: '별', dot: '#F6C85F', step: 15, colors: [0xF6C85F, 0xFFF3C4] },
  { id: 'nut', name: '견과', dot: '#C8935A', step: 11, colors: [0xC8935A, 0xA9713F, 0xE0B982] },
];

/* ───────── 도형 도우미 ───────── */
const mats = new Map();
function M(hex) {
  let m = mats.get(hex);
  if (!m) { m = new THREE.MeshLambertMaterial({ color: hex }); mats.set(hex, m); }
  return m;
}
function put(geo, mat, x, y, z, parent = scene, cast = true) {
  const m = new THREE.Mesh(geo, typeof mat === 'number' ? M(mat) : mat);
  m.position.set(x, y, z);
  m.castShadow = cast; m.receiveShadow = true;
  parent.add(m);
  return m;
}
function rbox(w, h, d, r = 0.03) {
  return new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
}
const cyl = (rt, rb, h, seg = 18) => new THREE.CylinderGeometry(rt, rb, h, seg);

/* ───────── 조명 (그림자는 한 조명만) ───────── */
scene.add(new THREE.HemisphereLight(0xFFF3DF, 0xD8B48A, 1.55));
const sun = new THREE.DirectionalLight(0xFFE3BC, 2.1);
sun.position.set(3.2, 6.5, 4.2);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -3.6; sun.shadow.camera.right = 3.6;
sun.shadow.camera.top = 3.6; sun.shadow.camera.bottom = -3.6;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 16;
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02; sun.shadow.radius = 5;
scene.add(sun);

/* ───────── 주방 ───────── */
const TOP_Y = 0.91; // 조리대 윗면 높이
const POT = { x: 0, z: 0.75 };
const TRAY = { x: 0.95, z: 0.75 };

function buildRoom() {
  put(rbox(4.8, 0.24, 4.8, 0.08), C.slab, 0.05, -0.13, 0.05);
  put(new THREE.BoxGeometry(4.5, 0.02, 4.5), C.floor, 0.1, 0, 0.1, scene, false);
  put(rbox(4.75, 2.7, 0.16, 0.05), C.wall, 0.05, 1.35, -2.24);
  put(rbox(0.16, 2.7, 4.6, 0.05), C.wall, -2.24, 1.35, 0.12);
  // 창
  put(rbox(1.1, 0.9, 0.08, 0.03), C.white, -0.95, 1.95, -2.14);
  put(new THREE.BoxGeometry(0.92, 0.72, 0.02), new THREE.MeshBasicMaterial({ color: C.window }), -0.95, 1.95, -2.095, scene, false);
  put(new THREE.BoxGeometry(0.04, 0.72, 0.03), C.white, -0.95, 1.95, -2.09, scene, false);
  put(new THREE.BoxGeometry(0.92, 0.04, 0.03), C.white, -0.95, 1.95, -2.09, scene, false);
  // 선반
  put(rbox(1.3, 0.05, 0.3, 0.02), C.top, 1.1, 1.8, -2.02);
  put(cyl(0.1, 0.1, 0.22), C.cream, 0.65, 1.94, -2.02);
  put(cyl(0.105, 0.105, 0.04), C.choc, 0.65, 2.07, -2.02);
  put(cyl(0.08, 0.08, 0.16), C.cream, 0.92, 1.91, -2.02);
  put(cyl(0.085, 0.085, 0.04), C.accent, 0.92, 2.01, -2.02);
  put(cyl(0.15, 0.09, 0.09, 20), C.white, 1.35, 1.87, -2.02);
  put(cyl(0.15, 0.09, 0.09, 20), C.white, 1.35, 1.92, -2.02);
}

function buildCounters() {
  // 뒤 조리대
  put(rbox(4.1, 0.78, 0.82, 0.03), C.cream, -0.1, 0.45, -1.74);
  put(new THREE.BoxGeometry(4.0, 0.08, 0.7), C.choc, -0.1, 0.04, -1.76, scene, false);
  put(rbox(4.16, 0.07, 0.9, 0.025), C.top, -0.1, 0.875, -1.72);
  // 앞 조리대(섬)
  put(rbox(3.0, 0.78, 1.25, 0.03), C.cream, 0, 0.45, 0.75);
  put(new THREE.BoxGeometry(2.9, 0.08, 1.15), C.choc, 0, 0.04, 0.75, scene, false);
  put(rbox(3.2, 0.07, 1.45, 0.025), C.top, 0, 0.875, 0.75);
  for (const x of [-1, 0, 1]) put(rbox(0.3, 0.035, 0.04, 0.015), C.top, x, 0.68, 1.39, scene, false);
}

let chocoSurf, chocoMat;
const POT_H = 0.34;
const SURF_Y = TOP_Y + POT_H + 0.012;
function buildChoco() {
  const g = new THREE.Group(); g.position.set(POT.x, TOP_Y, POT.z); scene.add(g);
  put(cyl(0.27, 0.23, POT_H, 24), C.white, 0, POT_H / 2, 0, g);
  put(cyl(0.285, 0.285, 0.03, 24), C.white, 0, POT_H - 0.015, 0, g, false);
  for (const sx of [-1, 1]) put(rbox(0.1, 0.035, 0.14, 0.015), C.accent, sx * 0.32, POT_H - 0.05, 0, g);
  chocoMat = new THREE.MeshPhongMaterial({ color: CHOCO[0].hex, shininess: 70, specular: 0x554433 });
  chocoSurf = put(cyl(0.245, 0.245, 0.02, 24), chocoMat, 0, POT_H + 0.003, 0, g, false);
  // 초콜릿 조각
  const b1 = put(rbox(0.16, 0.035, 0.1, 0.01), C.choc, -0.42, 0.018, 0.34, g); b1.rotation.y = 0.4;
  const b2 = put(rbox(0.1, 0.035, 0.1, 0.01), C.choc, -0.3, 0.018, 0.46, g); b2.rotation.y = -0.3;
}

function buildTopping() {
  const g = new THREE.Group(); g.position.set(TRAY.x, TOP_Y, TRAY.z); scene.add(g);
  put(rbox(0.52, 0.03, 1.06, 0.015), C.metal, 0, 0.015, 0, g);
  put(new THREE.BoxGeometry(0.46, 0.006, 1.0), C.white, 0, 0.033, 0, g, false);
  const glass = new THREE.MeshLambertMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.38, depthWrite: false });
  const fill = [0xF28B9B, 0xE8505B, 0xF6C85F, 0xC8935A];
  for (let i = 0; i < 4; i++) {
    const z = -0.4 + i * 0.27;
    put(cyl(0.075, 0.075, 0.13, 14), fill[i], 0.42, 0.065, z, g);
    put(cyl(0.09, 0.09, 0.2, 14), glass, 0.42, 0.1, z, g, false).renderOrder = 2;
    put(cyl(0.095, 0.095, 0.035, 14), C.accent, 0.42, 0.215, z, g);
  }
}

/* ───────── 막대과자 ───────── */
const STICK = { L: 0.8, R: 0.05, handle: 0.2 };
const stick = new THREE.Group();
const coatGroup = new THREE.Group();
const coatCyl = cyl(1, 1, 1, 16).translate(0, 0.5, 0);
const coatCap = new THREE.SphereGeometry(1, 16, 8);
const coatMats = new Map();
const inst = {};
const MAX_GRAINS = 480;
const biscuitMat = new THREE.MeshLambertMaterial({ color: C.biscuit });
const DIP = { best: 0.52, tol: 0.012 }; // 완벽 기준: 과자의 금에서 벗어난 정도

function buildStick() {
  put(cyl(STICK.R, STICK.R, STICK.L, 16).translate(0, STICK.L / 2, 0), biscuitMat, 0, 0, 0, stick);
  stick.add(coatGroup);
  put(cyl(STICK.R + 0.0012, STICK.R + 0.0012, 0.007, 16), 0xB5823F, 0, DIP.best, 0, stick, false); // 여기까지 담그라는 금
  const heart = new THREE.Shape();
  heart.moveTo(0, -0.9); heart.bezierCurveTo(-1.5, 0.1, -0.9, 1.1, 0, 0.45); heart.bezierCurveTo(0.9, 1.1, 1.5, 0.1, 0, -0.9);
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.45 : 1, a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    star[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
  const flat = (shape, size) => new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: false, curveSegments: 5 })
    .rotateX(-Math.PI / 2).scale(size, size, size);
  const geos = {
    sprinkle: new THREE.CapsuleGeometry(0.0075, 0.026, 2, 6).rotateZ(Math.PI / 2).translate(0, 0.006, 0),
    heart: flat(heart, 0.019),
    star: flat(star, 0.02),
    nut: new THREE.IcosahedronGeometry(0.016, 0).scale(1.15, 0.65, 0.85).translate(0, 0.006, 0),
  };
  const white = new THREE.Color(0xffffff);
  for (const k of KINDS) {
    const im = new THREE.InstancedMesh(geos[k.id], new THREE.MeshLambertMaterial({ color: 0xffffff }), MAX_GRAINS);
    im.setColorAt(0, white); im.count = 0; im.frustumCulled = false;
    stick.add(im); inst[k.id] = im;
  }
  scene.add(stick);
}

buildRoom(); buildCounters(); buildChoco(); buildTopping(); buildStick();
THEME.props({ THREE, scene, put, rbox, cyl, C, TOP_Y });

/* ───────── 상태 ─────────
   화면에 보이는 것은 모두 S 에서 나온다. 바꿀 때는 dispatch(사건) 한 곳으로만 바꾼다. */
const S = {
  station: 'home',
  color: 0,          // 그릇에 담긴 초콜릿 색
  layers: [],        // 코팅 [{c: 색 번호, len: 끝에서부터 길이}]
  grains: [],        // 토핑 [{k, s, u, sp, sc, c, st(획 id), born}]
  backup: null,      // 지우기 직전 토핑 (되돌리기용)
  text: '',          // 새긴 글자 (6자까지)
  tc: -1,            // 글자색 번호 (-1 은 바탕에 맞춰 자동)
};
const cleanText = (v) => Array.from(String(v == null ? '' : v).replace(/\s+/g, ' ')).slice(0, 6).join('');
let kind = 0;

const REST_TIP = SURF_Y + 0.2;
const MAX_DIP = STICK.L * (1 - STICK.handle) - 0.02;
let tipY = REST_TIP;

function coatMat(i) {
  let m = coatMats.get(i);
  if (!m) { m = new THREE.MeshPhongMaterial({ color: CHOCO[i].hex, shininess: 55, specular: 0x443322 }); coatMats.set(i, m); }
  return m;
}
function drawCoat() {
  coatGroup.clear();
  S.layers.forEach((l, i) => {
    const r = STICK.R + 0.007 + i * 0.003;
    const c = put(coatCyl, coatMat(l.c), 0, 0, 0, coatGroup); c.scale.set(r, Math.max(l.len, 0.001), r);
    const cap = put(coatCap, coatMat(l.c), 0, 0, 0, coatGroup, false); cap.scale.set(r, r * 0.45, r);
  });
}
// 새긴 글자: 캔버스에 그려 과자 윗면을 따라 붙인다 (사용자 글자는 캔버스 fillText 로만 그린다)
const TXT = { s0: 0.07, len: 0.5, arc: 1.7 };
const txtCanvas = document.createElement('canvas'); txtCanvas.width = 128; txtCanvas.height = 768;
const txtTex = new THREE.CanvasTexture(txtCanvas);
txtTex.colorSpace = THREE.SRGBColorSpace; txtTex.center.set(0.5, 0.5); txtTex.rotation = Math.PI; txtTex.anisotropy = 4;
const txtMesh = new THREE.Mesh(
  new THREE.CylinderGeometry(1, 1, TXT.len, 14, 1, true, Math.PI - TXT.arc / 2, TXT.arc),
  new THREE.MeshLambertMaterial({ map: txtTex, transparent: true, depthWrite: false }));
txtMesh.position.y = TXT.s0 + TXT.len / 2; txtMesh.visible = false; txtMesh.renderOrder = 1;
stick.add(txtMesh);
// 고른 글자색. 고르지 않았으면 밝은 바탕에는 갈색, 초콜릿 위에는 크림색
function textCss(top) {
  if (top === undefined) { const mid = TXT.s0 + TXT.len / 2; top = null; S.layers.forEach((l) => { if (mid <= l.len) top = l.c; }); }
  return TEXT_COLORS[S.tc] ? TEXT_COLORS[S.tc].css : (top === 2 || top == null ? '#5A3824' : '#FFF6E2');
}
function drawText() {
  const chars = Array.from(S.text);
  txtMesh.visible = chars.length > 0;
  if (!chars.length) return;
  const g = txtCanvas.getContext('2d'), cell = 128;
  g.clearRect(0, 0, 128, 768);
  const mid = TXT.s0 + TXT.len / 2;
  let top = null; S.layers.forEach((l) => { if (mid <= l.len) top = l.c; });
  g.fillStyle = textCss(top);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 96px "Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif';
  const y0 = (768 - chars.length * cell) / 2;
  chars.forEach((ch, i) => g.fillText(ch, 64, y0 + cell * (i + 0.5) + 4, 120));
  txtTex.needsUpdate = true;
  const r = surfR(mid) + 0.0015; txtMesh.scale.set(r, 1, r);
}
// 만들기 점수: 0 아직, 1 했음, 2 완벽. 네 가지가 모두 완벽이면 칭호를 준다
function chocoGrade() {
  if (!S.layers.length) return 0;
  return S.layers.length === 1 && Math.abs(S.layers[0].len - DIP.best) <= DIP.tol ? 2 : 1;
}
function grades() {
  const q = { dough: mods.dough.grade(), cut: mods.cut.grade(), oven: mods.oven.grade(), choco: chocoGrade() };
  const all = [q.dough, q.cut, q.oven, q.choco], stars = all.filter((v) => v === 2).length;
  q.perfect = stars === 4;
  // 등급: 네 자리를 다 해야 붙는다. ★ 넷이면 최고급(2), 둘·셋이면 고급(1), 그보다 적으면 수제(3)
  q.tier = !all.every((v) => v >= 1) ? 0 : stars === 4 ? 2 : stars >= 2 ? 1 : 3;
  q.stars = stars;
  return q;
}
// 만드는 순서와 자리별 진행 (탭의 ☆★ 표시, 전체 화면의 다음 차례 안내에 쓴다)
const ORDER = ['dough', 'cut', 'oven', 'choco', 'top', 'pack'];
let tabsReady = false;
function progress() {
  const q = grades();
  const pr = { dough: q.dough, cut: q.cut, oven: q.oven, choco: q.choco, top: S.grains.length || S.text ? 1 : 0, pack: mods.pack.packed() ? 1 : 0 };
  pr.next = ORDER.find((id) => !pr[id]) || null;
  return pr;
}
function updateTabs() {
  if (!tabsReady) return;
  const pr = progress();
  for (const id of ORDER) { tabEls[id].dataset.g = pr[id] ? String(pr[id]) : ''; tabEls[id].classList.toggle('next', pr.next === id); }
}
function surfR(s) {
  let r = STICK.R;
  S.layers.forEach((l, i) => { if (s <= l.len) r = STICK.R + 0.007 + i * 0.003; });
  return r;
}

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(),
  _s = new THREE.Vector3(), _n = new THREE.Vector3(), _col = new THREE.Color(), Y = new THREE.Vector3(0, 1, 0);
const FALL_MS = 240, FALL_H = 0.3;
function drawGrains(now) {
  const n = { sprinkle: 0, heart: 0, star: 0, nut: 0 };
  let anim = false;
  for (const g of S.grains) {
    const k = reduceMotion ? 1 : Math.min(1, (now - g.born) / FALL_MS);
    if (k < 1) anim = true;
    const R = surfR(g.s), th = Math.asin(Math.max(-0.95, Math.min(0.95, g.u / STICK.R)));
    _n.set(Math.sin(th), 0, -Math.cos(th));
    _p.set(R * _n.x, g.s, R * _n.z - FALL_H * (1 - k * k));
    _q.setFromUnitVectors(Y, _n); _q2.setFromAxisAngle(Y, g.sp); _q.multiply(_q2);
    _s.setScalar(g.sc);
    const id = KINDS[g.k].id, im = inst[id];
    im.setMatrixAt(n[id], _m.compose(_p, _q, _s));
    im.setColorAt(n[id], _col.setHex(KINDS[g.k].colors[g.c]));
    n[id]++;
  }
  for (const id in n) {
    const im = inst[id];
    im.count = n[id]; im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
  }
  return anim;
}

/* 사건 적용. 나중에 둘이 굽기에서 같은 사건을 상대에게도 보낸다. */
const listeners = [];
function dispatch(a, remote = false) {
  apply(a);
  updateTabs();
  if (!remote) for (const f of listeners) f(a);
  poke(400);
}
function apply(a) {
  switch (a.t) {
    case 'color': S.color = a.c; chocoMat.color.setHex(CHOCO[a.c].hex); break;
    case 'coat': {
      S.layers = S.layers.filter((l) => l.len > a.len + 0.01);
      S.layers.push({ c: a.c, len: a.len });
      if (S.layers.length > 4) S.layers.shift();
      drawCoat(); drawText(); break;
    }
    case 'uncoat': S.layers = []; drawCoat(); drawText(); break;
    case 'text': S.text = cleanText(a.v); drawText(); break;
    case 'tcolor': S.tc = TEXT_COLORS[a.c] ? a.c | 0 : -1; drawText(); break;
    case 'grain':
      if (S.grains.length < MAX_GRAINS && !S.grains.some((g) => g.id === a.id)) {
        S.grains.push({ k: a.k, s: a.s, u: a.u, sp: a.sp, sc: a.sc, c: a.c, st: a.st, id: a.id, born: performance.now() });
      }
      S.backup = null; break;
    case 'undo': {
      if (S.backup) { S.grains = S.backup; S.backup = null; break; }
      let st = null;
      for (let i = S.grains.length - 1; i >= 0; i--) if (a.by == null || String(S.grains[i].st).startsWith(a.by)) { st = S.grains[i].st; break; }
      if (st != null) S.grains = S.grains.filter((g) => g.st !== st);
      break;
    }
    case 'clear': if (S.grains.length) { S.backup = S.grains; S.grains = []; } break;
    case 'st': if (mods[a.s] && mods[a.s].apply) mods[a.s].apply(a.d || {}); return;
    case 'go': go(a.s); return;
  }
  if (S.station === 'choco' || S.station === 'top') renderPanel();
}

/* ───────── 카메라 ───────── */
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const VIEWS = {
  home: { tgt: V3(0.05, 1.0, -0.35), dir: V3(0.38, 0.8, 1), w: 5.15, h: 4.6 },
  dough: { tgt: V3(1.25, 1.1, -1.7), dir: V3(0.15, 0.75, 1), w: 1.5, h: 1.0 },
  cut: { tgt: V3(-0.95, 1.0, 0.75), dir: V3(-0.1, 0.9, 1), w: 1.2, h: 0.9 },
  oven: { tgt: V3(-0.85, 1.2, -1.7), dir: V3(0.1, 0.55, 1), w: 2.1, h: 1.1 },
  choco: { tgt: V3(POT.x, 1.62, POT.z), dir: V3(0.28, 0.5, 1), w: 0.95, h: 1.55 },
  top: { tgt: V3(TRAY.x, TOP_Y + 0.09, TRAY.z), dir: V3(0, 2.6, 1), w: 0.42, h: 0.92 },
  pack: { tgt: V3(0.5, 1.7, -1.7), dir: V3(0.12, 0.42, 1), w: 1.0, h: 1.95 },
};
const cam = { pos: V3(0, 5, 8), tgt: V3(0, 1, 0), off: 0 };
let W = 1, H = 1;
const tanHalf = Math.tan((FOV * Math.PI) / 360);

let viewOverride = null; // 받은 선물 화면처럼 자리와 상관없는 구도
let orbit = false, yaw = 0, pitch = 0; // 받은 선물을 한 손가락으로 돌려 보기
function viewFor(name) {
  const v = viewOverride || VIEWS[name];
  const bottomH = H - $('bottom').getBoundingClientRect().top + (v.pad || 0); // pad: 아래에 더 비워 둘 높이(펼친 편지 등)
  const topH = $('top').getBoundingClientRect().bottom;
  const usable = Math.max(120, H - bottomH - topH);
  const dist = Math.max((v.h / (2 * tanHalf)) * (H / usable), v.w / (2 * tanHalf * (W / H)));
  let dir = v.dir.clone().normalize();
  if (viewOverride && orbit && (yaw || pitch)) { // 손가락으로 돌린 만큼 시점을 옮긴다
    const el = Math.max(0.03, Math.min(1.25, Math.asin(dir.y) + pitch)), az = Math.atan2(dir.x, dir.z) + yaw;
    dir = V3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  }
  return { pos: dir.multiplyScalar(dist).add(v.tgt), tgt: v.tgt.clone(), off: (bottomH - topH) / 2 };
}
function applyCam() {
  camera.position.copy(cam.pos);
  camera.lookAt(cam.tgt);
  camera.setViewOffset(W, H, 0, cam.off, W, H);
}

/* ───────── 움직임 ───────── */
const tweens = new Set();
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeBack = (k) => 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);
function tween(dur, fn, done) {
  const t = { t0: performance.now(), dur: reduceMotion ? 0 : dur, fn, done };
  tweens.add(t); poke(dur + 100);
  return t;
}
let wake = 0;
function poke(ms = 300) { wake = Math.max(wake, performance.now() + ms); }

/* ───────── 자리 이동 ───────── */
const STN = {
  home: { tab: '전체' },
  dough: { tab: '반죽', title: '반죽하기', soon: '가루를 섞고 반죽을 치대는 자리예요.' },
  cut: { tab: '자르기', title: '자르기', soon: '반죽을 밀어 막대 모양으로 자르는 자리예요.' },
  oven: { tab: '굽기', title: '굽기', soon: '오븐에 넣고 알맞게 구워 식히는 자리예요.' },
  choco: { tab: '초콜릿', title: '초콜릿 담그기' },
  top: { tab: '토핑', title: '토핑 뿌리기' },
  pack: { tab: '포장', title: '포장하기', soon: '상자에 담아 포장하는 자리예요.' },
};
const ANCHOR = {
  dough: { at: V3(1.15, 1.5, -1.72), box: [1.3, 0.8, 0.85, 1.25, 1.3, -1.72] },
  cut: { at: V3(-0.95, 1.2, 0.75), box: [1.0, 0.5, 0.9, -0.95, 1.1, 0.75] },
  oven: { at: V3(-1.3, 1.75, -1.72), box: [1.9, 0.9, 0.85, -0.85, 1.3, -1.72] },
  choco: { at: V3(POT.x, 1.72, POT.z), box: [0.75, 0.7, 0.75, POT.x, 1.25, POT.z] },
  top: { at: V3(TRAY.x + 0.15, 1.28, TRAY.z), box: [0.95, 0.5, 1.15, TRAY.x + 0.15, 1.1, TRAY.z] },
  pack: { at: V3(0.6, 2.05, -1.82), box: [0.5, 1.0, 0.5, 0.6, 1.4, -1.82] },
};
// 자리 모듈(반죽·자르기·굽기). 각 파일이 자기 소품과 조작을 맡는다.
const mods = {};
for (const id in STATION_MODS) {
  const kit = {
    THREE, scene, C, M, put, rbox, cyl, TOP_Y, tween, poke, toast, ease, easeBack, reduceMotion,
    station: id,
    active: () => S.station === id,
    send: (d) => dispatch({ t: 'st', s: id, d }),       // 상태를 바꾸는 유일한 길. apply(d) 로 돌아온다(상대에게도 간다)
    repaint: () => { if (S.station === id) { panelKey = ''; renderPanel(); refit(); } },
    setBiscuit: (hex) => { biscuitMat.color.setHex(hex); poke(); },
    judge: (v) => { if (S.station === id) judge(v); },
    stick, restick, grades,
    go: (s) => dispatch({ t: 'go', s }),
  };
  const m = STATION_MODS[id](kit) || {};
  mods[id] = m;
  if (m.view) Object.assign(VIEWS[id], { tgt: V3(...m.view.tgt), dir: V3(...m.view.dir), w: m.view.w, h: m.view.h });
}
const hits = new THREE.Group();
const labelEls = {};
for (const id in ANCHOR) {
  const b = ANCHOR[id].box;
  const m = new THREE.Mesh(new THREE.BoxGeometry(b[0], b[1], b[2])); m.position.set(b[3], b[4], b[5]); m.userData.station = id;
  hits.add(m);
  const el = document.createElement('button'); el.className = 'lab' + (STN[id].soon && !(mods[id] && mods[id].panel) ? '' : ' live'); el.type = 'button';
  const sp = document.createElement('span'); sp.textContent = STN[id].tab; el.appendChild(sp);
  el.setAttribute('aria-label', STN[id].title + ' 자리로 가기');
  el.addEventListener('click', () => dispatch({ t: 'go', s: id }));
  $('labels').appendChild(el); labelEls[id] = el;
}
hits.updateMatrixWorld(true);

const tabEls = {};
for (const id in STN) {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = STN[id].tab; b.setAttribute('role', 'tab');
  b.addEventListener('click', () => dispatch({ t: 'go', s: id }));
  $('tabs').appendChild(b); tabEls[id] = b;
}

const QV = new THREE.Quaternion(); // 세워 든 자세
const QL = new THREE.Quaternion().setFromAxisAngle(V3(1, 0, 0), Math.PI / 2); // 판에 눕힌 자세
const QF = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0.045)); // 손잡이를 아래로, 꾸민 면을 앞으로 (선물 보여 주기)
const QS = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0.13)); // 상자 앞에 꺼내 보여 주는 자세
let presenting = 0; // 0 아님, 1 상자 위로 솟아오름, 2 상자 밖으로 꺼내 보여 줌
function stickPose(name) {
  const pk = mods.pack;
  if (pk && pk.slot) { // 포장했으면 상자 안, 포장 자리에서는 상자 위
    const sl = pk.slot();
    if (presenting === 1) return { p: V3(sl.x, sl.topY + 0.08 + STICK.L, sl.z), q: QF };           // 상자 위로 다 빠져나온 모습
    if (presenting === 2) return { p: V3(sl.x + 0.02, sl.topY - 0.3 + STICK.L, sl.z + 0.52), q: QS }; // 상자 앞에 꺼내 든 모습
    if (pk.packed()) return { p: V3(sl.x, sl.inY, sl.z), q: QV };
    if (name === 'pack') return { p: V3(sl.x, sl.overY, sl.z), q: QV };
  }
  return name === 'choco'
    ? { p: V3(POT.x, REST_TIP, POT.z), q: QV }
    : { p: V3(TRAY.x, TOP_Y + 0.036 + STICK.R + 0.012, TRAY.z - STICK.L / 2 + 0.02), q: QL };
}
// 과자를 지금 자리에 맞는 곳으로 옮긴다 (포장·풀기에서 씀)
let stickTween = null;
function restick(ms, done) {
  if (stickTween) { tweens.delete(stickTween); stickTween = null; }
  const pose = stickPose(S.station), p0 = stick.position.clone(), q0 = stick.quaternion.clone();
  if (!ms) { stick.position.copy(pose.p); stick.quaternion.copy(pose.q); poke(); if (done) done(); return; }
  stickTween = tween(ms, (k) => { const e = ease(k); stick.position.lerpVectors(p0, pose.p, e); stick.quaternion.slerpQuaternions(q0, pose.q, e); },
    () => { stickTween = null; if (done) done(); });
}
// 선물 보여 주기: 과자를 상자 안에서 뒤집어 두고, 상자가 열리면 솟아오르게 한다
function present(n) {
  presenting = n === true ? 1 : n | 0;
  if (presenting === 1 && mods.pack) { const sl = mods.pack.slot(); stick.position.set(sl.x, sl.inY + STICK.L, sl.z); stick.quaternion.copy(QF); }
  else if (presenting === 2) restick(750);
  poke();
}
function setOrbit(v) { orbit = !!v; if (!orbit) { yaw = 0; pitch = 0; } }
function snapCam() { const to = viewFor(S.station); cam.pos.copy(to.pos); cam.tgt.copy(to.tgt); cam.off = to.off; poke(); }
// 판정 표시: 딱 맞추면 PERFECT!, 아니면 GOOD
let judgeT = 0;
function judge(v) {
  const j = $('judge');
  j.textContent = v === 2 ? 'PERFECT!' : 'GOOD'; j.className = v === 2 ? 'p' : 'g';
  j.hidden = false; j.style.animation = 'none'; void j.offsetWidth; j.style.animation = '';
  clearTimeout(judgeT); judgeT = setTimeout(() => { j.hidden = true; }, 1100);
}
// 무대: 주방을 숨기고 선물 상자와 과자만 둥근 받침 위에 보여 준다
let stageOn = false, stageSaved = null, stageDisc = null;
function setStage(on) {
  on = !!on;
  if (on === stageOn || !mods.pack) return;
  stageOn = on;
  if (on) {
    if (!stageDisc) {
      const sl = mods.pack.slot();
      stageDisc = new THREE.Group(); stageDisc.position.set(sl.x - 0.1, TOP_Y, sl.z + 0.12); scene.add(stageDisc);
      put(cyl(0.64, 0.68, 0.05, 44), C.white, 0, -0.026, 0, stageDisc);
      put(cyl(0.7, 0.72, 0.03, 44), C.accentSoft, 0, -0.066, 0, stageDisc, false);
    }
    const keep = new Set([stick, stageDisc, ...mods.pack.stage]);
    stageSaved = new Map();
    for (const o of scene.children) { if (o.isLight) continue; stageSaved.set(o, o.visible); o.visible = keep.has(o); }
  } else {
    for (const [o, v] of stageSaved) o.visible = v;
    stageDisc.visible = false; stageSaved = null;
  }
  poke(400);
}
function setView(spec, ms) { // spec = { tgt:[x,y,z], dir:[x,y,z], w, h } 또는 null(자리 구도로 되돌림)
  viewOverride = spec ? { tgt: V3(...spec.tgt), dir: V3(...spec.dir), w: spec.w, h: spec.h, pad: spec.pad || 0 } : null;
  if (travel) { tweens.delete(travel); travel = null; }
  const to = viewFor(S.station), from = { pos: cam.pos.clone(), tgt: cam.tgt.clone(), off: cam.off };
  const set = (k) => { cam.pos.lerpVectors(from.pos, to.pos, k); cam.tgt.lerpVectors(from.tgt, to.tgt, k); cam.off = from.off + (to.off - from.off) * k; };
  if (!ms) { set(1); poke(); return; }
  tween(ms, (k) => set(ease(k)));
}
// 과자만 투명한 바탕에 찍어 그림으로 돌려준다 (자랑 카드용). 과자 끝이 위, 꾸민 면이 앞.
const QUP = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0));
function snapStick() {
  const hid = [];
  for (const o of scene.children) if (!o.isLight && o !== stick && o.visible) { hid.push(o); o.visible = false; }
  const p0 = stick.position.clone(), q0 = stick.quaternion.clone();
  stick.position.set(0, 50, 0); stick.quaternion.copy(QUP);
  const span = STICK.L * 1.1, cam2 = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 20);
  cam2.position.set(0, 50 - STICK.L / 2, span / (2 * tanHalf)); cam2.lookAt(0, 50 - STICK.L / 2, 0);
  renderer.render(scene, cam2);
  const ppu = canvas.height / span, w = Math.min(canvas.width, Math.ceil(0.24 * ppu));
  const out = document.createElement('canvas'); out.width = w; out.height = canvas.height;
  out.getContext('2d').drawImage(canvas, (canvas.width - w) / 2, 0, w, canvas.height, 0, 0, w, canvas.height);
  stick.position.copy(p0); stick.quaternion.copy(q0);
  for (const o of hid) o.visible = true;
  applyCam(); camera.updateProjectionMatrix(); camera.updateMatrixWorld(); // 같은 순간에 원래 화면을 다시 그려 깜빡이지 않게
  renderer.shadowMap.needsUpdate = true; renderer.render(scene, camera);
  return out;
}
let travel = null, locked = false;
function go(name, instant) {
  if (!STN[name]) return;
  // 포장한 채로 꾸미는 자리에 가면 상자를 다시 연다
  if ((name === 'choco' || name === 'top') && mods.pack && mods.pack.packed && mods.pack.packed()) mods.pack.apply({ open: 1 });
  if (stickTween) { tweens.delete(stickTween); stickTween = null; }
  const changed = S.station !== name;
  if (changed && mods[S.station] && mods[S.station].leave) mods[S.station].leave();
  S.station = name;
  if (changed && mods[name] && mods[name].enter) mods[name].enter();
  for (const id in tabEls) tabEls[id].setAttribute('aria-selected', id === name ? 'true' : 'false');
  $('labels').classList.toggle('off', name !== 'home');
  renderPanel();
  endDrag();
  const to = viewFor(name), from = { pos: cam.pos.clone(), tgt: cam.tgt.clone(), off: cam.off };
  const pose = stickPose(name), p0 = stick.position.clone(), q0 = stick.quaternion.clone();
  tipY = REST_TIP;
  if (travel) tweens.delete(travel);
  const set = (k) => {
    cam.pos.lerpVectors(from.pos, to.pos, k); cam.tgt.lerpVectors(from.tgt, to.tgt, k); cam.off = from.off + (to.off - from.off) * k;
    stick.position.lerpVectors(p0, pose.p, k); stick.quaternion.slerpQuaternions(q0, pose.q, k);
    if (k > 0 && k < 1) stick.position.y += Math.sin(k * Math.PI) * 0.25 * (p0.distanceTo(pose.p) > 0.1 ? 1 : 0);
  };
  if (instant || !changed) { set(1); travel = null; poke(); return; }
  travel = tween(900, (k) => set(ease(k)), () => { travel = null; });
}

/* ───────── 아래 패널 ───────── */
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function button(cls, text, onClick, label) {
  const b = el('button', cls, text); b.type = 'button';
  if (label) b.setAttribute('aria-label', label);
  b.addEventListener('click', onClick);
  return b;
}
function hintEl(main, sub) {
  const h = el('div', 'hint', main);
  if (sub) h.appendChild(el('small', '', sub));
  return h;
}
let panelKey = '', homeAction = null, homePanel = null;
function renderPanel() {
  const p = $('panel'), s = S.station;
  // 높이가 달라지지 않는 갱신은 버튼 상태만 바꾼다
  if (panelKey === s && (s === 'choco' || s === 'top')) { syncPanel(); return; }
  panelKey = s;
  p.textContent = '';
  if (s === 'home' && homePanel) {
    homePanel(p, { el, button, hintEl });
  } else if (s === 'home') {
    const r = el('div', 'row');
    const pr = progress();
    r.appendChild(hintEl(pr.next ? '다음 차례: ' + STN[pr.next].title : '선물이 완성됐어요!', pr.next ? 'PERFECT 를 모을수록 등급이 올라요: 수제 → 고급 → 최고급' : '포장 자리에서 편지를 써서 보내 보세요.'));
    const nb = button('btn', pr.next ? '하러 가기' : '포장 보기', () => dispatch({ t: 'go', s: pr.next || 'pack' })); nb.id = 'homeNext';
    nb.style.cssText = 'background:var(--choc);border-color:var(--choc);color:#FFF4E0';
    r.appendChild(nb);
    if (homeAction) { const b = button('btn', homeAction.label, homeAction.fn); b.id = 'homeAction'; r.appendChild(b); }
    p.appendChild(r);
  } else if (mods[s] && mods[s].panel) {
    mods[s].panel(p, { el, button, hintEl });
  } else if (STN[s].soon) {
    const r = el('div', 'row'); r.appendChild(hintEl(STN[s].title, STN[s].soon)); r.appendChild(el('span', 'soon', '준비 중')); p.appendChild(r);
  } else if (s === 'choco') {
    const r = el('div', 'row');
    r.appendChild(hintEl('과자를 아래로 끌어 담갔다가 놓으세요.', '과자의 금에 딱 맞춰 한 번에 담그면 완벽!'));
    const b = button('btn', '코팅 지우기', () => dispatch({ t: 'uncoat' })); b.id = 'uncoat'; r.appendChild(b);
    p.appendChild(r);
    const r2 = el('div', 'row');
    CHOCO.forEach((c, i) => {
      const b2 = button('sw', '', () => dispatch({ t: 'color', c: i }), c.name + ' 초콜릿');
      const dot = el('i'); dot.style.background = '#' + c.hex.toString(16).padStart(6, '0');
      b2.appendChild(dot); b2.appendChild(el('span', '', c.name)); b2.dataset.i = i;
      r2.appendChild(b2);
    });
    p.appendChild(r2);
  } else if (s === 'top') {
    const r = el('div', 'row');
    r.appendChild(hintEl('문질러서 뿌려 보세요.'));
    const u = button('btn', '되돌리기', () => dispatch({ t: 'undo', by: ME })); u.id = 'undo'; r.appendChild(u);
    const c = button('btn', '지우기', () => dispatch({ t: 'clear' })); c.id = 'clear'; r.appendChild(c);
    p.appendChild(r);
    const r2 = el('div', 'row');
    KINDS.forEach((k, i) => {
      const b = button('chip', '', () => { kind = i; syncPanel(); });
      const dot = el('i'); dot.style.background = k.dot; b.appendChild(dot); b.appendChild(el('span', '', k.name)); b.dataset.i = i;
      r2.appendChild(b);
    });
    p.appendChild(r2);
    const r3 = el('div', 'row');
    const inp = el('input', 'carve'); inp.type = 'text'; inp.id = 'carve'; inp.maxLength = 6; inp.autocomplete = 'off';
    inp.placeholder = '글자 새기기 (6자까지)'; inp.setAttribute('aria-label', '막대과자에 새길 글자 (6자까지)'); inp.enterKeyHint = 'done';
    inp.addEventListener('input', () => dispatch({ t: 'text', v: cleanText(inp.value) }));
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') inp.blur(); });
    r3.appendChild(inp);
    // 글자색: 누를 때마다 다음 색으로
    const tcb = button('btn', '', () => dispatch({ t: 'tcolor', c: (S.tc + 1) % TEXT_COLORS.length }), '글자색 바꾸기'); tcb.id = 'tcolor';
    tcb.style.cssText = 'display:flex;align-items:center;gap:6px;padding:0 10px';
    const dot = el('i'); dot.style.cssText = 'width:20px;height:20px;border-radius:50%;display:block;border:2px solid rgba(43,29,20,.18)';
    tcb.appendChild(dot); tcb.appendChild(el('span', '', '글자색'));
    r3.appendChild(tcb); p.appendChild(r3);
  }
  syncPanel();
}
function syncPanel() {
  const p = $('panel');
  if (S.station === 'choco') {
    p.querySelectorAll('.sw').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.i === S.color)));
    $('uncoat').disabled = !S.layers.length;
  } else if (S.station === 'top') {
    p.querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.i === kind)));
    $('undo').disabled = !S.backup && !S.grains.some((g) => String(g.st).startsWith(ME));
    $('clear').disabled = !S.grains.length;
    const inp = $('carve'); if (document.activeElement !== inp && inp.value !== S.text) inp.value = S.text;
    const tcb = $('tcolor'); tcb.firstChild.style.background = textCss();
    tcb.setAttribute('aria-label', '글자색 바꾸기 (지금: ' + (TEXT_COLORS[S.tc] ? TEXT_COLORS[S.tc].name : '자동') + ')');
  }
}
let toastT = 0;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1800);
}

/* ───────── 손가락 조작 (한 손가락, pointer 이벤트) ───────── */
const ME = Math.random().toString(36).slice(2, 7) + '-'; // 내 획을 구분하는 짧은 표식
let strokeN = 0;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const plane = new THREE.Plane(), hitP = new THREE.Vector3();
let drag = null;

// 손 위치를 주방 안의 한 점으로 바꿔 알린다 (둘이 굽기에서 상대에게 보냄)
const handFns = [], handPlane = new THREE.Plane(), handP = new THREE.Vector3();
function emitHand(e, down) {
  if (!handFns.length) return;
  const m = { down, s: S.station };
  if (down) {
    setRay(e);
    const v = VIEWS[S.station];
    handPlane.setFromNormalAndCoplanarPoint(_n.copy(v.dir).normalize(), v.tgt);
    if (!ray.ray.intersectPlane(handPlane, handP)) return;
    m.p = [+handP.x.toFixed(3), +handP.y.toFixed(3), +handP.z.toFixed(3)];
    if (drag && drag.mode === 'dip') m.tip = +tipY.toFixed(3);
  }
  for (const f of handFns) f(m);
}
let tipTween = null;
function remoteTip(y) { // 상대가 과자를 담그는 모습
  if (drag || travel || S.station !== 'choco') return;
  if (tipTween) { tweens.delete(tipTween); tipTween = null; }
  if (y == null) {
    const from = tipY;
    if (Math.abs(from - REST_TIP) < 0.005) return;
    tipTween = tween(520, (k) => { tipY = from + (REST_TIP - from) * easeBack(k); stick.position.y = tipY; }, () => { tipTween = null; });
  } else { tipY = y; stick.position.y = y; poke(); }
}
function getState() {
  const x = {};
  for (const id in mods) if (mods[id].get) x[id] = mods[id].get();
  return { station: S.station, color: S.color, text: S.text, tc: S.tc, x, layers: S.layers.map((l) => ({ c: l.c, len: l.len })),
    grains: S.grains.map((g) => ({ k: g.k, s: g.s, u: g.u, sp: g.sp, sc: g.sc, c: g.c, st: g.st, id: g.id })) };
}
function setState(st, keepStation) {
  S.color = st.color | 0; chocoMat.color.setHex(CHOCO[S.color].hex);
  S.layers = (st.layers || []).slice(0, 4).map((l) => ({ c: l.c | 0, len: +l.len }));
  S.grains = (st.grains || []).slice(0, MAX_GRAINS).map((g) => ({ k: g.k | 0, s: +g.s, u: +g.u, sp: +g.sp, sc: +g.sc, c: g.c | 0, st: String(g.st), id: String(g.id), born: 0 }));
  S.backup = null; S.text = cleanText(st.text); S.tc = TEXT_COLORS[st.tc] ? st.tc | 0 : -1;
  for (const id in mods) if (mods[id].set) mods[id].set(st.x ? st.x[id] : undefined);
  drawCoat(); drawText();
  updateTabs();
  if (!keepStation && STN[st.station] && st.station !== S.station) go(st.station); else renderPanel();
  poke(400);
}

// 자리 모듈에 넘기는 손가락 정보: 화면 좌표, 직전 대비 이동량, 주방 안으로 쏜 광선
function info(e, dx, dy) {
  setRay(e);
  return { x: e.clientX, y: e.clientY, dx, dy, ray: ray.ray, w: W, h: H };
}
function setRay(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
}
function sprinkleAt(e, force) {
  setRay(e);
  plane.set(Y, -(stick.position.y + STICK.R * 0.7));
  if (!ray.ray.intersectPlane(plane, hitP)) return false;
  const s = hitP.z - stick.position.z, u = hitP.x - stick.position.x;
  if (s < -0.02 || s > STICK.L * (1 - STICK.handle) || Math.abs(u) > STICK.R * 1.9) return false;
  if (S.grains.length >= MAX_GRAINS) { if (force) toast('과자가 가득 찼어요'); return false; }
  const k = KINDS[kind], j = () => (Math.random() - 0.5);
  dispatch({
    t: 'grain', k: kind,
    s: +Math.max(0.012, Math.min(STICK.L * (1 - STICK.handle) - 0.01, s + j() * 0.02)).toFixed(4),
    u: +Math.max(-STICK.R * 0.9, Math.min(STICK.R * 0.9, u + j() * 0.03)).toFixed(4),
    sp: +(Math.random() * 6.283).toFixed(2), sc: +(0.85 + Math.random() * 0.4).toFixed(2),
    c: Math.floor(Math.random() * k.colors.length), st: drag.st, id: drag.st + '.' + (drag.n++),
  });
  return true;
}
function endDrag() {
  if (!drag) return;
  const d = drag; drag = null;
  if (d.mode === 'dip') {
    const from = tipY, len = d.len;
    if (len > 0.03) {
      dispatch({ t: 'coat', c: S.color, len: +len.toFixed(3) });
      judge(chocoGrade() === 2 ? 2 : 1);
      ripple(); if (!reduceMotion) drips(len);
    }
    tween(520, (k) => { tipY = from + (REST_TIP - from) * easeBack(k); stick.position.y = tipY; });
  }
}
function ripple() {
  tween(700, (k) => { const a = 1 + Math.sin(k * Math.PI * 3) * 0.035 * (1 - k); chocoSurf.scale.set(a, 1, a); });
}
const dripGeo = new THREE.SphereGeometry(0.014, 8, 6);
function drips() {
  for (let i = 0; i < 3; i++) {
    const m = put(dripGeo, coatMat(S.color), 0, 0, 0, scene, false); m.visible = false;
    setTimeout(() => {
      const y0 = stick.position.y; m.visible = true;
      tween(380, (k) => { m.position.set(POT.x + (i - 1) * 0.012, y0 + (SURF_Y - y0) * k * k, POT.z); m.scale.setScalar(1 - k * 0.3); },
        () => { scene.remove(m); });
    }, 140 + i * 170);
  }
}

canvas.addEventListener('pointerdown', (e) => {
  if (drag || !e.isPrimary) return;
  if (locked) { // 받은 선물 화면: 꾸미기는 막고, 밀어서 시점만 돌린다
    if (orbit && viewOverride) {
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* 가상 포인터 */ }
      drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: 0, mode: 'orbit' };
    }
    return;
  }
  try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* 가상 포인터 */ }
  drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: 0, mode: 'tap' };
  if (travel) return;
  if (S.station === 'choco') {
    const elev = Math.asin(VIEWS.choco.dir.clone().normalize().y);
    drag.mode = 'dip'; drag.tip0 = tipY; drag.len = 0;
    drag.upp = (2 * cam.pos.distanceTo(stick.position) * tanHalf) / H / Math.cos(elev);
  } else if (S.station === 'top') {
    drag.mode = 'rub'; drag.st = ME + (++strokeN); drag.acc = 0; drag.n = 0;
    sprinkleAt(e, true);
  } else if (mods[S.station] && mods[S.station].down) {
    drag.mode = 'mod'; drag.mod = mods[S.station];
    drag.mod.down(info(e, 0, 0));
  }
  emitHand(e, true);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0));
  if (drag.mode === 'orbit') {
    yaw -= dx * 0.009; pitch = Math.max(-0.35, Math.min(0.75, pitch + dy * 0.005)); snapCam();
  } else if (drag.mode === 'dip') {
    tipY = Math.max(SURF_Y - MAX_DIP, Math.min(REST_TIP + 0.12, drag.tip0 - (e.clientY - drag.y0) * drag.upp));
    stick.position.y = tipY;
    const depth = SURF_Y - tipY;
    if (depth > drag.len) {
      if (drag.len <= 0) ripple();
      drag.len = depth;
    }
    poke();
  } else if (drag.mode === 'rub') {
    drag.acc += Math.hypot(dx, dy);
    const step = KINDS[kind].step;
    let n = 0;
    while (drag.acc >= step && n < 4) { drag.acc -= step; n++; sprinkleAt(e, false); }
  } else if (drag.mode === 'mod' && drag.mod.move) {
    drag.mod.move(info(e, dx, dy));
  }
  drag.x = e.clientX; drag.y = e.clientY;
  emitHand(e, true);
});
function onUp(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag;
  if (d.mode === 'tap' && d.moved < 10 && e.type === 'pointerup' && !travel) {
    setRay(e);
    const h = ray.intersectObjects(hits.children, false)[0];
    if (h) { drag = null; dispatch({ t: 'go', s: h.object.userData.station }); return; }
  }
  if (d.mode === 'mod' && d.mod.up) d.mod.up(info(e, 0, 0));
  endDrag(); drag = null;
  emitHand(e, false);
}
canvas.addEventListener('pointerup', onUp);
canvas.addEventListener('pointercancel', onUp);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
// 캔버스 밖에서 시작한 문지름으로 페이지가 끌려가지 않게
document.addEventListener('touchmove', (e) => { if (e.target === canvas) e.preventDefault(); }, { passive: false });

/* ───────── 화면 크기 ───────── */
function resize() {
  W = canvas.clientWidth || innerWidth; H = canvas.clientHeight || innerHeight;
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  go(S.station, true);
  if (travel) { tweens.delete(travel); travel = null; }
  const v = viewFor(S.station); cam.pos.copy(v.pos); cam.tgt.copy(v.tgt); cam.off = v.off;
  poke();
}
new ResizeObserver(resize).observe(canvas);
function refit() {
  if (travel) return;
  const to = viewFor(S.station), from = { pos: cam.pos.clone(), tgt: cam.tgt.clone(), off: cam.off };
  if (from.pos.distanceTo(to.pos) < 0.01 && Math.abs(from.off - to.off) < 1) return;
  tween(300, (k) => { const e = ease(k); cam.pos.lerpVectors(from.pos, to.pos, e); cam.off = from.off + (to.off - from.off) * e; });
}

/* ───────── 그리기 (움직일 때만, 탭이 가려지면 멈춤) ───────── */
const _v = new THREE.Vector3();
function placeLabels() {
  for (const id in labelEls) {
    _v.copy(ANCHOR[id].at).project(camera);
    const x = (_v.x * 0.5 + 0.5) * W, y = (-_v.y * 0.5 + 0.5) * H;
    labelEls[id].style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%)`;
  }
}
let raf = 0, frames = 0;
// 저사양 폰: 이어서 그린 45장의 평균이 30fps 에 못 미치면 한 번만 품질을 낮춘다(픽셀 비율 1, 그림자 절반)
let quality = 'high', lastDraw = 0, slowSum = 0, slowN = 0;
function lowerQuality() {
  if (quality === 'low') return;
  quality = 'low';
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  sun.shadow.mapSize.set(512, 512);
  if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  poke(300);
}
function watchSpeed(now) {
  const dt = now - lastDraw; lastDraw = now;
  if (quality === 'low' || dt > 250) { slowSum = 0; slowN = 0; return; }
  slowSum += dt;
  if (++slowN >= 45) { if (slowSum / slowN > 36) lowerQuality(); slowSum = 0; slowN = 0; }
}
function frame(now) {
  raf = requestAnimationFrame(frame);
  for (const t of tweens) {
    const k = t.dur ? Math.min(1, (now - t.t0) / t.dur) : 1;
    t.fn(k);
    if (k >= 1) { tweens.delete(t); if (t.done) t.done(); }
  }
  if (now > wake && !tweens.size) return;
  if (drawGrains(now)) poke(100);
  applyCam();
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  if (S.station === 'home' || travel) placeLabels();
  renderer.shadowMap.needsUpdate = true;
  renderer.render(scene, camera);
  frames++; watchSpeed(now);
}
document.addEventListener('visibilitychange', () => {
  cancelAnimationFrame(raf);
  if (!document.hidden) { poke(500); raf = requestAnimationFrame(frame); }
});
canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); cancelAnimationFrame(raf); });
canvas.addEventListener('webglcontextrestored', () => { poke(500); raf = requestAnimationFrame(frame); });

/* ───────── 시작 ───────── */
drawCoat();
resize();
go('home', true);
tabsReady = true; updateTabs();
raf = requestAnimationFrame(frame);
requestAnimationFrame(() => { $('loading').classList.add('done'); setTimeout(() => $('loading').remove(), 500); });

// 둘이 굽기·자동 검사에서 쓰는 창구
export const kitchen = {
  S, CHOCO, KINDS, STICK, cleanText, dispatch, onLocal: (f) => listeners.push(f), onHand: (f) => handFns.push(f), toast, poke,
  remoteTip, getState, setState, setLocked(v) { locked = !!v; }, setStage, setView, present, grades, DIP, snapStick, setOrbit, judge, get yaw() { return yaw; },
  get stage() { return stageOn; }, get presenting() { return presenting; },
  setHomeAction(a, panel) { homeAction = a; homePanel = panel || null; panelKey = ''; renderPanel(); refit(); },
  refit, // 아래 패널 높이가 바뀌었을 때 카메라를 다시 맞춘다
  project(x, y, z) { _v.set(x, y, z).project(camera); return { x: (_v.x * 0.5 + 0.5) * W, y: (-_v.y * 0.5 + 0.5) * H }; },
  get frames() { return frames; }, get me() { return ME; }, get quality() { return quality; }, lowerQuality, theme: THEME.name,
  stickScreen() { // 과자 가운데의 화면 좌표 (검사용)
    const a = stick.localToWorld(V3(0, 0, 0)).project(camera), b = stick.localToWorld(V3(0, STICK.L * 0.8, 0)).project(camera);
    const f = (v) => ({ x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H });
    return { tip: f(a), end: f(b) };
  },
};
window.__kitchen = kitchen;
