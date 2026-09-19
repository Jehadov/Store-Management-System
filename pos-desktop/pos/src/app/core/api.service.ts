import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

export interface Category { id: string; name_en: string; name_ar: string; image?: string; }
export interface VariantOption {
  id?: string; value_en: string; value_ar: string;
  price: number; quantity: number; image_url?: string; imageUrl?: string;
}
export interface VariantGroup { id?: string; name_en: string; name_ar: string; options: VariantOption[]; }
export interface Product {
  id: string; name_en: string; name_ar: string; image?: string;
  category?: string[]; variants?: VariantGroup[]; addons?: any[];
}
export interface CartItem {
  id: string; name: string; price: number; quantity: number;
  optionId?: string;
  variant?: { name: string; value: string; optionId?: string };
  addOns?: { id: string; name_en: string; extraPrice: number }[];
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  // Host-aware: works on localhost AND on phones via LAN IP (ng serve --host 0.0.0.0)
  base = `http://${window.location.hostname}:4000/api`;
  origin = `http://${window.location.hostname}:4000`;

  /** Resolve a backend image path to a loadable URL.
   *  Backend stores `/uploads/x.png` but the app runs on :4200,
   *  so relative paths must be prefixed with the API origin. */
  img(url?: string | null): string {
    const u = url?.trim() || '';
    // legacy placeholder paths never existed as files -> show placeholder
    if (!u || u === '/placeholder-product.png' || u === '/placeholder-image.png') {
      return 'data:image/svg+xml;utf8,' + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#eee"/><text x="100" y="105" text-anchor="middle" fill="#999" font-size="14">no image</text></svg>`
      );
    }
    if (/^(https?:|data:|blob:)/i.test(u)) return u;
    if (u.startsWith('/')) return this.origin + u;
    return `${this.origin}/uploads/${u}`;
  }

  token(): string | null { return localStorage.getItem('pos_token'); }
  private headers() {
    const t = this.token();
    return t ? { Authorization: `Bearer ${t}` } : {};
  }

  login(username: string, password: string) {
    return this.http.post<{ token: string; user: any }>(`${this.base}/auth/login`, { username, password });
  }
  categories() { return this.http.get<Category[]>(`${this.base}/categories`); }
  products(categoryId = 'all', search = '', admin = false) {
    if (admin && this.token()) {
      return this.http.get<Product[]>(`${this.base}/products/admin/all`, { params: { search }, headers: this.headers() as any });
    }
    return this.http.get<Product[]>(`${this.base}/products`, { params: { categoryId, search, limit: '100' } });
  }
  productDetail(id: string) { return this.http.get<Product>(`${this.base}/products/${id}`); }
  createOrder(payload: any) { return this.http.post<{ orderId: string; order_number: number; subtotal: number; discount: number; total: number }>(`${this.base}/orders`, payload); }
  orders(status?: string) {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<any[]>(`${this.base}/orders`, { params, headers: this.headers() as any });
  }
  orderDetail(id: string) {
    return this.http.get<any>(`${this.base}/orders/${id}`, { headers: this.headers() as any });
  }
  setStatus(id: string, status: string) {
    return this.http.patch(`${this.base}/orders/${id}/status`, { status }, { headers: this.headers() as any });
  }
  updateOrder(id: string, body: any) {
    return this.http.put<any>(`${this.base}/orders/${id}`, body, { headers: this.headers() as any });
  }
  markPaid(id: string, method?: string) {
    return this.http.patch<any>(`${this.base}/orders/${id}/payment`, { payment_status: 'paid', method }, { headers: this.headers() as any });
  }
  assignOrder(id: string, userId: string) {
    return this.http.patch<any>(`${this.base}/orders/${id}/assign`, { assigned_to: userId }, { headers: this.headers() as any });
  }
  unassignOrder(id: string) {
    return this.http.patch<any>(`${this.base}/orders/${id}/unassign`, {}, { headers: this.headers() as any });
  }

  // ---- Admin ----
  overview() {
    return this.http.get<any>(`${this.base}/admin/overview`, { headers: this.headers() as any });
  }
  revenueStats(opts: { days?: number; preset?: string; year?: number; month?: number } = {}) {
    const params: any = {};
    if (opts.preset) params.preset = opts.preset;
    else if (opts.year && opts.month) { params.year = String(opts.year); params.month = String(opts.month); }
    else if (opts.year) params.year = String(opts.year);
    else params.days = String(opts.days || 7);
    return this.http.get<any[]>(`${this.base}/admin/stats/revenue`, { params, headers: this.headers() as any });
  }
  topProducts(limit = 5, opts: { days?: number; year?: number; month?: number; preset?: string } = {}) {
    const params: any = { limit: String(limit) };
    if (opts.days) params.days = String(opts.days);
    if (opts.preset) params.preset = opts.preset;
    else if (opts.year && opts.month) { params.year = String(opts.year); params.month = String(opts.month); }
    else if (opts.year) params.year = String(opts.year);
    return this.http.get<any[]>(`${this.base}/admin/stats/top-products`, { params, headers: this.headers() as any });
  }
  statYears() {
    return this.http.get<number[]>(`${this.base}/admin/stats/years`, { headers: this.headers() as any });
  }
  salesMix() {
    return this.http.get<any>(`${this.base}/admin/stats/mix`, { headers: this.headers() as any });
  }
  salesHours() {
    return this.http.get<any[]>(`${this.base}/admin/stats/hours`, { headers: this.headers() as any });
  }  salesCategories() {
    return this.http.get<any[]>(`${this.base}/admin/stats/categories`, { headers: this.headers() as any });
  }
  discountStats() {
    return this.http.get<any>(`${this.base}/admin/stats/discounts`, { headers: this.headers() as any });
  }
  eod(date?: string) {
    const params: any = {};
    if (date) params.date = date;
    return this.http.get<any>(`${this.base}/admin/stats/eod`, { params, headers: this.headers() as any });
  }
  expenses(params: any = {}) {
    return this.http.get<any>(`${this.base}/expenses`, { params, headers: this.headers() as any });
  }
  createExpense(body: any) {
    return this.http.post<any>(`${this.base}/expenses`, body, { headers: this.headers() as any });
  }
  updateExpense(id: string, body: any) {
    return this.http.put<any>(`${this.base}/expenses/${id}`, body, { headers: this.headers() as any });
  }
  deleteExpense(id: string) {
    return this.http.delete(`${this.base}/expenses/${id}`, { headers: this.headers() as any });
  }
  // dining tables
  tables() {
    return this.http.get<any[]>(`${this.base}/tables`);
  }  createTable(body: any) {
    return this.http.post<any>(`${this.base}/tables`, body, { headers: this.headers() as any });
  }
  updateTable(id: string, body: any) {
    return this.http.put<any>(`${this.base}/tables/${id}`, body, { headers: this.headers() as any });
  }
  deleteTable(id: string) {
    return this.http.delete(`${this.base}/tables/${id}`, { headers: this.headers() as any });
  }
  loyalty(phone: string) {
    return this.http.get<any>(`${this.base}/orders/loyalty/${encodeURIComponent(phone)}`, { headers: this.headers() as any });
  }
  trackOrder(phone: string) {
    return this.http.get<any[]>(`${this.base}/track/${encodeURIComponent(phone)}`);
  }
  // categories
  createCategory(body: any) {
    return this.http.post(`${this.base}/categories`, body, { headers: this.headers() as any });
  }
  updateCategory(id: string, body: any) {
    return this.http.put(`${this.base}/categories/${id}`, body, { headers: this.headers() as any });
  }
  deleteCategory(id: string) {
    return this.http.delete(`${this.base}/categories/${id}`, { headers: this.headers() as any });
  }
  // products
  createProduct(body: any) {
    return this.http.post<Product>(`${this.base}/products`, body, { headers: this.headers() as any });
  }
  updateProduct(id: string, body: any) {
    return this.http.put<Product>(`${this.base}/products/${id}`, body, { headers: this.headers() as any });
  }
  deleteProduct(id: string) {
    return this.http.delete(`${this.base}/products/${id}`, { headers: this.headers() as any });
  }
  // videos
  videos(activeOnly = false) {
    return this.http.get<any[]>(`${this.base}/videos`, activeOnly ? { params: { active: 'true' } } : {});
  }
  createVideo(body: any) {
    return this.http.post<any>(`${this.base}/videos`, body, { headers: this.headers() as any });
  }
  updateVideo(id: string, body: any) {
    return this.http.put<any>(`${this.base}/videos/${id}`, body, { headers: this.headers() as any });
  }
  deleteVideo(id: string) {
    return this.http.delete(`${this.base}/videos/${id}`, { headers: this.headers() as any });
  }
  uploadFile(file: File) {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<{ url: string; type: string }>(`${this.base}/upload`, form, { headers: this.headers() as any });
  }
  // employees
  employees() {
    return this.http.get<any[]>(`${this.base}/auth/users`, { headers: this.headers() as any });
  }  createEmployee(body: any) {
    return this.http.post(`${this.base}/auth/users`, body, { headers: this.headers() as any });
  }
  deleteEmployee(id: string) {
    return this.http.delete(`${this.base}/auth/users/${id}`, { headers: this.headers() as any });
  }
  updateEmployee(id: string, body: any) {
    return this.http.put<any>(`${this.base}/auth/users/${id}`, body, { headers: this.headers() as any });
  }
  // shop settings
  settings() {
    return this.http.get<any>(`${this.base}/settings`);
  }
  updateSettings(body: any) {
    return this.http.put(`${this.base}/settings`, body, { headers: this.headers() as any });
  }
  // offers
  offers() {
    return this.http.get<any[]>(`${this.base}/offers`, { headers: this.headers() as any });
  }
  activeOffers() {
    return this.http.get<any[]>(`${this.base}/offers`, { params: { active: 'true' } });
  }
  offerDetail(id: string) {
    return this.http.get<any>(`${this.base}/offers/${id}`, { headers: this.headers() as any });
  }
  createOffer(body: any) {
    return this.http.post<any>(`${this.base}/offers`, body, { headers: this.headers() as any });
  }
  updateOffer(id: string, body: any) {
    return this.http.put<any>(`${this.base}/offers/${id}`, body, { headers: this.headers() as any });
  }
  deleteOffer(id: string) {
    return this.http.delete(`${this.base}/offers/${id}`, { headers: this.headers() as any });
  }
}
