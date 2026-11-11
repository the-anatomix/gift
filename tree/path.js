// 바닥 격자와 길찾기. 화면과 상관없는 계산만 둔다.
// 방은 가로세로 N 칸, 한 칸은 CELL. 방 한가운데가 (0, 0) 이다.
export const N = 12;
export const CELL = 0.5;
export const HALF = (N * CELL) / 2;

export const cellOf = (x, z) => [Math.floor((x + HALF) / CELL), Math.floor((z + HALF) / CELL)];
export const centerOf = (i, j) => [-HALF + (i + 0.5) * CELL, -HALF + (j + 0.5) * CELL];

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export class Grid {
  constructor() { this.b = new Uint8Array(N * N); }
  inside(i, j) { return i >= 0 && j >= 0 && i < N && j < N; }
  free(i, j) { return this.inside(i, j) && !this.b[j * N + i]; }
  block(i, j, v = true) { if (this.inside(i, j)) this.b[j * N + i] = v ? 1 : 0; }
  freeAt(x, z) { const [i, j] = cellOf(x, z); return this.free(i, j); }

  // (x, z) 에 몸 반지름 r 인 아바타가 설 수 있는지
  fits(x, z, r = 0.18) {
    return this.freeAt(x - r, z - r) && this.freeAt(x + r, z - r) && this.freeAt(x - r, z + r) && this.freeAt(x + r, z + r);
  }

  // 막힌 칸을 눌렀을 때: 그 칸에 가장 가깝고, (fx, fz) 에서 가기 쉬운 빈칸
  nearestFree(i, j, fx, fz) {
    if (this.free(i, j)) return [i, j];
    const [tx, tz] = centerOf(i, j);
    let best = null, bestD = Infinity;
    for (let b = 0; b < N; b++) for (let a = 0; a < N; a++) {
      if (!this.free(a, b)) continue;
      const [cx, cz] = centerOf(a, b);
      const d = Math.hypot(cx - tx, cz - tz) + 0.15 * Math.hypot(cx - fx, cz - fz);
      if (d < bestD) { bestD = d; best = [a, b]; }
    }
    return best;
  }

  // 두 점 사이를 곧장 걸어갈 수 있는지 (몸 폭만큼 양옆도 본다)
  clear(ax, az, bx, bz, r = 0.18) {
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 1e-6) return this.fits(ax, az, r);
    const steps = Math.ceil(len / (CELL / 4));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      if (!this.fits(ax + (bx - ax) * t, az + (bz - az) * t, r)) return false;
    }
    return true;
  }

  // A* (대각선은 양옆 칸이 모두 비었을 때만). 칸 목록을 돌려준다. 길이 없으면 null.
  cells(si, sj, ti, tj) {
    if (!this.free(si, sj) || !this.free(ti, tj)) return null;
    const id = (i, j) => j * N + i;
    const g = new Float32Array(N * N).fill(Infinity), from = new Int16Array(N * N).fill(-1), done = new Uint8Array(N * N);
    const h = (i, j) => { const dx = Math.abs(i - ti), dz = Math.abs(j - tj); return Math.max(dx, dz) + 0.4142 * Math.min(dx, dz); };
    const open = [[h(si, sj), si, sj]];
    g[id(si, sj)] = 0;
    while (open.length) {
      let k = 0;
      for (let n = 1; n < open.length; n++) if (open[n][0] < open[k][0]) k = n;
      const [, i, j] = open.splice(k, 1)[0];
      if (done[id(i, j)]) continue;
      done[id(i, j)] = 1;
      if (i === ti && j === tj) {
        const out = [];
        for (let c = id(i, j); c !== -1; c = from[c]) out.push([c % N, Math.floor(c / N)]);
        return out.reverse();
      }
      for (const [dx, dz] of DIRS) {
        const a = i + dx, b = j + dz;
        if (!this.free(a, b) || done[id(a, b)]) continue;
        if (dx && dz && (!this.free(i + dx, j) || !this.free(i, j + dz))) continue;
        const cost = g[id(i, j)] + (dx && dz ? 1.4142 : 1);
        if (cost < g[id(a, b)]) { g[id(a, b)] = cost; from[id(a, b)] = id(i, j); open.push([cost + h(a, b), a, b]); }
      }
    }
    return null;
  }

  // (sx, sz) 에서 (tx, tz) 쪽으로 걸어갈 꺾이는 점 목록. 막힌 곳을 누르면 그 옆 빈칸까지 간다.
  route(sx, sz, tx, tz) {
    const [si, sj] = cellOf(sx, sz);
    let [ti, tj] = cellOf(Math.max(-HALF + 1e-3, Math.min(HALF - 1e-3, tx)), Math.max(-HALF + 1e-3, Math.min(HALF - 1e-3, tz)));
    let exact = this.free(ti, tj);
    if (!exact) { const n = this.nearestFree(ti, tj, sx, sz); if (!n) return null; [ti, tj] = n; }
    const cells = this.cells(si, sj, ti, tj);
    if (!cells) return null;
    const pts = cells.map(([i, j]) => centerOf(i, j));
    pts[0] = [sx, sz];
    // 누른 자리에 그대로 설 수 있으면 칸 가운데가 아니라 그 자리까지
    if (exact && this.fits(tx, tz)) pts[pts.length - 1] = [tx, tz];
    // 곧게 펴기: 멀리 있는 점까지 곧장 갈 수 있으면 사이 점을 뺀다
    const out = [pts[0]];
    let a = 0;
    while (a < pts.length - 1) {
      let b = pts.length - 1;
      while (b > a + 1 && !this.clear(pts[a][0], pts[a][1], pts[b][0], pts[b][1])) b--;
      out.push(pts[b]); a = b;
    }
    return out.slice(1);
  }
}
