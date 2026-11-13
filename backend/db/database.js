const path = require("path");
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");
const initSqlJs = require("sql.js");

const dbDir = __dirname;
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
const dbPath = path.join(dbDir, "tich.db");

let _mode = "sqlite"; // "supabase" | "sqlite"
let _supabase = null;
let _sqlDb = null;
let _sqlWrapper = null;

// ==============================================================================
// 1. UTILITAIRES DE PARSING & SLUG
// ==============================================================================
function slugify(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Convertit un enregistrement Supabase → objet JS (camelCase)
// Tolère toutes les variantes de noms de colonnes (reviewscount, reviews_count, reviewsCount)
function fromSupabase(row) {
  if (!row) return null;
  let options = row.options;
  if (typeof options === "string") {
    try { options = JSON.parse(options); } catch (e) { options = []; }
  }
  // Lecture tolérante : fonctionne quelle que soit la casse du nom de colonne
  const reviewsCount = Number(
    row.reviews_count ?? row.reviewscount ?? row.reviewsCount ?? 0
  );
  const subCategory = row.subcategory ?? row.subCategory ?? row.subCat ?? "";

  return {
    id: row.id,
    name: row.name,
    category: row.category || "",
    subCategory: subCategory,
    price: Number(row.price) || 0,
    type: row.type || "",
    image: row.image || "",
    tag: row.tag || "",
    rating: Number(row.rating) || 5.0,
    reviewsCount: reviewsCount,
    description: row.description || "",
    options: Array.isArray(options) ? options : [],
    details: row.details || "",
    stock: Number(row.stock) || 0,
    created_at: row.created_at
  };
}

// Convertit un objet JS (camelCase) → record Supabase
// Ne contient JAMAIS reviewsCount pour éviter les erreurs de colonnes manquantes
function toSupabase(data) {
  const record = {};
  if (data.id !== undefined)          record.id = data.id;
  if (data.name !== undefined)        record.name = data.name;
  if (data.category !== undefined)    record.category = data.category;
  if (data.subCategory !== undefined) record.subcategory = data.subCategory;
  if (data.price !== undefined)       record.price = Number(data.price) || 0;
  if (data.type !== undefined)        record.type = data.type;
  if (data.image !== undefined)       record.image = data.image;
  if (data.tag !== undefined)         record.tag = data.tag;
  if (data.rating !== undefined)      record.rating = Number(data.rating) || 5.0;
  if (data.description !== undefined) record.description = data.description;
  if (data.options !== undefined)     record.options = Array.isArray(data.options) ? data.options : [];
  if (data.details !== undefined)     record.details = data.details;
  if (data.stock !== undefined)       record.stock = Number(data.stock) || 0;
  // reviewsCount intentionnellement exclus → géré par DEFAULT 0 dans Supabase
  return record;
}

// Pour SQLite local (colonnes camelCase)
function formatProduct(row) {
  if (!row) return null;
  let options = row.options;
  if (typeof options === "string") {
    try { options = JSON.parse(options); } catch (e) { options = []; }
  }
  return {
    ...row,
    price: Number(row.price) || 0,
    stock: Number(row.stock) || 0,
    rating: Number(row.rating) || 5.0,
    reviewsCount: Number(row.reviewsCount) || 0,
    options: Array.isArray(options) ? options : []
  };
}

// ==============================================================================
// 2. MOTEUR SQLITE LOCAL (Fallback)
// ==============================================================================
function persistSqlite() {
  if (!_sqlDb) return;
  const data = _sqlDb.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

class SqlJsWrapper {
  constructor(sqlDb) {
    this._db = sqlDb;
  }
  exec(sql) {
    this._db.run(sql);
    persistSqlite();
  }
  prepare(sql) {
    const self = this;
    return {
      run(...params) {
        self._db.run(sql, params);
        persistSqlite();
        return { changes: 1 };
      },
      get(...params) {
        const stmt = self._db.prepare(sql);
        stmt.bind(params.length ? params : []);
        if (stmt.step()) {
          const row = stmt.getAsObject();
          stmt.free();
          return row;
        }
        stmt.free();
        return null;
      },
      all(...params) {
        const stmt = self._db.prepare(sql);
        if (params.length) stmt.bind(params);
        const rows = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        return rows;
      }
    };
  }
}

// ==============================================================================
// 3. SCHÉMA SQLite LOCAL
// ==============================================================================
const SCHEMA_SQLITE = `
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT DEFAULT '',
    subCategory TEXT DEFAULT '',
    price INTEGER DEFAULT 0,
    type TEXT DEFAULT '',
    image TEXT DEFAULT '',
    tag TEXT DEFAULT '',
    rating REAL DEFAULT 5.0,
    reviewsCount INTEGER DEFAULT 0,
    description TEXT DEFAULT '',
    options TEXT DEFAULT '[]',
    details TEXT DEFAULT '',
    stock INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`;

// ==============================================================================
// 4. INITIALISATION (Supabase ou SQLite)
// ==============================================================================
async function initDB() {
  let supabaseUrl = (process.env.SUPABASE_URL || "").trim();
  if (supabaseUrl) {
    supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
  }
  const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || "").trim();

  if (supabaseUrl && supabaseKey && !supabaseUrl.includes("VOTRE_PROJET")) {
    try {
      console.log("[DB] ☁️ Tentative de connexion à Supabase...");
      _supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false }
      });

      const { data, error } = await _supabase.from("products").select("id").limit(1);
      if (error) {
        console.warn("[DB] ⚠️ Erreur Supabase:", error.message);
        console.warn("[DB] 💡 Exécutez le script 'backend/db/supabase_schema.sql' dans votre console Supabase.");
      } else {
        _mode = "supabase";
        console.log("[DB] ✅ Connecté à Supabase Cloud (PostgreSQL) avec succès !");
        return;
      }
    } catch (e) {
      console.warn("[DB] Erreur initialisation Supabase:", e.message);
    }
  }

  // Fallback SQLite
  _mode = "sqlite";
  const wasmPath = path.join(path.dirname(require.resolve("sql.js")), "dist", "sql-wasm.wasm");
  const opts = fs.existsSync(wasmPath) ? { wasmBinary: fs.readFileSync(wasmPath) } : {};
  const SQL = await initSqlJs(opts);

  if (fs.existsSync(dbPath) && fs.statSync(dbPath).size > 0) {
    try {
      _sqlDb = new SQL.Database(fs.readFileSync(dbPath));
    } catch (e) {
      _sqlDb = new SQL.Database();
    }
  } else {
    _sqlDb = new SQL.Database();
  }

  _sqlWrapper = new SqlJsWrapper(_sqlDb);
  _sqlWrapper.exec(SCHEMA_SQLITE);
  console.log("[DB] 💾 Mode local SQLite actif (sql.js / WASM)");
  if (!supabaseUrl || supabaseUrl.includes("VOTRE_PROJET")) {
    console.log("[DB] 💡 Pour activer Supabase, ajoutez SUPABASE_URL et SUPABASE_KEY dans votre fichier .env");
  }
}

// ==============================================================================
// 5. API UNIFIÉE PRODUITS & PARAMÈTRES
// ==============================================================================
const db = {
  getMode() {
    return _mode;
  },

  async getProducts({ category, subCategory, search } = {}) {
    if (_mode === "supabase") {
      let q = _supabase.from("products").select("*").order("created_at", { ascending: false });
      if (category && category !== "Tous") q = q.eq("category", category);
      if (subCategory && !subCategory.startsWith("Tous")) q = q.eq("subcategory", subCategory);
      if (search) q = q.or(`name.ilike.%${search}%,description.ilike.%${search}%`);

      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map(fromSupabase);
    } else {
      let query = "SELECT * FROM products";
      const params = [];
      const conditions = [];
      if (category && category !== "Tous") {
        conditions.push("category = ?");
        params.push(category);
      }
      if (subCategory && !subCategory.startsWith("Tous")) {
        conditions.push("subCategory = ?");
        params.push(subCategory);
      }
      if (search) {
        conditions.push("(name LIKE ? OR description LIKE ?)");
        params.push(`%${search}%`, `%${search}%`);
      }
      if (conditions.length) query += " WHERE " + conditions.join(" AND ");
      query += " ORDER BY created_at DESC";
      const rows = _sqlWrapper.prepare(query).all(...params);
      return rows.map(formatProduct);
    }
  },

  async getProductById(id) {
    if (_mode === "supabase") {
      const { data, error } = await _supabase.from("products").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? fromSupabase(data) : null;
    } else {
      const row = _sqlWrapper.prepare("SELECT * FROM products WHERE id = ?").get(id);
      return row ? formatProduct(row) : null;
    }
  },

  async createProduct(data) {
    const id = data.id || slugify(data.name) + "-" + Date.now();
    const jsRecord = {
      id,
      name: data.name,
      category: data.category || "",
      subCategory: data.subCategory || "",
      price: Number(data.price) || 0,
      type: data.type || "",
      image: data.image || "",
      tag: data.tag || "",
      rating: Number(data.rating) || 5.0,
      reviewsCount: Number(data.reviewsCount) || 0,
      description: data.description || "",
      options: Array.isArray(data.options) ? data.options : [],
      details: data.details || "",
      stock: Number(data.stock) || 0
    };

    if (_mode === "supabase") {
      const sbRecord = toSupabase(jsRecord);
      const { data: created, error } = await _supabase
        .from("products")
        .insert([sbRecord])
        .select()
        .single();
      if (error) throw error;
      return fromSupabase(created);
    } else {
      _sqlWrapper.prepare(`
        INSERT INTO products (id, name, category, subCategory, price, type, image, tag, rating, reviewsCount, description, options, details, stock)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        jsRecord.id, jsRecord.name, jsRecord.category, jsRecord.subCategory,
        jsRecord.price, jsRecord.type, jsRecord.image, jsRecord.tag,
        jsRecord.rating, jsRecord.reviewsCount, jsRecord.description,
        JSON.stringify(jsRecord.options), jsRecord.details, jsRecord.stock
      );
      return this.getProductById(id);
    }
  },

  async updateProduct(id, data) {
    const existing = await this.getProductById(id);
    if (!existing) return null;

    const updated = {
      name:         data.name         ?? existing.name,
      category:     data.category     ?? existing.category,
      subCategory:  data.subCategory  ?? existing.subCategory,
      price:        data.price        !== undefined ? Number(data.price)        : existing.price,
      type:         data.type         ?? existing.type,
      image:        data.image        ?? existing.image,
      tag:          data.tag          ?? existing.tag,
      rating:       data.rating       !== undefined ? Number(data.rating)       : existing.rating,
      reviewsCount: data.reviewsCount !== undefined ? Number(data.reviewsCount) : existing.reviewsCount,
      description:  data.description  ?? existing.description,
      options:      data.options      ?? existing.options,
      details:      data.details      ?? existing.details,
      stock:        data.stock        !== undefined ? Number(data.stock)        : existing.stock
    };

    if (_mode === "supabase") {
      const sbUpdate = toSupabase(updated);
      const { data: res, error } = await _supabase
        .from("products")
        .update(sbUpdate)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return fromSupabase(res);
    } else {
      _sqlWrapper.prepare(`
        UPDATE products SET name=?, category=?, subCategory=?, price=?, type=?, image=?, tag=?,
        rating=?, reviewsCount=?, description=?, options=?, details=?, stock=? WHERE id=?
      `).run(
        updated.name, updated.category, updated.subCategory, updated.price,
        updated.type, updated.image, updated.tag, updated.rating,
        updated.reviewsCount, updated.description, JSON.stringify(updated.options),
        updated.details, updated.stock, id
      );
      return this.getProductById(id);
    }
  },

  async updateStock(id, stock) {
    if (_mode === "supabase") {
      const { data, error } = await _supabase
        .from("products")
        .update({ stock })
        .eq("id", id)
        .select("id, stock")
        .single();
      if (error) throw error;
      return { id: data.id, stock: data.stock };
    } else {
      const result = _sqlWrapper.prepare("UPDATE products SET stock = ? WHERE id = ?").run(stock, id);
      if (result.changes === 0) return null;
      return { id, stock };
    }
  },

  async deleteProduct(id) {
    if (_mode === "supabase") {
      const { error } = await _supabase.from("products").delete().eq("id", id);
      if (error) throw error;
      return { success: true };
    } else {
      const result = _sqlWrapper.prepare("DELETE FROM products WHERE id = ?").run(id);
      if (result.changes === 0) return null;
      return { success: true };
    }
  },

  async getSetting(key) {
    if (_mode === "supabase") {
      const { data, error } = await _supabase.from("settings").select("value").eq("key", key).maybeSingle();
      if (error) return null;
      return data ? data.value : null;
    } else {
      const row = _sqlWrapper.prepare("SELECT value FROM settings WHERE key = ?").get(key);
      return row ? row.value : null;
    }
  },

  async setSetting(key, value) {
    if (_mode === "supabase") {
      const { error } = await _supabase.from("settings").upsert({ key, value });
      if (error) throw error;
    } else {
      _sqlWrapper.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value);
    }
  }
};

module.exports = { db, initDB };
