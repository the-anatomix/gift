// 자르기 자리. app.js 가 kit(도구 모음)를 넘겨 부른다. 규칙은 stations/README.md 참고.
// 도마 위 반죽판을 세로로 그으면 그 자리가 잘린다. 5번 자르면 막대 6개가 된다.
export default function (kit) {
  const { THREE, scene, put, rbox, C, TOP_Y } = kit;

  const N = 6, CUTS = N - 1;          // 막대 6개, 자를 곳 5군데
  const SW = 0.09, DEPTH = 0.4, GAP = 0.022, CX = -0.1, SHEET_Y = 0.062;
  const HOME = { x: 0.385, y: 0.06, z: 0.02, ry: -0.15 };

  const g = new THREE.Group(); g.position.set(-0.95, TOP_Y, 0.75); scene.add(g);
  put(rbox(0.9, 0.05, 0.6, 0.02), C.wood, 0, 0.025, 0, g);
  const sheet = new THREE.Group(); g.add(sheet);
  const knife = new THREE.Group(); knife.position.set(HOME.x, HOME.y, HOME.z); knife.rotation.y = HOME.ry; g.add(knife);
  put(new THREE.BoxGeometry(0.05, 0.008, 0.26), C.metal, 0, 0, -0.08, knife);
  put(rbox(0.04, 0.024, 0.14, 0.01), C.dark, 0, 0.004, 0.12, knife);

  /* 상태: 잘린 경계(0~4). open 은 벌어진 정도(움직임용) */
  const cut = new Set();
  const open = new Array(CUTS).fill(0);
  const bx = new Array(CUTS).fill(0); // 경계의 현재 x (도마 기준)
  const geos = {};
  let segs = []; // [{mesh, a, b}] a~b 번 막대를 묶은 조각
  const done = () => cut.size >= CUTS;

  function rebuild() {
    sheet.clear(); segs = [];
    let a = 0;
    for (let i = 0; i < N; i++) {
      if (i === N - 1 || cut.has(i)) {
        const n = i - a + 1;
        if (!geos[n]) geos[n] = rbox(n * SW - 0.004, 0.024, DEPTH, 0.01);
        segs.push({ mesh: put(geos[n], C.dough, 0, SHEET_Y, 0, sheet), a, b: i });
        a = i + 1;
      }
    }
    layout();
  }
  function layout() {
    let gaps = 0; for (let i = 0; i < CUTS; i++) gaps += GAP * open[i];
    let cur = CX - (N * SW + gaps) / 2;
    const cx = [];
    for (let i = 0; i < N; i++) {
      cx.push(cur + SW / 2); cur += SW;
      if (i < CUTS) { bx[i] = cur + (GAP * open[i]) / 2; cur += GAP * open[i]; }
    }
    for (const s of segs) s.mesh.position.x = (cx[s.a] + cx[s.b]) / 2;
    kit.poke();
  }
  function chop(b) { // 칼이 그 자리로 가서 내려찍고 제자리로
    const x = bx[b];
    kit.tween(420, (k) => {
      if (k < 0.45) {
        const t = k / 0.45;
        knife.position.set(x, 0.2 - 0.125 * t * t, 0.0); knife.rotation.y = 0;
      } else {
        const t = kit.ease((k - 0.45) / 0.55);
        knife.position.set(x + (HOME.x - x) * t, 0.075 + (HOME.y - 0.075) * t + Math.sin(t * Math.PI) * 0.06, HOME.z * t);
        knife.rotation.y = HOME.ry * t;
      }
    });
  }

  /* 패널 */
  let pill = null, shownDone = null;
  function panel(p, ui) {
    shownDone = done();
    const r = ui.el('div', 'row');
    if (shownDone) {
      r.appendChild(ui.hintEl('막대 완성!', '막대 ' + N + '개가 나왔어요. 이제 구우면 돼요.'));
      p.appendChild(r);
      const r2 = ui.el('div', 'row');
      const again = ui.button('btn', '다시 하기', () => kit.send({ reset: true })); again.id = 'cutReset'; again.style.flex = '1';
      const next = ui.button('btn', '구우러 가기', () => kit.go('oven')); next.id = 'cutNext'; next.style.flex = '1';
      r2.appendChild(again); r2.appendChild(next); p.appendChild(r2);
      pill = null;
    } else {
      r.appendChild(ui.hintEl('반죽 위를 위에서 아래로 그어 잘라 보세요.', '다섯 번 자르면 막대가 돼요.'));
      pill = ui.el('span', 'soon', cut.size + ' / ' + CUTS); pill.id = 'cutCount';
      r.appendChild(pill); p.appendChild(r);
    }
  }
  function refresh() {
    if (shownDone !== done()) kit.repaint();
    else if (pill) pill.textContent = cut.size + ' / ' + CUTS;
  }

  /* 한 손가락으로 긋기 */
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(TOP_Y + SHEET_Y));
  const hit = new THREE.Vector3();
  let stroke = null;
  function local(i) {
    if (!i.ray.intersectPlane(plane, hit)) return null;
    return { x: hit.x - g.position.x, z: hit.z - g.position.z };
  }
  function down(i) {
    const p = local(i);
    stroke = p ? { x0: p.x, z0: p.z, zMin: p.z, zMax: p.z, used: false } : null;
  }
  function move(i) {
    if (!stroke || stroke.used || done()) return;
    const p = local(i); if (!p) return;
    stroke.zMin = Math.min(stroke.zMin, p.z); stroke.zMax = Math.max(stroke.zMax, p.z);
    const dz = Math.abs(p.z - stroke.z0), dx = Math.abs(p.x - stroke.x0);
    if (dz < 0.16 || dz < dx * 1.5) return;                                  // 세로로 충분히 그어야 한다
    if (stroke.zMax < -DEPTH / 2 || stroke.zMin > DEPTH / 2) return;         // 반죽판을 지나야 한다
    const x = (p.x + stroke.x0) / 2;
    let best = -1, bd = 0.11;
    for (let b = 0; b < CUTS; b++) {
      if (cut.has(b)) continue;
      const d = Math.abs(bx[b] - x);
      if (d < bd) { bd = d; best = b; }
    }
    if (best < 0) return;
    stroke.used = true;
    kit.send({ cut: best });
  }
  function up() { stroke = null; }

  function apply(d) {
    if (d.reset) {
      if (!cut.size) return;
      cut.clear(); open.fill(0); rebuild(); refresh(); return;
    }
    const b = d.cut | 0;
    if (!(b >= 0 && b < CUTS) || cut.has(b)) return;
    cut.add(b); rebuild(); chop(b);
    kit.tween(240, (k) => { open[b] = kit.ease(k); layout(); });
    refresh();
  }
  function get() { return { cuts: Array.from(cut).sort() }; }
  function set(v) {
    cut.clear(); open.fill(0);
    for (const b of (v && Array.isArray(v.cuts) ? v.cuts : [])) if (b >= 0 && b < CUTS) { cut.add(b | 0); open[b | 0] = 1; }
    rebuild(); refresh();
  }
  rebuild();

  return {
    view: { tgt: [-0.95, 0.96, 0.75], dir: [0, 2.3, 1], w: 1.02, h: 0.72 },
    panel, down, move, up, apply, get, set,
  };
}
