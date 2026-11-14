// 방 불 켜고 끄기. 층마다 북쪽 벽에 스위치가 하나 있고, 그 앞에서 스페이스바(폰은 아래 단추)로 그 층의 불을 켜고 끈다.
//   불은 방의 상태다(state.js 의 { t: 'lamp', lv, on }): 층마다 따로이고, 모두에게 같고, 나중에 온 사람도 같은 상태를 받고, 저장된다.
//   끄면 내가 있는 층이 어두워진다. 스스로 빛나는 것(스크린, 유도등, 트리 전구와 트리 둘레 빛, 창밖, 스위치의 작은 불)만 남는다.
//   하늘(sky.js)·점등식(party.js)과 싸우지 않게 값을 곱한다: 하늘이 정한 바탕값 × 점등식 배수 × 방 불 배수(app.js 의 setBright).
//   마당에 나가 있으면 1층 불이 꺼져 있어도 어두워지지 않는다(집 안의 불이라서).
//
// K = { room, S() 방 상태, level() 내가 있는 층, me, op(o), canEdit(), relight(hemi 배수, 해 배수), toast(m) }
import { THREE, put } from './kit.js';
import { CELL, X0, Z0, FLOOR_DI, LEVELS, cellOf, zoneOf } from './path.js';

// 스위치가 달린 칸(집 기준 a, j = 0: 북쪽 벽). 그 칸과 둘레 한 칸 안에 서면 누를 수 있다
export const SWITCH = [19, 27, 27, 27];
const DARK = [0.2, 0.04]; // 불을 껐을 때 [하늘빛, 햇빛]의 배수. 햇빛을 더 줄여 그림자가 옅어진다

export function makeLights(K) {
  const dots = [], levers = [];
  const plate = new THREE.BoxGeometry(0.13, 0.2, 0.02), lever = new THREE.BoxGeometry(0.04, 0.08, 0.03), dotG = new THREE.CircleGeometry(0.012, 10);
  for (let lv = 0; lv < LEVELS; lv++) {
    const w = K.room.floors[lv].walls.n, x = w.at(X0 + (SWITCH[lv] + 0.5) * CELL), z = w.front;
    put(plate, 0xF4EFE6, x, 1.25, z + 0.012, w.upper, false);
    levers.push(put(lever, 0xD8CFC0, x, 1.25, z + 0.03, w.upper, false));
    const d = put(dotG, new THREE.MeshBasicMaterial({ color: 0x7CFFB0 }), x, 1.13, z + 0.024, w.upper, false); // 어두울 때도 스위치를 찾게 해 주는 작은 불
    d.receiveShadow = false; d.visible = false;
    dots.push(d);
  }
  const isOn = (lv) => !!K.S().lamps[lv];
  let k = 1; // 지금 어두운 정도 (1 = 불이 켜진 밝기, 0 = 다 꺼진 밝기)
  // 내가 지금 어두운 곳에 있는지: 내가 있는 층의 불이 꺼져 있고, 마당이 아니다
  function dark() {
    const lv = K.level();
    if (isOn(lv)) return false;
    const [i, j] = cellOf(K.me.x, K.me.z);
    return zoneOf(i, j) !== 'yard';
  }
  function paint() {
    for (let lv = 0; lv < LEVELS; lv++) { const on = isOn(lv); dots[lv].visible = !on; levers[lv].rotation.x = on ? -0.35 : 0.35; }
  }
  function toggle(lv = K.level()) {
    if (!K.canEdit()) { K.toast('구경하는 중에는 불을 켜고 끌 수 없어요'); return false; }
    const on = !isOn(lv);
    if (!K.op({ t: 'lamp', lv, on })) return false;
    K.toast(on ? `💡 ${lv + 1}층 불을 켰어요` : `🌙 ${lv + 1}층 불을 껐어요`);
    return true;
  }
  return {
    paint, toggle, isOn,
    // 스위치 앞이면 할 수 있는 일 { label, run } (app.js 의 nearAction 이 쓴다)
    near() {
      const lv = K.level(), [i, j] = cellOf(K.me.x, K.me.z);
      if (j > 1 || Math.abs(i - lv * FLOOR_DI - SWITCH[lv]) > 1) return null;
      return { label: isOn(lv) ? '💡 불 끄기' : '💡 불 켜기', run: () => toggle(lv) };
    },
    // 방의 불 상태가 바뀌었다 (누가 켜고 껐거나, 방을 통째로 받았다)
    onOp(op, from) {
      paint();
      if (from === 'peer' && op && op.lv === K.level()) K.toast(op.on ? `💡 누가 ${op.lv + 1}층 불을 켰어요` : `🌙 누가 ${op.lv + 1}층 불을 껐어요`);
    },
    // 프레임마다: 밝기를 부드럽게 바꾼다. 바뀌었으면 true
    tick(dt) {
      const goal = dark() ? 0 : 1;
      if (k === goal) return false;
      k += (goal - k) * Math.min(1, dt * 5);
      if (Math.abs(goal - k) < 0.01) k = goal;
      K.relight(DARK[0] + (1 - DARK[0]) * k, DARK[1] + (1 - DARK[1]) * k);
      return true;
    },
    test: {
      get lamps() { return [...K.S().lamps]; }, get k() { return k; }, get dark() { return dark(); },
      get dots() { return dots.map((d) => d.visible); },
      // 층 lv 의 스위치 앞 자리 [x, z] (격자 좌표)
      spot: (lv) => [X0 + (lv * FLOOR_DI + SWITCH[lv] + 0.5) * CELL, Z0 + 0.5 * CELL + CELL],
    },
  };
}
