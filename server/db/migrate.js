const { pool } = require("./pool");

async function createBaseTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      pass_salt TEXT NOT NULL,
      pass_hash TEXT NOT NULL,
      is_admin BOOLEAN NOT NULL DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      group_name TEXT NOT NULL,
      section TEXT NOT NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      icon_url TEXT NOT NULL DEFAULT '',
      emoji TEXT NOT NULL DEFAULT '🎮',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      price INTEGER NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      category TEXT NOT NULL,
      image_url TEXT NOT NULL DEFAULT '',
      tile_slug TEXT NOT NULL DEFAULT '',
      section TEXT NOT NULL DEFAULT 'Игры'
    );

    CREATE TABLE IF NOT EXISTS product_likes (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS product_ratings (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      subtotal INTEGER NOT NULL,
      delivery_price INTEGER NOT NULL,
      total INTEGER NOT NULL,
      delivery_method TEXT NOT NULL,
      delivery_city TEXT NOT NULL,
      delivery_address TEXT NOT NULL,
      phone TEXT NOT NULL,
      comment TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      price INTEGER NOT NULL,
      qty INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS order_status_history (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS product_images (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      image_url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_cover BOOLEAN NOT NULL DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS seller_follows (
      follower_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      seller_user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at       TEXT NOT NULL DEFAULT (NOW()::text),
      PRIMARY KEY (follower_user_id, seller_user_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      link TEXT NOT NULL DEFAULT '',
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TEXT NOT NULL DEFAULT (NOW()::text)
    );

    CREATE TABLE IF NOT EXISTS seller_requests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      shop_name TEXT NOT NULL,
      shop_slug TEXT NOT NULL,
      avatar_url TEXT NOT NULL DEFAULT '',
      about TEXT NOT NULL DEFAULT '',
      contacts TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      admin_comment TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reviewed_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function applySchemaUpdates() {
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_seller BOOLEAN NOT NULL DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_access BOOLEAN NOT NULL DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_about TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_banner_url TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_telegram TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_instagram TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_whatsapp TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_tiktok TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS specs_json TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'dark';`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS lang TEXT NOT NULL DEFAULT 'ru';`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS specs_json TEXT NOT NULL DEFAULT '[]';`);
}

async function createIndexes() {
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS ux_reviews_user_product ON reviews(user_id, product_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_products_owner_user_id ON products(owner_user_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_seller_follows_seller ON seller_follows(seller_user_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_seller_follows_follower ON seller_follows(follower_user_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at);`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS ux_seller_requests_shop_slug_lower ON seller_requests (LOWER(shop_slug));`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_seller_requests_user_id ON seller_requests(user_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_seller_requests_status ON seller_requests(status);`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS ux_seller_requests_one_pending_per_user ON seller_requests(user_id) WHERE status = 'pending';`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);`);
}

async function migrate() {
  await createBaseTables();
  await applySchemaUpdates();
  await createIndexes();
}

module.exports = {
  migrate,
  createBaseTables,
  applySchemaUpdates,
  createIndexes,
};
