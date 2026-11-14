/**
 * Tich Atelier — E-commerce & Catalogue interactif
 * Navigation, Routage Hash, Sous-catégories dynamiques, Panier, Favoris & Commandes WhatsApp
 */

// ==========================================================================
// CONFIGURATION COMMANDE WHATSAPP & SYNCHRONISATION TEMPS RÉEL
// ==========================================================================
const STORAGE_VERSION = "2026-11-14";
if (localStorage.getItem("tich-storage-version") !== STORAGE_VERSION) {
  ["tich-wa-number", "tich-cart", "tich-favorites", "tich-discount"].forEach(key => {
    localStorage.removeItem(key);
  });
  localStorage.setItem("tich-storage-version", STORAGE_VERSION);
}

// Numéro WhatsApp par défaut ou synchronisé depuis la base de données
let WHATSAPP_PHONE = localStorage.getItem("tich-wa-number") || "33612345678";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function updateFloatingWhatsAppLink() {
  const floatingWA = document.getElementById("floatingWhatsApp");
  if (floatingWA) {
    floatingWA.href = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent("Bonjour Tich Atelier, j'aimerais avoir des renseignements sur vos produits !")}`;
  }
}

async function syncWhatsAppNumber() {
  try {
    const res = await fetch(`${API_URL}/settings/whatsapp`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.whatsapp) {
        const clean = String(data.whatsapp).replace(/\D/g, "");
        if (clean && clean !== WHATSAPP_PHONE) {
          WHATSAPP_PHONE = clean;
          localStorage.setItem("tich-wa-number", WHATSAPP_PHONE);
          updateFloatingWhatsAppLink();
        }
      }
    }
  } catch (e) {
    // Ignore silencieusement
  }
}

function setWhatsAppNumber(newNumber) {
  WHATSAPP_PHONE = String(newNumber).replace(/\D/g, "");
  localStorage.setItem("tich-wa-number", WHATSAPP_PHONE);
  updateFloatingWhatsAppLink();
}

function getAbsoluteImageUrl(imgUrl) {
  if (!imgUrl) return "";
  if (imgUrl.startsWith("http://") || imgUrl.startsWith("https://")) {
    return imgUrl;
  }
  try {
    const origin = window.location.origin;
    const clean = imgUrl.startsWith("/") ? imgUrl : "/" + imgUrl;
    return `${origin}${clean}`;
  } catch (e) {
    return imgUrl;
  }
}

/**
 * Génère le lien cliquable vers la fiche/photo du produit sur le site client
 */
function getProductClientUrl(productId) {
  try {
    const origin = window.location.origin;
    let path = window.location.pathname;
    if (!path.endsWith("/")) {
      const lastSlash = path.lastIndexOf("/");
      path = path.substring(0, lastSlash + 1);
    }
    return `${origin}${path}?produit=${encodeURIComponent(productId)}`;
  } catch (e) {
    return "";
  }
}

function openWhatsAppOrder(text) {
  const url = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank");
}

// ==========================================================================
// GÉNÉRATION D'IMAGE DE COMMANDE (CANVAS) POUR WHATSAPP
// ==========================================================================

/**
 * Charge une image pour le canvas (avec gestion CORS et fallback)
 */
function loadImageForCanvas(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    if (!src.startsWith("data:")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = () => {
      // Deuxième tentative sans attribut crossOrigin si c'est un asset local
      const fallbackImg = new Image();
      fallbackImg.onload = () => resolve(fallbackImg);
      fallbackImg.onerror = () => resolve(null);
      fallbackImg.src = src;
    };
    setTimeout(() => resolve(null), 4000);
    img.src = src;
  });
}

/**
 * Dessine un rectangle arrondi sur le canvas
 */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Tronque le texte pour qu'il tienne dans une largeur donnée
 */
function truncateText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + "...").width > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + "...";
}

/**
 * Génère une carte de commande Canvas avec les images des produits
 * @param {Array} items - articles du panier [{name, image, price, quantity, selectedOption}]
 * @param {number} totalAmount - total en FCFA
 * @param {string} extraNote - note optionnelle
 * @returns {Promise<HTMLCanvasElement>}
 */
async function generateOrderCardCanvas(items, totalAmount, extraNote) {
  const CARD_W = 720;
  const HEADER_H = 100;
  const ITEM_H = 160;
  const FOOTER_H = 120;
  const PAD = 30;
  const IMG_SIZE = 120;
  const CARD_H = HEADER_H + (items.length * ITEM_H) + FOOTER_H + (extraNote ? 50 : 0);

  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");

  // ---- FOND ----
  ctx.fillStyle = "#FAF7F5";
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // ---- EN-TÊTE ----
  ctx.fillStyle = "#1A1A2E";
  roundRect(ctx, 0, 0, CARD_W, HEADER_H, 0);
  ctx.fill();

  // Logo texte
  ctx.fillStyle = "#C9A96E";
  ctx.font = "bold 14px 'DM Sans', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("✦  ✦  ✦", CARD_W / 2, 30);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 28px 'Playfair Display', Georgia, serif";
  ctx.fillText("TICH ATELIER", CARD_W / 2, 60);

  ctx.fillStyle = "#C9A96E";
  ctx.font = "13px 'DM Sans', Arial, sans-serif";
  ctx.fillText("Votre sélection de commande", CARD_W / 2, 85);

  // ---- ARTICLES ----
  // Charger toutes les images en parallèle
  const loadedImages = await Promise.all(items.map(item => loadImageForCanvas(item.image)));

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const y = HEADER_H + (i * ITEM_H) + 10;
    const img = loadedImages[i];

    // Ligne de séparation
    if (i > 0) {
      ctx.strokeStyle = "#E8E0D8";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD, y - 5);
      ctx.lineTo(CARD_W - PAD, y - 5);
      ctx.stroke();
    }

    // Photo du produit (carré arrondi)
    const imgX = PAD;
    const imgY = y + 10;
    ctx.save();
    roundRect(ctx, imgX, imgY, IMG_SIZE, IMG_SIZE, 12);
    ctx.clip();
    if (img) {
      // Dessiner l'image en mode "cover" (centré et recadré)
      const ratio = Math.max(IMG_SIZE / img.width, IMG_SIZE / img.height);
      const sw = IMG_SIZE / ratio;
      const sh = IMG_SIZE / ratio;
      const sx = (img.width - sw) / 2;
      const sy = (img.height - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh, imgX, imgY, IMG_SIZE, IMG_SIZE);
    } else {
      // Placeholder gris si image non chargée
      ctx.fillStyle = "#DDD5CC";
      ctx.fillRect(imgX, imgY, IMG_SIZE, IMG_SIZE);
      ctx.fillStyle = "#999";
      ctx.font = "11px 'DM Sans', Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Photo", imgX + IMG_SIZE / 2, imgY + IMG_SIZE / 2 - 6);
      ctx.fillText("indisponible", imgX + IMG_SIZE / 2, imgY + IMG_SIZE / 2 + 10);
    }
    ctx.restore();

    // Texte du produit
    const textX = imgX + IMG_SIZE + 20;
    const textMaxW = CARD_W - textX - PAD;

    ctx.textAlign = "left";

    // Quantité badge
    ctx.fillStyle = "#1A1A2E";
    ctx.font = "bold 13px 'DM Sans', Arial, sans-serif";
    ctx.fillText(`x${item.quantity}`, textX, imgY + 18);

    // Nom du produit
    ctx.fillStyle = "#1A1A2E";
    ctx.font = "bold 18px 'DM Sans', Arial, sans-serif";
    const displayName = truncateText(ctx, item.name, textMaxW);
    ctx.fillText(displayName, textX, imgY + 42);

    // Option/Déclinaison
    if (item.selectedOption) {
      ctx.fillStyle = "#777";
      ctx.font = "13px 'DM Sans', Arial, sans-serif";
      ctx.fillText(`Declinaison : ${item.selectedOption}`, textX, imgY + 62);
    }

    // Prix
    ctx.fillStyle = "#C9A96E";
    ctx.font = "bold 20px 'DM Sans', Arial, sans-serif";
    ctx.fillText(money(item.price * item.quantity), textX, imgY + (item.selectedOption ? 90 : 75));

    // Sous-info catégorie
    ctx.fillStyle = "#AAA";
    ctx.font = "11px 'DM Sans', Arial, sans-serif";
    const catText = `${item.category || ""} · ${item.subCategory || ""}`;
    ctx.fillText(truncateText(ctx, catText, textMaxW), textX, imgY + (item.selectedOption ? 110 : 95));
  }

  // ---- NOTE ----
  let footerY = HEADER_H + (items.length * ITEM_H) + 15;
  if (extraNote) {
    ctx.fillStyle = "#F0EBE5";
    roundRect(ctx, PAD, footerY, CARD_W - PAD * 2, 40, 8);
    ctx.fill();
    ctx.fillStyle = "#666";
    ctx.font = "italic 13px 'DM Sans', Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Note : " + truncateText(ctx, extraNote, CARD_W - PAD * 2 - 20), PAD + 12, footerY + 25);
    footerY += 50;
  }

  // ---- PIED ----
  // Ligne de séparation
  ctx.strokeStyle = "#C9A96E";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, footerY);
  ctx.lineTo(CARD_W - PAD, footerY);
  ctx.stroke();

  // Total
  ctx.fillStyle = "#1A1A2E";
  ctx.font = "bold 15px 'DM Sans', Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("TOTAL INDICATIF", PAD, footerY + 35);

  ctx.fillStyle = "#C9A96E";
  ctx.font = "bold 26px 'DM Sans', Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(money(totalAmount), CARD_W - PAD, footerY + 38);

  // Message en bas
  ctx.fillStyle = "#999";
  ctx.font = "12px 'DM Sans', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Commandez sur WhatsApp — Tich Atelier", CARD_W / 2, footerY + 65);
  ctx.fillText("Livraison, prix final et paiement convenus ensemble", CARD_W / 2, footerY + 82);

  return canvas;
}

/**
 * Convertit un Canvas en objet File PNG
 */
function canvasToFile(canvas, filename) {
  return new Promise((resolve) => {
    canvas.toBlob(blob => {
      if (blob) {
        resolve(new File([blob], filename, { type: "image/png" }));
      } else {
        resolve(null);
      }
    }, "image/png");
  });
}

/**
 * Vérifie si le navigateur supporte le partage de fichiers
 */
function canShareFiles() {
  try {
    if (!navigator.canShare) return false;
    const testFile = new File(["test"], "t.png", { type: "image/png" });
    return navigator.canShare({ files: [testFile] });
  } catch (e) {
    return false;
  }
}

/**
 * Génère le message WhatsApp avec lien cliquable vers la photo / article sur le site client
 */
function buildWhatsAppText(items, totalAmount, extraNote) {
  const totalArticles = items.reduce((sum, item) => sum + item.quantity, 0);

  let msg = `* BONJOUR TICH ATELIER ! *\n\n`;
  msg += `J'ai termine de choisir mes articles sur votre catalogue et je souhaite finaliser ma commande avec vous :\n\n`;
  msg += `*MA SELECTION (${totalArticles} article${totalArticles > 1 ? "s" : ""}) :*\n`;

  items.forEach(item => {
    const opt = item.selectedOption ? ` (${item.selectedOption})` : "";
    const link = getProductClientUrl(item.id);
    msg += `\n- ${item.quantity}x *${item.name}*${opt} -- ${money(item.price * item.quantity)}`;
    if (link) {
      msg += `\n  Photo : ${link}`;
    }
  });

  msg += `\n\n*TOTAL INDICATIF : ${money(totalAmount)}*\n`;

  if (appliedDiscount) {
    const disc = items.reduce((s, i) => s + i.price * i.quantity, 0) * appliedDiscount.percentage / 100;
    msg += `- Code promo (${appliedDiscount.code}) : -${money(disc)}\n`;
  }

  if (extraNote && extraNote.trim()) {
    msg += `- Note : ${extraNote.trim()}\n`;
  }

  msg += `\nJ'aimerais que l'on discute directement ici de :\n`;
  msg += `1. Mon lieu et les delais de livraison\n`;
  msg += `2. La confirmation du prix final\n`;
  msg += `3. Le moyen de paiement (especes, mobile money, virement...)\n\n`;
  msg += `Merci, j'attends votre retour !`;

  return msg;
}

function sendCartToWhatsApp(extraNote = "") {
  if (!cart.length) {
    showToast("Votre sac est encore vide. Ajoutez des articles pour commander.");
    return;
  }

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  let discountAmount = 0;
  if (appliedDiscount) {
    discountAmount = (subtotal * appliedDiscount.percentage) / 100;
  }
  const total = Math.max(0, subtotal - discountAmount);

  const msgText = buildWhatsAppText(cart, total, extraNote);

  openWhatsAppOrder(msgText);
  closeCart();
  showToast("Ouverture de WhatsApp avec votre sélection... 💬");
}

function generateWhatsAppMessage({ orderNumber, customer, items, subtotal, discount, shipping, total, paymentMethod, note }) {
  let msg = `✦ *NOUVELLE COMMANDE TICH ATELIER* ✦\n`;
  msg += `*Réf. Commande :* ${orderNumber}\n\n`;

  if (customer && customer.name) {
    msg += `*INFORMATIONS CLIENT :*\n`;
    msg += `• Nom : ${customer.name}\n`;
    if (customer.phone) msg += `• Tél / WhatsApp : ${customer.phone}\n`;
    if (customer.address) msg += `• Adresse de livraison : ${customer.address}\n`;
    if (customer.city) msg += `• Ville : ${customer.city}${customer.zip ? ` (${customer.zip})` : ""}\n`;
    msg += `\n`;
  }

  msg += `*ARTICLES COMMANDÉS :*\n`;
  items.forEach(item => {
    const opt = item.selectedOption ? ` (Déclinaison : ${item.selectedOption})` : "";
    const photoUrl = getAbsoluteImageUrl(item.image);
    msg += `• ${item.quantity}x *${item.name}*${opt} — ${money(item.price * item.quantity)}\n`;
    if (photoUrl && !photoUrl.startsWith("data:")) {
      msg += `  Photo : ${photoUrl}\n`;
    }
  });
  msg += `\n`;

  msg += `*RÉCAPITULATIF :*\n`;
  msg += `• Sous-total : ${money(subtotal)}\n`;
  if (discount && discount.amount > 0) {
    msg += `• Réduction (${discount.code}) : -${money(discount.amount)}\n`;
  }
  msg += `• Frais de livraison : ${shipping === 0 ? "Offerts" : money(shipping)}\n`;
  msg += `*TOTAL À RÉGLER : ${money(total)}*\n\n`;

  if (paymentMethod) {
    msg += `• Moyen de paiement souhaité : ${paymentMethod}\n`;
  }
  if (note && note.trim()) {
    msg += `• Note ou instructions : ${note.trim()}\n`;
  }

  msg += `\nBonjour Tich Atelier, je confirme ma commande ci-dessus. Pouvez-vous me confirmer la disponibilité et le délai de livraison ? Merci ! ✨`;
  return msg;
}

// ==========================================================================
// ==========================================================================
// 1. BASE DE DONNÉES DES PRODUITS
// ==========================================================================
const defaultProducts = [];

// Configuration des univers et des sous-catégories pour les filtres
const CATEGORY_CONFIG = {
  Tous: {
    label: "Tous les univers",
    icon: "✦",
    subCategories: ["Toutes les pièces"]
  },
  Parfums: {
    label: "Boutique Parfums",
    icon: "🌸",
    subCategories: ["Tous en Parfums", "Eaux de parfum", "Brumes parfumées"]
  },
  Beauté: {
    label: "Accessoires de Beauté",
    icon: "✨",
    subCategories: ["Tous en Beauté", "Accessoires de beauté", "Soins du visage"]
  },
  Mode: {
    label: "Boutique de Mode",
    icon: "👗",
    subCategories: ["Tous en Mode", "Sacs", "Chaussures", "Tee-shirts", "Jeans", "Robes & Blazers"]
  }
};

// ==========================================================================
// 2. CONFIGURATION API BACKEND & PERSISTANCE CATALOGUE
// ==========================================================================
// Permet de configurer l'URL de l'API (locale ou distante)
const BACKEND_URL = (typeof window !== "undefined" && window.TICH_BACKEND_URL) || (
  (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"))
    ? "http://localhost:5000"
    : ""
);
const API_URL = BACKEND_URL ? `${BACKEND_URL}/api` : "/api";

function resolveMediaUrl(url) {
  if (!url) return "assets/perfume.jpg";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:") || url.startsWith("assets/")) {
    return url;
  }
  const clean = url.startsWith("/") ? url : "/" + url;
  return BACKEND_URL ? `${BACKEND_URL}${clean}` : clean;
}

async function loadProductsFromAPI() {
  try {
    const res = await fetch(`${API_URL}/products`);
    if (!res.ok) throw new Error("API error " + res.status);
    const data = await res.json();
    const list = Array.isArray(data.products) ? data.products : [];
    return list.map(p => ({
      ...p,
      image: resolveMediaUrl(p.image)
    }));
  } catch (e) {
    console.error("Catalogue inaccessible:", e);
    showToast("Le catalogue est temporairement inaccessible. Réessayez dans quelques instants.");
    return null;
  }
}

let products = [];

function saveProducts() { /* produits gérés par l'API — admin uniquement */ }
let cart = JSON.parse(localStorage.getItem("tich-cart") || "[]");
let favorites = JSON.parse(localStorage.getItem("tich-favorites") || "[]");
let appliedDiscount = JSON.parse(localStorage.getItem("tich-discount") || "null");

// Éléments du DOM récurrents
const homeMain = document.getElementById("homeMain");
const pageView = document.getElementById("pageView");
const cartDrawer = document.getElementById("cartDrawer");
const overlay = document.getElementById("overlay");
const toast = document.getElementById("toast");
const productModal = document.getElementById("productModal");
const searchPanel = document.getElementById("searchPanel");

// Utilitaires de formatage
const money = value => Math.round(Number(value) || 0).toLocaleString("fr-FR").replace(/\s/g, " ") + " FCFA";

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2800);
}

// ==========================================================================
// 3. AFFICHAGE DES CARTES PRODUITS & ACTIONS
// ==========================================================================
function productMarkup(list) {
  if (!list.length) {
    return `
      <div class="empty-products-view" style="grid-column: 1 / -1; width: 100%; box-sizing: border-box;">
        <span class="empty-icon">✧</span>
        <h3>Aucun article ne correspond à cette sélection</h3>
        <p>Essayez de réinitialiser vos filtres ou d'explorer une autre boutique.</p>
        <button class="btn btn-dark" onclick="window.location.hash='boutique'">Voir toute la boutique <span>→</span></button>
      </div>
    `;
  }

  return list.map(p => {
    const isFav = favorites.includes(p.id) || favorites.includes(p.name);
    const stock = typeof p.stock === "number" ? p.stock : 15;
    const isOutOfStock = stock <= 0;
    const isLowStock = stock > 0 && stock <= 3;

    let badgeHtml = "";
    // Gère les URLs absolues (uploads serveur) et relatives (assets/)
    const imgSrc = p.image && (p.image.startsWith("/") || p.image.startsWith("http"))
      ? p.image
      : (p.image || "assets/perfume.jpg");
    if (isOutOfStock) {
      badgeHtml = `<span class="tag tag-rupture">RUPTURE DE STOCK</span>`;
    } else if (p.tag) {
      badgeHtml = `<span class="tag">${escapeHtml(p.tag)}</span>`;
    } else if (isLowStock) {
      badgeHtml = `<span class="tag tag-low-stock">Plus que ${stock} restant${stock > 1 ? "s" : ""}</span>`;
    }

    return `
      <article class="product-card ${isOutOfStock ? "is-out-of-stock" : ""}" data-product-id="${escapeHtml(p.id)}">
        <div class="product-image" data-quick-view="${escapeHtml(p.id)}" style="cursor: pointer;">
          ${badgeHtml}
          <button class="favorite-btn ${isFav ? "liked" : ""}" data-favorite-id="${escapeHtml(p.id)}" aria-label="Ajouter ${escapeHtml(p.name)} aux favoris">
            ${isFav ? "♥" : "♡"}
          </button>
          <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(p.name)}" data-quick-view="${escapeHtml(p.id)}" loading="lazy" onerror="this.onerror=null;this.src='assets/fashion.jpg';" />
          <button class="quick-view-btn" data-quick-view="${escapeHtml(p.id)}">Aperçu rapide</button>
        </div>
        <div class="product-info">
          <div class="product-meta">
            <small class="product-cat">${escapeHtml(p.category)} · ${escapeHtml(p.subCategory)}</small>
            <div class="rating-badge" title="${p.rating}/5 (${p.reviewsCount} avis)">
              <span>★</span> ${p.rating}
            </div>
          </div>
          <h3 class="product-title" data-quick-view="${escapeHtml(p.id)}">${escapeHtml(p.name)}</h3>
          <p class="product-type">${escapeHtml(p.type || "")}</p>
          <div class="product-bottom">
            <span class="price">${money(p.price)}</span>
            ${isOutOfStock 
              ? `<button class="add-btn out-of-stock-btn" disabled title="Article actuellement indisponible">🚫 Épuisé</button>` 
              : `<button class="add-btn" data-add-id="${escapeHtml(p.id)}" aria-label="Ajouter ${escapeHtml(p.name)} au panier" title="Ajouter au panier">+</button>`
            }
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function bindProductActions(container = document) {
  // Clic sur bouton Ajouter au panier rapide (+)
  container.querySelectorAll("[data-add-id]").forEach(button => {
    button.addEventListener("click", e => {
      e.stopPropagation();
      const id = button.dataset.addId;
      addToCartById(id);
    });
  });

  // Clic sur favori (♡)
  container.querySelectorAll("[data-favorite-id]").forEach(button => {
    button.addEventListener("click", e => {
      e.stopPropagation();
      const id = button.dataset.favoriteId;
      toggleFavorite(id, button);
    });
  });

  // Clic sur Aperçu rapide / Carte produit
  container.querySelectorAll("[data-quick-view]").forEach(elem => {
    elem.addEventListener("click", e => {
      e.stopPropagation();
      const id = elem.dataset.quickView;
      openProductModal(id);
    });
  });
}

function toggleFavorite(id, buttonElem = null) {
  const prod = products.find(p => p.id === id);
  const name = prod ? prod.name : id;
  const isPresent = favorites.includes(id) || favorites.includes(name);

  if (isPresent) {
    favorites = favorites.filter(item => item !== id && item !== name);
    showToast(`${name} a été retiré de vos favoris`);
  } else {
    favorites.push(id);
    showToast(`${name} a été ajouté à vos favoris ♡`);
  }

  localStorage.setItem("tich-favorites", JSON.stringify(favorites));
  updateFavoritesBadge();

  if (buttonElem) {
    buttonElem.classList.toggle("liked", !isPresent);
    buttonElem.textContent = !isPresent ? "♥" : "♡";
  }

  // Si on est sur la page favoris, rafraîchir la vue
  if (location.hash === "#favoris") {
    renderFavoritesPage();
  }
}

function updateFavoritesBadge() {
  const count = favorites.length;
  const badge = document.getElementById("favoritesCount");
  const mobileFavCount = document.getElementById("mobileFavCount");
  if (badge) badge.textContent = count;
  if (mobileFavCount) mobileFavCount.textContent = count;
}

// ==========================================================================
// 4. GESTION DU PANIER & PROMOTIONS
// ==========================================================================
function addToCartById(id, quantity = 1, selectedOption = null) {
  const prod = products.find(p => p.id === id);
  if (!prod) return;

  const currentStock = typeof prod.stock === "number" ? prod.stock : 15;
  if (currentStock <= 0) {
    showToast(`Désolé, "${prod.name}" est actuellement en rupture de stock. ⚠️`);
    return;
  }

  const option = selectedOption || (prod.options ? prod.options[0] : null);
  const existingIndex = cart.findIndex(item => item.id === id && item.selectedOption === option);
  const currentInCart = existingIndex > -1 ? cart[existingIndex].quantity : 0;

  if (currentInCart + quantity > currentStock) {
    showToast(`Stock maximal disponible atteint (${currentStock} en stock) pour cet article.`);
    return;
  }

  if (existingIndex > -1) {
    cart[existingIndex].quantity += quantity;
  } else {
    cart.push({
      id: prod.id,
      name: prod.name,
      category: prod.category,
      subCategory: prod.subCategory,
      price: prod.price,
      image: prod.image,
      selectedOption: option,
      quantity: quantity
    });
  }

  saveCart();
  updateCartDrawer();
  openCart();
  showToast(`${prod.name} (${quantity}) a été ajouté à votre sac ✦`);
}

function saveCart() {
  localStorage.setItem("tich-cart", JSON.stringify(cart));
}

function updateCartDrawer() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Mise à jour des badges
  const cartCountEl = document.getElementById("cartCount");
  const drawerItemCount = document.getElementById("drawerItemCount");
  if (cartCountEl) cartCountEl.textContent = count;
  if (drawerItemCount) drawerItemCount.textContent = `${count} article${count > 1 ? "s" : ""}`;

  // Calcul réduction
  let discountAmount = 0;
  if (appliedDiscount && subtotal > 0) {
    discountAmount = (subtotal * appliedDiscount.percentage) / 100;
  }

  // Calcul frais de port (gratuit dès 50 000 FCFA)
  const shippingThreshold = 50000;
  const shippingCost = subtotal >= shippingThreshold || subtotal === 0 ? 0 : 2500;
  const finalTotal = Math.max(0, subtotal - discountAmount + shippingCost);

  // Remplissage du widget de livraison offerte
  const freeShippingText = document.getElementById("freeShippingText");
  const shippingProgressBar = document.getElementById("shippingProgressBar");
  if (freeShippingText && shippingProgressBar) {
    if (subtotal === 0) {
      freeShippingText.innerHTML = `Livraison offerte dès <strong>50 000 FCFA</strong> d'achat`;
      shippingProgressBar.style.width = "0%";
    } else if (subtotal >= shippingThreshold) {
      freeShippingText.innerHTML = `<span>✦</span> Félicitations ! Vous bénéficiez de la <strong>livraison offerte</strong>.`;
      shippingProgressBar.style.width = "100%";
    } else {
      const remaining = shippingThreshold - subtotal;
      const pct = Math.min(100, Math.round((subtotal / shippingThreshold) * 100));
      freeShippingText.innerHTML = `Plus que <strong>${money(remaining)}</strong> pour bénéficier de la <strong>livraison offerte</strong> !`;
      shippingProgressBar.style.width = `${pct}%`;
    }
  }

  // Affichage des totaux dans le tiroir
  const subtotalEl = document.getElementById("cartSubtotal");
  const totalEl = document.getElementById("cartTotal");
  const shippingEl = document.getElementById("cartShipping");
  const discountRow = document.getElementById("discountRow");
  const discountValEl = document.getElementById("cartDiscount");

  if (subtotalEl) subtotalEl.textContent = money(subtotal);
  if (totalEl) totalEl.textContent = money(finalTotal);
  if (shippingEl) shippingEl.textContent = shippingCost === 0 ? "Offerte" : money(shippingCost);

  if (discountRow && discountValEl) {
    if (discountAmount > 0) {
      discountRow.style.display = "flex";
      discountValEl.textContent = `-${money(discountAmount)}`;
    } else {
      discountRow.style.display = "none";
    }
  }

  // Rendu de la liste des articles
  const cartItemsContainer = document.getElementById("cartItems");
  if (!cartItemsContainer) return;

  if (!cart.length) {
    cartItemsContainer.innerHTML = `
      <div class="empty-cart-drawer">
        <span class="empty-cart-icon">✧</span>
        <p class="empty-cart-title">Votre sac est encore vide</p>
        <small class="empty-cart-sub">Laissez-vous séduire par nos parfums, nos soins et notre mode.</small>
        <button class="btn btn-dark" id="discoverShopFromDrawer">
          Découvrir la Boutique <span>→</span>
        </button>
      </div>
    `;
    const btn = document.getElementById("discoverShopFromDrawer");
    if (btn) {
      btn.addEventListener("click", () => {
        closeCart();
        window.location.hash = "boutique";
      });
    }
    return;
  }

  cartItemsContainer.innerHTML = cart.map((item, index) => `
    <div class="cart-row">
      <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" onerror="this.onerror=null;this.src='assets/fashion.jpg';" />
      <div class="cart-row-info">
        <button class="cart-remove-btn" data-cart-remove="${index}" title="Supprimer">×</button>
        <strong class="cart-item-name">${escapeHtml(item.name)}</strong>
        <span class="cart-item-cat">${escapeHtml(item.category)} · ${escapeHtml(item.subCategory)}</span>
        ${item.selectedOption ? `<span class="cart-item-opt">Option : ${escapeHtml(item.selectedOption)}</span>` : ""}
        <div class="cart-qty-price-row">
          <div class="quantity-controller">
            <button class="qty-btn" data-qty-change="-1" data-cart-index="${index}">-</button>
            <span class="qty-val">${item.quantity}</span>
            <button class="qty-btn" data-qty-change="1" data-cart-index="${index}">+</button>
          </div>
          <span class="cart-item-price">${money(item.price * item.quantity)}</span>
        </div>
      </div>
    </div>
  `).join("");

  // Événements contrôleur de quantité et suppression
  cartItemsContainer.querySelectorAll("[data-cart-remove]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.cartRemove);
      const removed = cart.splice(idx, 1)[0];
      saveCart();
      updateCartDrawer();
      showToast(`${removed.name} a été retiré du sac`);
    });
  });

  cartItemsContainer.querySelectorAll("[data-qty-change]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.cartIndex);
      const delta = Number(btn.dataset.qtyChange);
      if (cart[idx]) {
        cart[idx].quantity += delta;
        if (cart[idx].quantity <= 0) {
          cart.splice(idx, 1);
        }
        saveCart();
        updateCartDrawer();
      }
    });
  });
}

function openCart() {
  cartDrawer.classList.add("open");
  overlay.classList.add("show");
  document.body.style.overflow = "hidden";
}

function closeCart() {
  cartDrawer.classList.remove("open");
  overlay.classList.remove("show");
  document.body.style.overflow = "";
}

function applyPromoCode(code) {
  const cleanCode = code.trim().toUpperCase();
  const feedback = document.getElementById("promoMessage");
  const discountTag = document.getElementById("discountTag");

  if (!cleanCode) {
    feedback.textContent = "Veuillez saisir un code promo.";
    feedback.className = "promo-feedback error";
    return;
  }

  if (cleanCode === "TICH10" || cleanCode === "BIENVENUE10") {
    appliedDiscount = { code: cleanCode, percentage: 10 };
    localStorage.setItem("tich-discount", JSON.stringify(appliedDiscount));
    if (discountTag) discountTag.textContent = cleanCode;
    feedback.textContent = `Code ${cleanCode} appliqué (-10%) !`;
    feedback.className = "promo-feedback success";
    showToast(`Code promo ${cleanCode} activé (-10%) ✦`);
    updateCartDrawer();
  } else if (cleanCode === "TICH20") {
    appliedDiscount = { code: cleanCode, percentage: 20 };
    localStorage.setItem("tich-discount", JSON.stringify(appliedDiscount));
    if (discountTag) discountTag.textContent = cleanCode;
    feedback.textContent = `Code VIP ${cleanCode} appliqué (-20%) !`;
    feedback.className = "promo-feedback success";
    showToast(`Code VIP ${cleanCode} activé (-20%) ✦`);
    updateCartDrawer();
  } else {
    feedback.textContent = "Code promo invalide. Essayez Tich10";
    feedback.className = "promo-feedback error";
  }
}

// ==========================================================================
// 5. MODALE APERÇU RAPIDE / FICHE PRODUIT DÉTAILLÉE
// ==========================================================================
function openProductModal(id) {
  const prod = products.find(p => String(p.id) === String(id));
  if (!prod) return;

  const isFav = favorites.includes(prod.id) || favorites.includes(prod.name);
  const modalBody = document.getElementById("productModalBody");

  modalBody.innerHTML = `
    <div class="product-modal-grid">
      <div class="modal-gallery">
        ${prod.tag ? `<span class="tag">${escapeHtml(prod.tag)}</span>` : ""}
        <img src="${escapeHtml(prod.image)}" alt="${escapeHtml(prod.name)}" onerror="this.onerror=null;this.src='assets/fashion.jpg';" />
      </div>

      <div class="modal-details">
        <p class="modal-category">${escapeHtml(prod.category)} ✦ ${escapeHtml(prod.subCategory)}</p>
        <h2 class="modal-title">${escapeHtml(prod.name)}</h2>
        <div class="modal-rating">
          <span class="stars">★★★★★</span>
          <strong>${prod.rating} / 5</strong>
          <small>(${prod.reviewsCount} avis vérifiés)</small>
        </div>
        <p class="modal-price">${money(prod.price)}</p>
        <p class="modal-desc">${escapeHtml(prod.description)}</p>

        ${prod.options && prod.options.length ? `
          <div class="modal-options-block">
            <label class="modal-label">Choisir une déclinaison :</label>
            <div class="modal-options-pills" id="modalOptionsPills">
              ${prod.options.map((opt, i) => `
                <button class="opt-pill ${i === 0 ? "active" : ""}" data-opt="${escapeHtml(opt)}">${escapeHtml(opt)}</button>
              `).join("")}
            </div>
          </div>
        ` : ""}

        ${(() => {
          const st = typeof prod.stock === "number" ? prod.stock : 15;
          if (st <= 0) {
            return `<div class="stock-pill out" style="margin-bottom: 14px; font-size: 12px; padding: 6px 12px;">🚫 Rupture de stock temporaire</div>`;
          } else if (st <= 3) {
            return `<div class="stock-pill low" style="margin-bottom: 14px; font-size: 12px; padding: 6px 12px;">⚠️ Stock faible : plus que ${st} pièce${st > 1 ? "s" : ""} disponible${st > 1 ? "s" : ""} !</div>`;
          } else {
            return `<div class="stock-pill in" style="margin-bottom: 14px; font-size: 12px; padding: 6px 12px;">✓ En stock (${st} pièces disponibles)</div>`;
          }
        })()}

        <div class="modal-add-row">
          ${(() => {
            const st = typeof prod.stock === "number" ? prod.stock : 15;
            if (st <= 0) {
              return `
                <button class="btn btn-dark modal-add-btn" id="modalAddToCartBtn" disabled style="opacity: 0.6; cursor: not-allowed; width: 100%;">
                  Article actuellement indisponible · ${money(prod.price)}
                </button>
                <button class="modal-fav-btn ${isFav ? "liked" : ""}" id="modalFavBtn" title="Ajouter aux favoris">
                  ${isFav ? "♥" : "♡"}
                </button>
              `;
            }
            return `
              <div class="modal-qty-selector">
                <button id="modalQtyMinus">-</button>
                <span id="modalQtyVal">1</span>
                <button id="modalQtyPlus">+</button>
              </div>
              <button class="btn btn-dark modal-add-btn" id="modalAddToCartBtn">
                Ajouter au panier · <span id="modalAddPrice">${money(prod.price)}</span>
              </button>
              <button class="modal-fav-btn ${isFav ? "liked" : ""}" id="modalFavBtn" title="Ajouter aux favoris">
                ${isFav ? "♥" : "♡"}
              </button>
            `;
          })()}
        </div>

        <button class="btn btn-whatsapp-outline btn-block" id="modalWhatsAppDirectBtn" style="margin-bottom: 20px;">
          ${(typeof prod.stock === "number" ? prod.stock : 15) <= 0 
            ? `<span class="wa-bubble-icon">💬</span> Demander la disponibilité sur WhatsApp` 
            : `<span class="wa-bubble-icon">💬</span> Commander ce produit sur WhatsApp`
          }
        </button>

        <div class="modal-trust-perks">
          <div><span>✧</span> Expédié sous 24h avec échantillon offert</div>
          <div><span>↻</span> Retours offerts sous 30 jours</div>
          <div><span>💬</span> Commande et échange immédiat sur WhatsApp</div>
        </div>

        ${prod.details ? `
          <div class="modal-accordion">
            <div class="modal-accordion-title">Détails & Conseils de conservation / entretien</div>
            <div class="modal-accordion-text">${escapeHtml(prod.details)}</div>
          </div>
        ` : ""}
      </div>
    </div>
  `;

  // Enregistrer le produit actif sur la modale pour le rechargement dynamique
  productModal.dataset.currentProductId = prod.id;

  // Gestion des déclinaisons
  let currentSelectedOption = prod.options ? prod.options[0] : null;
  let currentQty = 1;

  modalBody.querySelectorAll(".opt-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      modalBody.querySelectorAll(".opt-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      currentSelectedOption = pill.dataset.opt;
    });
  });

  const qtyMinusBtn = document.getElementById("modalQtyMinus");
  const qtyPlusBtn = document.getElementById("modalQtyPlus");
  const qtyValEl = document.getElementById("modalQtyVal");
  const modalAddPrice = document.getElementById("modalAddPrice");
  const modalAddBtn = document.getElementById("modalAddToCartBtn");

  if (qtyMinusBtn && qtyValEl && modalAddPrice) {
    qtyMinusBtn.addEventListener("click", () => {
      if (currentQty > 1) {
        currentQty--;
        qtyValEl.textContent = currentQty;
        modalAddPrice.textContent = money(prod.price * currentQty);
      }
    });
  }

  if (qtyPlusBtn && qtyValEl && modalAddPrice) {
    qtyPlusBtn.addEventListener("click", () => {
      currentQty++;
      qtyValEl.textContent = currentQty;
      modalAddPrice.textContent = money(prod.price * currentQty);
    });
  }

  if (modalAddBtn && !modalAddBtn.disabled) {
    modalAddBtn.addEventListener("click", () => {
      addToCartById(prod.id, currentQty, currentSelectedOption);
      closeProductModal();
    });
  }

  const modalWABtn = document.getElementById("modalWhatsAppDirectBtn");
  if (modalWABtn) {
    modalWABtn.addEventListener("click", () => {
      const optText = currentSelectedOption ? ` (${currentSelectedOption})` : "";
      const st = typeof prod.stock === "number" ? prod.stock : 15;
      const link = getProductClientUrl(prod.id);

      let text = "";
      if (st <= 0) {
        text = `*TICH ATELIER -- DISPONIBILITE PIECE*\n\n`;
        text += `Bonjour Tich Atelier,\nJe suis interesse(e) par cette creation actuellement en rupture de stock :\n\n`;
        text += `- *${prod.name}*${optText} -- ${money(prod.price)}\n`;
        if (link) {
          text += `  Photo : ${link}\n`;
        }
        text += `\nPouvez-vous me dire quand elle sera disponible ou s'il est possible de la precommander ? Merci d'avance !`;
      } else {
        text = `*TICH ATELIER -- COMMANDE PIECE*\n\n`;
        text += `Bonjour Tich Atelier,\nCet article m'interesse beaucoup :\n\n`;
        text += `- *${currentQty}x ${prod.name}*${optText} -- ${money(prod.price * currentQty)}\n`;
        if (link) {
          text += `  Photo : ${link}\n`;
        }
        text += `\nJ'aimerais echanger avec vous pour finaliser la livraison et le paiement. Merci d'avance !`;
      }

      openWhatsAppOrder(text);
    });
  }

  const favBtn = document.getElementById("modalFavBtn");
  if (favBtn) {
    favBtn.addEventListener("click", () => {
      toggleFavorite(prod.id, favBtn);
    });
  }

  productModal.classList.add("open");
  overlay.classList.add("show");
  document.body.style.overflow = "hidden";
}

function closeProductModal() {
  productModal.classList.remove("open");
  delete productModal.dataset.currentProductId;
  if (!cartDrawer.classList.contains("open") && searchPanel.hidden) {
    overlay.classList.remove("show");
    document.body.style.overflow = "";
  }
}

// ==========================================================================
// 6. GESTION DU FILTRAGE PAR BOUTIQUE & SOUS-CATÉGORIES
// ==========================================================================

/**
 * Met à jour les boutons de sous-catégories pour un univers donné
 * @param {string} category - "Tous", "Parfums", "Beauté", ou "Mode"
 * @param {HTMLElement} chipsContainer - Conteneur HTML des sous-filtres
 * @param {string} activeSub - Sous-catégorie active par défaut
 * @param {Function} onSelectCallback - Fonction appelée lors du clic
 */
function renderSubcategoryChips(category, chipsContainer, activeSub = "Toutes", onSelectCallback) {
  if (!chipsContainer) return;

  const conf = CATEGORY_CONFIG[category] || CATEGORY_CONFIG["Tous"];
  const list = conf.subCategories;

  chipsContainer.innerHTML = list.map((sub, index) => {
    const isSelected = activeSub === sub || (index === 0 && (activeSub === "Toutes" || activeSub === "Tous" || activeSub.startsWith("Tous")));
    return `
      <button class="sub-chip ${isSelected ? "selected" : ""}" data-sub-name="${sub}">
        ${sub}
      </button>
    `;
  }).join("");

  chipsContainer.querySelectorAll(".sub-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      chipsContainer.querySelectorAll(".sub-chip").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      const selectedSub = btn.dataset.subName;
      if (typeof onSelectCallback === "function") {
        onSelectCallback(selectedSub);
      }
    });
  });
}

/**
 * Filtre les produits selon la catégorie et sous-catégorie choisies
 */
function filterProductList(category = "Tous", subCategory = "Toutes", searchTerm = "", sortBy = "pertinence") {
  let list = [...products];

  // 1. Filtre par univers principal (Boutique)
  if (category && category !== "Tous") {
    list = list.filter(p => p.category.toLowerCase() === category.toLowerCase());
  }

  // 2. Filtre par sous-catégorie
  if (subCategory && !subCategory.startsWith("Tous") && !subCategory.startsWith("Toutes")) {
    const cleanSub = subCategory.toLowerCase().trim();
    list = list.filter(p => {
      const pSub = p.subCategory.toLowerCase();
      // Cas de correspondance souple pour Sacs, Chaussures, Tee-shirts, Jeans, etc.
      if (cleanSub.includes("sac") && pSub.includes("sac")) return true;
      if (cleanSub.includes("chaussure") && pSub.includes("chaussure")) return true;
      if (cleanSub.includes("tee-shirt") && pSub.includes("tee-shirt")) return true;
      if (cleanSub.includes("jean") && pSub.includes("jean")) return true;
      if (cleanSub.includes("robe") && (pSub.includes("robe") || pSub.includes("blazer"))) return true;
      if (cleanSub.includes("eau") && pSub.includes("eau")) return true;
      if (cleanSub.includes("brume") && pSub.includes("brume")) return true;
      if (cleanSub.includes("accessoire") && pSub.includes("accessoire")) return true;
      if (cleanSub.includes("soin") && pSub.includes("soin")) return true;
      return pSub.includes(cleanSub);
    });
  }

  // 3. Recherche textuelle optionnelle
  if (searchTerm && searchTerm.trim()) {
    const q = searchTerm.toLowerCase().trim();
    list = list.filter(p => 
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.subCategory.toLowerCase().includes(q) ||
      p.type.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  }

  // 4. Tri
  if (sortBy === "price-asc") {
    list.sort((a, b) => a.price - b.price);
  } else if (sortBy === "price-desc") {
    list.sort((a, b) => b.price - a.price);
  } else if (sortBy === "rating") {
    list.sort((a, b) => b.rating - a.rating);
  } else if (sortBy === "newest") {
    list.sort((a, b) => (b.tag === "NOUVEAU" ? 1 : 0) - (a.tag === "NOUVEAU" ? 1 : 0));
  }

  return list;
}

// Initialisation des filtres sur la page d'accueil
let homeActiveCategory = "Tous";
let homeActiveSubCategory = "Toutes";

function initHomeShopFilters() {
  const homeMainTabs = document.getElementById("homeMainTabs");
  const homeSubChips = document.getElementById("homeSubChips");
  const grid = document.getElementById("productGrid");

  if (!homeMainTabs || !grid) return;

  function refreshHomeGrid() {
    const list = filterProductList(homeActiveCategory, homeActiveSubCategory);
    grid.innerHTML = productMarkup(list);
    bindProductActions(grid);
  }
  window.tichRefreshHomeGrid = refreshHomeGrid;

  // Écoute des onglets principaux
  homeMainTabs.querySelectorAll("[data-main-filter]").forEach(btn => {
    btn.addEventListener("click", () => {
      homeMainTabs.querySelectorAll("[data-main-filter]").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      homeActiveCategory = btn.dataset.mainFilter;
      homeActiveSubCategory = "Toutes";

      // Mise à jour des sous-catégories correspondantes
      renderSubcategoryChips(homeActiveCategory, homeSubChips, homeActiveSubCategory, subName => {
        homeActiveSubCategory = subName;
        refreshHomeGrid();
      });

      refreshHomeGrid();
    });
  });

  // Premier chargement des sous-chips
  renderSubcategoryChips(homeActiveCategory, homeSubChips, homeActiveSubCategory, subName => {
    homeActiveSubCategory = subName;
    refreshHomeGrid();
  });

  refreshHomeGrid();
}

// ==========================================================================
// 7. ROUTAGE DES PAGES & VUES (SPA)
// ==========================================================================

function renderHome() {
  homeMain.hidden = false;
  pageView.hidden = true;
  document.querySelectorAll("[data-route]").forEach(link => {
    link.classList.toggle("active", link.dataset.route === "home");
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Affiche la Boutique complète avec tous ses filtres, sous-catégories et tri
 */
function renderBoutiquePage(initialCategory = "Tous", initialSub = "Toutes") {
  homeMain.hidden = true;
  pageView.hidden = false;

  // Normalisation des paramètres d'URL (cat=mode, sub=sacs, etc.)
  let activeCat = initialCategory;
  if (activeCat.toLowerCase() === "parfums" || activeCat.toLowerCase() === "parfum") activeCat = "Parfums";
  else if (activeCat.toLowerCase() === "beaute" || activeCat.toLowerCase() === "beauté") activeCat = "Beauté";
  else if (activeCat.toLowerCase() === "mode") activeCat = "Mode";
  else activeCat = "Tous";

  let activeSub = initialSub;
  if (activeSub === "eaux") activeSub = "Eaux de parfum";
  else if (activeSub === "brumes") activeSub = "Brumes parfumées";
  else if (activeSub === "sacs") activeSub = "Sacs";
  else if (activeSub === "chaussures") activeSub = "Chaussures";
  else if (activeSub === "tshirts" || activeSub === "tee-shirts") activeSub = "Tee-shirts";
  else if (activeSub === "jeans") activeSub = "Jeans";
  else if (activeSub === "robes") activeSub = "Robes & Blazers";
  else if (activeSub === "accessoires") activeSub = "Accessoires de beauté";
  else if (activeSub === "soins") activeSub = "Soins du visage";

  pageView.innerHTML = `
    <section class="inner-page boutique-full-page">
      <div class="inner-hero boutique-hero">
        <p class="eyebrow">Le Grand Vestiaire & Rituels</p>
        <h1>La Boutique <em>Tich Atelier</em></h1>
        <p>Sélectionnez votre univers : parfums précieux, rituels & accessoires de beauté, sacs en cuir, chaussures élégantes, tee-shirts confortables et jeans parfaits.</p>
      </div>

      <!-- Navigation des univers dans la boutique -->
      <div class="boutique-master-nav">
        <div class="boutique-category-cards">
          <button class="b-cat-card ${activeCat === "Tous" ? "active" : ""}" data-page-cat="Tous">
            <span class="b-cat-icon">✦</span>
            <div>
              <strong>Toute la boutique</strong>
              <small>Tous les univers réunis</small>
            </div>
          </button>

          <button class="b-cat-card ${activeCat === "Parfums" ? "active" : ""}" data-page-cat="Parfums">
            <span class="b-cat-icon">🌸</span>
            <div>
              <strong>Boutique Parfums</strong>
              <small>Eaux de parfum & brumes</small>
            </div>
          </button>

          <button class="b-cat-card ${activeCat === "Beauté" ? "active" : ""}" data-page-cat="Beauté">
            <span class="b-cat-icon">✨</span>
            <div>
              <strong>Accessoires de Beauté</strong>
              <small>Pinceaux, gua sha & soins</small>
            </div>
          </button>

          <button class="b-cat-card ${activeCat === "Mode" ? "active" : ""}" data-page-cat="Mode">
            <span class="b-cat-icon">👗</span>
            <div>
              <strong>Boutique de Mode</strong>
              <small>Sacs, chaussures, t-shirts, jeans</small>
            </div>
          </button>
        </div>

        <!-- Barre des sous-catégories dynamiques -->
        <div class="boutique-subnav-panel">
          <div class="subnav-header">
            <span class="subnav-title" id="pageSubnavTitle">Sous-catégories</span>
            <span class="subnav-count" id="pageProductCount">Chargement...</span>
          </div>
          <div class="sub-filter-chips scrollable-chips" id="pageSubChips"></div>
        </div>

        <!-- Barre d'outils de recherche & tri -->
        <div class="boutique-toolbar">
          <div class="toolbar-search">
            <span class="search-ico">⌕</span>
            <input type="text" id="pageSearchInput" placeholder="Rechercher dans cette boutique..." />
          </div>

          <div class="toolbar-sort">
            <label for="pageSortSelect">Trier par :</label>
            <select id="pageSortSelect">
              <option value="pertinence">Pertinence</option>
              <option value="price-asc">Prix croissant</option>
              <option value="price-desc">Prix décroissant</option>
              <option value="rating">Mieux notés</option>
              <option value="newest">Nouveautés d'abord</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Grille des produits -->
      <div class="product-grid inner-products" id="pageProductGrid"></div>
    </section>
  `;

  const pageProductGrid = document.getElementById("pageProductGrid");
  const pageSubChips = document.getElementById("pageSubChips");
  const pageProductCount = document.getElementById("pageProductCount");
  const pageSearchInput = document.getElementById("pageSearchInput");
  const pageSortSelect = document.getElementById("pageSortSelect");

  function updatePageGrid() {
    const query = pageSearchInput ? pageSearchInput.value : "";
    const sort = pageSortSelect ? pageSortSelect.value : "pertinence";
    const list = filterProductList(activeCat, activeSub, query, sort);

    pageProductGrid.innerHTML = productMarkup(list);
    bindProductActions(pageProductGrid);

    if (pageProductCount) {
      pageProductCount.textContent = `${list.length} pièce${list.length > 1 ? "s" : ""}`;
    }
  }
  window.tichUpdatePageGrid = updatePageGrid;

  // Changement d'univers
  pageView.querySelectorAll("[data-page-cat]").forEach(btn => {
    btn.addEventListener("click", () => {
      pageView.querySelectorAll("[data-page-cat]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeCat = btn.dataset.pageCat;
      activeSub = "Toutes";

      renderSubcategoryChips(activeCat, pageSubChips, activeSub, subName => {
        activeSub = subName;
        updatePageGrid();
      });

      updatePageGrid();
    });
  });

  // Rendu initial des chips
  renderSubcategoryChips(activeCat, pageSubChips, activeSub, subName => {
    activeSub = subName;
    updatePageGrid();
  });

  // Recherche et tri en direct
  pageSearchInput.addEventListener("input", () => updatePageGrid());
  pageSortSelect.addEventListener("change", () => updatePageGrid());

  updatePageGrid();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Affiche la page Collections
 */
function renderCollectionsPage() {
  homeMain.hidden = true;
  pageView.hidden = false;

  pageView.innerHTML = `
    <section class="inner-page collections-page">
      <div class="inner-hero">
        <p class="eyebrow">Les Univers Tich Atelier</p>
        <h1>Nos <em>Collections</em></h1>
        <p>Explorez nos trois sanctuaires de style et d'émotions, conçus pour vous accompagner avec élégance à chaque instant.</p>
      </div>

      <div class="collections-showcase">
        <!-- Collection 1: Parfums -->
        <div class="collection-block">
          <div class="coll-image">
            <img src="assets/parfum.png" alt="Collection Parfums" />
          </div>
          <div class="coll-copy">
            <span class="coll-number">01</span>
            <p class="eyebrow">Haute Parfumerie</p>
            <h2>Boutique Parfums</h2>
            <p>Des sillages singuliers et mémorables, formulés à partir des plus belles matières premières naturelles : vanille de Madagascar, rose de Grasse, orchidée noire et bois fumés.</p>
            <div class="coll-tags">
              <span>Eaux de parfum</span>
              <span>Brumes parfumées</span>
              <span>Rituels d'exception</span>
            </div>
            <a href="#boutique?cat=parfums" class="btn btn-dark">Explorer les Parfums <span>→</span></a>
          </div>
        </div>

        <!-- Collection 2: Beauté -->
        <div class="collection-block reverse">
          <div class="coll-image">
            <img src="assets/accessoires.png" alt="Collection Accessoires de Beauté" />
          </div>
          <div class="coll-copy">
            <span class="coll-number">02</span>
            <p class="eyebrow">Rituels & Outils Précieux</p>
            <h2>Accessoires de Beauté</h2>
            <p>Des sets de pinceaux aux soies soyeuses, des rouleaux de quartz sculptants et des formules hautement concentrées en vitamine C et acide hyaluronique pour sublimer votre peau.</p>
            <div class="coll-tags">
              <span>Pinceaux vegan</span>
              <span>Gua Sha Quartz</span>
              <span>Sérums & Soins</span>
            </div>
            <a href="#boutique?cat=beaute" class="btn btn-dark">Découvrir les Accessoires <span>→</span></a>
          </div>
        </div>

        <!-- Collection 3: Mode -->
        <div class="collection-block">
          <div class="coll-image">
            <img src="assets/mode.png" alt="Collection Mode & Prêt-à-porter" />
          </div>
          <div class="coll-copy">
            <span class="coll-number">03</span>
            <p class="eyebrow">Vestiaire Intemporel</p>
            <h2>Boutique de Mode</h2>
            <p>Les essentiels de la garde-robe idéale : nos sacs demi-lune en cuir caramel, nos mocassins crantés, nos t-shirts en pur lin ou coton bio et nos jeans flare taille haute ultra-flatteurs.</p>
            <div class="coll-tags">
              <span>👜 Sacs en cuir</span>
              <span>👠 Chaussures & sandales</span>
              <span>👕 T-shirts lin & bio</span>
              <span>👖 Jeans taille haute</span>
            </div>
            <a href="#boutique?cat=mode" class="btn btn-dark">Voir toute la Mode <span>→</span></a>
          </div>
        </div>
      </div>
    </section>
  `;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Affiche la page Notre Histoire
 */
function renderStoryPage() {
  homeMain.hidden = true;
  pageView.hidden = false;

  pageView.innerHTML = `
    <section class="inner-page story-page">
      <div class="inner-hero">
        <p class="eyebrow">Maison Fondée en 2018</p>
        <h1>L'art de l'essentiel, <em>le beau sincère.</em></h1>
        <p>Tich Atelier est née d'un désir simple : réconcilier l'élégance intemporelle, l'exigence artisanale et le plaisir des sens.</p>
      </div>

      <div class="story-content-grid">
        <div class="story-text-col">
          <p class="eyebrow">Notre Vision</p>
          <h2>Créer des objets qui vous accompagnent durablement.</h2>
          <p>
            Dans un monde de surconsommation éphémère, nous avons fait le choix de la retenue et de la qualité absolue.
            Chaque parfum est macéré selon les traditions grassoises, chaque sac en cuir est assemblé avec des finitions maroquinières soignées, et chaque pièce de mode est testée pour traverser les saisons sans faiblir.
          </p>
          <p>
            Nous sélectionnons des tanneries certifiées respectueuses de l'environnement, des cotons biologiques peignés et des flacons rechargeables.
          </p>

          <div class="story-stats">
            <div>
              <strong>100%</strong>
              <span>Matières éthiques & nobles</span>
            </div>
            <div>
              <strong>+2 500</strong>
              <span>Membres conquis</span>
            </div>
            <div>
              <strong>30 jours</strong>
              <span>Pour changer d'avis</span>
            </div>
          </div>
        </div>

        <div class="story-image-col">
          <img src="assets/1.png" alt="Atelier de création Tich" />
          <div class="story-quote-card">
            <p>« Le vêtement doit libérer le geste, le parfum doit révéler l'âme. »</p>
            <small>— Éléonore & Mathis, Fondateurs de Tich Atelier</small>
          </div>
        </div>
      </div>

      <div class="story-cta-banner">
        <h3>Prêt(e) à découvrir notre univers ?</h3>
        <p>Parcourez notre catalogue et composez votre signature quotidienne.</p>
        <a href="#boutique" class="btn btn-dark">Accéder à la Boutique <span>→</span></a>
      </div>
    </section>
  `;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Affiche la page Contact
 */
function renderContactPage() {
  homeMain.hidden = true;
  pageView.hidden = false;

  pageView.innerHTML = `
    <section class="inner-page contact-page">
      <div class="inner-hero">
        <p class="eyebrow">À votre service</p>
        <h1>Nous <em>contacter</em></h1>
        <p>Une question sur une taille, un conseil de fragrance ou le suivi de votre commande ? Notre équipe parisienne vous répond avec joie sous 24h ouvrées.</p>
      </div>

      <div class="contact-grid">
        <div class="contact-info-card">
          <h3>Nos coordonnées</h3>
          <div class="info-item">
            <span class="info-icon">📍</span>
            <div>
              <strong>L'Atelier & Showroom</strong>
              <p> Cotonou - Bénin</p>
            </div>
          </div>

          <div class="info-item">
            <span class="info-icon">✉</span>
            <div>
              <strong>Service Client</strong>
              <p>tichofficiel@gmail.com</p>
            </div>
          </div>

          <div class="info-item">
            <span class="info-icon">⏱</span>
            <div>
              <strong>Horaires Showroom</strong>
              <p>Lundi au Samedi de 8h à 19h sans interruption.</p>
            </div>
          </div>

          <div class="contact-faq-shortcut">
            <strong>Besoin d'une réponse immédiate ?</strong>
            <p>Consultez notre foire aux questions pour tout savoir sur les livraisons et retours.</p>
            <a href="#faq" class="text-link">Consulter la FAQ <span>→</span></a>
          </div>
        </div>

        <div class="contact-form-card">
          <h3>Envoyez-nous un message</h3>
          <form id="contactForm" class="contact-form">
            <div class="form-row">
              <label>
                Nom complet *
                <input type="text" id="contactName" required placeholder="Votre prénom et nom" />
              </label>
              <label>
                Adresse email *
                <input type="email" id="contactEmail" required placeholder="vous@exemple.com" />
              </label>
            </div>

            <label>
                Sujet de votre demande *
                <select id="contactSubject" required>
                  <option value="conseil">Conseil produit (parfum, taille vêtement, accessoires)</option>
                  <option value="commande">Suivi de commande ou livraison</option>
                  <option value="retour">Retour ou échange</option>
                  <option value="presse">Presse & Partenariats</option>
                  <option value="autre">Autre question</option>
                </select>
            </label>

            <label>
              Votre message *
              <textarea id="contactMessage" rows="5" required placeholder="Détaillez votre demande ici..."></textarea>
            </label>

            <button type="submit" class="btn btn-dark btn-block">
              Envoyer mon message <span>→</span>
            </button>
          </form>
        </div>
      </div>
    </section>
  `;

  document.getElementById("contactForm").addEventListener("submit", e => {
    e.preventDefault();
    const name = document.getElementById("contactName").value;
    showToast(`Merci ${name}, votre message a été envoyé à notre équipe !`);
    document.getElementById("contactForm").reset();
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderFAQPage() {
  homeMain.hidden = true;
  pageView.hidden = false;

  const faqData = [
    {
      q: "Comment choisir la bonne taille pour les sacs, jeans et chaussures ?",
      a: "Chaque fiche produit détaille les mensurations précises. Nos jeans ont une coupe fidèle à la taille avec une touche de confort ; pour nos mocassins et sandales, nous vous conseillons votre pointure habituelle. En cas de demi-pointure, préférez la taille supérieure."
    },
    {
      q: "Les parfums Tich Atelier sont-ils rechargeables et véganes ?",
      a: "Oui, l'intégralité de nos fragrances est 100% végane et sans cruauté animale. Nos flacons sont façonnés en verre recyclable et dotés d'un col dévissable permettant de les remplir à nouveau grâce à nos recharges disponibles en boutique."
    },
    {
      q: "Quels sont les délais d'expédition et de livraison ?",
      a: "Toute commande passée du lundi au vendredi avant 13h est préparée et expédiée le jour même. La livraison Colissimo prend 48h en France métropolitaine, et Chronopost livre en 24h ouvrées."
    },
    {
      q: "Comment utiliser mon code promotionnel ?",
      a: "Il vous suffit de renseigner votre code (par exemple TICH10 pour -10%) directement dans votre sac de shopping ou sur la page de paiement. La déduction est appliquée instantanément sur votre total."
    },
    {
      q: "Puis-je offrir une commande avec un emballage cadeau ?",
      a: "Absolument. Lors de la validation de votre panier, vous pouvez cocher l'option 'Emballage Cadeau Offert' et rédiger un mot doux qui sera calligraphié à la main sur une carte élégante."
    },
    {
      q: "Comment entretenir les pinceaux de beauté et les rouleaux de quartz ?",
      a: "Nettoyez vos pinceaux une fois par semaine à l'eau tiède avec un savon doux sans alcool et laissez-les sécher à plat. Le quartz rose et gua sha se lavent à l'eau claire et peuvent être placés au réfrigérateur pour un effet décongestionnant décuplé."
    }
  ];

  pageView.innerHTML = `
    <section class="inner-page faq-page">
      <div class="inner-hero">
        <p class="eyebrow">Réponses à vos questions</p>
        <h1>Foire Aux <em>Questions</em></h1>
        <p>Retrouvez toutes les réponses concernant nos créations, vos commandes, les matières et nos services.</p>
      </div>

      <div class="faq-container">
        ${faqData.map((item, i) => `
          <div class="faq-item ${i === 0 ? "open" : ""}">
            <button class="faq-question">
              <span>${item.q}</span>
              <span class="faq-toggle-icon">${i === 0 ? "−" : "+"}</span>
            </button>
            <div class="faq-answer">
              <p>${item.a}</p>
            </div>
          </div>
        `).join("")}
      </div>

      <div class="faq-footer-card">
        <h3>Vous ne trouvez pas la réponse souhaitée ?</h3>
        <p>Notre équipe se fera un plaisir de vous renseigner personnellement.</p>
        <a href="#contact" class="btn btn-dark">Écrire au support <span>→</span></a>
      </div>
    </section>
  `;

  pageView.querySelectorAll(".faq-item").forEach(item => {
    const btn = item.querySelector(".faq-question");
    const icon = item.querySelector(".faq-toggle-icon");
    btn.addEventListener("click", () => {
      const isOpen = item.classList.contains("open");
      pageView.querySelectorAll(".faq-item").forEach(other => {
        other.classList.remove("open");
        const oIcon = other.querySelector(".faq-toggle-icon");
        if (oIcon) oIcon.textContent = "+";
      });
      if (!isOpen) {
        item.classList.add("open");
        icon.textContent = "−";
      }
    });
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Affiche la page Mes Favoris (Wishlist)
 */
function renderFavoritesPage() {
  homeMain.hidden = true;
  pageView.hidden = false;

  const favProducts = products.filter(p => favorites.includes(p.id) || favorites.includes(p.name));

  pageView.innerHTML = `
    <section class="inner-page favorites-page">
      <div class="inner-hero">
        <p class="eyebrow">Votre Carnet de Désirs</p>
        <h1>Mes <em>Favoris</em></h1>
        <p>${favProducts.length} article${favProducts.length > 1 ? "s" : ""} enregistré${favProducts.length > 1 ? "s" : ""}</p>
      </div>

      ${!favProducts.length ? `
        <div class="empty-favorites-box">
          <span class="empty-icon">♡</span>
          <h2>Votre liste de favoris est vide</h2>
          <p>Explorez nos parfums, nos accessoires de beauté et notre sélection mode pour enregistrer vos coups de cœur.</p>
          <a href="#boutique" class="btn btn-dark">Découvrir la Boutique <span>→</span></a>
        </div>
      ` : `
        <div class="fav-actions-bar">
          <button class="btn btn-outline" id="addAllFavsToCart">Ajouter tous les favoris au sac</button>
          <button class="text-link" id="clearAllFavs">Vider mes favoris</button>
        </div>
        <div class="product-grid inner-products" id="favoritesGrid">
          ${productMarkup(favProducts)}
        </div>
      `}
    </section>
  `;

  if (favProducts.length) {
    const grid = document.getElementById("favoritesGrid");
    bindProductActions(grid);

    document.getElementById("addAllFavsToCart").addEventListener("click", () => {
      favProducts.forEach(p => addToCartById(p.id));
      showToast(`${favProducts.length} articles ajoutés à votre sac !`);
    });

    document.getElementById("clearAllFavs").addEventListener("click", () => {
      favorites = [];
      localStorage.setItem("tich-favorites", "[]");
      updateFavoritesBadge();
      renderFavoritesPage();
      showToast("Vos favoris ont été effacés");
    });
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Affiche la page Commande / Checkout
 */
function renderCheckoutPage() {
  if (!cart.length) {
    showToast("Votre sac est vide. Ajoutez des articles pour commander.");
    window.location.hash = "boutique";
    return;
  }

  closeCart();
  homeMain.hidden = true;
  pageView.hidden = false;

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  let discountAmount = 0;
  if (appliedDiscount) {
    discountAmount = (subtotal * appliedDiscount.percentage) / 100;
  }
  const shippingCost = subtotal >= 50000 ? 0 : 2500;
  const total = Math.max(0, subtotal - discountAmount + shippingCost);

  pageView.innerHTML = `
    <section class="inner-page checkout-page">
      <div class="checkout-container">
        <div class="checkout-form-col">
          <div class="whatsapp-notice-banner">
            <span style="font-size: 26px;">💬</span>
            <div>
              <strong>Aucun formulaire à remplir</strong>
              <p style="margin: 2px 0 0; font-size: 12px; opacity: 0.95;">Nous convenons directement ensemble sur WhatsApp de votre lieu de livraison, du prix final et de votre mode de règlement.</p>
            </div>
          </div>

          <p class="eyebrow">Finalisation en 1 clic</p>
          <h1>Votre Commande <em>sur WhatsApp</em></h1>
          <p style="color: var(--text-body); font-size: 14.5px; margin-bottom: 24px; line-height: 1.7;">
            Votre sélection est prête ! Cliquez sur le bouton ci-dessous pour ouvrir directement la discussion WhatsApp avec notre équipe. Nous finaliserons ensemble les détails de livraison et le montant exact.
          </p>

          <button class="btn btn-whatsapp btn-block" id="directWhatsAppCheckoutBtn" style="padding: 16px 24px; font-size: 15px;">
            <span class="wa-bubble-icon">💬</span> Discuter et Commander sur WhatsApp · ${money(total)} <span>→</span>
          </button>

          <div style="margin-top: 26px; padding-top: 20px; border-top: 1px dashed var(--border);">
            <label style="display: block; font-size: 12px; font-weight: 700; color: var(--purple); text-transform: uppercase; margin-bottom: 8px;">
              Une précision à ajouter avant d'envoyer ? (Optionnel)
            </label>
            <input type="text" id="optionalNoteInput" placeholder="Ex: Votre ville ou quartier, livraison en après-midi..." style="width: 100%; padding: 12px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 13px;" />
          </div>

          <div class="confirmed-perks" style="margin-top: 25px;">
            <div><span>💬</span> <strong>Échange direct :</strong> Échangez directement avec un conseiller pour valider vos produits.</div>
            <div><span>📍</span> <strong>Lieu de livraison :</strong> Indiquez simplement votre ville, quartier ou repère par message.</div>
            <div><span>💵</span> <strong>Paiement convenu :</strong> Espèces à la livraison, Wave, Orange Money ou virement.</div>
          </div>
        </div>

        <div class="checkout-summary-col">
          <div class="summary-card">
            <h3>Votre sélection (${cart.length} articles)</h3>
            <div class="summary-items-list">
              ${cart.map(item => `
                <div class="summary-item-row">
                  <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" onerror="this.onerror=null;this.src='assets/fashion.jpg';" />
                  <div class="summary-item-info">
                    <strong>${escapeHtml(item.name)}</strong>
                    <small>${escapeHtml(item.category)} · Qte: ${item.quantity}</small>
                    ${item.selectedOption ? `<small>Option : ${escapeHtml(item.selectedOption)}</small>` : ""}
                  </div>
                  <span class="summary-item-price">${money(item.price * item.quantity)}</span>
                </div>
              `).join("")}
            </div>

            <div class="summary-calc-breakdown">
              <div class="summary-line">
                <span>Sous-total</span>
                <strong>${money(subtotal)}</strong>
              </div>
              ${discountAmount > 0 ? `
                <div class="summary-line text-green">
                  <span>Réduction (${appliedDiscount.code})</span>
                  <strong>-${money(discountAmount)}</strong>
                </div>
              ` : ""}
              <div class="summary-line total-line">
                <span>Total indicatif</span>
                <strong>${money(total)}</strong>
              </div>
            </div>

            <div class="summary-guarantee">
              <p>✦ Vous pouvez ajuster vos quantités ou poser toutes vos questions directement dans WhatsApp.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;

  document.getElementById("directWhatsAppCheckoutBtn").addEventListener("click", () => {
    const note = document.getElementById("optionalNoteInput").value;
    sendCartToWhatsApp(note);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ==========================================================================
// ==========================================================================
// 8. GESTION DU ROUTEUR HASH CENTRALISÉ
// ==========================================================================
function handleRouting() {
  const fullHash = location.hash.replace("#", "") || "accueil";
  const [routePart, queryPart] = fullHash.split("?");

  // Analyse des paramètres d'URL (ex: cat=mode&sub=sacs)
  const params = new URLSearchParams(queryPart || "");
  const cat = params.get("cat") || "Tous";
  const sub = params.get("sub") || "Toutes";

  // Mise à jour de la classe active sur la navigation
  document.querySelectorAll("[data-route]").forEach(link => {
    const route = link.dataset.route;
    if (routePart === "accueil" && route === "home") link.classList.add("active");
    else if (routePart === "boutique" && route === "shop") link.classList.add("active");
    else if (routePart === "collections" && route === "collections") link.classList.add("active");
    else if (routePart === "histoire" && route === "story") link.classList.add("active");
    else if (routePart === "contact" && route === "contact") link.classList.add("active");
    else if (routePart === "faq" && route === "faq") link.classList.add("active");
    else if (routePart === "favoris" && route === "favorites") link.classList.add("active");
    else link.classList.remove("active");
  });

  // Aiguillage
  if (routePart.startsWith("produit=") || routePart === "produit") {
    const prodId = params.get("id") || (routePart.startsWith("produit=") ? routePart.split("=")[1] : null);
    renderHome();
    if (prodId && Array.isArray(products) && products.length) {
      setTimeout(() => openProductModal(prodId), 150);
    }
    return;
  }

  if (routePart === "accueil" || routePart === "home" || !routePart) {
    renderHome();
  } else if (routePart === "boutique") {
    renderBoutiquePage(cat, sub);
  } else if (routePart === "collections") {
    renderCollectionsPage();
  } else if (routePart === "histoire") {
    renderStoryPage();
  } else if (routePart === "contact") {
    renderContactPage();
  } else if (routePart === "faq") {
    renderFAQPage();
  } else if (routePart === "favoris") {
    renderFavoritesPage();
  } else if (routePart === "checkout") {
    renderCheckoutPage();
  } else {
    renderHome();
  }
}

/**
 * Ouvre automatiquement la fiche d'un produit si présent dans l'URL (?produit=ID ou #produit=ID)
 */
function checkUrlForProductModal() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    let targetId = urlParams.get("produit") || urlParams.get("p") || urlParams.get("id");

    if (!targetId && window.location.hash) {
      const hash = window.location.hash.replace("#", "");
      if (hash.startsWith("produit=")) {
        targetId = hash.replace("produit=", "");
      } else if (hash.startsWith("produit/")) {
        targetId = hash.replace("produit/", "");
      }
    }

    if (targetId && Array.isArray(products) && products.length > 0) {
      const found = products.find(p => String(p.id) === String(targetId));
      if (found) {
        setTimeout(() => openProductModal(found.id), 250);
      }
    }
  } catch (e) {
    console.warn("checkUrlForProductModal:", e);
  }
}

// ==========================================================================
// 9. MODALE DE RECHERCHE EN TEMPS RÉEL
// ==========================================================================
function initSearch() {
  const searchToggle = document.getElementById("searchToggle");
  const closeSearchPanel = document.getElementById("closeSearchPanel");
  const searchInput = document.getElementById("searchInput");
  const searchResults = document.getElementById("searchResults");

  function openSearch() {
    searchPanel.hidden = false;
    searchPanel.classList.add("open");
    overlay.classList.add("show");
    searchInput.value = "";
    searchResults.innerHTML = `<p class="search-prompt">Tapez votre recherche pour afficher les produits instantanément...</p>`;
    setTimeout(() => searchInput.focus(), 100);
  }

  function closeSearch() {
    searchPanel.hidden = true;
    searchPanel.classList.remove("open");
    if (!cartDrawer.classList.contains("open") && !productModal.classList.contains("open")) {
      overlay.classList.remove("show");
      document.body.style.overflow = "";
    }
  }

  // S'assurer qu'au démarrage le panneau est bien fermé
  searchPanel.hidden = true;
  searchPanel.classList.remove("open");

  if (searchToggle) searchToggle.addEventListener("click", openSearch);
  if (closeSearchPanel) closeSearchPanel.addEventListener("click", closeSearch);

  function executeSearch(query) {
    const q = query.toLowerCase().trim();
    if (!q) {
      searchResults.innerHTML = `<p class="search-prompt">Tapez votre recherche pour afficher les produits instantanément...</p>`;
      return;
    }

    const matches = products.filter(p => 
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.subCategory.toLowerCase().includes(q) ||
      p.type.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q))
    );

    if (!matches.length) {
      searchResults.innerHTML = `
        <div class="search-no-results">
          <p>Aucun produit ne correspond à <strong>"${escapeHtml(query)}"</strong>.</p>
          <small>Essayez avec : "parfum", "sac", "jean", "pinceaux", "chaussures"...</small>
        </div>
      `;
      return;
    }

    searchResults.innerHTML = `
      <p class="search-count-header">${matches.length} résultat${matches.length > 1 ? "s" : ""} trouvé${matches.length > 1 ? "s" : ""}</p>
      <div class="search-results-grid">
        ${matches.map(p => `
          <div class="search-result-card" data-search-id="${escapeHtml(p.id)}">
            <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" onerror="this.onerror=null;this.src='assets/fashion.jpg';" />
            <div class="search-res-info">
              <small>${escapeHtml(p.category)} · ${escapeHtml(p.subCategory)}</small>
              <strong>${escapeHtml(p.name)}</strong>
              <span>${money(p.price)}</span>
            </div>
            <button class="btn-sm btn-dark" data-search-add="${escapeHtml(p.id)}">Ajouter</button>
          </div>
        `).join("")}
      </div>
    `;

    searchResults.querySelectorAll("[data-search-id]").forEach(card => {
      card.addEventListener("click", e => {
        if (!e.target.dataset.searchAdd) {
          const id = card.dataset.searchId;
          closeSearch();
          openProductModal(id);
        }
      });
    });

    searchResults.querySelectorAll("[data-search-add]").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        const id = btn.dataset.searchAdd;
        addToCartById(id);
        closeSearch();
      });
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", e => executeSearch(e.target.value));
  }

  document.querySelectorAll("[data-search-tag]").forEach(btn => {
    btn.addEventListener("click", () => {
      const tag = btn.dataset.searchTag;
      searchInput.value = tag;
      executeSearch(tag);
    });
  });
}

function refreshActiveView() {
  if (homeMain && !homeMain.hidden) {
    if (typeof window.tichRefreshHomeGrid === "function") {
      window.tichRefreshHomeGrid();
    }
  } else if (pageView && !pageView.hidden) {
    if (document.getElementById("pageProductGrid") && typeof window.tichUpdatePageGrid === "function") {
      window.tichUpdatePageGrid();
    } else if (location.hash === "#favoris") {
      renderFavoritesPage();
    }
  }

  // Si la modale produit est ouverte, réactualiser ses données en direct
  if (productModal && productModal.classList.contains("open") && productModal.dataset.currentProductId) {
    openProductModal(productModal.dataset.currentProductId);
  }
}
window.tichRefreshActiveView = refreshActiveView;

// ==========================================================================
// 10. INITIALISATION GÉNÉRALE AU CHARGEMENT DU DOM
// ==========================================================================
document.addEventListener("DOMContentLoaded", async () => {
  // Synchroniser le numéro WhatsApp officiel depuis la base de données
  await syncWhatsAppNumber();

  // Charger le catalogue initial depuis l'API
  products = (await loadProductsFromAPI()) || [];

  // Si l'utilisateur clique sur le lien d'un produit depuis WhatsApp (?produit=ID), ouvrir directement sa photo/fiche
  checkUrlForProductModal();

  // Polling automatique toutes les 4 secondes pour synchroniser stocks & numéro WhatsApp en temps réel
  setInterval(async () => {
    try {
      // 1. Synchroniser le numéro WhatsApp si modifié par l'administrateur
      syncWhatsAppNumber();

      // 2. Synchroniser les stocks et pièces du catalogue
      const fresh = await loadProductsFromAPI();
      if (!Array.isArray(fresh)) return;

      const currentSig = products.map(p => `${p.id}:${p.stock}:${p.price}`).join("|");
      const freshSig = fresh.map(p => `${p.id}:${p.stock}:${p.price}`).join("|");

      if (currentSig !== freshSig || products.length !== fresh.length) {
        products = fresh;
        if (typeof window.tichRefreshActiveView === "function") {
          window.tichRefreshActiveView();
        }
      }
    } catch (e) {
      // Ignorer silencieusement si micro-coupure réseau
    }
  }, 4000);

  // Ralenti vidéo hero à 0.5x
  const heroVideo = document.getElementById("heroPerfumeVideo");
  if (heroVideo) {
    heroVideo.playbackRate = 0.3;
    heroVideo.addEventListener("play", () => {
      heroVideo.playbackRate = 0.3;
    });
  }

  // 1. Mise à jour initiale des compteurs
  updateCartDrawer();
  updateFavoritesBadge();

  // 2. Initialisation des filtres et grille accueil
  initHomeShopFilters();

  // 3. Gestionnaire de recherche & Dashboard Admin
  initSearch();

  // 4. Écouteurs Panier Drawer
  document.getElementById("openCart").addEventListener("click", openCart);
  document.getElementById("closeCart").addEventListener("click", closeCart);
  overlay.addEventListener("click", () => {
    closeCart();
    closeProductModal();
    if (searchPanel) {
      searchPanel.hidden = true;
      searchPanel.classList.remove("open");
    }
    document.getElementById("mobileNav").classList.remove("open");
    overlay.classList.remove("show");
    document.body.style.overflow = "";
  });

  // Fermeture modale lors d'un clic sur l'arrière-plan
  if (productModal) {
    productModal.addEventListener("click", e => {
      if (e.target === productModal) {
        closeProductModal();
      }
    });
  }

  // Fermeture avec la touche Échap
  window.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      closeCart();
      closeProductModal();
      if (searchPanel) {
        searchPanel.hidden = true;
        searchPanel.classList.remove("open");
      }
      document.getElementById("mobileNav").classList.remove("open");
      overlay.classList.remove("show");
      document.body.style.overflow = "";
    }
  });

  const proceedBtn = document.getElementById("proceedCheckoutBtn");
  if (proceedBtn) {
    proceedBtn.addEventListener("click", () => {
      closeCart();
      window.location.hash = "checkout";
    });
  }

  const proceedWABtn = document.getElementById("proceedWhatsAppBtn");
  if (proceedWABtn) {
    proceedWABtn.addEventListener("click", () => {
      sendCartToWhatsApp();
    });
  }

  // Widget flottant WhatsApp
  const floatingWA = document.getElementById("floatingWhatsApp");
  if (floatingWA) {
    floatingWA.addEventListener("click", e => {
      e.preventDefault();
      if (cart.length > 0) {
        sendCartToWhatsApp();
      } else {
        openWhatsAppOrder("* Bonjour Tich Atelier ! *\n\nJe visite votre catalogue en ligne et je souhaite avoir des conseils sur vos créations et passer commande. Merci d'avance !");
      }
    });
  }

  // 5. Code promo
  const applyPromoBtn = document.getElementById("applyPromoBtn");
  const promoInput = document.getElementById("promoInput");
  if (applyPromoBtn && promoInput) {
    applyPromoBtn.addEventListener("click", () => {
      applyPromoCode(promoInput.value);
    });
    promoInput.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        applyPromoCode(promoInput.value);
      }
    });
  }

  // 6. Navigation Mobile Drawer & Accordéon Boutique
  const menuToggle = document.getElementById("menuToggle");
  const closeMobileNav = document.getElementById("closeMobileNav");
  const mobileNav = document.getElementById("mobileNav");
  const mobileShopToggle = document.getElementById("mobileShopToggle");
  const mobileShopContent = document.getElementById("mobileShopContent");

  if (menuToggle && mobileNav) {
    menuToggle.addEventListener("click", () => {
      mobileNav.classList.add("open");
      overlay.classList.add("show");
    });
  }

  if (closeMobileNav && mobileNav) {
    closeMobileNav.addEventListener("click", () => {
      mobileNav.classList.remove("open");
      overlay.classList.remove("show");
    });
  }

  if (mobileShopToggle && mobileShopContent) {
    mobileShopToggle.addEventListener("click", () => {
      mobileShopContent.classList.toggle("open");
      const icon = mobileShopToggle.querySelector(".accordion-icon");
      if (icon) {
        icon.textContent = mobileShopContent.classList.contains("open") ? "−" : "+";
      }
    });
  }

  // Fermer la navigation mobile lors du clic sur un lien
  document.querySelectorAll(".mobile-nav a").forEach(link => {
    link.addEventListener("click", () => {
      if (mobileNav) mobileNav.classList.remove("open");
      overlay.classList.remove("show");
    });
  });

  // 7. Modale produit fermeture
  const closeProductModalBtn = document.getElementById("closeProductModal");
  if (closeProductModalBtn) {
    closeProductModalBtn.addEventListener("click", closeProductModal);
  }

  // 8. Newsletter Footer
  const newsletterForm = document.getElementById("newsletterForm");
  const newsletterEmail = document.getElementById("newsletterEmail");
  if (newsletterForm && newsletterEmail) {
    newsletterForm.addEventListener("submit", e => {
      e.preventDefault();
      const val = newsletterEmail.value.trim();
      if (!val) return;
      showToast(`Merci ! Vous êtes inscrit(e) au Journal Tich (${val}) ✦`);
      newsletterEmail.value = "";
    });
  }

  // 9. Gestion du routage Hash
  window.addEventListener("hashchange", handleRouting);
  handleRouting();
});

// Synchronisation catalogue via polling API (setInterval dans DOMContentLoaded)
