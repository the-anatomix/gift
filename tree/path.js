// 바닥 격자와 길찾기. 화면과 상관없는 계산만 둔다.
// 집(1층)은 가로 NX 칸, 세로 NZ 칸이고 한 칸은 CELL. 칸 (0, 0) 의 모서리가 (X0, Z0) 이다.
// 거실은 칸 (0~19, 0~17) 이고 트리는 (0, 0) 자리(칸 8과 9 사이)에 있다. 동쪽에 주방과 방이 붙어 있다(방 배치는 room.js).
//
// 격자 전체(GX × GZ)에는 1층 집 말고도 마당과 위층들이 있다.
//   마당: 집 남쪽. j = YARD.wall 줄은 집의 남쪽 벽(현관문 칸만 뚫려 있다), 그 아래 j0 ~ j1 이 마당.
//   위층(2층, 3층): 1층과 같은 크기의 한 층. 격자에서는 층마다 동쪽으로 FLOOR_DI 칸씩 밀어서 나란히 펼쳐 놓고,
//        그릴 때만 제자리(위)로 옮긴다. 그래서 자리 (x, z) 와 칸 (i, j) 는 모든 곳에서 그대로 쓰고, 화면에 놓을 때만 toWorld 를 지난다.
//   층 사이는 사다리(LADDERS)로만 이어진다. 길찾기는 사다리의 두 칸을 이웃으로 친다.
export const CELL = 0.5;
export const NX = 30, NZ = 18;
export const X0 = -4, Z0 = -4;
export const X1 = X0 + NX * CELL, Z1 = Z0 + NZ * CELL;
export const YARD = { wall: 18, j0: 19, j1: 26, i0: 0, i1: 29, door: [3, 4] }; // door = 현관문이 뚫린 칸(i)
export const LEVELS = 3;          // 층 수
export const FLOOR_DI = 32;       // 격자에서 층마다 옆으로 밀어 둔 칸 수 (집 30칸 + 빈 2칸)
export const FLOOR_H = 2.8;       // 한 층의 높이 (바닥에서 위층 바닥까지)
export const FLOOR_DX = FLOOR_DI * CELL;
export const GX = FLOOR_DI * (LEVELS - 1) + NX, GZ = YARD.j1 + 1;
export const GX1 = X0 + GX * CELL, GZ1 = Z0 + GZ * CELL;

export const cellOf = (x, z) => [Math.floor((x - X0) / CELL), Math.floor((z - Z0) / CELL)];
export const centerOf = (i, j) => [X0 + (i + 0.5) * CELL, Z0 + (j + 0.5) * CELL];
// 그 자리(칸)가 몇 층인지 (0 = 1층과 마당, 1 = 2층, 2 = 3층)
export const levelOfCell = (i) => Math.max(0, Math.min(LEVELS - 1, Math.floor(i / FLOOR_DI)));
export const levelOf = (x) => levelOfCell(Math.floor((x - X0) / CELL + 1e-6));
// 층 lv 에서 집 기준 칸 (a, j) 가 격자에서는 어느 칸인지
export const cellOn = (lv, a, j) => [a + lv * FLOOR_DI, j];
// 그 칸이 어디인지: 'house'(1층 집 안) | 'yard'(마당) | 'up'(위층) | null(아무것도 없는 곳, 집의 남쪽 벽 줄 포함)
export function zoneOf(i, j) {
  if (i < 0 || j < 0 || i >= GX || j >= GZ) return null;
  const lv = levelOfCell(i);
  if (i - lv * FLOOR_DI >= NX) return null;
  if (lv) return j < NZ ? 'up' : null;
  if (j < NZ) return 'house';
  if (j === YARD.wall) return i >= YARD.door[0] && i <= YARD.door[1] ? 'yard' : null;
  return 'yard';
}
// 자리 (x, z) 가 화면(세상)에서는 어디인지 [x, y, z]. 위층은 집 위로 올라간다
export function toWorld(x, z) { const lv = levelOf(x); return [x - lv * FLOOR_DX, lv * FLOOR_H, z]; }
// 사다리: 층 lv 에서 lv + 1 로. foot = 아래층에서 사다리 앞 칸, top = 위층에서 올라선 칸(둘 다 집 기준 칸).
// 위층에서 foot 과 같은 자리는 사다리가 올라오는 구멍이라 막혀 있다. a, b = 격자에서의 두 칸
export const LADDER_COST = 5;
export const LADDERS = [{ lv: 0, foot: [19, 8], top: [20, 8] }, { lv: 1, foot: [24, 8], top: [25, 8] }]
  .map((L) => ({ ...L, a: cellOn(L.lv, L.foot[0], L.foot[1]), b: cellOn(L.lv + 1, L.top[0], L.top[1]) }));
// 위층의 그 칸이 사다리가 올라오는 구멍인지
export function hatchCell(i, j) {
  const lv = levelOfCell(i);
  return lv > 0 && LADDERS.some((L) => L.lv === lv - 1 && L.foot[0] === i - lv * FLOOR_DI && L.foot[1] === j);
}

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
    const tl = levelOfCell(ti);
    const h = (i, j) => { // 층이 다르면 사다리들을 차례로 거쳐 가는 거리
      let lv = levelOfCell(i), sum = 0;
      while (lv !== tl) {
        const up = tl > lv, L = LADDERS[up ? lv : lv - 1], [p, q] = up ? [L.a, L.b] : [L.b, L.a];
        sum += oct(i, j, p[0], p[1]) + LADDER_COST; i = q[0]; j = q[1]; lv += up ? 1 : -1;
      }
      return sum + oct(i, j, ti, tj);
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
      for (const L of LADDERS) {
        const up = i === L.a[0] && j === L.a[1], down = i === L.b[0] && j === L.b[1];
        if (up || down) { const [a, b] = up ? L.b : L.a; if (this.free(a, b) && !done[id(a, b)]) relax(id(i, j), a, b, g[id(i, j)] + LADDER_COST); }
      }
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
