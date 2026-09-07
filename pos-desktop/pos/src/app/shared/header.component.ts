import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LangService } from '../core/lang.service';
import { ShopService } from '../core/shop.service';
import { ThemeService } from '../core/theme.service';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, IconComponent],
  styles: [`
    .menu-link { cursor: pointer; color: inherit; text-decoration: none; font-weight: 500; }
    .menu-link:hover { color: var(--shop-accent, var(--bs-primary)); }
    .menu-toggle { display: none; cursor: pointer; font-size: 1.4rem; }
    @media (max-width: 768px) {
      .menu-toggle { display: block; margin-inline-start: auto; }
      .topnav { display: none !important; width: 100%; flex-direction: column; align-items: flex-start !important; gap: 10px !important; padding: 8px 0 4px; }
      .topnav.open { display: flex !important; }
    }
  `],
  template: `
    <header class="header shop-header border-bottom">
      <div class="container d-flex align-items-center py-2 flex-wrap gap-2">
        <a routerLink="/" class="text-decoration-none d-flex align-items-center gap-2">
          @if (shop.logo()) {
            <img [src]="shop.logo()" alt="logo" width="36" height="36" style="object-fit:contain;border-radius:8px" />
          }
          <h2 class="mb-0">{{ shop.name() }}</h2>
        </a>
        <nav class="topnav ms-auto d-flex gap-3 align-items-center flex-wrap justify-content-end" [class.open]="menuOpen()">
          <a routerLink="/" class="menu-link" (click)="menuOpen.set(false)">{{ lang.pick('Home', 'الرئيسية') }}</a>
          <a routerLink="/track" class="menu-link" (click)="menuOpen.set(false)">{{ lang.pick('Track order', 'تتبع الطلب') }}</a>
          <a routerLink="/pos" class="menu-link" (click)="menuOpen.set(false)">{{ lang.pick('POS', 'الكاشير') }}</a>
          <a routerLink="/orders" class="menu-link" (click)="menuOpen.set(false)">{{ lang.pick('Orders', 'الطلبات') }}</a>
          <a routerLink="/kitchen" class="menu-link" (click)="menuOpen.set(false)">{{ lang.pick('Kitchen', 'المطبخ') }}</a>
          <a routerLink="/admin" class="menu-link" (click)="menuOpen.set(false)">{{ lang.pick('Admin', 'الإدارة') }}</a>
          <span class="menu-link" (click)="theme.toggle()" title="Light / dark"><app-icon [name]="theme.theme() === 'dark' ? 'sun' : 'moon'" [size]="18" /></span>
          <span class="menu-link" (click)="lang.toggle()">{{ lang.lang() === 'en' ? 'عربي' : 'English' }}</span>
        </nav>
        <span class="menu-toggle" (click)="menuOpen.set(!menuOpen())"><app-icon name="menu" [size]="22" /></span>
      </div>
    </header>`,
})
export class HeaderComponent {
  lang = inject(LangService);
  shop = inject(ShopService);
  theme = inject(ThemeService);
  menuOpen = signal(false);
}
