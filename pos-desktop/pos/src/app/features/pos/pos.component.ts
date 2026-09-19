import { Component, OnInit, ElementRef, ViewChild, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Product, Category, CartItem } from '../../core/api.service';
import { OfflineQueueService } from '../../core/offline-queue.service';
import { LangService } from '../../core/lang.service';
import { PrintService } from '../../core/print.service';
import { COUNTRIES, normalizePhone } from '../../core/phone.util';
import { IconComponent } from '../../shared/icon.component';

interface DetailState {
  product: Product;
  groupIdx: number;
  optionIdx: number;
  addonIds: Set<string>;
  qty: number;
}

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './pos.component.html',
  styleUrl: './pos.component.css',
})
export class PosComponent implements OnInit {
  private api = inject(ApiService);
  private queue = inject(OfflineQueueService);
  lang = inject(LangService);
  print = inject(PrintService);
  receipt = signal<any | null>(null);

  @ViewChild('scroller') scroller?: ElementRef<HTMLDivElement>;

  categories = signal<Category[]>([]);
  products = signal<Product[]>([]);
  cart = signal<CartItem[]>([]);
  selectedCategory = signal('all');
  search = signal('');
  tableNumber = signal('T1');
  serviceMethod = signal<'delivery' | 'pickup' | 'inRestaurant'>('inRestaurant');
  couponCode = signal('');
  status = signal('');
  paidNow = signal(true);
  loyPhone = signal('');
  loyCode = signal('+962');
  countries = COUNTRIES;
  loyBalance = signal<number | null>(null);
  loyRedeem = signal(0);
  detail = signal<DetailState | null>(null);
  tables = signal<any[]>([]);

  cartCount = computed(() => this.cart().reduce((s, i) => s + i.quantity, 0));

  bumpQty(idx: number, delta: number) {
    const cart = [...this.cart()];
    const qty = cart[idx].quantity + delta;
    if (qty <= 0) cart.splice(idx, 1);
    else cart[idx] = { ...cart[idx], quantity: qty };
    this.cart.set(cart);
  }
  removeLine(idx: number) { this.cart.set(this.cart().filter((_, i) => i !== idx)); }
  clearCart() { this.cart.set([]); }

  lookupLoyalty() {
    const phone = normalizePhone(this.loyCode(), this.loyPhone());
    this.loyBalance.set(null);
    if (phone.replace(/\D/g, '').length < 10) return;
    this.api.loyalty(phone).subscribe({
      next: (w) => this.loyBalance.set(Number(w.points) || 0),
      error: () => undefined,
    });
  }

  cartTotal = computed(() =>
    this.cart().reduce((s, i) => {
      const addons = (i.addOns || []).reduce((a, x) => a + Number(x.extraPrice || 0), 0);
      return s + (Number(i.price) + addons) * i.quantity;
    }, 0)
  );

  ngOnInit() {
    this.api.categories().subscribe((c) => this.categories.set(c));
    this.loadProducts();
    this.loadTables();
    setInterval(() => {
      this.queue.flush(this.api.base).then((r) => {
        if (r.synced > 0) this.status.set(this.lang.pick(`Synced ${r.synced} offline orders`, `تمت مزامنة ${r.synced} من الطلبات`));
      });
    }, 15000);
  }

  loadTables() {
    this.api.tables().subscribe({
      next: (t) => {
        this.tables.set(t);
        if (t.length && !t.some((x: any) => x.label === this.tableNumber())) {
          this.tableNumber.set(t[0].label);
        }
      },
      error: () => undefined,
    });
  }
  loadProducts() {
    this.api.products(this.selectedCategory(), this.search()).subscribe((p) => this.products.set(p));
  }
  selectCategory(id: string) { this.selectedCategory.set(id); this.loadProducts(); }
  scrollCats(dir: number) { this.scroller?.nativeElement.scrollBy({ left: dir * 200, behavior: 'smooth' }); }

  nameOf(p: Product): string { return this.lang.pick(p.name_en, p.name_ar); }
  catName(c: Category): string { return this.lang.pick(c.name_en, c.name_ar); }

  firstOption(p: Product) { return p.variants?.[0]?.options?.[0]; }
  catImg(c: Category): string { return this.api.img(c.image); }
  // List rows carry cheapest-option price/image flat (see GET /products); detail rows carry variants.
  priceOf(p: any): number {
    const o: any = this.firstOption(p);
    return Number(o?.price ?? p.price ?? 0);
  }
  origOf(p: any): number | null {
    const o: any = this.firstOption(p);
    const v = o?.original_price ?? p.original_price;
    return v != null && Number(v) > 0 ? Number(v) : null;
  }
  optValue(p: any): string {
    const o: any = this.firstOption(p);
    return o?.value_en || p.option_value || '';
  }
  imgOf(p: Product): string {
    return this.api.img(this.firstOption(p)?.image_url || this.firstOption(p)?.imageUrl || (p as any).option_image || (p as any).image);
  }
  offerPct(p: Product): number | null {
    const price = this.priceOf(p);
    const orig = this.origOf(p);
    if (orig == null || orig <= price) return null;
    return Math.round(((orig - price) / orig) * 100);
  }

  highlight(text: string, q: string): { pre: string; match: string; post: string } | null {
    const query = q.trim().toLowerCase();
    if (!query) return null;
    const idx = text.toLowerCase().indexOf(query);
    if (idx < 0) return null;
    return { pre: text.slice(0, idx), match: text.slice(idx, idx + query.length), post: text.slice(idx + query.length) };
  }

  // Detail panel (mirrors React ProductDetails variant/addon/qty logic)
  openDetail(p: Product) {
    this.api.productDetail(p.id).subscribe({
      next: (full) => this.detail.set({ product: full, groupIdx: 0, optionIdx: 0, addonIds: new Set(), qty: 1 }),
      error: () => this.detail.set({ product: p, groupIdx: 0, optionIdx: 0, addonIds: new Set(), qty: 1 }),
    });
  }
  closeDetail() { this.detail.set(null); }
  pickOption(gi: number, oi: number) {
    const d = this.detail(); if (!d) return;
    this.detail.set({ ...d, groupIdx: gi, optionIdx: oi, qty: 1 });
  }
  toggleAddon(id: string) {
    const d = this.detail(); if (!d) return;
    const s = new Set(d.addonIds);
    if (s.has(id)) s.delete(id); else s.add(id);
    this.detail.set({ ...d, addonIds: s });
  }
  detailPrice(): number {
    const d = this.detail(); if (!d) return 0;
    const opt: any = d.product.variants?.[d.groupIdx]?.options?.[d.optionIdx];
    const addons = (d.product.addons || []).filter((a: any) => d.addonIds.has(a.id))
      .reduce((s: number, a: any) => s + Number(a.extra_price ?? a.extraPrice ?? 0), 0);
    return (Number(opt?.price ?? 0) + addons) * d.qty;
  }

  addDetailToCart() {
    const d = this.detail(); if (!d) return;
    const g = d.product.variants?.[d.groupIdx];
    const opt: any = g?.options?.[d.optionIdx];
    const addons = (d.product.addons || [])
      .filter((a: any) => d.addonIds.has(a.id))
      .map((a: any) => ({ id: a.id, name_en: a.name_en, extraPrice: Number(a.extra_price ?? a.extraPrice ?? 0) }));
    this.addOrMerge({
      id: d.product.id,
      name: this.nameOf(d.product),
      price: Number(opt?.price ?? this.priceOf(d.product)),
      quantity: d.qty,
      optionId: (opt as any)?.id,
      variant: { name: g?.name_en || '', value: opt?.value_en || '', optionId: (opt as any)?.id },
      addOns: addons,
    });
    this.closeDetail();
  }

  // Same product + variant + add-ons = same line: bump quantity instead of duplicating
  private lineKey(i: CartItem): string {
    const addons = (i.addOns || []).map((a) => a.id).sort().join(',');
    return `${i.id}|${(i as any).optionId || ''}|${i.variant?.name || ''}|${i.variant?.value || ''}|${addons}`;
  }

  private addOrMerge(item: CartItem) {
    const key = this.lineKey(item);
    const cart = [...this.cart()];
    const idx = cart.findIndex((i) => this.lineKey(i) === key);
    if (idx >= 0) {
      cart[idx] = { ...cart[idx], quantity: cart[idx].quantity + item.quantity };
    } else {
      cart.push(item);
    }
    this.cart.set(cart);
  }

  quickAdd(p: Product) {
    this.addOrMerge({
      id: p.id, name: this.nameOf(p), price: this.priceOf(p), quantity: 1,
      variant: { name: p.variants?.[0]?.name_en || '', value: this.optValue(p) },
    });
  }

  checkout() {
    const payload = {
      serviceMethod: this.serviceMethod(),
      tableNumber: this.serviceMethod() === 'inRestaurant' ? this.tableNumber() : undefined,
      payment: { method: 'cash' },
      shipping: { firstName: 'POS', lastName: '', phoneNumber: '', address: '', city: 'Amman', country: 'Jordan' },
      cartItems: this.cart(),
      couponCode: this.couponCode().trim() || undefined,
      loyaltyPhone: normalizePhone(this.loyCode(), this.loyPhone()).replace(/\D/g, '').length >= 10
        ? normalizePhone(this.loyCode(), this.loyPhone()) : undefined,
      paid: this.paidNow(),
      redeemPoints: Math.max(0, Math.floor(Number(this.loyRedeem()) || 0)) || undefined,
      languageAtOrder: this.lang.lang(),
    };
    this.api.createOrder(payload).subscribe({
      next: (r) => {
        const extra = r.discount > 0 ? ` (subtotal ${r.subtotal}, discount ${r.discount})` : '';
        const extraAr = r.discount > 0 ? ` (المجموع الفرعي ${r.subtotal}، الخصم ${r.discount})` : '';
        const loy = (r as any).loyalty?.earned ? ` +${(r as any).loyalty.earned}pts` : '';
        const loyAr = (r as any).loyalty?.earned ? ` +${(r as any).loyalty.earned} نقطة` : '';
        this.status.set(this.lang.pick(
          `Order #${r.order_number} saved - total ${r.total}${extra}${loy}`,
          `تم حفظ الطلب #${r.order_number} - المجموع ${r.total}${extraAr}${loyAr}`
        ));
        this.cart.set([]);
        this.couponCode.set('');
        this.loyRedeem.set(0);
        this.loadTables();
        this.api.orderDetail(r.orderId).subscribe({
          next: (full) => this.receipt.set(full),
          error: () => undefined,
        });
      },
      error: (e) => {
        const msg = e?.error?.error || '';
        if (msg.includes('insufficient stock') || msg.includes('coupon') || msg.includes('variant')) {
          this.status.set(msg);
          return;
        }
        this.queue.enqueue(payload);
        const n = this.queue.pending();
        this.status.set(this.lang.pick(`Offline - queued (${n} pending)`, `غير متصل - في الانتظار (${n})`));
      },
    });
  }
}
