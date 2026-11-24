import { test, expect } from '@playwright/test';

// Plays the game in Meta's IWER headset emulator (emulated Quest 3) in headless Chromium.

async function enter(page, buttonId) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?emulate&nodevui');
  await expect(page.locator(buttonId)).toBeEnabled({ timeout: 15_000 });
  await page.click(buttonId);
  await page.waitForFunction(() => document.body.classList.contains('in-xr'), null, { timeout: 15_000 });
  return errors;
}

test('desktop preview loads without errors and the turkey moves', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.waitForFunction(() => window.__game);
  const a = await page.evaluate(() => ({ x: window.__game.turkey.x, z: window.__game.turkey.z }));
  await page.waitForTimeout(1500);
  const b = await page.evaluate(() => ({ x: window.__game.turkey.x, z: window.__game.turkey.z }));
  expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(0.05);
  await page.screenshot({ path: 'test-results/preview.png' });
  expect(errors).toEqual([]);
});

for (const mode of ['vr', 'ar']) {
  test(`${mode.toUpperCase()}: tagging the turkey with a controller scores a point`, async ({ page }) => {
    const errors = await enter(page, `#enter-${mode}`);
    expect(await page.evaluate(() => window.__game.mode)).toBe(mode);

    // Controllers should be connected and reported.
    await page.waitForFunction(() => window.__game.hands.length === 2, null, { timeout: 10_000 });

    // Chase: each animation frame, put the right controller on the turkey's back.
    await page.evaluate(() => {
      const device = window.__xrDevice;
      const step = () => {
        const t = window.__game.turkey;
        const h = window.__game.hands[1];
        if (h && window.__game.score === 0) {
          // Correct for any offset between IWER's global space and the game's local-floor space.
          const c = device.controllers.right.position;
          c.x += t.x - h.x;
          c.y += window.__game.cfg.bodyHeight - h.y;
          c.z += t.z - h.z;
        }
        if (window.__game.score === 0) requestAnimationFrame(step);
      };
      step();
    });
    await page.waitForFunction(() => window.__game.score >= 1, null, { timeout: 15_000 });
    expect(await page.evaluate(() => window.__game.turkey.mode)).toBe('caught');
    await page.screenshot({ path: `test-results/${mode}-caught.png` });
    expect(errors).toEqual([]);
  });
}

test('turkey runs from the player in VR', async ({ page }) => {
  await enter(page, '#enter-vr');
  // Walk the headset to just behind the turkey.
  await page.evaluate(() => {
    const t = window.__game.turkey;
    const p = window.__xrDevice.position;
    p.x = t.x + 1.0;
    p.z = t.z + 1.0;
  });
  await page.waitForFunction(() => window.__game.turkey.mode === 'flee', null, { timeout: 5_000 });
});
