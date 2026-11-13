const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { requireAuth } = require("../middleware/authMiddleware");

const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, Date.now() + "-" + crypto.randomBytes(12).toString("hex") + ext);
  }
});

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

router.post("/", requireAuth, upload.single("image"), (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu" });
  const signature = fs.readFileSync(req.file.path).subarray(0, 12);
  const valid = isValidImageSignature(signature, req.file.mimetype);
  if (!valid) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "Le contenu du fichier image est invalide" });
  }
  res.json({ url: "/uploads/" + req.file.filename });
});

module.exports = router;

function isValidImageSignature(buffer, mimetype) {
  if (mimetype === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimetype === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimetype === "image/webp") return buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  return false;
}
