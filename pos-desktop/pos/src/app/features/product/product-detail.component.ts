import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { LangService } from '../../core/lang.service';
import { IconComponent } from '../../shared/icon.component';

const CART_KEY = 'pos_cart';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  template: `
    <div [dir]="lang.dir()" class="product-detail-page">
      <div class="product-detail-inner">
        <div class="product-nav">
          <a routerLink="/" class="product-back">
            <app-icon name="arrow-left" [size]="20" /> {{ lang.lang() === 'ar' ? 'رجوع' : 'Back' }}
          </a>
        </div>

        @if (product(); as p) {
          <div class="product-hero">
            <div class="product-image-wrap">
              @if (p.image) {
                <img [src]="img(p)" class="product-image" [alt]="lang.pick(p.name_en, p.name_ar)" />
              } @else {
                <div class="product-image-placeholder">
                  <app-icon name="image" [size]="48" />
                </div>
              }
              @if (p.is_active === false) {
                <div class="product-badge-off">{{ lang.pick('Off', 'مغلق') }}</div>
              }
            </div>
            <div class="product-info">
              <h1 class="product-name">{{ lang.pick(p.name_en, p.name_ar) }}</h1>
              <div class="product-price-row">
                <span class="product-price">{{ selectedPrice() }} JD</span>
              </div>
              <p class="product-desc">{{ lang.pick($any(p).short_desc_en || '', $any(p).short_desc_ar || '') }}</p>

              <div class="product-options-section">
                <h3 class="section-title">{{ lang.pick('Choose option', 'اختر الخيار') }}</h3>
                @for (g of p.variants; track $index) {
                  <div class="option-group">
                    <div class="option-group-name">{{ lang.pick(g.name_en, g.name_ar) }}</div>
                    <div class="option-grid">
                      @for (o of g.options; track $index) {
                        <button class="option-btn"
                          [class.selected]="selectedOption() === o"
                          (click)="selectedOption.set(o)">
                          <span class="option-label">{{ lang.pick(o.value_en, o.value_ar) }}</span>
                          <span class="option-price">{{ o.price }} JD</span>
                        </button>
                      }
                    </div>
                  </div>
                }
              </div>

              <div class="product-qty-section">
                <h3 class="section-title">{{ lang.pick('Quantity', 'الكمية') }}</h3>
                <div class="qty-selector">
                  <button class="qty-btn" (click)="changeQty(-1)">−</button>
                  <span class="qty-value">{{ qty() }}</span>
                  <button class="qty-btn" (click)="changeQty(1)">+</button>
                </div>
              </div>

              <div class="product-actions">
                <button class="btn-add-cart" [class.disabled]="!canAddToCart()" (click)="addToCart()">
                  <app-icon name="cart" [size]="20" />
                  {{ lang.pick('Add to cart', 'أضف للسلة') }}
                </button>
              </div>
            </div>
          </div>

          @if (p.description) {
            <div class="product-description-section">
              <h3 class="section-title">{{ lang.pick('Description', 'الوصف') }}</h3>
              <p class="product-full-desc">{{ lang.pick(p.description_en || '', p.description_ar || '') }}</p>
            </div>
          }
        } @else {
          <div class="product-loading">
            <div class="spinner-border text-light"></div>
            <p>{{ lang.pick('Loading product...', 'جاري تحميل المنتج...') }}</p>
          </div>
        }
      </div>

      @if (cartCount() > 0) {
        <div class="product-cart-bar">
          <div class="product-cart-info">
            <span class="product-cart-count"><app-icon name="cart" [size]="18" /> {{ cartCount() }}</span>
            <span class="product-cart-total">{{ cartTotal() | number:'1.2-2' }} JD</span>
          </div>
          <a routerLink="/" class="product-cart-btn">{{ lang.pick('View cart', 'عرض السلة') }}</a>
        </div>
      }
    </div>
  `,
  styleUrl: './product-detail.component.css',
})
export class ProductDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  lang = inject(LangService);
  product = signal<any>(null);
  selectedOption = signal<any>(null);
  qty = signal(1);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.productDetail(id).subscribe((p) => {
      this.product.set(p);
      if (p.variants?.[0]?.options?.[0]) {
        this.selectedOption.set(p.variants[0].options[0]);
      }
    });
  }

  img(p: any): string {
    const o = p.variants?.[0]?.options?.[0];
    return this.api.img(o?.image_url || o?.imageUrl || p.image);
  }

  selectedPrice(): number {
    const o = this.selectedOption();
    return o?.price || 0;
  }

  canAddToCart(): boolean {
    return !!this.selectedOption();
  }

  changeQty(delta: number) {
    const p = this.product();
    const firstOpt = p?.variants?.[0]?.options?.[0];
    const max = firstOpt?.quantity ?? 99;
    const next = this.qty() + delta;
    this.qty.set(Math.max(1, Math.min(next, max)));
  }

  addToCart() {
    const p = this.product();
    if (!p || !this.selectedOption()) return;
    const option = this.selectedOption();
    const item: any = {
      id: p.id, name: this.lang.pick(p.name_en, p.name_ar),
      quantity: this.qty(), price: option.price, unit_price: option.price,
      variant: { name: p.variants?.[0]?.name_en || '', value: option.value_en },
      unit_label: option.unit_label_en || 'piece',
    };
    const cartKey = CART_KEY;
    const existing: any[] = (() => { try { return JSON.parse(localStorage.getItem(cartKey) || '[]'); } catch { return []; } })();
    const key = `${item.id}|${item.variant?.value || ''}`;
    const idx = existing.findIndex((i: any) => `${i.id}|${i.variant?.value || ''}` === key);
    if (idx >= 0) existing[idx].quantity += item.quantity;
    else existing.push(item);
    localStorage.setItem(cartKey, JSON.stringify(existing));
    this.qty.set(1);
  }

  cartCount(): number {
    try { const d = localStorage.getItem(CART_KEY); return d ? JSON.parse(d).reduce((s: number, i: any) => s + i.quantity, 0) : 0; } catch { return 0; }
  }
  cartTotal(): number {
    try { const d = localStorage.getItem(CART_KEY); const cart = d ? JSON.parse(d) : []; return cart.reduce((s: number, i: any) => s + (Number(i.price) * i.quantity), 0); } catch { return 0; }
  }
}
