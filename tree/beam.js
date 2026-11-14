// 비행 슈트의 손바닥 빛줄기: "✋ 빔" 단추(키보드 B)를 누르면 한 손을 뻗어 짧은 빛줄기를 쏘고, 닿은 곳에서 반짝이가 튄다.
// 방의 상태는 바꾸지 않는다(가구를 부수거나 밀지 않는다). 사람이 맞으면 그 사람이 1초 동안 뒤로 쓰러진다(avatar.knock). 독자 디자인이며 실제 작품의 이름·모양·소리는 쓰지 않았다.
// 방향: 내려다볼 때는 아바타가 보는 쪽으로 수평, 1인칭에서는 내가 보는 쪽(위아래 포함). 길이는 쏜 사람이 재서(벽·가구·바닥까지, 길어야 MAX) 같이 보낸다.
// 동기화: 놀이 소식 { k: 'beam', v: '방향(라디안);위아래 각;길이' }, 사람을 맞혔으면 이어서 { k: 'zap', v: 맞은 사람 id }.
// 보낸 사람이 비행 슈트를 입고 있을 때만, zap 은 그 사람의 빛줄기를 방금 받았을 때만 받는다. 맞혔는지는 쏜 사람이 정한다.
import { THREE, soft } from './kit.js';
import { HOST_OUTFIT } from './costume.js';
import { BODY_R, HEIGHT } from './avatar.js';
import { cellOf, zoneOf, YARD, FLOOR_H, FLOOR_DX, CELL, Z0 } from './path.js';
import { sfx } from './sfx.js';

export const MAX = 7;      // 빛줄기의 가장 긴 길이
const COOL = 0.7, LIFE = 0.75, SPARKS = 18;
const RE = /^(-?\d\.\d\d);(-?\d\.\d\d);(\d\.\d)$/;
const BEAM = new THREE.MeshBasicMaterial({ color: 0x8FE6FF, transparent: true, opacity: 0.92, depthWrite: false }); // 밝은 바닥 위에서도 보이게 더하기 섞기를 쓰지 않는다
let geo = null, sparkMat = null, glowMat = null;

// K = { scene, me, others(): Map, myId(), toast(m), show(): 단추를 보일 때인지, dir(): { yaw, pitch }, grid, fixed(i, j), sky(): 내가 하늘에 있는지, online(), fx(m), dirty() }
export function makeBeam(K) {
  const css = document.createElement('style');
  css.textContent = '#beamBtn{position:absolute;left:74px;bottom:246px;z-index:3;width:58px;height:58px;padding:0;border-radius:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;'
    + 'font-size:11px;font-weight:800;line-height:1.1;box-shadow:0 4px 14px rgba(60,30,10,.28);touch-action:manipulation;user-select:none;-webkit-user-select:none}#beamBtn b{font-size:21px;line-height:1}';
  document.head.appendChild(css);
  const btn = document.createElement('button');
  btn.type = 'button'; btn.id = 'beamBtn'; btn.className = 'btn'; btn.hidden = true; btn.setAttribute('aria-label', '손바닥 빛줄기 쏘기');
  { const i = document.createElement('b'); i.textContent = '✋'; btn.append(i, '빔'); }
  document.body.appendChild(btn);

  const slots = [], lastOf = new WeakMap(), o = new THREE.Vector3(), d = new THREE.Vector3(), e = new THREE.Vector3();
  let clock = 0, firedAt = -9, count = 0, last = null, hitId = null, zaps = 0;
  const shotOf = new WeakMap(); // 친구가 마지막으로 쏜 빛줄기 { t, yaw } (zap 소식을 확인한다)
  function slot() {
    let s = slots.find((x) => !x.on);
    if (s) return s;
    if (slots.length >= 6) return null;
    if (!geo) {
      geo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true); geo.rotateX(Math.PI / 2); geo.translate(0, 0, 0.5); // +z 쪽으로 뻗는 길이 1 의 대롱
      sparkMat = new THREE.PointsMaterial({ size: 9, sizeAttenuation: false, vertexColors: true, map: soft(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      glowMat = new THREE.SpriteMaterial({ map: soft(), color: 0x9FEAFF, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
    }
    const g = new THREE.Group(), ray = new THREE.Mesh(geo, BEAM), glow = new THREE.Sprite(glowMat), pg = new THREE.BufferGeometry();
    const pos = new Float32Array(SPARKS * 3), col = new Float32Array(SPARKS * 3);
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(pg, sparkMat);
    for (const m of [ray, glow, pts]) { m.frustumCulled = false; m.raycast = () => {}; m.renderOrder = 4; }
    g.add(ray, glow, pts); g.visible = false; K.scene.add(g);
    s = { on: false, g, ray, glow, pts, pg, pos, col, vel: new Float32Array(SPARKS * 3) };
    slots.push(s);
    return s;
  }
  // 손바닥의 세상 자리
  function palm(a, out) {
    const arm = a.parts.arms[0];
    arm.updateWorldMatrix(true, false);
    return out.set(0, -0.3, 0.03).applyMatrix4(arm.matrixWorld);
  }
  const dirOf = (yaw, pitch, out) => out.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  // 맞을 수 있는 사람: 같은 층에 서 있고(눕거나 사다리·하늘·썰매가 아니고) 보이는 사람
  const target = (a) => a.root.visible && a.parts && !a.rest && !a.hop && !a.fly && !(a.down > 0) && a.level === K.me.level;
  // 내 빛줄기가 어디까지 가는지: 사람·바닥·천장·벽·가구에 닿으면 거기까지. 사람에 닿았으면 hitId 에 그 사람
  function trace(yaw, pitch) {
    const me = K.me, lv = me.level, y0 = lv * FLOOR_H, sky = K.sky();
    o.copy(me.root.position); o.y += 0.78; dirOf(yaw, pitch, d);
    hitId = null;
    const ppl = sky ? [] : [...K.others()].filter(([, a]) => target(a)), R2 = (BODY_R + 0.12) ** 2;
    for (let t = 0.4; t < MAX; t += 0.1) {
      e.copy(d).multiplyScalar(t).add(o);
      for (const [id, a] of ppl) {                                           // 사람
        const p = a.root.position, dx = e.x - p.x, dz = e.z - p.z;
        if (dx * dx + dz * dz < R2 && e.y > p.y - 0.05 && e.y < p.y + HEIGHT + 0.1) { hitId = id; return t; }
      }
      if (sky) { if (e.y < 0.05) return t; continue; }                       // 하늘에서는 땅에 닿을 때만
      if (e.y < y0 + 0.04) return t;
      const [i, j] = cellOf(e.x + lv * FLOOR_DX, e.z), zone = zoneOf(i, j);
      if (zone === null) { if (lv === 0 && e.z > Z0 + YARD.wall * CELL + CELL) continue; return t; } // 마당 밖은 뚫려 있다
      if (zone !== 'yard' && e.y > y0 + 2.5) return t;                       // 천장
      if (K.fixed(i, j)) return t;                                           // 벽·트리·나무
      if (!K.grid.free(i, j) && e.y - y0 < 1.15) return t;                   // 가구
    }
    return MAX;
  }
  function spawn(a, yaw, pitch, len) {
    const s = slot();
    if (!s) return false;
    Object.assign(s, { on: true, a, yaw, pitch, len, t: 0, burst: false, hit: len < MAX - 0.05 });
    for (let i = 0; i < SPARKS * 3; i++) s.col[i] = 0;
    s.pg.attributes.color.needsUpdate = true;
    a.aim = 0.5; a.aimP = pitch;
    a.turnTo(Math.sin(yaw), Math.cos(yaw));
    K.dirty();
    return true;
  }
  function fire() {
    if (!K.show() || clock - firedAt < COOL) return false;
    const { yaw, pitch } = K.dir(), len = Math.max(0.4, Math.round(trace(yaw, pitch) * 10) / 10);
    if (!spawn(K.me, yaw, pitch, len)) return false;
    firedAt = clock; count++; last = { yaw, pitch, len };
    sfx('beam');
    if (K.online()) K.fx({ k: 'beam', v: `${yaw.toFixed(2)};${pitch.toFixed(2)};${len.toFixed(1)}` });
    const v = hitId && K.others().get(hitId);
    if (v && v.knock(yaw)) { zaps++; K.dirty(); if (K.online()) K.fx({ k: 'zap', v: hitId }); } // 사람을 맞혔다: 그 사람이 쓰러진다
    return true;
  }
  btn.addEventListener('click', fire);
  addEventListener('keydown', (ev) => {
    if (ev.code !== 'KeyB' || ev.repeat || ev.ctrlKey || ev.metaKey || ev.altKey || ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) return;
    if (!btn.hidden) fire();
  });

  function tick(dt) {
    clock += dt;
    const show = K.show();
    if (btn.hidden === show) btn.hidden = !show;
    for (const s of slots) {
      if (!s.on) continue;
      s.t += dt;
      const a = s.a, gone = a !== K.me && ![...K.others().values()].includes(a);
      if (s.t >= LIFE || gone || !a.parts) { s.on = false; s.g.visible = false; K.dirty(); continue; }
      s.g.visible = a === K.me || a.root.visible;
      palm(a, o); dirOf(s.yaw, s.pitch, d);
      const grow = Math.min(1, s.t / 0.07), fade = s.t < 0.3 ? 1 : Math.max(0, 1 - (s.t - 0.3) / 0.14), L = Math.max(0.01, s.len * grow);
      const r = 0.055 * fade * (0.85 + 0.15 * Math.sin(s.t * 70));
      s.ray.visible = fade > 0; s.ray.position.copy(o); s.ray.lookAt(e.copy(d).add(o)); s.ray.scale.set(Math.max(1e-4, r), Math.max(1e-4, r), L);
      e.copy(d).multiplyScalar(L).add(o);                                      // 빛줄기의 끝
      const gs = (0.28 + 0.5 * grow) * Math.max(0, 1 - s.t / LIFE);
      s.glow.position.copy(e); s.glow.scale.set(gs, gs, 1);
      if (!s.burst && grow >= 1) { // 닿은 곳에서 반짝이가 튄다
        s.burst = true;
        for (let i = 0; i < SPARKS; i++) {
          s.pos[i * 3] = e.x; s.pos[i * 3 + 1] = e.y; s.pos[i * 3 + 2] = e.z;
          const u = Math.random() * 2 - 1, ph = Math.random() * Math.PI * 2, q = Math.sqrt(1 - u * u), sp = 0.6 + Math.random() * 1.5;
          s.vel[i * 3] = q * Math.cos(ph) * sp - d.x * 0.5; s.vel[i * 3 + 1] = u * sp + 0.6; s.vel[i * 3 + 2] = q * Math.sin(ph) * sp - d.z * 0.5;
        }
        if (s.hit) sfx('beamHit', a === K.me ? null : a);
      }
      if (s.burst) {
        const f = Math.max(0, 1 - (s.t - 0.07) / (LIFE - 0.07));
        for (let i = 0; i < SPARKS; i++) {
          s.vel[i * 3 + 1] -= 2.2 * dt;
          for (let k = 0; k < 3; k++) s.pos[i * 3 + k] += s.vel[i * 3 + k] * dt;
          const w = f * (i % 3 ? 1 : 0.7); s.col[i * 3] = (i % 2 ? 0.75 : 1) * w; s.col[i * 3 + 1] = 0.95 * w; s.col[i * 3 + 2] = w;
        }
        s.pg.attributes.position.needsUpdate = true; s.pg.attributes.color.needsUpdate = true;
      }
      K.dirty();
    }
  }
  const api = {
    tick, fire,
    // 누가 빛줄기를 쐈다는 소식. 비행 슈트를 입은 사람 것만, 너무 잦지 않게 받는다
    peerFx(m, id) {
      if (m.k === 'zap') return zap(m, id);
      const a = K.others().get(id), x = typeof m.v === 'string' ? RE.exec(m.v) : null;
      if (!a || !x) return false;
      const yaw = Number(x[1]), pitch = Number(x[2]), len = Number(x[3]);
      if (Math.abs(yaw) > 3.15 || Math.abs(pitch) > 1.3 || !(len >= 0.4 && len <= MAX) || a.look.outfit !== HOST_OUTFIT || a.rest || a.hop) return false;
      if (clock - (lastOf.get(a) ?? -9) < COOL * 0.6) return false;
      lastOf.set(a, clock);
      if (!spawn(a, yaw, pitch, len)) return false;
      shotOf.set(a, { t: clock, yaw });
      sfx('beam', a);
      return true;
    },
  };
  // 친구의 빛줄기가 누군가(나일 수도)를 맞혔다는 소식. 방금 받은 그 사람의 빛줄기가 있어야 한다
  function zap(m, id) {
    const a = K.others().get(id), shot = a && shotOf.get(a);
    if (!a || !shot || clock - shot.t > 1.5 || typeof m.v !== 'string' || m.v === id || !/^[a-z0-9]{1,8}$/.test(m.v)) return false;
    shotOf.delete(a); // 한 번 쏜 빛줄기로 한 사람만
    const mine = m.v === K.myId(), v = mine ? K.me : K.others().get(m.v);
    if (!v) return true; // 내가 모르는 사람이어도 다른 사람에게는 전한다
    if (v.knock(shot.yaw)) { zaps++; K.dirty(); if (mine) K.toast('빔에 맞아 쓰러졌어요! 💫'); }
    return true;
  }
  // 자동 검사가 쓰는 창구
  window.__beam = {
    fire, MAX, get shown() { return !btn.hidden; }, get count() { return count; }, get last() { return last; },
    get active() { return slots.filter((s) => s.on).map((s) => ({ mine: s.a === K.me, len: s.len, hit: s.hit, yaw: s.yaw, pitch: s.pitch, t: s.t, seen: s.g.visible, burst: s.burst })); },
    get made() { return slots.length; }, get zaps() { return zaps; }, get hitId() { return hitId; },
  };
  return api;
}
