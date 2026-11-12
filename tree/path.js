// 바닥 격자와 길찾기. 화면과 상관없는 계산만 둔다.
// 집(1층)은 가로 NX 칸, 세로 NZ 칸이고 한 칸은 CELL. 칸 (0, 0) 의 모서리가 (X0, Z0) 이다.
// 거실은 칸 (0~19, 0~17) 이고 트리는 (0, 0) 자리(칸 8과 9 사이)에 있다. 동쪽에 주방과 방이 붙어 있다(방 배치는 room.js).
//
// 격자 전체(GX × GZ)에는 집 말고도 두 곳이 더 있다.
//   마당: 집 남쪽. j = YARD.wall 줄은 집의 남쪽 벽(현관문 칸만 뚫려 있다), 그 아래 j0 ~ j1 이 마당.
//   2층: 동쪽 방들(주방·방) 위에 얹힌 복층. 격자에서는 집 동쪽 옆(i0 ~ i1)에 펼쳐 놓고, 그릴 때만 제자리(위)로 옮긴다.
//        그래서 자리 (x, z) 와 칸 (i, j) 는 모든 곳에서 그대로 쓰고, 화면에 놓을 때만 toWorld 를 지난다.
//   1층과 2층은 사다리(LADDER) 한 곳으로만 이어진다. 길찾기는 그 두 칸을 이웃으로 친다.
export const CELL = 0.5;
export const NX = 30, NZ = 18;
export const X0 = -4, Z0 = -4;
export const X1 = X0 + NX * CELL, Z1 = Z0 + NZ * CELL;
export const YARD = { wall: 18, j0: 19, j1: 26, i0: 0, i1: 29, door: [3, 4] }; // door = 현관문이 뚫린 칸(i)
export const LOFT = { i0: 32, i1: 41, j0: 0, j1: 17, di: 12, y: 2.8 };         // di = 격자에서 옆으로 밀어 둔 칸 수, y = 2층 바닥 높이
export const GX = LOFT.i1 + 1, GZ = YARD.j1 + 1;
export const GX1 = X0 + GX * CELL, GZ1 = Z0 + GZ * CELL;
export const LOFT_X = X0 + LOFT.i0 * CELL, LOFT_DX = LOFT.di * CELL;            // 2층이 시작하는 x, 그릴 때 왼쪽으로 당기는 거리
// 사다리: 거실 쪽 벽에 기대어 있다. foot = 1층에서 사다리 앞 칸, top = 2층에서 올라선 칸
export const LADDER = { foot: [19, 8], top: [32, 8], cost: 5 };

export const cellOf = (x, z) => [Math.floor((x - X0) / CELL), Math.floor((z - Z0) / CELL)];
export const centerOf = (i, j) => [X0 + (i + 0.5) * CELL, Z0 + (j + 0.5) * CELL];
// 그 자리가 몇 층인지 (0 = 1층과 마당, 1 = 2층)
export const levelOf = (x) => (x >= LOFT_X - 1e-6 ? 1 : 0);
export const levelOfCell = (i) => (i >= LOFT.i0 ? 1 : 0);
// 그 칸이 어디인지: 'house'(1층 집 안) | 'yard'(마당) | 'loft'(2층) | null(아무것도 없는 곳, 집의 남쪽 벽 줄 포함)
export function zoneOf(i, j) {
  if (i < 0 || j < 0 || i >= GX || j >= GZ) return null;
  if (j < NZ) return i < NX ? 'house' : i >= LOFT.i0 ? 'loft' : null;
  if (i >= NX) return null;
  if (j === YARD.wall) return i >= YARD.door[0] && i <= YARD.door[1] ? 'yard' : null;
  return 'yard';
}
// 자리 (x, z) 가 화면(세상)에서는 어디인지 [x, y, z]. 2층은 동쪽 방들 위로 올라간다
export const toWorld = (x, z) => (levelOf(x) ? [x - LOFT_DX, LOFT.y, z] : [x, 0, z]);
// 세상의 한 점이 층 lv 에서는 어느 자리인지
export const fromWorld = (wx, wz, lv) => [lv ? wx + LOFT_DX : wx, wz];

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export class Grid {
  constructor() { this.b = new Uint8Array(GX * GZ); }
  inside(i, j) { return i >= 0 && j >= 0 && i < GX && j < GZ; }
  free(i, j) { return this.inside(i, j) && !this.b[j * GX + i]; }
  block(i, j, v = true) { if (this.inside(i, j)) this.b[j * GX + i] = v ? 1 : 0; }
  freeAt(x, z) { const [i, j] = cellOf(x, z); return this.free(i, j); }

  // (x, z) 에 몸 반지름 r 인 아바타가 설 수 있는지
  fits(x, z, r = 0.18) {
    return this.freeAt(x - r, z - r) && this.freeAt(x + r, z - r) && this.freeAt(x - r, z + r) && this.freeAt(x + r, z + r);
  }

  // 막힌 칸을 눌렀을 때: 그 칸에 가장 가깝고, (fx, fz) 에서 가기 쉬운 빈칸 (같은 층에서 찾는다)
  nearestFree(i, j, fx, fz) {
    if (this.free(i, j)) return [i, j];
    const [tx, tz] = centerOf(i, j), lv = levelOfCell(i), same = levelOf(fx) === lv;
    let best = null, bestD = Infinity;
    for (let b = 0; b < GZ; b++) for (let a = 0; a < GX; a++) {
      if (!this.free(a, b) || levelOfCell(a) !== lv) continue;
      const [cx, cz] = centerOf(a, b);
      const d = Math.hypot(cx - tx, cz - tz) + (same ? 0.15 * Math.hypot(cx - fx, cz - fz) : 0);
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
  // 사다리의 두 칸(foot, top)은 서로 이웃이다. 층이 다르면 사다리를 거쳐 가는 거리로 어림한다.
  cells(si, sj, ti, tj) {
    if (!this.free(si, sj) || !this.free(ti, tj)) return null;
    const id = (i, j) => j * GX + i;
    const g = new Float32Array(GX * GZ).fill(Infinity), from = new Int16Array(GX * GZ).fill(-1), done = new Uint8Array(GX * GZ);
    const oct = (i, j, a, b) => { const dx = Math.abs(i - a), dz = Math.abs(j - b); return Math.max(dx, dz) + 0.4142 * Math.min(dx, dz); };
    const [fi, fj] = LADDER.foot, [ui, uj] = LADDER.top, tl = levelOfCell(ti);
    const h = (i, j) => {
      if (levelOfCell(i) === tl) return oct(i, j, ti, tj);
      return tl ? oct(i, j, fi, fj) + LADDER.cost + oct(ui, uj, ti, tj) : oct(i, j, ui, uj) + LADDER.cost + oct(fi, fj, ti, tj);
    };
    const relax = (c, a, b, cost) => { if (cost < g[id(a, b)]) { g[id(a, b)] = cost; from[id(a, b)] = c; open.push([cost + h(a, b), a, b]); } };
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
        for (let c = id(i, j); c !== -1; c = from[c]) out.push([c % GX, Math.floor(c / GX)]);
        return out.reverse();
      }
      for (const [dx, dz] of DIRS) {
        const a = i + dx, b = j + dz;
        if (!this.free(a, b) || done[id(a, b)]) continue;
        if (dx && dz && (!this.free(i + dx, j) || !this.free(i, j + dz))) continue;
        relax(id(i, j), a, b, g[id(i, j)] + (dx && dz ? 1.4142 : 1));
      }
      // 사다리
      const up = i === fi && j === fj, down = i === ui && j === uj;
      if (up || down) { const [a, b] = up ? LADDER.top : LADDER.foot; if (this.free(a, b) && !done[id(a, b)]) relax(id(i, j), a, b, g[id(i, j)] + LADDER.cost); }
    }
    return null;
  }

  // (sx, sz) 에서 (tx, tz) 쪽으로 걸어갈 꺾이는 점 목록. 막힌 곳을 누르면 그 옆 빈칸까지 간다.
  route(sx, sz, tx, tz) {
    const [si, sj] = cellOf(sx, sz);
    let [ti, tj] = cellOf(Math.max(X0 + 1e-3, Math.min(GX1 - 1e-3, tx)), Math.max(Z0 + 1e-3, Math.min(GZ1 - 1e-3, tz)));
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
      // 층이 바뀌는 곳(사다리)은 건너뛰지 않는다: 사다리 앞 칸 → 올라선 칸이 그대로 남는다
      while (b > a + 1 && (levelOf(pts[a][0]) !== levelOf(pts[b][0]) || !this.clear(pts[a][0], pts[a][1], pts[b][0], pts[b][1]))) b--;
      out.push(pts[b]); a = b;
    }
    return out.slice(1);
  }
}
