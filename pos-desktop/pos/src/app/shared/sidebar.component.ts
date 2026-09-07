import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LangService } from '../core/lang.service';
import { ShopService } from '../core/shop.service';
import { ThemeService } from '../core/theme.service';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  styles: [`
    .sidebar { width: 230px; flex-shrink: 0; min-height: 100vh; position: sticky; top: 0; height: 100vh; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
    .side-nav { display: flex; flex-direction: column; gap: 4px; }
    .side-foot { display: flex; gap: 12px; margin-top: auto; padding-top: 12px; }
    .side-link { display: block; padding: .5rem .75rem; border-radius: 8px; cursor: pointer; color: inherit; text-decoration: none; font-weight: 500; }
    .side-link:hover { background: var(--bs-tertiary-bg); color: var(--shop-accent, var(--bs-primary)); }
    .side-link.active { background: var(--bs-primary-bg-subtle); color: var(--shop-accent, var(--bs-primary)); }
    .side-toggle { display: none; cursor: pointer; font-size: 1.4rem; }
    @media (max-width: 768px) {
      .sidebar { width: 100%; min-height: auto; height: auto; position: static; }
      .side-bar { display: flex; align-items: center; width: 100%; }
      .side-toggle { display: block; margin-inline-start: auto; }
      .side-nav, .side-foot { display: none; width: 100%; }
      .side-nav.open, .side-foot.open { display: flex; }
      .side-nav.open { flex-direction: column; }
      .side-foot.open { gap: 16px; padding: 8px 0 2px; }
      .side-link { padding: .5rem .25rem; }
    }
  `],
  template: `
    <aside class="sidebar shop-header border-end p-3">
      <div class="side-bar">
        <a routerLink="/" class="text-decoration-none d-flex align-items-center gap-2">
          @if (shop.logo()) {
            <img [src]="shop.logo()" alt="logo" width="40" height="40" style="object-fit:contain;border-radius:8px" />
          }
          <b>{{ shop.name() }}</b>
        </a>
        <span class="side-toggle" (click)="menuOpen.set(!menuOpen())">☰</span>
      </div>
      <nav class="side-nav" [class.open]="menuOpen()">
        <a routerLink="/" [routerLinkActiveOptions]="{ exact: true }" routerLinkActive="active" class="side-link" (click)="menuOpen.set(false)"><app-icon name="home" [size]="18" /> {{ lang.pick('Home', 'الرئيسية') }}</a>
        <a routerLink="/track" routerLinkActive="active" class="side-link" (click)="menuOpen.set(false)">{{ lang.pick('Track order', 'تتبع الطلب') }}</a>
        <a routerLink="/pos" routerLinkActive="active" class="side-link" (click)="menuOpen.set(false)"><app-icon name="pos" [size]="18" /> {{ lang.pick('POS', 'الكاشير') }}</a>
        <a routerLink="/orders" routerLinkActive="active" class="side-link" (click)="menuOpen.set(false)"><app-icon name="orders" [size]="18" /> {{ lang.pick('Orders', 'الطلبات') }}</a>
        <a routerLink="/kitchen" routerLinkActive="active" class="side-link" (click)="menuOpen.set(false)"><app-icon name="kitchen" [size]="18" /> {{ lang.pick('Kitchen', 'المطبخ') }}</a>
        <a routerLink="/admin" routerLinkActive="active" class="side-link" (click)="menuOpen.set(false)"><app-icon name="admin" [size]="18" /> {{ lang.pick('Admin', 'الإدارة') }}</a>
      </nav>
      <div class="side-foot" [class.open]="menuOpen()">
        <span class="side-link" (click)="theme.toggle()" title="Light / dark"><app-icon [name]="theme.theme() === 'dark' ? 'sun' : 'moon'" [size]="18" /></span>
        <span class="side-link" (click)="lang.toggle()">{{ lang.lang() === 'en' ? 'عربي' : 'English' }}</span>
      </div>
    </aside>`,
})
export class SidebarComponent {
  lang = inject(LangService);
  shop = inject(ShopService);
  theme = inject(ThemeService);
  menuOpen = signal(false);
}
