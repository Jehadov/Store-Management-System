// core/api.service.ts - drop into Angular standalone app
// import { HttpClient } from '@angular/common/http'; @Injectable({providedIn:'root'})
export const API_BASE = 'http://localhost:4000/api';

export interface PosCartItem {
  id: string; name: string; price: number; quantity: number;
  variant?: { name: string; value: string; unitLabel?: string };
  addOns?: { id: string; name_en: string; extraPrice: number }[];
}

// Endpoints used:
// GET ${API_BASE}/categories
// GET ${API_BASE}/products?categoryId=&search=&limit=50&offset=0
// GET ${API_BASE}/products/:id
// POST ${API_BASE}/orders { serviceMethod, tableNumber, payment, shipping, deliveryMeta, cartItems }
// GET ${API_BASE}/orders?status=pending
// PATCH ${API_BASE}/orders/:id/status
