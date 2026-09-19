import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { LangService } from '../core/lang.service';
import { ShopService } from '../core/shop.service';
import { ThemeService } from '../core/theme.service';
import { AuthService } from '../core/auth.service';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  styles: [`
    .header { position: sticky; top: 0; z-index: 50; }
    .menu-link { cursor: pointer; color: inherit; text-decoration: none; font-weight: 500; }
    .menu-link:hover, .menu-link.active { color: var(--shop-accent, var(--bs-primary)); }
    .head-tools { display: flex; gap: 4px; align-items: center; margin-inline-start: 8px; }
    .header-action {
      display: inline-flex; align-items: center; justify-content: center; min-height: 36px;
      padding: 6px 9px; border: 0; border-radius: 9px; color: inherit; background: transparent;
      font: inherit; cursor: pointer;
    }
    .header-action:hover { color: var(--shop-accent, var(--bs-primary)); background: color-mix(in srgb, currentColor 8%, transparent); }
    .bottomnav { display: none; }
    @media (max-width: 768px) {
      .topnav { display: none !important; }
      .header-action { min-height: 34px; padding-inline: 7px; }
      .bottomnav {
        display: flex; position: fixed; bottom: 0; left: 0; right: 0; z-index: 60;
        background: var(--shop-header-bg, var(--bs-body-bg)); color: var(--shop-header-text, var(--bs-body-color));
        border-top: 1px solid var(--bs-border-color);
        padding: 6px 4px calc(6px + env(safe-area-inset-bottom));
      }
      .bottomnav a {
        flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;
        color: inherit; text-decoration: none; font-size: .68rem; font-weight: 500; opacity: .65;
      }
      .bottomnav a.active { opacity: 1; color: var(--shop-accent, var(--bs-primary)); }
    }
  `],
  template: `
    <header class="header shop-header border-bottom">
      <div class="container d-flex align-items-center py-2 flex-wrap gap-2">
        <a routerLink="/" class="text-decoration-none d-flex align-items-center gap-2" [attr.aria-label]="shop.name() + ' home'">
          @if (shop.logo()) {
            <img [src]="shop.logo()" alt="logo" width="36" height="36" style="object-fit:contain;border-radius:8px" />
          }
          <h2 class="mb-0">{{ shop.name() }}</h2>
        </a>
        <nav class="topnav ms-auto d-flex gap-3 align-items-center flex-wrap justify-content-end" [class.open]="menuOpen()">
          @if (auth.role() === 'guest') {
          <a routerLink="/" class="menu-link" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" (click)="menuOpen.set(false)">{{ lang.pick('Home', 'الرئيسية') }}</a>
          <a routerLink="/track" class="menu-link" routerLinkActive="active" (click)="menuOpen.set(false)">{{ lang.pick('Track order', 'تتبع الطلب') }}</a>
          }
          @if (auth.can('cashier')) {
          <a routerLink="/pos" class="menu-link" routerLinkActive="active" (click)="menuOpen.set(false)">{{ lang.pick('POS', 'الكاشير') }}</a>
          <a routerLink="/orders" class="menu-link" routerLinkActive="active" (click)="menuOpen.set(false)">{{ lang.pick('Orders', 'الطلبات') }}</a>
          }
          @if (auth.can('kitchen')) {
          <a routerLink="/kitchen" class="menu-link" routerLinkActive="active" (click)="menuOpen.set(false)">{{ lang.pick('Kitchen', 'المطبخ') }}</a>
          <a routerLink="/orders" class="menu-link" routerLinkActive="active" (click)="menuOpen.set(false)">{{ lang.pick('Orders', 'الطلبات') }}</a>
          }
          @if (auth.can('admin')) {
          <a routerLink="/" class="menu-link" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" (click)="menuOpen.set(false)">{{ lang.pick('Home', 'الرئيسية') }}</a>
          <a routerLink="/pos" class="menu-link" routerLinkActive="active" (click)="menuOpen.set(false)">{{ lang.pick('POS', 'الكاشير') }}</a>
          <a routerLink="/orders" class="menu-link" routerLinkActive="active" (click)="menuOpen.set(false)">{{ lang.pick('Orders', 'الطلبات') }}</a>
          <a routerLink="/kitchen" class="menu-link" routerLinkActive="active" (click)="menuOpen.set(false)">{{ lang.pick('Kitchen', 'المطبخ') }}</a>
          <a routerLink="/admin" class="menu-link" routerLinkActive="active" (click)="menuOpen.set(false)">{{ lang.pick('Admin', 'الإدارة') }}</a>
        }
        </nav>
        <span class="head-tools">
          <button type="button" class="header-action" (click)="theme.toggle()" [attr.aria-label]="theme.theme() === 'dark' ? 'Use light theme' : 'Use dark theme'" [title]="theme.theme() === 'dark' ? 'Use light theme' : 'Use dark theme'"><app-icon [name]="theme.theme() === 'dark' ? 'sun' : 'moon'" [size]="19" /></button>
          <button type="button" class="header-action" (click)="lang.toggle()" [attr.aria-label]="lang.lang() === 'en' ? 'Switch to Arabic' : 'Switch to English'">{{ lang.lang() === 'en' ? 'عربي' : 'English' }}</button>
          @if (auth.user(); as u) {
            <button type="button" class="header-action" (click)="logout()" [attr.aria-label]="'Log out ' + u.username" [title]="u.username + ' · log out'">⎋</button>
          }
        </span>
      </div>
    </header>
    <nav class="bottomnav">
      @if (auth.role() === 'guest') {
        <a routerLink="/" [routerLinkActiveOptions]="{ exact: true }" routerLinkActive="active"><app-icon name="home" [size]="22" />{{ lang.pick('Home', 'الرئيسية') }}</a>
        <a routerLink="/track" routerLinkActive="active"><app-icon name="track" [size]="22" />{{ lang.pick('Track', 'تتبع') }}</a>
      }
      @if (auth.can('cashier')) {
        <a routerLink="/pos" routerLinkActive="active"><app-icon name="pos" [size]="22" />{{ lang.pick('POS', 'الكاشير') }}</a>
        <a routerLink="/orders" routerLinkActive="active"><app-icon name="orders" [size]="22" />{{ lang.pick('Orders', 'الطلبات') }}</a>
      }
      @if (auth.can('kitchen')) {
        <a routerLink="/kitchen" routerLinkActive="active"><app-icon name="kitchen" [size]="22" />{{ lang.pick('Kitchen', 'المطبخ') }}</a>
        <a routerLink="/orders" routerLinkActive="active"><app-icon name="orders" [size]="22" />{{ lang.pick('Orders', 'الطلبات') }}</a>
      }
      @if (auth.can('admin')) {
        <a routerLink="/" [routerLinkActiveOptions]="{ exact: true }" routerLinkActive="active"><app-icon name="home" [size]="22" />{{ lang.pick('Home', 'الرئيسية') }}</a>
        <a routerLink="/pos" routerLinkActive="active"><app-icon name="pos" [size]="22" />{{ lang.pick('POS', 'الكاشير') }}</a>
        <a routerLink="/orders" routerLinkActive="active"><app-icon name="orders" [size]="22" />{{ lang.pick('Orders', 'الطلبات') }}</a>
        <a routerLink="/kitchen" routerLinkActive="active"><app-icon name="kitchen" [size]="22" />{{ lang.pick('Kitchen', 'المطبخ') }}</a>
        <a routerLink="/admin" routerLinkActive="active"><app-icon name="admin" [size]="22" />{{ lang.pick('Admin', 'الإدارة') }}</a>
      }
    </nav>`,
})
export class HeaderComponent {
  lang = inject(LangService);
  shop = inject(ShopService);
  theme = inject(ThemeService);
  auth = inject(AuthService);
  private router = inject(Router);
  menuOpen = signal(false);

  logout() {
    this.auth.logout();
    this.menuOpen.set(false);
    this.router.navigate(['/']);
  }
}
