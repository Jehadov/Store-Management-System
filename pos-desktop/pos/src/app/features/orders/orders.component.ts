import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { LangService } from '../../core/lang.service';
import { PrintService } from '../../core/print.service';
import { CacheService } from '../../core/cache.service';
import { IconComponent } from '../../shared/icon.component';

type Status = 'pending' | 'preparing' | 'ready' | 'on_the_way' | 'completed' | 'cancelled' | '';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.css',
})
export class OrdersComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private cache = inject(CacheService);
  lang = inject(LangService);
  private print = inject(PrintService);
  orders = signal<any[]>([]);
  cachedOrders = signal<any[]>([]);
  filter = signal<Status>('');
  expanded = signal<string | null>(null);
  detail = signal<any | null>(null);
  msg = signal('');
  private timer: any = null;

  ngOnInit() { this.load(); this.timer = setInterval(() => this.load(true), 10000); }
  ngOnDestroy() { if (this.timer) clearInterval(this.timer); }

  statusName(s: string): string {
    const map: Record<string, [string, string]> = {
      pending: ['Pending', 'قيد الانتظار'], preparing: ['Preparing', 'قيد التحضير'],
      ready: ['Ready', 'جاهز'], on_the_way: ['On the way', 'في الطريق'],
      completed: ['Completed', 'مكتمل'], cancelled: ['Cancelled', 'ملغي'],
    };
    const m = map[s];
    return m ? this.lang.pick(m[0], m[1]) : s;
  }
  payName(p: string): string {
    if (p === 'paid') return this.lang.pick('Paid ✓', 'مدفوع ✓');
    return this.lang.pick('Unpaid', 'غير مدفوع');
  }
  markPaid(o: any, method?: string) {
    this.api.markPaid(o.id, method).subscribe({
      next: (u) => { this.msg.set(this.lang.pick(`Order #${u.order_number} paid (${u.payment_method})`, `تم دفع الطلب #${u.order_number}`)); this.load(true); },
      error: () => this.msg.set(this.lang.pick('Mark paid failed', 'فشل تسجيل الدفع')),
    });
  }

  load(silent = false) {
    const s = this.filter();
    this.api.orders(s || undefined as any).subscribe({
      next: (o) => {
        const cached = this.cachedOrders();
        const seen = new Set<string>();
        const merged: any[] = [];
        [...cached, ...o].forEach((order) => {
          if (!seen.has(order.id)) { seen.add(order.id); merged.push(order); }
        });
        this.orders.set(merged);
        this.updateCache();
      },
      error: () => { if (!silent) this.msg.set(this.lang.pick('Login required - open /login first', 'يلزم الدخول - افتح صفحة الدخول أولا')); },
    });
  }
  updateCache() {
    const all = [...this.orders(), ...this.cachedOrders()];
    const seen = new Set<string>();
    const unique: any[] = [];
    all.forEach((o) => {
      if (!seen.has(o.id)) { seen.add(o.id); unique.push(o); }
    });
    this.cachedOrders.set(unique.filter((o) => this.cache.isTracked(o.id)));
  }
  isTracked(o: any): boolean { return !!this.cache.isTracked(o.id); }
  phoneOfOrder(o: any): string | null { return this.cache.isTracked(o.id); }
  trackOrder(phone: string) {
    const normalized = phone;
    this.api.trackOrder(normalized).subscribe({
      next: (o) => {
        this.cache.setCache(normalized, o);
        this.updateCache();
        this.load(true);
      },
      error: () => {
        const cached = this.cache.getCachedOrders(normalized);
        if (cached.length) { this.updateCache(); }
      },
    });
  }
  setFilter(s: Status) { this.filter.set(s); this.load(); }

  toggleDetail(o: any) {
    if (this.expanded() === o.id) { this.expanded.set(null); return; }
    this.expanded.set(o.id);
    this.api.orderDetail(o.id).subscribe((d) => this.detail.set(d));
  }

  printReceipt(o: any) {
    const d = this.detail();
    if (d && d.id === o.id) {
      this.print.receipt(d);
      return;
    }
    this.api.orderDetail(o.id).subscribe((full) => this.print.receipt(full));
  }

  setStatus(o: any, status: string) {
    this.api.setStatus(o.id, status).subscribe({
      next: () => { this.msg.set(this.lang.pick(`Order #${o.order_number} -> ${status}`, `الطلب #${o.order_number} أصبح ${this.statusName(status)}`)); this.load(true); },
      error: () => this.msg.set(this.lang.pick('Update failed - check login/role', 'فشل التحديث - تحقق من الدخول/الدور')),
    });
  }

  shortId(id: string): string { return (id || '').slice(0, 8); }

  ageMin(created: string): number {
    return Math.max(0, Math.round((Date.now() - new Date(created).getTime()) / 60000));
  }

  // ---- Edit (pending orders only; locked once kitchen starts) ----
  editing = signal<any | null>(null);

  startEdit(o: any) {
    this.msg.set('');
    this.api.orderDetail(o.id).subscribe({
      next: (d) => {
        if (d.status !== 'pending') {
          this.msg.set(this.lang.pick(`Order #${d.order_number} is ${d.status} - too late to edit`, `الطلب #${d.order_number} ${this.statusName(d.status)} - فات وقت التعديل`));
          return;
        }
        this.editing.set({
          id: d.id, order_number: d.order_number,
          table_number: d.table_number || '',
          phone_number: d.phone_number || '',
          address: d.address || '', city: d.city || '',
          delivery_location: d.delivery_location || '',
          pay_method: d.payment_method || 'cash',
          items: (d.items || []).map((it: any) => ({
            product_id: it.product_id, name: it.product_name_snapshot,
            option_id: it.variant_option_id || null,
            variant_name: it.variant_group_name || '', variant_value: it.variant_value || '',
            unit_label: it.unit_label || '', unit_price: Number(it.unit_price),
            quantity: Number(it.quantity),
            addOns: this.parseAddons(it.addons_snapshot),
          })),
        });
      },
      error: () => this.msg.set(this.lang.pick('Load order failed', 'فشل تحميل الطلب')),
    });
  }
  cancelEdit() { this.editing.set(null); }

  parseAddons(snap: any): any[] {
    try {
      const arr = typeof snap === 'string' ? JSON.parse(snap) : snap || [];
      return arr.map((a: any) => ({
        id: a.id, name_en: a.name_en || a.name || '',
        extraPrice: Number(a.extraPrice ?? a.extra_price ?? 0),
      }));
    } catch {
      return [];
    }
  }

  dropEditItem(idx: number) {
    const f = this.editing();
    if (!f || f.items.length <= 1) {
      this.msg.set(this.lang.pick('Order must keep at least one item (cancel it instead)', 'يجب أن يبقى صنف واحد على الأقل (ألغِ الطلب بدلا من ذلك)'));
      return;
    }
    f.items.splice(idx, 1);
  }

  editTotal(): number {
    const f = this.editing();
    if (!f) return 0;
    return f.items.reduce((s: number, it: any) =>
      s + (Number(it.unit_price) + it.addOns.reduce((a: number, x: any) => a + Number(x.extraPrice || 0), 0)) * Number(it.quantity || 0), 0);
  }

  saveEdit() {
    const f = this.editing();
    if (!f) return;
    const cartItems = f.items
      .filter((it: any) => Number(it.quantity) > 0)
      .map((it: any) => ({
        id: it.product_id, name: it.name, price: Number(it.unit_price), quantity: Math.floor(Number(it.quantity)),
        optionId: it.option_id || undefined,
        variant: { name: it.variant_name, value: it.variant_value, unitLabel: it.unit_label, optionId: it.option_id || undefined },
        addOns: it.addOns,
      }));
    if (!cartItems.length) {
      this.msg.set(this.lang.pick('Order must keep at least one item (cancel it instead)', 'يجب أن يبقى صنف واحد على الأقل (ألغِ الطلب بدلا من ذلك)'));
      return;
    }
    this.api.updateOrder(f.id, {
      tableNumber: f.table_number,
      payment: { method: f.pay_method || 'cash' },
      shipping: { phoneNumber: f.phone_number, address: f.address, city: f.city },
      deliveryMeta: { location: f.delivery_location },
      cartItems,
    }).subscribe({
      next: (u) => { this.editing.set(null); this.msg.set(this.lang.pick(`Order #${u.order_number} updated - total ${u.total_amount}`, `تم تحديث الطلب #${u.order_number} - المجموع ${u.total_amount}`)); this.load(true); },
      error: (e) => this.msg.set(e?.error?.error || this.lang.pick('Update failed (already in preparation?)', 'فشل التحديث (بدأ التحضير؟)')),
    });
  }
}
