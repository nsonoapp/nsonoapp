# Configuration manuelle Firestore — NSONO

Guide pas-à-pas pour préparer une base Firebase **vide** et tester l'application correctement.

> Référence schéma : `.cursor/rules/collection.mdc`  
> Règles à déployer : `firestore rulses.txt`

---

## 1) Prérequis Firebase

1. Créer / ouvrir le projet Firebase.
2. Activer **Authentication → Email/Mot de passe** (Google optionnel).
3. Créer la base **Firestore** (mode production recommandé).
4. Déployer les règles Firestore :
   - Console Firebase → Firestore → Règles
   - Coller le contenu de `firestore rulses.txt`
   - Publier
5. Vérifier la config web Firebase dans `js/firebase.js` (clés du bon projet).

---

## 2) Comprendre le modèle NSONO

- **Une seule société** par base : `companies/main` (docId fixe `main`).
- Mot de passe société : `company_secrets/main` (hash SHA-256, jamais en clair).
- **Sous-entités** : `entities/{entityId}` + `entity_secrets/{entityId}`.
- Connexion utilisateur = **3 facteurs** :
  1. email + mot de passe personnel (Firebase Auth)
  2. nom/code société + mot de passe société
  3. nom entité + mot de passe entité (**sauf Master Admin**)

---

## 3) Générer le hash mot de passe (SHA-256)

Les mots de passe société/entité ne se stockent **jamais** en clair.

Dans la console navigateur (F12), exécuter :

```js
async function sha256(text) {
  const encoded = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// Exemple
sha256("MonMotDePasseSociete123").then(console.log);
```

Conserver :
- `passwordSocieteClair` → pour tester le login
- `passwordHashSociete` → valeur à mettre dans Firestore

Refaire pour le mot de passe entité.

---

## 4) Méthode recommandée — Bootstrap complet via Console Firestore

Cette méthode est la plus fiable pour une **première installation** (base vide).

### Étape A — Créer le compte Auth du Master Admin

1. Firebase Console → **Authentication → Users → Add user**
2. Email : `admin@votredomaine.com`
3. Mot de passe : `Admin123456` (exemple)
4. Copier l'**UID** (ex. `AbCdEf1234567890`)

### Étape B — Créer les documents Firestore (dans cet ordre)

> La Console Firebase contourne les rules : vous pouvez créer les docs manuellement.

#### 1. `system/meta`

```json
{
  "usersCount": 1
}
```

#### 2. `companies/main`

```json
{
  "name": "Ma Societe",
  "companyCode": "ma-societe",
  "masterAdminIds": ["VOTRE_UID_AUTH"],
  "masterAdminId": "VOTRE_UID_AUTH",
  "isActive": true,
  "createdAt": "<Timestamp>",
  "updatedAt": "<Timestamp>"
}
```

#### 3. `company_secrets/main`

```json
{
  "companyId": "main",
  "passwordHash": "HASH_SHA256_MOT_DE_PASSE_SOCIETE",
  "updatedAt": "<Timestamp>"
}
```

#### 4. `entities/{entityId}`

Créer un doc avec ID auto (ex. `goma001`) :

```json
{
  "companyId": "main",
  "name": "Goma",
  "adminId": "VOTRE_UID_AUTH",
  "isActive": true,
  "createdAt": "<Timestamp>",
  "updatedAt": "<Timestamp>"
}
```

> Noter l'`entityId` créé (ex. `goma001`).

#### 5. `entity_secrets/{entityId}`

DocId = **le même** que l'entité :

```json
{
  "companyId": "main",
  "entityId": "goma001",
  "passwordHash": "HASH_SHA256_MOT_DE_PASSE_ENTITE",
  "updatedAt": "<Timestamp>"
}
```

#### 6. `users/{VOTRE_UID_AUTH}`

DocId = UID Firebase Auth :

```json
{
  "userId": "VOTRE_UID_AUTH",
  "name": "Admin Principal",
  "email": "admin@votredomaine.com",
  "role": "admin",
  "roleIds": [],
  "companyId": "main",
  "entityId": null,
  "approvalStatus": "approved",
  "isActive": true,
  "createdAt": "<Timestamp>"
}
```

> `entityId: null` + présence dans `masterAdminIds` = **Master Admin** (vision globale).

#### 7. `settings/main_config` (recommandé pour tests UI)

```json
{
  "companyId": "main",
  "shopName": "Ma Boutique Test",
  "shopAddress": "Goma",
  "shopPhone": "+243000000000",
  "currency": "Franc Congolais",
  "currencySymbol": "FC",
  "logoUrl": "",
  "lowStockLimit": 10,
  "enableOffline": true,
  "enableExpiration": false,
  "expirationAlertDays": 7,
  "createdAt": "<Timestamp>",
  "updatedAt": "<Timestamp>"
}
```

---

## 5) Test de connexion

### Master Admin

Page : `login.html`

| Champ | Valeur |
|------|--------|
| Email | `admin@votredomaine.com` |
| Mot de passe | `Admin123456` |
| Nom société | `Ma Societe` (ou `ma-societe`) |
| Mot de passe société | mot de passe clair société |
| Entité | **laisser vide** |
| Mot de passe entité | **laisser vide** |

Résultat attendu :
- redirection vers `index.html`
- accès admin (`admin/admin.html`)

### Vendeur / employé (après création)

Champs obligatoires :
- email + mot de passe personnel
- société + mot de passe société
- **entité + mot de passe entité**

---

## 6) Créer les autres utilisateurs (flux normal)

### Option A — Inscription publique (`signup.html`)

1. L'utilisateur crée son compte Firebase Auth.
2. Il saisit société + mot de passe société + entité + mot de passe entité.
3. Firestore crée `users/{uid}` avec :
   - `role: "user"`
   - `isActive: false`
   - `approvalStatus: "pending"`
4. L'admin approuve dans `admin/approvals.html` :
   - passer `approvalStatus` à `approved`
   - définir `role` (`admin` ou `seller`)
   - activer `isActive: true`

### Option B — Création manuelle Console

Créer `users/{uid}` avec les mêmes champs, puis ajuster rôle/approbation.

---

## 7) Rôles et accès

### Rôles legacy (actifs)

- `admin` : accès métier + administration
- `seller` : accès métier (vente, stock selon périmètre)
- `user` : bloqué tant que non approuvé / rôle métier non attribué

### Rôles dynamiques (cible)

Collection `roles/{roleId}` + `users.roleIds[]`.

Exemple `roles/role_gestionnaire` :

```json
{
  "companyId": "main",
  "entityId": "goma001",
  "name": "Gestionnaire Dépôt",
  "scopes": ["scope_depot", "scope_sales"],
  "isActive": true,
  "createdAt": "<Timestamp>",
  "updatedAt": "<Timestamp>",
  "createdBy": "VOTRE_UID_AUTH"
}
```

Puis sur l'utilisateur :

```json
{
  "roleIds": ["role_gestionnaire"]
}
```

---

## 8) Paramètres par entité (optionnel)

Pour une entité `goma001`, créer :

`settings/entity_goma001`

```json
{
  "companyId": "main",
  "shopName": "Depot Goma",
  "shopAddress": "Avenue X",
  "shopPhone": "+243...",
  "currency": "Franc Congolais",
  "currencySymbol": "FC",
  "logoUrl": "",
  "lowStockLimit": 10,
  "enableOffline": true,
  "enableExpiration": false,
  "expirationAlertDays": 7,
  "createdAt": "<Timestamp>",
  "updatedAt": "<Timestamp>"
}
```

---

## 9) Checklist de test complet

- [ ] Login Master Admin OK
- [ ] Accès `admin/admin.html`
- [ ] Paramètres globaux visibles (`admin/settings.html`)
- [ ] Création produit (`products.html`)
- [ ] Achat + stock IN (`purchases.html`)
- [ ] Vente (`index.html`)
- [ ] Stats (`stats.html`)
- [ ] Logs créés (`logs` collection)
- [ ] Inscription nouvel utilisateur → approbation admin
- [ ] Login vendeur avec entité OK

---

## 10) Erreurs fréquentes

| Symptôme | Cause probable | Correction |
|---------|----------------|------------|
| `Société introuvable` | `companies/main` absent ou nom/code incorrect | Vérifier `name` / `companyCode` |
| `Mot de passe société invalide` | hash incorrect dans `company_secrets/main` | Regénérer SHA-256 |
| `Entité requise` | compte non master sans entité au login | Renseigner entité + mot de passe entité |
| `Compte en attente d'approbation` | `approvalStatus != approved` | Approuver dans admin |
| `Accès refusé` / `permission-denied` | rules non déployées ou user inactif | Déployer rules + `isActive: true` |
| `Utilisateur non configuré` | pas de doc `users/{uid}` | Créer le profil Firestore |
| Onboarding bloqué | société déjà existante | Normal : `admin/onboarding.html` est one-shot |

---

## 11) Page onboarding (`admin/onboarding.html`)

Cette page initialise la société depuis l'app **si** :
- utilisateur connecté
- `companies/main` n'existe pas encore

En pratique, sur une base vide, le login exige déjà une société configurée.  
👉 Pour le **premier déploiement**, utilisez la **section 4 (Console Firestore)**.  
L'onboarding sert surtout à rejouer l'initialisation en environnement contrôlé.

---

## 12) Sécurité (production)

- Ne jamais stocker de mots de passe en clair dans Firestore.
- Ne jamais exposer `company_secrets` / `entity_secrets` côté client (rules `read: false`).
- Limiter `masterAdminIds` à max **5** admins globaux.
- Sauvegarder les mots de passe société/entité hors Firebase (gestionnaire de mots de passe).
- Vérifier régulièrement les comptes `approvalStatus: pending`.

---

## 13) Récapitulatif minimal (copier/coller)

Documents indispensables pour démarrer :

1. `system/meta`
2. `companies/main`
3. `company_secrets/main`
4. `entities/{entityId}`
5. `entity_secrets/{entityId}`
6. `users/{uid}` (master admin approuvé)
7. `settings/main_config` (recommandé)

Ensuite : login → tests métier → approbation des nouveaux comptes.
