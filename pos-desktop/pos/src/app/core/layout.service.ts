import { Injectable, signal } from '@angular/core';

// Shop-wide navigation style, driven by Admin -> Settings (backend settings.layout).
// ShopService pushes the value on load/refresh.
@Injectable({ providedIn: 'root' })
export class LayoutService {
  layout = signal<'topbar' | 'sidebar'>('topbar');

  init() {
    // no-op: server value arrives via ShopService
  }
  set(l: 'topbar' | 'sidebar') {
    this.layout.set(l);
  }
}
