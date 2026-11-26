// Item registry. Order = the unlock ladder, from lame to awesome.
//
// Every item has:
//   id, name, blurb       - shown on the Item Board
//   type                  - 'touch' | 'swing' | 'talons' | 'launch' | 'spray'  (launch + spray not built yet)
//   create(scene)         - optional; returns { update(dt, grip), hits(target), dispose() }
//
// To add an item, see docs/ADDING-ITEMS.md.

import { wetNoodle } from './wetNoodle.js';
import { eagle } from './eagle.js';

export const bareHands = {
  id: 'hands',
  name: 'Bare Hands',
  type: 'touch',
  blurb: 'Tag the turkey with your hand.',
  create: null,
};

export const ITEMS = [bareHands, wetNoodle, eagle];

export function getItem(id) {
  return ITEMS.find((i) => i.id === id) || bareHands;
}
