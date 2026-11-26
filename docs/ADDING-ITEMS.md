# Adding items and unlocks

The game has an **item ladder** (lame → awesome). Items unlock by **catching turkeys**: the total
count starts at 0 every time the page loads, so items must be earned again each game
(add `?save` to the URL to keep the count on the headset between visits). A newly unlocked item goes
straight into your hand; press **A** or **X** to open the Item Board and swap.

## Change when items unlock (no coding)

Edit `src/unlocks.js`:

```js
export const UNLOCKS = [
  { item: 'wet-noodle', catches: 1 },
  { item: 'frying-pan', catches: 5 },   // must match an item id in src/items/index.js
];
```

## Add an item

1. Copy `src/items/wetNoodle.js` to `src/items/<yourItem>.js`.
2. Change `id`, `name`, `blurb`, and tune the numbers: `length`, `hitRadius`, `minSwingSpeed`,
   and what a hit does: `effect: 'stun'` (with `stunSeconds` and `knockback` in metres), or `effect: 'catch'`.
   Stun is the fun default: the turkey is knocked back, sees stars, and you have to run over and tag it.
3. Change what it looks like in `create()`. It gets `update(dt, grip)` every frame with the
   controller it's held in, and `hits(target)` should return `true` when it hits the turkey.
4. Add it to the `ITEMS` list in `src/items/index.js`, in ladder order.
5. Add a line for it in `src/unlocks.js` saying how many catches unlock it.

### Item types

| Type | Status | How it hits | Ideas |
| --- | --- | --- | --- |
| `touch` | done | hand touches the turkey | bare hands |
| `swing` | done (wet noodle) | a moving stick/chain passes through the turkey fast enough (`swingHits` in `src/combat.js`) | frying pan, baguette, pool noodle, whip that yanks the turkey to you (tried 2026-11-26, shelved) |
| `talons` | done (eagle, at 2 catches) | not held: your hands become eagle feet. Grip grabs the turkey (`grabWithTalons` in `src/turkeyBrain.js`), A/B fly up/down (`src/flight.js`), drop it from 1.2 m+ and it lands dizzy, then touch it | |
| `launch` | to build | pull back + release, projectile flies with gravity | slingshot, cranberry cannon, water balloons |
| `spray` | to build | anything in a cone in front of the hand | leaf blower, flamethrower, gravy hose |

When building `launch` or `spray`, add the hit math to `src/combat.js` with a unit test, like `swingHits`.

## Test it

```sh
npm test           # unit tests (fast)
npm run test:e2e   # plays the game in the headset emulator
```

On desktop, open `/?emulate&save`. To unlock everything while testing, run this in the browser console and reload:

```js
localStorage.setItem('turkey-xr-progress-v2', JSON.stringify({ totalCatches: 99, equipped: 'wet-noodle' }))
```

To reset saved progress (only matters with `?save`): `localStorage.removeItem('turkey-xr-progress-v2')`, or add `&reset` to the URL.
