// 도형 도우미. 방·아바타·가구가 같이 쓴다.
import * as THREE from './vendor/three.module.min.js';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';

export { THREE };

/* ───────── 온 화면에 같이 드는 빛 처리 ───────── */
// FX.glow: 스스로 빛나는 것(전구·촛불·불꽃·달 …)을 몇 배 밝게 그릴지. 후처리(post.js)가 켜져 있을 때만 1 보다 커서
// 그 밝기가 빛 번짐으로 퍼진다. 후처리를 끄면 1 이라 예전과 똑같이 그려진다. FX.t = 흐른 시간(초, 불꽃이 일렁이는 데 쓴다)
export const FX = { glow: { value: 1 }, hot: 2.6, t: { value: 0 }, px: { value: 800 } }; // px = 화면 높이(그리는 픽셀)
// 빛나는 재질로 만든다(MeshBasicMaterial·SpriteMaterial). k = 얼마나 빛날지(1 = 보통, 0.5 = 은은하게)
//   flick: 밝기가 불처럼 일렁인다(물체마다 박자가 다르다)
//   sway : 불꽃 모양이 흔들린다. bake 가 'flame' 덩어리에 넣어 주는 fl 값(불꽃 안의 높이 0~1, 불꽃 크기, 박자)을 쓴다
export function hot(mat, k = 1, { flick = false, sway = false } = {}) {
  const kk = { value: k };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uFxGlow = FX.glow; sh.uniforms.uFxK = kk; sh.uniforms.uFxT = FX.t;
    let gain = 'outgoingLight *= 1.0 + (uFxGlow - 1.0) * uFxK;\n';
    if (flick) {
      sh.vertexShader = 'varying vec4 vFxO;\n' + (sway ? 'attribute vec4 fl;\n' : '') + 'uniform float uFxT;\n' + sh.vertexShader;
      if (sway) sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        { float fh = fl.x * fl.x, ph = fl.z, t = uFxT;
          transformed.x += (sin(t * 7.1 + ph) * 0.09 + sin(t * 13.3 + ph * 2.3) * 0.04) * fl.y * fh;
          transformed.z += (cos(t * 6.3 + ph * 1.7) * 0.07) * fl.y * fh;
          transformed.y += (sin(t * 9.7 + ph * 3.1) * 0.08) * fl.y * fl.x; }`);
      sh.vertexShader = sh.vertexShader.replace('#include <fog_vertex>', '#include <fog_vertex>\nvFxO = vec4(modelMatrix[3].xyz, ' + (sway ? 'fl.z' : '0.0') + ');');
      sh.fragmentShader = 'varying vec4 vFxO;\nuniform float uFxT;\n' + sh.fragmentShader;
      gain += `{ float p = dot(vFxO.xyz, vec3(1.7, 0.9, 2.3)) + vFxO.w;
        outgoingLight *= 0.8 + 0.2 * (0.55 + 0.45 * sin(uFxT * 11.0 + p)) * (0.7 + 0.3 * sin(uFxT * 4.7 + p * 1.9)); }\n`;
    }
    sh.fragmentShader = 'uniform float uFxGlow, uFxK;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', gain + '#include <opaque_fragment>');
  };
  mat.customProgramCacheKey = () => 'fxhot' + (flick ? 'f' : '') + (sway ? 's' : '');
  mat.userData.hot = kk;
  return mat;
}
// 바닥에 닿은 그늘: 빛을 받는 모든 재질(램버트·퐁·스탠다드)에서 바닥 가까운 옆면을 살짝 어둡게 한다.
// 벽 밑동, 가구 다리, 나무 밑동, 사람의 발치가 바닥에 붙어 보인다. 층 높이(2.8)마다 되풀이되어 위층에도 든다.
// 위를 보는 면(바닥·탁자 윗면)은 그대로. 셰이더 조각 하나만 바꾸므로 재질 수나 그리기 호출은 늘지 않는다.
THREE.ShaderChunk.lights_fragment_end += /* glsl */`
{
  vec3 gwP = cameraPosition + (vec4(geometryPosition, 0.0) * viewMatrix).xyz;
  vec3 gwN = inverseTransformDirection(geometryNormal, viewMatrix);
  float gh = mod(gwP.y + 0.012, 2.8);
  float gk = mix(0.7, 1.0, smoothstep(0.0, 0.38, gh));
  gk = mix(gk, 1.0, smoothstep(0.3, 0.8, gwN.y));
  reflectedLight.indirectDiffuse *= gk;
  reflectedLight.directDiffuse *= mix(1.0, gk, 0.4);
  // 눈(푸른빛을 조금 내는 눈 재질)은 작은 반짝이가 박혀 있다. 보는 방향이 바뀌면 다른 알갱이가 반짝인다
  #if defined( LAMBERT ) || defined( PHONG )
  if (emissive.b > 0.03 && emissive.b > emissive.r * 2.5) {
    vec3 gq = gwP * 26.0, gc = floor(gq);
    vec3 gv = normalize(cameraPosition - gwP);
    float gs = fract(sin(dot(gc + floor(gv * 3.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    vec3 go = fract(gc.zxy * 0.1731 + gc.yzx * 0.3197) * 0.5 + 0.25;
    float gd = length(gq - gc - go);
    reflectedLight.directDiffuse += vec3(1.0, 0.97, 0.92) * step(0.955, gs) * smoothstep(0.16, 0.02, gd) * 1.6;
  }
  #endif
}
`;

const mats = new Map();
// 같은 색은 재질 하나를 나눠 쓴다. flat = true 면 면이 각져 보인다(로우폴리).
export function M(hex, flat = false) {
  const key = hex + (flat ? 'f' : '');
  let m = mats.get(key);
  if (!m) { m = new THREE.MeshLambertMaterial({ color: hex, flatShading: flat }); m.userData.bk = { kind: 'plain', flat }; mats.set(key, m); } // bk = bake 가 합칠 때 보는 표시
  return m;
}
export function put(geo, mat, x, y, z, parent, cast = true) {
  const m = new THREE.Mesh(geo, typeof mat === 'number' ? M(mat) : mat);
  m.position.set(x, y, z);
  m.castShadow = cast; m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function rbox(w, h, d, r = 0.03) {
  return new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
}
// 모서리를 한 번만 깎은 상자: rbox 보다 세모 수가 3분의 1이다. 작은 것, 멀리서만 보는 것에 쓴다
export function cbox(w, h, d, r = 0.02) {
  return new RoundedBoxGeometry(w, h, d, 1, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
}
export const cyl = (rt, rb, h, seg = 18) => new THREE.CylinderGeometry(rt, rb, h, seg);
export const ball = (r, w = 18, h = 14) => new THREE.SphereGeometry(r, w, h);
export const cap = (r, len, seg = 10) => new THREE.CapsuleGeometry(r, len, 4, seg);

/* ───────── 디테일용 도우미 (더하기만 했다. 위의 것들은 그대로) ───────── */
// 작은 무늬 그림(256px 이내). 모듈에서 한 번만 그려서 모든 가구와 방이 같이 쓴다.
// 밝은 무늬는 색(꼭짓점 색)과 곱해져 그 색의 나뭇결·천 짜임이 되고, 벽돌·러그처럼 색이 있는 그림은 흰색과 곱해 그대로 보인다.
const texs = new Map();
function canvas(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  draw(c.getContext('2d'), rnd, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; // 비등방 필터는 켜지 않는다 (느린 기기에서 화면 전체가 느려진다)
  return t;
}
const PAINT = {
  // 나뭇결: 가로로 흐르는 옅은 줄과 옹이 하나
  wood(g, rnd, S) {
    g.fillStyle = '#F4EEE6'; g.fillRect(0, 0, S, S);
    for (let k = 0; k < 70; k++) {
      const y = rnd() * S, a = 0.05 + rnd() * 0.13, w = 0.6 + rnd() * 1.8;
      g.strokeStyle = rnd() < 0.3 ? `rgba(255,255,255,${a * 1.6})` : `rgba(96,58,30,${a})`; g.lineWidth = w;
      g.beginPath(); g.moveTo(0, y);
      const dy = (rnd() - 0.5) * 7;
      g.bezierCurveTo(S * 0.33, y + dy, S * 0.66, y - dy, S, y); g.stroke();
    }
    g.strokeStyle = 'rgba(96,58,30,.16)'; g.lineWidth = 1.2;
    for (const r of [5, 10, 16]) { g.beginPath(); g.ellipse(S * 0.62, S * 0.4, r * 2.2, r, 0, 0, 7); g.stroke(); }
  },
  // 천 짜임: 가로세로 올
  fabric(g, rnd, S) {
    g.fillStyle = '#F2EFEA'; g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 4) for (let x = 0; x < S; x += 4) {
      const v = rnd();
      g.fillStyle = (x + y) % 8 ? `rgba(60,40,30,${0.05 + v * 0.07})` : `rgba(255,255,255,${0.25 + v * 0.3})`;
      g.fillRect(x, y, 2, 4); g.fillStyle = `rgba(60,40,30,${0.03 + v * 0.05})`; g.fillRect(x + 2, y + 2, 2, 2);
    }
  },
  // 체크(이불·담요): 굵은 띠와 가는 줄
  plaid(g, rnd, S) {
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, S, S);
    const band = (v, w, a) => { g.fillStyle = `rgba(70,20,20,${a})`; g.fillRect(v, 0, w, S); g.fillRect(0, v, S, w); };
    band(0, 44, 0.3); band(128, 44, 0.3); band(76, 6, 0.42); band(204, 6, 0.42);
    g.fillStyle = 'rgba(255,255,255,.5)'; for (const v of [100, 228]) { g.fillRect(v, 0, 3, S); g.fillRect(0, v, S, 3); }
    for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(60,30,20,${rnd() * 0.07})`; g.fillRect(rnd() * S, rnd() * S, 2, 2); }
  },
  // 뜨개(양말·목도리): 브이 모양 코
  knit(g, rnd, S) {
    g.fillStyle = '#F6F2EC'; g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(70,40,30,.22)'; g.lineWidth = 2.2; g.lineCap = 'round';
    for (let y = -8; y < S; y += 16) for (let x = 0; x < S; x += 16) { g.beginPath(); g.moveTo(x + 1, y); g.lineTo(x + 8, y + 12); g.lineTo(x + 15, y); g.stroke(); }
  },
  // 벽돌: 세 줄 엇갈려 쌓기 (색이 든 그림)
  brick(g, rnd, S) {
    g.fillStyle = '#E6D3BC'; g.fillRect(0, 0, S, S);
    const rows = 8, bh = S / rows, bw = S / 3, tones = ['#B5523F', '#A94936', '#BF5B47', '#9F4433', '#B8573D', '#C46650'];
    for (let r = 0; r < rows; r++) for (let k = -1; k < 3; k++) {
      const x = k * bw + (r % 2 ? bw / 2 : 0);
      g.fillStyle = tones[Math.floor(rnd() * tones.length)];
      g.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4);
      g.fillStyle = 'rgba(255,255,255,.10)'; g.fillRect(x + 2, r * bh + 2, bw - 4, 3);
      g.fillStyle = 'rgba(60,20,10,.14)'; g.fillRect(x + 2, r * bh + bh - 5, bw - 4, 3);
    }
  },
  // 돌(난로 바닥·디딤돌): 얼룩과 점
  stone(g, rnd, S) {
    g.fillStyle = '#EEEAE4'; g.fillRect(0, 0, S, S);
    for (let k = 0; k < 60; k++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '70,60,50'},${0.04 + rnd() * 0.08})`; g.beginPath(); g.ellipse(rnd() * S, rnd() * S, 6 + rnd() * 22, 4 + rnd() * 12, rnd() * 3, 0, 7); g.fill(); }
    for (let k = 0; k < 500; k++) { g.fillStyle = `rgba(60,50,45,${rnd() * 0.16})`; g.fillRect(rnd() * S, rnd() * S, 1.5, 1.5); }
  },
  // 세로 줄무늬(커튼·벽지 아랫단): 주름처럼 보이는 밝고 어두운 띠
  pleat(g, rnd, S) {
    const gr = g.createLinearGradient(0, 0, S, 0);
    for (let k = 0; k <= 8; k++) gr.addColorStop(k / 8, k % 2 ? '#D9D2CA' : '#FFFFFF');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
  },
  // 널판(징두리 판벽·문): 세로 널 사이의 홈
  plank(g, rnd, S) {
    g.fillStyle = '#F6F1EA'; g.fillRect(0, 0, S, S);
    for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(96,58,30,${0.03 + rnd() * 0.06})`; g.fillRect(rnd() * S, 0, 1 + rnd() * 2, S); }
    for (let x = 0; x < S; x += S / 4) { g.fillStyle = 'rgba(70,40,20,.34)'; g.fillRect(x, 0, 3, S); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(x + 3, 0, 2, S); }
  },
  // 눈밭: 바람에 쓸린 옅은 결과 그늘진 둔덕, 아주 작은 알갱이
  snow(g, rnd, S) {
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, S, S);
    for (let k = 0; k < 46; k++) {
      const x = rnd() * S, y = rnd() * S, r = 18 + rnd() * 60, gr = g.createRadialGradient(x, y, 0, x, y, r);
      const c = rnd() < 0.55 ? '150,170,215' : '255,255,255', a = rnd() < 0.55 ? 0.1 : 0.35;
      gr.addColorStop(0, `rgba(${c},${a})`); gr.addColorStop(1, `rgba(${c},0)`);
      for (const [dx, dy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) { g.save(); g.translate(dx, dy); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.restore(); }
    }
    g.lineCap = 'round';
    for (let k = 0; k < 26; k++) { // 바람 결
      const y = rnd() * S, x = rnd() * S, l = 30 + rnd() * 70;
      g.strokeStyle = `rgba(140,160,210,${0.05 + rnd() * 0.06})`; g.lineWidth = 1 + rnd() * 2;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 4 + rnd() * 8, x + l, y + (rnd() - 0.5) * 6); g.stroke();
    }
    for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '130,150,200'},${rnd() * 0.18})`; g.fillRect(rnd() * S, rnd() * S, 1.2, 1.2); }
  },
  // 벽지: 아주 옅은 세로줄과 작은 마름모
  paper(g, rnd, S) {
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += 32) { g.fillStyle = 'rgba(120,80,50,.045)'; g.fillRect(x, 0, 16, S); }
    for (let y = 0; y < S; y += 32) for (let x = 0; x < S; x += 32) {
      const ox = x + ((y / 32) % 2 ? 24 : 8), oy = y + 16;
      g.fillStyle = 'rgba(120,80,50,.13)'; g.beginPath(); g.moveTo(ox, oy - 5); g.lineTo(ox + 4, oy); g.lineTo(ox, oy + 5); g.lineTo(ox - 4, oy); g.fill();
      g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(ox - 1, oy - 1, 2, 2);
    }
  },
};
// kind 무늬 그림 (같은 이름은 한 장을 나눠 쓴다)
export function tex(kind) {
  let t = texs.get(kind);
  if (!t) { t = canvas(kind === 'fabric' || kind === 'knit' ? 128 : 256, kind === 'fabric' || kind === 'knit' ? 128 : 256, (g, rnd, w) => PAINT[kind](g, rnd, w)); texs.set(kind, t); }
  return t;
}
// 둥글게 번지는 그림 한 장: 가구 밑 그림자와 불빛 번짐이 같이 쓴다
let softTex = null;
export function soft() {
  if (softTex) return softTex;
  softTex = canvas(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
  softTex.wrapS = softTex.wrapT = THREE.ClampToEdgeWrapping;
  return softTex;
}
// 무늬가 든 색 재질. 1 m 에 무늬가 몇 번 되풀이될지는 DENS 가 정한다(bake 가 겉면 자리로 UV 를 새로 매긴다).
const DENS = { plain: 0, paper: 1.6, wood: 1.3, fabric: 5, plaid: 2.4, knit: 7, brick: 1.5, stone: 1.6, pleat: 2.2, plank: 2.5 };
const tms = new Map();
export function T(hex, kind = 'wood', flat = false) {
  if (kind === 'wood' || kind === 'fabric' || kind === 'stone') return M(hex, flat); // 은은한 결은 넓은 면을 덮어 느린 기기에서 무겁다. 눈에 띄는 무늬(체크·뜨개·벽돌·주름)만 그림을 입힌다
  const key = hex + kind + (flat ? 'f' : '');
  let m = tms.get(key);
  if (!m) { m = new THREE.MeshLambertMaterial({ color: hex, map: tex(kind), flatShading: flat }); m.userData.bk = { kind, flat }; tms.set(key, m); }
  return m;
}
// 스스로 빛나 보이는 색 (같은 색은 하나를 나눠 쓴다). bake 가 한 덩어리로 합친다
const lits = new Map();
export function L(hex) {
  let m = lits.get(hex);
  if (!m) { m = new THREE.MeshBasicMaterial({ color: hex }); m.userData.bk = { kind: 'lit' }; lits.set(hex, m); }
  return m;
}
// 반들반들한 색(사기·칠한 쇠·포장지·리본·유리 장): 빛이 비치는 쪽에 작은 하이라이트가 생긴다. bake 가 한 덩어리로 합친다
const glossy = new Map();
export function G(hex) {
  let m = glossy.get(hex);
  if (!m) { m = new THREE.MeshPhongMaterial({ color: hex, shininess: 42, specular: 0x2E2A26 }); m.userData.bk = { kind: 'gloss' }; glossy.set(hex, m); }
  return m;
}
// 정말로 빛을 내는 색(전구·촛불·불꽃·등갓): L 과 같지만 후처리가 켜지면 더 밝게 그려져 둘레로 빛이 번진다
const glows = new Map();
// k = 얼마나 빛날지(1 = 전구·불꽃, 0.4 = 빛이 비치는 유리창처럼 은은하게). bake 는 k 마다 한 덩어리로 합친다
export function E(hex, k = 1) {
  const key = hex + ':' + k;
  let m = glows.get(key);
  if (!m) { m = hot(new THREE.MeshBasicMaterial({ color: hex }), k); m.userData.bk = { kind: k === 1 ? 'glow' : 'glow' + k }; glows.set(key, m); }
  return m;
}
// 불꽃(촛불·벽난로): 빛나면서 저마다 일렁이고 흔들린다. 위로 선 도형(원뿔 등)에 쓴다. bake 가 한 덩어리로 합친다
const flames = new Map();
export function F(hex) {
  let m = flames.get(hex);
  if (!m) { m = hot(new THREE.MeshBasicMaterial({ color: hex }), 0.5, { flick: true }); m.userData.bk = { kind: 'flame' }; flames.set(hex, m); }
  return m;
}
// 눈: 따뜻한 조명 아래에서도 하얗게 보이도록 푸른빛을 조금 스스로 낸다 (마당의 눈밭과 같은 색)
let snowMat = null;
export function SN() {
  if (!snowMat) { snowMat = new THREE.MeshLambertMaterial({ color: 0xE6EEFF, emissive: 0x1C2A44 }); snowMat.userData.bk = { kind: 'snow' }; }
  return snowMat;
}
// 스스로 빛나는 종류(그림자를 드리우지도 받지도 않는다)
const emits = (kind) => kind === 'lit' || kind === 'flame' || kind.startsWith('glow');
// 합친 덩어리가 쓰는 재질: 색은 꼭짓점마다 들어 있다. 무늬 종류마다 하나씩, 온 집이 같이 쓴다
const vms = new Map();
export function VM(kind = 'plain') {
  let m = vms.get(kind);
  if (!m) {
    m = kind === 'lit' ? new THREE.MeshBasicMaterial({ vertexColors: true })
      : kind === 'flame' ? hot(new THREE.MeshBasicMaterial({ vertexColors: true }), 0.5, { flick: true, sway: true })
      : emits(kind) ? hot(new THREE.MeshBasicMaterial({ vertexColors: true }), kind === 'glow' ? 1 : +kind.slice(4))
      : kind === 'snow' ? new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x1C2A44 })
      : kind === 'gloss' ? new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 42, specular: 0x2E2A26 })
      : new THREE.MeshLambertMaterial({ vertexColors: true, map: kind === 'plain' ? null : tex(kind) });
    vms.set(kind, m);
  }
  return m;
}
// 묶음 g 안의 도형들을 재질 종류별로 한 덩어리씩 합친다(그리기 호출을 줄인다). 색은 꼭짓점 색으로 옮긴다.
// M()·T()·L() 로 만든 재질의 메시만 합치고, 다른 재질(TV 화면, 그림이 든 것 등)과 userData.keep 인 것, userData.own 인 묶음 안쪽은 그대로 둔다.
// userData.own 인 묶음(탁자 위 소품처럼 따로 숨겨야 하는 것)은 그 안에서 따로 합친다.
const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _c = new THREE.Color(), _nm = new THREE.Matrix3();
// grid 를 주면 그 크기(m)의 바닥 칸마다 덩어리를 나눈다: 넓게 퍼진 것(마당·벽)이 화면 밖일 때 그리지 않게 하려는 것이다
// receive = false 면 합친 덩어리가 그림자를 받지 않는다(벽에 붙은 장식처럼 받을 일이 거의 없는 것. 픽셀마다 드는 계산이 준다)
export function bake(g, grid = 0, receive = true) {
  g.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), rel = new THREE.Matrix4();
  const buckets = new Map(), gone = [];
  const walk = (o) => {
    for (const ch of o.children) {
      if (ch.userData.keep) continue;
      if (ch.userData.own) { bake(ch, grid, receive); continue; }
      if (ch.isMesh && !ch.isInstancedMesh) {
        const bk = ch.material && ch.material.userData && ch.material.userData.bk;
        if (!bk || !ch.visible) continue;
        rel.multiplyMatrices(inv, ch.matrixWorld); _nm.getNormalMatrix(rel);
        const cast = ch.castShadow && !emits(bk.kind); // 그림자를 드리우는 것과 아닌 것은 따로 합친다 (그림자를 그릴 때 작은 장식은 빠진다)
        const key = bk.kind + (cast ? '+' : '') + (grid ? '|' + Math.floor(rel.elements[12] / grid) + ',' + Math.floor(rel.elements[14] / grid) : '');
        let b = buckets.get(key);
        if (!b) { b = { kind: bk.kind, pos: [], nor: [], col: [], uv: [], fl: [], idx: [], cast }; buckets.set(key, b); }
        let geo = ch.geometry;
        if (bk.flat) { geo = geo.index ? geo.toNonIndexed() : geo.clone(); geo.computeVertexNormals(); }
        const flip = rel.determinant() < 0; // 뒤집힌(거울) 도형은 세모의 감는 방향을 바꾼다
        const P = geo.attributes.position, N = geo.attributes.normal, base = b.pos.length / 3, d = DENS[bk.kind] || 0, sw = ch.userData.sw;
        _c.copy(ch.material.color);
        let fy0 = 0, fh = 1, fph = 0, fh0 = 0;
        if (bk.kind === 'flame') { // 불꽃: 도형 안의 높이(아래 0, 끝 1)와 크기, 불꽃마다 다른 박자
          if (!geo.boundingBox) geo.computeBoundingBox();
          fy0 = geo.boundingBox.min.y; fh = Math.max(1e-3, geo.boundingBox.max.y - fy0);
          fph = (rel.elements[12] * 7.13 + rel.elements[13] * 3.7 + rel.elements[14] * 5.31) % 6.283;
          fh0 = fh * _v.setFromMatrixScale(rel).y;
        }
        for (let i = 0; i < P.count; i++) {
          if (bk.kind === 'flame') b.fl.push((P.getY(i) - fy0) / fh, fh0, fph, 0);
          _v.fromBufferAttribute(P, i).applyMatrix4(rel); _n.fromBufferAttribute(N, i).applyMatrix3(_nm).normalize();
          b.pos.push(_v.x, _v.y, _v.z); b.nor.push(_n.x, _n.y, _n.z); b.col.push(_c.r, _c.g, _c.b);
          if (d) { // 겉면이 보는 쪽에 맞춰 무늬를 펼친다
            const ax = Math.abs(_n.x), ay = Math.abs(_n.y), az = Math.abs(_n.z);
            let u, w;
            if (ay >= ax && ay >= az) { u = _v.x; w = _v.z; } else if (ax >= az) { u = _v.z; w = _v.y; } else { u = _v.x; w = _v.y; }
            if (sw) b.uv.push(w * d, u * d); else b.uv.push(u * d, w * d);
          }
        }
        const I = geo.index;
        const n = I ? I.count : P.count;
        for (let i = 0; i < n; i += 3) {
          const a = base + (I ? I.getX(i) : i), b1 = base + (I ? I.getX(i + 1) : i + 1), c1 = base + (I ? I.getX(i + 2) : i + 2);
          if (flip) b.idx.push(a, c1, b1); else b.idx.push(a, b1, c1);
        }
        if (geo !== ch.geometry) geo.dispose();
        gone.push(ch);
      } else if (ch.children.length) walk(ch);
    }
  };
  walk(g);
  for (const m of gone) { m.parent.remove(m); m.geometry.dispose(); }
  for (const b of buckets.values()) {
    const kind = b.kind, geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
    if (b.uv.length) geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    if (b.fl.length) geo.setAttribute('fl', new THREE.Float32BufferAttribute(b.fl, 4));
    geo.setIndex(b.idx);
    const m = new THREE.Mesh(geo, VM(kind));
    m.castShadow = b.cast; m.receiveShadow = receive && !emits(kind);
    g.add(m);
  }
  return g;
}
// 바닥에 깔리는 둥근 번짐 한 장. 가구 밑의 옅은 그림자(검정)나 불빛 번짐(따뜻한 색, 더하기)으로 쓴다. 누르기 판정에는 잡히지 않는다
const fxMats = new Map();
// flick = true 면 불빛처럼 일렁인다(벽난로 앞)
export function pool(parent, x, z, w, d, { y = 0.04, hex = 0x2A1A10, op = 0.3, add = false, flick = false } = {}) {
  const key = hex + ':' + op + (add ? 'a' : '') + (flick ? 'f' : '');
  let mat = fxMats.get(key);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({ map: soft(), color: hex, transparent: true, opacity: op, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, side: THREE.DoubleSide });
    if (flick) hot(mat, 0, { flick: true });
    fxMats.set(key, mat);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z);
  m.castShadow = false; m.receiveShadow = false; m.userData.keep = true; m.renderOrder = add ? 3 : 1;
  m.raycast = () => {};
  parent.add(m);
  return m;
}
// 도형의 UV 를 겉면 자리로 다시 매긴다 (1 m 에 무늬가 d 번). 길이가 다른 벽·바닥 판이 같은 무늬 그림을 같은 크기로 쓰게 한다
export function uvw(geo, d) {
  const P = geo.attributes.position, N = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < P.count; i++) {
    const ax = Math.abs(N.getX(i)), ay = Math.abs(N.getY(i)), az = Math.abs(N.getZ(i));
    if (ay >= ax && ay >= az) uv.setXY(i, P.getX(i) * d, P.getZ(i) * d); else if (ax >= az) uv.setXY(i, P.getZ(i) * d, P.getY(i) * d); else uv.setXY(i, P.getX(i) * d, P.getY(i) * d);
  }
  return geo;
}
// 옆에서 봐도 늘 이쪽을 보는 둥근 빛 번짐 (등·불 둘레). 누르기 판정에는 잡히지 않는다
const glowMats = new Map();
export function glowAt(parent, x, y, z, size, hex = 0xFFC978, op = 0.5, flick = false) {
  const key = hex + ':' + op + (flick ? 'f' : '');
  let mat = glowMats.get(key);
  if (!mat) { mat = new THREE.SpriteMaterial({ map: soft(), color: hex, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending }); if (flick) hot(mat, 0, { flick: true }); glowMats.set(key, mat); }
  const s = new THREE.Sprite(mat);
  s.position.set(x, y, z); s.scale.set(size, size, 1); s.userData.keep = true; s.renderOrder = 3; s.raycast = () => {};
  parent.add(s);
  return s;
}

// 불꽃 도형: 아래는 둥글고 위로 갈수록 뾰족한 물방울 (가운데 아래가 0). 크기마다 하나를 나눠 쓴다
const flameGeos = new Map();
export function flameGeo(w, h, seg = 7) {
  const key = w + ':' + h + ':' + seg;
  let g = flameGeos.get(key);
  if (!g) {
    const pts = [];
    for (let k = 0; k <= 9; k++) { const u = k / 9; pts.push(new THREE.Vector2(Math.max(1e-3, w * Math.pow(Math.sin(Math.PI * u), 0.6) * (1 - 0.55 * u)), u * h)); }
    pts[0].x = 0; pts[9].x = 0;
    g = new THREE.LatheGeometry(pts, seg); flameGeos.set(key, g);
  }
  return g;
}
// 튀어 오르는 불티: 점 n 개가 (x, y, z) 에서 h 만큼 올라가며 사라지고 다시 나온다. 움직임은 셰이더가 시간으로 정한다(그리기 한 번)
let sparkMat = null;
export function sparks(parent, x, y, z, { n = 14, w = 0.36, h = 0.9 } = {}) {
  if (!sparkMat) {
    sparkMat = new THREE.ShaderMaterial({
      uniforms: { uT: FX.t, uPx: FX.px, uGlow: FX.glow },
      vertexShader: `attribute vec4 seed; uniform float uT, uPx; varying float vLife; varying vec3 vC;
        void main() {
          float life = fract(uT * seed.x + seed.y);
          vec3 p = position;
          p.y += life * seed.z;
          p.x += sin(uT * 2.3 + seed.y * 40.0) * 0.05 * life + (seed.w - 0.5) * 0.12 * life;
          p.z += cos(uT * 1.9 + seed.y * 31.0) * 0.04 * life;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float px = projectionMatrix[1][1] * uPx * 0.5;
          if (projectionMatrix[3][3] < 0.5) px /= max(0.05, -mv.z);
          gl_PointSize = clamp(0.024 * px * (1.0 - life * 0.6), 1.0, 24.0);
          vLife = life; vC = mix(vec3(1.0, 0.85, 0.45), vec3(1.0, 0.42, 0.12), life);
        }`,
      fragmentShader: `uniform float uGlow; varying float vLife; varying vec3 vC;
        void main() {
          vec2 q = gl_PointCoord - 0.5; float d = dot(q, q);
          if (d > 0.25) discard;
          float a = (1.0 - smoothstep(0.05, 0.25, d)) * smoothstep(0.0, 0.08, vLife) * (1.0 - smoothstep(0.55, 1.0, vLife));
          gl_FragColor = vec4(vC * a * (0.6 + 0.4 * uGlow), a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
  }
  const pos = new Float32Array(n * 3), seed = new Float32Array(n * 4);
  for (let k = 0; k < n; k++) {
    const r = (a) => { const v = Math.sin((k + 1) * a) * 43758.5453; return v - Math.floor(v); };
    pos.set([x + (r(12.9) - 0.5) * w, y, z + (r(78.2) - 0.5) * 0.1], k * 3);
    seed.set([0.35 + r(39.3) * 0.5, r(11.7), h * (0.6 + r(5.1) * 0.6), r(91.7)], k * 4);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(x, y + h / 2, z), h + w);
  const pts = new THREE.Points(geo, sparkMat);
  pts.userData.keep = true; pts.renderOrder = 4; pts.raycast = () => {}; pts.castShadow = false;
  parent.add(pts);
  return pts;
}

// 떠다니는 반짝이: 트리 둘레(반지름 r0~r1, 높이 y0~y1)를 천천히 돌며 떠오르고 깜빡인다. 그리기 한 번
export function motes(parent, { n = 36, r0 = 0.6, r1 = 1.9, y0 = 0.2, y1 = 2.9, hex = 0xFFE3A0 } = {}) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uT: FX.t, uPx: FX.px, uGlow: FX.glow, uC: { value: new THREE.Color(hex) }, uA: { value: 1 } },
    vertexShader: `attribute vec4 seed; uniform float uT, uPx; varying float vA;
      void main() {
        float t = uT * (0.05 + seed.x * 0.06) + seed.y * 6.2831;
        float r = position.x, h = position.y, life = fract(uT * (0.03 + seed.z * 0.04) + seed.w);
        vec3 p = vec3(sin(t) * r, mix(h, h + 0.9, life), cos(t) * r);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float px = projectionMatrix[1][1] * uPx * 0.5;
        if (projectionMatrix[3][3] < 0.5) px /= max(0.05, -mv.z);
        gl_PointSize = clamp(0.03 * px, 1.5, 14.0);
        vA = (0.35 + 0.65 * pow(0.5 + 0.5 * sin(uT * (1.5 + seed.x * 2.5) + seed.y * 40.0), 3.0)) * sin(3.14159 * life);
      }`,
    fragmentShader: `uniform float uGlow, uA; uniform vec3 uC; varying float vA;
      void main() {
        vec2 q = gl_PointCoord - 0.5; float d = dot(q, q);
        if (d > 0.25) discard;
        float a = (1.0 - smoothstep(0.0, 0.25, d)) * vA * uA;
        gl_FragColor = vec4(uC * a * (0.7 + 0.5 * uGlow), a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pos = new Float32Array(n * 3), seed = new Float32Array(n * 4);
  for (let k = 0; k < n; k++) {
    const r = (a) => { const v = Math.sin((k + 1) * a) * 43758.5453; return v - Math.floor(v); };
    pos.set([r0 + (r1 - r0) * Math.sqrt(r(3.7)), y0 + (y1 - y0) * r(9.1), 0], k * 3);
    seed.set([r(21.3), r(47.9), r(63.1), r(88.8)], k * 4);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, (y0 + y1) / 2 + 0.5, 0), r1 + y1);
  const pts = new THREE.Points(geo, mat);
  pts.userData.keep = true; pts.renderOrder = 4; pts.raycast = () => {}; pts.castShadow = false;
  parent.add(pts);
  return pts;
}
