# Turkey Chase (turkey-xr)

A WebXR game for Meta Quest: a turkey is loose in the yard, and you chase it down and tag it with a controller.

**Play:** open https://myusernameisjoe.github.io/turkey-xr/ in the Quest Browser and tap **Play in my yard (AR)** (passthrough) or **Play in a fake yard (VR)**.

- No developer mode, sideloading, or install needed. It's a web page.
- `?easy` makes the turkey slower and lets you tag it from standing height (no crouching). Easy mode is on automatically with `?emulate`; add `&hard` to turn it off.
- `?area=10` makes the play area a 10 m radius (default 6 m). The yellow ring on the ground marks the edge.
- The turkey wanders and pecks, sprints away when you're within about 2.5 m, and gets tired after about 4 s of sprinting. Tag it with either controller to score. It gobbles (spatial audio) so you can find it by ear.

## Items and quests

Press **A** or **X** to open the Item Board. Items unlock by doing real-world tasks: the person in the task tells you a secret word. The first one is the **Wet Noodle** (shake Grandpa's hand; tell Grandpa the word from `src/quests.js` first). Swing it fast to bonk the turkey. See [docs/ADDING-ITEMS.md](docs/ADDING-ITEMS.md) to add more.

`?reset` clears unlocked items.

## Desktop testing (no headset)

- Open the page with `?emulate`, e.g. https://myusernameisjoe.github.io/turkey-xr/?emulate. That loads Meta's IWER emulator with an on-screen control panel for the emulated Quest 3 headset and controllers.
- Emulator controls: click the ▶ Play mode button, look with the mouse, hold Left Shift + W/A/S/D to walk, Esc to release the mouse. In easy mode, walk the controllers over the turkey to tag it. Press Enter (the A button) for the Item Board; with Play mode on, put the red dot on a button and left-click.
- Or install Meta's **Immersive Web Emulator** Chrome extension and open the plain URL.

## Development

```sh
npm install
npm run dev        # local dev server (https needed for a real headset; use the Pages URL for that)
npm test           # unit tests for turkey behaviour
npm run test:e2e   # plays the game in the emulator in headless Chromium
```

Every push to `main` runs the tests and deploys to GitHub Pages. To put a branch on the Pages URL for headset testing before merging, run the "Test and deploy" workflow by hand on that branch.

## Layout

- `src/turkeyBrain.js`: turkey behaviour (wander, peck, flee, tire, catch). Pure JS, unit-tested.
- `src/turkeyModel.js`: the turkey built from primitives, with procedural walk animation.
- `src/main.js`: renderer, XR sessions, controllers, catch detection, score.
- `src/yard.js`: fake yard for VR and the desktop preview (hidden in AR).
- `src/audio.js`: synthesized gobble and chime.
- `src/emulator.js`: IWER emulator, loaded only with `?emulate`.
