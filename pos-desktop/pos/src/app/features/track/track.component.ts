import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { LangService } from '../../core/lang.service';
import { CacheService } from '../../core/cache.service';
import { COUNTRIES, normalizePhone, validPhone } from '../../core/phone.util';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-track',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="container py-4" [dir]="lang.dir()" style="max-width:640px">
      <h3 class="mb-3"><app-icon name="track" [size]="24" /> {{ lang.pick('Track my order', 'تتبع طلبي') }}</h3>
      <div class="d-flex gap-2 mb-3">
        <select class="form-select" style="max-width:150px" [(ngModel)]="code">
          <option *ngFor="let c of countries" [value]="c.code">{{ c.flag }} {{ c.code }}</option>
        </select>
        <input class="form-control" [(ngModel)]="phone" inputmode="tel"
          placeholder="{{ lang.pick('Phone number', 'رقم الهاتف') }}" (keyup.enter)="search()" />
        <button class="btn btn-primary" (click)="search()">{{ lang.pick('Find', 'بحث') }}</button>
      </div>
      @if (msg()) { <p class="alert alert-warning">{{ msg() }}</p> }
      @if (isSessionExpired()) {
        <div class="alert alert-danger">
          <b>{{ lang.pick('Tracking session expired', 'انتهت جلسة التتبع') }}</b>
          <p class="mb-1 small">{{ lang.pick('The 2-hour tracking period has ended.', 'انتهت فترة التتبع لمدة ساعتين.') }}</p>
          <button class="btn btn-sm btn-outline-secondary" (click)="clearExpiredCache()">{{ lang.pick('Clear', 'مسح') }}</button>
        </div>
      }
      @if (!isSessionExpired() && currentPhone() && isWithinSession(currentPhone()) && orders().some((o) => ['pending', 'preparing', 'ready'].includes(o.status))) {
        <div class="alert alert-info d-flex justify-content-between align-items-center">
          <span>{{ lang.pick('Tracking session active', 'جلسة التتبع نشطة') }} · {{ lang.pick('Time remaining', 'الوقت المتبقي') }}: <b>{{ remainingText(currentPhone()) }}</b></span>
        </div>
      }
      @if (hasCached() && !orders().length && !isSessionExpired()) {
        <div class="alert alert-info">{{ lang.pick('Previously tracked orders are still available.', 'الطلبات المتتبعة سابقاً لا تزال متاحة.') }}</div>
      }
      @for (o of orders(); track o.id) {
        <div class="card mb-2" [class.ord-tracked]="isTracked(o)">
          <div class="card-body py-2">
            <div class="d-flex align-items-center gap-2">
              <b class="fs-5">#{{ o.order_number }}</b>
              <span class="badge" [class.text-bg-warning]="o.status==='pending'" [class.text-bg-info]="o.status==='preparing'"
                [class.text-bg-success]="o.status==='ready' || o.status==='completed'" [class.text-bg-secondary]="o.status==='cancelled'">
                {{ statusName(o.status) }}
              </span>
              @if (isTracked(o)) {
                <span class="badge text-bg-primary">{{ lang.pick('Tracked', 'متتبع') }}</span>
              }
              <span class="ms-auto fw-bold">{{ o.total_amount }} JD</span>
            </div>
            <div class="small">{{ o.payment_status === 'paid' ? lang.pick('Paid ✓ - show this screen if asked', 'مدفوع ✓') : lang.pick('Unpaid - pay cashier with order #' + o.order_number, 'غير مدفوع - ادفع للكاشير برقم الطلب') }}</div>
            <div class="small text-muted">{{ o.created_at | date:'short' }} · {{ o.service_method }}{{ o.table_number ? ' · ' + o.table_number : '' }}</div>
            @for (it of o.items; track $index) {
              <div class="small border-top py-1">{{ it.quantity }}x {{ it.name }} {{ it.variant }}</div>
            }
          </div>
        </div>
      }
      @if (searched() && !orders().length && !msg() && !hasCached() && !isSessionExpired()) {
        <p class="text-muted">{{ lang.pick('No orders for this number yet.', 'لا توجد طلبات لهذا الرقم بعد.') }}</p>
      }
      @if (currentPhone() && isWithinSession(currentPhone()) && orders().length > 0) {
        <div class="small text-muted mt-3 text-center">
          {{ lang.pick('Session expires in', 'تنتهي الجلسة بعد') }} <b>{{ remainingText(currentPhone()) }}</b>
        </div>
      }
    </div>
  `,
})
export class TrackComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private cache = inject(CacheService);
  private route = inject(ActivatedRoute);
  lang = inject(LangService);
  countries = COUNTRIES;
  code = '+962';
  phone = '';
  orders = signal<any[]>([]);
  msg = signal('');
  searched = signal(false);
  currentPhoneSig = signal<string>('');
  private timer: any = null;
  private sessionTimer: any = null;

  currentPhone() { return this.currentPhoneSig(); }

  ngOnInit() {
    const q = this.route.snapshot.queryParamMap.get('phone');
    if (q) {
      for (const c of COUNTRIES) {
        if (q.startsWith(c.code)) {
          this.code = c.code;
          this.phone = q.slice(c.code.length);
          break;
        }
      }
      if (!this.phone) this.phone = q;
      this.search();
    }
    this.timer = setInterval(() => { if (this.searched() && this.hasActive()) this.search(true); }, 15000);
    this.sessionTimer = setInterval(() => {
      const phone = this.currentPhoneSig();
      if (phone && !this.isWithinSession(phone)) {
        this.orders.set([]);
        this.searched.set(false);
      }
    }, 60000);
  }
  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.sessionTimer) clearInterval(this.sessionTimer);
  }

  hasActive() {
    return this.orders().some((o) => ['pending', 'preparing', 'ready'].includes(o.status));
  }

  isWithinSession(phone: string): boolean {
    return this.cache.isWithinSession(phone);
  }

  hasCached() {
    return this.cache.getAllCachedOrders().length > 0;
  }

  isSessionExpired() {
    const phone = this.currentPhoneSig();
    if (!phone) return false;
    return !this.cache.isWithinSession(phone);
  }

  clearExpiredCache() {
    const phone = this.currentPhoneSig();
    if (phone) {
      this.cache.removeCache(phone);
      this.currentPhoneSig.set('');
      this.orders.set([]);
      this.msg.set(this.lang.pick('Session cleared. You can track a new order.', 'تم مسح الجلسة. يمكنك تتبع طلب جديد.'));
    }
  }

  remainingText(phone: string): string {
    const ms = this.cache.getRemainingMs(phone);
    if (ms <= 0) return this.lang.pick('Expired', 'منتهي');
    const hours = Math.floor(ms / (60 * 60 * 1000));
    const mins = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  }

  isTracked(o: any): boolean {
    return !!this.cache.isTracked(o.id);
  }

  statusName(s: string): string {
    if (s === 'pending') return this.lang.pick('Pending', 'قيد الانتظار');
    if (s === 'preparing') return this.lang.pick('Preparing', 'قيد التحضير');
    if (s === 'ready') return this.lang.pick('Ready', 'جاهز');
    if (s === 'completed') return this.lang.pick('Completed', 'مكتمل');
    return this.lang.pick('Cancelled', 'ملغي');
  }

  search(silent = false) {
    if (!validPhone(this.code, this.phone)) {
      if (!silent) this.msg.set(this.lang.pick('Enter a valid phone number', 'أدخل رقما صحيحا'));
      return;
    }
    this.msg.set('');
    const phone = normalizePhone(this.code, this.phone);
    this.currentPhoneSig.set(phone);
    this.api.trackOrder(phone).subscribe({
      next: (o) => {
        this.orders.set(o);
        this.searched.set(true);
        o.forEach((order: any) => { this.cache.addToCache(order, phone); });
      },
      error: () => {
        const cached = this.cache.getCachedOrders(phone);
        if (cached.length) {
          this.orders.set(cached);
          this.searched.set(true);
        } else {
          if (!silent) this.msg.set(this.lang.pick('Lookup failed', 'فشل البحث'));
        }
      },
    });
  }
}
