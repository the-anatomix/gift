// 방 안에서 노는 것들. 가구를 누르면 그 가구에 맞는 놀이가 열린다.
//   다트판 → 1인칭 다트, TV → 1인칭으로 보기(내가 넣은 동영상), 벽난로 → 마시멜로 굽기, 오르골 → 캐럴,
//   케이크 작업대 → 케이크 만들기(여럿이 같이, 다 만들면 촛불 불기, 한 조각씩 먹기), 오븐 → 새 케이크 굽기
// app.js 가 넘겨주는 창구 K 로 카메라 자리(pose)와 아래 판을 다룬다.
import { THREE, M, put, cyl } from './kit.js';
import { DART, TV, SONGS, CREAMS, TOPPINGS, CAKE, dartScore } from './catalog.js';
import { TV_MAT } from './furniture.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lit = (hex) => new THREE.MeshBasicMaterial({ color: hex });

export function makePlay(K) {
  let cur = null;   // 지금 하는 놀이 { kind, id, g(가구 묶음), ... }
  const v3 = new THREE.Vector3();
  const world = (g, x, y, z) => { g.updateMatrixWorld(); const p = g.localToWorld(v3.set(x, y, z)); return [p.x, p.y, p.z]; };
  const portrait = () => window.innerWidth < window.innerHeight;

  /* ───────── 아래 판 ───────── */
  function panel(main, sub, btns) {
    $('playMain').textContent = main; $('playSub').textContent = sub || '';
    const box = $('playBtns');
    box.textContent = '';
    for (const b of btns) {
      const el = document.createElement('button');
      el.type = 'button'; el.className = b.chip ? 'chip' : 'btn' + (b.main ? ' main' : ''); el.textContent = b.label;
      if (b.id) el.id = b.id;
      if (b.on !== undefined) el.setAttribute('aria-pressed', String(b.on));
      if (b.main || b.chip) el.style.flex = '1 0 auto';
      el.addEventListener('click', b.fn);
      box.appendChild(el);
    }
    K.resized();
  }
  const quit = { label: '그만하기', id: 'playQuit', fn: () => K.close() };
  // 이 방 최고 기록 한 줄 (" · 이 방 최고 기록 120점 (이름)"), 끝난 판의 점수를 이 방 기록에 대 본다 (book.js)
  const roomBest = (k) => { const t = K.bestLine ? K.bestLine(k) : ''; return t ? ' · ' + t : ''; };
  const record = (k, v) => { if (K.record) K.record(k, v); };
  const rankBtn = (k) => (K.rank ? [{ label: '🏆 순위', id: 'playRank', fn: () => K.rank(k) }] : []); // 이름별 순위 판 (rank.js)

  /* ───────── 다트 ───────── */
  // 손가락(마우스)으로 겨냥한 자리에 조준점이 따라오고, 손이 떨리듯 조금씩 흔들린다. 손을 떼면(누르면) 그때의 조준점으로 날아간다.
  const BEST_KEY = K.key('dart');
  const coarse = () => matchMedia('(pointer: coarse)').matches;
  function dartMesh() { // 화살: 촉이 판 쪽(-z)을 향한다
    const m = new THREE.Group();
    put(new THREE.ConeGeometry(0.008, 0.07, 8), 0xD9D0C3, 0, 0, 0.035, m, false).rotation.x = -Math.PI / 2;
    put(cyl(0.013, 0.01, 0.1, 8), 0xE7B441, 0, 0, 0.12, m, false).rotation.x = Math.PI / 2;
    put(cyl(0.006, 0.006, 0.09, 6), 0x2B2420, 0, 0, 0.215, m, false).rotation.x = Math.PI / 2;
    for (const r of [0, Math.PI / 2]) put(new THREE.BoxGeometry(0.075, 0.003, 0.07), 0xC8443A, 0, 0, 0.275, m, false).rotation.z = r + Math.PI / 4;
    return m;
  }
  const dart = {
    start(c) {
      c.aim = new THREE.Group(); // 조준점
      const mk = (geo, col) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, depthTest: false, transparent: true })); m.renderOrder = 9; c.aim.add(m); };
      mk(new THREE.RingGeometry(0.03, 0.038, 24), 0xFFFFFF); mk(new THREE.RingGeometry(0.026, 0.03, 24), 0x2B2420); mk(new THREE.CircleGeometry(0.007, 10), 0xFFE08A);
      c.g.add(c.aim);
      c.darts = [];
      const d = portrait() ? 2.5 : 2.1;
      // 화살이 다트 모양으로 보이게 조금 아래 옆에서 올려다본다
      K.setPose({ pos: world(c.g, 0.22, DART.y - 0.28, d), at: world(c.g, 0, DART.y, 0), fov: portrait() ? 46 : 36 });
      dart.reset(c);
    },
    reset(c) {
      for (const m of c.darts) c.g.remove(m);
      c.darts = []; c.left = 3; c.score = 0; c.phase = 'aim'; c.t = Math.random() * 6; c.fly = null; c.last = null;
      c.ax = 0; c.ay = 0; c.aim.visible = true;
      dart.paint(c);
    },
    paint(c) {
      if (c.phase === 'done') {
        const best = Math.max(c.score, +K.store.get(BEST_KEY) || 0);
        panel(`다트 끝! 합계 ${c.score}점`, `내 최고 점수 ${best}점${roomBest('dart')}`, [{ label: '다시 하기', main: true, id: 'playGo', fn: () => dart.reset(c) }, ...rankBtn('dart'), quit]);
      } else {
        panel(`다트 · 남은 화살 ${c.left}개 · ${c.score}점`, (coarse() ? '판을 누른 채 겨냥하고, 손을 떼면 날아가요. 조준점이 흔들리니 때를 잘 맞춰요.' : '마우스로 겨냥하고 누르면 날아가요. 조준점이 흔들리니 때를 잘 맞춰요.') + (c.left === 3 ? roomBest('dart') : ''),
          [{ label: '던지기', main: true, id: 'playGo', fn: () => dart.shoot(c) }, ...rankBtn('dart'), quit]);
      }
    },
    // 지금 조준점 자리 (다트판 가운데가 0, 0): 겨냥한 자리 + 손 떨림. 화살을 던질수록 조금 더 떨린다
    at(c) {
      const A = 0.034 + (3 - c.left) * 0.008, t = c.t;
      return [c.ax + A * (Math.sin(t * 2.9 + 1.1) + 0.6 * Math.sin(t * 5.3)), c.ay + A * (Math.sin(t * 3.7) + 0.6 * Math.sin(t * 6.1 + 2))];
    },
    // 화면의 한 점으로 겨냥한다. 손가락에 가려지지 않게 폰에서는 손가락보다 조금 위를 겨냥한다
    move(c, px, py) {
      if (c.phase !== 'aim') return;
      const p = K.pointOn(c.g, px, py - (coarse() ? 56 : 0), [0, DART.y, DART.z]);
      if (p) { c.ax = clamp(p.x, -0.45, 0.45); c.ay = clamp(p.y - DART.y, -0.45, 0.45); }
    },
    shoot(c, to) {
      if (c.phase !== 'aim') return;
      const [ax, ay] = to || dart.at(c);
      const m = dartMesh();
      m.rotation.set(-0.34, 0.2, 0); // 꽁지가 조금 들려서 꽂힌다 (화살 몸통이 보이게)
      c.g.add(m); c.darts.push(m);
      c.fly = { m, t: 0, from: [0.25, DART.y - 0.45, 1.7], to: [ax, DART.y + ay, DART.z] };
      c.phase = 'fly'; c.aim.visible = false;
    },
    land(c) {
      const x = c.fly.to[0], y = c.fly.to[1] - DART.y, r = dartScore(x, y);
      c.last = { x, y, pts: r.pts };
      c.score += r.pts; c.left--;
      if (Math.hypot(x, y) > DART.out) { c.fall = c.fly.m; c.fallT = 0; } // 판 밖으로 나간 화살은 바닥으로 떨어진다
      c.fly = null;
      K.toast(r.say);
      if (c.left > 0) { c.phase = 'aim'; c.aim.visible = true; }
      else {
        c.phase = 'done';
        if (c.score > (+K.store.get(BEST_KEY) || 0)) K.store.set(BEST_KEY, c.score);
        K.fx({ k: 'dart', v: c.score });
        record('dart', c.score);
      }
      dart.paint(c);
    },
    tick(c, dt) {
      c.t += dt;
      if (c.phase === 'aim') { const [x, y] = dart.at(c); c.aim.position.set(x, DART.y + y, DART.z + 0.012); }
      else if (c.phase === 'fly') {
        const f = c.fly; f.t = Math.min(1, f.t + dt / 0.3);
        const e = f.t * f.t * (3 - 2 * f.t);
        f.m.position.set(f.from[0] + (f.to[0] - f.from[0]) * e, f.from[1] + (f.to[1] - f.from[1]) * e + Math.sin(f.t * Math.PI) * 0.1, f.from[2] + (f.to[2] - f.from[2]) * e);
        if (f.t >= 1) dart.land(c);
      }
      if (c.fall) { // 빗나간 화살이 떨어져 사라진다
        c.fallT += dt; c.fall.position.y -= dt * (0.4 + c.fallT * 5); c.fall.rotation.x += dt * 4;
        if (c.fall.position.y < 0.05) { c.g.remove(c.fall); c.darts.splice(c.darts.indexOf(c.fall), 1); c.fall = null; }
      }
    },
    tap(c, px, py) { if (px !== undefined) dart.move(c, px, py); dart.shoot(c); },
    stop(c) { for (const m of c.darts) c.g.remove(m); c.g.remove(c.aim); },
  };

  /* ───────── TV ───────── */
  // 화면은 작은 그림판에 그려서 입힌다. 동영상이 있으면 동영상을, 없으면 눈 내리는 밤을 그린다.
  const scr = document.createElement('canvas');
  scr.width = 480; scr.height = 270;
  const sc = scr.getContext('2d');
  const tex = new THREE.CanvasTexture(scr);
  tex.colorSpace = THREE.SRGBColorSpace;
  TV_MAT.map = tex; TV_MAT.needsUpdate = true;
  const flakes = Array.from({ length: 46 }, (_, k) => ({ x: (k * 97) % 480, y: (k * 53) % 270, r: 1 + (k % 3), s: 14 + (k % 5) * 7 }));
  let video = null, url = null, sound = false, wantPlay = false, tvT = 0;
  let rv = null, rvFrom = null;      // 친구가 보내 주는 TV 영상과 보내는 사람
  const hasVideo = () => !!video && video.readyState >= 2 && video.videoWidth > 0;
  const hasRemote = () => !!rv && rv.readyState >= 2 && rv.videoWidth > 0;
  const watching = () => !!cur && cur.kind === 'tv';
  // 소리는 TV 를 보고 있고 소리를 켰을 때만 난다. 내 동영상이 있으면 그것을, 없으면 친구 것을 듣는다.
  function applySound() {
    if (video) video.muted = !(sound && watching());
    if (rv) rv.muted = !(sound && watching() && !video);
  }
  // 내 동영상을 방 사람들에게 보낸다: TV 그림판을 영상으로, 동영상의 소리를 붙여서
  let sharing = false;
  function share() {
    if (!video || !K.canShare()) { if (sharing) { sharing = false; K.shareTv(null); } return; }
    if (sharing || !hasVideo()) return;
    try {
      const st = scr.captureStream(15);
      try { const vs = video.captureStream ? video.captureStream() : video.mozCaptureStream ? video.mozCaptureStream() : null; const at = vs && vs.getAudioTracks()[0]; if (at) st.addTrack(at); } catch (_) { /* 소리를 못 붙이면 화면만 보낸다 */ }
      sharing = true;
      K.shareTv(st);
    } catch (_) { sharing = false; }
  }
  function drawScreen(dt) {
    const src = hasVideo() ? video : hasRemote() ? rv : null; // 내 동영상이 먼저, 없으면 친구가 보내 주는 것
    if (src) {
      const s = Math.min(480 / src.videoWidth, 270 / src.videoHeight), w = src.videoWidth * s, h = src.videoHeight * s;
      sc.fillStyle = '#000'; sc.fillRect(0, 0, 480, 270);
      try { sc.drawImage(src, (480 - w) / 2, (270 - h) / 2, w, h); } catch (_) { /* 아직 그릴 수 없으면 건너뛴다 */ }
    } else {
      const g = sc.createLinearGradient(0, 0, 0, 270);
      g.addColorStop(0, '#1B2550'); g.addColorStop(1, '#3A4A86');
      sc.fillStyle = g; sc.fillRect(0, 0, 480, 270);
      sc.fillStyle = '#FFF2C2'; sc.beginPath(); sc.arc(392, 62, 26, 0, 7); sc.fill();
      sc.fillStyle = '#F4F7FF'; sc.beginPath(); sc.ellipse(140, 290, 260, 70, 0, 0, 7); sc.fill(); sc.beginPath(); sc.ellipse(400, 300, 220, 70, 0, 0, 7); sc.fill();
      sc.fillStyle = '#2F7D56'; for (const [x, s] of [[110, 1], [170, 0.7], [350, 0.85]]) { sc.beginPath(); sc.moveTo(x, 232 - 70 * s); sc.lineTo(x - 26 * s, 232); sc.lineTo(x + 26 * s, 232); sc.fill(); }
      sc.fillStyle = '#FFFFFF';
      for (const f of flakes) { f.y += f.s * dt; f.x += Math.sin((f.y + f.s) * 0.05) * 8 * dt; if (f.y > 274) f.y = -4; sc.beginPath(); sc.arc(f.x, f.y, f.r, 0, 7); sc.fill(); }
    }
    tex.needsUpdate = true;
  }
  // 넣은 동영상은 이 기기에 기억해 둔다 (다음에 열어도 계속 나오게)
  const DB = 'nolja-tree', FILE = K.key('tv');
  function db(mode, fn) {
    return new Promise((ok) => {
      let rq;
      try { rq = indexedDB.open(DB, 1); } catch (_) { ok(null); return; }
      rq.onupgradeneeded = () => rq.result.createObjectStore('files');
      rq.onerror = () => ok(null);
      rq.onsuccess = () => {
        try {
          const tx = rq.result.transaction('files', mode), r = fn(tx.objectStore('files'));
          tx.oncomplete = () => { ok(r ? r.result : null); rq.result.close(); };
          tx.onerror = tx.onabort = () => { ok(null); rq.result.close(); };
        } catch (_) { ok(null); }
      };
    });
  }
  function tryPlay() { if (!video) return; const p = video.play(); if (p && p.catch) p.catch(() => { wantPlay = true; }); }
  function setVideo(blob, keep = true) {
    if (!(blob instanceof Blob)) return false;
    if (!video) {
      video = document.createElement('video');
      video.loop = true; video.playsInline = true; video.muted = true; video.preload = 'auto';
      video.setAttribute('playsinline', ''); video.setAttribute('webkit-playsinline', '');
      video.addEventListener('error', () => { if (video && video.src) K.toast('이 동영상은 재생할 수 없어요'); });
      video.addEventListener('loadeddata', () => share());
    }
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(blob);
    video.src = url; applySound();
    tryPlay();
    if (keep) db('readwrite', (s) => s.put(blob, FILE));
    if (cur && cur.kind === 'tv') tv.paint(cur);
    return true;
  }
  function clearVideo() {
    if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
    if (url) { URL.revokeObjectURL(url); url = null; }
    video = null;
    share(); applySound();
    db('readwrite', (s) => s.delete(FILE));
    if (cur && cur.kind === 'tv') tv.paint(cur);
  }
  const file = $('tvFile');
  file.addEventListener('change', () => { const f = file.files && file.files[0]; if (f) { setVideo(f); K.toast('동영상을 넣었어요'); } file.value = ''; });
  const tv = {
    start(c) {
      // 화면이 가로로 꽉 차 보이는 거리에 선다
      const fov = portrait() ? 58 : 38, hf = Math.atan(Math.tan(fov * Math.PI / 360) * K.aspect());
      const d = clamp((TV.w / 2 / 0.82) / Math.tan(hf), 1.5, 4.2);
      K.setPose({ pos: world(c.g, 0, TV.y + 0.05, d), at: world(c.g, 0, TV.y, 0), fov, inside: true });
      applySound(); tryPlay(); if (rv) rv.play().catch(() => {});
      tv.paint(c);
    },
    paint(c) {
      const on = !!video, far = !on && !!rv;
      panel(on ? 'TV · 내가 넣은 동영상' : far ? 'TV · 친구가 넣은 동영상' : 'TV · 눈 내리는 밤',
        on ? (K.canShare() ? '같이 있는 사람들 TV 에도 나와요. 이 기기에 저장돼서 다음에도 계속 나와요.' : '이 기기에 저장돼서 다음에도 계속 나와요.') : far ? '친구가 보내 주는 영상이에요.' : '동영상을 넣으면 TV 에서 계속 나와요. 같이 있는 사람들도 볼 수 있어요.',
        [{ label: on ? '다른 동영상' : '동영상 넣기', main: true, id: 'playGo', fn: () => file.click() },
          ...(on || far ? [{ label: sound ? '🔊 소리 끄기' : '🔇 소리 켜기', id: 'playSound', fn: () => { sound = !sound; applySound(); tryPlay(); if (rv) rv.play().catch(() => {}); tv.paint(c); } }] : []),
          ...(on ? [{ label: '빼기', id: 'playDrop', fn: () => clearVideo() }] : []),
          { label: '그만 보기', id: 'playQuit', fn: () => K.close() }]);
    },
    tick() {}, tap() {},
    stop() { setTimeout(applySound, 0); }, // 방을 꾸밀 때는 소리 없이 화면만 나온다
  };

  /* ───────── 벽난로: 마시멜로 굽기 ───────── */
  const STOPS = [[0, 0xFFF8EA], [0.45, 0xF6E0B0], [0.66, 0xD9A257], [0.86, 0x8A5A2B], [1.05, 0x3B2619], [1.3, 0x15100C]];
  const ca = new THREE.Color(), cb = new THREE.Color();
  // 구운 정도 h 에 맞는 색을 stops([[h, 색], …]) 사이에서 골라 col 에 넣는다
  function grade(stops, h, col) {
    let k = 0; while (k < stops.length - 2 && h > stops[k + 1][0]) k++;
    const [h0, c0] = stops[k], [h1, c1] = stops[k + 1];
    col.copy(ca.setHex(c0)).lerp(cb.setHex(c1), clamp((h - h0) / (h1 - h0), 0, 1));
  }
  function toast2(h) { // 구운 정도 → [말, 점수]
    const pts = Math.round(clamp(100 - Math.abs(h - 0.66) * 260, 0, 100));
    const say = h < 0.3 ? '아직 하얘요' : h < 0.55 ? '살짝 덜 익었어요' : h <= 0.78 ? '노릇노릇 완벽해요!' : h <= 1.0 ? '조금 탔어요' : '새까맣게 탔어요';
    return [say, pts];
  }
  const fire = {
    start(c) {
      c.m = new THREE.Group();
      put(cyl(0.008, 0.008, 0.7, 6), 0x8A5F3F, 0, 0, 0.36, c.m, false).rotation.x = Math.PI / 2;
      c.mat = new THREE.MeshLambertMaterial({ color: 0xFFF8EA });
      c.mallow = put(cyl(0.05, 0.05, 0.09, 14), c.mat, 0, 0, 0, c.m, false);
      c.mallow.rotation.x = Math.PI / 2;
      c.m.position.set(0.05, 0.42, 0.42); c.m.rotation.x = 0.25;
      c.g.add(c.m);
      K.setPose({ pos: world(c.g, 0.25, 0.85, portrait() ? 2.3 : 1.9), at: world(c.g, 0, 0.5, 0.1), fov: portrait() ? 56 : 42, inside: true });
      fire.reset(c);
    },
    reset(c) { c.heat = 0; c.phase = 'idle'; c.t = 0; fire.color(c); fire.paint(c); },
    color(c) { grade(STOPS, c.heat, c.mat.color); },
    paint(c) {
      if (c.phase === 'idle') panel('마시멜로 굽기', '불에 대고 있다가 노릇노릇해졌을 때 꺼내요. 색을 잘 보세요.' + roomBest('fire'), [{ label: '굽기 시작', main: true, id: 'playGo', fn: () => { c.phase = 'roast'; fire.paint(c); } }, ...rankBtn('fire'), quit]);
      else if (c.phase === 'roast') panel('굽는 중…', '너무 오래 두면 타요.', [{ label: '꺼내기', main: true, id: 'playGo', fn: () => fire.out(c) }]);
      else {
        panel(`${c.say} (${c.pts}점)`, '한 번 더 구워 볼까요?' + roomBest('fire'), [
          { label: '😋 먹기', id: 'playEat', fn: () => { K.munch(c.pts >= 80 ? '달콤해요! 마시멜로를 먹었어요' : '마시멜로를 먹었어요'); fire.reset(c); } },
          { label: '다시 굽기', main: true, id: 'playGo', fn: () => fire.reset(c) }, ...rankBtn('fire'), quit]);
      }
    },
    out(c) {
      if (c.phase !== 'roast') return;
      [c.say, c.pts] = toast2(c.heat);
      c.phase = 'done';
      K.toast(c.say);
      K.fx({ k: 'fire', v: c.pts });
      record('fire', c.pts);
      fire.paint(c);
    },
    tick(c, dt) {
      c.t += dt;
      if (c.phase === 'roast') {
        c.heat += dt * (0.2 + 0.07 * Math.sin(c.t * 3.1) + 0.05 * Math.sin(c.t * 7.7)); // 불이 일렁여서 빠르기가 조금씩 달라진다
        fire.color(c);
        c.mallow.rotation.z += dt * 1.5; // 돌려 가며 굽는다
        if (c.heat >= 1.3) fire.out(c);
      }
      c.m.position.y = 0.42 + Math.sin(c.t * 2.3) * 0.008;
    },
    tap() {},
    stop(c) { c.g.remove(c.m); c.mat.dispose(); },
  };

  /* ───────── 오븐: 새 케이크 굽기 ───────── */
  // 빈 작업대가 있어야 구울 수 있다. 알맞게 구워 꺼내면 새 케이크가 그 작업대에 나온다.
  const BATTER = [[0, 0xF6E7A8], [0.45, 0xF2D27A], [0.7, 0xD9A24E], [0.9, 0xA8692E], [1.15, 0x3B2619]];
  const bake = {
    start(c) {
      if (!K.canEdit()) { K.toast('구경하는 중에는 케이크를 구울 수 없어요'); return false; }
      if (!K.bakeTarget()) { K.toast('작업대가 비어 있어야 새 케이크를 구울 수 있어요'); return false; }
      c.m = new THREE.Group(); // 오른쪽 화구 위의 둥근 케이크 틀
      c.tin = new THREE.MeshLambertMaterial({ color: 0xA9B0B6, side: THREE.DoubleSide });
      c.mat = new THREE.MeshLambertMaterial({ color: BATTER[0][1] });
      put(new THREE.CylinderGeometry(0.135, 0.125, 0.075, 24, 1, true), c.tin, 0, 0.0375, 0, c.m, false);
      put(cyl(0.125, 0.125, 0.008, 24), c.tin, 0, 0.004, 0, c.m, false);
      c.batter = put(cyl(0.126, 0.126, 0.03, 24), c.mat, 0, 0, 0, c.m, false);
      c.m.position.set(0.24, 0.885, 0);
      c.g.add(c.m);
      K.setPose({ pos: world(c.g, 0.1, 1.5, portrait() ? 1.7 : 1.4), at: world(c.g, 0.15, 0.9, 0), fov: portrait() ? 56 : 42, inside: true });
      bake.reset(c);
    },
    reset(c) { c.heat = 0; c.phase = 'idle'; c.t = 0; c.batter.visible = true; bake.color(c); bake.paint(c); },
    color(c) { // 색이 짙어지고 조금 부풀어 오른다
      grade(BATTER, c.heat, c.mat.color);
      const s = 1 + 0.9 * clamp(c.heat / 0.8, 0, 1);
      c.batter.scale.y = s; c.batter.position.y = 0.008 + 0.015 * s;
    },
    paint(c) {
      if (c.phase === 'idle') panel('케이크 굽기', '반죽을 틀에 붓고 오븐에 넣어요', [{ label: '굽기 시작', main: true, id: 'playGo', fn: () => { c.phase = 'bake'; bake.paint(c); } }, quit]);
      else if (c.phase === 'bake') panel('굽는 중…', '노릇노릇해지면 꺼내요. 너무 오래 두면 타요.', [{ label: '꺼내기', main: true, id: 'playGo', fn: () => bake.out(c) }]);
      else if (c.phase === 'burnt') panel('새까맣게 탔어요', '다시 구워 봐요', [{ label: '다시 굽기', main: true, id: 'playGo', fn: () => bake.reset(c) }, quit]);
      else panel('새 케이크가 작업대에 나왔어요', '작업대에 가서 크림과 장식으로 꾸며 보세요.', [quit]);
    },
    burn(c) { c.phase = 'burnt'; K.toast('새까맣게 탔어요. 다시 구워 봐요'); bake.paint(c); },
    out(c) {
      if (c.phase !== 'bake') return;
      if (c.heat < 0.5) { K.toast('아직 덜 익었어요. 조금 더 구워요'); return; } // 그대로 계속 굽는다
      if (c.heat > 0.9) { bake.burn(c); return; }
      if (!K.bake()) { K.toast('작업대가 비어 있지 않아요'); bake.reset(c); return; }
      c.phase = 'done'; c.batter.visible = false; // 빵은 작업대로 옮겨 갔다
      K.toast('케이크 빵이 잘 구워졌어요! 작업대에 올려 뒀어요 🎂');
      bake.paint(c);
    },
    tick(c, dt) {
      c.t += dt;
      if (c.phase !== 'bake') return;
      c.heat += dt * (0.16 + 0.04 * Math.sin(c.t * 2.7) + 0.025 * Math.sin(c.t * 6.3)); // 불 세기가 조금씩 달라진다
      bake.color(c);
      if (c.heat >= 1.15) bake.burn(c);
    },
    tap() {},
    stop(c) {
      c.g.remove(c.m);
      c.m.traverse((m) => { if (m.geometry) m.geometry.dispose(); });
      c.mat.dispose(); c.tin.dispose();
    },
  };

  /* ───────── 오르골: 캐럴 ───────── */
  let ac = null, song = null, noteAt = 0, noteK = 0, wantSong = false;
  const freq = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function bell(f, when, len) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.22, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(0.5, len * 1.6));
    g.connect(ac.destination);
    for (const [mul, vol] of [[1, 1], [2, 0.35], [3.01, 0.12]]) {
      const o = ac.createOscillator(), v = ac.createGain();
      o.type = 'sine'; o.frequency.value = f * mul; v.gain.value = vol;
      o.connect(v); v.connect(g); o.start(when); o.stop(when + Math.max(0.5, len * 1.6) + 0.05);
    }
  }
  function setSong(id, mine = true) {
    const s = SONGS.find((x) => x.id === id) || null;
    song = s; noteK = 0;
    if (s) {
      try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { ac = null; }
      if (!ac) { song = null; K.toast('이 브라우저에서는 소리를 낼 수 없어요'); }
      else { if (ac.state === 'suspended') { wantSong = true; ac.resume().catch(() => {}); } noteAt = ac.currentTime + 0.15; }
    }
    if (mine) K.fx({ k: 'music', v: song ? song.id : '' });
    if (cur && cur.kind === 'music') music.paint(cur);
  }
  function tickSong() { // 조금 앞의 음까지 미리 예약해 둔다
    if (!song || !ac || ac.state !== 'running') return;
    if (noteAt < ac.currentTime) noteAt = ac.currentTime + 0.05;
    const beat = 60 / song.bpm;
    while (noteAt < ac.currentTime + 0.35) {
      const [m, b] = song.notes[noteK];
      if (m) bell(freq(m), noteAt, b * beat);
      noteAt += b * beat;
      noteK = (noteK + 1) % song.notes.length;
      if (noteK === 0) noteAt += beat * 2; // 한 번 끝나면 잠깐 쉬고 다시
    }
  }
  const music = {
    start(c) { music.paint(c); },
    paint() {
      panel(song ? `오르골 · ${song.name}` : '오르골', song ? '판을 닫아도 계속 나와요. 친구에게도 들려요.' : '캐럴을 골라 보세요. 친구에게도 들려요.',
        [...SONGS.map((s) => ({ label: s.name, chip: true, id: 'song-' + s.id, on: !!song && song.id === s.id, fn: () => setSong(s.id) })),
          ...(song ? [{ label: '끄기', id: 'playOff', fn: () => setSong(null) }] : []),
          { label: '닫기', id: 'playQuit', fn: () => K.close() }]);
    },
    tick() {}, tap() {}, stop() {},
  };

  /* ───────── 케이크 만들기 ───────── */
  // 케이크는 방의 것이라(방 상태에 들어 있다) 옆에 온 사람 누구나 같이 꾸밀 수 있고, 모두에게 바로 보인다.
  let topping = TOPPINGS[0].id;
  const cake = {
    start(c) {
      const sp = K.cakeSpot(c.id); // 케이크가 작업대 위에 있는지, 탁자 위에 있는지
      c.spot = sp.id;
      K.setPose({ pos: world(sp.g, 0, sp.top + (portrait() ? 1.36 : 0.86), portrait() ? 1.2 : 1.0), at: world(sp.g, 0, sp.top - 0.04, 0), fov: portrait() ? 64 : 40, inside: true }); // 세로 화면은 좌우가 좁아서 더 멀리, 더 넓게 본다
      cake.paint(c);
    },
    paint(c) {
      const k = K.cake(c.id), n = k.tops.filter((t) => t[0] === 'candle').length, edit = K.canEdit();
      const carry = { label: '🎂 들고 가기', id: 'playCarry', fn: () => K.carry(c.id) };
      const eat = { label: '🍰 한 조각 먹기', id: 'playEat', fn: () => K.eat(c.id) }; // 구경하는 사람도 먹을 수 있다
      const rest = k.left < CAKE.slices ? `남은 조각 ${k.left}/${CAKE.slices} · ` : '';
      if (k.lit > 0) {
        panel(`촛불 ${k.lit}개가 켜져 있어요 🕯️`, '다 같이 후~ 불어서 꺼 보세요.', [{ label: '후~ 불기', main: true, id: 'playGo', fn: () => K.op({ t: 'cakeBlow', id: c.id }) }, ...(edit ? [carry] : []), quit]);
        return;
      }
      if (!edit) { panel('케이크', rest + '구경하는 중에는 꾸밀 수 없어요. 촛불이 켜지면 같이 불 수 있어요.', [eat, quit]); return; }
      panel('케이크 만들기', rest + '크림을 고르고, 장식을 골라 케이크 위를 눌러 올려요. 옆에 온 친구도 같이 만들 수 있어요.', [
        ...CREAMS.map((x, i) => ({ label: x.name, chip: true, id: 'cream-' + x.id, on: k.cream === i, fn: () => K.op({ t: 'cakeCream', id: c.id, v: i }) })),
        ...TOPPINGS.map((x) => ({ label: x.icon + ' ' + x.name, chip: true, id: 'top-' + x.id, on: topping === x.id, fn: () => { topping = x.id; cake.paint(c); } })),
        ...(n ? [{ label: '🕯️ 촛불 켜기', main: true, id: 'playGo', fn: () => K.op({ t: 'cakeLit', id: c.id, n }) }] : []),
        ...(k.tops.length ? [{ label: '다 치우기', id: 'playClear', fn: () => K.op({ t: 'cakeClear', id: c.id }) }] : []),
        eat, carry, quit]);
    },
    tick() {},
    tap(c, px, py) {
      const k = K.cake(c.id);
      if (k.lit > 0 || !K.canEdit()) return;
      const p = K.pickCake(c.id, px, py);
      if (p && !K.op({ t: 'cakeTop', id: c.id, k: topping, x: p.x, z: p.z })) K.toast('장식을 더 올릴 수 없어요');
    },
    stop() {},
  };

  const KINDS = { dart, tv, fire, music, cake, bake };
  // 화면을 처음 누를 때: 막혀 있던 동영상·소리를 다시 튼다 (브라우저는 누르기 전에는 소리를 못 내게 한다)
  addEventListener('pointerdown', () => {
    if (wantPlay) { wantPlay = false; if (video) tryPlay(); if (rv) rv.play().catch(() => {}); }
    if (wantSong && ac) { wantSong = false; ac.resume().catch(() => {}); }
  }, true);
  db('readonly', (s) => s.get(FILE)).then((b) => { if (b instanceof Blob && !video) setVideo(b, false); });

  return {
    get on() { return !!cur; }, get id() { return cur ? cur.id : null; }, get kind() { return cur ? cur.kind : null; },
    // 다른 모듈의 놀이를 더한다 (방명록: book.js). impl = { start(c), paint(c), tick, tap, stop }
    add(kind, impl) { KINDS[kind] = impl; },
    panel, // 아래 판을 그린다 (다른 모듈의 놀이가 쓴다)
    get cur() { return cur; },
    get spot() { return cur ? cur.spot || cur.id : null; }, // 놀이가 벌어지는 가구 (탁자에 올려놓은 케이크면 그 탁자)
    // 놀이를 연다. id = 가구, kind = 그 가구의 놀이 (케이크면 id = 케이크, 그 케이크가 놓인 가구에서 논다)
    // 놀이가 열 수 없다고 하면(start 가 false) 열지 않고 false
    start(id, kind) {
      if (cur) this.stop();
      if (!KINDS[kind]) return false;
      const sp = kind === 'cake' ? K.cakeSpot(id) : null, g = kind === 'cake' ? sp && sp.g : K.itemObj(id);
      if (!g) return false;
      cur = { id, kind, g };
      if (KINDS[kind].start(cur) === false) { cur = null; return false; }
      return true;
    },
    stop() {
      if (!cur) return;
      const c = cur; cur = null;
      KINDS[c.kind].stop(c);
      K.setPose(null);
    },
    tick(dt) {
      if (cur) KINDS[cur.kind].tick(cur, dt);
      tickSong();
      if (K.hasKind('tv')) { tvT += dt; if (tvT > 0.06) { drawScreen(tvT); tvT = 0; } }
    },
    tap(px, py) { if (cur) KINDS[cur.kind].tap(cur, px, py); },
    // 놀이 중에 손가락·마우스가 움직였다 (다트 겨냥)
    move(px, py) { if (cur && KINDS[cur.kind].move) KINDS[cur.kind].move(cur, px, py); },
    // 친구가 TV 영상을 보내기 시작했거나(stream) 그만뒀다(null)
    remoteTv(stream, from) {
      if (!stream) { if (rvFrom !== from) return; if (rv) { rv.pause(); rv.srcObject = null; } rv = null; rvFrom = null; }
      else {
        if (!rv) { rv = document.createElement('video'); rv.playsInline = true; rv.muted = true; rv.setAttribute('playsinline', ''); }
        rv.srcObject = stream; rvFrom = from;
        applySound();
        const p = rv.play(); if (p && p.catch) p.catch(() => { wantPlay = true; });
      }
      if (watching()) tv.paint(cur);
    },
    // 연결이 이어졌을 때: 내가 넣어 둔 동영상을 방 사람들에게 보내기 시작한다
    reshare() { share(); },
    // 연결이 끊겼을 때: 다시 이어지면 새로 보내야 한다
    unshare() { sharing = false; },
    // 방 상태가 바뀌었을 때(누가 케이크를 꾸몄을 때) 판을 다시 그린다
    refresh(id) { if (cur && cur.id === id && KINDS[cur.kind].paint) KINDS[cur.kind].paint(cur); },
    // 캐럴을 튼다 (점등식처럼 모두가 각자 트는 것이라 친구에게 알리지 않는다)
    song(id) { setSong(id, false); },
    // 친구가 한 것
    peerFx(m) {
      if (!m || typeof m.k !== 'string') return;
      if (m.k === 'dart' && Number.isFinite(m.v)) K.toast(`친구가 다트에서 ${clamp(Math.round(m.v), 0, 180)}점을 냈어요 🎯`);
      else if (m.k === 'fire' && Number.isFinite(m.v)) K.toast(m.v >= 80 ? '친구가 마시멜로를 완벽하게 구웠어요!' : '친구가 마시멜로를 구웠어요');
      else if (m.k === 'music' && typeof m.v === 'string') {
        const had = song ? song.id : '';
        setSong(m.v || null, false);
        if ((song ? song.id : '') !== had) K.toast(song ? `친구가 캐럴을 틀었어요 🎵 ${song.name}` : '친구가 캐럴을 껐어요');
      }
    },
    // 자동 검사가 쓰는 창구
    test: {
      get state() { return cur ? { kind: cur.kind, phase: cur.phase, left: cur.left, score: cur.score, heat: cur.heat, pts: cur.pts, say: cur.say, last: cur.last, darts: cur.darts ? cur.darts.length : 0 } : null; },
      get topping() { return topping; }, set topping(v) { topping = v; if (cur && cur.kind === 'cake') cake.paint(cur); },
      get song() { return song ? song.id : null; }, get audio() { return ac ? ac.state : null; },
      get video() { return video ? { ready: video.readyState, w: video.videoWidth, muted: video.muted, paused: video.paused } : null; },
      get remote() { return rv ? { ready: rv.readyState, w: rv.videoWidth, muted: rv.muted, from: rvFrom } : null; },
      throwAt(x, y) { if (cur && cur.kind === 'dart') dart.shoot(cur, [x, y]); },
      boardPoint(x, y) { if (!cur || cur.kind !== 'dart') return null; const [wx, wy, wz] = world(cur.g, x, DART.y + y, DART.z); return { x: wx, y: wy, z: wz }; },
      dartScore, get aim() { return cur && cur.kind === 'dart' ? { want: [cur.ax, cur.ay], now: dart.at(cur) } : null; },
      setHeat(h) { if (cur && (cur.kind === 'fire' || cur.kind === 'bake')) { cur.heat = h; KINDS[cur.kind].color(cur); } },
      setVideo, clearVideo, setSong, verdict: toast2,
      pixel(x, y) { const d = sc.getImageData(x, y, 1, 1).data; return [d[0], d[1], d[2]]; },
    },
  };
}
