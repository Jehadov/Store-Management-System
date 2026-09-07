import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { ShopService, DEFAULT_THEME } from '../../core/shop.service';
import { LangService } from '../../core/lang.service';
import { PrintService } from '../../core/print.service';
import { IconComponent } from '../../shared/icon.component';

type Tab = 'overview' | 'analytics' | 'products' | 'categories' | 'videos' | 'employees' | 'settings' | 'offers' | 'tables' | 'dayclose' | 'expenses';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  styles: [`
    .modal-popup { background: rgba(0,0,0,.5); }
    .modal-popup .modal-dialog { max-width: 640px; }
    .modal-popup .modal-content { border: none; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,.25); }
    .admin-shell { display: flex; gap: 16px; align-items: flex-start; }
    .admin-nav {
      width: 210px; flex-shrink: 0; position: sticky; top: 12px;
      background: var(--bs-body-bg); border: 1px solid var(--bs-border-color);
      border-radius: 16px; padding: 10px; display: flex; flex-direction: column; gap: 2px;
    }
    .admin-nav button {
      text-align: start; border: none; background: none; color: inherit;
      border-radius: 10px; padding: 9px 12px; font-weight: 500; cursor: pointer; font-size: .92rem;
    }
    .admin-nav button:hover { background: var(--bs-tertiary-bg); }
    .admin-nav button.active { background: #111; color: #fff; }
    .admin-main { flex-grow: 1; min-width: 0; background: var(--bs-tertiary-bg); border-radius: 20px; padding: 16px; }
    .kpi-grid { display: grid; gap: 12px; grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .kpi { background: var(--bs-body-bg); border: 1px solid var(--bs-border-color); border-radius: 16px; padding: 16px; }
    .kpi .kpi-icon { font-size: 1.4rem; }
    .kpi .kpi-num { font-size: 1.5rem; font-weight: 800; line-height: 1.2; }
    .kpi .kpi-label { font-size: .82rem; color: var(--bs-secondary-color); }
    a.kpi { text-decoration: none; color: inherit; display: block; transition: box-shadow .15s; }
    a.kpi:hover { box-shadow: 0 6px 18px rgba(0,0,0,.1); color: inherit; }
    .ov-grid { display: grid; gap: 12px; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); margin-top: 12px; }
    .panel { background: var(--bs-body-bg); border: 1px solid var(--bs-border-color); border-radius: 16px; padding: 16px; }
    .panel h6 { font-weight: 700; margin-bottom: 12px; }
    .a-pill { font-size: .72rem; font-weight: 600; border-radius: 999px; padding: 2px 10px; background: var(--bs-tertiary-bg); color: var(--bs-secondary-color); }
    .a-pill[data-s="pending"] { background: #fef3c7; color: #92400e; }
    .a-pill[data-s="preparing"] { background: #dbeafe; color: #1e40af; }
    .a-pill[data-s="ready"], .a-pill[data-s="completed"] { background: #dcfce7; color: #166534; }
    .chart { display: flex; align-items: flex-end; gap: 6px; height: 180px; padding-top: 8px; }
    .chart .bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; min-width: 0; }
    .chart .bar { width: 70%; max-width: 34px; border-radius: 6px 6px 0 0; background: #111; min-height: 3px; }
    .chart .bar.peak { background: #16a34a; }
    .chart .bar-lab { font-size: .68rem; color: var(--bs-secondary-color); margin-top: 4px; white-space: nowrap; }
    .chart-tip {
      position: fixed; z-index: 100; pointer-events: none;
      background: #111; color: #fff; border-radius: 10px; padding: 8px 12px;
      font-size: .82rem; box-shadow: 0 8px 22px rgba(0,0,0,.3); white-space: nowrap;
    }
    .donut-wrap { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
    .donut { width: 140px; height: 140px; flex-shrink: 0; }
    .donut-legend { display: flex; flex-direction: column; gap: 6px; font-size: .85rem; }
    .donut-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-inline-end: 6px; }
    .pay-row { margin-bottom: 10px; font-size: .85rem; }
    .pay-track { height: 8px; border-radius: 999px; background: var(--bs-tertiary-bg); margin-top: 4px; overflow: hidden; }
    .pay-fill { height: 100%; border-radius: 999px; background: #111; }
    .podium-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--bs-border-color); }
    .podium-row:last-child { border-bottom: none; }
    .podium-medal { font-size: 1.3rem; width: 34px; text-align: center; flex-shrink: 0; }
    .podium-bar { height: 8px; border-radius: 999px; background: linear-gradient(90deg, #111827, #4c1d95); margin-top: 4px; }
    .admin-table-card { background: var(--bs-body-bg); border: 1px solid var(--bs-border-color); border-radius: 16px; overflow: hidden; }
    .admin-table-card table { margin-bottom: 0; font-size: .92rem; }
    .admin-table-card tr:first-child th {
      text-transform: uppercase; font-size: .7rem; letter-spacing: .06em;
      color: var(--bs-secondary-color); background: var(--bs-tertiary-bg);
      padding: 12px 16px; border-bottom: 2px solid var(--bs-border-color); white-space: nowrap;
    }
    .admin-table-card td { padding: 12px 16px; vertical-align: middle; }
    .admin-table-card tr:nth-child(n+2):hover td { background: var(--bs-tertiary-bg); }
    .admin-table-card tr:last-child td { border-bottom: none; }
    .view-switch { display: inline-flex; background: var(--bs-tertiary-bg); border-radius: 999px; padding: 3px; }
    .view-switch button { border: none; background: none; color: inherit; border-radius: 999px; padding: 4px 12px; font-size: .8rem; cursor: pointer; }
    .view-switch button.active { background: var(--bs-body-bg); box-shadow: 0 1px 4px rgba(0,0,0,.15); font-weight: 700; }
    .grid-cards { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); }
    .g-card { background: var(--bs-body-bg); border: 1px solid var(--bs-border-color); border-radius: 18px; overflow: hidden; display: flex; flex-direction: column; transition: box-shadow .15s, transform .15s; }
    .g-card:hover { box-shadow: 0 8px 22px rgba(0,0,0,.09); transform: translateY(-2px); }
    .g-card img.g-img { width: 100%; height: 150px; object-fit: cover; background: var(--bs-tertiary-bg); }
    .g-card .g-ph { height: 110px; display: flex; align-items: center; justify-content: center; font-size: 2.2rem; background: var(--bs-tertiary-bg); }
    .g-card .g-body { padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 2px; flex-grow: 1; }
    .g-card .g-name { font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .g-card .g-sub { font-size: .8rem; color: var(--bs-secondary-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .g-card .g-price { font-weight: 800; font-size: 1.02rem; margin-top: 2px; }
    .g-card .g-actions { display: flex; gap: 6px; margin-top: 10px; }
    .g-card.occupied { border-color: #f59e0b; border-width: 2px; }
    @media (max-width: 900px) {
      .admin-shell { flex-direction: column; }
      .admin-nav { width: 100%; position: static; flex-direction: row; overflow-x: auto; }
      .admin-nav button { white-space: nowrap; }
      .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .ov-grid { grid-template-columns: minmax(0, 1fr); }
    }
  `],
  template: `
    <div class="container py-3" [dir]="lang.dir()">
      <h2>{{ lang.pick('Administration', 'الإدارة') }}</h2>
      <p *ngIf="!isAdmin()" class="alert alert-warning">
        {{ lang.pick('Admin login required.', 'يلزم الدخول كمدير.') }} <a routerLink="/login">{{ lang.pick('Go to login', 'الذهاب للدخول') }}</a>
      </p>
      <div *ngIf="isAdmin()" class="admin-shell">
        <aside class="admin-nav">
          <button [class.active]="tab()==='overview'" (click)="setTab('overview')"><app-icon name="chart" [size]="17" /> {{ lang.pick('Overview', 'نظرة عامة') }}</button>
          <button [class.active]="tab()==='analytics'" (click)="setTab('analytics')"><app-icon name="trend" [size]="17" /> {{ lang.pick('Analytics', 'التحليلات') }}</button>
          <button [class.active]="tab()==='products'" (click)="setTab('products')"><app-icon name="box" [size]="17" /> {{ lang.pick('Products', 'المنتجات') }}</button>
          <button [class.active]="tab()==='categories'" (click)="setTab('categories')"><app-icon name="grid" [size]="17" /> {{ lang.pick('Categories', 'الفئات') }}</button>
          <button [class.active]="tab()==='videos'" (click)="setTab('videos')"><app-icon name="video" [size]="17" /> {{ lang.pick('Videos', 'الفيديوهات') }}</button>
          <button [class.active]="tab()==='employees'" (click)="setTab('employees')"><app-icon name="users" [size]="17" /> {{ lang.pick('Employees', 'الموظفون') }}</button>
          <button [class.active]="tab()==='offers'" (click)="setTab('offers')"><app-icon name="tag" [size]="17" /> {{ lang.pick('Offers', 'العروض') }}</button>
          <button [class.active]="tab()==='tables'" (click)="setTab('tables')"><app-icon name="chair" [size]="17" /> {{ lang.pick('Tables', 'الطاولات') }}</button>
          <button [class.active]="tab()==='dayclose'" (click)="setTab('dayclose');loadEod()"><app-icon name="pos" [size]="17" /> {{ lang.pick('Day close', 'إغلاق اليوم') }}</button>
          <button [class.active]="tab()==='expenses'" (click)="setTab('expenses')"><app-icon name="cash" [size]="17" /> {{ lang.pick('Losses', 'المصاريف') }}</button>
          <button [class.active]="tab()==='settings'" (click)="setTab('settings')"><app-icon name="admin" [size]="17" /> {{ lang.pick('Settings', 'الإعدادات') }}</button>
        </aside>
        <div class="admin-main">
        <p *ngIf="msg()" class="alert alert-info">{{ msg() }}</p>

        <!-- ANALYTICS -->
        <section *ngIf="tab()==='analytics'">
          <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
            <h5 class="mb-0">{{ lang.pick('Sales analytics', 'تحليلات المبيعات') }}</h5>
            <div class="d-flex gap-2 flex-wrap">
              <div class="view-switch">
                <button [class.active]="viewMode()==='preset' && preset()==='last-week'" (click)="setPreset('last-week')">{{ lang.pick('Last week', 'الأسبوع الماضي') }}</button>
                <button [class.active]="viewMode()==='preset' && preset()==='last-month'" (click)="setPreset('last-month')">{{ lang.pick('Last month', 'الشهر الماضي') }}</button>
              </div>
              <select class="form-select form-select-sm" style="width:auto" [ngModel]="viewMode()==='month' ? month() : ''" (ngModelChange)="setMonth($any($event))">
                <option value="">{{ lang.pick('Month...', 'شهر...') }}</option>
                <option *ngFor="let m of months" [value]="m.v">{{ lang.pick(m.en, m.ar) }}</option>
              </select>
              <select class="form-select form-select-sm" style="width:auto" [ngModel]="viewMode()==='year' ? year() : (viewMode()==='month' ? year() : '')" (ngModelChange)="onYearPick($any($event))">
                <option value="">{{ lang.pick('Year...', 'سنة...') }}</option>
                <option *ngFor="let y of years()" [value]="y">{{ y }}</option>
              </select>
            </div>
          </div>
          @if (top()[0]; as best) {
            <div class="panel mb-2 d-flex align-items-center gap-3" style="background:linear-gradient(135deg,#111827,#4c1d95);color:#fff;border:none">
              <app-icon name="trophy" [size]="34" />
              <div>
                <div class="small opacity-75">{{ lang.pick('Best seller', 'الأكثر مبيعا') }} · {{ rangeLabel() }}</div>
                <b class="fs-5">{{ best.name }}</b>
                <div class="small opacity-75">×{{ best.qty }} · {{ best.revenue | number:'1.2-2' }} JD</div>
              </div>
            </div>
          }
          <div class="panel mb-2">
            <h6>{{ lang.pick('Profit', 'الربح') }} · {{ rangeLabel() }}</h6>
            <div class="d-flex gap-3 flex-wrap">
              <div><div class="small text-muted">{{ lang.pick('Revenue', 'الإيراد') }}</div><b class="text-success">{{ rangeRevenue() | number:'1.2-2' }}</b></div>
              <div><div class="small text-muted">{{ lang.pick('Losses', 'المصاريف') }}</div><b class="text-danger">-{{ expensesTotal() | number:'1.2-2' }}</b></div>
              <div><div class="small text-muted">{{ lang.pick('Net profit', 'صافي الربح') }}</div><b class="fs-5">{{ profit() | number:'1.2-2' }} JD</b></div>
            </div>
          </div>
          <div class="panel mb-2">
            <h6>{{ lang.pick('Revenue (JD)', 'الإيراد') }} · {{ rangeLabel() }} · {{ lang.pick('total', 'المجموع') }} {{ rangeRevenue() | number:'1.2-2' }}</h6>
            <div class="chart">
              <div class="bar-col" *ngFor="let d of revenue(); let i = index">
                <div class="bar" [style.height.%]="barPct(d.revenue)"
                  (mouseenter)="showTip($event, fmt(d.revenue) + ' JD', d.orders + ' ' + lang.pick('orders', 'طلبات') + ' · ' + d.day)" (mousemove)="moveTip($event)" (mouseleave)="hideTip()"></div>
                <div class="bar-lab">{{ tickLabel(d, i) }}</div>
              </div>
            </div>
            @if (tip(); as t) {
              <div class="chart-tip" [style.left.px]="t.x" [style.top.px]="t.y">
                <b>{{ t.title }}</b>
                <div>{{ t.sub }}</div>
              </div>
            }
          </div>
          <div class="ov-grid" style="margin-top:0;margin-bottom:12px">
            <div class="panel">
              <h6>{{ lang.pick('Revenue share', 'توزيع الإيراد') }}</h6>              @if (donutSegs().length) {
                <div class="donut-wrap">
                  <svg viewBox="0 0 120 120" class="donut">
                    <circle cx="60" cy="60" r="48" fill="none" stroke="var(--bs-tertiary-bg)" stroke-width="18" />
                    @for (seg of donutSegs(); track seg.key) {
                      <circle cx="60" cy="60" r="48" fill="none" [attr.stroke]="seg.color" stroke-width="18"
                        pathLength="100" [attr.stroke-dasharray]="seg.pct + ' ' + (100 - seg.pct)"
                        [attr.stroke-dashoffset]="-seg.offset" transform="rotate(-90 60 60)"
                        (mouseenter)="showTip($event, seg.label + ' · ' + fmt(seg.pct, 0) + '%', fmt(mixTotal() * seg.pct / 100) + ' JD')" (mousemove)="moveTip($event)" (mouseleave)="hideTip()" style="cursor:pointer" />
                    }
                    <text x="60" y="67" text-anchor="middle" fill="currentColor" font-size="15" font-weight="800">{{ mixTotal() | number:'1.0-0' }}</text>
                  </svg>
                  <div class="donut-legend">
                    @for (seg of donutSegs(); track seg.key) {
                      <div><span class="donut-dot" [style.background]="seg.color"></span>{{ seg.label }} · {{ seg.pct | number:'1.0-0' }}%</div>
                    }
                  </div>
                </div>
              } @else {
                <p class="text-muted small mb-0">{{ lang.pick('No sales yet.', 'لا مبيعات بعد.') }}</p>
              }
            </div>
            <div class="panel">
              <h6>{{ lang.pick('Payment mix', 'طرق الدفع') }}</h6>
              @if (mix()?.payment?.length) {
                @for (p of mix().payment; track p.key) {
                  <div class="pay-row" (mouseenter)="showTip($event, fmt(p.revenue) + ' JD', payLabel(p.key) + ' · ' + p.orders + ' ' + lang.pick('orders', 'طلبات'))" (mousemove)="moveTip($event)" (mouseleave)="hideTip()">
                    <div class="d-flex justify-content-between"><span>{{ payLabel(p.key) }}</span><b>{{ p.revenue | number:'1.2-2' }}</b></div>
                    <div class="pay-track"><div class="pay-fill" [style.width.%]="payPct(p.revenue)"></div></div>
                  </div>
                }
                <div class="d-flex justify-content-between small mt-2"><span class="text-muted">{{ lang.pick('Avg. order', 'متوسط الطلب') }}</span><b>{{ mix().totals.avg_order | number:'1.2-2' }} JD</b></div>
                <div class="d-flex justify-content-between small"><span class="text-muted">{{ lang.pick('Items sold', 'الأصناف المباعة') }}</span><b>{{ mix().totals.items }}</b></div>
              } @else {
                <p class="text-muted small mb-0">{{ lang.pick('No sales yet.', 'لا مبيعات بعد.') }}</p>
              }
            </div>
          </div>
          <div class="panel mb-2">
            <h6>{{ lang.pick('Peak hours (orders)', 'ساعات الذروة') }}</h6>
            <div class="chart" style="height:140px">
              <div class="bar-col" *ngFor="let h of hours()">
                <div class="bar" [class.peak]="h.hour === peakHour()" [style.height.%]="hourPct(h.orders)"
                  (mouseenter)="showTip($event, h.orders + ' ' + lang.pick('orders', 'طلبات'), h.hour + ':00 · ' + fmt(h.revenue) + ' JD')" (mousemove)="moveTip($event)" (mouseleave)="hideTip()"></div>
                <div class="bar-lab">{{ h.hour }}</div>
              </div>
            </div>
            <div class="small text-muted">{{ lang.pick('Busiest:', 'الأزحم:') }} <b>{{ peakHour() }}:00</b></div>
          </div>
          <div class="ov-grid" style="margin-top:0;margin-bottom:12px">
            <div class="panel">
              <h6>{{ lang.pick('Sales by category', 'المبيعات حسب الفئة') }}</h6>
              @if (catSegs().length) {
                <div class="donut-wrap">
                  <svg viewBox="0 0 120 120" class="donut">
                    <circle cx="60" cy="60" r="48" fill="none" stroke="var(--bs-tertiary-bg)" stroke-width="18" />
                    @for (seg of catSegs(); track seg.key) {
                      <circle cx="60" cy="60" r="48" fill="none" [attr.stroke]="seg.color" stroke-width="18"
                        pathLength="100" [attr.stroke-dasharray]="seg.pct + ' ' + (100 - seg.pct)"
                        [attr.stroke-dashoffset]="-seg.offset" transform="rotate(-90 60 60)"
                        (mouseenter)="showTip($event, seg.label + ' · ' + fmt(seg.pct, 0) + '%', fmt(catTotal() * seg.pct / 100) + ' JD')" (mousemove)="moveTip($event)" (mouseleave)="hideTip()" style="cursor:pointer" />
                    }
                    <text x="60" y="67" text-anchor="middle" fill="currentColor" font-size="15" font-weight="800">{{ catTotal() | number:'1.0-0' }}</text>
                  </svg>
                  <div class="donut-legend">
                    @for (seg of catSegs(); track seg.key) {
                      <div><span class="donut-dot" [style.background]="seg.color"></span>{{ seg.label }} · {{ seg.pct | number:'1.0-0' }}%</div>
                    }
                  </div>
                </div>
              } @else {
                <p class="text-muted small mb-0">{{ lang.pick('No sales yet.', 'لا مبيعات بعد.') }}</p>
              }
            </div>
            <div class="panel">
              <h6>{{ lang.pick('Discounts & cancellations', 'الخصومات والإلغاءات') }}</h6>
              @if (discounts()) {
                <div class="d-flex justify-content-between small border-bottom py-1"><span class="text-muted">{{ lang.pick('Given away', 'قيمة الخصومات') }}</span><b>{{ discounts().totals.given | number:'1.2-2' }} JD</b></div>
                <div class="d-flex justify-content-between small border-bottom py-1"><span class="text-muted">{{ lang.pick('Discounted orders', 'طلبات مخفضة') }}</span><b>{{ discounts().totals.discounted_orders }}/{{ discounts().totals.orders }}</b></div>
                <div class="d-flex justify-content-between small border-bottom py-1"><span class="text-muted">{{ lang.pick('Cancel rate', 'نسبة الإلغاء') }}</span><b>{{ cancelRate() | number:'1.0-0' }}%</b></div>
                <div class="d-flex justify-content-between small py-1"><span class="text-muted">{{ lang.pick('Lost to cancels', 'ضائع بالإلغاء') }}</span><b>{{ discounts().cancelled.lost | number:'1.2-2' }} JD</b></div>
                @if (discounts().coupons.length) {
                  <div class="small text-muted mt-2 mb-1">{{ lang.pick('Top coupons', 'أفضل الكوبونات') }}</div>
                  @for (c of discounts().coupons; track c.code) {
                    <div class="d-flex justify-content-between small"><span><code>{{ c.code }}</code> ×{{ c.uses }}</span><b>{{ c.given | number:'1.2-2' }}</b></div>
                  }
                }
              }
            </div>
          </div>
          <div class="ov-grid" style="margin-top:0">
            <div class="panel">
              <h6>{{ lang.pick('Top products', 'الأكثر مبيعا') }}</h6>
              @if (top().length) {
                <div class="mb-0">
                  <div class="podium-row" *ngFor="let t of top(); let i = index"
                    (mouseenter)="showTip($event, t.name + ' ×' + t.qty, fmt(t.revenue) + ' JD')" (mousemove)="moveTip($event)" (mouseleave)="hideTip()">
                    <span class="podium-medal">{{ i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1) }}</span>
                    <div class="flex-grow-1">
                      <div class="d-flex justify-content-between small"><b>{{ t.name }}</b><span>{{ t.revenue | number:'1.2-2' }} JD</span></div>
                      <div class="podium-bar" [style.width.%]="topPct(t.qty)"></div>
                      <div class="small text-muted">×{{ t.qty }} {{ lang.pick('sold', 'مبيع') }}</div>
                    </div>
                  </div>
                </div>
              } @else {
                <p class="text-muted small mb-0">{{ lang.pick('No sales yet.', 'لا مبيعات بعد.') }}</p>
              }
            </div>
            <div class="panel">
              <h6>{{ lang.pick('Orders by status', 'الطلبات حسب الحالة') }}</h6>
              @if (overview()) {
                <ul class="list-unstyled mb-0 small">
                  <li class="d-flex justify-content-between border-bottom py-1"><span>{{ lang.pick('Pending', 'قيد الانتظار') }}</span><b>{{ overview().counts.orders.pending || 0 }}</b></li>
                  <li class="d-flex justify-content-between border-bottom py-1"><span>{{ lang.pick('Preparing', 'قيد التحضير') }}</span><b>{{ overview().counts.orders.preparing || 0 }}</b></li>
                  <li class="d-flex justify-content-between border-bottom py-1"><span>{{ lang.pick('Ready', 'جاهز') }}</span><b>{{ overview().counts.orders.ready || 0 }}</b></li>
                  <li class="d-flex justify-content-between border-bottom py-1"><span>{{ lang.pick('Completed', 'مكتمل') }}</span><b>{{ overview().counts.orders.completed || 0 }}</b></li>
                  <li class="d-flex justify-content-between py-1"><span>{{ lang.pick('Cancelled', 'ملغي') }}</span><b>{{ overview().counts.orders.cancelled || 0 }}</b></li>
                </ul>
              }
            </div>
          </div>
        </section>

        <!-- OVERVIEW: today ops command view -->
        <section *ngIf="tab()==='overview' && overview()">
          @if (overview().attention?.length) {
            <div class="alert alert-danger d-flex align-items-center gap-2">
              <b>⚠️ {{ overview().attention.length }} {{ lang.pick('orders waiting 15+ min:', 'طلبات تنتظر +15 دقيقة:') }}</b>
              <span>{{ attentionList() }}</span>
              <a routerLink="/kitchen" class="btn btn-sm btn-danger ms-auto">{{ lang.pick('Open kitchen', 'افتح المطبخ') }}</a>
            </div>
          }
          <h5 class="mb-2">{{ lang.pick('Live orders', 'الطلبات الحية') }}</h5>
          <div class="kpi-grid mb-2">
            <a routerLink="/orders" class="kpi kpi-link">
              <div class="kpi-icon"><app-icon name="orders" [size]="24" /></div><div class="kpi-num">{{ pendingCount() }}</div>
              <div class="kpi-label">{{ lang.pick('Pending', 'قيد الانتظار') }}</div>
            </a>
            <a routerLink="/kitchen" class="kpi kpi-link">
              <div class="kpi-icon"><app-icon name="kitchen" [size]="24" /></div><div class="kpi-num">{{ overview().counts.orders.preparing || 0 }}</div>
              <div class="kpi-label">{{ lang.pick('Preparing', 'قيد التحضير') }}</div>
            </a>
            <a routerLink="/orders" class="kpi kpi-link">
              <div class="kpi-icon"><app-icon name="check" [size]="24" /></div><div class="kpi-num">{{ overview().counts.orders.ready || 0 }}</div>
              <div class="kpi-label">{{ lang.pick('Ready', 'جاهز') }}</div>
            </a>
            <div class="kpi">
              <div class="kpi-icon"><app-icon name="alert" [size]="24" /></div><div class="kpi-num">{{ overview().lowStock.length }}</div>
              <div class="kpi-label">{{ lang.pick('Low-stock items', 'أصناف منخفضة') }}</div>
            </div>
          </div>
          <h5 class="mb-2">{{ lang.pick('Today so far', 'اليوم حتى الآن') }}</h5>
          <div class="kpi-grid mb-2">
            <div class="kpi"><div class="kpi-icon"><app-icon name="cash" [size]="24" /></div><div class="kpi-num">{{ overview().today.revenue_today | number:'1.2-2' }}</div><div class="kpi-label">{{ lang.pick('Revenue (JD)', 'الإيراد') }}</div></div>
            <div class="kpi"><div class="kpi-icon"><app-icon name="list" [size]="24" /></div><div class="kpi-num">{{ overview().today.orders_today }}</div><div class="kpi-label">{{ lang.pick('Orders', 'الطلبات') }}</div></div>
            <div class="kpi"><div class="kpi-icon"><app-icon name="pos" [size]="24" /></div><div class="kpi-num">{{ overview().today.avg_ticket | number:'1.2-2' }}</div><div class="kpi-label">{{ lang.pick('Avg. ticket', 'متوسط الفاتورة') }}</div></div>
            <div class="kpi"><div class="kpi-icon"><app-icon name="box" [size]="24" /></div><div class="kpi-num">{{ overview().counts.products }}</div><div class="kpi-label">{{ lang.pick('Products live', 'منتجات متاحة') }}</div></div>
          </div>
          <div class="ov-grid">
            <div class="panel">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <h6 class="mb-0">{{ lang.pick('Recent orders', 'الطلبات الأخيرة') }}</h6>
                <a routerLink="/orders" class="small">{{ lang.pick('View all →', 'عرض الكل ←') }}</a>
              </div>
              <table class="table table-sm align-middle" style="margin-bottom:0">
                <tr *ngFor="let o of overview().recentOrders">
                  <td><b>#{{ o.order_number }}</b><div class="small text-muted">{{ o.created_at | date:'shortTime' }}</div></td>
                  <td><span class="a-pill" [attr.data-s]="o.status">{{ o.status }}</span></td>
                  <td class="text-end fw-bold">{{ o.total_amount }}</td>
                </tr>
              </table>
            </div>
            <div class="panel">
              <h6>{{ lang.pick('Needs restock', 'يحتاج إعادة تخزين') }}</h6>
              @if (overview().lowStock.length) {
                <ul class="list-unstyled mb-0">
                  <li *ngFor="let s of overview().lowStock" class="d-flex justify-content-between border-bottom py-1 small">
                    <span>{{ s.product }} · {{ s.value_en }}</span><b class="text-danger">{{ s.quantity }}</b>
                  </li>
                </ul>
              } @else {
                <p class="text-muted small mb-0">{{ lang.pick('All stocked up ✓', 'المخزون ممتاز ✓') }}</p>
              }
              <hr />
              <div class="d-flex justify-content-between small"><span class="text-muted">{{ lang.pick('Total revenue', 'إجمالي الإيراد') }}</span><b>{{ overview().revenue.total | number:'1.2-2' }}</b></div>
            </div>
          </div>
        </section>

        <!-- PRODUCTS -->
        <section *ngIf="tab()==='products'">
          <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
            <h5 class="mb-0">{{ lang.pick('Products', 'المنتجات') }} ({{ products().length }})</h5>
            <div class="d-flex gap-2">
              <div class="view-switch">
                <button [class.active]="listView()==='table'" (click)="listView.set('table')">☰ {{ lang.pick('Table', 'جدول') }}</button>
                <button [class.active]="listView()==='cards'" (click)="listView.set('cards')">▦ {{ lang.pick('Cards', 'بطاقات') }}</button>
              </div>
              <button class="btn btn-success btn-sm" (click)="showAddProduct.set(true)">+ {{ lang.pick('Add product', 'إضافة منتج') }}</button>
            </div>
          </div>
          @if (listView() === 'cards') {
            <div class="grid-cards">
              <div class="g-card" *ngFor="let p of products()">
                <img class="g-img" [src]="prodImg(p)" [alt]="p.name_en" loading="lazy" />
                <div class="g-body">
                  <div class="g-name">{{ p.name_en }}</div>
                  <div class="g-sub">{{ p.name_ar }}</div>
                  <div class="g-price">JD {{ p.price || 0 }}</div>
                  <div class="g-actions">
                    <button class="btn btn-sm btn-outline-primary flex-grow-1" (click)="startEditProduct(p)">{{ lang.pick('Edit', 'تعديل') }}</button>
                    <button class="btn btn-sm btn-outline-danger" (click)="removeProduct(p)">✕</button>
                  </div>
                </div>
              </div>
            </div>
          } @else {
          <div class="admin-table-card">
          <table class="table table-sm">
            <tr><th></th><th>{{ lang.pick('Name EN / AR', 'الاسم EN / AR') }}</th><th></th></tr>
            <tr *ngFor="let p of products()">
              <td><img [src]="prodImg(p)" width="44" height="44" style="object-fit:cover;border-radius:12px" /></td>
              <td>{{ p.name_en }} / {{ p.name_ar }}</td>
              <td class="text-end text-nowrap">
                <button class="btn btn-sm btn-outline-primary me-1" (click)="startEditProduct(p)">{{ lang.pick('Edit', 'تعديل') }}</button>
                <button class="btn btn-sm btn-danger" (click)="removeProduct(p)">{{ lang.pick('Remove', 'حذف') }}</button>
              </td>
            </tr>
          </table>
          </div>
          }
        </section>

        <!-- CATEGORIES -->
        <section *ngIf="tab()==='categories'">
          <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
            <h5 class="mb-0">{{ lang.pick('Categories', 'الفئات') }} ({{ categories().length }})</h5>
            <div class="d-flex gap-2">
              <div class="view-switch">
                <button [class.active]="listView()==='table'" (click)="listView.set('table')">☰ {{ lang.pick('Table', 'جدول') }}</button>
                <button [class.active]="listView()==='cards'" (click)="listView.set('cards')">▦ {{ lang.pick('Cards', 'بطاقات') }}</button>
              </div>
              <button class="btn btn-success btn-sm" (click)="showAddCategory.set(true)">+ {{ lang.pick('Add category', 'إضافة فئة') }}</button>
            </div>
          </div>
          @if (listView() === 'cards') {
            <div class="grid-cards">
              <div class="g-card" *ngFor="let c of categories()">
                @if (c.image) { <img class="g-img" [src]="imgSrc(c.image)" [alt]="c.name_en" loading="lazy" /> }
                @else { <div class="g-ph"><app-icon name="grid" [size]="30" /></div> }
                <div class="g-body">
                  <div class="g-name">{{ c.name_en }}</div>
                  <div class="g-sub">{{ c.name_ar }}</div>
                  <div class="g-actions">
                    <button class="btn btn-sm btn-outline-primary flex-grow-1" (click)="editingCategory.set({ ...c })">{{ lang.pick('Edit', 'تعديل') }}</button>
                    <button class="btn btn-sm btn-outline-danger" (click)="removeCategory(c)">✕</button>
                  </div>
                </div>
              </div>
            </div>
          } @else {
          <div class="admin-table-card">
          <table class="table table-sm">
            <tr><th></th><th>{{ lang.pick('Name', 'الاسم') }}</th><th></th></tr>
            <tr *ngFor="let c of categories()">
              <td><img *ngIf="c.image" [src]="imgSrc(c.image)" width="44" height="44" style="object-fit:cover;border-radius:12px" /></td>
              <td>{{ c.name_en }} / {{ c.name_ar }}</td>
              <td class="text-end text-nowrap">
                <button class="btn btn-sm btn-outline-primary me-1" (click)="editingCategory.set({ ...c })">{{ lang.pick('Edit', 'تعديل') }}</button>
                <button class="btn btn-sm btn-danger" (click)="removeCategory(c)">{{ lang.pick('Remove', 'حذف') }}</button>
              </td>
            </tr>
          </table>
          </div>
          }
        </section>

        <!-- VIDEOS -->
        <section *ngIf="tab()==='videos'">
          <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
            <h5 class="mb-0">{{ lang.pick('Promo videos', 'فيديوهات ترويجية') }} ({{ videos().length }})</h5>
            <div class="d-flex gap-2">
              <div class="view-switch">
                <button [class.active]="listView()==='table'" (click)="listView.set('table')">☰ {{ lang.pick('Table', 'جدول') }}</button>
                <button [class.active]="listView()==='cards'" (click)="listView.set('cards')">▦ {{ lang.pick('Cards', 'بطاقات') }}</button>
              </div>
              <button class="btn btn-success btn-sm" (click)="showAddVideo.set(true)">+ {{ lang.pick('Add video', 'إضافة فيديو') }}</button>
            </div>
          </div>
          @if (listView() === 'cards') {
            <div class="grid-cards">
              <div class="g-card" *ngFor="let v of videos()">
                <div class="g-ph"><app-icon name="video" [size]="30" /></div>
                <div class="g-body">
                  <div class="g-name">{{ v.title_en }}</div>
                  <div class="g-sub text-truncate">{{ v.url }}</div>
                  <div class="g-sub">{{ v.is_active ? lang.pick('Active ✓', 'نشط ✓') : lang.pick('Inactive', 'غير نشط') }}</div>
                  <div class="g-actions">
                    <button class="btn btn-sm btn-outline-primary flex-grow-1" (click)="editingVideo.set({ ...v })">{{ lang.pick('Edit', 'تعديل') }}</button>
                    <button class="btn btn-sm btn-outline-danger" (click)="removeVideo(v)">✕</button>
                  </div>
                </div>
              </div>
            </div>
          } @else {
          <div class="admin-table-card">
          <table class="table table-sm">
            <tr><th>{{ lang.pick('Title', 'العنوان') }}</th><th>URL</th><th>{{ lang.pick('Active', 'نشط') }}</th><th></th></tr>
            <tr *ngFor="let v of videos()">
              <td>{{ v.title_en }}</td><td class="text-truncate" style="max-width:220px">{{ v.url }}</td><td>{{ v.is_active ? lang.pick('yes', 'نعم') : lang.pick('no', 'لا') }}</td>
              <td class="text-end text-nowrap">
                <button class="btn btn-sm btn-outline-primary me-1" (click)="editingVideo.set({ ...v })">{{ lang.pick('Edit', 'تعديل') }}</button>
                <button class="btn btn-sm btn-danger" (click)="removeVideo(v)">{{ lang.pick('Remove', 'حذف') }}</button>
              </td>
            </tr>
          </table>
          </div>
          }
        </section>

        <!-- EMPLOYEES -->
        <section *ngIf="tab()==='employees'">
          <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
            <h5 class="mb-0">{{ lang.pick('Employees', 'الموظفون') }} ({{ employees().length }})</h5>
            <div class="d-flex gap-2">
              <div class="view-switch">
                <button [class.active]="listView()==='table'" (click)="listView.set('table')">☰ {{ lang.pick('Table', 'جدول') }}</button>
                <button [class.active]="listView()==='cards'" (click)="listView.set('cards')">▦ {{ lang.pick('Cards', 'بطاقات') }}</button>
              </div>
              <button class="btn btn-success btn-sm" (click)="showAddEmployee.set(true)">+ {{ lang.pick('Add employee', 'إضافة موظف') }}</button>
            </div>
          </div>
          @if (listView() === 'cards') {
            <div class="grid-cards">
              <div class="g-card" *ngFor="let e of employees()">
                <div class="g-ph"><app-icon name="users" [size]="30" /></div>
                <div class="g-body">
                  <div class="g-name">{{ e.username }}</div>
                  <div class="g-sub">{{ e.role }}</div>
                  <div class="g-actions">
                    <button class="btn btn-sm btn-outline-danger flex-grow-1" (click)="removeEmployee(e)">{{ lang.pick('Remove', 'حذف') }}</button>
                  </div>
                </div>
              </div>
            </div>
          } @else {
          <div class="admin-table-card">
          <table class="table table-sm">
            <tr><th>{{ lang.pick('Username', 'اسم المستخدم') }}</th><th>{{ lang.pick('Role', 'الدور') }}</th><th></th></tr>
            <tr *ngFor="let e of employees()">
              <td>{{ e.username }}</td><td>{{ e.role }}</td>
              <td class="text-end"><button class="btn btn-sm btn-danger" (click)="removeEmployee(e)">{{ lang.pick('Remove', 'حذف') }}</button></td>
            </tr>
          </table>
          </div>
          }
        </section>

        <!-- OFFERS -->
        <section *ngIf="tab()==='offers'">
          <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
            <h5 class="mb-0">{{ lang.pick('Offers', 'العروض') }} ({{ offers().length }})</h5>
            <div class="d-flex gap-2">
              <div class="view-switch">
                <button [class.active]="listView()==='table'" (click)="listView.set('table')">☰ {{ lang.pick('Table', 'جدول') }}</button>
                <button [class.active]="listView()==='cards'" (click)="listView.set('cards')">▦ {{ lang.pick('Cards', 'بطاقات') }}</button>
              </div>
              <button class="btn btn-success btn-sm" (click)="openAddOffer()">+ {{ lang.pick('Add offer', 'إضافة عرض') }}</button>
            </div>
          </div>
          @if (listView() === 'cards') {
            <div class="grid-cards">
              <div class="g-card" *ngFor="let o of offers()">
                <div class="g-ph"><app-icon name="tag" [size]="30" /></div>
                <div class="g-body">
                  <div class="g-name">{{ o.title_en }}</div>
                  <div class="g-sub">{{ offerTypeLabel(o) }} · <b>{{ offerValueLabel(o) }}</b></div>
                  <div class="g-sub">{{ o.used_count }}{{ o.usage_limit ? '/' + o.usage_limit : '' }} · {{ o.is_active ? lang.pick('active', 'نشط') : lang.pick('off', 'مغلق') }}</div>
                  <div class="g-actions">
                    <button class="btn btn-sm btn-outline-primary flex-grow-1" (click)="startEditOffer(o)">{{ lang.pick('Edit', 'تعديل') }}</button>
                    <button class="btn btn-sm btn-outline-danger" (click)="removeOffer(o)">✕</button>
                  </div>
                </div>
              </div>
            </div>
          } @else {
          <div class="admin-table-card">
          <table class="table table-sm align-middle">
            <tr><th>{{ lang.pick('Offer', 'العرض') }}</th><th>{{ lang.pick('Type', 'النوع') }}</th><th>{{ lang.pick('Off', 'الخصم') }}</th><th>{{ lang.pick('Usage', 'الاستخدام') }}</th><th>{{ lang.pick('Ends', 'ينتهي') }}</th><th></th></tr>
            <tr *ngFor="let o of offers()" [class.table-light]="!o.is_active">
              <td>
                <b>{{ o.title_en }}</b>
                @if (!o.is_active) { <span class="badge text-bg-secondary ms-1">{{ lang.pick('off', 'مغلق') }}</span> }
                @if (o.coupon_code) { <div class="small"><code>{{ o.coupon_code }}</code></div> }
                @if (o.min_purchase_amount > 0) { <div class="small text-muted">{{ lang.pick('min', 'أدنى') }} {{ o.min_purchase_amount }} JD</div> }
              </td>
              <td><span class="badge" [class.text-bg-primary]="o.type==='coupon'" [class.text-bg-success]="o.type!=='coupon'">{{ offerTypeLabel(o) }}</span></td>
              <td><b>{{ offerValueLabel(o) }}</b></td>
              <td style="min-width:110px">
                <div class="small">{{ o.used_count }}{{ o.usage_limit ? '/' + o.usage_limit : ' ∞' }}</div>
                @if (o.usage_limit) {
                  <div class="progress" style="height:6px">
                    <div class="progress-bar" [class.bg-danger]="o.used_count >= o.usage_limit" [style.width.%]="100 * o.used_count / o.usage_limit"></div>
                  </div>
                }
              </td>
              <td class="small">{{ o.end_date | date:'shortDate' }}</td>
              <td class="text-end text-nowrap">
                <button class="btn btn-sm btn-outline-primary me-1" (click)="startEditOffer(o)">{{ lang.pick('Edit', 'تعديل') }}</button>
                <button class="btn btn-sm btn-danger" (click)="removeOffer(o)">{{ lang.pick('Remove', 'حذف') }}</button>
              </td>
            </tr>
          </table>
          </div>
          }
        </section>

        <!-- TABLES -->
        <section *ngIf="tab()==='tables'">
          <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
            <h5 class="mb-0">{{ lang.pick('Dining tables', 'طاولات الصالة') }} ({{ tables().length }})</h5>
            <button class="btn btn-success btn-sm" (click)="showAddTable.set(true)">+ {{ lang.pick('Add table', 'إضافة طاولة') }}</button>
          </div>
            <div class="grid-cards">
              <div class="g-card" *ngFor="let t of tables()" [class.occupied]="t.occupied">
                <div class="g-ph"><app-icon name="chair" [size]="30" /></div>
              <div class="g-body">
                <div class="g-name">{{ t.label }} <span class="g-sub">· {{ t.seats }} {{ lang.pick('seats', 'مقاعد') }}</span></div>
                <div class="g-sub">{{ t.occupied ? lang.pick('Occupied', 'مشغولة') + ' (' + t.active_orders.length + ')' : lang.pick('Free', 'فارغة') }}</div>
                <div class="g-actions">
                  <button class="btn btn-sm btn-outline-danger flex-grow-1" (click)="removeTable(t)">{{ lang.pick('Remove', 'حذف') }}</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- DAY CLOSE -->
        <section *ngIf="tab()==='dayclose'">
          <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
            <h5 class="mb-0">{{ lang.pick('End-of-day report', 'تقرير نهاية اليوم') }}</h5>
            <div class="d-flex gap-2">
              <input type="date" class="form-control form-control-sm" style="width:auto" [ngModel]="eodDate()" (ngModelChange)="eodDate.set($any($event));loadEod()" />
              <button class="btn btn-sm btn-outline-secondary" (click)="printEod()">🖨 {{ lang.pick('Print', 'طباعة') }}</button>
            </div>
          </div>
          @if (eod(); as r) {
            <div class="ov-grid" style="margin-top:0">
              <div class="panel">
                <h6>{{ r.day }}</h6>
                <div class="d-flex justify-content-between border-bottom py-1 small"><span class="text-muted">{{ lang.pick('Orders', 'الطلبات') }}</span><b>{{ r.summary.orders }}</b></div>
                <div class="d-flex justify-content-between border-bottom py-1 small"><span class="text-muted">{{ lang.pick('Gross', 'الإجمالي') }}</span><b>{{ r.summary.gross | number:'1.2-2' }}</b></div>
                <div class="d-flex justify-content-between border-bottom py-1 small"><span class="text-muted">{{ lang.pick('Discounts', 'الخصومات') }}</span><b>-{{ r.summary.discounts | number:'1.2-2' }}</b></div>
                <div class="d-flex justify-content-between border-bottom py-1 small"><span class="text-muted">{{ lang.pick('Loyalty', 'النقاط') }}</span><b>-{{ r.summary.loyalty | number:'1.2-2' }}</b></div>
                <div class="d-flex justify-content-between py-1"><span class="fw-bold">{{ lang.pick('NET', 'الصافي') }}</span><b class="fs-5">{{ r.summary.net | number:'1.2-2' }} JD</b></div>
                <div class="d-flex justify-content-between small"><span class="text-muted">{{ lang.pick('Avg. ticket', 'متوسط الفاتورة') }}</span><b>{{ r.summary.avg_ticket | number:'1.2-2' }}</b></div>
                <div class="d-flex justify-content-between small"><span class="text-muted">{{ lang.pick("Day's losses", 'مصاريف اليوم') }}</span><b class="text-danger">-{{ r.losses | number:'1.2-2' }}</b></div>
                <div class="d-flex justify-content-between small"><span class="text-muted">{{ lang.pick('Net after losses', 'الصافي بعد المصاريف') }}</span><b>{{ r.summary.net - r.losses | number:'1.2-2' }}</b></div>
              </div>
              <div class="panel">
                <h6>{{ lang.pick('By payment', 'حسب الدفع') }}</h6>
                @for (p of r.payment; track p.key) {
                  <div class="d-flex justify-content-between small border-bottom py-1"><span>{{ p.key }}</span><b>{{ p.revenue | number:'1.2-2' }} ({{ p.orders }})</b></div>
                }
                <h6 class="mt-3">{{ lang.pick('Coupons used', 'الكوبونات المستخدمة') }}</h6>
                @for (c of r.coupons; track c.code) {
                  <div class="d-flex justify-content-between small"><span><code>{{ c.code }}</code> ×{{ c.uses }}</span><b>{{ c.given | number:'1.2-2' }}</b></div>
                } @empty {
                  <p class="text-muted small mb-0">—</p>
                }
              </div>
            </div>
          }
        </section>

        <!-- EXPENSES -->
        <section *ngIf="tab()==='expenses'">
          <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
            <h5 class="mb-0">{{ lang.pick('Losses & expenses', 'المصاريف والخسائر') }} · <b>{{ expensesTotal() | number:'1.2-2' }} JD</b></h5>
            <button class="btn btn-success btn-sm" (click)="showAddExpense.set(true)">+ {{ lang.pick('Add loss', 'إضافة مصروف') }}</button>
          </div>
          <div class="admin-table-card">
            <table class="table table-sm align-middle">
              <tr><th>{{ lang.pick('Title', 'البيان') }}</th><th>{{ lang.pick('Category', 'الفئة') }}</th><th>{{ lang.pick('Date', 'التاريخ') }}</th><th>{{ lang.pick('Amount', 'المبلغ') }}</th><th></th></tr>
              <tr *ngFor="let x of expenses()">
                <td><b>{{ x.title }}</b>@if (x.notes) { <div class="small text-muted">{{ x.notes }}</div> }</td>
                <td><span class="a-pill">{{ expenseCatLabel(x.category) }}</span></td>
                <td class="small">{{ x.spent_at | date:'shortDate' }}</td>
                <td class="fw-bold text-danger">-{{ x.amount | number:'1.2-2' }}</td>
                <td class="text-end text-nowrap">
                  <button class="btn btn-sm btn-outline-primary me-1" (click)="startEditExpense(x)">{{ lang.pick('Edit', 'تعديل') }}</button>
                  <button class="btn btn-sm btn-outline-danger" (click)="removeExpense(x)">✕</button>
                </td>
              </tr>
            </table>
          </div>
          @if (expenseCats().length) {
            <div class="panel mt-2">
              <h6>{{ lang.pick('By category', 'حسب الفئة') }}</h6>
              @for (c of expenseCats(); track c.category) {
                <div class="d-flex justify-content-between small border-bottom py-1">
                  <span>{{ expenseCatLabel(c.category) }}</span><b>{{ c.total | number:'1.2-2' }}</b>
                </div>
              }
            </div>
          }
        </section>

        <!-- SETTINGS (shop name EN/AR + logo) -->
        <section *ngIf="tab()==='settings'">
          <h5>{{ lang.pick('Shop settings', 'إعدادات المتجر') }}</h5>
          <div class="card p-3" style="max-width:640px">
            <div class="row g-2">
              <div class="col-md-6"><label class="form-label">{{ lang.pick('Name (English)', 'الاسم (إنجليزي)') }}</label><input class="form-control" [(ngModel)]="shopForm().name_en" /></div>
              <div class="col-md-6"><label class="form-label">{{ lang.pick('Name (Arabic)', 'الاسم (عربي)') }}</label><input class="form-control" [(ngModel)]="shopForm().name_ar" /></div>
              <div class="col-md-9"><label class="form-label">{{ lang.pick('Logo URL', 'رابط الشعار') }}</label><input class="form-control" [(ngModel)]="shopForm().logo_url" placeholder="https://..." /></div>
              <div class="col-md-3 d-flex align-items-end">
                @if (shopForm().logo_url) { <img [src]="shopLogoPreview()" height="48" style="object-fit:contain" /> }
              </div>
              <div class="col-md-12"><input type="file" class="form-control" accept="image/jpeg,image/png,image/webp,image/gif" (change)="uploadShopLogo($event)" /></div>
              <div class="col-md-6">
                <label class="form-label">{{ lang.pick('Loyalty: points per JD', 'النقاط: نقطة لكل دينار') }}</label>
                <input class="form-control" type="number" min="0" step="0.1" [(ngModel)]="shopForm().loyalty_earn_per_jd" />
              </div>
              <div class="col-md-6">
                <label class="form-label">{{ lang.pick('Loyalty: JD per point', 'النقاط: دينار لكل نقطة') }}</label>
                <input class="form-control" type="number" min="0" step="0.01" [(ngModel)]="shopForm().loyalty_jd_per_point" />
              </div>
              <div class="col-md-12">
                <label class="form-label">{{ lang.pick('Phone numbers (up to 4, shown in footer)', 'أرقام الهواتف (حتى 4, تظهر في التذييل)') }}</label>
                <div class="d-flex flex-wrap gap-2 mb-2">
                  <span *ngFor="let p of shopForm().phones" class="badge text-bg-light border p-2">
                    <span dir="ltr">{{ p }}</span>
                    <button class="btn-close btn-close-sm ms-1" style="font-size:.6rem" (click)="removePhone(p)"></button>
                  </span>
                </div>
                <div class="d-flex gap-2">
                  <input class="form-control" [(ngModel)]="newPhone" inputmode="tel" placeholder="+962..." />
                  <button class="btn btn-outline-secondary btn-sm" (click)="addPhone()">{{ lang.pick('Add', 'إضافة') }}</button>
                </div>
              </div>
              <div class="col-md-6">
                <div class="card p-2">
                  <b class="small mb-2">☀️ {{ lang.pick('Light mode colors', 'ألوان الوضع الفاتح') }}</b>
                  <div *ngFor="let t of themeKeys" class="d-flex align-items-center gap-2 mb-1">
                    <input type="color" [(ngModel)]="shopForm().theme.light[t.k]" style="width:38px;height:30px;padding:0;border:none;background:none" />
                    <span class="small flex-grow-1">{{ lang.pick(t.en, t.ar) }}</span>
                    <code class="small text-muted">{{ shopForm().theme.light[t.k] }}</code>
                  </div>
                </div>
              </div>
              <div class="col-md-6">
                <div class="card p-2">
                  <b class="small mb-2">🌙 {{ lang.pick('Dark mode colors', 'ألوان الوضع الداكن') }}</b>
                  <div *ngFor="let t of themeKeys" class="d-flex align-items-center gap-2 mb-1">
                    <input type="color" [(ngModel)]="shopForm().theme.dark[t.k]" style="width:38px;height:30px;padding:0;border:none;background:none" />
                    <span class="small flex-grow-1">{{ lang.pick(t.en, t.ar) }}</span>
                    <code class="small text-muted">{{ shopForm().theme.dark[t.k] }}</code>
                  </div>
                </div>
              </div>
              <div class="col-md-6">
                <label class="form-label">{{ lang.pick('Navigation layout', 'شكل القائمة') }}</label>
                <select class="form-select" [(ngModel)]="shopForm().layout">
                  <option value="topbar">{{ lang.pick('Top bar', 'شريط علوي') }}</option>
                  <option value="sidebar">{{ lang.pick('Sidebar', 'شريط جانبي') }}</option>
                </select>
              </div>
            </div>
            <div class="mt-2 d-flex gap-2">
              <button class="btn btn-primary btn-sm" (click)="saveSettings()">{{ lang.pick('Save settings', 'حفظ الإعدادات') }}</button>
              <button class="btn btn-outline-secondary btn-sm" (click)="resetTheme()">{{ lang.pick('Reset colors', 'ألوان افتراضية') }}</button>
            </div>
          </div>
        </section>
        </div>
      </div>
    </div>

    <!-- ===== POPUPS ===== -->

    <!-- ADD PRODUCT -->
    <div *ngIf="showAddProduct()" class="modal d-block modal-popup" (click)="showAddProduct.set(false)">
      <div class="modal-dialog" (click)="$event.stopPropagation()">
        <div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">{{ lang.pick('Add product', 'إضافة منتج') }}</h5><button class="btn-close" (click)="showAddProduct.set(false)"></button></div>
          <div class="modal-body">
            <div class="row g-2">
              <div class="col-md-6"><input class="form-control" [(ngModel)]="newProduct.name_en" placeholder="{{ lang.pick('Name (English) *', 'الاسم (إنجليزي) *') }}" /></div>
              <div class="col-md-6"><input class="form-control" [(ngModel)]="newProduct.name_ar" placeholder="{{ lang.pick('Name (Arabic) *', 'الاسم (عربي) *') }}" /></div>
              <div class="col-md-6"><input class="form-control" [(ngModel)]="newProduct.shortDescription_en" placeholder="{{ lang.pick('Short desc (English)', 'وصف مختصر (إنجليزي)') }}" /></div>
              <div class="col-md-6"><input class="form-control" [(ngModel)]="newProduct.shortDescription_ar" placeholder="{{ lang.pick('Short desc (Arabic)', 'وصف مختصر (عربي)') }}" /></div>
              <div class="col-md-6"><input class="form-control" [(ngModel)]="newProduct.longDescription_en" placeholder="{{ lang.pick('Long desc (English)', 'وصف طويل (إنجليزي)') }}" /></div>
              <div class="col-md-6"><input class="form-control" [(ngModel)]="newProduct.longDescription_ar" placeholder="{{ lang.pick('Long desc (Arabic)', 'وصف طويل (عربي)') }}" /></div>
              <div class="col-md-9"><input class="form-control" [(ngModel)]="newProduct.image" placeholder="{{ lang.pick('image URL (required)', 'رابط الصورة (مطلوب)') }}" /></div>
              <div class="col-md-3"><input type="file" class="form-control" accept="image/jpeg,image/png,image/webp,image/gif" (change)="uploadProductImage($event)" /></div>
              <div class="col-md-6"><input class="form-control" type="number" min="0" step="0.01" [(ngModel)]="newProduct.price" placeholder="{{ lang.pick('Price (JD) *', 'السعر (دينار) *') }}" /></div>
              <div class="col-md-3"><input class="form-control" type="number" min="0" step="1" [(ngModel)]="newProduct.quantity" placeholder="{{ lang.pick('Stock (empty = ∞)', 'المخزون (فارغ = ∞)') }}" /></div>
              <div class="col-md-3">
                <select class="form-select" [(ngModel)]="newProduct.unit">
                  <option value="piece">{{ lang.pick('Piece', 'قطعة') }}</option>
                  <option value="kg">{{ lang.pick('Kg', 'كيلو') }}</option>
                  <option value="gram">{{ lang.pick('Gram', 'غرام') }}</option>
                </select>
              </div>
            </div>
            <div class="mt-2">
              <label class="form-label">{{ lang.pick('Categories * (tick at least one)', 'الفئات * (اختر واحدة على الأقل)') }}</label>
              <div class="d-flex gap-3 flex-wrap">
                <label *ngFor="let c of categories()" class="form-check">
                  <input type="checkbox" class="form-check-input" [checked]="newProduct.categoryIds.includes(c.id)" (change)="toggleProductCategory(c.id)" />
                  <span class="form-check-label">{{ c.name_en }} / {{ c.name_ar }}</span>
                </label>
              </div>
              <p *ngIf="!categories().length" class="text-muted small">{{ lang.pick('No categories yet - add one in the Categories tab first.', 'لا توجد فئات بعد - أضف واحدة من تبويب الفئات أولا.') }}</p>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline-secondary btn-sm" (click)="showAddProduct.set(false)">{{ lang.pick('Cancel', 'إلغاء') }}</button>
            <button class="btn btn-success btn-sm" (click)="addProduct()">{{ lang.pick('Add product', 'إضافة منتج') }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- EDIT PRODUCT -->
    <div *ngIf="editingProduct()" class="modal d-block modal-popup" (click)="cancelEditProduct()">
      <div class="modal-dialog" (click)="$event.stopPropagation()">
        <div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">{{ lang.pick('Edit product', 'تعديل منتج') }}</h5><button class="btn-close" (click)="cancelEditProduct()"></button></div>
          <div class="modal-body">
            <div class="row g-2">
              <div class="col-md-6"><input class="form-control" [(ngModel)]="editingProduct().name_en" placeholder="{{ lang.pick('Name (English)', 'الاسم (إنجليزي)') }}" /></div>
              <div class="col-md-6"><input class="form-control" [(ngModel)]="editingProduct().name_ar" placeholder="{{ lang.pick('Name (Arabic)', 'الاسم (عربي)') }}" /></div>
              <div class="col-md-6"><input class="form-control" [(ngModel)]="editingProduct().shortDescription_en" placeholder="{{ lang.pick('Short desc (English)', 'وصف مختصر (إنجليزي)') }}" /></div>
              <div class="col-md-6"><input class="form-control" [(ngModel)]="editingProduct().shortDescription_ar" placeholder="{{ lang.pick('Short desc (Arabic)', 'وصف مختصر (عربي)') }}" /></div>
              <div class="col-md-6"><input class="form-control" [(ngModel)]="editingProduct().longDescription_en" placeholder="{{ lang.pick('Long desc (English)', 'وصف طويل (إنجليزي)') }}" /></div>
              <div class="col-md-6"><input class="form-control" [(ngModel)]="editingProduct().longDescription_ar" placeholder="{{ lang.pick('Long desc (Arabic)', 'وصف طويل (عربي)') }}" /></div>
              <div class="col-md-9"><input class="form-control" [(ngModel)]="editingProduct().image" placeholder="{{ lang.pick('image URL', 'رابط الصورة') }}" /></div>
              <div class="col-md-3"><input type="file" class="form-control" accept="image/jpeg,image/png,image/webp,image/gif" (change)="uploadEditProductImage($event)" /></div>
              <div class="col-md-6"><input class="form-control" type="number" min="0" step="0.01" [(ngModel)]="editingProduct().price" placeholder="{{ lang.pick('Price (JD)', 'السعر (دينار)') }}" /></div>
              <div class="col-md-3"><input class="form-control" type="number" min="0" step="1" [(ngModel)]="editingProduct().quantity" placeholder="{{ lang.pick('Stock (empty = ∞)', 'المخزون (فارغ = ∞)') }}" /></div>
              <div class="col-md-3">
                <select class="form-select" [(ngModel)]="editingProduct().unit">
                  <option value="piece">{{ lang.pick('Piece', 'قطعة') }}</option>
                  <option value="kg">{{ lang.pick('Kg', 'كيلو') }}</option>
                  <option value="gram">{{ lang.pick('Gram', 'غرام') }}</option>
                </select>
              </div>
            </div>
            <div class="mt-2">
              <label class="form-label">{{ lang.pick('Categories', 'الفئات') }}</label>
              <div class="d-flex gap-3 flex-wrap">
                <label *ngFor="let c of categories()" class="form-check">
                  <input type="checkbox" class="form-check-input" [checked]="editingProduct().categoryIds.includes(c.id)" (change)="toggleEditProductCategory(c.id)" />
                  <span class="form-check-label">{{ c.name_en }} / {{ c.name_ar }}</span>
                </label>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline-secondary btn-sm" (click)="cancelEditProduct()">{{ lang.pick('Cancel', 'إلغاء') }}</button>
            <button class="btn btn-primary btn-sm" (click)="saveEditProduct()">{{ lang.pick('Save', 'حفظ') }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ADD CATEGORY -->
    <div *ngIf="showAddCategory()" class="modal d-block modal-popup" (click)="showAddCategory.set(false)">
      <div class="modal-dialog" (click)="$event.stopPropagation()">
        <div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">{{ lang.pick('Add category', 'إضافة فئة') }}</h5><button class="btn-close" (click)="showAddCategory.set(false)"></button></div>
          <div class="modal-body">
            <div class="row g-2">
              <div class="col-md-6"><input class="form-control" [(ngModel)]="newCategory.name_en" placeholder="{{ lang.pick('Name (English)', 'الاسم (إنجليزي)') }}" /></div>
              <div class="col-md-6"><input class="form-control" [(ngModel)]="newCategory.name_ar" placeholder="{{ lang.pick('Name (Arabic)', 'الاسم (عربي)') }}" /></div>
              <div class="col-md-6"><input class="form-control" [(ngModel)]="newCategory.image" placeholder="{{ lang.pick('image URL (required)', 'رابط الصورة (مطلوب)') }}" /></div>
              <div class="col-md-6"><input type="file" class="form-control" accept="image/jpeg,image/png,image/webp,image/gif" (change)="uploadCategoryImage($event)" /></div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline-secondary btn-sm" (click)="showAddCategory.set(false)">{{ lang.pick('Cancel', 'إلغاء') }}</button>
            <button class="btn btn-success btn-sm" (click)="addCategory()">{{ lang.pick('Add', 'إضافة') }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- EDIT CATEGORY -->
    <div *ngIf="editingCategory()" class="modal d-block modal-popup" (click)="editingCategory.set(null)">
      <div class="modal-dialog" (click)="$event.stopPropagation()">
        <div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">{{ lang.pick('Edit category', 'تعديل فئة') }}</h5><button class="btn-close" (click)="editingCategory.set(null)"></button></div>
          <div class="modal-body">
            <div class="row g-2">
              <div class="col-md-4"><input class="form-control" [(ngModel)]="editingCategory().name_en" placeholder="{{ lang.pick('Name (English)', 'الاسم (إنجليزي)') }}" /></div>
              <div class="col-md-4"><input class="form-control" [(ngModel)]="editingCategory().name_ar" placeholder="{{ lang.pick('Name (Arabic)', 'الاسم (عربي)') }}" /></div>
              <div class="col-md-4"><input class="form-control" [(ngModel)]="editingCategory().image" placeholder="{{ lang.pick('image URL', 'رابط الصورة') }}" /></div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline-secondary btn-sm" (click)="editingCategory.set(null)">{{ lang.pick('Cancel', 'إلغاء') }}</button>
            <button class="btn btn-primary btn-sm" (click)="saveEditCategory()">{{ lang.pick('Save', 'حفظ') }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ADD VIDEO -->
    <div *ngIf="showAddVideo()" class="modal d-block modal-popup" (click)="showAddVideo.set(false)">
      <div class="modal-dialog" (click)="$event.stopPropagation()">
        <div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">{{ lang.pick('Add video', 'إضافة فيديو') }}</h5><button class="btn-close" (click)="showAddVideo.set(false)"></button></div>
          <div class="modal-body">
            <div class="row g-2">
              <div class="col-md-6"><input class="form-control" [(ngModel)]="newVideo.title_en" placeholder="{{ lang.pick('Title (English)', 'العنوان (إنجليزي)') }}" /></div>
              <div class="col-md-6"><input class="form-control" [(ngModel)]="newVideo.url" placeholder="https://... / mp4" /></div>
              <div class="col-md-12"><input type="file" class="form-control" accept="video/mp4,video/webm,video/quicktime" (change)="uploadVideo($event)" /></div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline-secondary btn-sm" (click)="showAddVideo.set(false)">{{ lang.pick('Cancel', 'إلغاء') }}</button>
            <button class="btn btn-success btn-sm" (click)="addVideo()">{{ lang.pick('Add', 'إضافة') }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- EDIT VIDEO -->
    <div *ngIf="editingVideo()" class="modal d-block modal-popup" (click)="editingVideo.set(null)">
      <div class="modal-dialog" (click)="$event.stopPropagation()">
        <div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">{{ lang.pick('Edit video', 'تعديل فيديو') }}</h5><button class="btn-close" (click)="editingVideo.set(null)"></button></div>
          <div class="modal-body">
            <div class="row g-2">
              <div class="col-md-6"><input class="form-control" [(ngModel)]="editingVideo().title_en" placeholder="{{ lang.pick('Title (English)', 'العنوان (إنجليزي)') }}" /></div>
              <div class="col-md-6"><input class="form-control" [(ngModel)]="editingVideo().title_ar" placeholder="{{ lang.pick('Title (Arabic)', 'العنوان (عربي)') }}" /></div>
              <div class="col-md-12"><input class="form-control" [(ngModel)]="editingVideo().url" placeholder="{{ lang.pick('video URL', 'رابط الفيديو') }}" /></div>
              <div class="col-md-6"><input class="form-control" type="number" [(ngModel)]="editingVideo().sort_order" placeholder="{{ lang.pick('sort order', 'الترتيب') }}" /></div>
              <div class="col-md-6 form-check mt-2">
                <input type="checkbox" class="form-check-input" [(ngModel)]="editingVideo().is_active" id="editVideoActive" />
                <label class="form-check-label" for="editVideoActive">{{ lang.pick('Active', 'نشط') }}</label>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline-secondary btn-sm" (click)="editingVideo.set(null)">{{ lang.pick('Cancel', 'إلغاء') }}</button>
            <button class="btn btn-primary btn-sm" (click)="saveEditVideo()">{{ lang.pick('Save', 'حفظ') }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ADD EMPLOYEE -->
    <div *ngIf="showAddEmployee()" class="modal d-block modal-popup" (click)="showAddEmployee.set(false)">
      <div class="modal-dialog" (click)="$event.stopPropagation()">
        <div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">{{ lang.pick('Add employee', 'إضافة موظف') }}</h5><button class="btn-close" (click)="showAddEmployee.set(false)"></button></div>
          <div class="modal-body">
            <div class="row g-2">
              <div class="col-md-4"><input class="form-control" [(ngModel)]="newEmployee.username" placeholder="{{ lang.pick('Username', 'اسم المستخدم') }}" /></div>
              <div class="col-md-4"><input class="form-control" [(ngModel)]="newEmployee.password" type="password" placeholder="{{ lang.pick('Password', 'كلمة المرور') }}" /></div>
              <div class="col-md-4">
                <select class="form-select" [(ngModel)]="newEmployee.role">
                  <option value="cashier">{{ lang.pick('cashier', 'كاشير') }}</option>
                  <option value="kitchen">{{ lang.pick('kitchen', 'مطبخ') }}</option>
                  <option value="admin">{{ lang.pick('admin', 'مدير') }}</option>
                </select>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline-secondary btn-sm" (click)="showAddEmployee.set(false)">{{ lang.pick('Cancel', 'إلغاء') }}</button>
            <button class="btn btn-success btn-sm" (click)="addEmployee()">{{ lang.pick('Add', 'إضافة') }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ADD TABLE -->
    <div *ngIf="showAddTable()" class="modal d-block modal-popup" (click)="showAddTable.set(false)">
      <div class="modal-dialog" (click)="$event.stopPropagation()">
        <div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">{{ lang.pick('Add table', 'إضافة طاولة') }}</h5><button class="btn-close" (click)="showAddTable.set(false)"></button></div>
          <div class="modal-body">
            <div class="row g-2">
              <div class="col-md-6"><input class="form-control" [(ngModel)]="newTable.label" placeholder="T1" /></div>
              <div class="col-md-6"><input class="form-control" type="number" min="1" [(ngModel)]="newTable.seats" placeholder="{{ lang.pick('Seats', 'مقاعد') }}" /></div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline-secondary btn-sm" (click)="showAddTable.set(false)">{{ lang.pick('Cancel', 'إلغاء') }}</button>
            <button class="btn btn-success btn-sm" (click)="addTable()">{{ lang.pick('Add', 'إضافة') }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ADD EXPENSE -->
    <div *ngIf="showAddExpense()" class="modal d-block modal-popup" (click)="showAddExpense.set(false)">
      <div class="modal-dialog" (click)="$event.stopPropagation()">
        <div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">{{ lang.pick('Add loss', 'إضافة مصروف') }}</h5><button class="btn-close" (click)="showAddExpense.set(false)"></button></div>
          <div class="modal-body">
            <div class="row g-2">
              <div class="col-md-6"><input class="form-control" [(ngModel)]="newExpense.title" placeholder="{{ lang.pick('What? e.g. Meat supplier', 'البيان؟ مثال: مورد اللحوم') }}" /></div>
              <div class="col-md-6"><input class="form-control" type="number" min="0" step="0.01" [(ngModel)]="newExpense.amount" placeholder="{{ lang.pick('Amount (JD)', 'المبلغ') }}" /></div>
              <div class="col-md-6">
                <select class="form-select" [(ngModel)]="newExpense.category">
                  <option *ngFor="let c of expenseCatOptions" [value]="c">{{ expenseCatLabel(c) }}</option>
                </select>
              </div>
              <div class="col-md-6"><input class="form-control" type="date" [(ngModel)]="newExpense.spentAt" /></div>
              <div class="col-md-12"><input class="form-control" [(ngModel)]="newExpense.notes" placeholder="{{ lang.pick('Notes (optional)', 'ملاحظات') }}" /></div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline-secondary btn-sm" (click)="showAddExpense.set(false)">{{ lang.pick('Cancel', 'إلغاء') }}</button>
            <button class="btn btn-success btn-sm" (click)="addExpense()">{{ lang.pick('Add', 'إضافة') }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- EDIT EXPENSE -->
    @if (editingExpense(); as ef) {
      <div class="modal d-block modal-popup" (click)="editingExpense.set(null)">
        <div class="modal-dialog" (click)="$event.stopPropagation()">
          <div class="modal-content">
            <div class="modal-header"><h5 class="modal-title">{{ lang.pick('Edit loss', 'تعديل مصروف') }}</h5><button class="btn-close" (click)="editingExpense.set(null)"></button></div>
            <div class="modal-body">
              <div class="row g-2">
                <div class="col-md-6"><input class="form-control" [(ngModel)]="ef.title" /></div>
                <div class="col-md-6"><input class="form-control" type="number" min="0" step="0.01" [(ngModel)]="ef.amount" /></div>
                <div class="col-md-6">
                  <select class="form-select" [(ngModel)]="ef.category">
                    <option *ngFor="let c of expenseCatOptions" [value]="c">{{ expenseCatLabel(c) }}</option>
                  </select>
                </div>
                <div class="col-md-6"><input class="form-control" type="date" [(ngModel)]="ef.spentAt" /></div>
                <div class="col-md-12"><input class="form-control" [(ngModel)]="ef.notes" /></div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline-secondary btn-sm" (click)="editingExpense.set(null)">{{ lang.pick('Cancel', 'إلغاء') }}</button>
              <button class="btn btn-primary btn-sm" (click)="saveEditExpense()">{{ lang.pick('Save', 'حفظ') }}</button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- OFFER FORM (shared by add + edit) -->
    <ng-template #offerForm let-f="f" let-onPick="onPick">
      <div class="row g-2">
        <div class="col-md-6"><input class="form-control" [(ngModel)]="f.title_en" placeholder="{{ lang.pick('Title (English) *', 'العنوان (إنجليزي) *') }}" /></div>
        <div class="col-md-6"><input class="form-control" [(ngModel)]="f.title_ar" placeholder="{{ lang.pick('Title (Arabic)', 'العنوان (عربي)') }}" /></div>
        <div class="col-md-6"><input class="form-control" [(ngModel)]="f.description_en" placeholder="{{ lang.pick('Description (English)', 'الوصف (إنجليزي)') }}" /></div>
        <div class="col-md-6"><input class="form-control" [(ngModel)]="f.description_ar" placeholder="{{ lang.pick('Description (Arabic)', 'الوصف (عربي)') }}" /></div>
        <div class="col-md-12">
          <label class="form-label">{{ lang.pick('Type', 'النوع') }}</label>
          <select class="form-select" [(ngModel)]="f.type" (ngModelChange)="onOfferTypeChange(f)">
            <option value="percentage_discount">{{ lang.pick('Percentage off (auto)', 'خصم نسبة (تلقائي)') }}</option>
            <option value="fixed_discount">{{ lang.pick('Fixed amount off (auto)', 'خصم مبلغ ثابت (تلقائي)') }}</option>
            <option value="bogo">{{ lang.pick('Buy X Get Y (auto)', 'اشترِ واحصل (تلقائي)') }}</option>
            <option value="coupon">{{ lang.pick('Coupon code', 'كوبون') }}</option>
          </select>
          <div class="form-text">{{ offerTypeHint(f) }}</div>
        </div>

        @if (f.type === 'percentage_discount' || f.type === 'fixed_discount') {
          <div class="col-md-6">
            <label class="form-label">{{ f.type === 'percentage_discount' ? lang.pick('Percent %', 'النسبة %') : lang.pick('Amount (JD)', 'المبلغ (دينار)') }}</label>
            <input class="form-control" type="number" min="0" step="0.01" [(ngModel)]="f.discountValue" />
          </div>
          <div class="col-md-6"><label class="form-label">{{ lang.pick('Min. purchase (JD)', 'أدنى شراء') }}</label><input class="form-control" type="number" min="0" step="0.01" [(ngModel)]="f.minPurchase" /></div>
        }

        @if (f.type === 'coupon') {
          <div class="col-md-4"><label class="form-label">{{ lang.pick('Coupon code *', 'رمز الكوبون *') }}</label><input class="form-control" [(ngModel)]="f.couponCode" placeholder="SAVE10" /></div>
          <div class="col-md-4"><label class="form-label">{{ lang.pick('Value', 'القيمة') }}</label><input class="form-control" type="number" min="0" step="0.01" [(ngModel)]="f.discountValue" /></div>
          <div class="col-md-4">
            <label class="form-label">{{ lang.pick('Value type', 'نوع القيمة') }}</label>
            <select class="form-select" [(ngModel)]="f.discountNature">
              <option value="percentage">{{ lang.pick('Percent %', 'نسبة %') }}</option>
              <option value="fixed">{{ lang.pick('Fixed JD', 'مبلغ ثابت') }}</option>
            </select>
          </div>
          <div class="col-md-6"><label class="form-label">{{ lang.pick('Min. purchase (JD)', 'أدنى شراء') }}</label><input class="form-control" type="number" min="0" step="0.01" [(ngModel)]="f.minPurchase" /></div>
          <div class="col-md-6"><label class="form-label">{{ lang.pick('Usage limit', 'حد الاستخدام') }}</label><input class="form-control" type="number" min="0" step="1" [(ngModel)]="f.usageLimit" placeholder="{{ lang.pick('unlimited', 'غير محدود') }}" /></div>
        }

        @if (f.type === 'bogo') {
          <div class="col-md-6"><label class="form-label">{{ lang.pick('Usage limit', 'حد الاستخدام') }}</label><input class="form-control" type="number" min="0" step="1" [(ngModel)]="f.usageLimit" placeholder="{{ lang.pick('unlimited', 'غير محدود') }}" /></div>
          <div class="col-md-6"><label class="form-label">{{ lang.pick('Min. purchase (JD)', 'أدنى شراء') }}</label><input class="form-control" type="number" min="0" step="0.01" [(ngModel)]="f.minPurchase" /></div>
          <div class="col-md-3">
            <label class="form-label">{{ lang.pick('Buy product *', 'منتج الشراء *') }}</label>
            <select class="form-select" [(ngModel)]="f.bogoBuyProductId">
              <option value="">{{ lang.pick('Choose...', 'اختر...') }}</option>
              <option *ngFor="let p of products()" [value]="p.id">{{ p.name_en }}</option>
            </select>
          </div>
          <div class="col-md-3"><label class="form-label">{{ lang.pick('Buy qty', 'كمية الشراء') }}</label><input class="form-control" type="number" min="1" [(ngModel)]="f.bogoBuyQuantity" /></div>
          <div class="col-md-3">
            <label class="form-label">{{ lang.pick('Free product *', 'المنتج المجاني *') }}</label>
            <select class="form-select" [(ngModel)]="f.bogoGetProductId">
              <option value="">{{ lang.pick('Choose...', 'اختر...') }}</option>
              <option *ngFor="let p of products()" [value]="p.id">{{ p.name_en }}</option>
            </select>
          </div>
          <div class="col-md-3"><label class="form-label">{{ lang.pick('Free qty', 'الكمية المجانية') }}</label><input class="form-control" type="number" min="1" [(ngModel)]="f.bogoGetQuantity" /></div>
        }

        @if (f.type !== 'coupon' && f.type !== 'bogo') {
          <div class="col-md-6"><label class="form-label">{{ lang.pick('Usage limit', 'حد الاستخدام') }}</label><input class="form-control" type="number" min="0" step="1" [(ngModel)]="f.usageLimit" placeholder="{{ lang.pick('unlimited', 'غير محدود') }}" /></div>
        }

        <div class="col-md-4"><label class="form-label">{{ lang.pick('Starts', 'يبدأ') }}</label><input class="form-control" type="date" [(ngModel)]="f.startDate" /></div>
        <div class="col-md-4"><label class="form-label">{{ lang.pick('Ends', 'ينتهي') }}</label><input class="form-control" type="date" [(ngModel)]="f.endDate" /></div>
        <div class="col-md-4 form-check mt-4">
          <input type="checkbox" class="form-check-input" [(ngModel)]="f.isActive" id="offerActive" />
          <label class="form-check-label" for="offerActive">{{ lang.pick('Active', 'نشط') }}</label>
        </div>
        <div class="col-md-9"><label class="form-label">{{ lang.pick('Image (shown on home)', 'الصورة (تظهر في الرئيسية)') }}</label><input class="form-control" [(ngModel)]="f.image" placeholder="https://... / /uploads/..." /></div>
        <div class="col-md-3"><label class="form-label">&nbsp;</label><input type="file" class="form-control" accept="image/jpeg,image/png,image/webp,image/gif" (change)="uploadOfferImage($event, f)" /></div>
        <div class="col-md-12">
          <label class="form-label">{{ lang.pick('Applies to (empty = whole order)', 'ينطبق على (فارغ = كل الطلب)') }}</label>
          <div class="d-flex gap-3 flex-wrap border rounded p-2" style="max-height:140px;overflow-y:auto">
            <label *ngFor="let p of products()" class="form-check">
              <input type="checkbox" class="form-check-input" [checked]="f.targetProductIds.includes(p.id)" (change)="onPick(f, p.id)" />
              <span class="form-check-label">{{ p.name_en }}</span>
            </label>
          </div>
        </div>
      </div>
    </ng-template>

    <!-- ADD OFFER -->
    <div *ngIf="showAddOffer()" class="modal d-block modal-popup" (click)="showAddOffer.set(false)">
      <div class="modal-dialog modal-lg" (click)="$event.stopPropagation()">
        <div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">{{ lang.pick('Add offer', 'إضافة عرض') }}</h5><button class="btn-close" (click)="showAddOffer.set(false)"></button></div>
          <div class="modal-body">
            <ng-container *ngTemplateOutlet="offerForm; context: { f: newOffer, onPick: toggleNewOfferTarget }"></ng-container>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline-secondary btn-sm" (click)="showAddOffer.set(false)">{{ lang.pick('Cancel', 'إلغاء') }}</button>
            <button class="btn btn-success btn-sm" (click)="addOffer()">{{ lang.pick('Add', 'إضافة') }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- EDIT OFFER -->
    @if (editingOffer(); as ef) {
      <div class="modal d-block modal-popup" (click)="editingOffer.set(null)">
        <div class="modal-dialog modal-lg" (click)="$event.stopPropagation()">
          <div class="modal-content">
            <div class="modal-header"><h5 class="modal-title">{{ lang.pick('Edit offer', 'تعديل عرض') }}</h5><button class="btn-close" (click)="editingOffer.set(null)"></button></div>
            <div class="modal-body">
              <ng-container *ngTemplateOutlet="offerForm; context: { f: ef, onPick: toggleEditOfferTarget }"></ng-container>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline-secondary btn-sm" (click)="editingOffer.set(null)">{{ lang.pick('Cancel', 'إلغاء') }}</button>
              <button class="btn btn-primary btn-sm" (click)="saveEditOffer()">{{ lang.pick('Save', 'حفظ') }}</button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class AdminComponent implements OnInit {
  private api = inject(ApiService);
  private shop = inject(ShopService);
  private print = inject(PrintService);
  lang = inject(LangService);
  tab = signal<Tab>('overview');
  msg = signal('');
  overview = signal<any | null>(null);
  revenue = signal<any[]>([]);
  top = signal<any[]>([]);
  mix = signal<any | null>(null);
  tip = signal<{ x: number; y: number; title: string; sub: string } | null>(null);
  hours = signal<any[]>([]);
  catSales = signal<any[]>([]);
  discounts = signal<any | null>(null);
  years = signal<number[]>([]);
  range = signal(7);
  year = signal(new Date().getFullYear());
  month = signal(new Date().getMonth() + 1);
  preset = signal('last-week');
  viewMode = signal<'days' | 'preset' | 'month' | 'year'>('preset');
  readonly months = [
    { v: 1, en: 'Jan', ar: 'كانون2' }, { v: 2, en: 'Feb', ar: 'شباط' }, { v: 3, en: 'Mar', ar: 'آذار' },
    { v: 4, en: 'Apr', ar: 'نيسان' }, { v: 5, en: 'May', ar: 'أيار' }, { v: 6, en: 'Jun', ar: 'حزيران' },
    { v: 7, en: 'Jul', ar: 'تموز' }, { v: 8, en: 'Aug', ar: 'آب' }, { v: 9, en: 'Sep', ar: 'أيلول' },
    { v: 10, en: 'Oct', ar: 'تشرين1' }, { v: 11, en: 'Nov', ar: 'تشرين2' }, { v: 12, en: 'Dec', ar: 'كانون1' },
  ];
  products = signal<any[]>([]);
  categories = signal<any[]>([]);
  videos = signal<any[]>([]);
  employees = signal<any[]>([]);

  showAddProduct = signal(false);
  showAddCategory = signal(false);
  showAddVideo = signal(false);
  showAddEmployee = signal(false);
  showAddOffer = signal(false);
  showAddTable = signal(false);
  showAddExpense = signal(false);
  listView = signal<'table' | 'cards'>('table');

  newProduct: any = { name_en: '', name_ar: '', shortDescription_en: '', shortDescription_ar: '', longDescription_en: '', longDescription_ar: '', image: '', price: null as number | null, quantity: null as number | null, unit: 'piece', categoryIds: [] as string[] };
  readonly unitAr: Record<string, string> = { piece: 'قطعة', kg: 'كيلو', gram: 'غرام' };
  newCategory: any = { name_en: '', name_ar: '', image: '' };
  newVideo: any = { title_en: '', url: '' };
  newEmployee: any = { username: '', password: '', role: 'cashier' };
  tables = signal<any[]>([]);
  newTable: any = { label: '', seats: 4 };
  expenses = signal<any[]>([]);
  expensesTotal = signal(0);
  expenseCats = signal<any[]>([]);
  newExpense: any = { title: '', amount: null as number | null, category: 'other', spentAt: '', notes: '' };
  editingExpense = signal<any | null>(null);
  readonly expenseCatOptions = ['rent', 'salaries', 'food-cost', 'waste', 'utilities', 'marketing', 'other'];
  eod = signal<any | null>(null);
  eodDate = signal(new Date().toISOString().slice(0, 10));
  loadEod() {
    this.api.eod(this.eodDate()).subscribe({ next: (r) => this.eod.set(r), error: (e) => this.err(e, 'Load failed') });
  }
  printEod() {
    const r = this.eod();
    if (r) this.print.eod(r);
  }
  offers = signal<any[]>([]);
  editingOffer = signal<any | null>(null);
  newOffer: any = this.blankOffer();

  blankOffer() {
    const today = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const end = new Date(today);
    end.setDate(end.getDate() + 30);
    return {
      title_en: '', title_ar: '', description_en: '', description_ar: '', image: '',
      type: 'percentage_discount', discountValue: 10, discountNature: 'percentage',
      couponCode: '', minPurchase: 0, usageLimit: null as number | null,
      startDate: iso(today), endDate: iso(end), isActive: true,
      targetProductIds: [] as string[],
      bogoBuyProductId: '', bogoBuyQuantity: 1, bogoGetProductId: '', bogoGetQuantity: 1,
    };
  }

  toggleOfferIds(list: string[], id: string) {
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1); else list.push(id);
  }
  toggleNewOfferTarget = (form: any, id: string) => this.toggleOfferIds(form.targetProductIds, id);
  toggleEditOfferTarget = (form: any, id: string) => this.toggleOfferIds(form.targetProductIds, id);

  openAddOffer() { this.newOffer = this.blankOffer(); this.msg.set(''); this.showAddOffer.set(true); }

  offerTypeLabel(o: any): string {
    if (o.type === 'coupon') return '🎟️ ' + this.lang.pick('Coupon', 'كوبون');
    if (o.type === 'bogo') return this.lang.pick('BOGO', 'اشترِ واحصل');
    if (o.type === 'percentage_discount') return '% ' + this.lang.pick('off', 'خصم');
    return this.lang.pick('JD off', 'خصم دينار');
  }

  offerValueLabel(o: any): string {
    if (o.type === 'bogo') return `${o.bogo_buy_qty || 1}→${o.bogo_get_qty || 1}`;
    const n = Number(o.discount_value) || 0;
    const pct = o.type === 'percentage_discount' || o.discount_nature === 'percentage';
    return pct ? `${n}%` : `${n} JD`;
  }

  onOfferTypeChange(f: any) {
    // auto types imply their nature; coupons keep the user's choice
    if (f.type === 'percentage_discount') f.discountNature = 'percentage';
    if (f.type === 'fixed_discount') f.discountNature = 'fixed';
  }

  offerTypeHint(f: any): string {
    switch (f?.type) {
      case 'percentage_discount': return this.lang.pick('Auto-applies the best % off at checkout.', 'يُطبق تلقائيا أفضل خصم نسبة عند الدفع.');
      case 'fixed_discount': return this.lang.pick('Auto-applies a fixed JD amount off at checkout.', 'يُطبق تلقائيا مبلغا ثابتا عند الدفع.');
      case 'bogo': return this.lang.pick('Buy X of one product, get Y of another free. Auto-applied.', 'اشترِ X واحصل على Y مجانا. يُطبق تلقائيا.');
      case 'coupon': return this.lang.pick('Only applies when the customer types the code.', 'يُطبق فقط عند إدخال الزبون للرمز.');
      default: return '';
    }
  }

  validateOffer(f: any): string | null {
    const L = (en: string, ar: string) => this.lang.pick(en, ar);
    if (!f.title_en?.trim()) return L('Title required', 'العنوان مطلوب');
    if (!f.startDate || !f.endDate) return L('Start + end dates required', 'تاريخ البدء والانتهاء مطلوبان');
    if (f.endDate < f.startDate) return L('End date must be after start date', 'تاريخ الانتهاء يجب أن يكون بعد البدء');
    if (f.type === 'coupon' && !f.couponCode?.trim()) return L('Coupon code required', 'رمز الكوبون مطلوب');
    if (f.type !== 'bogo') {
      const v = Number(f.discountValue) || 0;
      if (v <= 0) return L('Discount value must be greater than 0', 'يجب أن تكون القيمة أكبر من صفر');
      const nature = f.type === 'percentage_discount' ? 'percentage' : f.type === 'fixed_discount' ? 'fixed' : f.discountNature;
      if (nature === 'percentage' && v > 100) return L('Percent cannot exceed 100', 'النسبة لا تتجاوز 100');
    } else {
      if (!f.bogoBuyProductId) return L('Buy product required', 'منتج الشراء مطلوب');
      if (!f.bogoGetProductId) return L('Free product required', 'المنتج المجاني مطلوب');
    }
    return null;
  }

  offerPayload(f: any) {
    return {
      title_en: f.title_en, title_ar: f.title_ar || '',
      description_en: f.description_en || '', description_ar: f.description_ar || '',
      image: f.image || '',
      type: f.type, discountValue: Number(f.discountValue) || 0, discountNature: f.discountNature,
      couponCode: f.couponCode?.trim() || null,
      minPurchase: Number(f.minPurchase) || 0,
      usageLimit: f.usageLimit === null || f.usageLimit === '' ? null : Math.max(1, Math.floor(Number(f.usageLimit))),
      startDate: f.startDate, endDate: f.endDate, isActive: !!f.isActive,
      targetProductIds: f.targetProductIds,
      bogoBuyProductId: f.bogoBuyProductId || null, bogoBuyQuantity: Math.max(1, Number(f.bogoBuyQuantity) || 1),
      bogoGetProductId: f.bogoGetProductId || null, bogoGetQuantity: Math.max(1, Number(f.bogoGetQuantity) || 1),
    };
  }

  addOffer() {
    const err = this.validateOffer(this.newOffer);
    if (err) { this.msg.set(err); return; }
    this.api.createOffer(this.offerPayload(this.newOffer)).subscribe({
      next: () => { this.showAddOffer.set(false); this.msg.set(this.lang.pick('Offer added', 'تمت إضافة العرض')); this.loadAll(); },
      error: (e) => this.err(e, this.lang.pick('Add offer failed', 'فشلت إضافة العرض')),
    });
  }
  startEditOffer(o: any) {
    this.msg.set('');
    this.api.offerDetail(o.id).subscribe({
      next: (d) => this.editingOffer.set({
        id: d.id, title_en: d.title_en, title_ar: d.title_ar || '',
        description_en: d.description_en || '', description_ar: d.description_ar || '',
        image: d.image || '',
        type: d.type, discountValue: Number(d.discount_value) || 0, discountNature: d.discount_nature || 'fixed',
        couponCode: d.coupon_code || '', minPurchase: Number(d.min_purchase_amount) || 0,
        usageLimit: d.usage_limit ?? null,
        startDate: String(d.start_date).slice(0, 10), endDate: String(d.end_date).slice(0, 10),
        isActive: !!d.is_active, targetProductIds: [...(d.targetProductIds || [])],
        bogoBuyProductId: d.bogo_buy_product_id || '', bogoBuyQuantity: d.bogo_buy_qty || 1,
        bogoGetProductId: d.bogo_get_product_id || '', bogoGetQuantity: d.bogo_get_qty || 1,
      }),
      error: (e) => this.err(e, this.lang.pick('Load offer failed', 'فشل تحميل العرض')),
    });
  }
  saveEditOffer() {
    const f = this.editingOffer();
    if (!f) return;
    const err = this.validateOffer(f);
    if (err) { this.msg.set(err); return; }
    this.api.updateOffer(f.id, this.offerPayload(f)).subscribe({
      next: () => { this.editingOffer.set(null); this.msg.set(this.lang.pick('Offer updated', 'تم تحديث العرض')); this.loadAll(); },
      error: (e) => this.err(e, this.lang.pick('Update offer failed', 'فشل تحديث العرض')),
    });
  }
  removeOffer(o: any) {
    this.api.deleteOffer(o.id).subscribe({
      next: () => { this.msg.set(this.lang.pick('Offer removed', 'تم حذف العرض')); this.loadAll(); },
      error: (e) => this.err(e, this.lang.pick('Remove offer failed', 'فشل حذف العرض')),
    });
  }
  shopForm = signal({ name_en: '', name_ar: '', logo_url: '', layout: 'topbar', loyalty_earn_per_jd: 1, loyalty_jd_per_point: 0.05, theme: { light: {}, dark: {} } as any, phones: [] as string[] });
  newPhone = signal('');
  themeKeys = [
    { k: 'headerBg', en: 'Header background', ar: 'خلفية الترويسة' },
    { k: 'headerText', en: 'Header text', ar: 'نص الترويسة' },
    { k: 'footerBg', en: 'Footer background', ar: 'خلفية التذييل' },
    { k: 'footerText', en: 'Footer text', ar: 'نص التذييل' },
    { k: 'accent', en: 'Accent (links/hovers)', ar: 'اللون المميز' },
  ];
  shopLogoPreview(): string { return this.api.img(this.shopForm().logo_url); }

  private apiBase = 'http://localhost:4000';
  imgSrc(u: string) {
    return u?.startsWith('/uploads/') ? this.apiBase + u : u;
  }
  prodImg(p: any): string { return this.api.img(p.image); }

  isAdmin() {
    try {
      return JSON.parse(localStorage.getItem('pos_user') || '{}').role === 'admin';
    } catch {
      return false;
    }
  }

  ngOnInit() { if (this.isAdmin()) this.loadAll(); }
  setTab(t: Tab) { this.tab.set(t); this.msg.set(''); }
  setPreset(p: string) { this.preset.set(p); this.viewMode.set('preset'); this.loadAnalytics(); this.loadExpenses(); }
  setMonth(m: any) {
    if (!m) return;
    this.month.set(Number(m)); this.viewMode.set('month'); this.loadAnalytics(); this.loadExpenses();
  }
  setYear(y: any) {
    if (!y) return;
    this.year.set(Number(y)); this.viewMode.set('year'); this.loadAnalytics(); this.loadExpenses();
  }
  onYearPick(y: any) {
    if (!y) return;
    // year dropdown refines month view, or enters year view
    this.year.set(Number(y));
    if (this.viewMode() !== 'month') this.viewMode.set('year');
    this.loadAnalytics(); this.loadExpenses();
  }
  rangeLabel(): string {
    const m = this.viewMode();
    if (m === 'year') return String(this.year());
    if (m === 'month') return `${this.year()}-${String(this.month()).padStart(2, '0')}`;
    if (m === 'preset') return this.preset() === 'last-week'
      ? this.lang.pick('Last week', 'الأسبوع الماضي') : this.lang.pick('Last month', 'الشهر الماضي');
    return this.lang.pick(`Last ${this.range()} days`, `آخر ${this.range()} أيام`);
  }
  pendingCount(): number { return this.overview()?.counts?.orders?.pending || 0; }
  attentionList(): string {
    return (this.overview()?.attention || []).map((a: any) => '#' + a.order_number).join(', ');
  }
  rangeRevenue(): number { return this.revenue().reduce((s, d) => s + Number(d.revenue || 0), 0); }
  barPct(v: number): number {
    const max = Math.max(...this.revenue().map((d) => Number(d.revenue || 0)), 0);
    if (!max) return 0;
    return Math.max(3, Math.round((Number(v) / max) * 100));
  }
  tickLabel(d: any, i: number): string {
    const n = this.revenue().length;
    if (n <= 12) return (d.day || '').slice(5);
    if (i % 5 !== 0 && i !== n - 1) return '';
    return (d.day || '').slice(8);
  }
  showTip(ev: MouseEvent, title: string, sub: string) {
    this.tip.set({ x: ev.clientX + 14, y: ev.clientY + 14, title, sub });
  }
  fmt(v: any, digits = 2): string {
    const n = Number(v) || 0;
    return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  moveTip(ev: MouseEvent) {
    const t = this.tip();
    if (t) this.tip.set({ ...t, x: ev.clientX + 14, y: ev.clientY + 14 });
  }
  hideTip() { this.tip.set(null); }
  topPct(qty: number): number {
    const max = Math.max(...this.top().map((t) => Number(t.qty || 0)), 0);
    if (!max) return 0;
    return Math.max(4, Math.round((Number(qty) / max) * 100));
  }
  svcColors: Record<string, string> = { delivery: '#2563eb', pickup: '#16a34a', inRestaurant: '#f59e0b' };
  svcLabel(k: string): string {
    if (k === 'delivery') return this.lang.pick('Delivery', 'توصيل');
    if (k === 'pickup') return this.lang.pick('Pickup', 'استلام');
    return this.lang.pick('Dine-in', 'صالة');
  }
  payLabel(k: string): string {
    if (k === 'cliq') return 'Cliq';
    return this.lang.pick('Cash', 'نقدي');
  }
  donutSegs(): { key: string; label: string; pct: number; offset: number; color: string }[] {
    const rows = this.mix()?.service || [];
    const total = rows.reduce((s: number, r: any) => s + Number(r.revenue || 0), 0);
    if (!total) return [];
    let acc = 0;
    return rows.map((r: any) => {
      const pct = (Number(r.revenue || 0) / total) * 100;
      const seg = { key: r.key, label: this.svcLabel(r.key), pct, offset: acc, color: this.svcColors[r.key] || '#71717a' };
      acc += pct;
      return seg;
    });
  }
  mixTotal(): number {
    return (this.mix()?.service || []).reduce((s: number, r: any) => s + Number(r.revenue || 0), 0);
  }
  payPct(v: number): number {
    const max = Math.max(...(this.mix()?.payment || []).map((p: any) => Number(p.revenue || 0)), 0);
    if (!max) return 0;
    return Math.max(4, Math.round((Number(v) / max) * 100));
  }
  peakHour(): number {
    let best = 0, peak = 0;
    for (const h of this.hours()) {
      if (Number(h.orders || 0) > best) { best = Number(h.orders); peak = Number(h.hour); }
    }
    return peak;
  }
  hourPct(v: number): number {
    const max = Math.max(...this.hours().map((h) => Number(h.orders || 0)), 0);
    if (!max) return 0;
    return Math.max(3, Math.round((Number(v) / max) * 100));
  }
  catPalette = ['#2563eb', '#16a34a', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#f43f5e'];
  catSegs(): { key: string; label: string; pct: number; offset: number; color: string }[] {
    const rows = this.catSales();
    const total = rows.reduce((s: number, r: any) => s + Number(r.revenue || 0), 0);
    if (!total) return [];
    let acc = 0;
    return rows.map((r: any, i: number) => {
      const pct = (Number(r.revenue || 0) / total) * 100;
      const seg = { key: r.name, label: r.name, pct, offset: acc, color: this.catPalette[i % this.catPalette.length] };
      acc += pct;
      return seg;
    });
  }
  catTotal(): number {
    return this.catSales().reduce((s: number, r: any) => s + Number(r.revenue || 0), 0);
  }
  cancelRate(): number {
    const c = Number(this.discounts()?.cancelled?.count || 0);
    const o = Number(this.discounts()?.totals?.orders || 0);
    if (!c && !o) return 0;
    return (c / (c + o)) * 100;
  }
  loadAnalytics() {
    const m = this.viewMode();
    if (m === 'year') {
      this.api.revenueStats({ year: this.year() }).subscribe({ next: (r) => this.revenue.set(r) });
      this.api.topProducts(5, { year: this.year() }).subscribe({ next: (t) => this.top.set(t) });
    } else if (m === 'month') {
      this.api.revenueStats({ year: this.year(), month: this.month() }).subscribe({ next: (r) => this.revenue.set(r) });
      this.api.topProducts(5, { year: this.year(), month: this.month() }).subscribe({ next: (t) => this.top.set(t) });
    } else if (m === 'preset') {
      this.api.revenueStats({ preset: this.preset() }).subscribe({ next: (r) => this.revenue.set(r) });
      this.api.topProducts(5, { preset: this.preset() }).subscribe({ next: (t) => this.top.set(t) });
    } else {
      this.api.revenueStats({ days: this.range() }).subscribe({ next: (r) => this.revenue.set(r) });
      this.api.topProducts(5).subscribe({ next: (t) => this.top.set(t) });
    }
    this.api.statYears().subscribe({ next: (y) => this.years.set(y || []) });
    this.api.salesMix().subscribe({ next: (m) => this.mix.set(m) });
    this.api.salesHours().subscribe({ next: (h) => this.hours.set(h || []) });
    this.api.salesCategories().subscribe({ next: (c) => this.catSales.set(c || []) });
    this.api.discountStats().subscribe({ next: (d) => this.discounts.set(d) });
  }

  loadAll() {
    this.api.overview().subscribe({ next: (o) => this.overview.set(o), error: () => this.msg.set(this.lang.pick('Overview failed', 'فشل تحميل النظرة العامة')) });
    this.api.products().subscribe({ next: (p) => this.products.set(p) });
    this.api.categories().subscribe({ next: (c) => this.categories.set(c) });
    this.api.videos().subscribe({ next: (v) => this.videos.set(v) });
    this.api.employees().subscribe({ next: (e) => this.employees.set(e), error: () => this.msg.set(this.lang.pick('Login as admin first', 'سجل الدخول كمدير أولا')) });
    this.api.settings().subscribe({ next: (s) => this.shopForm.set({ ...s }) });
    this.api.offers().subscribe({ next: (o) => this.offers.set(o), error: () => undefined });
    this.api.tables().subscribe({ next: (t) => this.tables.set(t || []), error: () => undefined });
    this.loadExpenses();
    this.loadAnalytics();
  }

  expenseRangeParams(): any {
    const m = this.viewMode();
    if (m === 'year') return { year: this.year() };
    if (m === 'month') return { year: this.year(), month: this.month() };
    if (m === 'preset') return { preset: this.preset() };
    return { days: 30 };
  }
  loadExpenses() {
    this.api.expenses(this.expenseRangeParams()).subscribe({
      next: (r) => { this.expenses.set(r.items || []); this.expensesTotal.set(Number(r.total) || 0); this.expenseCats.set(r.byCategory || []); },
      error: () => undefined,
    });
  }
  expenseCatLabel(c: string): string {
    const map: Record<string, [string, string]> = {
      rent: ['Rent', 'إيجار'], salaries: ['Salaries', 'رواتب'], 'food-cost': ['Food cost', 'تكلفة طعام'],
      waste: ['Waste', 'هدر'], utilities: ['Utilities', 'خدمات'], marketing: ['Marketing', 'تسويق'], other: ['Other', 'أخرى'],
    };
    const m = map[c] || map['other'];
    return this.lang.pick(m[0], m[1]);
  }

  err(e: any, fallback: string) {
    if (e?.status === 401) {
      this.msg.set(this.lang.pick('Session expired - please log in again.', 'انتهت الجلسة - سجل الدخول مجددا.'));
      return;
    }
    this.msg.set(e?.error?.error || fallback);
  }

  toggleProductCategory(id: string) {
    const ids: string[] = this.newProduct.categoryIds;
    const i = ids.indexOf(id);
    if (i >= 0) ids.splice(i, 1); else ids.push(id);
  }
  addProduct() {
    if (!this.newProduct.name_en.trim()) { this.msg.set(this.lang.pick('English name required', 'الاسم الإنجليزي مطلوب')); return; }
    if (!this.newProduct.name_ar?.trim()) { this.msg.set(this.lang.pick('Arabic name required', 'الاسم العربي مطلوب')); return; }
    if (!this.newProduct.image?.trim()) {
      this.msg.set(this.lang.pick('Image required - paste a URL or upload one', 'الصورة مطلوبة - الصق رابطا أو ارفع واحدة'));
      return;
    }
    if (!this.newProduct.categoryIds.length) {
      this.msg.set(this.lang.pick('Pick at least one category', 'اختر فئة واحدة على الأقل'));
      return;
    }
    const price = Number(this.newProduct.price);
    if (!price || price <= 0) {
      this.msg.set(this.lang.pick('Price required (greater than 0)', 'السعر مطلوب (أكبر من صفر)'));
      return;
    }
    const quantity = this.newProduct.quantity === null || this.newProduct.quantity === undefined || this.newProduct.quantity === ''
      ? null : Math.max(0, Math.floor(Number(this.newProduct.quantity) || 0));
    this.api.createProduct({
      ...this.newProduct,
      category: this.newProduct.categoryIds,
      // price + stock + unit live on the variant option: one default group + option
      variants: [{
        name_en: 'Type', name_ar: 'النوع',
        options: [{ value_en: 'Standard', value_ar: 'عادي', price, quantity,
          unitLabel_en: this.newProduct.unit, unitLabel_ar: this.unitAr[this.newProduct.unit] || 'قطعة',
          imageUrl: this.newProduct.image }],
      }],
    }).subscribe({
      next: () => { this.newProduct = { name_en: '', name_ar: '', shortDescription_en: '', shortDescription_ar: '', longDescription_en: '', longDescription_ar: '', image: '', price: null, quantity: null, unit: 'piece', categoryIds: [] }; this.showAddProduct.set(false); this.msg.set(this.lang.pick('Product added', 'تمت إضافة المنتج')); this.loadAll(); },
      error: (e) => this.err(e, this.lang.pick('Add product failed', 'فشلت إضافة المنتج')),
    });
  }
  removeProduct(p: any) {
    this.api.deleteProduct(p.id).subscribe({
      next: () => { this.msg.set(this.lang.pick('Product removed', 'تم حذف المنتج')); this.loadAll(); },
      error: (e) => this.err(e, this.lang.pick('Remove failed (has orders?)', 'فشل الحذف (عليه طلبات؟)')),
    });
  }
  editingProduct = signal<any | null>(null);

  startEditProduct(p: any) {
    this.msg.set('');
    this.api.productDetail(p.id).subscribe({
      next: (d: any) => {
        const opt = d.variants?.[0]?.options?.[0];
        this.editingProduct.set({
          id: d.id,
          name_en: d.name_en, name_ar: d.name_ar,
          shortDescription_en: d.short_desc_en || '', shortDescription_ar: d.short_desc_ar || '',
          longDescription_en: d.long_desc_en || '', longDescription_ar: d.long_desc_ar || '',
          image: d.image || '',
          price: opt ? Number(opt.price) : null,
          quantity: opt?.quantity == null ? null : Number(opt.quantity),
          unit: opt?.unit_label_en || 'piece',
          categoryIds: [...(d.category || [])],
          _orig: { price: opt ? Number(opt.price) : null, quantity: opt?.quantity == null ? null : Number(opt.quantity), unit: opt?.unit_label_en || 'piece' },
        });
      },
      error: (e) => this.err(e, this.lang.pick('Load product failed', 'فشل تحميل المنتج')),
    });
  }
  cancelEditProduct() { this.editingProduct.set(null); }
  toggleEditProductCategory(id: string) {
    const ids: string[] = this.editingProduct().categoryIds;
    const i = ids.indexOf(id);
    if (i >= 0) ids.splice(i, 1); else ids.push(id);
  }
  saveEditProduct() {
    const f = this.editingProduct();
    if (!f) return;
    const body: any = {
      name_en: f.name_en, name_ar: f.name_ar,
      shortDescription_en: f.shortDescription_en, shortDescription_ar: f.shortDescription_ar,
      longDescription_en: f.longDescription_en, longDescription_ar: f.longDescription_ar,
      image: f.image, category: f.categoryIds,
    };
    // only replace variants when price/stock/unit changed (protects multi-variant products)
    const price = Number(f.price);
    const qty = f.quantity === null || f.quantity === undefined || f.quantity === '' ? null : Math.max(0, Math.floor(Number(f.quantity) || 0));
    if (price !== f._orig.price || qty !== f._orig.quantity || f.unit !== f._orig.unit) {
      if (!price || price <= 0) { this.msg.set(this.lang.pick('Price must be greater than 0', 'يجب أن يكون السعر أكبر من صفر')); return; }
      body.variants = [{
        name_en: 'Type', name_ar: 'النوع',
        options: [{ value_en: 'Standard', value_ar: 'عادي', price,
          quantity: qty,
          unitLabel_en: f.unit, unitLabel_ar: this.unitAr[f.unit] || 'قطعة',
          imageUrl: f.image }],
      }];
    }
    this.api.updateProduct(f.id, body).subscribe({
      next: () => { this.editingProduct.set(null); this.msg.set(this.lang.pick('Product updated', 'تم تحديث المنتج')); this.loadAll(); },
      error: (e) => this.err(e, this.lang.pick('Update product failed', 'فشل تحديث المنتج')),
    });
  }
  uploadEditProductImage(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file || !this.editingProduct()) return;
    this.api.uploadFile(file).subscribe({
      next: (r) => { this.editingProduct().image = r.url; this.msg.set(this.lang.pick(`Uploaded ${r.url}`, `تم الرفع ${r.url}`)); },
      error: (e) => this.err(e, this.lang.pick('Upload failed', 'فشل الرفع')),
    });
  }

  addCategory() {
    if (!this.newCategory.image?.trim()) {
      this.msg.set(this.lang.pick('Image required - paste a URL or upload one', 'الصورة مطلوبة - الصق رابطا أو ارفع واحدة'));
      return;
    }
    this.api.createCategory(this.newCategory).subscribe({
      next: () => { this.newCategory = { name_en: '', name_ar: '', image: '' }; this.showAddCategory.set(false); this.msg.set(this.lang.pick('Category added', 'تمت إضافة الفئة')); this.loadAll(); },
      error: (e) => this.err(e, this.lang.pick('Add category failed', 'فشلت إضافة الفئة')),
    });
  }
  removeCategory(c: any) {
    this.api.deleteCategory(c.id).subscribe({
      next: () => { this.msg.set(this.lang.pick('Category removed', 'تم حذف الفئة')); this.loadAll(); },
      error: (e) => this.err(e, this.lang.pick('Remove failed (in use by products?)', 'فشل الحذف (مستخدمة في منتجات؟)')),
    });
  }
  editingCategory = signal<any | null>(null);
  saveEditCategory() {
    const f = this.editingCategory();
    if (!f) return;
    this.api.updateCategory(f.id, { name_en: f.name_en, name_ar: f.name_ar, image: f.image }).subscribe({
      next: () => { this.editingCategory.set(null); this.msg.set(this.lang.pick('Category updated', 'تم تحديث الفئة')); this.loadAll(); },
      error: (e) => this.err(e, this.lang.pick('Update category failed', 'فشل تحديث الفئة')),
    });
  }

  addVideo() {
    this.api.createVideo(this.newVideo).subscribe({
      next: () => { this.newVideo = { title_en: '', url: '' }; this.showAddVideo.set(false); this.msg.set(this.lang.pick('Video added', 'تمت إضافة الفيديو')); this.loadAll(); },
      error: (e) => this.err(e, this.lang.pick('Add video failed', 'فشلت إضافة الفيديو')),
    });
  }
  removeVideo(v: any) {
    this.api.deleteVideo(v.id).subscribe({
      next: () => { this.msg.set(this.lang.pick('Video removed', 'تم حذف الفيديو')); this.loadAll(); },
      error: (e) => this.err(e, this.lang.pick('Remove video failed', 'فشل حذف الفيديو')),
    });
  }
  editingVideo = signal<any | null>(null);
  saveEditVideo() {
    const f = this.editingVideo();
    if (!f) return;
    this.api.updateVideo(f.id, { ...f, is_active: !!f.is_active }).subscribe({
      next: () => { this.editingVideo.set(null); this.msg.set(this.lang.pick('Video updated', 'تم تحديث الفيديو')); this.loadAll(); },
      error: (e) => this.err(e, this.lang.pick('Update video failed', 'فشل تحديث الفيديو')),
    });
  }
  uploadOfferImage(ev: Event, form: any) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.api.uploadFile(file).subscribe({
      next: (r) => { form.image = r.url; this.msg.set(this.lang.pick(`Uploaded ${r.url}`, `تم الرفع ${r.url}`)); },
      error: (e) => this.err(e, this.lang.pick('Upload failed', 'فشل الرفع')),
    });
  }
  uploadProductImage(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.api.uploadFile(file).subscribe({
      next: (r) => { this.newProduct.image = r.url; this.msg.set(this.lang.pick(`Uploaded ${r.url} - click Add`, `تم الرفع ${r.url} - اضغط إضافة`)); },
      error: (e) => this.err(e, this.lang.pick('Upload failed (jpeg/png/webp/gif, 50MB max)', 'فشل الرفع')),
    });
  }
  uploadCategoryImage(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.api.uploadFile(file).subscribe({
      next: (r) => { this.newCategory.image = r.url; this.msg.set(this.lang.pick(`Uploaded ${r.url} - click Add`, `تم الرفع ${r.url} - اضغط إضافة`)); },
      error: (e) => this.err(e, this.lang.pick('Upload failed (jpeg/png/webp/gif, 50MB max)', 'فشل الرفع')),
    });
  }
  uploadVideo(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.api.uploadFile(file).subscribe({
      next: (r) => { this.newVideo.url = r.url; this.msg.set(this.lang.pick(`Uploaded ${r.url} - click Add`, `تم الرفع ${r.url} - اضغط إضافة`)); },
      error: (e) => this.err(e, this.lang.pick('Upload failed (mp4/webm, 50MB max)', 'فشل الرفع')),
    });
  }

  addEmployee() {
    this.api.createEmployee(this.newEmployee).subscribe({
      next: () => { this.newEmployee = { username: '', password: '', role: 'cashier' }; this.showAddEmployee.set(false); this.msg.set(this.lang.pick('Employee added', 'تمت إضافة الموظف')); this.loadAll(); },
      error: (e) => this.err(e, this.lang.pick('Add employee failed', 'فشلت إضافة الموظف')),
    });
  }
  removeEmployee(e: any) {
    this.api.deleteEmployee(e.id).subscribe({
      next: () => { this.msg.set(this.lang.pick('Employee removed', 'تم حذف الموظف')); this.loadAll(); },
      error: (err) => this.err(err, this.lang.pick('Remove employee failed', 'فشل حذف الموظف')),
    });
  }

  addTable() {
    if (!this.newTable.label?.trim()) { this.msg.set(this.lang.pick('Label required (e.g. T1)', 'الاسم مطلوب (مثال T1)')); return; }
    this.api.createTable({ label: this.newTable.label, seats: this.newTable.seats }).subscribe({
      next: () => { this.newTable = { label: '', seats: 4 }; this.showAddTable.set(false); this.msg.set(this.lang.pick('Table added', 'تمت إضافة الطاولة')); this.loadAll(); },
      error: (e) => this.err(e, this.lang.pick('Add table failed', 'فشلت إضافة الطاولة')),
    });
  }
  removeTable(t: any) {
    this.api.deleteTable(t.id).subscribe({
      next: () => { this.msg.set(this.lang.pick('Table removed', 'تم حذف الطاولة')); this.loadAll(); },
      error: (e) => this.err(e, this.lang.pick('Remove failed (occupied?)', 'فشل الحذف (مشغولة؟)')),
    });
  }

  todayISO(): string { return new Date().toISOString().slice(0, 10); }
  addExpense() {
    if (!this.newExpense.title?.trim()) { this.msg.set(this.lang.pick('Title required', 'البيان مطلوب')); return; }
    if (!(Number(this.newExpense.amount) > 0)) { this.msg.set(this.lang.pick('Amount must be greater than 0', 'يجب أن يكون المبلغ أكبر من صفر')); return; }
    this.api.createExpense({ ...this.newExpense, spentAt: this.newExpense.spentAt || this.todayISO() }).subscribe({
      next: () => { this.newExpense = { title: '', amount: null, category: 'other', spentAt: '', notes: '' }; this.showAddExpense.set(false); this.msg.set(this.lang.pick('Loss added', 'تمت إضافة المصروف')); this.loadExpenses(); },
      error: (e) => this.err(e, this.lang.pick('Add failed', 'فشلت الإضافة')),
    });
  }
  startEditExpense(x: any) {
    this.editingExpense.set({ id: x.id, title: x.title, amount: Number(x.amount), category: x.category, spentAt: String(x.spent_at).slice(0, 10), notes: x.notes || '' });
  }
  saveEditExpense() {
    const f = this.editingExpense();
    if (!f) return;
    this.api.updateExpense(f.id, f).subscribe({
      next: () => { this.editingExpense.set(null); this.msg.set(this.lang.pick('Loss updated', 'تم تحديث المصروف')); this.loadExpenses(); },
      error: (e) => this.err(e, this.lang.pick('Update failed', 'فشل التحديث')),
    });
  }
  removeExpense(x: any) {
    this.api.deleteExpense(x.id).subscribe({
      next: () => { this.msg.set(this.lang.pick('Loss removed', 'تم حذف المصروف')); this.loadExpenses(); },
      error: (e) => this.err(e, this.lang.pick('Remove failed', 'فشل الحذف')),
    });
  }
  profit(): number { return this.rangeRevenue() - this.expensesTotal(); }

  saveSettings() {
    this.api.updateSettings(this.shopForm()).subscribe({
      next: () => { this.shop.refresh(); this.msg.set(this.lang.pick('Settings saved - header updated', 'تم حفظ الإعدادات - تم تحديث الترويسة')); },
      error: (e) => this.err(e, this.lang.pick('Save settings failed', 'فشل حفظ الإعدادات')),
    });
  }
  resetTheme() {
    const f = this.shopForm();
    f.theme = JSON.parse(JSON.stringify(DEFAULT_THEME));
    this.msg.set(this.lang.pick('Defaults restored - click Save', 'تمت استعادة الافتراضي - اضغط حفظ'));
  }
  addPhone() {
    const v = this.newPhone().trim();
    if (!v) return;
    const f = this.shopForm();
    if ((f.phones || []).length >= 4) {
      this.msg.set(this.lang.pick('Max 4 numbers', 'الحد 4 أرقام'));
      return;
    }
    if (!f.phones.includes(v)) f.phones = [...(f.phones || []), v];
    this.newPhone.set('');
  }
  removePhone(p: string) {
    const f = this.shopForm();
    f.phones = (f.phones || []).filter((x: string) => x !== p);
  }
  uploadShopLogo(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.api.uploadFile(file).subscribe({
      next: (r) => { this.shopForm().logo_url = r.url; this.msg.set(this.lang.pick(`Uploaded ${r.url} - click Save`, `تم الرفع ${r.url} - اضغط حفظ`)); },
      error: (e) => this.err(e, this.lang.pick('Upload failed', 'فشل الرفع')),
    });
  }
}
