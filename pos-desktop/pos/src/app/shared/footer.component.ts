import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShopService } from '../core/shop.service';
import { LangService } from '../core/lang.service';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink, IconComponent],
  styles: [`
    @media (max-width: 768px) {
      footer .f-grid { text-align: center; }
      footer .f-brand { justify-content: center; text-align: center; }
      footer .f-phones { align-items: center; }
      footer .f-links { flex-direction: row !important; justify-content: center; gap: 16px !important; }
      footer .f-col-title { display: none; }
    }
  `],
  template: `
    <footer class="shop-footer border-top mt-5">
      <div class="container py-4">
        <div class="row g-3 f-grid">
          <div class="col-md-5 d-flex align-items-start gap-2 f-brand">
            @if (shop.logo()) {
              <img [src]="shop.logo()" alt="logo" width="44" height="44" style="object-fit:contain;border-radius:10px" />
            }
            <div>
              <b class="fs-5">{{ shop.name() }}</b>
              <div class="small opacity-75">{{ lang.pick('Fresh food, made to order.', 'أكل طازج يُحضّر عند الطلب.') }}</div>
            </div>
          </div>
          <div class="col-md-4">
            <b class="small f-col-title">{{ lang.pick('Call us', 'اتصل بنا') }}</b>
            @if (shop.settings().phones.length) {
              <div class="d-flex flex-column gap-1 mt-1 f-phones">
                @for (p of shop.settings().phones; track p) {
                  <a [href]="'tel:' + p" class="text-decoration-none small"><app-icon name="phone" [size]="14" /> <span dir="ltr">{{ p }}</span></a>
                }
              </div>
            } @else {
              <div class="small opacity-75">—</div>
            }
          </div>
          <div class="col-md-3">
            <b class="small f-col-title">{{ lang.pick('Explore', 'استكشف') }}</b>
            <div class="d-flex flex-column gap-1 mt-1 small f-links">
              <a routerLink="/" class="text-decoration-none">{{ lang.pick('Home', 'الرئيسية') }}</a>
              <a routerLink="/track" class="text-decoration-none">{{ lang.pick('Track order', 'تتبع الطلب') }}</a>
            </div>
          </div>
        </div>
      </div>
    </footer>`,
})
export class FooterComponent {
  shop = inject(ShopService);
  lang = inject(LangService);
  year = new Date().getFullYear();
}
