import { Injectable } from '@angular/core';

const SESSION_TIMEOUT = 2 * 60 * 60 * 1000;
const SESSION_KEY = 'pos_order_session';
const CACHE_KEY = 'pos_order_cache';

@Injectable({ providedIn: 'root' })
export class CacheService {
  private cacheKey = CACHE_KEY;

  getCache(): Record<string, any[]> {
    try {
      const raw = localStorage.getItem(this.cacheKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  setCache(phone: string, orders: any[]) {
    this.clearExpired();
    const cache = this.getCache();
    cache[phone] = orders;
    try {
      localStorage.setItem(this.cacheKey, JSON.stringify(cache));
    } catch {}
  }

  getCachedOrders(phone: string): any[] {
    this.clearExpired();
    const session = this.getSession(phone);
    if (!session) return [];
    return this.getCache()[phone] || [];
  }

  hasCachedOrders(phone: string): boolean {
    this.clearExpired();
    return this.getCachedOrders(phone).length > 0;
  }

  isWithinSession(phone: string): boolean {
    return !!this.getSession(phone);
  }

  getRemainingMs(phone: string): number {
    const session = this.getSession(phone);
    if (!session) return 0;
    return Math.max(0, session.expiresAt - Date.now());
  }

  getRemainingHours(phone: string): number {
    return Math.ceil(this.getRemainingMs(phone) / (60 * 60 * 1000));
  }

  getSessionTime(phone: string): string | null {
    const session = this.getSession(phone);
    if (!session) return null;
    return new Date(session.startedAt).toLocaleString();
  }

  removeCache(phone: string) {
    const cache = this.getCache();
    delete cache[phone];
    try {
      localStorage.setItem(this.cacheKey, JSON.stringify(cache));
    } catch {}
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {}
  }

  addToCache(order: any, phone: string) {
    this.clearExpired();
    const cache = this.getCache();
    if (!cache[phone]) cache[phone] = [];
    if (!cache[phone].some((o: any) => o.id === order.id)) {
      cache[phone].unshift(order);
    }
    try {
      localStorage.setItem(this.cacheKey, JSON.stringify(cache));
    } catch {}
    this.ensureSession(phone);
  }

  getAllCachedPhones(): string[] {
    this.clearExpired();
    return Object.keys(this.getCache());
  }

  getAllCachedOrders(): any[] {
    this.clearExpired();
    const cache = this.getCache();
    const all: any[] = [];
    Object.values(cache).forEach((orders: any[]) => {
      all.push(...orders);
    });
    return all;
  }

  getCachedOrderById(orderId: string): any | null {
    this.clearExpired();
    const cache = this.getCache();
    for (const phone of Object.keys(cache)) {
      const order = cache[phone].find((o: any) => o.id === orderId);
      if (order) return order;
    }
    return null;
  }

  isTracked(orderId: string): string | null {
    this.clearExpired();
    const cache = this.getCache();
    for (const phone of Object.keys(cache)) {
      if (cache[phone].some((o: any) => o.id === orderId)) return phone;
    }
    return null;
  }

  clearExpired() {
    const session = this.getSessionData();
    if (!session) return;
    if (Date.now() > session.expiresAt) {
      try {
        localStorage.removeItem(this.cacheKey);
        localStorage.removeItem(SESSION_KEY);
      } catch {}
    }
  }

  private ensureSession(phone: string) {
    const session = this.getSessionData();
    const now = Date.now();
    if (!session || session.expiresAt < now) {
      this.setSessionData({ phone, startedAt: now, expiresAt: now + SESSION_TIMEOUT });
    }
  }

  private getSession(phone: string): { startedAt: number; expiresAt: number } | null {
    const session = this.getSessionData();
    if (!session || session.expiresAt < Date.now()) return null;
    if (session.phone !== phone) return null;
    return session;
  }

  private getSessionData(): { phone: string; startedAt: number; expiresAt: number } | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private setSessionData(data: { phone: string; startedAt: number; expiresAt: number }) {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    } catch {}
  }
}
