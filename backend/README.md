# Tich Atelier — Backend API REST

API REST indépendante pour le catalogue de luxe Tich Atelier.
Prend en charge la base de données **Supabase (PostgreSQL)** en cloud ou **SQLite (WASM)** en local sans configuration complexe.

---

## 🚀 Installation & Démarrage

```bash
cd backend
npm install
npm run dev
```

L'API démarre sur :
- **Racine API** : `http://localhost:5000/`
- **Produits** : `http://localhost:5000/api/products`
- **Uploads d'images** : `http://localhost:5000/uploads`

---

## 🗄️ Configuration Base de Données

Créez un fichier `.env` (ou utilisez le modèle `.env.example`) :

```env
PORT=5000
JWT_SECRET=votre_cle_secrete_jwt
ADMIN_USERNAME=admin
ADMIN_PASSWORD=TichAdmin2024!

# Supabase (PostgreSQL Cloud)
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_KEY=votre_cle_anon_ou_service_role
```

### Utilisation avec Supabase :
1. Créez un projet gratuit sur [Supabase](https://supabase.com).
2. Dans **SQL Editor**, copiez et exécutez le script [db/supabase_schema.sql](./db/supabase_schema.sql).
3. Renseignez `SUPABASE_URL` et `SUPABASE_KEY` dans votre `.env`.
4. Si les variables Supabase ne sont pas renseignées, l'API bascule automatiquement en SQLite local transparent.

---

## 📡 Endpoints API

| Méthode | Route | Description | Auth requise |
|---|---|---|---|
| `GET` | `/api/products` | Liste tous les articles | Non |
| `GET` | `/api/products/:id` | Détail d'un article | Non |
| `POST` | `/api/products` | Créer un article | Oui (JWT) |
| `PUT` | `/api/products/:id` | Modifier un article | Oui (JWT) |
| `PATCH` | `/api/products/:id/stock`| Ajuster le stock | Oui (JWT) |
| `DELETE` | `/api/products/:id` | Supprimer un article | Oui (JWT) |
| `POST` | `/api/upload` | Upload d'une photo (multipart) | Oui (JWT) |
| `POST` | `/api/auth/login` | Connexion administrateur | Non |

