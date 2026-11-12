// 창밖 하늘: 실제 시각에 맞춘 낮과 밤, 날짜와 시(時)로 정해지는 눈 날씨, 12월 24일 자정의 카운트다운과 불꽃놀이.
//   낮과 밤: 해 뜨는 때 7:30, 지는 때 17:30 (12월 한국 기준). 앞뒤 40분은 해질녘·새벽 빛으로 부드럽게 섞는다. 1분마다 다시 정한다.
//     바뀌는 것: 내려다볼 때의 배경, 1인칭의 하늘 돔(별·달), 안에서 보는 창(그림 대신 하늘을 그리는 재질 하나), 햇빛·하늘빛의 세기와 색,
//     마당의 밝기(마당 재질만 어둡게), 밖에서 본 창의 노란 불빛, 창과 가로등 아래 눈밭에 비치는 빛.
//     집 안은 밤에도 낮의 70% 아래로 어두워지지 않는다(따뜻한 실내등 느낌). 빛의 세기는 app.js 의 BRIGHT(점등식 setBright 가 곱하는 바탕값)를
//     바꿔서 정한다: 하늘이 정한 밝기 × 점등식 밝기. 점등식이 벌어지는 동안(과 끝난 뒤 3초)은 바탕값을 바꾸지 않는다.
//   날씨: 날짜와 시로 만든 난수라서 같은 방 사람들은 (같은 시간대라면) 같은 날씨를 본다. 맑음 / 눈 조금 / 함박눈.
//     눈은 집 밖에만 내린다: 마당 위(THREE.Points 하나, 위층에 있으면 그 층 높이의 남쪽 바깥), 그리고 모든 창 안의 그림.
//   자정: 12월 24일 23:50 부터 위에 "크리스마스까지 9:59" 띠, 23:59:50 부터 큰 숫자 10초, 25일 0시 정각에 "메리 크리스마스! 🎄" 와 불꽃놀이 40초.
//     각자 자기 기기 시계로 움직인다(통신 없음). 0시가 되면 window 에 'tree:xmas' 사건을 보낸다(선물 교환이 같은 순간에 상자를 열 수 있게).
//     25일 하루 동안은 꾸밀 수 있는 사람이, 방장은 아무 날에나 트리 판의 "🎆 불꽃놀이" 로 터뜨린다(놀이 소식 { k: 'show', v: 'fire' }, 30초에 한 번).
//   불꽃: THREE.Points 하나(360개). 내려다볼 때는 화면 위쪽 하늘에, 1인칭에서는 남쪽 하늘과 바라보는 쪽 하늘에 터진다.
//     3층에서 1인칭이면 불꽃놀이 동안 천장을 걷어 옥상 전망대처럼 하늘이 보인다. 창 그림에도 불꽃이 터지고, 터질 때 방 안이 그 색으로 살짝 물든다.
// 시간은 꼭 now() 로 읽는다(검사에서 window.__now 로 날짜·시각을 바꾼다). 시각은 그 기기의 현지 시간.
// app.js 가 넘겨주는 창구 K 로 조명·방·카메라·소식을 다룬다.
import { THREE } from './kit.js';
import { X0, X1, Z1, GZ1, FLOOR_H, centerOf } from './path.js';

const now = () => (typeof window.__now === 'function' ? window.__now() : Date.now());
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

/* ───────── 정한 규칙 (화면과 상관없는 계산) ───────── */
export const SUN = { rise: 7 * 60 + 30, set: 17 * 60 + 30, blend: 40 }; // 분. 앞뒤 blend 분은 섞는다
// 그 시각의 하늘: day = 0(밤) ~ 1(낮), dusk = 해질녘·새벽 빛의 세기(0 ~ 1)
export function skyAt(ts) {
  const d = new Date(ts), m = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60, B = SUN.blend;
  const day = smooth((m - (SUN.rise - B)) / (2 * B)) * (1 - smooth((m - (SUN.set - B)) / (2 * B)));
  const tri = (c) => clamp(1 - Math.abs(m - c) / B, 0, 1);
  const dusk = smooth(Math.max(tri(SUN.rise), tri(SUN.set + 8)));
  return { day, dusk, phase: day > 0.98 ? 'day' : day < 0.02 && dusk < 0.05 ? 'night' : 'dusk' };
}
// 날짜와 시로 만든 0 ~ 1 난수 (같은 날 같은 시면 누구나 같은 값)
function hourRand(d) {
  let h = (d.getFullYear() * 400 + (d.getMonth() + 1) * 32 + d.getDate()) * 24 + d.getHours();
  h = Math.imul(h ^ (h >>> 15), 0x2C1B3C6D); h = Math.imul(h ^ (h >>> 12), 0x297A2D39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
// 날씨: 0 = 맑음, 1 = 눈 조금, 2 = 함박눈
//   12월 24~25일: 늘 눈(절반쯤 함박눈). 12월: 절반쯤 눈(함박눈 20%, 조금 30%). 1·2월: 눈 35%(함박눈 12%). 11·3월: 눈 조금 15%. 그 밖: 맑음
export const WEATHER = ['맑음', '눈 조금', '함박눈'];
export function weatherAt(ts) {
  const d = new Date(ts), mo = d.getMonth() + 1, day = d.getDate(), r = hourRand(d);
  if (mo === 12 && (day === 24 || day === 25)) return r < 0.5 ? 2 : 1;
  if (mo === 12) return r < 0.2 ? 2 : r < 0.5 ? 1 : 0;
  if (mo === 1 || mo === 2) return r < 0.12 ? 2 : r < 0.35 ? 1 : 0;
  if (mo === 11 || mo === 3) return r < 0.15 ? 1 : 0;
  return 0;
}
// 크리스마스 자정: 그해 12월 25일 0시(현지)
export const XMAS = { band: 600, count: 10, show: 40, gap: 30, again: 15 }; // 띠(초 전부터), 큰 숫자(초), 자정 불꽃(초), 다시 터뜨리기 간격·길이(초)
export const xmasAt = (ts) => new Date(new Date(ts).getFullYear(), 11, 25).getTime();
export const isXmas = (ts) => { const d = new Date(ts); return d.getMonth() === 11 && d.getDate() === 25; };
// 그 시각에 화면에 보일 것: 'band'(띠) | 'count'(큰 숫자) | 'show'(자정 불꽃) | null. left = 0시까지 남은 초
export function xmasPhase(ts) {
  const left = (xmasAt(ts) - ts) / 1000;
  if (left > XMAS.band || left < -XMAS.show) return { phase: null, left };
  if (left > XMAS.count) return { phase: 'band', left };
  if (left > 0) return { phase: 'count', left };
  return { phase: 'show', left };
}

/* ───────── 색 ───────── */
const hex = (h) => new THREE.Color(h);
const PAL = {
  // 하늘 [위, 지평선]
  day: [hex(0x5FA8E8), hex(0xCFE7F7)], dusk: [hex(0x3E3A78), hex(0xF2A065)], night: [hex(0x0E1433), hex(0x2A2C5A)], gray: [hex(0x9AA6B4), hex(0xD5DBE2)],
  // 조명 [하늘빛 색, 햇빛 색, 하늘빛 배수, 햇빛 배수]. 밤에는 실내등처럼 따뜻하게, 낮의 70% 위로
  lDay: [hex(0xFFEFD8), hex(0xFFDDB0), 1, 1], lDusk: [hex(0xFFE0C8), hex(0xFFB98A), 0.9, 0.86], lNight: [hex(0xFFE4C4), hex(0xFFC890), 0.8, 0.72],
  snowDay: hex(0xEEF3FA), snowNight: hex(0x56618A),
  glassDay: hex(0x9DB7CF), glassNight: hex(0xFFD27A),
};
const FIRE = [0xFF5A5A, 0xFFD34D, 0x6FE38A, 0x5AB8FF, 0xC77DFF, 0xFF8AD8, 0xFFFFFF, 0xFF9A3C].map(hex);

// 둥글게 번지는 빛 그림 (가로등·창 빛·불꽃 반짝임에 같이 쓴다)
function radial() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ───────── 그리는 재질 ───────── */
const COLOR_OUT = '#include <tonemapping_fragment>\n#include <colorspace_fragment>';
const HASH = 'float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }';
// 안에서 보는 창: 하늘 그라데이션, 먼 눈 언덕, 별과 달, 내리는 눈, 불꽃
function paneMaterial(u) {
  return new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `
      uniform vec3 uTop, uHor, uGround; uniform float uStars, uMoon, uSnow, uTime;
      uniform vec4 uFw[4]; uniform vec3 uFwC[4];
      varying vec2 vUv;
      ${HASH}
      void main(){
        vec2 p = (vUv - .5) * vec2(1.3, 1.);
        vec3 c = mix(uHor, uTop, smoothstep(.05, 1., vUv.y));
        // 별
        if (uStars > 0.) { vec2 g = vUv * vec2(26., 20.); vec2 id = floor(g); float h = hash(id);
          if (h > .86 && vUv.y > .35) { float d = length(fract(g) - .5 - (vec2(hash(id + 3.), hash(id + 7.)) - .5) * .6);
            c += vec3(1.) * uStars * smoothstep(.12, 0., d) * (.6 + .4 * sin(uTime * 2. + h * 40.)); } }
        // 달
        if (uMoon > 0.) { float d = length(p - vec2(.36, .24)); c = mix(c, vec3(1., .95, .76), uMoon * smoothstep(.135, .12, d)); c += vec3(.5, .45, .3) * uMoon * smoothstep(.32, .12, d) * .25; }
        // 불꽃
        for (int i = 0; i < 4; i++) { float a = uFw[i].z; if (a <= 0. || a >= 1.) continue;
          vec2 o = uFw[i].xy; float r = .26 * sqrt(a), k = pow(1. - a, 1.4);
          for (int j = 0; j < 12; j++) { float an = float(j) * .5236 + uFw[i].w; vec2 q = o + vec2(cos(an), sin(an)) * r - vec2(0., .05 * a * a);
            c += uFwC[i] * k * smoothstep(.028, 0., length(p - q)) * 1.6; }
          c += uFwC[i] * k * .35 * smoothstep(.5, 0., length(p - o)); }
        // 먼 눈 언덕
        float hill = -.36 + .05 * sin(p.x * 6. + 1.3) + .03 * sin(p.x * 13.);
        c = mix(c, uGround, smoothstep(hill + .01, hill - .01, p.y));
        // 내리는 눈 (두 겹)
        if (uSnow > 0.) { for (int l = 0; l < 2; l++) { float s = l == 0 ? 9. : 15.; vec2 g = vec2(p.x * s, p.y * s + uTime * (l == 0 ? 1.1 : .75) * s * .12);
            vec2 id = floor(g); float h = hash(id + float(l) * 17.);
            if (h < uSnow * .55) { vec2 f = fract(g) - .5 - (vec2(hash(id + 1.), hash(id + 2.)) - .5) * .6 + vec2(sin(uTime + h * 30.) * .12, 0.);
              c = mix(c, vec3(1.), smoothstep(l == 0 ? .14 : .1, 0., length(f)) * .9); } } }
        gl_FragColor = vec4(c, 1.);
        ${COLOR_OUT}
      }`,
  });
}
// 1인칭의 하늘 돔: 지평선 아래는 먼 눈밭, 위는 그라데이션과 별·달·해
function domeMaterial(u) {
  return new THREE.ShaderMaterial({
    uniforms: u, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `
      uniform vec3 uTop, uHor, uGround; uniform float uStars, uMoon, uSun, uTime;
      varying vec3 vDir;
      ${HASH}
      void main(){
        vec3 d = normalize(vDir);
        vec3 c = mix(uHor, uTop, smoothstep(0., .55, d.y));
        if (uStars > 0. && d.y > .04) { vec2 g = vec2(atan(d.z, d.x) * 48., asin(d.y) * 48.); vec2 id = floor(g); float h = hash(id);
          if (h > .93) { float k = length(fract(g) - .5 - (vec2(hash(id + 3.), hash(id + 7.)) - .5) * .5);
            c += vec3(1.) * uStars * smoothstep(.1, 0., k) * (.55 + .45 * sin(uTime * 1.7 + h * 50.)) * smoothstep(.04, .2, d.y); } }
        vec3 md = normalize(vec3(.35, .6, .72)); float m = dot(d, md);
        if (uMoon > 0.) { c = mix(c, vec3(1., .96, .8), uMoon * smoothstep(.9988, .9992, m)); c += vec3(.4, .38, .3) * uMoon * pow(max(m, 0.), 90.) * .5; }
        vec3 sd = normalize(vec3(-.2, .42, .88)); float s = dot(d, sd);
        if (uSun > 0.) { c = mix(c, vec3(1., .98, .9), uSun * smoothstep(.9985, .999, s)); c += vec3(1., .85, .6) * uSun * pow(max(s, 0.), 40.) * .35; }
        c = mix(c, uGround, smoothstep(.0, -.03, d.y));
        gl_FragColor = vec4(c, 1.);
        ${COLOR_OUT}
      }`,
  });
}
// 점 입자 공통: 1인칭은 거리에 따라, 내려다볼 때는 화면 축척에 따라 크기를 정한다 (uPx = 길이 1 이 몇 화소인지)
const POINT_SIZE = 'float ps(float s, vec4 mv){ return clamp(uPersp > .5 ? s * uPx / -mv.z : s * uPx, 0., 56.); }';
function snowMaterial(u) {
  return new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false,
    vertexShader: `
      attribute vec4 aSeed; uniform float uTime, uDensity, uPx, uPersp, uH; varying float vA;
      ${POINT_SIZE}
      void main(){
        float r = aSeed.w, on = step(r, uDensity), sp = .45 + r * .5;
        vec3 p = vec3(aSeed.x + sin(uTime * .8 + r * 40.) * .22, mod(aSeed.y - uTime * sp, uH), aSeed.z + cos(uTime * .6 + r * 25.) * .15);
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        vA = on * smoothstep(0., .4, p.y) * smoothstep(uH, uH - 1., p.y);
        gl_PointSize = on * ps(.075 + r * .05, mv);
      }`,
    fragmentShader: `
      uniform vec3 uColor; varying float vA;
      void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, .15, d) * vA; if (a < .01) discard; gl_FragColor = vec4(uColor, a * .95);
        ${COLOR_OUT} }`,
  });
}
function fireMaterial(u) {
  return new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec3 aVel, aColor; attribute vec4 aInfo; attribute float aSize; uniform float uTime, uPx, uPersp; varying vec3 vC; varying float vA;
      ${POINT_SIZE}
      void main(){
        float t = uTime - aInfo.x, a = 0.; vec3 p = position;
        if (t >= 0. && t <= aInfo.y) {
          float k = aInfo.z;
          p += k > 0. ? aVel * (1. - exp(-k * t)) / k : aVel * t;
          p.y -= .5 * aInfo.w * t * t;
          a = pow(1. - t / aInfo.y, 1.3);
          if (k > 0. && t > aInfo.y * .55) a *= .6 + .4 * sin(t * 38. + aVel.x * 13.);
        }
        vC = aColor; vA = a;
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = a > 0. ? max(1.5, ps(aSize, mv)) : 0.;
      }`,
    fragmentShader: `
      varying vec3 vC; varying float vA;
      void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, 0., d) * vA; if (a < .01) discard; gl_FragColor = vec4(vC * (1. + smoothstep(.2, 0., d)), a);
        ${COLOR_OUT} }`,
  });
}

export function makeSky(K) {
  const { scene, hemi, sun, room } = K;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clock = () => performance.now() / 1000;

  /* ───────── 하늘 값 (모든 재질이 같이 쓴다) ───────── */
  const U = {
    uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uGround: { value: new THREE.Color() },
    uStars: { value: 0 }, uMoon: { value: 0 }, uSun: { value: 0 }, uSnow: { value: 0 }, uTime: { value: 0 },
    uFw: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) }, uFwC: { value: [0, 1, 2, 3].map(() => new THREE.Color()) },
  };
  const pane = paneMaterial(U);

  // 안에서 보는 창: 밤 그림(남색 판·달·눈송이)을 하늘 재질로 바꾼다. 밖에서 볼 창 자리도 모은다(1층만: 마당에서 보이는 층)
  const outside = [];
  room.floors.forEach((f, lv) => {
    for (const side of ['n', 's', 'w', 'e']) {
      const up = f.walls[side].upper;
      for (const m of [...up.children]) {
        const mat = m.material;
        if (!m.isMesh || !mat || !mat.isMeshBasicMaterial) continue;
        const h = mat.color.getHex();
        if (h === 0x27335E && m.geometry.type === 'BoxGeometry') { m.material = pane; if (lv === 0) outside.push({ up, x: m.position.x, y: m.position.y }); mat.dispose(); }
        else if (h === 0xFFF2C2 && m.geometry.type === 'CircleGeometry') m.visible = false; // 그려 둔 달
        else if (h === 0xFFFFFF && m.geometry.type === 'CircleGeometry' && m.geometry.parameters.radius < 0.03) m.visible = false; // 그려 둔 눈송이
      }
    }
  });

  // 밖에서 본 창: 벽 바깥 면에 틀(빛을 받는 흰색)과 유리(낮에는 하늘빛, 밤에는 노란 불빛). 벽마다 묶어서 두 덩어리
  const glassMat = new THREE.MeshBasicMaterial({ color: PAL.glassDay.clone(), side: THREE.DoubleSide });
  const frameMat = new THREE.MeshLambertMaterial({ color: 0xFFF8EA, side: THREE.DoubleSide });
  {
    const by = new Map();
    for (const o of outside) { if (!by.has(o.up)) by.set(o.up, []); by.get(o.up).push(o); }
    const quad = (arr, x, y, z, w, h) => { const a = [x - w / 2, y - h / 2, z], b = [x + w / 2, y - h / 2, z], c = [x + w / 2, y + h / 2, z], d = [x - w / 2, y + h / 2, z]; arr.push(...a, ...b, ...c, ...a, ...c, ...d); };
    const mesh = (arr, mat, parent) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); g.computeVertexNormals(); const m = new THREE.Mesh(g, mat); m.castShadow = false; m.receiveShadow = false; parent.add(m); return m; };
    for (const [up, list] of by) {
      const fr = [], gl = [], z = -0.074; // 벽 두께 0.14 의 바깥 면 조금 밖
      for (const o of list) {
        quad(fr, o.x, o.y, z, 1.5, 1.2);
        quad(gl, o.x, o.y, z - 0.004, 1.3, 1.0);
        quad(fr, o.x, o.y, z - 0.008, 0.06, 1.0); quad(fr, o.x, o.y, z - 0.008, 1.3, 0.06); // 십자 창살
        quad(fr, o.x, o.y - 0.62, z - 0.03, 1.66, 0.07); // 창턱
      }
      mesh(fr, frameMat, up); mesh(gl, glassMat, up);
    }
  }

  // 마당: 재질을 따로 떼어 밤에 어둡게 한다(집 안과 같이 쓰는 재질이 많아서 복사본을 쓴다). 빛을 스스로 내는 것(가로등 알)은 그대로
  const yard = room.g0.children.find((g) => g.isGroup && g.children[0] && g.children[0].isMesh && g.children[0].position.z > Z1 + 1 && g.children[0].geometry.type === 'BoxGeometry');
  const yardMats = [];
  if (yard) {
    const copies = new Map();
    yard.traverse((m) => {
      if (!m.isMesh || !m.material || !m.material.isMeshLambertMaterial) return;
      let c = copies.get(m.material);
      if (!c) { c = m.material.clone(); copies.set(m.material, c); yardMats.push({ m: c, color: c.color.clone() }); }
      m.material = c;
    });
  }
  // 밤의 빛 웅덩이: 가로등 아래, 남쪽 창과 현관 앞 눈밭. 둥근 빛 그림 하나를 여러 장 깐 한 덩어리
  const glowTex = radial();
  const poolMat = new THREE.MeshBasicMaterial({ map: glowTex, color: 0xFFC77A, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2 });
  const [lx, lz] = centerOf(7, 22);
  {
    const spots = [[lx, lz, 3.0, 3.0]];
    for (const o of outside) { o.up.updateMatrixWorld(true); }
    room.g0.updateMatrixWorld(true);
    for (const o of outside) {
      const p = o.up.localToWorld(new THREE.Vector3(o.x, 0, 0));
      if (p.z > Z1 - 0.5) spots.push([p.x, Z1 + 1.0, 2.0, 1.5]); // 남쪽 벽의 창: 그 앞 눈밭
    }
    spots.push([K.front.x, Z1 + 0.95, 1.6, 1.5]); // 현관
    const pos = [], uv = [];
    for (const [x, z, w, d] of spots) {
      const a = [x - w / 2, 0.006, z - d / 2], b = [x + w / 2, 0.006, z - d / 2], c = [x + w / 2, 0.006, z + d / 2], e = [x - w / 2, 0.006, z + d / 2];
      pos.push(...a, ...c, ...b, ...a, ...e, ...c); uv.push(0, 0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const m = new THREE.Mesh(g, poolMat); m.renderOrder = 2; (yard || room.g0).add(m);
  }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xFFD9A0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.set(lx, 1.82, lz); halo.scale.set(1.3, 1.3, 1); (yard || room.g0).add(halo);

  // 내려다볼 때의 배경: 그라데이션 그림 한 장 (별은 밤에만)
  const bgC = document.createElement('canvas'); bgC.width = 128; bgC.height = 256;
  const bgTex = new THREE.CanvasTexture(bgC); bgTex.colorSpace = THREE.SRGBColorSpace;
  const css = (c) => '#' + c.getHexString();
  function paintBg(top, hor, stars) {
    const g = bgC.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, css(top)); gr.addColorStop(1, css(hor));
    g.fillStyle = gr; g.fillRect(0, 0, 128, 256);
    if (stars > 0.02) {
      let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
      for (let k = 0; k < 70; k++) { const x = r() * 128, y = r() * 170; g.fillStyle = `rgba(255,250,235,${(0.35 + r() * 0.6) * stars})`; g.fillRect(x, y, 1, 0.6); }
    }
    bgTex.needsUpdate = true;
  }
  scene.background = bgTex;

  // 1인칭의 하늘 돔 (1인칭일 때만 보인다. 늘 눈 자리를 가운데로)
  const dome = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), domeMaterial(U));
  dome.renderOrder = -10; dome.frustumCulled = false; dome.visible = false;
  scene.add(dome);

  /* ───────── 눈 ───────── */
  const SNOW_N = 300, SH = 7.5, box = { x0: X0 - 1, x1: X1 + 1, z0: Z1 + 0.35, z1: GZ1 + 1.5 };
  const SU = { uTime: U.uTime, uDensity: { value: 0 }, uPx: { value: 100 }, uPersp: { value: 0 }, uH: { value: SH }, uColor: { value: new THREE.Color(0xFFFFFF) } };
  const snowPts = (() => {
    const g = new THREE.BufferGeometry(), seed = new Float32Array(SNOW_N * 4), pos = new Float32Array(SNOW_N * 3);
    for (let k = 0; k < SNOW_N; k++) seed.set([rnd(box.x0, box.x1), Math.random() * SH, rnd(box.z0, box.z1), Math.random()], k * 4);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const p = new THREE.Points(g, snowMaterial(SU)); p.frustumCulled = false; p.renderOrder = 3; p.visible = false;
    scene.add(p); return p;
  })();

  /* ───────── 불꽃 ───────── */
  const PER = 45, SLOTS = 8, FN = PER * SLOTS;
  const FU = { uTime: U.uTime, uPx: { value: 100 }, uPersp: { value: 0 } };
  const fg = new THREE.BufferGeometry();
  const fPos = new Float32Array(FN * 3), fVel = new Float32Array(FN * 3), fCol = new Float32Array(FN * 3), fInfo = new Float32Array(FN * 4).fill(-99), fSize = new Float32Array(FN);
  const attr = { position: new THREE.BufferAttribute(fPos, 3), aVel: new THREE.BufferAttribute(fVel, 3), aColor: new THREE.BufferAttribute(fCol, 3), aInfo: new THREE.BufferAttribute(fInfo, 4), aSize: new THREE.BufferAttribute(fSize, 1) };
  for (const k in attr) fg.setAttribute(k, attr[k]);
  const fire = new THREE.Points(fg, fireMaterial(FU)); fire.frustumCulled = false; fire.renderOrder = 4; fire.visible = false;
  scene.add(fire);
  let slot = 0;
  const flashes = []; // 방을 물들이는 빛 { t, c } 과 창 그림의 불꽃
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

  // 불꽃 하나: 로켓이 올라가 터진다. 자리는 지금 쓰는 카메라에 맞춘다
  function burst(big = false) {
    const cam = K.cam(), t = clock(), lvY = K.level() * FLOOR_H;
    let R; const c = new THREE.Vector3();
    if (cam.isPerspectiveCamera) {
      if (Math.random() < 0.7) { // 바라보는 쪽 하늘
        cam.getWorldDirection(vA); vA.y = 0; if (vA.lengthSq() < 1e-6) vA.set(0, 0, 1); vA.normalize().applyAxisAngle(UP, rnd(-0.55, 0.55));
        const el = rnd(0.1, 0.32), dist = rnd(16, 22);
        c.copy(cam.position).addScaledVector(vA, Math.cos(el) * dist); c.y += Math.sin(el) * dist;
      } else c.set(rnd(X0 - 2, X1 + 2), lvY + rnd(5, 8), rnd(Z1 + 11, Z1 + 18)); // 남쪽 하늘(마당 너머)
      R = rnd(3, 4.4);
    } else { // 내려다볼 때: 화면 위쪽에, 집보다 카메라 가까이
      c.set(rnd(-0.7, 0.7), rnd(0.15, 0.7), 0).unproject(cam);
      cam.getWorldDirection(vA);
      vB.copy(c).sub(cam.position); c.addScaledVector(vA, 15 - vB.dot(vA));
      R = (cam.top - cam.bottom) / cam.zoom * rnd(0.17, 0.24);
    }
    if (big) R *= 1.3;
    const col = FIRE[Math.floor(Math.random() * FIRE.length)], col2 = Math.random() < 0.35 ? FIRE[Math.floor(Math.random() * FIRE.length)] : col;
    const ring = Math.random() < 0.3, rise = 0.6, base = slot * PER;
    slot = (slot + 1) % SLOTS;
    // 터지는 방향: 고리 모양이면 카메라를 마주보는 면 위에서
    cam.updateMatrixWorld(); cam.matrixWorld.extractBasis(vB, vC, vA);
    for (let k = 0; k < PER; k++) {
      const n = base + k, cc = k === 0 ? FIRE[6] : k % 2 ? col : col2;
      if (k === 0) { // 로켓
        fPos.set([c.x, c.y - R * 1.8, c.z], n * 3); fVel.set([0, R * 1.8 / rise, 0], n * 3);
        fInfo.set([t, rise, 0, 0], n * 4); fSize[n] = R * 0.05;
      } else {
        let d;
        if (ring) { const a = (k / (PER - 1)) * Math.PI * 2; d = vA.copy(vB).multiplyScalar(Math.cos(a)).addScaledVector(vC, Math.sin(a)); }
        else { const z = rnd(-1, 1), a = rnd(0, Math.PI * 2), s = Math.sqrt(1 - z * z); d = vA.set(s * Math.cos(a), z, s * Math.sin(a)); }
        const sp = R * 2.2 * (ring ? 1 : rnd(0.75, 1));
        fPos.set([c.x, c.y, c.z], n * 3); fVel.set([d.x * sp, d.y * sp, d.z * sp], n * 3);
        fInfo.set([t + rise, rnd(1.5, 2.1), 2.2, R * 0.35], n * 4); fSize[n] = R * rnd(0.065, 0.09);
      }
      fCol.set([cc.r, cc.g, cc.b], n * 3);
    }
    for (const k in attr) attr[k].needsUpdate = true;
    fire.visible = true;
    flashes.push({ t: t + rise, c: col, x: rnd(-0.4, 0.4), y: rnd(0.05, 0.3), w: Math.random() * 6 });
    if (flashes.length > 6) flashes.shift();
    boom(rise, big);
  }

  /* ───────── 소리 (이미 소리가 켜져 있을 때만. 누른 사람은 그 김에 켠다) ───────── */
  let ac = null;
  function audio(wake) {
    try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { ac = null; }
    if (ac && wake && ac.state === 'suspended') ac.resume().catch(() => {});
    return ac && ac.state === 'running' ? ac : null;
  }
  function boom(delay, big) {
    const a = audio(false);
    if (!a) return;
    try {
      const len = Math.floor(a.sampleRate * 0.9), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4) * (i % 900 < 40 && i > len * 0.15 ? 2.5 : 1); // 펑 + 타닥타닥
      const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), t0 = a.currentTime + delay;
      s.buffer = buf; f.type = 'lowpass'; f.frequency.value = big ? 900 : 1300; g.gain.value = big ? 0.32 : 0.22;
      s.connect(f); f.connect(g); g.connect(a.destination); s.start(t0);
      const o = a.createOscillator(), og = a.createGain(); // 피융 (올라가는 소리)
      o.type = 'sine'; o.frequency.setValueAtTime(500, a.currentTime); o.frequency.exponentialRampToValueAtTime(1500, t0);
      og.gain.setValueAtTime(0.0001, a.currentTime); og.gain.exponentialRampToValueAtTime(0.025, a.currentTime + 0.05); og.gain.exponentialRampToValueAtTime(0.0001, t0);
      o.connect(og); og.connect(a.destination); o.start(); o.stop(t0 + 0.05);
    } catch (_) { /* 소리를 못 내도 불꽃은 보인다 */ }
  }

  /* ───────── 화면의 글: 위의 띠, 큰 숫자, 인사 ───────── */
  const style = document.createElement('style');
  style.textContent = '#xmasBand{position:absolute;left:50%;top:calc(58px + env(safe-area-inset-top));transform:translateX(-50%);z-index:5;pointer-events:none;white-space:nowrap;'
    + 'padding:5px 13px;border-radius:999px;background:rgba(122,26,34,.9);color:#FFF4E0;font-size:13px;font-weight:800;box-shadow:0 3px 10px rgba(0,0,0,.3);font-variant-numeric:tabular-nums}'
    + 'body.xmas-band #toast{top:calc(96px + env(safe-area-inset-top))}'
    + '#xmasBig{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);z-index:7;pointer-events:none;white-space:nowrap;font-weight:900;color:#FFF4E0;line-height:1.1;text-align:center;'
    + 'text-shadow:0 4px 18px rgba(0,0,0,.55),0 0 2px rgba(0,0,0,.4);font-size:120px}#xmasBig:empty{display:none}'
    + '#xmasBig.word{font-size:min(10vw,60px);color:#FFE9A8;text-shadow:0 0 18px rgba(255,200,90,.9),0 4px 18px rgba(0,0,0,.5)}'
    + '#xmasBig.on{animation:xpop .9s ease-out}@keyframes xpop{0%{transform:translate(-50%,-50%) scale(1.6);opacity:0}25%{transform:translate(-50%,-50%) scale(1);opacity:1}100%{transform:translate(-50%,-50%) scale(.94);opacity:.95}}';
  document.head.appendChild(style);
  const band = document.createElement('div'); band.id = 'xmasBand'; band.hidden = true; band.setAttribute('role', 'timer');
  const bigEl = document.createElement('div'); bigEl.id = 'xmasBig'; bigEl.setAttribute('role', 'status'); bigEl.setAttribute('aria-live', 'assertive');
  document.body.append(band, bigEl);
  function big(text, cls = '') { if (bigEl.textContent === text) return; bigEl.textContent = text; bigEl.className = cls; void bigEl.offsetWidth; bigEl.classList.add('on'); }
  function tick(f) { const a = audio(false); if (!a) return; try { const o = a.createOscillator(), g = a.createGain(), t0 = a.currentTime; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.1, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15); o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + 0.2); } catch (_) { /* 무시 */ } }

  // 트리 판의 "🎆 불꽃놀이" (크리스마스 하루는 꾸밀 수 있는 사람, 방장은 아무 날에나)
  const fireBtn = document.createElement('button');
  fireBtn.type = 'button'; fireBtn.id = 'fireShow'; fireBtn.className = 'btn main'; fireBtn.style.padding = '0 10px'; fireBtn.textContent = '🎆 불꽃놀이';
  // 판이 길어지면 트리가 작아지므로 새 줄을 만들지 않고, 전구 줄(두 줄로 접히는 자리)의 빈자리에 붙인다
  const fireRow = fireBtn; fireBtn.hidden = true;
  queueMicrotask(() => { const box = $('lightList'); if (box) box.append(fireBtn); }); // 전구 색 단추들이 다 놓인 뒤 맨 끝에

  /* ───────── 불꽃놀이 장면 ───────── */
  // show = { until(실제 시각 ms), next(다음 불꽃, 초), mid(자정 장면인지) }
  let show = null, lastFire = -1e15, ceilOff = false;
  function startShow(sec, mid) {
    const t = now();
    if (show && !mid) show.until = Math.max(show.until, t + sec * 1000);
    else show = { until: t + sec * 1000, next: clock() + 0.2, mid };
  }
  function pressFire(mine) {
    const t = now();
    if (mine) {
      if (!K.isHost()) {
        if (!isXmas(t)) { K.toast('불꽃놀이는 크리스마스에만 할 수 있어요 (방장은 언제나)'); return false; }
        if (!K.canEdit()) { K.toast('불꽃놀이는 꾸미는 사람만 터뜨릴 수 있어요'); return false; }
      }
      const wait = Math.ceil(XMAS.gap - (t - lastFire) / 1000);
      if (wait > 0) { K.toast(`불꽃놀이는 30초에 한 번이에요 (${wait}초 뒤)`); return false; }
      audio(true);
      K.fx({ k: 'show', v: 'fire' });
    }
    lastFire = t;
    startShow(XMAS.again, false);
    K.toast(mine ? '불꽃놀이! 🎆' : '불꽃놀이가 시작돼요! 🎆');
    return true;
  }
  fireBtn.addEventListener('click', () => pressFire(true));

  /* ───────── 1분마다: 하늘·빛·날씨 ───────── */
  const BRIGHT = K.bright, BASE = [...BRIGHT];
  const cur = { key: '', day: 1, dusk: 0, weather: 0, snow: 0, snowGoal: 0, hemiColor: new THREE.Color(0xFFEFD8), lightKey: '' };
  let quietAt = -9, checkAt = -9, phaseKey = '', xmasFired = false;
  const tmp = new THREE.Color(), tmp2 = new THREE.Color();
  function colors(day, dusk, gray) { // 하늘 [위, 지평선]
    const top = PAL.night[0].clone().lerp(PAL.day[0], day), hor = PAL.night[1].clone().lerp(PAL.day[1], day);
    top.lerp(PAL.dusk[0], dusk * 0.8); hor.lerp(PAL.dusk[1], dusk * 0.85);
    if (gray) { top.lerp(tmp.copy(PAL.gray[0]).multiplyScalar(mix(0.35, 1, day)), gray); hor.lerp(tmp.copy(PAL.gray[1]).multiplyScalar(mix(0.35, 1, day)), gray); }
    return [top, hor];
  }
  function update(force) {
    const t = now(), d = new Date(t), key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}`;
    const weather = weatherAt(t);
    cur.weather = weather; cur.snowGoal = [0, 0.45, 1][weather];
    if (key !== cur.key || force) {
      cur.key = key;
      const { day, dusk } = skyAt(t), gray = weather === 2 ? 0.45 : weather === 1 ? 0.2 : 0;
      cur.day = day; cur.dusk = dusk;
      const [top, hor] = colors(day, dusk, gray * Math.max(day, 0.3));
      U.uTop.value.copy(top); U.uHor.value.copy(hor);
      U.uGround.value.copy(PAL.snowNight).lerp(PAL.snowDay, day).lerp(tmp.set(0xF4B88A), dusk * 0.35);
      const clear = 1 - gray * 1.6;
      U.uStars.value = (1 - day) * (1 - dusk * 0.7) * clamp(clear, 0, 1);
      U.uMoon.value = smooth((0.5 - day) * 2) * clamp(1 - gray, 0.3, 1);
      U.uSun.value = day * (1 - dusk) * clamp(1 - gray * 2, 0, 1);
      paintBg(top, hor, U.uStars.value);
      // 마당: 밤에는 어둡게, 창 빛·가로등은 밝게
      const yk = mix(mix(0.42, 1, day), 0.78, dusk * (1 - day) * 0.6);
      for (const y of yardMats) y.m.color.copy(y.color).multiplyScalar(yk);
      const night = 1 - day;
      glassMat.color.copy(PAL.glassDay).lerp(PAL.glassNight, smooth(night * 1.3));
      poolMat.opacity = 0.75 * smooth(night * 1.2);
      halo.material.opacity = 0.9 * smooth(night * 1.2);
      SU.uColor.value.set(0xFFFFFF).lerp(tmp.set(0xAFBBD9), night * 0.55);
      // 트리 둘레 빛은 밤에 조금 더 멀리 퍼진다 (세기는 점등식·전구가 정한다)
      K.glow.distance = mix(7.5, 6, day);
      // 조명 바탕값: 점등식 중이 아닐 때만 바꾼다
      const k = (i) => mix(mix(PAL.lNight[i], PAL.lDay[i], day), PAL.lDusk[i], dusk * 0.7);
      const wk = (a) => mix(1, a, day); // 흐린 날은 낮에만 조금 어둡게 (밤의 실내 밝기는 그대로)
      cur.light = { hemi: k(2) * wk(weather === 2 ? 0.96 : 1), sun: k(3) * wk(weather === 2 ? 0.9 : weather === 1 ? 0.96 : 1) };
      cur.hemiColor.copy(PAL.lNight[0]).lerp(PAL.lDay[0], day).lerp(PAL.lDusk[0], dusk * 0.7);
      cur.sunColor = PAL.lNight[1].clone().lerp(PAL.lDay[1], day).lerp(PAL.lDusk[1], dusk * 0.7);
    }
  }
  function applyLight() {
    if (!cur.light) return;
    const lk = cur.light.hemi.toFixed(5) + cur.light.sun.toFixed(5);
    if (lk !== cur.lightKey && !K.busy() && clock() - quietAt > 3) {
      cur.lightKey = lk;
      const r0 = hemi.intensity / BRIGHT[0], r1 = sun.intensity / BRIGHT[1]; // 점등식이 곱해 둔 배수 (보통 정확히 1)
      BRIGHT[0] = BASE[0] * cur.light.hemi; BRIGHT[1] = BASE[1] * cur.light.sun;
      hemi.intensity = BRIGHT[0] * r0; sun.intensity = BRIGHT[1] * r1;
      sun.color.copy(cur.sunColor);
    }
    if (K.busy()) quietAt = clock();
  }

  /* ───────── 자정 ───────── */
  function midnight() {
    const t = now(), { phase, left } = xmasPhase(t);
    const pk = phase === 'band' ? 'b' + Math.ceil(left) : phase === 'count' ? 'c' + Math.ceil(left) : phase || '';
    if (pk === phaseKey) return;
    const was = phaseKey; phaseKey = pk;
    band.hidden = phase !== 'band';
    document.body.classList.toggle('xmas-band', phase === 'band');
    if (phase === 'band') { const s = Math.ceil(left), m = Math.floor(s / 60); band.textContent = `🎄 크리스마스까지 ${m}:${String(s % 60).padStart(2, '0')}`; }
    if (phase === 'count') { const n = Math.ceil(left); big(String(n), 'num'); tick(n <= 3 ? 880 : 620); }
    if (phase === 'show') {
      if (!show || !show.mid) { // 0시 정각 (또는 그 뒤 40초 안에 들어옴)
        show = { until: xmasAt(t) + XMAS.show * 1000, next: clock() + 0.05, mid: true, hi: clock() };
        big('메리 크리스마스! 🎄', 'word');
        if (!xmasFired) { xmasFired = true; try { window.dispatchEvent(new CustomEvent('tree:xmas', { detail: { at: xmasAt(t) } })); } catch (_) { /* 무시 */ } }
      }
    }
    if (!phase && was.startsWith('c')) bigEl.textContent = ''; // 혹시 숫자가 남아 있으면
    if (phase !== 'count' && phase !== 'show' && bigEl.className.startsWith('num')) bigEl.textContent = '';
  }

  /* ───────── 매 그림마다 ───────── */
  function frame(dt) {
    const c = clock();
    U.uTime.value = c % 1000;
    if (c - checkAt > 0.5) { checkAt = c; update(false); paintFireBtn(); }
    applyLight();
    midnight();
    // 눈: 날씨가 바뀌면 몇 초에 걸쳐 늘고 준다
    cur.snow += (cur.snowGoal - cur.snow) * Math.min(1, dt * 0.9);
    if (Math.abs(cur.snowGoal - cur.snow) < 0.004) cur.snow = cur.snowGoal;
    U.uSnow.value = cur.snow; SU.uDensity.value = cur.snow;
    snowPts.visible = cur.snow > 0.002;
    snowPts.position.y = K.level() * FLOOR_H;
    // 카메라에 맞춘 점 크기
    const cam = K.cam(), H = K.height();
    if (cam.isPerspectiveCamera) { const px = H / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)); SU.uPx.value = FU.uPx.value = px; SU.uPersp.value = FU.uPersp.value = 1; }
    else { const px = H / ((cam.top - cam.bottom) / cam.zoom); SU.uPx.value = FU.uPx.value = px; SU.uPersp.value = FU.uPersp.value = 0; }
    dome.visible = K.eye();
    if (dome.visible) dome.position.copy(cam.position);
    // 불꽃놀이
    const t = now();
    if (show) {
      if (t >= show.until) { show = null; }
      else if (c >= show.next) {
        const fin = show.mid && show.until - t < 6000; // 마지막 6초는 한꺼번에
        burst(fin || Math.random() < 0.15);
        if (fin || Math.random() < 0.3) burst(false);
        show.next = c + (fin ? rnd(0.25, 0.45) : rnd(0.55, 1.1));
      }
      if (show && show.mid && show.hi && c - show.hi > 6 && bigEl.className.startsWith('word')) bigEl.textContent = '';
    }
    // 방을 물들이는 빛과 창 그림의 불꽃
    let tint = 0; tmp2.setRGB(0, 0, 0);
    for (let k = 0; k < 4; k++) U.uFw.value[k].set(0, 0, 0, 0);
    let live = 0;
    for (let k = flashes.length - 1; k >= 0; k--) {
      const f = flashes[k], a = (c - f.t) / 1.6;
      if (a > 1.2) { flashes.splice(k, 1); continue; }
      if (a > 0 && live < 4) { U.uFw.value[live].set(f.x, f.y, a, f.w); U.uFwC.value[live].copy(f.c); live++; }
      const s = a > 0 ? Math.max(0, 1 - a * 1.6) : 0;
      if (s > tint) { tint = s; tmp2.copy(f.c); }
    }
    hemi.color.copy(cur.hemiColor);
    if (tint > 0) hemi.color.lerp(tmp2, tint * 0.4);
    const busyFire = !!show || flashes.length > 0;
    if (!busyFire && fire.visible && c - lastBurstEnd() > 0) fire.visible = false;
    // 3층의 1인칭: 불꽃놀이 동안은 천장을 걷어 하늘을 본다
    const top = room.floors[room.floors.length - 1];
    const open = busyFire && K.level() === room.floors.length - 1 && K.eye();
    if (open) { if (top.ceil.visible) top.ceil.visible = false; ceilOff = true; }
    else if (ceilOff) { ceilOff = false; top.ceil.visible = K.eye(); }
  }
  // 마지막으로 터진 불꽃이 다 사라지는 때
  function lastBurstEnd() { let e = 0; for (let n = 0; n < FN; n++) e = Math.max(e, fInfo[n * 4] + fInfo[n * 4 + 1]); return e; }
  function paintFireBtn() {
    const on = (isXmas(now()) && K.canEdit()) || K.isHost();
    if (fireRow.hidden === on) { fireRow.hidden = !on; K.resized(); }
  }
  update(true);
  applyLight();

  return {
    tick: frame,
    // 친구가 터뜨린 불꽃놀이. 받을 만한 소식이면 true (방장이 다른 사람들에게 전해 준다)
    peerFx(m, id) {
      if (m.v !== 'fire' || !K.mayLead(id)) return false;
      const t = now(), d = new Date(t);
      // 방장이 받는 손님의 소식은 크리스마스 때만 (시계가 조금 다른 친구까지 24~26일). 손님은 방장이 걸러 보낸 것(방장 자신의 것 포함)을 그대로 받는다
      if (K.isHost() && (d.getMonth() !== 11 || Math.abs(d.getDate() - 25) > 1)) return false;
      if ((t - lastFire) / 1000 < XMAS.gap - 5) return false;
      return pressFire(false);
    },
    // 자동 검사가 쓰는 창구
    test: {
      get state() { return { day: cur.day, dusk: cur.dusk, weather: cur.weather, snow: cur.snow, phase: skyAt(now()).phase, hemi: hemi.intensity, sun: sun.intensity, base: [...BRIGHT], stars: U.uStars.value, moon: U.uMoon.value, glass: glassMat.color.getHex(), pool: poolMat.opacity, top: U.uTop.value.getHex(), hor: U.uHor.value.getHex() }; },
      get show() { return show ? { mid: show.mid, left: (show.until - now()) / 1000 } : null; },
      get fire() { let n = 0; const t = clock(); for (let k = 0; k < FN; k++) if (t >= fInfo[k * 4] && t <= fInfo[k * 4] + fInfo[k * 4 + 1]) n++; return { visible: fire.visible, live: n, flashes: flashes.length, tint: hemi.color.getHex() }; },
      get band() { return band.hidden ? null : band.textContent; },
      get big() { return bigEl.textContent; },
      get dome() { return dome.visible; },
      get snowShown() { return snowPts.visible; },
      get ceil() { return room.floors[room.floors.length - 1].ceil.visible; },
      get button() { return !fireRow.hidden; },
      burst: (b) => burst(!!b), press: () => pressFire(true), refresh: () => { update(true); paintFireBtn(); },
      panes: () => { let n = 0; room.floors.forEach((f) => f.g.traverse((m) => { if (m.material === pane) n++; })); return n; },
      yardMats: () => yardMats.length,
    },
  };
}
