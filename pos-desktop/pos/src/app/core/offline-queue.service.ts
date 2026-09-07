import { Injectable } from '@angular/core';

const KEY = 'pos_offline_orders';

@Injectable({ providedIn: 'root' })
export class OfflineQueueService {
  enqueue(payload: unknown) {
    const q = JSON.parse(localStorage.getItem(KEY) || '[]');
    q.push({ payload, ts: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(q));
  }
  pending(): number {
    return (JSON.parse(localStorage.getItem(KEY) || '[]') as unknown[]).length;
  }
  async flush(apiBase: string): Promise<{ synced: number; pending: number }> {
    const q = JSON.parse(localStorage.getItem(KEY) || '[]') as { payload: any }[];
    const remaining: typeof q = [];
    let synced = 0;
    for (const entry of q) {
      try {
        const r = await fetch(`${apiBase}/orders`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry.payload),
        });
        if (r.ok) synced++; else remaining.push(entry);
      } catch { remaining.push(entry); }
    }
    localStorage.setItem(KEY, JSON.stringify(remaining));
    return { synced, pending: remaining.length };
  }
}
