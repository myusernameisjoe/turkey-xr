// Unlock + equip state, saved on the device. Pure logic; storage is injected so tests can fake it.

const KEY = 'turkey-xr-progress-v1';
export const WRONG_GUESS_LOCKOUT = 10; // seconds before you can guess again

export function createProgress(quests, storage = safeStorage()) {
  const state = load(storage);

  function save() {
    try {
      storage?.setItem(KEY, JSON.stringify({ unlocked: state.unlocked, equipped: state.equipped }));
    } catch {
      /* private mode etc.; progress just won't persist */
    }
  }

  return {
    get equipped() {
      return state.equipped;
    },
    isUnlocked(itemId) {
      return itemId === 'hands' || state.unlocked.includes(itemId);
    },
    questFor(itemId) {
      return quests.find((q) => q.unlocks === itemId) || null;
    },
    /** Shuffled answer choices for a quest. */
    choices(quest, rng = Math.random) {
      const all = [quest.word, ...quest.decoys];
      for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [all[i], all[j]] = [all[j], all[i]];
      }
      return all;
    },
    lockoutRemaining(now) {
      return Math.max(0, (state.lockedUntil - now) / 1000);
    },
    /** Returns 'unlocked' | 'wrong' | 'locked-out'. now = ms timestamp. */
    guess(quest, word, now) {
      if (now < state.lockedUntil) return 'locked-out';
      if (word.trim().toLowerCase() === quest.word.trim().toLowerCase()) {
        if (!state.unlocked.includes(quest.unlocks)) state.unlocked.push(quest.unlocks);
        save();
        return 'unlocked';
      }
      state.lockedUntil = now + WRONG_GUESS_LOCKOUT * 1000;
      return 'wrong';
    },
    equip(itemId) {
      if (!this.isUnlocked(itemId)) return false;
      state.equipped = itemId;
      save();
      return true;
    },
    reset() {
      state.unlocked = [];
      state.equipped = 'hands';
      state.lockedUntil = 0;
      save();
    },
  };
}

function load(storage) {
  try {
    const raw = storage?.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return { unlocked: Array.isArray(s.unlocked) ? s.unlocked : [], equipped: s.equipped || 'hands', lockedUntil: 0 };
    }
  } catch {
    /* ignore */
  }
  return { unlocked: [], equipped: 'hands', lockedUntil: 0 };
}

function safeStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
