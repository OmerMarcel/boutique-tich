# Tich Atelier — Backoffice Administrateur

Tableau de bord administrateur autonome pour la gestion du catalogue, des stocks, des prix et des visuels de **Tich Atelier**.
Totalement indépendant de l'application client et prêt à être déployé séparément (Vercel, Netlify, Cloudflare Pages ou Node.js).

---

## 🔐 Démarrage en local

```bash
cd admin
npm start
```
Puis accédez à :
👉 `http://localhost:3001`

*(Identifiants par défaut : utilisateur `admin` / mot de passe `TichAdmin2024!` configurables dans le backend)*

---

## ⚙️ Configuration de l'API Backend

Par défaut en local, l'admin se connecte automatiquement à l'API sur `http://localhost:5000`.

Pour personnaliser l'adresse de l'API (ex: API hébergée sur Render ou Supabase) :
```html
<script>
  window.TICH_BACKEND_URL = "https://mon-api-tich.railway.app";
</script>
```

---

## 📂 Contenu du dossier
- `index.html` : Écran d'authentification JWT & Dashboard de gestion.
- `admin.css` : Interface sombre premium et ergonomique (KPIs, tableau, modale d'édition).
- `admin.js` : Gestion des sessions, requêtes CRUD sécurisées et upload d'images.
- `server.js` : Serveur statique Node.js autonome (sans dépendances externes).

