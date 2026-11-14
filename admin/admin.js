/**
 * Tich Atelier — Backoffice Administrateur
 * Gestion indépendante des stocks, ajout de pièces & synchronisation avec le site client
 */

// ============================================================
// CONFIGURATION API & AUTH
// ============================================================
const STORAGE_VERSION = "2026-11-14";
if (localStorage.getItem("tich-admin-storage-version") !== STORAGE_VERSION) {
  localStorage.removeItem("tich-wa-number");
  localStorage.setItem("tich-admin-storage-version", STORAGE_VERSION);
}

const BACKEND_URL = (typeof window !== "undefined" && window.TICH_BACKEND_URL) || (
  (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"))
    ? "http://localhost:5000"
    : ""
);
const API_BASE = BACKEND_URL;

const DEFAULT_PLACEHOLDER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100%' height='100%' fill='%23f1f1f1'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='12' fill='%23999'>TICH</text></svg>";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function resolveAdminMediaUrl(url) {
  if (!url) return DEFAULT_PLACEHOLDER;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }
  const clean = url.startsWith("/") ? url : "/" + url;
  return BACKEND_URL ? `${BACKEND_URL}${clean}` : clean;
}

function getToken() {
  const storedToken = localStorage.getItem("tich-admin-token") || sessionStorage.getItem("tich-admin-token");
  if (!storedToken) return null;
  if (isTokenExpired(storedToken)) {
    clearToken();
    return null;
  }
  localStorage.setItem("tich-admin-token", storedToken);
  return storedToken;
}

function setToken(token) {
  localStorage.setItem("tich-admin-token", token);
  sessionStorage.removeItem("tich-admin-token");
}

function clearToken() {
  localStorage.removeItem("tich-admin-token");
  sessionStorage.removeItem("tich-admin-token");
}

function isTokenExpired(token) {
  try {
    const encodedPayload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = encodedPayload.padEnd(encodedPayload.length + ((4 - encodedPayload.length % 4) % 4), "=");
    const payload = JSON.parse(atob(paddedPayload));
    return !payload.exp || payload.exp * 1000 <= Date.now();
  } catch (e) {
    return true;
  }
}

async function apiRequest(method, path, body = null, isFormData = false) {
  const headers = { Authorization: "Bearer " + getToken() };
  if (!isFormData && body) headers["Content-Type"] = "application/json";
  const options = { method, headers };
  if (body) options.body = isFormData ? body : JSON.stringify(body);
  const res = await fetch(API_BASE + path, options);
  if (res.status === 401) {
    clearToken();
    showLoginPage();
    throw new Error("Session expirée");
  }
  return res;
}

function showLoginPage() {
  document.getElementById("login-page").style.display = "flex";
  document.getElementById("admin-app").style.display = "none";
}

function showAdminApp() {
  document.getElementById("login-page").style.display = "none";
  document.getElementById("admin-app").style.display = "block";
}

// ==========================================================================
// 1. BASE DE DONNÉES PAR DÉFAUT & INITIALISATION
// ==========================================================================
const defaultProducts = [];

// Configuration des sous-catégories par univers
const ADMIN_SUBCATS = {
  Mode: ["Sacs", "Chaussures", "Tee-shirts", "Jeans", "Robes & Blazers"],
  Parfums: ["Eaux de parfum", "Brumes parfumées"],
  "Beauté": ["Accessoires de beauté", "Soins du visage"]
};

// ==========================================================================
// 2. GESTION DU STORAGE & UTILITAIRES
// ==========================================================================
async function loadProducts() {
  try {
    const res = await fetch(API_BASE + "/api/products");
    const data = await res.json();
    products = data.products || [];
    renderKPIs();
    renderTable();
  } catch (e) {
    console.error("Erreur chargement produits:", e);
    showToast("Impossible de charger le catalogue. Vérifiez la connexion à l'API.");
  }
}

let products = [];

function saveProducts() { /* géré par l'API */ }

const money = val => Math.round(Number(val) || 0).toLocaleString("fr-FR").replace(/\s/g, " ") + " FCFA";

function showToast(message) {
  const toast = document.getElementById("admToast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2800);
}

// ==========================================================================
// 3. AFFICHAGE DES KPIS ET DE LA TABLE
// ==========================================================================
function renderKPIs() {
  const totalItems = products.length;
  const totalStockQty = products.reduce((sum, p) => sum + (typeof p.stock === "number" ? p.stock : 15), 0);
  const totalStockValue = products.reduce((sum, p) => sum + (p.price * (typeof p.stock === "number" ? p.stock : 15)), 0);
  const lowStockCount = products.filter(p => (p.stock ?? 15) > 0 && (p.stock ?? 15) <= 3).length;
  const outOfStockCount = products.filter(p => (p.stock ?? 15) <= 0).length;

  const kpiItemsEl = document.getElementById("kpiTotalItems");
  const kpiUnitsEl = document.getElementById("kpiTotalUnits");
  const kpiValueEl = document.getElementById("kpiTotalValue");
  const kpiLowEl = document.getElementById("kpiLowStock");
  const kpiOutEl = document.getElementById("kpiOutOfStock");

  if (kpiItemsEl) kpiItemsEl.textContent = totalItems;
  if (kpiUnitsEl) kpiUnitsEl.textContent = `${totalStockQty} unités`;
  if (kpiValueEl) kpiValueEl.textContent = money(totalStockValue);
  if (kpiLowEl) kpiLowEl.textContent = lowStockCount;
  if (kpiOutEl) kpiOutEl.textContent = outOfStockCount;

  const lowCard = document.getElementById("kpiCardLow");
  const outCard = document.getElementById("kpiCardOut");
  if (lowCard) lowCard.classList.toggle("warning", lowStockCount > 0);
  if (outCard) outCard.classList.toggle("danger", outOfStockCount > 0);
}

function renderTable() {
  const tbody = document.getElementById("admTableBody");
  if (!tbody) return;

  const searchVal = (document.getElementById("admSearch")?.value || "").toLowerCase().trim();
  const catVal = document.getElementById("admFilterCat")?.value || "Tous";
  const stockVal = document.getElementById("admFilterStock")?.value || "all";
  const sortVal = document.getElementById("admSortBy")?.value || "default";

  let list = [...products];

  // Recherche
  if (searchVal) {
    list = list.filter(p =>
      p.name.toLowerCase().includes(searchVal) ||
      p.category.toLowerCase().includes(searchVal) ||
      p.subCategory.toLowerCase().includes(searchVal) ||
      (p.tag && p.tag.toLowerCase().includes(searchVal)) ||
      (p.id && p.id.toLowerCase().includes(searchVal))
    );
  }

  // Univers
  if (catVal !== "Tous") {
    list = list.filter(p => p.category === catVal);
  }

  // Stock
  if (stockVal === "in") {
    list = list.filter(p => (p.stock ?? 15) > 3);
  } else if (stockVal === "low") {
    list = list.filter(p => (p.stock ?? 15) > 0 && (p.stock ?? 15) <= 3);
  } else if (stockVal === "out") {
    list = list.filter(p => (p.stock ?? 15) <= 0);
  }

  // Tri
  if (sortVal === "stock-asc") {
    list.sort((a, b) => (a.stock ?? 15) - (b.stock ?? 15));
  } else if (sortVal === "stock-desc") {
    list.sort((a, b) => (b.stock ?? 15) - (a.stock ?? 15));
  } else if (sortVal === "price-asc") {
    list.sort((a, b) => a.price - b.price);
  } else if (sortVal === "price-desc") {
    list.sort((a, b) => b.price - a.price);
  } else if (sortVal === "name") {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  const countBadge = document.getElementById("admResultCount");
  if (countBadge) countBadge.textContent = `${list.length} pièce${list.length > 1 ? "s" : ""}`;

  if (!list.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 48px; color: var(--admin-muted);">
          ✧ Aucun produit ne correspond aux filtres actuels.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(p => {
    const st = typeof p.stock === "number" ? p.stock : 15;
    let pillHtml = "";
    if (st <= 0) {
      pillHtml = `<span class="adm-pill out">🚫 Rupture (0)</span>`;
    } else if (st <= 3) {
      pillHtml = `<span class="adm-pill low">⚠️ Faible (${st})</span>`;
    } else {
      pillHtml = `<span class="adm-pill in">✓ En stock (${st})</span>`;
    }

    return `
      <tr data-row-id="${escapeHtml(p.id)}">
        <td>
          <div class="adm-prod-cell">
            <img src="${escapeHtml(resolveAdminMediaUrl(p.image))}" class="adm-thumb" alt="${escapeHtml(p.name)}" onerror="this.onerror=null;this.src='${DEFAULT_PLACEHOLDER}';" />
            <div class="adm-prod-meta">
              <strong>${escapeHtml(p.name)}</strong>
              <small>Réf : ${escapeHtml(p.id)} ${p.type ? `· ${escapeHtml(p.type)}` : ""}</small>
              ${p.tag ? `<span class="adm-tag-badge">${escapeHtml(p.tag)}</span>` : ""}
            </div>
          </div>
        </td>
        <td>
          <strong>${escapeHtml(p.category)}</strong>
          <small style="display: block; color: var(--admin-muted); font-size: 11.5px;">${escapeHtml(p.subCategory)}</small>
        </td>
        <td class="adm-price-cell">${money(p.price)}</td>
        <td>${pillHtml}</td>
        <td>
          <div class="adm-stock-cell">
            <div class="adm-stock-counter">
              <button class="adm-stock-btn" data-minus="${escapeHtml(p.id)}" title="Diminuer de 1">−</button>
              <input type="number" class="adm-stock-input" min="0" value="${st}" data-input="${escapeHtml(p.id)}" title="Modifier directement le stock" />
              <button class="adm-stock-btn" data-plus="${escapeHtml(p.id)}" title="Augmenter de 1">+</button>
            </div>
            ${st > 0 
              ? `<button type="button" class="adm-btn-rupture is-out" data-toggle-rupture="${escapeHtml(p.id)}" data-action="rupture" title="Déclarer ce produit en rupture de stock immédiate (stock = 0)">
                   🚫 Rupture de stock
                 </button>`
              : `<button type="button" class="adm-btn-rupture is-restore" data-toggle-rupture="${escapeHtml(p.id)}" data-action="restore" title="Rétablir ce produit en stock (+10 unités)">
                   🔄 Remettre en stock (+10)
                 </button>`
            }
          </div>
        </td>
        <td style="text-align: right;">
          <div class="adm-row-actions">
            <button class="adm-icon-btn" data-edit="${escapeHtml(p.id)}" title="Modifier cette pièce">✏️</button>
            <button class="adm-icon-btn delete" data-delete="${escapeHtml(p.id)}" title="Supprimer du catalogue">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  // Wires inline stock
  tbody.querySelectorAll("[data-minus]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.minus;
      const prod = products.find(p => p.id === id);
      if (prod) updateStock(id, -1);
    });
  });

  tbody.querySelectorAll("[data-plus]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.plus;
      const prod = products.find(p => p.id === id);
      if (prod) updateStock(id, 1);
    });
  });

  tbody.querySelectorAll("[data-input]").forEach(input => {
    input.addEventListener("change", () => {
      const id = input.dataset.input;
      const prod = products.find(p => p.id === id);
      if (prod) {
        const newVal = Math.max(0, parseInt(input.value) || 0);
        setDirectStock(id, newVal);
      }
    });
  });

  // Bouton Rupture de stock / Remise en stock direct
  tbody.querySelectorAll("[data-toggle-rupture]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.toggleRupture;
      const action = btn.dataset.action;
      if (action === "rupture") {
        setDirectStock(id, 0);
      } else {
        setDirectStock(id, 10);
      }
    });
  });

  // Wires edit / delete
  tbody.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => openProductModal(btn.dataset.edit));
  });

  tbody.querySelectorAll("[data-delete]").forEach(btn => {
    btn.addEventListener("click", () => deleteProduct(btn.dataset.delete));
  });
}

async function setDirectStock(id, newStock) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const targetStock = Math.max(0, parseInt(newStock) || 0);
  try {
    const res = await apiRequest("PATCH", "/api/products/" + id + "/stock", { stock: targetStock });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || ("Erreur " + res.status));
    }
    p.stock = targetStock;
    renderTable();
    renderKPIs();
    if (targetStock === 0) {
      showToast(`🚫 "${p.name}" est maintenant en RUPTURE DE STOCK (0)`);
    } else {
      showToast(`✓ "${p.name}" remis en stock (${targetStock} unités)`);
    }
  } catch (e) {
    console.error("Erreur mise à jour stock direct:", e);
    showToast("⚠️ Erreur lors de la mise à jour du stock : " + e.message);
  }
}

async function updateStock(id, delta) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const newStock = Math.max(0, (p.stock || 0) + delta);
  return setDirectStock(id, newStock);
}

async function deleteProduct(id) {
  if (!confirm("Supprimer ce produit ?")) return;
  try {
    await apiRequest("DELETE", "/api/products/" + id);
    products = products.filter(p => p.id !== id);
    renderTable();
    renderKPIs();
  } catch (e) {
    alert("Erreur suppression: " + e.message);
  }
}

async function resetCatalog() {
  if (!confirm("Supprimer TOUS les produits ? Action irréversible.")) return;
  try {
    for (const p of [...products]) {
      await apiRequest("DELETE", "/api/products/" + p.id);
    }
    products = [];
    renderTable();
    renderKPIs();
  } catch (e) {
    alert("Erreur réinitialisation: " + e.message);
  }
}

async function uploadImage(file) {
  const formData = new FormData();
  formData.append("image", file);
  const res = await apiRequest("POST", "/api/upload", formData, true);
  const data = await res.json();
  return data.url; // "/uploads/xxxx.jpg"
}

// ==========================================================================
// 4. MODALE PRODUIT (AJOUT / MODIFICATION)
// ==========================================================================
function populateSubcategories(cat, selectedSub = null) {
  const subSelect = document.getElementById("admSubCategory");
  if (!subSelect) return;
  const subs = ADMIN_SUBCATS[cat] || ADMIN_SUBCATS["Mode"];
  subSelect.innerHTML = subs.map(s => `<option value="${s}">${s}</option>`).join("");
  if (selectedSub && subs.includes(selectedSub)) {
    subSelect.value = selectedSub;
  }
}

function openProductModal(editId = null) {
  const overlay = document.getElementById("productModalOverlay");
  const modalTitle = document.getElementById("productModalTitle");
  const editIdInput = document.getElementById("admEditId");
  const nameInput = document.getElementById("admName");
  const catSelect = document.getElementById("admCategory");
  const tagSelect = document.getElementById("admTag");
  const priceInput = document.getElementById("admPrice");
  const stockInput = document.getElementById("admStock");
  const typeInput = document.getElementById("admType");
  const optionsInput = document.getElementById("admOptions");
  const descInput = document.getElementById("admDesc");
  const photoPreview = document.getElementById("admPhotoPreview");
  const fileInput = document.getElementById("admFileInput");
  const urlInput = document.getElementById("admUrlInput");
  const submitBtn = document.getElementById("admSubmitBtn");

  if (fileInput) fileInput.value = "";
  if (urlInput) urlInput.value = "";

  if (editId) {
    const prod = products.find(p => p.id === editId);
    if (!prod) return;
    if (modalTitle) modalTitle.textContent = `Modifier : ${prod.name}`;
    if (submitBtn) submitBtn.textContent = "Mettre à jour et Publier sur le Site Client →";
    if (editIdInput) editIdInput.value = prod.id;
    if (nameInput) nameInput.value = prod.name;
    if (catSelect) catSelect.value = prod.category;
    populateSubcategories(prod.category, prod.subCategory);
    if (tagSelect) tagSelect.value = prod.tag || "";
    if (priceInput) priceInput.value = prod.price;
    if (stockInput) stockInput.value = prod.stock ?? 15;
    if (typeInput) typeInput.value = prod.type || "";
    if (optionsInput) optionsInput.value = Array.isArray(prod.options) ? prod.options.join(", ") : "";
    if (descInput) descInput.value = prod.description || "";
    if (photoPreview) {
      photoPreview.src = resolveAdminMediaUrl(prod.image);
      photoPreview.dataset.customSrc = prod.image || "";
    }
  } else {
    if (modalTitle) modalTitle.textContent = "Ajouter une nouvelle pièce au catalogue client";
    if (submitBtn) submitBtn.textContent = "Enregistrer et Publier sur le Site Client →";
    if (editIdInput) editIdInput.value = "";
    if (nameInput) nameInput.value = "";
    if (catSelect) catSelect.value = "Mode";
    populateSubcategories("Mode");
    if (tagSelect) tagSelect.value = "NOUVEAU";
    if (priceInput) priceInput.value = "35000";
    if (stockInput) stockInput.value = "15";
    if (typeInput) typeInput.value = "";
    if (optionsInput) optionsInput.value = "36, 38, 40";
    if (descInput) descInput.value = "";
    if (photoPreview) {
      photoPreview.src = DEFAULT_PLACEHOLDER;
      photoPreview.dataset.customSrc = "assets/fashion.jpg";
    }
  }

  if (overlay) overlay.classList.add("open");
}

function closeProductModal() {
  const overlay = document.getElementById("productModalOverlay");
  if (overlay) overlay.classList.remove("open");
}

// ==========================================================================
// 5. CONFIGURATION WHATSAPP & SYNCHRONISATION CLOUD
// ==========================================================================
async function openWhatsAppModal() {
  const overlay = document.getElementById("waModalOverlay");
  const input = document.getElementById("waNumberInput");
  if (!overlay) return;

  // Récupérer le numéro actuel depuis l'API en direct
  try {
    const res = await fetch(API_BASE + "/api/settings/whatsapp");
    if (res.ok) {
      const data = await res.json();
      if (data && data.whatsapp) {
        if (input) input.value = data.whatsapp;
        localStorage.setItem("tich-wa-number", data.whatsapp);
      }
    }
  } catch (e) {
    const current = localStorage.getItem("tich-wa-number") || "33612345678";
    if (input) input.value = current;
  }

  overlay.classList.add("open");
  if (input) setTimeout(() => input.focus(), 80);
}

function closeWhatsAppModal() {
  const overlay = document.getElementById("waModalOverlay");
  if (overlay) overlay.classList.remove("open");
}

async function saveWhatsAppNumber() {
  const input = document.getElementById("waNumberInput");
  const saveBtn = document.getElementById("saveWaModalBtn");
  const val = (input?.value || "").replace(/\D/g, "");

  if (!val || val.length < 6) {
    alert("Veuillez saisir un numéro WhatsApp valide avec l'indicatif pays sans le signe + (ex: 2250700000000 pour la Côte d'Ivoire ou 33612345678 pour la France).");
    return;
  }

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "Enregistrement en cours...";
  }

  try {
    const res = await apiRequest("POST", "/api/settings/whatsapp", { whatsapp: val });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || ("Erreur " + res.status));
    }
    localStorage.setItem("tich-wa-number", val);
    closeWhatsAppModal();
    showToast(`✓ Numéro WhatsApp mis à jour : +${val} (synchronisé en direct avec le site client) 📱`);
    updateAdminWaButtonLabel(val);
  } catch (e) {
    console.error("Erreur enregistrement WhatsApp:", e);
    showToast("Échec de synchronisation du numéro WhatsApp. Aucune modification distante n'a été appliquée.");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Enregistrer le Numéro →";
    }
  }
}

function updateAdminWaButtonLabel(number) {
  const btn = document.getElementById("admWaConfigBtn");
  if (btn && number) {
    btn.innerHTML = `<span>📱</span> WhatsApp : <strong>+${number}</strong>`;
  }
}

// ==========================================================================
// 6. INITIALISATION DES ÉCOUTEURS
// ==========================================================================
document.addEventListener("DOMContentLoaded", async () => {
  // Gestion login
  const token = getToken();
  if (token) {
    showAdminApp();
    await loadProducts();
  } else {
    showLoginPage();
  }

  // Handler login form
  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("login-btn");
    const errDiv = document.getElementById("login-error");
    btn.textContent = "Connexion...";
    btn.disabled = true;
    errDiv.style.display = "none";
    try {
      const res = await fetch(API_BASE + "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: document.getElementById("login-username").value,
          password: document.getElementById("login-password").value
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setToken(data.token);
      showAdminApp();
      await loadProducts();
    } catch (e) {
      errDiv.textContent = e.message;
      errDiv.style.display = "block";
    } finally {
      btn.textContent = "SE CONNECTER";
      btn.disabled = false;
    }
  });

  // Bouton déconnexion
  const logoutBtn = document.getElementById("btn-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => { clearToken(); showLoginPage(); });
  }

  const clientStoreLink = document.getElementById("admClientStoreLink");
  if (clientStoreLink) {
    const configuredClientUrl = window.TICH_CLIENT_URL;
    if (configuredClientUrl) {
      clientStoreLink.href = configuredClientUrl;
    } else if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      clientStoreLink.href = "http://localhost:3000";
    } else {
      clientStoreLink.removeAttribute("href");
      clientStoreLink.setAttribute("aria-disabled", "true");
      clientStoreLink.title = "Configurez TICH_CLIENT_URL pour activer ce lien";
    }
  }

  // Filtres & Recherche
  const searchInput = document.getElementById("admSearch");
  const filterCat = document.getElementById("admFilterCat");
  const filterStock = document.getElementById("admFilterStock");
  const sortBy = document.getElementById("admSortBy");

  if (searchInput) searchInput.addEventListener("input", renderTable);
  if (filterCat) filterCat.addEventListener("change", renderTable);
  if (filterStock) filterStock.addEventListener("change", renderTable);
  if (sortBy) sortBy.addEventListener("change", renderTable);

  // Boutons d'en-tête
  const addBtn = document.getElementById("admAddNewBtn");
  const resetBtn = document.getElementById("admResetBtn");
  const waConfigBtn = document.getElementById("admWaConfigBtn");

  if (addBtn) addBtn.addEventListener("click", () => openProductModal());
  if (resetBtn) resetBtn.addEventListener("click", resetCatalog);
  if (waConfigBtn) waConfigBtn.addEventListener("click", openWhatsAppModal);

  // Modale Produit Fermetures
  const closeProdBtn = document.getElementById("closeProductModal");
  const cancelProdBtn = document.getElementById("cancelProductModalBtn");
  if (closeProdBtn) closeProdBtn.addEventListener("click", closeProductModal);
  if (cancelProdBtn) cancelProdBtn.addEventListener("click", closeProductModal);

  // Changement d'univers dans la modale
  const modalCat = document.getElementById("admCategory");
  if (modalCat) {
    modalCat.addEventListener("change", e => populateSubcategories(e.target.value));
  }

  // Gestion des photos dans la modale
  const fileInput = document.getElementById("admFileInput");
  const urlInput = document.getElementById("admUrlInput");
  const presetSelect = document.getElementById("admPresetSelect");
  const photoPreview = document.getElementById("admPhotoPreview");

  if (fileInput && photoPreview) {
    fileInput.addEventListener("change", async e => {
      const file = e.target.files[0];
      if (file) {
        // Essaie d'uploader via API, sinon fallback DataURL
        try {
          const uploadedUrl = await uploadImage(file);
          photoPreview.src = uploadedUrl;
          photoPreview.dataset.customSrc = uploadedUrl;
          if (urlInput) urlInput.value = "";
        } catch (err) {
          // fallback: lecture locale
          const reader = new FileReader();
          reader.onload = evt => {
            photoPreview.src = evt.target.result;
            photoPreview.dataset.customSrc = evt.target.result;
            if (urlInput) urlInput.value = "";
          };
          reader.readAsDataURL(file);
        }
      }
    });
  }

  if (urlInput && photoPreview) {
    urlInput.addEventListener("input", e => {
      const url = e.target.value.trim();
      if (url) {
        photoPreview.src = url;
        photoPreview.dataset.customSrc = url;
      }
    });
  }

  if (presetSelect && photoPreview) {
    presetSelect.addEventListener("change", e => {
      photoPreview.src = e.target.value;
      photoPreview.dataset.customSrc = e.target.value;
      if (urlInput) urlInput.value = "";
      if (fileInput) fileInput.value = "";
    });
  }

  // Raccourcis rapides de stock dans la modale
  const zeroStockBtn = document.getElementById("admModalZeroStockBtn");
  const setTenStockBtn = document.getElementById("admModalSetTenStockBtn");
  const addFiveStockBtn = document.getElementById("admModalAddFiveStockBtn");
  const modalStockField = document.getElementById("admStock");

  if (zeroStockBtn && modalStockField) {
    zeroStockBtn.addEventListener("click", () => {
      modalStockField.value = "0";
      showToast("Quantité fixée à 0 (Rupture)");
    });
  }
  if (setTenStockBtn && modalStockField) {
    setTenStockBtn.addEventListener("click", () => {
      modalStockField.value = "10";
      showToast("Quantité fixée à 10 unités");
    });
  }
  if (addFiveStockBtn && modalStockField) {
    addFiveStockBtn.addEventListener("click", () => {
      const cur = Math.max(0, parseInt(modalStockField.value) || 0);
      modalStockField.value = String(cur + 5);
      showToast(`Quantité augmentée à ${cur + 5} unités`);
    });
  }

  // Soumission Formulaire Produit
  const productForm = document.getElementById("adminProductForm");
  if (productForm) {
    productForm.addEventListener("submit", async e => {
      e.preventDefault();

      const editingId = document.getElementById("admEditId")?.value;
      const name = document.getElementById("admName")?.value.trim();
      const category = document.getElementById("admCategory")?.value;
      const subCategory = document.getElementById("admSubCategory")?.value;
      const tag = document.getElementById("admTag")?.value.trim();
      const price = Math.max(0, parseInt(document.getElementById("admPrice")?.value) || 0);
      const stock = Math.max(0, parseInt(document.getElementById("admStock")?.value) || 0);
      const type = document.getElementById("admType")?.value.trim() || `${category} · Tich Atelier`;
      const optionsRaw = document.getElementById("admOptions")?.value.trim();
      const desc = document.getElementById("admDesc")?.value.trim() || `Pièce d'exception créée par Tich Atelier.`;
      let image = photoPreview?.dataset.customSrc || photoPreview?.src || "assets/fashion.jpg";
      if (!image.startsWith("data:") && !image.startsWith("http") && !image.startsWith("/")) {
        image = image.replace(/^\.\.\//, "");
      }

      const options = optionsRaw
        ? optionsRaw.split(",").map(o => o.trim()).filter(Boolean)
        : (category === "Mode" ? ["36", "38", "40"] : (category === "Parfums" ? ["50 ml", "100 ml"] : ["Taille Unique"]));

      if (!name) {
        alert("Veuillez renseigner un nom pour le produit.");
        return;
      }

      const productData = {
        name, category, subCategory, tag, price, stock, type,
        options, description: desc, image,
        rating: 5.0, reviewsCount: 1,
        details: `Confection soignée dans les ateliers de la maison. Finitions et contrôle qualité rigoureux.`
      };

      try {
        if (editingId) {
          const res = await apiRequest("PUT", "/api/products/" + editingId, productData);
          const data = await res.json();
          const idx = products.findIndex(p => p.id === editingId);
          if (idx >= 0) products[idx] = data.product;
          showToast(`"${name}" a été mis à jour avec succès ✨`);
        } else {
          const res = await apiRequest("POST", "/api/products", productData);
          const data = await res.json();
          products.unshift(data.product);
          showToast(`"${name}" a été publié sur la boutique client ! 🎉`);
        }
      } catch (err) {
        alert("Erreur lors de l'enregistrement: " + err.message);
        return;
      }

      closeProductModal();
      renderKPIs();
      renderTable();
    });
  }

  // Modale WhatsApp
  const closeWaBtn = document.getElementById("closeWaModal");
  const cancelWaBtn = document.getElementById("cancelWaModalBtn");
  const saveWaBtn = document.getElementById("saveWaModalBtn");
  const waOverlay = document.getElementById("waModalOverlay");
  const waInput = document.getElementById("waNumberInput");

  if (closeWaBtn) closeWaBtn.addEventListener("click", closeWhatsAppModal);
  if (cancelWaBtn) cancelWaBtn.addEventListener("click", closeWhatsAppModal);
  if (saveWaBtn) saveWaBtn.addEventListener("click", saveWhatsAppNumber);

  if (waOverlay) {
    waOverlay.addEventListener("click", e => {
      if (e.target === waOverlay) closeWhatsAppModal();
    });
  }

  if (waInput) {
    waInput.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        saveWhatsAppNumber();
      }
    });
  }

  // Charge et affiche immédiatement le numéro configuré
  try {
    fetch(API_BASE + "/api/settings/whatsapp")
      .then(r => r.json())
      .then(d => {
        if (d && d.whatsapp) updateAdminWaButtonLabel(d.whatsapp);
      })
      .catch(() => {});
  } catch (e) {}

  // Fermeture par touche Échap
  window.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      closeProductModal();
      closeWhatsAppModal();
    }
  });
});
