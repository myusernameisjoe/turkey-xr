// Joystick movement for the fake yard (VR mode). No three.js here, so it's easy to test.
//
// The "rig" is the player's spot in the yard: where they stand (x, z) and which
// way the whole world is turned (yaw). Walking in real life still works too; the
// sticks just move the rig on top of that.
//
//   Left stick:  glide in the direction you push (forward = where you're looking).
//   Right stick: flick left/right to turn in quick 30-degree steps.

export const LOCO = {
  speed: 2.5, // meters per second at full stick (a brisk walk)
  deadzone: 0.2, // ignore tiny stick wobble
  snapAngle: Math.PI / 6, // 30 degrees per flick
  turnPush: 0.6, // how far to push the right stick before it turns
  turnRelease: 0.3, // let go past this before the next turn
};

export function createRig() {
  return { x: 0, z: 0, yaw: 0, turnArmed: true };
}

// input: { moveX, moveY, turnX } stick values from -1 to 1 (pushing forward makes moveY negative).
// head:  { x, z, yaw } where the player's head is in the world and which way it faces.
export function stepRig(rig, input, head, dt, opts = LOCO) {
  // Glide.
  let sx = input.moveX || 0;
  let sy = input.moveY || 0;
  const len = Math.hypot(sx, sy);
  if (len > opts.deadzone) {
    if (len > 1) {
      sx /= len;
      sy /= len;
    }
    const fx = -Math.sin(head.yaw); // forward, flat on the ground
    const fz = -Math.cos(head.yaw);
    const rx = Math.cos(head.yaw); // right
    const rz = -Math.sin(head.yaw);
    const step = opts.speed * dt;
    rig.x += (rx * sx - fx * sy) * step;
    rig.z += (rz * sx - fz * sy) * step;
  }

  // Snap turn, spinning around the player's head so they don't swing sideways.
  const tx = input.turnX || 0;
  if (rig.turnArmed && Math.abs(tx) > opts.turnPush) {
    const a = -Math.sign(tx) * opts.snapAngle; // push right = turn right
    const dx = rig.x - head.x;
    const dz = rig.z - head.z;
    rig.x = head.x + dx * Math.cos(a) + dz * Math.sin(a);
    rig.z = head.z - dx * Math.sin(a) + dz * Math.cos(a);
    rig.yaw += a;
    rig.turnArmed = false;
  } else if (Math.abs(tx) < opts.turnRelease) {
    rig.turnArmed = true;
  }
  return rig;
}
