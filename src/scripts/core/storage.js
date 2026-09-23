// localStorage/sessionStorage that never throws (private mode, blocked storage, quota).

function make(kind) {
  const area = () => {
    try {
      return window[kind];
    } catch {
      return null;
    }
  };
  return {
    get(key, fallback = null) {
      try {
        const raw = area()?.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        area()?.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
    remove(key) {
      try {
        area()?.removeItem(key);
      } catch {
        /* storage unavailable */
      }
    }
  };
}

export const local = make('localStorage');
export const session = make('sessionStorage');
