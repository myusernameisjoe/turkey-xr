# turkey-xr

WebXR game (three.js + Vite) for Meta Quest, played in Quest Browser via GitHub Pages.

- Primary target is AR (passthrough) outdoors in a large backyard, `local-floor` reference space, flat ground at y=0. VR "fake yard" mode is for desktop/emulator testing and as a fallback.
- Keep game logic out of three.js where practical (see `src/turkeyBrain.js`) so it stays unit-testable.
- Check changes with `npm test` and `npm run test:e2e` (IWER emulator in headless Chromium). The e2e tests read `window.__game` and drive `window.__xrDevice`; keep those hooks working.
- Things only a real headset can verify: scale, comfort, passthrough look, audio, how it feels to chase. Say so when a change depends on these.
- Planned v2: slingshot (two-handed pull and release, physics projectile). Keep the catch mechanic separate from turkey behaviour so it can be swapped or added to.
