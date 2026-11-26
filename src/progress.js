// Unlock + equip state, saved on the device. Pure logic; storage is injected so tests can fake it.

const KEY = 'turkey-xr-progress-v2';

export function createProgress(unlocks, storage = safeStorage()) {
  const state = load(storage);

  function save() {
    try {
      storage?.setItem(KEY, JSON.stringify(state));
    } catch {
      /* private mode etc.; progress just won't persist */
    }
  }

  function required(itemId) {
    return unlocks.find((u) => u.item === itemId)?.catches ?? null;
  }

  const progress = {
    get equipped() {
      return state.equipped;
    },
    get totalCatches() {
      return state.totalCatches;
    },
    /** Catches needed to unlock an item (null if it has no unlock rule). */
    required,
    isUnlocked(itemId) {
      if (itemId === 'hands') return true;
      const n = required(itemId);
      return n !== null && state.totalCatches >= n;
    },
    /** Count a catch. Returns the ids of items this catch just unlocked. */
    recordCatch() {
      const before = state.totalCatches;
      state.totalCatches++;
      save();
      return unlocks.filter((u) => u.catches > before && u.catches <= state.totalCatches).map((u) => u.item);
    },
    equip(itemId) {
      if (!progress.isUnlocked(itemId)) return false;
      state.equipped = itemId;
      save();
      return true;
    },
    reset() {
      state.totalCatches = 0;
      state.equipped = 'hands';
      save();
    },
  };
  return progress;
}

function load(storage) {
  try {
    const raw = storage?.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return {
        totalCatches: Number.isFinite(s.totalCatches) ? s.totalCatches : 0,
        equipped: typeof s.equipped === 'string' ? s.equipped : 'hands',
      };
    }
  } catch {
    /* ignore */
  }
  return { totalCatches: 0, equipped: 'hands' };
}

function safeStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
