// 굽기 자리. app.js 가 kit(도구 모음)를 넘겨 부른다. 규칙은 stations/README.md 참고.
export default function (kit) {
  const { THREE, scene, put, rbox, cyl, C, TOP_Y } = kit;
  const glow = new THREE.MeshBasicMaterial({ color: C.ovenGlow });
  const rackMat = new THREE.MeshLambertMaterial({ color: C.biscuit });
  const rackSticks = [];

  const g = new THREE.Group(); g.position.set(-1.3, TOP_Y, -1.72); scene.add(g);
  put(rbox(1.0, 0.62, 0.62, 0.07), C.accent, 0, 0.36, 0, g);
  put(rbox(0.62, 0.42, 0.04, 0.03), C.dark, -0.14, 0.36, 0.3, g, false);
  put(new THREE.BoxGeometry(0.5, 0.3, 0.02), glow, -0.14, 0.35, 0.318, g, false);
  put(rbox(0.5, 0.035, 0.045, 0.015), C.cream, -0.14, 0.6, 0.34, g);
  for (const y of [0.5, 0.36, 0.22]) {
    const k = put(cyl(0.045, 0.045, 0.04, 14), C.cream, 0.33, y, 0.32, g, false);
    k.rotation.x = Math.PI / 2;
  }
  for (const [x, z] of [[-0.4, -0.22], [0.4, -0.22], [-0.4, 0.22], [0.4, 0.22]]) put(cyl(0.04, 0.04, 0.05, 10), C.dark, x, 0.025, z, g, false);
  // 식힘망
  const r = new THREE.Group(); r.position.set(-0.15, TOP_Y, -1.72); scene.add(r);
  for (const z of [-0.26, 0.26]) put(new THREE.BoxGeometry(0.72, 0.02, 0.02), C.metal, 0, 0.08, z, r);
  for (let i = 0; i < 7; i++) put(new THREE.BoxGeometry(0.014, 0.014, 0.54), C.metal, -0.33 + i * 0.11, 0.08, 0, r);
  for (const [x, z] of [[-0.34, -0.26], [0.34, -0.26], [-0.34, 0.26], [0.34, 0.26]]) put(new THREE.BoxGeometry(0.02, 0.08, 0.02), C.metal, x, 0.04, z, r, false);
  for (let i = 0; i < 4; i++) {
    const s = put(cyl(0.032, 0.032, 0.5, 10), rackMat, -0.22 + i * 0.15, 0.125, (i % 2) * 0.03, r);
    s.rotation.x = Math.PI / 2; s.rotation.z = (i - 1.5) * 0.04; rackSticks.push(s);
  }

  /* ── 굽기: 시작을 누르면 게이지가 차오르고, 알맞은 구간에서 꺼내면 노릇하게 구워진다 ── */
  const BAKE_MS = 5200, ZONE = [0.55, 0.8];
  const BEST = 0.675, BEST_TOL = 0.013; // 완벽 기준: 가운데 선에서 0.07초 안쪽
  const LV = [
    null,
    { name: '살짝 덜 구워졌어요', sub: '연한 색 과자가 됐어요.', hex: 0xEDCB93 },
    { name: '알맞게 구워졌어요!', sub: '노릇노릇한 과자가 됐어요.', hex: 0xD9A05B },
    { name: '조금 진하게 구워졌어요', sub: '바삭하고 진한 과자가 됐어요.', hex: 0xA8703A },
  ];
  const dim = new THREE.Color(C.dark).lerp(new THREE.Color(C.ovenGlow), 0.25), hot = new THREE.Color(0xFFB347), idleGlow = new THREE.Color(C.ovenGlow);
  let phase = 'idle', lv = 0, prog = 0, run = null, fillEl = null, perf = false;
  glow.color.copy(dim);

  function show() {
    const col = lv ? LV[lv].hex : C.biscuit;
    rackMat.color.setHex(col); kit.setBiscuit(col);
    for (const st of rackSticks) st.visible = phase !== 'baking';
    if (phase !== 'baking') glow.color.copy(phase === 'done' ? idleGlow : dim);
    kit.poke(300);
  }
  function levelOf(p) { return p < ZONE[0] ? 1 : p <= ZONE[1] ? 2 : 3; }
  function stopRun() { if (run) { run.fn = () => {}; run.done = null; run = null; } }
  function startBake() {
    stopRun();
    phase = 'baking'; prog = 0; show(); kit.sfx('oven');
    const mine = run = kit.tween(BAKE_MS, (k) => {
      if (run !== mine) return;
      prog = k;
      glow.color.copy(dim).lerp(hot, 0.35 + 0.65 * k);
      if (fillEl) fillEl.style.width = (k * 100).toFixed(1) + '%';
    }, () => { if (run === mine && phase === 'baking') kit.send({ out: 1 }); }); // 끝까지 두면 저절로 꺼낸다
    mine.dur = BAKE_MS; // 움직임 줄이기 설정이어도 굽는 시간은 그대로 둔다
  }
  function act() {
    if (phase === 'baking') kit.send({ out: +prog.toFixed(3) });
    else kit.send({ start: 1 });
  }
  const mainStyle = (b) => { b.style.background = 'var(--choc)'; b.style.borderColor = 'var(--choc)'; b.style.color = '#FFF4E0'; };

  return {
    panel(p, ui) {
      fillEl = null;
      const r = ui.el('div', 'row');
      if (phase === 'done') {
        r.appendChild(ui.hintEl(perf ? '완벽하게 구워졌어요!' : LV[lv].name, perf ? '가운데 선에 딱 맞췄어요.' : lv === 2 ? '가운데 선에 딱 맞추면 완벽해요.' : LV[lv].sub));
        const again = ui.button('btn', '다시 굽기', () => kit.send({ reset: 1 })); again.id = 'ovenAgain';
        r.appendChild(again); p.appendChild(r);
        const r2 = ui.el('div', 'row');
        const b = ui.button('btn', '초콜릿 입히러 가기', () => kit.go('choco')); b.style.flex = '1'; mainStyle(b);
        r2.appendChild(b); p.appendChild(r2);
        return;
      }
      r.appendChild(ui.hintEl(phase === 'baking' ? '노릇한 구간에서 꺼내세요!' : '오븐에 넣고 알맞을 때 꺼내 보세요.',
        phase === 'baking' ? '가운데 선에 딱 맞추면 완벽!' : '굽기 정도에 따라 과자 색이 달라져요.'));
      const b = ui.button('btn', phase === 'baking' ? '지금 꺼내기' : '굽기 시작', act); b.id = 'ovenAct';
      mainStyle(b); b.style.minWidth = '104px';
      r.appendChild(b); p.appendChild(r);
      const r2 = ui.el('div', 'row');
      const bar = ui.el('div'); bar.id = 'ovenBar';
      bar.style.cssText = 'position:relative;flex:1;height:18px;border-radius:9px;background:#F3E3C8;overflow:hidden';
      const zone = ui.el('div');
      zone.style.cssText = `position:absolute;top:0;bottom:0;left:${ZONE[0] * 100}%;width:${(ZONE[1] - ZONE[0]) * 100}%;background:#D9A05B`;
      const fill = ui.el('div');
      fill.style.cssText = 'position:absolute;top:0;bottom:0;left:0;background:rgba(90,56,36,.55);border-right:3px solid #5A3824';
      fill.style.width = (phase === 'baking' ? prog * 100 : 0) + '%';
      const best = ui.el('div');
      best.style.cssText = `position:absolute;top:0;bottom:0;left:calc(${BEST * 100}% - 1.5px);width:3px;background:#FFF6E2`;
      bar.appendChild(zone); bar.appendChild(best); bar.appendChild(fill); r2.appendChild(bar); p.appendChild(r2);
      fillEl = fill;
    },
    leave() { fillEl = null; },
    apply(d) {
      if (d.reset) { stopRun(); phase = 'idle'; lv = 0; prog = 0; perf = false; show(); kit.repaint(); return; }
      if (d.start) { if (phase === 'baking') return; lv = 0; perf = false; startBake(); kit.repaint(); return; }
      if (typeof d.out === 'number') {
        if (phase !== 'baking') return;
        stopRun(); lv = levelOf(Math.max(0, Math.min(1, d.out))); perf = Math.abs(d.out - BEST) <= BEST_TOL; phase = 'done'; show();
        for (const st of rackSticks) { const y = st.position.y; kit.tween(420, (k) => { st.position.y = y + 0.12 * (1 - kit.easeBack(k)); }); }
        kit.sfx('ding');
        kit.judge(perf ? 2 : 1);
        if (kit.active() && !perf) kit.toast(LV[lv].name);
        kit.repaint();
      }
    },
    get() { return { lv, done: phase === 'done' ? 1 : 0, perf: perf ? 1 : 0, prog: +prog.toFixed(3), phase }; },
    grade: () => (phase === 'done' ? (perf ? 2 : 1) : 0),
    set(v) {
      stopRun();
      lv = v && v.done ? Math.max(1, Math.min(3, v.lv | 0)) : 0; phase = lv ? 'done' : 'idle'; prog = 0; perf = !!(v && v.perf && lv === 2);
      show(); kit.repaint();
    },
  };
}
