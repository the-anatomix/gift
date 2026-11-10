// 자르기 자리. app.js 가 kit(도구 모음)를 넘겨 부른다. 규칙은 stations/README.md 참고.
export default function (kit) {
  const { THREE, scene, put, rbox, cyl, C, TOP_Y } = kit;

  const g = new THREE.Group(); g.position.set(-0.95, TOP_Y, 0.75); scene.add(g);
  put(rbox(0.86, 0.05, 0.6, 0.02), C.wood, 0, 0.025, 0, g);
  put(rbox(0.36, 0.022, 0.42, 0.01), C.dough, -0.2, 0.061, 0, g);
  for (let i = 0; i < 3; i++) put(rbox(0.045, 0.024, 0.42, 0.01), C.dough, 0.06 + i * 0.075, 0.062, 0, g);
  const k = new THREE.Group(); k.position.set(0.34, 0.06, 0.02); k.rotation.y = -0.15; g.add(k);
  put(new THREE.BoxGeometry(0.05, 0.008, 0.26), C.metal, 0, 0, -0.08, k);
  put(rbox(0.04, 0.024, 0.14, 0.01), C.dark, 0, 0.004, 0.12, k);

  return {
    // panel(p, ui) {}, enter() {}, leave() {}, down(i) {}, move(i) {}, up(i) {}, apply(d) {}, get() {}, set(v) {},
  };
}
