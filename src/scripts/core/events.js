// Minimal pub/sub shared by the modules on a page.

const handlers = new Map();

export function emit(name, detail) {
  (handlers.get(name) || []).slice().forEach((fn) => {
    try {
      fn(detail);
    } catch (err) {
      console.error(`[gg] handler for ${name} failed`, err);
    }
  });
}

export function subscribe(name, fn) {
  if (!handlers.has(name)) handlers.set(name, []);
  handlers.get(name).push(fn);
  return () => handlers.set(name, (handlers.get(name) || []).filter((h) => h !== fn));
}
