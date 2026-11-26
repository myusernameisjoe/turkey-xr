import { describe, it, expect } from 'vitest';
import { LOCO, createRig, stepRig } from '../src/locomotion.js';

const facingForward = { x: 0, z: 0, yaw: 0 }; // looking down -Z
const still = { moveX: 0, moveY: 0, turnX: 0 };

describe('joystick glide', () => {
  it('pushing forward moves where you look', () => {
    const rig = createRig();
    stepRig(rig, { ...still, moveY: -1 }, facingForward, 1);
    expect(rig.z).toBeCloseTo(-LOCO.speed);
    expect(rig.x).toBeCloseTo(0);
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

describe('snap turn', () => {
  it('one flick right turns 30 degrees right, once', () => {
    const rig = createRig();
    for (let i = 0; i < 10; i++) stepRig(rig, { ...still, turnX: 1 }, facingForward, 1 / 72);
    expect(rig.yaw).toBeCloseTo(-LOCO.snapAngle);
  });

  it('let go and flick again to turn again', () => {
    const rig = createRig();
    stepRig(rig, { ...still, turnX: -1 }, facingForward, 1 / 72);
    stepRig(rig, still, facingForward, 1 / 72);
    stepRig(rig, { ...still, turnX: -1 }, facingForward, 1 / 72);
    expect(rig.yaw).toBeCloseTo(2 * LOCO.snapAngle);
  });

  it('turns around your head, so your head stays put', () => {
    // Player stands 1 m to the right of the rig's center.
    const rig = createRig();
    const head = { x: 1, z: 0, yaw: 0 };
    stepRig(rig, { ...still, turnX: 1 }, head, 1 / 72);
    // Where does the head end up? Rotate its offset from the rig by the rig's new yaw.
    const local = { x: 1, z: 0 };
    const hx = rig.x + local.x * Math.cos(rig.yaw) + local.z * Math.sin(rig.yaw);
    const hz = rig.z - local.x * Math.sin(rig.yaw) + local.z * Math.cos(rig.yaw);
    expect(hx).toBeCloseTo(1);
    expect(hz).toBeCloseTo(0);
  });
});
