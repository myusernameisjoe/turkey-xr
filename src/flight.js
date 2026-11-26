// Eagle flying for the fake yard (VR mode). No three.js here, so it's easy to test.
//
//   Left stick: glide like normal (src/locomotion.js does that part), just faster.
//   Hold A:     fly up.
//   Hold B:     fly down.
// When you stop being the eagle you float gently back down to the ground.

export const FLIGHT = {
  speed: 4, // left-stick glide speed while flying (m/s), faster than walking
  climbSpeed: 2, // up/down speed (m/s)
  maxHeight: 8, // how high you can fly (m). The yard looks tiny from up there.
  landSpeed: 1.5, // how fast you float down when you stop being the eagle (m/s)
};

// rig.y is how high the player is above the ground.
// input: { up, down } true while A / B are held. flying: true while you're the eagle.
export function stepFlight(rig, input, flying, dt, opts = FLIGHT) {
  rig.y = rig.y || 0;
  if (!flying) {
    rig.y = Math.max(0, rig.y - opts.landSpeed * dt);
    return rig;
  }
  const dir = (input.up ? 1 : 0) - (input.down ? 1 : 0);
  rig.y = Math.min(opts.maxHeight, Math.max(0, rig.y + dir * opts.climbSpeed * dt));
  return rig;
}
