const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const { initDB } = require("./db/database");

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS || "http://localhost:3000,http://localhost:3001")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean)
);

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET doit être défini et contenir au moins 32 caractères.");
}
if (!process.env.ADMIN_USERNAME || (!process.env.ADMIN_PASSWORD && !process.env.ADMIN_PASSWORD_HASH)) {
  throw new Error("ADMIN_USERNAME et ADMIN_PASSWORD_HASH (ou ADMIN_PASSWORD) sont requis.");
}

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  next();
});

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("Origine CORS non autorisée"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));

// Fichiers uploadés (photos de produits)
const uploadsDir = path.join(__dirname, "uploads");
app.use("/uploads", express.static(uploadsDir));

// Routes API REST
app.use("/api/auth", require("./routes/auth"));
app.use("/api/products", require("./routes/products"));
app.use("/api/upload", require("./routes/upload"));
app.use("/api/settings", require("./routes/settings"));

// Endpoint racine de diagnostic
app.get("/", (req, res) => {
  res.json({
    status: "online",
    name: "Tich Atelier REST API",
    version: "1.0.0",
    endpoints: {
      products: "/api/products",
      auth: "/api/auth/login",
      upload: "/api/upload",
      settings: "/api/settings/whatsapp",
      uploads: "/uploads"
    }
  });
});

app.use((err, req, res, next) => {
  console.error("Erreur middleware API:", err);
  if (res.headersSent) return next(err);
  res.status(400).json({ error: "Requête invalide" });
});

// Démarrage du serveur après initialisation de la base (Supabase ou SQLite local)
initDB().then(() => {
  app.listen(PORT, () => {
    console.log("=========================================");
    console.log("  ✨ TICH ATELIER — BACKEND API PRÊT ✨  ");
    console.log("=========================================");
    console.log(`  🚀 API Racine : http://localhost:${PORT}/`);
    console.log(`  📦 Produits   : http://localhost:${PORT}/api/products`);
    console.log(`  🖼️  Uploads    : http://localhost:${PORT}/uploads`);
    console.log("=========================================");
  });
}).catch(err => {
  console.error("Échec initialisation base de données:", err);
  process.exit(1);
});
