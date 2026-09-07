# Shared API Contract (React web + Angular desktop POS)

Base: `http://localhost:4000/api` — mapped from `src/Users/pages/types.ts`

## Mapping Firestore -> Postgres -> REST

| Firestore | Postgres | REST |
|---|---|---|
| `categories` | `categories` | `GET/POST /categories`, `PUT/DELETE /categories/:id` |
| `products` + `category:string[]` | `products` + `product_categories` | `GET /products?categoryId=&search=&limit=&offset=`, `POST /products` (admin), `PUT/DELETE /products/:id` (admin, 409 if ordered) |
| `products/:id` + `variants[]` | `products` + `variant_groups` + `variant_options` | `GET /products/:id` returns `{...product, category:[ids], variants:[{...group, options:[]}], addons:[]}` |
| `addOns` | `addons` + `product_addons` | `GET /addons`, `POST/PUT/DELETE /addons` (admin), `PUT /addons/link/product` |
| `offers` | `offers` + `offer_products` | `GET /offers?active=true`, `GET /offers/:id`, `POST/PUT/DELETE /offers` (admin). Types: `percentage_discount`/`fixed_discount`/`bogo` (auto-best) + `coupon` (code). Guards: `min_purchase_amount`, `usage_limit`/`used_count`. Orders accept `couponCode`; totals split `subtotal/discount/total` |
| promo / hero videos | `videos` | `GET /videos?active=true`, `GET /videos/:id`, `POST/PUT/DELETE /videos/:id` (admin) |
| images (URL strings) + promo mp4 | local disk `./uploads` | `POST /upload` (admin, form-data `file`\|`image`\|`video`) -> `{url, type, mimetype, size}` (.jpg/.png/.webp/.gif, .mp4/.webm/.mov, 50MB) |
| Firebase Auth (missing) | `users` | `POST /auth/seed` (first admin once), `POST /auth/login` -> `{token,user}`, `POST /auth/users` + `DELETE /auth/users/:id` (admin, no self-delete, no last-admin delete) |
| `CheckoutStepper` confirm | `orders` + `order_items` | `POST /orders` |
| `AdminDashboard` TODO recent orders | `orders` | `GET /orders?status=pending`, `PATCH /orders/:id/status` |
| `AdminDashboard` one-call overview | all tables | `GET /admin/overview` (admin) -> `{counts, revenue{total,today}, recentOrders[10], lowStock[20]}` |
| analytics dashboards | orders/items/offers | `GET /admin/stats/revenue?days|preset|year&month`, `/stats/years`, `/stats/top-products`, `/stats/mix`, `/stats/hours`, `/stats/categories`, `/stats/discounts`, `/stats/eod?date=` (admin) |
| dining tables floor | `dining_tables` | `GET /tables` (public, live occupancy), `POST/PUT/DELETE /tables/:id` (admin, 409 if occupied) |
| loyalty wallets | `loyalty` | orders accept `loyaltyPhone`+`redeemPoints` (earn configured in settings); `GET /orders/loyalty/:phone` (staff); cancel/edit restores points |
| order tracking | `orders` by phone | `GET /track/:phone` (public, last-9-digit tolerant) -> orders with items; phones canonical `+<code><number>` |
| shop identity (header brand) | `settings` | `GET /settings`, `PUT /settings` (admin) `{name_en, name_ar, logo_url}` |

## POST /orders body (from CartItem + ConfirmedOrderData)

```json
{
  "serviceMethod": "delivery|pickup|inRestaurant",
  "tableNumber": "T5",
  "payment": { "method": "cash|cliq" },
  "shipping": { "firstName": "", "lastName": "", "phoneNumber": "", "address": "", "city": "Amman", "country": "Jordan" },
  "deliveryMeta": { "name": "", "phoneNumber": "", "location": "", "coordinates": { "lat": 0, "lng": 0 } },
  "cartItems": [
    { "id": "product-uuid", "name": "Burger", "price": 4.5, "quantity": 2,
      "variant": { "name": "Size", "value": "Large", "unitLabel": "piece" },
      "addOns": [{ "id": "uuid", "name_en": "Cheese", "extraPrice": 0.5 }] }
  ],
  "languageAtOrder": "en|ar"
}
```
Server recomputes pricing — never trust client `price`/`extraPrice`:
- resolves each line to a `variant_options` row (`optionId` preferred, else `variant.value`, else cheapest), `409` on insufficient stock, decrements `quantity` in the order transaction.
- validates addon ids against `addons.extra_price`.
- `couponCode` applies a matching active `offers` coupon; otherwise the best active auto offer (`percentage_discount`/`fixed_discount`/`bogo`) applies. Stores `subtotal_amount`, `discount_amount`, `coupon_code`.
- Response: `{ orderId, order_number, subtotal, discount, total }`.
- `PUT /orders/:id` (pending only) restores old stock then re-applies; `PATCH /orders/:id/status -> cancelled` restores stock, re-activating re-checks stock.

## Fixes vs current Firestore code

1. Category delete returns `409` if in use — fixes orphan bug in `ManageCategory.tsx:119`.
2. `GET /products` has `limit/offset` server pagination — replaces client `limit(50)` in `Home.tsx:48`.
3. `GET /products/:id` returns normalized variants — replaces fragile `transformFirestoreProductToProductData` in `ProductDetails.tsx:47`.
4. Auth: `POST /auth/seed {username,password}` once -> first admin, then `POST /auth/login` -> `{token}`. Send `Authorization: Bearer <token>`. Writes require `admin`, orders read/update allow `admin,cashier,kitchen`. Fixes open `/admin` in `App.tsx:71`.

## Auth + upload quick test

```bash
curl -X POST localhost:4000/api/auth/seed -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}'
TOKEN=$(curl -s -X POST localhost:4000/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}' | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).token")
curl localhost:4000/api/categories -H "Authorization: Bearer $TOKEN"
curl -X POST localhost:4000/api/upload -H "Authorization: Bearer $TOKEN" -F image=@./test.png
```

## Run

```bash
createdb restaurant
psql $DATABASE_URL -f server/src/db/schema.sql
cd server && cp .env.example .env && npm i && npm run dev
```
