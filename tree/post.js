// 화면 다듬기(후처리). 좋은 화질(app.js 의 quality = 'high')에서만 쓴다.
//   1) 방을 화면 대신 그림 한 장(밝기를 1 넘게 담는 그림)에 그린다
//   2) 그중 아주 밝은 곳(전구·촛불·벽난로·가로등·달 …)만 골라 작게 줄여 가며 번지게 한다(빛 번짐)
//   3) 원래 그림 + 빛 번짐을 합치고, 아주 밝은 곳을 부드럽게 눌러 담고(하이라이트 어깨), 색을 조금 다듬고(채도·대비·
//      그늘은 살짝 푸르게·밝은 곳은 살짝 따뜻하게), 화면 가장자리를 조금 어둡게(비네트) 해서 캔버스에 그린다
// 캔버스는 뒤가 비친다(밤하늘은 페이지 배경). 빈 곳에는 빛 번짐만 더하기로 얹히게 알파를 맞춘다.
// 스스로 빛나는 재질이 얼마나 밝게 그려질지는 kit.js 의 FX.glow 가 정한다(후처리를 끄면 1, 켜면 1 보다 크다).
import { THREE, FX } from './kit.js';

const VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// 밝은 곳만 남기며 반으로 줄인다 (부드러운 문턱. 13번 읽기 대신 4번 읽기 + 하드웨어 보간)
const BRIGHT = /* glsl */`
uniform sampler2D tSrc; uniform vec2 texel; uniform float threshold, knee;
varying vec2 vUv;
void main() {
  vec3 c = 0.25 * (texture2D(tSrc, vUv + texel * vec2(-1.0, -1.0)).rgb + texture2D(tSrc, vUv + texel * vec2(1.0, -1.0)).rgb
                 + texture2D(tSrc, vUv + texel * vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + texel * vec2(1.0, 1.0)).rgb);
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - threshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 1e-4);
  float k = max(soft, br - threshold) / max(br, 1e-4);
  gl_FragColor = vec4(min(c * k, vec3(24.0)), 1.0);
}`;

// 이중 필터 흐리기(작게 줄이기): 가운데 4번 + 네 귀퉁이
const DOWN = /* glsl */`
uniform sampler2D tSrc; uniform vec2 texel;
varying vec2 vUv;
void main() {
  vec3 s = texture2D(tSrc, vUv).rgb * 4.0;
  s += texture2D(tSrc, vUv - texel).rgb;
  s += texture2D(tSrc, vUv + texel).rgb;
  s += texture2D(tSrc, vUv + vec2(texel.x, -texel.y)).rgb;
  s += texture2D(tSrc, vUv - vec2(texel.x, -texel.y)).rgb;
  gl_FragColor = vec4(s / 8.0, 1.0);
}`;

// 이중 필터 흐리기(키우기): 여덟 점. 한 단계 큰 그림 위에 더하기로 얹는다
const UP = /* glsl */`
uniform sampler2D tSrc; uniform vec2 texel; uniform float spread;
varying vec2 vUv;
void main() {
  vec2 t = texel * spread;
  vec3 s = texture2D(tSrc, vUv + vec2(-t.x * 2.0, 0.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(-t.x, t.y)).rgb * 2.0;
  s += texture2D(tSrc, vUv + vec2(0.0, t.y * 2.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(t.x, t.y)).rgb * 2.0;
  s += texture2D(tSrc, vUv + vec2(t.x * 2.0, 0.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(t.x, -t.y)).rgb * 2.0;
  s += texture2D(tSrc, vUv + vec2(0.0, -t.y * 2.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(-t.x, -t.y)).rgb * 2.0;
  gl_FragColor = vec4(s / 12.0, 1.0);
}`;

// 합치기와 색 다듬기
const FINAL = /* glsl */`
uniform sampler2D tScene, tBloom; uniform float bloom, vig, aspect, sat, con, time;
varying vec2 vUv;
vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
// 0.8 아래는 그대로, 그 위만 부드럽게 눌러 담는다(색은 그대로, 아주 밝으면 주황→노랑→하양 쪽으로 조금)
vec3 shoulder(vec3 c) {
  float peak = max(c.r, max(c.g, c.b));
  const float S = 0.8;
  if (peak <= S) return c;
  float d = 1.0 - S, np = 1.0 - d * d / (peak + d - S);
  // 아주 밝은 색은 조금 엷어지되, 약한 색 성분을 제 비율대로(거듭제곱으로) 올린다. 회색 쪽으로 섞으면 불꽃이 분홍으로 바랜다
  return np * pow(max(c / peak, 1e-5), vec3(1.0 / (1.0 + 0.3 * (peak - S))));
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + time) * 43758.5453); }
void main() {
  vec4 sc = texture2D(tScene, vUv);
  vec3 c = sc.rgb + texture2D(tBloom, vUv).rgb * bloom;
  c = toSRGB(shoulder(max(c, 0.0)));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, sat);                                   // 채도
  c = mix(c, c * c * (3.0 - 2.0 * c), con);                    // 가운데를 중심으로 대비
  c *= mix(vec3(0.965, 0.985, 1.05), vec3(1.0), smoothstep(0.0, 0.55, l));   // 그늘은 살짝 푸르게
  c *= mix(vec3(1.0), vec3(1.035, 1.0, 0.95), smoothstep(0.55, 1.0, l));     // 밝은 곳은 살짝 따뜻하게
  vec2 q = (vUv - 0.5) * vec2(aspect, 1.0);
  c *= mix(1.0 - vig, 1.0, smoothstep(0.95, 0.25, length(q) / max(1.0, aspect * 0.62)));  // 비네트
  c = clamp(c, 0.0, 1.0);
  float a = max(sc.a, max(c.r, max(c.g, c.b)));               // 빈 곳에는 빛 번짐만 (뒤의 밤하늘 위에 더해진다)
  c += (hash(gl_FragCoord.xy) - 0.5) / 255.0 * step(0.004, a); // 색 띠가 지지 않게 아주 옅은 점
  gl_FragColor = vec4(clamp(c, 0.0, a), a);
}`;

export function makePost(renderer) {
  const LEVELS = 5;
  const quad = new THREE.Mesh(new THREE.BufferGeometry(), null);
  quad.geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  quad.geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  quad.frustumCulled = false;
  const qs = new THREE.Scene(); qs.add(quad);
  const qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mk = (frag, uniforms, extra = {}) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, ...extra });
  const bright = mk(BRIGHT, { tSrc: { value: null }, texel: { value: new THREE.Vector2() }, threshold: { value: 0.92 }, knee: { value: 0.35 } });
  const down = mk(DOWN, { tSrc: { value: null }, texel: { value: new THREE.Vector2() } });
  const up = mk(UP, { tSrc: { value: null }, texel: { value: new THREE.Vector2() }, spread: { value: 1 } }, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor });
  const fin = mk(FINAL, {
    tScene: { value: null }, tBloom: { value: null }, bloom: { value: 0.6 }, vig: { value: 0.2 }, aspect: { value: 1 },
    sat: { value: 1.1 }, con: { value: 0.12 }, time: { value: 0 },
  }, { transparent: false, blending: THREE.NoBlending });

  // 밝기를 1 넘게 담을 수 있는 그림(반정밀도 소수)을 그릴 수 있으면 그것으로, 아니면 보통 그림으로 (빛 번짐이 조금 약해질 뿐이다)
  const ext = renderer.extensions, TYPE = ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float') ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const opt = { type: TYPE, depthBuffer: false, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  let rt = null; const mips = [];
  const size = new THREE.Vector2();
  let w = 0, h = 0, on = false;
  function fit() {
    renderer.getDrawingBufferSize(size);
    if (size.x === w && size.y === h && rt) return true;
    w = size.x; h = size.y;
    if (!rt) {
      rt = new THREE.WebGLRenderTarget(w, h, { type: TYPE, samples: 4, depthBuffer: true, stencilBuffer: false });
      // 이 기기에서 그릴 수 없는 그림이면 화면 다듬기를 끄고 예전처럼 바로 그린다 (화면이 까맣게 되지 않게)
      renderer.setRenderTarget(rt);
      const gl = renderer.getContext(), ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      renderer.setRenderTarget(null);
      if (!ok) return false;
    } else rt.setSize(w, h);
    let mw = w, mh = h;
    for (let k = 0; k < LEVELS; k++) {
      mw = Math.max(1, Math.round(mw / 2)); mh = Math.max(1, Math.round(mh / 2));
      if (!mips[k]) mips[k] = new THREE.WebGLRenderTarget(mw, mh, opt); else mips[k].setSize(mw, mh);
    }
    fin.uniforms.aspect.value = w / Math.max(1, h);
    return true;
  }
  const pass = (mat, target, clear = true) => {
    quad.material = mat;
    renderer.setRenderTarget(target);
    if (clear) renderer.clear(true, false, false);
    renderer.render(qs, qc);
  };
  let calls = 0;
  function set(v) {
    on = !!v; FX.glow.value = on ? FX.hot : 1; FX.pat.value = on ? 1 : 0;
    if (!on) { rt && rt.dispose(); mips.forEach((m) => m.dispose()); rt = null; mips.length = 0; w = h = 0; }
  }
  return {
    get on() { return on; },
    get calls() { return calls; }, // 방을 그리는 데 든 그리기 호출 수 (후처리 몇 번은 빼고)
    set,
    render(scene, cam, t) {
      FX.t.value = (t || 0) % 3600;
      renderer.getDrawingBufferSize(size); FX.px.value = size.y;
      if (on && !fit()) set(false);
      if (!on) { renderer.render(scene, cam); calls = renderer.info.render.calls; return; }
      const auto = renderer.autoClear;
      renderer.setRenderTarget(rt);
      renderer.render(scene, cam);
      calls = renderer.info.render.calls;
      renderer.autoClear = false;
      // 빛 번짐: 반 크기에서 문턱을 넘는 곳만 → 차례로 줄이기 → 차례로 키우며 더하기
      bright.uniforms.tSrc.value = rt.texture; bright.uniforms.texel.value.set(0.5 / w, 0.5 / h);
      pass(bright, mips[0]);
      for (let k = 1; k < LEVELS; k++) {
        down.uniforms.tSrc.value = mips[k - 1].texture; down.uniforms.texel.value.set(1 / mips[k - 1].width, 1 / mips[k - 1].height);
        pass(down, mips[k]);
      }
      for (let k = LEVELS - 1; k > 0; k--) {
        up.uniforms.tSrc.value = mips[k].texture; up.uniforms.texel.value.set(0.5 / mips[k].width, 0.5 / mips[k].height); up.uniforms.spread.value = 1;
        pass(up, mips[k - 1], false);
      }
      fin.uniforms.tScene.value = rt.texture; fin.uniforms.tBloom.value = mips[0].texture; fin.uniforms.time.value = (t || 0) % 7;
      pass(fin, null, false);
      renderer.autoClear = auto;
    },
  };
}
