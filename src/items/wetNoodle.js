import * as THREE from 'three';
import { createNoodleSim } from './noodleSim.js';
import { swingHits } from '../combat.js';

// SWING item: a floppy pool-noodle-ish wet noodle. Long reach, but you have to swing it.
export const wetNoodle = {
  id: 'wet-noodle',
  name: 'Wet Noodle',
  type: 'swing',
  blurb: 'Floppy. Long reach. Swing it fast to bonk the turkey.',
  hitRadius: 0.25, // how close the noodle must pass to the turkey's body (m)
  minSwingSpeed: 1.5, // m/s; just touching it doesn't count
  create,
};

function create(scene) {
  const sim = createNoodleSim({ segments: 10, length: 1.0, stiffness: 0.07, gravity: 9.8 });
  const material = new THREE.MeshStandardMaterial({ color: 0xf3e3a0, roughness: 0.25, metalness: 0.0 });
  let mesh = null;
  const curvePoints = sim.points.map(() => new THREE.Vector3());
  const curve = new THREE.CatmullRomCurve3(curvePoints);

  const anchor = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const quat = new THREE.Quaternion();

  function update(dt, grip) {
    grip.getWorldPosition(anchor);
    grip.getWorldQuaternion(quat);
    // Grip space -Z runs along the controller handle, out of the top of the fist, like a sword.
    dir.set(0, 0, -1).applyQuaternion(quat);
    sim.step(anchor, dir, dt);

    sim.points.forEach((p, i) => curvePoints[i].set(p.x, p.y, p.z));
    const geometry = new THREE.TubeGeometry(curve, 24, 0.022, 8, false);
    if (mesh) {
      mesh.geometry.dispose();
      mesh.geometry = geometry;
    } else {
      mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      scene.add(mesh);
    }
  }

  /** target: {x,y,z} centre of the turkey's body. */
  function hits(target) {
    return swingHits(sim.points, sim.speeds, target, wetNoodle.hitRadius, wetNoodle.minSwingSpeed);
  }

  function dispose() {
    if (mesh) {
      scene.remove(mesh);
      mesh.geometry.dispose();
    }
    material.dispose();
  }

  return { update, hits, dispose, sim };
}
