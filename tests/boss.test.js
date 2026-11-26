import { describe, it, expect } from 'vitest';
import { BOSS, createBoss, stepBoss, bossTargets, hitBoss } from '../src/bossBrain.js';

describe('three-headed boss', () => {
  it('starts with 10,000 health, 5 m in front of you, facing you', () => {
    const b = createBoss({ x: 0, z: 0, yaw: 0 }); // looking toward -z
    expect(b.health).toBe(10000);
    expect(b.x).toBeCloseTo(0);
    expect(b.z).toBeCloseTo(-5);
    expect(b.heading).toBeCloseTo(0); // heading 0 faces +z, toward you
  });

  it('walks slowly up to you, pecks, then hops back', () => {
    const b = createBoss({ x: 0, z: 0, yaw: 0 });
    const player = { x: 0, z: 0 };
    let t = 0;
    let event = null;
    while (!event && t < 20) {
      event = stepBoss(b, player, 0.05);
      t += 0.05;
    }
    expect(event).toBe('peck');
    expect(t).toBeGreaterThan(6); // 3.6 m at 0.5 m/s: slow enough to fight sitting down
    expect(Math.hypot(b.x, b.z)).toBeCloseTo(BOSS.peckDistance, 1);
    for (let i = 0; i < 20; i++) stepBoss(b, player, 0.05); // finish the peck
    expect(b.mode).toBe('walk');
    expect(Math.hypot(b.x, b.z)).toBeGreaterThan(BOSS.peckDistance + 1);
  });

  it('body punches do 50, head punches do 100', () => {
    const b = createBoss({ x: 0, z: 0, yaw: 0 });
    hitBoss(b, false);
    expect(b.health).toBe(9950);
    hitBoss(b, true);
    expect(b.health).toBe(9850);
  });

  it('takes 200 body punches (or 100 head punches) to beat', () => {
    const b = createBoss({ x: 0, z: 0, yaw: 0 });
    let won = false;
    let n = 0;
    while (!won) {
      won = hitBoss(b, false);
      n++;
    }
    expect(n).toBe(200);
    expect(b.mode).toBe('defeated');
    expect(hitBoss(b, true)).toBe(false); // no more damage once it's down
    expect(b.health).toBe(0);
  });

  it('has three heads up high, on the side facing you', () => {
    const b = createBoss({ x: 0, z: 0, yaw: 0 }); // at z = -5, facing +z
    const targets = bossTargets(b);
    const heads = targets.filter((t) => t.head);
    expect(heads).toHaveLength(3);
    for (const h of heads) {
      expect(h.y).toBeGreaterThan(1.4);
      expect(h.z).toBeGreaterThan(b.z); // in front of the body, toward you
    }
    const body = targets.find((t) => !t.head);
    expect(body).toMatchObject({ x: b.x, z: b.z, y: BOSS.bodyHeight });
  });

  it('stands still while defeated', () => {
    const b = createBoss({ x: 0, z: 0, yaw: 0 });
    b.health = 50;
    hitBoss(b, false);
    const z = b.z;
    stepBoss(b, { x: 0, z: 0 }, 1);
    expect(b.z).toBe(z);
  });
});
