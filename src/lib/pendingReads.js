const scopes = new WeakMap();

// Share only concurrent reads. Settled responses and failures are never cached.
// Callers include authenticated user and tenant in their resource key.
export function sharePendingRead(scope, key, read) {
  let pending = scopes.get(scope);
  if (!pending) { pending = new Map(); scopes.set(scope, pending); }
  if (!pending.has(key)) {
    const request = Promise.resolve().then(read).finally(() => {
      if (pending.get(key) === request) pending.delete(key);
    });
    pending.set(key, request);
  }
  return pending.get(key);
}
