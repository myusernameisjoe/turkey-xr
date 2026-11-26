import * as THREE from 'three';

// A turkey built from primitive shapes, animated procedurally.
// Faces +z. Feet at y = 0. Roughly 0.6 m tall.

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });

export function createTurkeyModel() {
  const root = new THREE.Group();
  root.name = 'turkey';

  const brown = mat(0x5b3a1e);
  const darkBrown = mat(0x3b2412);
  const tan = mat(0xc89a5a);
  const orange = mat(0xd98a1f);
  const red = mat(0xc0262b);
  const blueGrey = mat(0x8fa6b8);
  const beakMat = mat(0xe6c35c);

  const body = new THREE.Group();
  body.position.y = 0.35;
  root.add(body);

  const torso = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), brown);
  torso.scale.set(0.2, 0.19, 0.26);
  body.add(torso);

  // Wings
  const wings = [];
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), darkBrown);
    wing.scale.set(0.05, 0.13, 0.2);
    wing.position.set(side * 0.18, 0.01, -0.02);
    wing.rotation.z = side * 0.15;
    body.add(wing);
    wings.push(wing);
  }

  // Tail fan
  const tail = new THREE.Group();
  tail.position.set(0, 0.05, -0.2);
  tail.rotation.x = -0.35;
  body.add(tail);
  const feathers = 9;
  for (let i = 0; i < feathers; i++) {
    const a = ((i / (feathers - 1)) - 0.5) * Math.PI * 0.95;
    const pivot = new THREE.Group();
    pivot.rotation.z = a;
    const feather = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.34, 0.02), i % 2 ? brown : darkBrown);
    feather.position.y = 0.17;
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.021), tan);
    tip.position.y = 0.17;
    feather.add(tip);
    pivot.add(feather);
    tail.add(pivot);
  }

  // Neck and head
  const neck = new THREE.Group();
  neck.position.set(0, 0.1, 0.17);
  body.add(neck);
  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.2, 10), blueGrey);
  neckMesh.position.y = 0.1;
  neckMesh.rotation.x = 0.35;
  neck.add(neckMesh);

  const head = new THREE.Group();
  head.position.set(0, 0.2, 0.05);
  neck.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 10), blueGrey);
  head.add(skull);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.06, 8), beakMat);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, -0.005, 0.07);
  head.add(beak);
  const snood = new THREE.Mesh(new THREE.CapsuleGeometry(0.01, 0.05, 4, 8), red);
  snood.position.set(0.01, 0.0, 0.07);
  head.add(snood);
  const wattle = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), red);
  wattle.scale.set(0.025, 0.045, 0.025);
  wattle.position.set(0, -0.06, 0.03);
  head.add(wattle);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 6), mat(0x111111));
    eye.position.set(side * 0.042, 0.015, 0.03);
    head.add(eye);
  }

  // Legs (pivot at hip)
  const legs = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.07, 0.22, 0);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6), orange);
    shin.position.y = -0.11;
    hip.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.08), orange);
    foot.position.set(0, -0.22, 0.02);
    hip.add(foot);
    root.add(hip);
    legs.push(hip);
  }

  // Cheap blob shadow (works in passthrough without shadow maps).
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.28, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.005;
  root.add(shadow);

  // Dizzy stars that circle the head when stunned.
  const stars = new THREE.Group();
  stars.position.set(0, 0.78, 0.12);
  stars.visible = false;
  const starMat = new THREE.MeshBasicMaterial({ color: 0xffe14d });
  for (let i = 0; i < 4; i++) {
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.035), starMat);
    const a = (i / 4) * Math.PI * 2;
    star.position.set(Math.cos(a) * 0.13, 0, Math.sin(a) * 0.13);
    stars.add(star);
  }
  root.add(stars);

  let phase = 0;
  let dizzy = 0;
  let celebrate = 0;

  /** Animate the model from the brain state. */
  function animate(state, dt) {
    const speed = state.speed;
    phase += dt * (2 + speed * 9);
    const stride = Math.min(1, speed / 1.2);

    legs[0].rotation.x = Math.sin(phase) * 0.7 * stride;
    legs[1].rotation.x = -Math.sin(phase) * 0.7 * stride;
    body.position.y = 0.35 + Math.abs(Math.sin(phase)) * 0.03 * stride;
    body.rotation.x = 0.15 * Math.min(1, speed / 2.6); // lean forward when running

    // Head bob, or pecking at the ground.
    if (state.mode === 'peck') {
      const p = (Math.sin(phase * 1.5) + 1) / 2;
      neck.rotation.x = 0.4 + p * 0.9;
    } else {
      neck.rotation.x = Math.sin(phase * 2) * 0.12 * stride - 0.05;
    }

    // Tail: flared when fleeing or caught.
    const flare = state.mode === 'flee' || state.mode === 'caught' ? 1.25 : 1;
    tail.scale.lerp(new THREE.Vector3(flare, flare, 1), Math.min(1, dt * 6));

    // Dizzy wobble.
    stars.visible = state.mode === 'stunned';
    if (state.mode === 'stunned') {
      dizzy += dt;
      stars.rotation.y += dt * 5;
      stars.children.forEach((st, i) => (st.rotation.y += dt * (4 + i)));
      body.rotation.z = Math.sin(dizzy * 7) * 0.25;
      neck.rotation.x = 0.6 + Math.sin(dizzy * 5) * 0.2;
      neck.rotation.z = Math.sin(dizzy * 4) * 0.4;
    } else {
      dizzy = 0;
      body.rotation.z = 0;
      neck.rotation.z = 0;
    }

    // Grabbed by the eagle (or falling): flap wings and kick legs in a panic.
    const panicking = state.mode === 'carried' || state.mode === 'falling';
    wings.forEach((w, i) => {
      const side = i === 0 ? -1 : 1;
      w.rotation.z = panicking ? side * (0.6 + Math.sin(phase * 3) * 0.6) : side * 0.15;
    });
    if (panicking) {
      phase += dt * 10;
      legs[0].rotation.x = Math.sin(phase * 1.3) * 0.9;
      legs[1].rotation.x = -Math.sin(phase * 1.3) * 0.9;
    }
    const lift = state.y || 0;

    if (state.mode === 'caught') {
      celebrate += dt;
      root.position.y = lift + Math.abs(Math.sin(celebrate * 9)) * 0.15;
      root.rotation.y = state.heading + celebrate * 6;
    } else {
      celebrate = 0;
      root.position.y = lift;
      root.rotation.y = state.heading;
    }
    shadow.position.y = 0.005 - root.position.y; // the shadow stays on the ground
    shadow.scale.setScalar(1 / (1 + lift * 0.4)); // and shrinks when it's up high
    root.position.x = state.x;
    root.position.z = state.z;
  }

  return { root, animate };
}
