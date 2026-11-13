const express = require("express");
const router = express.Router();
const { db } = require("../db/database");
const { requireAuth } = require("../middleware/authMiddleware");

const DEFAULT_WHATSAPP = "33612345678";

// GET /api/settings/whatsapp (Accès public pour synchroniser client & admin)
router.get("/whatsapp", async (req, res) => {
  try {
    const phone = await db.getSetting("whatsapp_phone");
    res.json({ whatsapp: phone || DEFAULT_WHATSAPP });
  } catch (e) {
    console.error("Erreur GET /api/settings/whatsapp:", e);
    res.json({ whatsapp: DEFAULT_WHATSAPP });
  }
});

// POST ou PUT /api/settings/whatsapp (Protégé — Administrateur uniquement)
router.post("/whatsapp", requireAuth, async (req, res) => {
  try {
    const raw = req.body.whatsapp || req.body.phone;
    if (!raw) {
      return res.status(400).json({ error: "Numéro de téléphone WhatsApp requis" });
    }
    const clean = String(raw).replace(/\D/g, "");
    if (clean.length < 6) {
      return res.status(400).json({ error: "Numéro trop court (minimum 6 chiffres avec indicatif pays sans le +)" });
    }
    await db.setSetting("whatsapp_phone", clean);
    res.json({ success: true, whatsapp: clean });
  } catch (e) {
    console.error("Erreur POST /api/settings/whatsapp:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.put("/whatsapp", requireAuth, async (req, res) => {
  try {
    const raw = req.body.whatsapp || req.body.phone;
    if (!raw) {
      return res.status(400).json({ error: "Numéro de téléphone WhatsApp requis" });
    }
    const clean = String(raw).replace(/\D/g, "");
    if (clean.length < 6) {
      return res.status(400).json({ error: "Numéro trop court (minimum 6 chiffres avec indicatif pays sans le +)" });
    }
    await db.setSetting("whatsapp_phone", clean);
    res.json({ success: true, whatsapp: clean });
  } catch (e) {
    console.error("Erreur PUT /api/settings/whatsapp:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;

