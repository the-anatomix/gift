// 포장 자리. 상자를 고르고 "포장 완료"를 누르면 과자가 상자에 들어가고, 반죽이(마스코트)가 뛰며 좋아한다.
// 규칙은 stations/README.md 참고. kit.stick / kit.restick 은 이 자리만 쓰는 추가 도구.
export default function (kit) {
  const { THREE, scene, put, rbox, cyl, C, TOP_Y } = kit;
  const POS = { x: 0.6, z: -1.82 }, BOX = { w: 0.32, h: 0.92, d: 0.22 };
  const BOXES = [
    { name: '크림', hex: 0xFFF1DA, ribbon: C.accent },
    { name: '빨강', hex: C.accent, ribbon: 0xFFF6E2 },
    { name: '초콜릿', hex: C.choc, ribbon: C.accent },
    { name: '분홍', hex: 0xF4B6C0, ribbon: 0xFFF6E2 },
  ];
  let box = 0, packed = false, busy = false, mine = false;

  /* ── 상자 ── */
  const g = new THREE.Group(); g.position.set(POS.x, TOP_Y, POS.z); g.rotation.y = -0.12; scene.add(g);
  const boxMat = new THREE.MeshLambertMaterial({ color: BOXES[0].hex });
  const ribMat = new THREE.MeshLambertMaterial({ color: BOXES[0].ribbon });
  const inner = new THREE.MeshLambertMaterial({ color: C.dark });
  // 속이 빈 상자: 네 벽과 바닥
  const T = 0.014;
  put(new THREE.BoxGeometry(BOX.w, BOX.h, T), boxMat, 0, BOX.h / 2, BOX.d / 2, g);
  put(new THREE.BoxGeometry(BOX.w, BOX.h, T), boxMat, 0, BOX.h / 2, -BOX.d / 2, g);
  put(new THREE.BoxGeometry(T, BOX.h, BOX.d), boxMat, BOX.w / 2, BOX.h / 2, 0, g);
  put(new THREE.BoxGeometry(T, BOX.h, BOX.d), boxMat, -BOX.w / 2, BOX.h / 2, 0, g);
  put(new THREE.BoxGeometry(BOX.w, T, BOX.d), inner, 0, T / 2, 0, g, false);
  put(new THREE.BoxGeometry(0.2, 0.26, 0.004), C.white, 0, BOX.h * 0.42, BOX.d / 2 + T / 2 + 0.002, g, false); // 이름표
  // 뚜껑: 뒤쪽 모서리를 축으로 열린다
  const lid = new THREE.Group(); lid.position.set(0, BOX.h, -BOX.d / 2); g.add(lid);
  put(rbox(BOX.w + 0.03, 0.03, BOX.d + 0.03, 0.01), boxMat, 0, 0.015, BOX.d / 2, lid);
  const OPEN = -1.9;
  lid.rotation.x = OPEN;
  // 리본: 포장하면 나타난다
  const ribbon = new THREE.Group(); g.add(ribbon); ribbon.visible = false;
  put(new THREE.BoxGeometry(0.06, BOX.h + 0.036, BOX.d + 0.04), ribMat, 0, BOX.h / 2 + 0.018, 0, ribbon, false);
  for (const sx of [-1, 1]) {
    const b = put(new THREE.SphereGeometry(0.06, 10, 8), ribMat, sx * 0.055, BOX.h + 0.06, 0, ribbon);
    b.scale.set(1, 0.6, 0.55); b.rotation.z = sx * 0.5;
  }
  put(new THREE.SphereGeometry(0.028, 8, 6), ribMat, 0, BOX.h + 0.05, 0, ribbon, false);

  /* ── 반죽이: 반죽 덩어리 모양 마스코트 (사람 아님) ── */
  const palRoot = new THREE.Group(); palRoot.position.set(0.36, TOP_Y, -1.5); palRoot.scale.setScalar(1.35); scene.add(palRoot);
  const pal = new THREE.Group(); pal.rotation.y = 0.25; palRoot.add(pal);
  const body = put(new THREE.SphereGeometry(0.115, 18, 14), C.dough, 0, 0.1, 0, pal); body.scale.set(1, 0.88, 0.95);
  for (const sx of [-1, 1]) {
    put(new THREE.SphereGeometry(0.013, 8, 6), C.dark, sx * 0.04, 0.125, 0.1, pal, false);
    const ch = put(new THREE.SphereGeometry(0.018, 8, 6), C.accentSoft, sx * 0.072, 0.098, 0.088, pal, false); ch.scale.set(1, 0.6, 0.4);
  }
  const smile = put(new THREE.TorusGeometry(0.016, 0.004, 6, 10, Math.PI), C.dark, 0, 0.1, 0.108, pal, false); smile.rotation.z = Math.PI;
  put(cyl(0.05, 0.045, 0.04, 14), C.white, 0, 0.21, 0, pal);
  const puff = put(new THREE.SphereGeometry(0.065, 12, 10), C.white, 0, 0.255, 0, pal); puff.scale.set(1, 0.7, 1);

  function hop(times, done) {
    kit.tween(420 * times, (k) => {
      const ph = (k * times) % 1, up = Math.sin(ph * Math.PI);
      pal.position.y = up * 0.2;
      const sq = 1 + (up - 0.5) * 0.16;
      pal.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
      pal.rotation.y = 0.25 + Math.sin(k * Math.PI * 2) * 0.35;
    }, () => { pal.position.y = 0; pal.scale.set(1, 1, 1); pal.rotation.y = 0.25; kit.poke(); if (done) done(); });
  }
  function paint() {
    boxMat.color.setHex(BOXES[box].hex); ribMat.color.setHex(BOXES[box].ribbon);
    kit.poke(300);
  }
  function settle() { // 움직임 없이 지금 상태대로 놓기
    lid.rotation.x = packed ? 0 : OPEN; ribbon.visible = packed; ribbon.scale.setScalar(1); busy = false;
    paint(); kit.restick(0);
  }
  function doPack() {
    packed = true; busy = true;
    if (!kit.active()) { settle(); return; }
    kit.restick(650, () => {
      kit.tween(320, (k) => { lid.rotation.x = OPEN * (1 - kit.ease(k)); }, () => {
        ribbon.visible = true;
        kit.tween(300, (k) => { ribbon.scale.setScalar(Math.max(0.01, kit.easeBack(k))); });
        hop(3, () => {
          busy = false; kit.repaint();
          if (mine && kit.active()) window.dispatchEvent(new CustomEvent('kitchen:letter')); // 누른 사람에게만 편지 칸이 뜬다
          mine = false;
        });
      });
    });
    kit.repaint();
  }
  function doOpen() {
    packed = false; busy = false; ribbon.visible = false;
    if (!kit.active()) { settle(); return; }
    kit.tween(320, (k) => { lid.rotation.x = OPEN * kit.ease(k); }, () => kit.restick(600));
    kit.repaint();
  }
  const mainStyle = (b) => { b.style.background = 'var(--choc)'; b.style.borderColor = 'var(--choc)'; b.style.color = '#FFF4E0'; b.style.flex = '1'; };

  return {
    view: { tgt: [0.5, 1.68, -1.7], dir: [0.12, 0.42, 1], w: 1.0, h: 2.05 },
    packed: () => packed,
    // 상자 안(과자가 들어가 있는 자리)과 상자 위(넣기 전에 들고 있는 자리)
    slot: () => ({ x: POS.x, z: POS.z, inY: TOP_Y + 0.03, overY: TOP_Y + BOX.h + 0.1 }),
    panel(p, ui) {
      const r = ui.el('div', 'row');
      if (packed) {
        r.appendChild(ui.hintEl(busy ? '포장하는 중…' : '포장 완료!', busy ? '반죽이가 좋아하고 있어요.' : '편지를 써서 링크로 보내 보세요.'));
        p.appendChild(r);
        const r2 = ui.el('div', 'row');
        const w = ui.button('btn', '편지 쓰기', () => window.dispatchEvent(new CustomEvent('kitchen:letter'))); w.id = 'packLetter'; mainStyle(w); w.disabled = busy;
        const o = ui.button('btn', '다시 열기', () => kit.send({ open: 1 })); o.id = 'packOpen'; o.disabled = busy;
        r2.appendChild(w); r2.appendChild(o); p.appendChild(r2);
        return;
      }
      r.appendChild(ui.hintEl('상자를 고르고 포장해 보세요.'));
      const done = ui.button('btn', '포장 완료', () => { mine = true; kit.send({ pack: 1 }); }); done.id = 'packDone';
      mainStyle(done); done.style.flex = 'none'; done.style.minWidth = '104px';
      r.appendChild(done); p.appendChild(r);
      const r2 = ui.el('div', 'row');
      BOXES.forEach((b, i) => {
        const x = ui.button('sw', '', () => kit.send({ box: i }), b.name + ' 상자');
        const dot = ui.el('i'); dot.style.background = '#' + b.hex.toString(16).padStart(6, '0'); dot.style.borderRadius = '8px';
        x.appendChild(dot); x.appendChild(ui.el('span', '', b.name)); x.setAttribute('aria-pressed', String(i === box)); x.dataset.box = i;
        r2.appendChild(x);
      });
      p.appendChild(r2);
    },
    enter() { if (!busy) { lid.rotation.x = packed ? 0 : OPEN; ribbon.visible = packed; } },
    apply(d) {
      if (typeof d.box === 'number' && BOXES[d.box]) { box = d.box; paint(); kit.repaint(); }
      if (d.pack && !packed) doPack();
      if (d.open && packed) doOpen();
    },
    get() { return { box, packed: packed ? 1 : 0 }; },
    set(v) {
      box = v && BOXES[v.box] ? v.box | 0 : 0; packed = !!(v && v.packed); mine = false;
      settle(); kit.repaint();
    },
  };
}
