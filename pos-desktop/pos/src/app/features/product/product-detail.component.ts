import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, Product } from '../../core/api.service';
import { LangService } from '../../core/lang.service';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div [dir]="lang.dir()" class="container py-3">
      <a routerLink="/" class="btn btn-sm btn-link">← {{ lang.lang()==='ar' ? 'رجوع' : 'Back' }}</a>
      @if (product(); as p) {
        <h3>{{ lang.pick(p.name_en, p.name_ar) }}</h3>
        <img [src]="img(p)" style="max-height:260px;object-fit:contain" class="img-fluid" />
        <p class="text-muted">{{ lang.pick($any(p).short_desc_en || '', $any(p).short_desc_ar || '') }}</p>
        @for (g of p.variants; track $index) {
          <div class="mt-2"><b>{{ lang.pick(g.name_en, g.name_ar) }}</b>
            <div class="d-flex gap-1 flex-wrap">
              @for (o of g.options; track $index) {
                <span class="badge text-bg-light border">{{ lang.pick(o.value_en, o.value_ar) }} - {{ o.price }} JD</span>
              }
            </div>
          </div>
        }
      } @else { <div class="spinner-border"></div> }
    </div>`,
})
export class ProductDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  lang = inject(LangService);
  product = signal<Product | null>(null);
  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.productDetail(id).subscribe((p) => this.product.set(p));
  }
  img(p: any): string {
    const o = p.variants?.[0]?.options?.[0];
    return this.api.img(o?.image_url || o?.imageUrl || p.image);
  }
}
