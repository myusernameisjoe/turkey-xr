import * as THREE from 'three';

// Fake front yard for VR mode and the desktop preview. Hidden in AR (passthrough) mode.
export function createYard(areaRadius) {
  const yard = new THREE.Group();
  yard.name = 'yard';

  const grass = new THREE.Mesh(
    new THREE.CircleGeometry(areaRadius + 14, 64),
    new THREE.MeshStandardMaterial({ color: 0x4f8a3a, roughness: 1 }),
  );
  grass.rotation.x = -Math.PI / 2;
  yard.add(grass);

  // Sidewalk and street on one side.
  const walk = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 1.4),
    new THREE.MeshStandardMaterial({ color: 0xb9b4a8, roughness: 1 }),
  );
  walk.rotation.x = -Math.PI / 2;
  walk.position.set(0, 0.01, areaRadius + 2);
  yard.add(walk);

  // House behind the play area.
  const house = new THREE.Group();
  house.position.set(0, 0, -areaRadius - 5);
  const walls = new THREE.Mesh(new THREE.BoxGeometry(9, 3.2, 6), new THREE.MeshStandardMaterial({ color: 0xd8c8a8 }));
  walls.position.y = 1.6;
  house.add(walls);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(6.4, 2.2, 4), new THREE.MeshStandardMaterial({ color: 0x6b3b2a }));
  roof.position.y = 4.3;
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, 0.75);
  house.add(roof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.1, 0.05), new THREE.MeshStandardMaterial({ color: 0x7a2e1f }));
  door.position.set(0, 1.05, 3.01);
  house.add(door);
  yard.add(house);

  // Picket fence around the play area.
  const picketGeo = new THREE.BoxGeometry(0.09, 0.9, 0.03);
  const picketMat = new THREE.MeshStandardMaterial({ color: 0xf4f1ea });
  const count = Math.floor((2 * Math.PI * (areaRadius + 0.6)) / 0.18);
  const pickets = new THREE.InstancedMesh(picketGeo, picketMat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const r = areaRadius + 0.6;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
    m.compose(new THREE.Vector3(Math.sin(a) * r, 0.45, Math.cos(a) * r), q, new THREE.Vector3(1, 1, 1));
    pickets.setMatrixAt(i, m);
  }
  yard.add(pickets);

  // A few trees.
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3d26 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6b2a });
  for (const [x, z, s] of [[-areaRadius - 3, -2, 1.2], [areaRadius + 3, 1, 1], [areaRadius + 2, -areaRadius, 1.4]]) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * s, 0.2 * s, 2 * s, 8), trunkMat);
    trunk.position.set(x, s, z);
    const leaves = new THREE.Mesh(new THREE.SphereGeometry(1.2 * s, 12, 10), leafMat);
    leaves.position.set(x, 2.3 * s, z);
    yard.add(trunk, leaves);
  }

  return yard;
}

/** Faint ring showing the play area edge; shown in every mode. */
export function createAreaRing(areaRadius) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(areaRadius - 0.04, areaRadius, 96),
    new THREE.MeshBasicMaterial({ color: 0xffcc33, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  return ring;
}
