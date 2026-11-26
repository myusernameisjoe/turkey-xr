import * as THREE from 'three';
import { BOSS } from './bossBrain.js';

// The three-headed boss turkey, built from simple shapes at full size (about 2 m tall).
// Heads sit where BOSS.heads says, so the punches line up with what you see.
// Also makes the health bar that floats over it.

const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.8 });

export function createBossModel() {
  const root = new THREE.Group();
  root.name = 'boss';
  root.visible = false;

  const brown = mat(0x4a2c14);
  const darkBrown = mat(0x2e1a0a);
  const tan = mat(0xc89a5a);
  const orange = mat(0xd98a1f);
  const red = mat(0xc0262b);
  const blueGrey = mat(0x8fa6b8);
  const beakMat = mat(0xe6c35c);
  const allMats = [brown, darkBrown, tan, orange, red, blueGrey, beakMat];

  const body = new THREE.Group();
  root.add(body);
  const torso = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), brown);
  torso.scale.set(0.5, 0.48, 0.62);
  torso.position.y = BOSS.bodyHeight;
  body.add(torso);

  // Big tail fan.
  const tail = new THREE.Group();
  tail.position.set(0, BOSS.bodyHeight + 0.15, -0.5);
  tail.rotation.x = -0.35;
  body.add(tail);
  for (let i = 0; i < 11; i++) {
    const a = (i / 10 - 0.5) * Math.PI * 0.95;
    const pivot = new THREE.Group();
    pivot.rotation.z = a;
    const feather = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.85, 0.04), i % 2 ? brown : darkBrown);
    feather.position.y = 0.42;
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.045), tan);
    tip.position.y = 0.42;
    feather.add(tip);
    pivot.add(feather);
    tail.add(pivot);
  }

  // Wings.
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), darkBrown);
    wing.scale.set(0.12, 0.32, 0.5);
    wing.position.set(side * 0.46, BOSS.bodyHeight, -0.05);
    body.add(wing);
  }

  // Three necks and heads. Each head is a group we can bob on its own.
  const neckBase = new THREE.Vector3(0, BOSS.bodyHeight + 0.3, 0.3);
  const heads = BOSS.heads.map((h, i) => {
    const pivot = new THREE.Group(); // rotates at the base of the neck
    pivot.position.copy(neckBase);
    body.add(pivot);
    const tip = new THREE.Vector3(h.x, h.y, h.z).sub(neckBase);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, tip.length(), 10), blueGrey);
    neck.position.copy(tip).multiplyScalar(0.5);
    neck.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tip.clone().normalize());
    pivot.add(neck);
    const head = new THREE.Group();
    head.position.copy(tip);
    pivot.add(head);
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), blueGrey));
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.15, 8), beakMat);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, -0.01, 0.18);
    head.add(beak);
    const wattle = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), red);
    wattle.scale.set(0.06, 0.11, 0.06);
    wattle.position.set(0, -0.15, 0.08);
    head.add(wattle);
    for (const side of [-1, 1]) {
      // Angry eyebrows! It's a boss.
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), mat(0x111111));
      eye.position.set(side * 0.08, 0.04, 0.1);
      head.add(eye);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.015, 0.015), darkBrown);
      brow.position.set(side * 0.08, 0.085, 0.11);
      brow.rotation.z = side * -0.4;
      head.add(brow);
    }
    return { pivot, head, phase: i * 2.1 };
  });

  // Legs.
  const legs = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.18, 0.55, 0);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 8), orange);
    shin.position.y = -0.27;
    hip.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.22), orange);
    foot.position.set(0, -0.54, 0.05);
    hip.add(foot);
    root.add(hip);
    legs.push(hip);
  }

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.75, 28),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.005;
  root.add(shadow);

  // Health bar, floating over the boss. main.js turns it to face you.
  const bar = createHealthBar();
  bar.mesh.position.y = 2.35;
  root.add(bar.mesh);

  let walk = 0;
  let lastHealth = -1;

  function animate(b, dt) {
    root.position.set(b.x, 0, b.z);
    body.rotation.set(0, 0, 0);
    if (b.health !== lastHealth) {
      bar.draw(b.health, b.maxHealth);
      lastHealth = b.health;
    }
    // Flash red right after a hit.
    const flashing = b.flash > 0;
    for (const m of allMats) m.emissive.setHex(flashing ? 0x880000 : 0x000000);

    if (b.mode === 'defeated') {
      // Topple over sideways.
      const t = Math.min(1, b.timer * 2);
      body.rotation.z = t * (Math.PI / 2) * 0.9;
      body.position.y = -t * 0.35;
      legs.forEach((l) => (l.rotation.x = -t * 1.2));
      return;
    }
    body.position.y = 0;
    root.rotation.y = b.heading;
    walk += dt * (1 + b.speed * 8);
    legs[0].rotation.x = Math.sin(walk) * 0.5 * Math.min(1, b.speed * 2);
    legs[1].rotation.x = -legs[0].rotation.x;
    body.position.y = Math.abs(Math.sin(walk)) * 0.04 * Math.min(1, b.speed * 2);
    for (const h of heads) {
      h.phase += dt;
      if (b.mode === 'peck') {
        // All three heads lunge at you.
        const p = Math.sin((1 - b.timer / BOSS.peckSeconds) * Math.PI);
        h.pivot.rotation.x = p * 0.7;
        h.pivot.rotation.z = 0;
      } else {
        // Each head bobs and looks around on its own.
        h.pivot.rotation.x = Math.sin(h.phase * 2.3) * 0.12;
        h.pivot.rotation.z = Math.sin(h.phase * 1.1) * 0.15;
      }
    }
  }

  return { root, animate, bar };
}

/** A health bar drawn on a canvas: "BOSS", a red bar, and the numbers. */
function createHealthBar() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 0.3),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
  );
  function draw(health, max) {
    ctx.clearRect(0, 0, 512, 128);
    ctx.fillStyle = 'rgba(20, 14, 8, 0.8)';
    ctx.beginPath();
    ctx.roundRect(0, 0, 512, 128, 24);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`TRIPLE TURKEY  ${health} / ${max}`, 256, 12);
    ctx.fillStyle = '#3b2412';
    ctx.fillRect(24, 64, 464, 44);
    ctx.fillStyle = health > max * 0.3 ? '#e03b2e' : '#ff8a00';
    ctx.fillRect(24, 64, 464 * (health / max), 44);
    texture.needsUpdate = true;
  }
  return { mesh, draw };
}
