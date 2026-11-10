// 굽기 자리. app.js 가 kit(도구 모음)를 넘겨 부른다. 규칙은 stations/README.md 참고.
export default function (kit) {
  const { THREE, scene, put, rbox, cyl, C, TOP_Y } = kit;

  const g = new THREE.Group(); g.position.set(-1.3, TOP_Y, -1.72); scene.add(g);
  put(rbox(1.0, 0.62, 0.62, 0.07), C.accent, 0, 0.36, 0, g);
  put(rbox(0.62, 0.42, 0.04, 0.03), C.dark, -0.14, 0.36, 0.3, g, false);
  put(new THREE.BoxGeometry(0.5, 0.3, 0.02), new THREE.MeshBasicMaterial({ color: C.ovenGlow }), -0.14, 0.35, 0.318, g, false);
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
    const s = put(cyl(0.032, 0.032, 0.5, 10), C.biscuit, -0.22 + i * 0.15, 0.125, (i % 2) * 0.03, r);
    s.rotation.x = Math.PI / 2; s.rotation.z = (i - 1.5) * 0.04;
  }

  return {
    // panel(p, ui) {}, enter() {}, leave() {}, down(i) {}, move(i) {}, up(i) {}, apply(d) {}, get() {}, set(v) {},
  };
}
