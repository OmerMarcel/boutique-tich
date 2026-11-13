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
    const { name, category, price } = req.body;
    if (!name || !category || price === undefined) {
      return res.status(400).json({ error: "Champs obligatoires manquants (name, category, price)" });
    }
    const product = await db.createProduct(req.body);
    res.status(201).json({ product });
  } catch (e) {
    console.error("Erreur POST /api/products:", e);
    res.status(500).json({ error: "Erreur serveur: " + e.message });
  }
});

// PUT /api/products/:id (auth)
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const product = await db.updateProduct(req.params.id, req.body);
    if (!product) return res.status(404).json({ error: "Produit introuvable" });
    res.json({ product });
  } catch (e) {
    console.error("Erreur PUT /api/products:", e);
    res.status(500).json({ error: "Erreur serveur: " + e.message });
  }
});

// PATCH /api/products/:id/stock (auth)
router.patch("/:id/stock", requireAuth, async (req, res) => {
  try {
    const { stock } = req.body;
    if (typeof stock !== "number") return res.status(400).json({ error: "stock doit être un nombre" });
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
