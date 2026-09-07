import { Injectable, inject } from '@angular/core';
import { ShopService } from './shop.service';
import { LangService } from './lang.service';

const CSS = `
  body { font-family: monospace; width: 280px; margin: 0; padding: 8px; color: #000; }
  h2, h3 { text-align: center; margin: 4px 0; }
  .c { text-align: center; } .r { text-align: right; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  td { padding: 3px 0; vertical-align: top; }
  hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
  .big { font-size: 20px; font-weight: bold; }
`;

@Injectable({ providedIn: 'root' })
export class PrintService {
  private shop = inject(ShopService);
  private lang = inject(LangService);

  private esc(s: any): string {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private print(html: string) {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(`<html><head><style>${CSS}</style></head><body>${html}</body></html>`);
    doc.close();
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => iframe.remove(), 1500);
  }

  /** Kitchen ticket: what to cook, no prices */
  ticket(o: any) {
    const items = (o.items || [])
      .map(
        (it: any) => `<tr><td><b>${it.quantity}x</b></td><td><b>${this.esc(it.product_name_snapshot)}</b>${
          it.variant_value ? `<br>${this.esc(it.variant_value)}` : ''
        }${this.addons(it)}</td></tr>`
      )
      .join('');
    this.print(`
      <h2 class="big">#${o.order_number}</h2>
      <div class="c">${this.esc(o.service_method)}${o.table_number ? ' · ' + this.esc(o.table_number) : ''}</div>
      <div class="c">${new Date(o.created_at).toLocaleString()}</div>
      <hr><table>${items}</table><hr>
      <div class="c">${this.esc(o.phone_number || '')} ${this.esc(o.delivery_location || '')}</div>`);
  }

  private addons(it: any): string {
    try {
      const arr = typeof it.addons_snapshot === 'string' ? JSON.parse(it.addons_snapshot) : it.addons_snapshot || [];
      const names = arr.map((a: any) => this.esc(a.name_en || a.name || '')).filter(Boolean);
      return names.length ? `<br>+ ${names.join(', ')}` : '';
    } catch {
      return '';
    }
  }

  /** Customer receipt with totals */
  receipt(o: any) {    const items = (o.items || [])
      .map(
        (it: any) => `<tr><td>${it.quantity}x ${this.esc(it.product_name_snapshot)}</td>
          <td class="r">${(Number(it.unit_price) * Number(it.quantity)).toFixed(2)}</td></tr>`
      )
      .join('');
    this.print(`
      <h2>${this.esc(this.shop.name())}</h2>
      <div class="c">${this.lang.pick('Order', 'طلب')} #${o.order_number} · ${new Date(o.created_at).toLocaleString()}</div>
      <hr><table>${items}</table><hr>
      ${Number(o.discount_amount) > 0 ? `<div>Discount: -${Number(o.discount_amount).toFixed(2)}</div>` : ''}
      <div class="big r">Total: ${Number(o.total_amount).toFixed(2)} JD</div>
      <div class="c">${this.esc(o.payment_method || '')}${o.coupon_code ? ' · ' + this.esc(o.coupon_code) : ''}</div>
      <hr><div class="c">${this.lang.pick('Thank you!', 'شكرا!')}</div>`);
  }

  /** End-of-day Z-report */
  eod(r: any) {
    const s = r.summary || {};
    const losses = Number(r.losses || 0);
    const pay = (r.payment || [])
      .map((p: any) => `<tr><td>${this.esc(p.key)}</td><td class="r">${Number(p.revenue).toFixed(2)}</td></tr>`)
      .join('');
    const st = (r.status || [])
      .map((x: any) => `<tr><td>${this.esc(x.status)}</td><td class="r">${x.count}</td></tr>`)
      .join('');
    const money = (n: any) => Number(n || 0).toFixed(2);
    this.print(`
      <h2>${this.esc(this.shop.name())}</h2>
      <div class="c">Z-REPORT · ${this.esc(r.day)}</div>
      <hr>
      <table>
        <tr><td>Orders</td><td class="r">${s.orders || 0}</td></tr>
        <tr><td>Gross</td><td class="r">${money(s.gross)}</td></tr>
        <tr><td>Discounts</td><td class="r">-${money(s.discounts)}</td></tr>
        <tr><td>Loyalty</td><td class="r">-${money(s.loyalty)}</td></tr>
        <tr><td><b>NET</b></td><td class="r"><b>${money(s.net)}</b></td></tr>
        <tr><td>Losses</td><td class="r">-${money(losses)}</td></tr>
        <tr><td><b>NET after losses</b></td><td class="r"><b>${money(Number(s.net || 0) - losses)}</b></td></tr>
        <tr><td>Avg ticket</td><td class="r">${money(s.avg_ticket)}</td></tr>
        <tr><td>Points earned</td><td class="r">${s.points_earned || 0}</td></tr>
      </table>
      <hr><div class="c">BY PAYMENT</div><table>${pay}</table>
      <hr><div class="c">BY STATUS</div><table>${st}</table>
      <hr><div class="c">${new Date().toLocaleString()}</div>`);
  }
}
