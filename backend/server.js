const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const { initDB } = require("./db/database");

const app = express();
const PORT = process.env.PORT || 5000;

// Autorise tous les clients et dashboards (CORS cross-origin)
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

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
