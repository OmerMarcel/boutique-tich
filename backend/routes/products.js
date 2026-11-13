const express = require("express");
const router = express.Router();
const { db } = require("../db/database");
const { requireAuth } = require("../middleware/authMiddleware");

// GET /api/products
router.get("/", async (req, res) => {
  try {
    const { category, subCategory, search } = req.query;
    const products = await db.getProducts({ category, subCategory, search });
    res.json({ products, driver: db.getMode() });
  } catch (e) {
    console.error("Erreur GET /api/products:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /api/products/:id
router.get("/:id", async (req, res) => {
  try {
    const product = await db.getProductById(req.params.id);
    if (!product) return res.status(404).json({ error: "Produit introuvable" });
    res.json({ product });
  } catch (e) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// POST /api/products (auth)
router.post("/", requireAuth, async (req, res) => {
  try {
    const validationError = validateProduct(req.body, true);
    if (validationError) return res.status(400).json({ error: validationError });
    const product = await db.createProduct(req.body);
    res.status(201).json({ product });
  } catch (e) {
    console.error("Erreur POST /api/products:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// PUT /api/products/:id (auth)
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const validationError = validateProduct(req.body, false);
    if (validationError) return res.status(400).json({ error: validationError });
    const product = await db.updateProduct(req.params.id, req.body);
    if (!product) return res.status(404).json({ error: "Produit introuvable" });
    res.json({ product });
  } catch (e) {
    console.error("Erreur PUT /api/products:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// PATCH /api/products/:id/stock (auth)
router.patch("/:id/stock", requireAuth, async (req, res) => {
  try {
    const { stock } = req.body;
    if (!Number.isInteger(stock) || stock < 0 || stock > 1000000) {
      return res.status(400).json({ error: "stock doit être un entier positif" });
    }
    const result = await db.updateStock(req.params.id, stock);
    if (!result) return res.status(404).json({ error: "Produit introuvable" });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// DELETE /api/products/:id (auth)
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const result = await db.deleteProduct(req.params.id);
    if (!result) return res.status(404).json({ error: "Produit introuvable" });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;

function validateProduct(data, required) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return "Corps de requête invalide";
  if (required && (!isText(data.name, 1, 200) || !isText(data.category, 1, 100))) {
    return "name et category sont obligatoires";
  }
  if (data.name !== undefined && !isText(data.name, 1, 200)) return "name invalide";
  if (data.category !== undefined && !isText(data.category, 1, 100)) return "category invalide";
  if (data.subCategory !== undefined && !isText(data.subCategory, 0, 100)) return "subCategory invalide";
  if (data.type !== undefined && !isText(data.type, 0, 200)) return "type invalide";
  if (data.tag !== undefined && !isText(data.tag, 0, 50)) return "tag invalide";
  if (data.description !== undefined && !isText(data.description, 0, 5000)) return "description invalide";
  if (data.details !== undefined && !isText(data.details, 0, 5000)) return "details invalide";
  if (data.image !== undefined && !isText(data.image, 0, 2000)) return "image invalide";
  if (data.price !== undefined && (!Number.isInteger(data.price) || data.price < 0 || data.price > 1000000000)) {
    return "price doit être un entier positif";
  }
  if (data.stock !== undefined && (!Number.isInteger(data.stock) || data.stock < 0 || data.stock > 1000000)) {
    return "stock doit être un entier positif";
  }
  if (data.options !== undefined && (!Array.isArray(data.options) || data.options.length > 50 ||
      data.options.some(option => !isText(option, 1, 100)))) {
    return "options invalides";
  }
  return null;
}

function isText(value, min, max) {
  return typeof value === "string" && value.trim().length >= min && value.length <= max;
}
