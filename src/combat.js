// Hit-testing math shared by item types. Pure JS (plain {x, y, z} objects) so it can be unit-tested.

/** Distance from point c to the segment a-b. */
export function segmentPointDistance(a, b, c) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const acx = c.x - a.x, acy = c.y - a.y, acz = c.z - a.z;
  const len2 = abx * abx + aby * aby + abz * abz;
  let t = len2 > 0 ? (acx * abx + acy * aby + acz * abz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const dx = a.x + abx * t - c.x;
  const dy = a.y + aby * t - c.y;
  const dz = a.z + abz * t - c.z;
  return Math.hypot(dx, dy, dz);
}

/**
 * Swing hit: does any segment of a moving chain pass within `radius` of `target`
 * while moving faster than `minSpeed` (m/s)?
 * points: [{x,y,z}], speeds: [number] (speed of each point).
 */
export function swingHits(points, speeds, target, radius, minSpeed) {
  for (let i = 0; i < points.length - 1; i++) {
    const speed = Math.max(speeds[i], speeds[i + 1]);
    if (speed < minSpeed) continue;
    if (segmentPointDistance(points[i], points[i + 1], target) < radius) return true;
  }
  return false;
}

/**
 * Ground crack (the whip's grapple): is the tip of the chain slapping the ground fast?
 * Returns the {x, z} spot it hit, or null.
 * points/speeds like swingHits. maxHeight: how close to the ground (m) the tip must be.
 */
export function groundCrack(points, speeds, minSpeed, maxHeight = 0.1) {
  const tip = points[points.length - 1];
  if (tip.y > maxHeight) return null;
  if (speeds[speeds.length - 1] < minSpeed) return null;
  return { x: tip.x, z: tip.z };
}
