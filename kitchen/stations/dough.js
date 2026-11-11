// 반죽 자리. app.js 가 kit(도구 모음)를 넘겨 부른다. 규칙은 stations/README.md 참고.
// 그릇 위를 한 손가락으로 빙글빙글 문지르면 가루와 덩어리가 하나의 반죽 공으로 뭉쳐진다.
export default function (kit) {
  const { THREE, scene, put, rbox, cyl, C, TOP_Y } = kit;

  const g = new THREE.Group(); g.position.set(1.2, TOP_Y, -1.72); scene.add(g);
  const BOWL = { x: -0.1, z: 0 }; // 그릇 가운데 (g 기준)
  const bowlMat = new THREE.MeshLambertMaterial({ color: C.white, side: THREE.DoubleSide });
  put(new THREE.CylinderGeometry(0.33, 0.2, 0.24, 22, 1, true), bowlMat, BOWL.x, 0.12, BOWL.z, g);
  put(cyl(0.2, 0.2, 0.02, 22), C.white, BOWL.x, 0.01, BOWL.z, g, false);

  // 그릇 속: 가루 더미, 덩어리 넷, 반죽 공
  const inside = new THREE.Group(); inside.position.set(BOWL.x, 0, BOWL.z); g.add(inside);
  const flour = put(new THREE.SphereGeometry(0.21, 14, 8), C.cream, 0, 0.045, 0, inside, false);
  const lumps = new THREE.Group(); inside.add(lumps);
  const lumpGeo = new THREE.SphereGeometry(0.07, 10, 8);
  const LUMP = [[0.12, 0.3], [-0.13, 1.9], [0.1, 3.6], [-0.08, 5.0]].map(([r, a], i) => {
    const m = put(lumpGeo, C.dough, 0, 0, 0, lumps, false);
    return { m, x: Math.cos(a) * Math.abs(r) * 1.1, z: Math.sin(a) * Math.abs(r) * 1.1, s: 0.8 + (i % 2) * 0.3 };
  });
  const ballMat = new THREE.MeshLambertMaterial({ color: C.dough });
  const ball = put(new THREE.SphereGeometry(0.2, 16, 12), ballMat, 0, 0.17, 0, inside);
  const colA = new THREE.Color(C.cream), colB = new THREE.Color(C.dough);

  // 밀가루 봉지
  put(rbox(0.26, 0.36, 0.18, 0.04), C.cream, 0.42, 0.18, -0.12, g);
  put(new THREE.BoxGeometry(0.2, 0.12, 0.01), C.top, 0.42, 0.18, -0.027, g, false);
  // 밀대
  const pin = new THREE.Group(); pin.position.set(0.3, 0.05, 0.26); pin.rotation.set(0, 0.25, Math.PI / 2); g.add(pin);
  put(cyl(0.045, 0.045, 0.42, 14), C.wood, 0, 0, 0, pin);
  put(cyl(0.02, 0.02, 0.62, 10), C.top, 0, 0, 0, pin);

  /* ───── 상태 ───── */
  let p = 0;        // 확정된 진행도 (0.05 단위, send 로만 바뀜)
  let shown = 0;    // 화면에 보이는 진행도 (문지르는 동안은 p 보다 조금 앞설 수 있음)
  let press = 0, ox = 0, oz = 0; // 손가락에 눌린 정도와 밀린 방향
  let back = null;
  let perf = false;   // 완벽: 손을 떼지 않고 처음부터 끝까지 한 번에
  let oneGo = false;  // 지금 긋는 획이 0 에서 시작했는가
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const STEP = 0.05;

  function draw() {
    const q = shown, e = q * q * (3 - 2 * q);
    flour.visible = q < 0.97;
    flour.scale.set(1 - 0.75 * e, 0.3 * (1 - 0.6 * e), 1 - 0.75 * e);
    for (const l of LUMP) {
      const s = l.s * (1 - e);
      l.m.visible = s > 0.03;
      l.m.position.set(l.x * (1 - e), 0.1 + 0.05 * e, l.z * (1 - e));
      l.m.scale.set(s, s * 0.8, s);
    }
    const bs = 0.34 + 0.56 * e, sq = 1 - 0.2 * press;
    ball.scale.set(1.15 * bs * (1 + 0.1 * press), 0.7 * bs * sq, 1.1 * bs * (1 + 0.1 * press));
    ball.position.set(ox, 0.06 + 0.11 * bs * sq, oz);
    ballMat.color.copy(colA).lerp(colB, 0.35 + 0.65 * e);
    kit.poke();
  }

  /* ───── 패널 ───── */
  let bar = null, pct = null, panelDone = null;
  function syncPanel() {
    if (pct) pct.textContent = Math.round(shown * 100) + '%';
    if (bar) bar.style.width = Math.round(shown * 100) + '%';
  }
  function panel(root, ui) {
    bar = null; pct = null; panelDone = p >= 1;
    const r = ui.el('div', 'row');
    if (panelDone) {
      r.appendChild(ui.hintEl(perf ? '완벽한 반죽!' : '반죽 완성!', perf ? '한 번에 매끈하게 뭉쳤어요.' : '손을 떼지 않고 한 번에 하면 완벽해요.'));
      root.appendChild(r);
      const r2 = ui.el('div', 'row');
      const again = ui.button('btn', '다시 하기', () => kit.send({ reset: true })); again.id = 'doughAgain';
      const next = ui.button('btn', '자르러 가기', () => kit.go('cut')); next.id = 'doughNext';
      next.style.cssText = 'flex:1;background:var(--choc);border-color:var(--choc);color:#FFF4E0';
      r2.appendChild(again); r2.appendChild(next); root.appendChild(r2);
    } else {
      r.appendChild(ui.hintEl('그릇을 빙글빙글 문질러 반죽해 보세요.', '손을 떼지 않고 한 번에 끝내면 완벽!'));
      pct = ui.el('span', 'soon', '0%'); pct.id = 'doughPct'; r.appendChild(pct);
      root.appendChild(r);
      const r2 = ui.el('div', 'row');
      const track = ui.el('div'); track.style.cssText = 'flex:1;height:12px;border-radius:999px;background:#F3E3C8;overflow:hidden';
      bar = ui.el('div'); bar.id = 'doughBar'; bar.style.cssText = 'height:100%;width:0;border-radius:999px;background:var(--choc)';
      track.appendChild(bar); r2.appendChild(track); root.appendChild(r2);
      syncPanel();
    }
  }
  function refresh() { // 줄 구성이 바뀔 때만 패널을 다시 만든다
    if (kit.active() && panelDone !== (p >= 1)) kit.repaint(); else syncPanel();
  }

  /* ───── 사건 ───── */
  function apply(d) {
    if (d.reset) { p = 0; shown = 0; acc = 0; press = 0; ox = 0; oz = 0; perf = false; oneGo = false; draw(); panelDone = null; refresh(); return; }
    if (typeof d.p !== 'number' || !(d.p > p)) return;
    const was = p;
    p = clamp01(Math.round(d.p / STEP) * STEP);
    if (p > shown) shown = p;
    acc = Math.max(acc, p);
    draw();
    if (p >= 1 && was < 1) {
      shown = 1; perf = !!d.perf;
      kit.judge(perf ? 2 : 1);
      if (!kit.reduceMotion) kit.tween(420, (k) => { const b = 1 + Math.sin(k * Math.PI) * 0.12; inside.scale.set(b, 2 - b, b); }, () => inside.scale.set(1, 1, 1));
    }
    refresh();
  }

  /* ───── 손가락 ───── */
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(TOP_Y + 0.15)), hit = new THREE.Vector3();
  const CX = g.position.x + BOWL.x, CZ = g.position.z + BOWL.z;
  let acc = 0; // 내가 문질러 쌓은 진행도
  function onBowl(i) {
    if (!i.ray.intersectPlane(plane, hit)) return false;
    return Math.hypot(hit.x - CX, hit.z - CZ) < 0.62; // 넉넉하게
  }
  function down(i) {
    if (back) back = null;
    oneGo = p === 0 && acc === 0;
    if (p < 1 && onBowl(i)) { press = 1; lean(); draw(); }
  }
  function lean() {
    const dx = hit.x - CX, dz = hit.z - CZ, d = Math.hypot(dx, dz) || 1, m = Math.min(d, 0.25) * 0.22 * (1 - shown * 0.5);
    ox = (dx / d) * m; oz = (dz / d) * m;
  }
  function move(i) {
    if (p >= 1 || !onBowl(i)) return;
    const dist = Math.hypot(i.dx, i.dy);
    if (!dist) return;
    acc = Math.max(acc, p) + dist / (7 * Math.max(320, i.w)); // 화면 폭의 7배쯤 문지르면 완성 (폰에서 3~5초)
    acc = clamp01(acc);
    shown = Math.max(shown, acc);
    press = 1; lean(); kit.sfx('knead');
    lumps.rotation.y += dist * 0.012;
    draw(); syncPanel();
    const step = Math.floor(acc / STEP + 1e-6) * STEP;
    if (step > p + 1e-6) kit.send(step >= 1 && oneGo ? { p: 1, perf: 1 } : { p: +step.toFixed(2) });
  }
  function up() {
    oneGo = false;
    if (!press) return;
    const p0 = press, x0 = ox, z0 = oz, me = {};
    back = me;
    kit.tween(260, (k) => {
      if (back !== me) return;
      const e = kit.easeBack(k);
      press = p0 * (1 - e); ox = x0 * (1 - e); oz = z0 * (1 - e); draw();
    }, () => { if (back === me) { back = null; press = 0; ox = 0; oz = 0; draw(); } });
  }

  draw();
  return {
    view: { tgt: [1.12, 1.02, -1.7], dir: [0.08, 1.25, 1], w: 1.0, h: 0.95 },
    panel, down, move, up, apply,
    leave() { if (press) { back = null; press = 0; ox = 0; oz = 0; draw(); } },
    get() { return { p, perf: perf ? 1 : 0 }; },
    grade: () => (p >= 1 ? (perf ? 2 : 1) : 0),
    set(v) {
      p = v && typeof v.p === 'number' ? clamp01(Math.round(v.p / STEP) * STEP) : 0;
      shown = p; acc = p; press = 0; ox = 0; oz = 0; perf = !!(v && v.perf && p >= 1); oneGo = false;
      draw(); refresh();
    },
  };
}
