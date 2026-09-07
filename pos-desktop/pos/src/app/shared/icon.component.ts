import { Component, Input, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

// Recolorable line icons: stroke="currentColor", so color (and hover color)
// is controlled from CSS wherever the icon is used.
const PATHS: Record<string, string> = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  pos: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  orders: '<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  kitchen: '<circle cx="9" cy="8" r="3"/><circle cx="15" cy="8" r="3"/><path d="M7 11h10v9H7z"/>',
  admin: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  track: '<path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  moon: '<path d="M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  print: '<path d="M7 8V3h10v5"/><rect x="4" y="8" width="16" height="9" rx="2"/><rect x="7" y="14" width="10" height="7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
  cart: '<path d="M3 4h2l2.4 11h10.4l2-8H7"/><circle cx="9.5" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.8-5.4 2.8 1-6.1L3.2 9.5l6.1-.9z"/>',
  video: '<rect x="3" y="6" width="12" height="12" rx="2"/><path d="M15 10l6-3v10l-6-3"/>',
  chair: '<rect x="6" y="9" width="12" height="3" rx="1"/><path d="M8 12v8M16 12v8"/>',
  cash: '<rect x="3" y="7" width="18" height="11" rx="2"/><circle cx="12" cy="12.5" r="2.5"/>',
  chart: '<path d="M6 20v-6M12 20V6M18 20v-9"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2c2.8.4 5 2.7 5 5.8"/>',
  tag: '<path d="M3 3h7l11 11-7 7L3 10z"/><circle cx="8" cy="8" r="1.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/>',
  edit: '<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z"/><path d="M14.5 6.5l3 3"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 3v4h-4"/>',
  alert: '<path d="M12 3L2.5 20h19z"/><path d="M12 9v5M12 17.5v.5"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 15h2"/>',
  calendar: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  trophy: '<path d="M8 4h8v6a4 4 0 0 1-8 0z"/><path d="M8 5H4a3 3 0 0 0 3 5M16 5h4a3 3 0 0 1-3 5M12 14v4M8 21h8"/>',
  percent: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
  phone: '<path d="M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M11 18h2"/>',
  box: '<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
};

@Component({
  selector: 'app-icon',
  standalone: true,
  template: `<svg [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    style="flex-shrink:0;vertical-align:-3px" [innerHTML]="svg()"></svg>`,
})
export class IconComponent {
  private sanitizer = inject(DomSanitizer);
  /** icon name, see PATHS */
  @Input() name = 'box';
  /** pixel size */
  @Input() size = 20;

  svg(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(PATHS[this.name] || PATHS['box']);
  }
}
