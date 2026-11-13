const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { db } = require("../db/database");

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Identifiants manquants" });
    }

    const expectedUser = process.env.ADMIN_USERNAME || "admin";
    const expectedPass = process.env.ADMIN_PASSWORD || "TichAdmin2024!";

    if (username !== expectedUser) {
      return res.status(401).json({ error: "Identifiants incorrects" });
    }

    // Vérifie le hash de mot de passe stocké
    const storedHash = await db.getSetting("admin_password_hash");
    let valid = false;

    if (storedHash) {
      valid = await bcrypt.compare(password, storedHash);
    } else {
      // Première connexion : comparaison directe puis stockage du hash
      valid = (password === expectedPass);
      if (valid) {
        const hash = await bcrypt.hash(expectedPass, 10);
        await db.setSetting("admin_password_hash", hash);
      }
    }

    if (!valid) {
      return res.status(401).json({ error: "Identifiants incorrects" });
    }

    const secret = process.env.JWT_SECRET || "tich_jwt_secret_dev_key";
    const token = jwt.sign({ role: "admin", username }, secret, { expiresIn: "24h" });
    res.json({ token, expiresIn: "24h" });
  } catch (e) {
    console.error("Erreur login:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
