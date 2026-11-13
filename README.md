# ✨ Tich Atelier — Architecture Découplée

Le projet est entièrement scindé en **3 dossiers 100% indépendants et autonomes**, prêts pour être envoyés sur GitHub (soit dans 3 dépôts séparés, soit dans un seul dépôt monorepo propre) :

```text
catalogue/
├── client/     → Boutique en ligne (HTML/CSS/JS + Médias)
├── admin/      → Tableau de bord administrateur (Gestion stocks, prix & uploads)
└── backend/    → API REST Express + Supabase (PostgreSQL) / SQLite local
```

---

## 📁 1. Module `backend/` (API REST)
API purement indépendante, sans rendu HTML client.
- **Port local** : `http://localhost:5000`
- **Base de données** : Supabase PostgreSQL (ou SQLite local de secours)
- **Démarrage** :
  ```bash
  cd backend
  npm install
  npm run dev
  ```
- **Fichiers clés** :
  - `server.js` : API REST + CORS ouvert pour le client et l'admin
  - `.env` : Variables secrètes (JWT, Supabase, mot de passe admin)
  - `db/supabase_schema.sql` : Script de création des tables Supabase
  - `uploads/` : Dossier de stockage des photos de produits

---

## 📁 2. Module `client/` (Boutique Client)
Application Web mobile & desktop pour vos clients.
- **Port local** : `http://localhost:3000`
- **Démarrage** :
  ```bash
  cd client
  npm start
  ```
- **Déploiement possible** : Vercel, Netlify, Cloudflare Pages, GitHub Pages ou hébergeur Node.
- Se connecte automatiquement à `http://localhost:5000/api` en local.

---

## 📁 3. Module `admin/` (Backoffice Administrateur)
Tableau de bord de gestion des pièces et des stocks.
- **Port local** : `http://localhost:3001`
- **Démarrage** :
  ```bash
  cd admin
  npm start
  ```
- **Déploiement possible** : Vercel, Netlify, hébergement interne sécurisé.
- Se connecte automatiquement à `http://localhost:5000/api` en local.
- Les identifiants doivent être configurés explicitement dans le fichier `.env` du backend.

---

## 🚢 Envoi vers GitHub

Vous pouvez au choix :
1. **Créer 3 dépôts GitHub séparés** :
   - Un dépôt pour `client` (déployable sur Vercel/Netlify en 1 clic).
   - Un dépôt pour `admin` (déployable sur Vercel/Netlify en 1 clic).
   - Un dépôt pour `backend` (déployable sur Render/Railway en 1 clic).
2. **Ou envoyer l'ensemble du dossier `catalogue` dans un seul dépôt GitHub** : les 3 dossiers restent parfaitement structurés et indépendants.
