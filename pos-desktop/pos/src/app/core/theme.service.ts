import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  theme = signal<'light' | 'dark'>('light');
  private listeners: (() => void)[] = [];

  onChange(fn: () => void) {
    this.listeners.push(fn);
  }

  init() {
    const saved = localStorage.getItem('shop_theme');
    this.set(saved === 'dark' ? 'dark' : 'light', true);
  }
  toggle() {
    this.set(this.theme() === 'dark' ? 'light' : 'dark');
  }
  set(t: 'light' | 'dark', silent = false) {
    this.theme.set(t);
    localStorage.setItem('shop_theme', t);
    document.documentElement.setAttribute('data-bs-theme', t);
    if (!silent) this.listeners.forEach((fn) => fn());
  }
}
