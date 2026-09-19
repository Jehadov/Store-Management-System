import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { LangService } from './lang.service';
import { ApiService } from './api.service';
import { ThemeService } from './theme.service';

export interface ThemePalette {
  headerBg: string;
  headerText: string;
  footerBg: string;
  footerText: string;
  accent: string;
}

export interface ShopTheme {
  light: ThemePalette;
  dark: ThemePalette;
}

export const DEFAULT_THEME: ShopTheme = {
  light: { headerBg: '#ffffff', headerText: '#18181b', footerBg: '#f4f4f5', footerText: '#52525b', accent: '#0d6efd' },
  dark: { headerBg: '#18181b', headerText: '#f8f9fa', footerBg: '#101014', footerText: '#a1a1aa', accent: '#60a5fa' },
};

export interface ShopSettings {
  name_en: string;
  name_ar: string;
  logo_url: string;
  layout: 'topbar' | 'sidebar';
  loyalty_earn_per_jd: number;
  loyalty_jd_per_point: number;
  theme: ShopTheme;
  phones: string[];
}

@Injectable({ providedIn: 'root' })
export class ShopService {
  private http = inject(HttpClient);
  private api = inject(ApiService);
  private lang = inject(LangService);
  private themeSvc = inject(ThemeService);
  base = `http://${window.location.hostname}:4000/api`;

  settings = signal<ShopSettings>({
    name_en: 'My Restaurant', name_ar: 'مطعمي', logo_url: '', layout: 'topbar',
    loyalty_earn_per_jd: 1, loyalty_jd_per_point: 0.05,
    theme: DEFAULT_THEME, phones: [],
  });
  loaded = signal(false);

  constructor() {
    this.themeSvc.onChange(() => this.applyTheme());
  }

  load() {
    if (this.loaded()) return;
    this.loaded.set(true);
    this.http.get<any>(`${this.base}/settings`).subscribe({
      next: (s) => this.apply({ ...s, theme: this.mergeTheme(s.theme) }),
      error: () => undefined,
    });
  }

  refresh() {
    this.loaded.set(false);
    this.load();
  }

  private mergeTheme(t: any): ShopTheme {
    return {
      light: { ...DEFAULT_THEME.light, ...(t?.light || {}) },
      dark: { ...DEFAULT_THEME.dark, ...(t?.dark || {}) },
    };
  }

  private apply(s: ShopSettings) {
    this.settings.set({ ...s, theme: this.mergeTheme((s as any).theme) });
    document.title = this.lang.pick(s.name_en, s.name_ar);
    if (s.logo_url) {
      const link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
      if (link) link.href = this.api.img(s.logo_url);
    }
    this.applyTheme();
  }

  /** Paint header/footer/accent from the palette of the active mode */
  applyTheme() {
    const mode = this.themeSvc.theme();
    const pal = this.settings().theme?.[mode] || (DEFAULT_THEME as any)[mode];
    const root = document.documentElement.style;
    root.setProperty('--shop-header-bg', pal.headerBg);
    root.setProperty('--shop-header-text', pal.headerText);
    root.setProperty('--shop-footer-bg', pal.footerBg);
    root.setProperty('--shop-footer-text', pal.footerText);
    root.setProperty('--shop-accent', pal.accent);
  }

  name(): string {
    const s = this.settings();
    return this.lang.pick(s.name_en, s.name_ar);
  }

  logo(): string | null {
    const u = this.settings().logo_url;
    return u ? this.api.img(u) : null;
  }
}
