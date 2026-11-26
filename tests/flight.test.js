import { describe, it, expect } from 'vitest';
import { FLIGHT, stepFlight } from '../src/flight.js';

describe('eagle flight', () => {
  it('A goes up, B goes down, and you stop at the ground and the sky limit', () => {
    const rig = { y: 0 };
    stepFlight(rig, { up: true }, true, 1);
    expect(rig.y).toBeCloseTo(FLIGHT.climbSpeed);
    stepFlight(rig, { down: true }, true, 0.5);
    expect(rig.y).toBeCloseTo(FLIGHT.climbSpeed / 2);
    stepFlight(rig, { down: true }, true, 10);
    expect(rig.y).toBe(0);
    stepFlight(rig, { up: true }, true, 100);
    expect(rig.y).toBe(FLIGHT.maxHeight);
    stepFlight(rig, { up: true, down: true }, true, 1); // both: hover
    expect(rig.y).toBe(FLIGHT.maxHeight);
  });

  it('floats back down when you are not the eagle', () => {
    const rig = { y: 3 };
    stepFlight(rig, { up: true }, false, 1);
    expect(rig.y).toBeCloseTo(3 - FLIGHT.landSpeed);
    stepFlight(rig, {}, false, 10);
    expect(rig.y).toBe(0);
  });
});
