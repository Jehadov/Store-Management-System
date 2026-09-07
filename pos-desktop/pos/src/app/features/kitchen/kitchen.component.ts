import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../core/api.service';
import { LangService } from '../../core/lang.service';
import { PrintService } from '../../core/print.service';
import { IconComponent } from '../../shared/icon.component';

type KTab = 'pending' | 'preparing' | 'ready';

@Component({
  selector: 'app-kitchen',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  styleUrl: './kitchen.component.css',
  template: `
    <div class="kds" [dir]="lang.dir()">
      <div class="kds-head">
        <b>{{ lang.pick('KITCHEN', 'المطبخ') }}</b>
        <span class="kds-clock">{{ clock() }}</span>
        <button class="kds-refresh" (click)="load()">↻</button>
      </div>
      @if (msg()) { <p class="kds-login">{{ msg() }} <a routerLink="/login">{{ lang.pick('Go to login', 'الذهاب للدخول') }}</a></p> }

      <div class="kds-cols">
        @for (s of statuses; track s) {
          <section class="kds-col">
            <div class="kds-col-head" [attr.data-s]="s">
              {{ statusName(s) }} <span>{{ ordersMap()[s].length }}</span>
            </div>
            @for (o of ordersMap()[s]; track o.id) {
              <div class="kds-card" [class.old]="ageMin(o.created_at) >= 10" [class.older]="ageMin(o.created_at) >= 20">
                <div class="kds-top">
                  <span class="kds-num">#{{ o.order_number }}</span>
                  <span class="kds-age"><app-icon name="clock" [size]="18" /> {{ ageMin(o.created_at) }}{{ lang.pick('m', 'د') }}</span>
                </div>
                <div class="kds-meta">{{ svcName(o.service_method) }}{{ o.table_number ? ' · ' + o.table_number : '' }}</div>
                <div class="kds-items">
                  @if (o.items?.length) {
                    @for (it of o.items; track $index) {
                      <div class="kds-item">
                        <span class="kds-qty">{{ it.quantity }}×</span>
                        <div>
                          <b>{{ it.product_name_snapshot }}</b>
                          @if (it.variant_value) { <span> ({{ it.variant_value }})</span> }
                          @if (addonNames(it).length) {
                            <div class="kds-addons">+ {{ addonNames(it).join(', ') }}</div>
                          }
                        </div>
                      </div>
                    }
                  } @else { <div class="spinner-border spinner-border-sm text-light"></div> }
                </div>
                <div class="kds-actions">
                  @if (s==='pending') { <button class="kds-next" (click)="advance(o,'preparing')">{{ lang.pick('START', 'ابدأ') }}</button> }
                  @if (s==='preparing') { <button class="kds-next" (click)="advance(o,'ready')">{{ lang.pick('READY', 'جهّز') }}</button> }
                  @if (s==='ready') { <button class="kds-next done" (click)="advance(o,'completed')">{{ lang.pick('DONE', 'تم') }}</button> }
                  <button class="kds-x" (click)="print.ticket(o)" title="Print ticket"><app-icon name="print" [size]="17" /></button>
                  <button class="kds-x" (click)="advance(o,'cancelled',true)">✕</button>
                </div>
              </div>
            } @empty {
              <p class="kds-empty">—</p>
            }
          </section>
        }
      </div>
    </div>
  `,
})
export class KitchenComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  lang = inject(LangService);
  print = inject(PrintService);
  statuses: KTab[] = ['pending', 'preparing', 'ready'];
  ordersMap = signal<Record<KTab, any[]>>({ pending: [], preparing: [], ready: [] });
  msg = signal('');
  clock = signal('');
  private timer: any = null;
  private clockTimer: any = null;

  ngOnInit() {
    this.load();
    this.timer = setInterval(() => this.load(true), 10000);
    this.tickClock();
    this.clockTimer = setInterval(() => this.tickClock(), 10000);
  }
  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.clockTimer) clearInterval(this.clockTimer);
  }

  tickClock() {
    this.clock.set(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  }

  statusName(s: string): string {
    if (s === 'pending') return this.lang.pick('Pending', 'قيد الانتظار');
    if (s === 'preparing') return this.lang.pick('Preparing', 'قيد التحضير');
    return this.lang.pick('Ready', 'جاهز');
  }
  svcName(s: string): string {
    if (s === 'delivery') return this.lang.pick('Delivery', 'توصيل');
    if (s === 'pickup') return this.lang.pick('Pickup', 'استلام');
    return this.lang.pick('Dine-in', 'صالة');
  }

  load(silent = false) {
    if (!silent) this.msg.set('');
    forkJoin(
      this.statuses.map((s) =>
        this.api.orders(s).pipe(
          catchError(() => {
            if (!silent) this.msg.set(this.lang.pick('Login required - kitchen staff login first.', 'يلزم الدخول - على موظف المطبخ الدخول أولا.'));
            return of([]);
          })
        )
      )
    ).subscribe((lists: any[]) => {
      const map: Record<KTab, any[]> = { pending: [], preparing: [], ready: [] };
      let pending = this.statuses.length;
      this.statuses.forEach((s, i) => {
        const list = lists[i] || [];
        if (!list.length) {
          map[s] = [];
          if (--pending === 0) this.ordersMap.set(map);
          return;
        }
        forkJoin(
          list.map((o: any) => this.api.orderDetail(o.id).pipe(catchError(() => of({ ...o, items: [] }))))
        ).subscribe((full) => {
          map[s] = full as any[];
          if (--pending === 0) this.ordersMap.set(map);
        });
      });
    });
  }

  advance(o: any, next: string, stay = false) {
    void stay;
    this.api.setStatus(o.id, next).subscribe({
      next: () => this.load(true),
      error: () => this.msg.set(this.lang.pick('Update failed - check login/role', 'فشل التحديث - تحقق من الدخول/الدور')),
    });
  }

  addonNames(it: any): string[] {
    try {
      const arr = typeof it.addons_snapshot === 'string' ? JSON.parse(it.addons_snapshot) : it.addons_snapshot || [];
      return arr.map((a: any) => a.name_en || a.name || '').filter(Boolean);
    } catch {
      return [];
    }
  }

  ageMin(created: string): number {
    return Math.max(0, Math.round((Date.now() - new Date(created).getTime()) / 60000));
  }
}
