const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const SESSION_TTL = process.env.ADMIN_SESSION_TTL || "7d";
const configuredPasswordHash = process.env.ADMIN_PASSWORD_HASH;
const configuredPassword = process.env.ADMIN_PASSWORD;
const passwordHashPromise = configuredPasswordHash
  ? Promise.resolve(configuredPasswordHash)
  : bcrypt.hash(configuredPassword, 12);

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Identifiants manquants" });
    }

    const expectedUser = process.env.ADMIN_USERNAME;
    const source = req.ip || "unknown";
    const now = Date.now();
    const attempt = attempts.get(source);
    if (attempt && now - attempt.startedAt < WINDOW_MS && attempt.count >= MAX_ATTEMPTS) {
      return res.status(429).json({ error: "Trop de tentatives. Réessayez plus tard." });
    }
    if (attempt && now - attempt.startedAt >= WINDOW_MS) attempts.delete(source);

    if (username !== expectedUser) {
      registerFailure(source);
      return res.status(401).json({ error: "Identifiants incorrects" });
    }

    const passwordHash = await passwordHashPromise;
    const valid = await bcrypt.compare(password, passwordHash);

    if (!valid) {
      registerFailure(source);
      return res.status(401).json({ error: "Identifiants incorrects" });
    }

    attempts.delete(source);
    const token = jwt.sign({ role: "admin", username }, process.env.JWT_SECRET, { expiresIn: SESSION_TTL });
    res.json({ token, expiresIn: SESSION_TTL });
  } catch (e) {
    console.error("Erreur login:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

function registerFailure(source) {
  const now = Date.now();
  const current = attempts.get(source);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    attempts.set(source, { startedAt: now, count: 1 });
  } else {
    current.count += 1;
  }
}

module.exports = router;
