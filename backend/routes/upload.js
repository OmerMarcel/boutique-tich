const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const { requireAuth } = require("../middleware/authMiddleware");

const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".webp"];
    if (!allowed.includes(path.extname(file.originalname).toLowerCase()) ||
        !["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      return cb(new Error("Type de fichier non autorisé"));
    }
    cb(null, true);
  }
});

router.post("/", requireAuth, upload.single("image"), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu" });
  const signature = req.file.buffer.subarray(0, 12);
  const valid = isValidImageSignature(signature, req.file.mimetype);
  if (!valid) {
    return res.status(400).json({ error: "Le contenu du fichier image est invalide" });
  }

  const supabaseUrl = (process.env.SUPABASE_URL || "").trim();
  const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const bucket = (process.env.SUPABASE_STORAGE_BUCKET || "product-images").trim();

  if (!supabaseUrl || !supabaseKey) {
    if (process.env.NODE_ENV === "production") {
      return res.status(503).json({
        error: "Stockage image non configuré. Définissez SUPABASE_SERVICE_ROLE_KEY."
      });
    }

    const filename = createFilename(req.file.originalname);
    fs.writeFileSync(path.join(uploadDir, filename), req.file.buffer);
    return res.json({ url: "/uploads/" + filename });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });
    const filename = createFilename(req.file.originalname);
    const storagePath = `products/${filename}`;
    const { error } = await supabase.storage
      .from(bucket)
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
        cacheControl: "31536000",
        upsert: false
      });

    if (error) {
      console.error("Erreur upload Supabase Storage:", error.message);
      return res.status(502).json({ error: "Impossible de stocker l'image" });
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
    if (!data?.publicUrl) {
      console.error("Supabase Storage n'a pas fourni d'URL publique.");
      return res.status(502).json({ error: "URL publique de l'image indisponible" });
    }

    return res.json({ url: data.publicUrl });
  } catch (error) {
    console.error("Erreur stockage image:", error);
    return res.status(502).json({ error: "Impossible de stocker l'image" });
  }
});

module.exports = router;

function createFilename(originalName) {
  const ext = path.extname(originalName).toLowerCase();
  return Date.now() + "-" + crypto.randomBytes(12).toString("hex") + ext;
}

function isValidImageSignature(buffer, mimetype) {
  if (mimetype === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimetype === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimetype === "image/webp") return buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  return false;
}
