# Tich Atelier — Interface Client

Interface e-commerce de luxe responsive pour smartphone et ordinateur de **Tich Atelier**.
Totalement découplée et autonome, prête à être déployée sur n'importe quel hébergeur statique (Vercel, Netlify, GitHub Pages, Firebase Hosting) ou servie avec Node.js.

---

## 📱 Démarrage en local

```bash
cd client
npm start
```
Puis ouvrez votre navigateur sur :
👉 `http://localhost:3000`

*(Vous pouvez également ouvrir `index.html` directement dans un navigateur ou via l'extension VS Code Live Server).*

---

## ⚙️ Configuration de l'API Backend

Par défaut en local, l'application se connecte automatiquement à l'API sur `http://localhost:5000/api`.

Pour personnaliser l'URL de l'API (ex: lors du déploiement en production) :
Définissez la variable globale dans votre HTML ou avant le chargement du script :
```html
<script>
  window.TICH_BACKEND_URL = "https://mon-api-tich.railway.app";
</script>
```

Avec les configurations Vercel fournies, l'API est normalement consommée via les
réécritures `/api` et `/uploads`. Pour un hébergement différent, définissez
`window.TICH_BACKEND_URL` explicitement.

### Déploiement Vercel

Pour ce monorepo, le projet Vercel du client doit utiliser :

```text
Root Directory: client
Framework Preset: Other
Build Command: vide
Output Directory: vide
Install Command: vide
```

Le fichier `vercel.json` doit rester dans ce dossier. Ne lancez pas `npm start`
sur Vercel : `server.js` est uniquement destiné au développement local.

---

## 📂 Contenu du dossier
- `index.html` : Structure de la boutique (Hero vidéo, navigation, vitrine, modale, panier WhatsApp).
- `styles.css` : Styles de luxe haute couture optimisés pour smartphones.
- `script.js` : Logique de boutique, filtres, panier et commandes WhatsApp.
- `assets/` : Médias, logos et photos du catalogue.
- `server.js` : Serveur statique Node.js autonome (sans dépendances externes).

