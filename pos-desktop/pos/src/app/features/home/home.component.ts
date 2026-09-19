import { Component, OnInit, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ApiService, Product, Category, CartItem } from '../../core/api.service';
import { COUNTRIES, normalizePhone, validPhone } from '../../core/phone.util';
import { ContentService, NewsItem } from '../../core/content.service';
import { LangService } from '../../core/lang.service';
import { CacheService } from '../../core/cache.service';
import { IconComponent } from '../../shared/icon.component';

const CART_KEY = 'pos_cart';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements OnInit {
  private api = inject(ApiService);
  private cache = inject(CacheService);
  private content = inject(ContentService);
  private sanitizer = inject(DomSanitizer);
  lang = inject(LangService);

  @ViewChild('catScroller') catScroller?: ElementRef<HTMLDivElement>;
  @ViewChild('newsScroller') newsScroller?: ElementRef<HTMLDivElement>;

  categories = signal<Category[]>([]);
  products = signal<Product[]>([]);
  loading = signal(true);
  selectedCategory = signal('all');
  search = signal('');
  videos = signal<any[]>([]);
  safeUrl = signal<SafeResourceUrl | ''>('');
  news = signal<NewsItem[]>([]);
  offers = signal<any[]>([]);
  copiedCode = signal('');

  // Customer self-order cart
  cart = signal<CartItem[]>([]);
  cartOpen = signal(false);
  checkoutMode = signal(false);
  placing = signal(false);
  orderError = signal('');
  placed = signal<{ order_number: number; total: number; earned: number; phone: string } | null>(null);
  svc = signal<'pickup' | 'delivery' | 'inRestaurant'>('pickup');
  pay = signal<'cash' | 'cliq'>('cash');
  tables = signal<any[]>([]);
  tableNumber = signal('');
  cust = signal({ code: '+962', name: '', phone: '', address: '', city: 'Amman', coupon: '', redeem: '' });
  setCust(field: 'code' | 'name' | 'phone' | 'address' | 'city' | 'coupon' | 'redeem', value: string) {
    this.cust.update((c) => ({ ...c, [field]: value }));
  }
  countries = COUNTRIES;

  ngOnInit() {
    this.cart.set(this.loadCart());
    this.api.categories().subscribe((c) => this.categories.set(c));
    this.loadProducts();
    // Promo videos managed in /admin -> Videos (GET /videos?active=true); hero plays the first one
    this.api.videos(true).subscribe((v) => {
      this.videos.set(v);
      const first = v[0];
      this.safeUrl.set(first && !this.isFile(first) ? this.sanitizer.bypassSecurityTrustResourceUrl(this.videoEmbed()) : '');
    });
    // Active offers strip (auto discounts + coupons)
    this.api.activeOffers().subscribe((o) => this.offers.set(o || []));
    this.api.tables().subscribe({ next: (t) => this.tables.set(t || []), error: () => undefined });
    // Same as VideoAndNews.tsx
    this.content.news().subscribe((n) => this.news.set(n));
  }

  loadProducts() {
    this.loading.set(true);
    this.api.products(this.selectedCategory(), '').subscribe({
      next: (p) => { this.products.set(p); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
  selectCategory(id: string) { this.selectedCategory.set(id); this.loadProducts(); }
  scrollCats(dir: number) { this.catScroller?.nativeElement.scrollBy({ left: dir * 200, behavior: 'smooth' }); }
  scrollNews(dir: number) { this.newsScroller?.nativeElement.scrollBy({ left: dir * 300, behavior: 'smooth' }); }

  // Same filtering as Home.tsx filteredProducts useMemo
  filtered() {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.products();
    return this.products().filter((p: any) =>
      (p.name_en?.toLowerCase() || '').includes(q) || (p.name_ar?.toLowerCase() || '').includes(q)
    );
  }

  nameOf(p: any): string { return this.lang.pick(p.name_en, p.name_ar); }
  catName(c: Category): string { return this.lang.pick(c.name_en, c.name_ar); }
  catImg(c: Category): string { return this.api.img(c.image); }
  firstOption(p: any) { return p.variants?.[0]?.options?.[0]; }
  // List rows carry cheapest-option price/image flat (see GET /products); detail rows carry variants.
  priceOf(p: any): number {
    const o = this.firstOption(p);
    return Number(o?.price ?? p.price ?? 0);
  }
  origOf(p: any): number | null {
    const o = this.firstOption(p);
    const v = o?.original_price ?? p.original_price;
    return v != null && Number(v) > 0 ? Number(v) : null;
  }
  optValue(p: any): string {
    const o = this.firstOption(p);
    return o?.value_en || p.option_value || '';
  }
  imgOf(p: any): string {
    const o = this.firstOption(p);
    return this.api.img(o?.image_url || o?.imageUrl || p.option_image || p.image);
  }
  offerPct(p: any): number | null {
    const price = this.priceOf(p);
    const orig = this.origOf(p);
    if (orig == null || orig <= price) return null;
    return Math.round(((orig - price) / orig) * 100);
  }
  videoEmbed(): string {
    const v = this.currentVideo();
    if (!v?.url) return '';
    const emb = this.content.toEmbed(v.url);
    const id = this.content.videoId(v.url);
    return id ? `${emb}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&showinfo=0&modestbranding=1&rel=0` : emb;
  }
  currentVideo(): any | null { return this.videos()[0] || null; }
  vidSrc(v: any): string { return this.api.img(v?.url); }
  isFile(v: any): boolean {
    const u = (v?.url || '').toLowerCase();
    return u.endsWith('.mp4') || u.endsWith('.webm') || u.endsWith('.mov') || u.startsWith('/uploads/');
  }

  // ---- Self-order cart (same merge rule as POS) ----
  cartCount(): number { return this.cart().reduce((s, i) => s + i.quantity, 0); }
  cartTotal(): number {
    return this.cart().reduce((s, i) => {
      const addons = (i.addOns || []).reduce((a, x) => a + Number(x.extraPrice || 0), 0);
      return s + (Number(i.price) + addons) * i.quantity;
    }, 0);
  }
  private lineKey(i: CartItem): string {
    const addons = (i.addOns || []).map((a) => a.id).sort().join(',');
    return `${i.id}|${i.variant?.name || ''}|${i.variant?.value || ''}|${addons}`;
  }
  private loadCart(): CartItem[] {
    try { const d = localStorage.getItem(CART_KEY); return d ? JSON.parse(d) : []; } catch { return []; }
  }
  private saveCart(cart: CartItem[]) { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }

  quickAdd(p: any) {
    const item: CartItem = {
      id: p.id, name: this.nameOf(p), price: this.priceOf(p), quantity: 1,
      variant: { name: p.variants?.[0]?.name_en || '', value: this.optValue(p) },
    };
    const key = this.lineKey(item);
    const cart = [...this.cart()];
    const idx = cart.findIndex((i) => this.lineKey(i) === key);
    if (idx >= 0) cart[idx] = { ...cart[idx], quantity: cart[idx].quantity + 1 };
    else cart.push(item);
    this.cart.set(cart); this.saveCart(cart);
  }
  bumpQty(idx: number, delta: number) {
    const cart = [...this.cart()];
    const qty = cart[idx].quantity + delta;
    if (qty <= 0) cart.splice(idx, 1);
    else cart[idx] = { ...cart[idx], quantity: qty };
    this.cart.set(cart); this.saveCart(cart);
  }
  removeLine(idx: number) { const cart = this.cart().filter((_, i) => i !== idx); this.cart.set(cart); this.saveCart(cart); }

  openCart() { this.placed.set(null); this.orderError.set(''); this.checkoutMode.set(false); this.cartOpen.set(true); }

  offerImg(o: any): string | null {
    return o?.image ? this.api.img(o.image) : null;
  }
  offerBadge(o: any): string {    if (o.type === 'bogo') return this.lang.pick('Buy & Get', 'اشترِ واحصل');
    const n = Number(o.discount_value) || 0;
    const pct = o.type === 'percentage_discount' || o.discount_nature === 'percentage';
    return pct ? `${n}% ${this.lang.pick('OFF', 'خصم')}` : `${n} JD ${this.lang.pick('OFF', 'خصم')}`;
  }

  copyCode(o: any) {
    if (!o.coupon_code) return;
    const done = () => {
      this.copiedCode.set(o.coupon_code);
      setTimeout(() => this.copiedCode.set(''), 2000);
    };
    try {
      const p = (navigator as any).clipboard?.writeText(o.coupon_code);
      if (p?.then) p.then(done).catch(done);
      else done();
    } catch {
      done();
    }
  }

  placeOrder() {
    const c = this.cust();
    if (!c.name.trim() || !validPhone(c.code, c.phone)) {
      this.orderError.set(this.lang.pick('Name + valid phone required', 'الاسم ورقم صحيح مطلوبان'));
      return;
    }
    if (this.svc() === 'delivery' && !c.address.trim()) {
      this.orderError.set(this.lang.pick('Address required for delivery', 'العنوان مطلوب للتوصيل'));
      return;
    }
    const fullPhone = normalizePhone(c.code, c.phone);
    this.orderError.set('');
    this.placing.set(true);
    this.api.createOrder({
      serviceMethod: this.svc(),
      tableNumber: this.svc() === 'inRestaurant' ? this.tableNumber() || undefined : undefined,
      payment: { method: this.pay() },
      shipping: { firstName: c.name, lastName: '', phoneNumber: fullPhone, address: c.address, city: c.city || 'Amman', country: 'Jordan' },
      deliveryMeta: { location: c.address, name: c.name, phoneNumber: fullPhone },
      cartItems: this.cart(),
      couponCode: c.coupon.trim() || undefined,
      loyaltyPhone: fullPhone,
      redeemPoints: Math.max(0, Math.floor(Number((c as any).redeem) || 0)) || undefined,
      languageAtOrder: this.lang.lang(),
    }).subscribe({
      next: (r) => {
        this.placing.set(false);
        const orderObj: any = {
          id: r.orderId, order_number: r.order_number, total_amount: r.total,
          created_at: new Date().toISOString(), items: this.cart(),
          service_method: this.svc(), phone_number: fullPhone,
          payment_method: this.pay(), payment_status: 'unpaid', status: 'pending'
        };
        this.cache.addToCache(orderObj, fullPhone);
        this.placed.set({ order_number: r.order_number, total: r.total, earned: (r as any).loyalty?.earned || 0, phone: fullPhone });
        this.cart.set([]); this.saveCart([]);
      },
      error: (e) => {
        this.placing.set(false);
        this.orderError.set(e?.error?.error || this.lang.pick('Order failed - try again', 'فشل الطلب - حاول مجددا'));
      },
    });
  }
}
