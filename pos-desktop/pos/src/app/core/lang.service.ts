import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LangService {
  lang = signal<'en' | 'ar'>('en');
  toggle() { this.lang.set(this.lang() === 'en' ? 'ar' : 'en'); }
  pick(en: string, ar: string): string {
    return this.lang() === 'ar' ? (ar || en) : en;
  }
  dir(): 'ltr' | 'rtl' { return this.lang() === 'ar' ? 'rtl' : 'ltr'; }
}
