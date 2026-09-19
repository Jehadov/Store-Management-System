-- Shared backend schema mapped from src/Users/pages/types.ts
-- Postgres 15+

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Categories (was Firestore 'categories')
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL DEFAULT '',
  image TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Products (was Firestore 'products')
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL DEFAULT '',
  name_lowercase TEXT GENERATED ALWAYS AS (lower(name_en)) STORED,
  name_ar_lowercase TEXT,
  short_desc_en TEXT DEFAULT '',
  short_desc_ar TEXT DEFAULT '',
  long_desc_en TEXT DEFAULT '',
  long_desc_ar TEXT DEFAULT '',
  image TEXT DEFAULT '/placeholder-product.png',
  is_offer BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  manufactured_at DATE,
  expiration DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Many-to-many: product <-> category (replaces category:string[] array-contains)
CREATE TABLE IF NOT EXISTS product_categories (
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE RESTRICT,
  PRIMARY KEY (product_id, category_id)
);
CREATE INDEX IF NOT EXISTS idx_pc_category ON product_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_pc_product ON product_categories(product_id);

-- Variant groups (was Product.variants[] {name_en,name_ar,options[]})
CREATE TABLE IF NOT EXISTS variant_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  name_en TEXT NOT NULL DEFAULT 'Type',
  name_ar TEXT NOT NULL DEFAULT 'النوع',
  sort_order INT DEFAULT 0
);

-- Variant options (was VariantOption)
CREATE TABLE IF NOT EXISTS variant_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES variant_groups(id) ON DELETE CASCADE,
  value_en TEXT NOT NULL,
  value_ar TEXT NOT NULL DEFAULT '',
  unit_label_en TEXT DEFAULT 'piece',
  unit_label_ar TEXT DEFAULT 'قطعة',
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  original_price NUMERIC(10,2),
  quantity INT,
  image_url TEXT DEFAULT '/placeholder-image.png',
  offer_type TEXT DEFAULT 'none' CHECK (offer_type IN ('none','percentage','fixed')),
  offer_value NUMERIC(10,2) DEFAULT 0,
  offer_start TIMESTAMPTZ,
  offer_end TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_vo_group ON variant_options(group_id);

-- Stock model for made-to-order food: NULL quantity = unlimited.
-- (Dashboard used to default new options to 0, which wrongly blocked ordering.)
ALTER TABLE variant_options ALTER COLUMN quantity DROP NOT NULL;
ALTER TABLE variant_options ALTER COLUMN quantity DROP DEFAULT;
UPDATE variant_options SET quantity = NULL WHERE quantity = 0;

-- AddOns (was Firestore 'addOns')
CREATE TABLE IF NOT EXISTS addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL DEFAULT '',
  extra_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_addons (
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  addon_id UUID REFERENCES addons(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, addon_id)
);

-- Offers (was Firestore offers + inline variant offers)
CREATE TABLE IF NOT EXISTS offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_en TEXT NOT NULL,
  title_ar TEXT NOT NULL DEFAULT '',
  description_en TEXT DEFAULT '',
  description_ar TEXT DEFAULT '',
  type TEXT NOT NULL CHECK (type IN ('percentage_discount','fixed_discount','bogo','coupon')),
  discount_value NUMERIC(10,2) DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  coupon_code TEXT,
  discount_nature TEXT DEFAULT 'fixed' CHECK (discount_nature IN ('percentage','fixed')),
  bogo_buy_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  bogo_buy_qty INT DEFAULT 1,
  bogo_get_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  bogo_get_qty INT DEFAULT 1,
  bogo_get_type TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Shopify-style guards: minimum purchase to qualify, max total redemptions
ALTER TABLE offers ADD COLUMN IF NOT EXISTS min_purchase_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS usage_limit INT;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS used_count INT DEFAULT 0;
-- Offer card image (shown on home page strip)
ALTER TABLE offers ADD COLUMN IF NOT EXISTS image TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS offer_products (
  offer_id UUID REFERENCES offers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  PRIMARY KEY (offer_id, product_id)
);

-- Orders (was Firestore orders / CheckoutStepper ConfirmedOrderData + OrderData)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number SERIAL UNIQUE,
  service_method TEXT NOT NULL CHECK (service_method IN ('delivery','pickup','inRestaurant')),
  table_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','preparing','ready','on_the_way','completed','cancelled')),
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','cliq')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid')),
  -- shipping snapshot (AddressData)
  first_name TEXT DEFAULT '',
  last_name TEXT DEFAULT '',
  phone_number TEXT DEFAULT '',
  address TEXT DEFAULT '',
  city TEXT DEFAULT 'Amman',
  country TEXT DEFAULT 'Jordan',
  delivery_location TEXT DEFAULT '',
  delivery_lat DOUBLE PRECISION,
  delivery_lng DOUBLE PRECISION,
  total_amount NUMERIC(10,2) DEFAULT 0,
  language_at_order TEXT DEFAULT 'en',
  payment_bill_number TEXT,
  payment_transaction_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name_snapshot TEXT NOT NULL,
  variant_group_name TEXT DEFAULT '',
  variant_value TEXT DEFAULT '',
  unit_label TEXT DEFAULT '',
  unit_price NUMERIC(10,2) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  line_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  addons_snapshot JSONB DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_oi_order ON order_items(order_id);

-- Fix: line_total must include addons, so it's a regular column not generated
ALTER TABLE order_items DROP COLUMN IF EXISTS line_total;
ALTER TABLE order_items ADD COLUMN line_total NUMERIC(10,2) NOT NULL DEFAULT 0;

-- v2: stock + offers (idempotent for existing Docker DBs, applied via npm run db:migrate)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_option_id UUID REFERENCES variant_options(id) ON DELETE SET NULL;

-- Users for admin/cashier (replaces Firebase Auth for backend)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'cashier' CHECK (role IN ('admin','cashier','kitchen')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Promo / hero videos (managed by admin, shown on landing/home)
CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_en TEXT NOT NULL,
  title_ar TEXT NOT NULL DEFAULT '',
  description_en TEXT DEFAULT '',
  description_ar TEXT DEFAULT '',
  url TEXT NOT NULL,
  thumbnail TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_videos_active ON videos(is_active);

-- Shop settings (single row, id=1): restaurant name EN/AR + logo, shown in app header
CREATE TABLE IF NOT EXISTS settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name_en TEXT NOT NULL DEFAULT 'My Restaurant',
  name_ar TEXT NOT NULL DEFAULT 'مطعمي',
  logo_url TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS layout TEXT DEFAULT 'topbar';

-- Dining tables (admin-managed floor; occupancy derived live from active orders)
CREATE TABLE IF NOT EXISTS dining_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT UNIQUE NOT NULL,
  seats INT DEFAULT 4,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Loyalty (phone-number wallets; earn on paid orders, redeem as discount)
CREATE TABLE IF NOT EXISTS loyalty (
  phone TEXT PRIMARY KEY,
  points INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS loyalty_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS loyalty_earned INT DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS loyalty_redeemed INT DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS loyalty_discount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS loyalty_earn_per_jd NUMERIC(10,2) DEFAULT 1;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS loyalty_jd_per_point NUMERIC(10,2) DEFAULT 0.05;
-- Products with order history can't be deleted; disable them instead
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
-- Theme studio: per-mode palettes (JSON) + shop contact phones (up to 4)
ALTER TABLE settings ADD COLUMN IF NOT EXISTS theme_json TEXT DEFAULT '{}';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS phones TEXT[] DEFAULT '{}';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS whatsapp_from TEXT DEFAULT '';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS whatsapp_token TEXT DEFAULT '';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS whatsapp_service_sid TEXT DEFAULT '';

-- Order workflow: pay-at-cashier by order ID + delivery on-the-way stageALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid';
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending','preparing','ready','on_the_way','completed','cancelled'));
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('unpaid','paid'));

-- Losses / expenses (rent, salaries, food cost, waste...) for profit dashboards
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'other',
  spent_at DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(spent_at);

-- BOGO legs also release deleted products (offer stays, engine skips it)
ALTER TABLE offers DROP CONSTRAINT IF EXISTS offers_bogo_buy_product_id_fkey;
ALTER TABLE offers ADD CONSTRAINT offers_bogo_buy_product_id_fkey
  FOREIGN KEY (bogo_buy_product_id) REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE offers DROP CONSTRAINT IF EXISTS offers_bogo_get_product_id_fkey;
ALTER TABLE offers ADD CONSTRAINT offers_bogo_get_product_id_fkey
  FOREIGN KEY (bogo_get_product_id) REFERENCES products(id) ON DELETE SET NULL;

-- Deleted products stay visible in old orders via snapshots (product_id SET NULL)
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
ALTER TABLE order_items ADD CONSTRAINT order_items_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
-- Same for variant options (variant_value snapshot keeps showing)
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_variant_option_id_fkey;
ALTER TABLE order_items ADD CONSTRAINT order_items_variant_option_id_fkey
  FOREIGN KEY (variant_option_id) REFERENCES variant_options(id) ON DELETE SET NULL;

-- Order assignment (kitchen staff can claim orders as their task)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
