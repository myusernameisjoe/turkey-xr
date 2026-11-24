import * as THREE from 'three';
import { createNoodleSim } from './noodleSim.js';
import { swingHits } from '../combat.js';

// SWING item: a floppy pool-noodle-ish wet noodle. Long reach, but you have to swing it.
export const wetNoodle = {
  id: 'wet-noodle',
  name: 'Wet Noodle',
  type: 'swing',
  blurb: 'Long and floppy. Swing it to bonk the turkey dizzy, then tag it.',
  length: 1.6, // metres of noodle
  hitRadius: 0.3, // how close the noodle must pass to the turkey's body (m)
  minSwingSpeed: 1.5, // m/s; just touching it doesn't count
  effect: 'stun', // what a hit does: 'stun' or 'catch'
  stunSeconds: 2.5,
  knockback: 1.0, // metres the turkey gets knocked away
  create,
};

function create(scene) {
  const sim = createNoodleSim({ segments: 14, length: wetNoodle.length, stiffness: 0.07, gravity: 9.8 });
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
    const geometry = new THREE.TubeGeometry(curve, 32, 0.022, 8, false);
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
