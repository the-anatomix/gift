// 방 안에서 노는 것들. 가구를 누르면 그 가구에 맞는 놀이가 열린다.
//   다트판 → 1인칭 다트, TV → 1인칭으로 보기(내가 넣은 동영상), 벽난로 → 마시멜로 굽기, 오르골 → 캐럴
// app.js 가 넘겨주는 창구 K 로 카메라 자리(pose)와 아래 판을 다룬다.
import { THREE, M, put, cyl } from './kit.js';
import { DART, TV, SONGS } from './catalog.js';
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

  /* ───────── 다트 ───────── */
  const BEST_KEY = K.key('dart');
  const dart = {
    start(c) {
      c.aim = new THREE.Group(); // 흔들리는 조준점
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.028, 0.04, 20), new THREE.MeshBasicMaterial({ color: 0xFFFFFF, depthTest: false, transparent: true }));
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.01, 10), new THREE.MeshBasicMaterial({ color: 0xFF3B30, depthTest: false, transparent: true }));
      ring.renderOrder = dot.renderOrder = 9;
      c.aim.add(ring, dot); c.g.add(c.aim);
      c.darts = [];
      const d = portrait() ? 2.7 : 2.2;
      K.setPose({ pos: world(c.g, 0, DART.y, d), at: world(c.g, 0, DART.y, 0), fov: portrait() ? 44 : 36 });
      dart.reset(c);
    },
    reset(c) {
      for (const m of c.darts) c.g.remove(m);
      c.darts = []; c.left = 3; c.score = 0; c.phase = 'aim'; c.t = Math.random() * 6; c.fly = null; c.last = null;
      c.aim.visible = true;
      dart.paint(c);
    },
    paint(c) {
      if (c.phase === 'done') {
        const best = Math.max(c.score, +K.store.get(BEST_KEY) || 0);
        panel(`다트 끝! 합계 ${c.score}점`, `내 최고 점수 ${best}점`, [{ label: '다시 하기', main: true, id: 'playGo', fn: () => dart.reset(c) }, quit]);
      } else {
        panel(`다트 · 남은 화살 ${c.left}개 · ${c.score}점`, '조준점이 가운데에 올 때 던져요. 화면을 눌러도 던져져요.',
          [{ label: '던지기', main: true, id: 'playGo', fn: () => dart.shoot(c) }, quit]);
      }
    },
    // 조준점 자리 (다트판 가운데가 0, 0)
    at(c) { const sp = 1.5 + (3 - c.left) * 0.35; return [0.27 * Math.sin(c.t * sp * 1.3 + 1.1), 0.25 * Math.sin(c.t * sp * 1.9)]; },
    shoot(c, to) {
      if (c.phase !== 'aim') return;
      const [ax, ay] = to || dart.at(c);
      const m = new THREE.Group(); // 화살: 판 쪽(-z)을 향한다
      put(new THREE.ConeGeometry(0.012, 0.05, 8), 0xD9D0C3, 0, 0, 0.025, m, false).rotation.x = -Math.PI / 2;
      put(cyl(0.012, 0.012, 0.12, 8), 0xC8443A, 0, 0, 0.11, m, false).rotation.x = Math.PI / 2;
      for (const r of [0, Math.PI / 2]) put(new THREE.BoxGeometry(0.07, 0.002, 0.06), 0xF3E2C3, 0, 0, 0.19, m, false).rotation.z = r;
      c.g.add(m); c.darts.push(m);
      c.fly = { m, t: 0, from: [0.12, DART.y - 0.3, 1.9], to: [ax, DART.y + ay, DART.z] };
      c.phase = 'fly'; c.aim.visible = false;
    },
    land(c) {
      const [x, y] = [c.fly.to[0], c.fly.to[1] - DART.y], r = Math.hypot(x, y);
      const hit = DART.rings.find(([rr]) => r <= rr);
      const pts = hit ? hit[1] : 0;
      c.last = { x, y, pts };
      c.score += pts; c.left--; c.fly = null;
      K.toast(pts === 50 ? '한가운데! +50점' : pts ? `+${pts}점` : '빗나갔어요');
      if (c.left > 0) { c.phase = 'aim'; c.aim.visible = true; }
      else {
        c.phase = 'done';
        if (c.score > (+K.store.get(BEST_KEY) || 0)) K.store.set(BEST_KEY, c.score);
        K.fx({ k: 'dart', v: c.score });
      }
      dart.paint(c);
    },
    tick(c, dt) {
      if (c.phase === 'aim') { c.t += dt; const [x, y] = dart.at(c); c.aim.position.set(x, DART.y + y, DART.z + 0.012); }
      else if (c.phase === 'fly') {
        const f = c.fly; f.t = Math.min(1, f.t + dt / 0.26);
        const e = f.t * f.t * (3 - 2 * f.t);
        f.m.position.set(f.from[0] + (f.to[0] - f.from[0]) * e, f.from[1] + (f.to[1] - f.from[1]) * e + Math.sin(f.t * Math.PI) * 0.12, f.from[2] + (f.to[2] - f.from[2]) * e);
        if (f.t >= 1) dart.land(c);
      }
    },
    tap(c) { dart.shoot(c); },
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
  const hasVideo = () => !!video && video.readyState >= 2 && video.videoWidth > 0;
  function drawScreen(dt) {
    if (hasVideo()) {
      const s = Math.min(480 / video.videoWidth, 270 / video.videoHeight), w = video.videoWidth * s, h = video.videoHeight * s;
      sc.fillStyle = '#000'; sc.fillRect(0, 0, 480, 270);
      try { sc.drawImage(video, (480 - w) / 2, (270 - h) / 2, w, h); } catch (_) { /* 아직 그릴 수 없으면 건너뛴다 */ }
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
    }
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(blob);
    video.src = url; video.muted = !(sound && cur && cur.kind === 'tv');
    tryPlay();
    if (keep) db('readwrite', (s) => s.put(blob, FILE));
    if (cur && cur.kind === 'tv') tv.paint(cur);
    return true;
  }
  function clearVideo() {
    if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
    if (url) { URL.revokeObjectURL(url); url = null; }
    video = null;
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
      if (video) { video.muted = !sound; tryPlay(); }
      tv.paint(c);
    },
    paint(c) {
      const on = !!video;
      panel(on ? 'TV · 내가 넣은 동영상' : 'TV · 눈 내리는 밤', on ? '이 기기에 저장돼서 다음에도 계속 나와요. 친구 화면에는 안 보여요.' : '동영상을 넣으면 TV 에서 계속 나와요.',
        [{ label: on ? '다른 동영상' : '동영상 넣기', main: true, id: 'playGo', fn: () => file.click() },
          ...(on ? [{ label: sound ? '🔊 소리 끄기' : '🔇 소리 켜기', id: 'playSound', fn: () => { sound = !sound; video.muted = !sound; tryPlay(); tv.paint(c); } },
            { label: '빼기', id: 'playDrop', fn: () => clearVideo() }] : []),
          { label: '그만 보기', id: 'playQuit', fn: () => K.close() }]);
    },
    tick() {}, tap() {},
    stop() { if (video) video.muted = true; }, // 방을 꾸밀 때는 소리 없이 화면만 나온다
  };

  /* ───────── 벽난로: 마시멜로 굽기 ───────── */
  const STOPS = [[0, 0xFFF8EA], [0.45, 0xF6E0B0], [0.66, 0xD9A257], [0.86, 0x8A5A2B], [1.05, 0x3B2619], [1.3, 0x15100C]];
  const ca = new THREE.Color(), cb = new THREE.Color();
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
    color(c) {
      const h = c.heat;
      let k = 0; while (k < STOPS.length - 2 && h > STOPS[k + 1][0]) k++;
      const [h0, c0] = STOPS[k], [h1, c1] = STOPS[k + 1];
      c.mat.color.copy(ca.setHex(c0)).lerp(cb.setHex(c1), clamp((h - h0) / (h1 - h0), 0, 1));
    },
    paint(c) {
      if (c.phase === 'idle') panel('마시멜로 굽기', '불에 대고 있다가 노릇노릇해졌을 때 꺼내요. 색을 잘 보세요.', [{ label: '굽기 시작', main: true, id: 'playGo', fn: () => { c.phase = 'roast'; fire.paint(c); } }, quit]);
      else if (c.phase === 'roast') panel('굽는 중…', '너무 오래 두면 타요.', [{ label: '꺼내기', main: true, id: 'playGo', fn: () => fire.out(c) }]);
      else panel(`${c.say} (${c.pts}점)`, '한 번 더 구워 볼까요?', [{ label: '다시 굽기', main: true, id: 'playGo', fn: () => fire.reset(c) }, quit]);
    },
    out(c) {
      if (c.phase !== 'roast') return;
      [c.say, c.pts] = toast2(c.heat);
      c.phase = 'done';
      K.toast(c.say);
      K.fx({ k: 'fire', v: c.pts });
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

  const KINDS = { dart, tv, fire, music };
  // 화면을 처음 누를 때: 막혀 있던 동영상·소리를 다시 튼다 (브라우저는 누르기 전에는 소리를 못 내게 한다)
  addEventListener('pointerdown', () => {
    if (wantPlay && video) { wantPlay = false; tryPlay(); }
    if (wantSong && ac) { wantSong = false; ac.resume().catch(() => {}); }
  }, true);
  db('readonly', (s) => s.get(FILE)).then((b) => { if (b instanceof Blob && !video) setVideo(b, false); });

  return {
    get on() { return !!cur; }, get id() { return cur ? cur.id : null; }, get kind() { return cur ? cur.kind : null; },
    // 놀이를 연다. id = 가구, kind = 그 가구의 놀이
    start(id, kind) {
      if (cur) this.stop();
      const g = K.itemObj(id);
      if (!g || !KINDS[kind]) return false;
      cur = { id, kind, g };
      KINDS[kind].start(cur);
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
    tap() { if (cur) KINDS[cur.kind].tap(cur); },
    // 친구가 한 것
    peerFx(m) {
      if (!m || typeof m.k !== 'string') return;
      if (m.k === 'dart' && Number.isFinite(m.v)) K.toast(`친구가 다트에서 ${clamp(Math.round(m.v), 0, 150)}점을 냈어요 🎯`);
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
      get song() { return song ? song.id : null; }, get audio() { return ac ? ac.state : null; },
      get video() { return video ? { ready: video.readyState, w: video.videoWidth, muted: video.muted, paused: video.paused } : null; },
      throwAt(x, y) { if (cur && cur.kind === 'dart') dart.shoot(cur, [x, y]); },
      setHeat(h) { if (cur && cur.kind === 'fire') { cur.heat = h; fire.color(cur); } },
      setVideo, clearVideo, setSong, verdict: toast2,
      pixel(x, y) { const d = sc.getImageData(x, y, 1, 1).data; return [d[0], d[1], d[2]]; },
    },
  };
}
