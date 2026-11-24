// Floppy noodle physics: a chain of points (Verlet integration) hanging off the hand.
// Pure JS so it can be unit-tested; the three.js mesh just draws these points.

export function createNoodleSim({ segments = 10, length = 1.0, stiffness = 0.12, damping = 0.94, gravity = 6 } = {}) {
  const segLen = length / segments;
  const n = segments + 1;
  const pos = Array.from({ length: n }, () => ({ x: 0, y: 0, z: 0 }));
  const prev = Array.from({ length: n }, () => ({ x: 0, y: 0, z: 0 }));
  const speeds = new Array(n).fill(0);
  let initialized = false;

  /**
   * anchor: {x,y,z} hand position. dir: unit {x,y,z} the hand points along.
   */
  function step(anchor, dir, dt) {
    if (dt <= 0) return;
    if (!initialized) {
      for (let i = 0; i < n; i++) {
        const p = { x: anchor.x + dir.x * segLen * i, y: anchor.y + dir.y * segLen * i, z: anchor.z + dir.z * segLen * i };
        Object.assign(pos[i], p);
        Object.assign(prev[i], p);
      }
      initialized = true;
    }
    const k = Math.min(1, stiffness * dt * 72); // frame-rate independent-ish
    for (let i = 1; i < n; i++) {
      const p = pos[i], q = prev[i];
      const vx = (p.x - q.x) * damping, vy = (p.y - q.y) * damping, vz = (p.z - q.z) * damping;
      q.x = p.x; q.y = p.y; q.z = p.z;
      p.x += vx;
      p.y += vy - gravity * dt * dt;
      p.z += vz;
      // Weak pull toward the straight "rest" pose so it stays noodle-shaped, not a rope.
      const s = k * (1 - i / (n * 1.6));
      p.x += (anchor.x + dir.x * segLen * i - p.x) * s;
      p.y += (anchor.y + dir.y * segLen * i - p.y) * s;
      p.z += (anchor.z + dir.z * segLen * i - p.z) * s;
    }
    // Pin the base to the hand.
    const prevBase = { ...pos[0] };
    Object.assign(pos[0], anchor);
    Object.assign(prev[0], prevBase);
    // Keep segment lengths.
    for (let iter = 0; iter < 4; iter++) {
      for (let i = 1; i < n; i++) {
        const a = pos[i - 1], b = pos[i];
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        const d = Math.hypot(dx, dy, dz) || 1e-6;
        const f = (d - segLen) / d;
        if (i === 1) {
          b.x -= dx * f; b.y -= dy * f; b.z -= dz * f;
        } else {
          a.x += dx * f * 0.5; a.y += dy * f * 0.5; a.z += dz * f * 0.5;
          b.x -= dx * f * 0.5; b.y -= dy * f * 0.5; b.z -= dz * f * 0.5;
        }
      }
    }
    // Don't go through the ground.
    for (let i = 1; i < n; i++) if (pos[i].y < 0.02) pos[i].y = 0.02;
    for (let i = 0; i < n; i++) {
      speeds[i] = Math.hypot(pos[i].x - prev[i].x, pos[i].y - prev[i].y, pos[i].z - prev[i].z) / dt;
    }
  }

  return { points: pos, speeds, step, segLen };
}
