import { expect, test } from 'bun:test';
import {
  interpolateMotion,
  motionSpeed,
  pushFix,
  type MotionTrack,
} from './mapMotion';

function travel(from: number, to: number, stepMs: number, fixEveryMs: number, squaresPerFix: number) {
  let track: MotionTrack | null = null;
  let nextFixAt = 0;

  const samples: Array<{ at: number; x: number }> = [];
  for (let now = 0; now <= to; now += stepMs) {
    while (nextFixAt <= now) {
      track = pushFix(track, { x: (nextFixAt / fixEveryMs) * squaresPerFix, y: 0 }, nextFixAt);
      nextFixAt += fixEveryMs;
    }
    if (now >= from) samples.push({ at: now, x: interpolateMotion(track!, now).point.x });
  }
  return samples;
}

test('steady motion advances by an even amount every frame', () => {
  const samples = travel(200, 500, 16, 100, 3);
  const steps: number[] = [];
  for (let i = 1; i < samples.length; i++) {
    steps.push(samples[i]!.x - samples[i - 1]!.x);
  }

  const total = samples[samples.length - 1]!.x - samples[0]!.x;
  const average = total / steps.length;
  expect(average).toBeGreaterThan(0);
  for (const step of steps) {
    expect(Math.abs(step - average)).toBeLessThanOrEqual(average * 0.25);
  }
});

test('a fix beyond the snap distance jumps straight to the new position', () => {
  let track = pushFix(null, { x: 0, y: 0 }, 0);
  track = pushFix(track, { x: 100, y: 0 }, 100);

  expect(interpolateMotion(track, 150).point).toEqual({ x: 100, y: 0 });
  expect(motionSpeed(track, 150)).toBe(0);
});

test('a stale feed holds at the newest fix', () => {
  let track = pushFix(null, { x: 0, y: 0 }, 0);
  track = pushFix(track, { x: 3, y: 0 }, 100);

  expect(interpolateMotion(track, 2000)).toEqual({ point: { x: 3, y: 0 }, settled: true });
  expect(motionSpeed(track, 2000)).toBe(0);
});

test('motion settles on the last fix once movement stops', () => {
  let track = pushFix(null, { x: 0, y: 0 }, 0);
  track = pushFix(track, { x: 3, y: 0 }, 100);

  expect(interpolateMotion(track, 150).settled).toBe(false);
  expect(interpolateMotion(track, 200)).toEqual({ point: { x: 3, y: 0 }, settled: true });
});

test('speed comes from the displacement between the last two fixes', () => {
  let track = pushFix(null, { x: 0, y: 0 }, 0);
  track = pushFix(track, { x: 3, y: 0 }, 100);

  expect(motionSpeed(track, 120)).toBeCloseTo(30);
});
