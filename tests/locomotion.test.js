import { describe, it, expect } from 'vitest';
import { LOCO, PULL, createRig, stepRig, startPull, stepPull } from '../src/locomotion.js';

const facingForward = { x: 0, z: 0, yaw: 0 }; // looking down -Z
const still = { moveX: 0, moveY: 0, turnX: 0 };

describe('joystick glide', () => {
  it('pushing forward moves where you look', () => {
    const rig = createRig();
    stepRig(rig, { ...still, moveY: -1 }, facingForward, 1);
    expect(rig.z).toBeCloseTo(-LOCO.speed);
    expect(rig.x).toBeCloseTo(0);
  });

  it('invertY flips forward and back, but not left and right', () => {
    const opts = { ...LOCO, invertY: true };
    const rig = createRig();
    stepRig(rig, { ...still, moveY: 1 }, facingForward, 1, opts); // stick pulled back
    expect(rig.z).toBeCloseTo(-LOCO.speed); // ...moves forward
    const rig2 = createRig();
    stepRig(rig2, { ...still, moveX: 1 }, facingForward, 1, opts);
    expect(rig2.x).toBeCloseTo(LOCO.speed);
  });

  it('pushing right slides to your right', () => {
    const rig = createRig();
    stepRig(rig, { ...still, moveX: 1 }, facingForward, 1);
    expect(rig.x).toBeCloseTo(LOCO.speed);
    expect(rig.z).toBeCloseTo(0);
  });

  it('forward follows your head when you look left', () => {
    const rig = createRig();
    stepRig(rig, { ...still, moveY: -1 }, { x: 0, z: 0, yaw: Math.PI / 2 }, 1); // looking down -X
    expect(rig.x).toBeCloseTo(-LOCO.speed);
    expect(rig.z).toBeCloseTo(0);
  });

  it('ignores tiny stick wobble', () => {
    const rig = createRig();
    stepRig(rig, { ...still, moveX: 0.1, moveY: -0.1 }, facingForward, 1);
    expect(rig.x).toBe(0);
    expect(rig.z).toBe(0);
  });

  it('diagonals are not faster than straight', () => {
    const rig = createRig();
    stepRig(rig, { ...still, moveX: 1, moveY: -1 }, facingForward, 1);
    expect(Math.hypot(rig.x, rig.z)).toBeCloseTo(LOCO.speed);
  });
});

const SNAP = { ...LOCO, turnMode: 'snap' };

describe('smooth turn (default)', () => {
  it('full right stick turns right at turnSpeed, a little each frame', () => {
    const rig = createRig();
    stepRig(rig, { ...still, turnX: 1 }, facingForward, 1 / 72);
    expect(rig.yaw).toBeCloseTo(-LOCO.turnSpeed / 72);
    for (let i = 1; i < 72; i++) stepRig(rig, { ...still, turnX: 1 }, facingForward, 1 / 72);
    expect(rig.yaw).toBeCloseTo(-LOCO.turnSpeed); // one second
  });

  it('a gentle push turns slower, and tiny wobble does nothing', () => {
    const rig = createRig();
    stepRig(rig, { ...still, turnX: -0.6 }, facingForward, 1);
    expect(rig.yaw).toBeGreaterThan(0);
    expect(rig.yaw).toBeLessThan(LOCO.turnSpeed * 0.6);
    const still2 = createRig();
    stepRig(still2, { ...still, turnX: 0.1 }, facingForward, 1);
    expect(still2.yaw).toBe(0);
  });

  it('turns around your head, so your head stays put', () => {
    const rig = createRig();
    const head = { x: 1, z: 0, yaw: 0 };
    for (let i = 0; i < 36; i++) stepRig(rig, { ...still, turnX: 1 }, head, 1 / 72);
    const hx = rig.x + 1 * Math.cos(rig.yaw);
    const hz = rig.z - 1 * Math.sin(rig.yaw);
    expect(hx).toBeCloseTo(1);
    expect(hz).toBeCloseTo(0);
  });
});

describe('snap turn (?snap)', () => {
  it('one flick right turns 30 degrees right, once', () => {
    const rig = createRig();
    for (let i = 0; i < 10; i++) stepRig(rig, { ...still, turnX: 1 }, facingForward, 1 / 72, SNAP);
    expect(rig.yaw).toBeCloseTo(-LOCO.snapAngle);
  });

  it('let go and flick again to turn again', () => {
    const rig = createRig();
    stepRig(rig, { ...still, turnX: -1 }, facingForward, 1 / 72, SNAP);
    stepRig(rig, still, facingForward, 1 / 72, SNAP);
    stepRig(rig, { ...still, turnX: -1 }, facingForward, 1 / 72, SNAP);
    expect(rig.yaw).toBeCloseTo(2 * LOCO.snapAngle);
  });

  it('turns around your head, so your head stays put', () => {
    // Player stands 1 m to the right of the rig's center.
    const rig = createRig();
    const head = { x: 1, z: 0, yaw: 0 };
    stepRig(rig, { ...still, turnX: 1 }, head, 1 / 72, SNAP);
    // Where does the head end up? Rotate its offset from the rig by the rig's new yaw.
    const local = { x: 1, z: 0 };
    const hx = rig.x + local.x * Math.cos(rig.yaw) + local.z * Math.sin(rig.yaw);
    const hz = rig.z - local.x * Math.sin(rig.yaw) + local.z * Math.cos(rig.yaw);
    expect(hx).toBeCloseTo(1);
    expect(hz).toBeCloseTo(0);
  });
});

describe('whip grapple pull', () => {
  it('pulls you along the ground toward the crack, stopping a bit short', () => {
    const rig = createRig();
    expect(startPull(rig, { x: 0, z: 0 }, { x: 0, z: -3 })).toBe(true);
    let moved = { x: 0, z: 0 };
    for (let i = 0; i < 100; i++) {
      const m = stepPull(rig, 1 / 72);
      if (!m) break;
      moved.x += m.dx;
      moved.z += m.dz;
    }
    expect(rig.pull).toBe(null);
    expect(moved.x).toBeCloseTo(0);
    expect(moved.z).toBeCloseTo(-(3 - PULL.stopShort));
  });

  it('never pulls further than maxDistance, and ignores cracks right at your feet', () => {
    const rig = createRig();
    startPull(rig, { x: 0, z: 0 }, { x: 20, z: 0 });
    expect(rig.pull.left).toBeCloseTo(PULL.maxDistance);
    expect(startPull(createRig(), { x: 0, z: 0 }, { x: 0.4, z: 0 })).toBe(false);
  });
});
