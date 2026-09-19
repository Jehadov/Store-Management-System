import { Injectable, signal, computed } from '@angular/core';

export interface StaffUser {
  id: string;
  username: string;
  role: 'admin' | 'cashier' | 'kitchen';
}

/**
 * Who is looking at the app right now:
 * - guest (customer): home, product, track only
 * - cashier: POS + orders
 * - kitchen: kitchen board
 * - admin: everything
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  user = signal<StaffUser | null>(null);
  role = computed(() => this.user()?.role || 'guest');

  constructor() {
    this.restore();
  }

  restore() {
    try {
      const raw = localStorage.getItem('pos_user');
      this.user.set(raw ? (JSON.parse(raw) as StaffUser) : null);
      if (!localStorage.getItem('pos_token')) this.user.set(null);
    } catch {
      this.user.set(null);
    }
  }

  login(token: string, user: StaffUser) {
    localStorage.setItem('pos_token', token);
    localStorage.setItem('pos_user', JSON.stringify(user));
    this.user.set(user);
  }

  logout() {
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_user');
    this.user.set(null);
  }

  can(...roles: StaffUser['role'][]): boolean {
    const r = this.user()?.role;
    return !!r && roles.includes(r);
  }

  homeFor(user: StaffUser): string {
    if (user.role === 'kitchen') return '/kitchen';
    if (user.role === 'cashier') return '/pos';
    return '/admin';
  }
}
