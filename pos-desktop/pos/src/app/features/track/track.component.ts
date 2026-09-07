import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { LangService } from '../../core/lang.service';
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
      @for (o of orders(); track o.id) {
        <div class="card mb-2">
          <div class="card-body py-2">
            <div class="d-flex align-items-center gap-2">
              <b class="fs-5">#{{ o.order_number }}</b>
              <span class="badge" [class.text-bg-warning]="o.status==='pending'" [class.text-bg-info]="o.status==='preparing'"
                [class.text-bg-success]="o.status==='ready' || o.status==='completed'" [class.text-bg-secondary]="o.status==='cancelled'">
                {{ statusName(o.status) }}
              </span>
              <span class="ms-auto fw-bold">{{ o.total_amount }} JD</span>
            </div>
            <div class="small text-muted">{{ o.created_at | date:'short' }} · {{ o.service_method }}{{ o.table_number ? ' · ' + o.table_number : '' }}</div>
            @for (it of o.items; track $index) {
              <div class="small border-top py-1">{{ it.quantity }}x {{ it.name }} {{ it.variant }}</div>
            }
          </div>
        </div>
      }
      @if (searched() && !orders().length && !msg()) {
        <p class="text-muted">{{ lang.pick('No orders for this number yet.', 'لا توجد طلبات لهذا الرقم بعد.') }}</p>
      }
    </div>
  `,
})
export class TrackComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  lang = inject(LangService);
  countries = COUNTRIES;
  code = '+962';
  phone = '';
  orders = signal<any[]>([]);
  msg = signal('');
  searched = signal(false);
  private timer: any = null;

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
  }
  ngOnDestroy() { if (this.timer) clearInterval(this.timer); }

  hasActive() {
    return this.orders().some((o) => ['pending', 'preparing', 'ready'].includes(o.status));
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
    this.api.trackOrder(normalizePhone(this.code, this.phone)).subscribe({
      next: (o) => { this.orders.set(o); this.searched.set(true); },
      error: () => { if (!silent) this.msg.set(this.lang.pick('Lookup failed', 'فشل البحث')); },
    });
  }
}
