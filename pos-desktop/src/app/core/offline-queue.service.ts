// core/offline-queue.service.ts - simplified offline queue logic (framework-agnostic)
const KEY = 'pos_offline_orders';

export function enqueueOfflineOrder(payload: unknown) {
  const q = JSON.parse(localStorage.getItem(KEY) || '[]');
  q.push({ payload, ts: Date.now() });
  localStorage.setItem(KEY, JSON.stringify(q));
}

export async function flushOfflineQueue(apiBase: string) {
  const q = JSON.parse(localStorage.getItem(KEY) || '[]') as { payload: any }[];
  const remaining: typeof q = [];
  for (const entry of q) {
    try {
      const r = await fetch(`${apiBase}/orders`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry.payload),
      });
      if (!r.ok) remaining.push(entry);
    } catch {
      remaining.push(entry);
    }
  }
  localStorage.setItem(KEY, JSON.stringify(remaining));
  return { synced: q.length - remaining.length, pending: remaining.length };
}
