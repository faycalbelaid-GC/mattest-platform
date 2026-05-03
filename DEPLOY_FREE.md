# Déploiement 100% Gratuit — Guide étape par étape

## Architecture choisie
```
Vercel      → Frontend React  (gratuit illimité)
Render.com  → Backend FastAPI (gratuit, dort après 15min)
Supabase    → PostgreSQL      (gratuit 500MB)
Upstash     → Redis           (gratuit 10k req/jour)
```

---

## Étape 1 — PostgreSQL sur Supabase (5 min)

1. Aller sur https://supabase.com → "Start for free" → connexion GitHub
2. "New project" → choisir un nom (ex: `mattest`) + mot de passe fort → région **EU West**
3. Attendre 2 min que le projet se crée
4. Aller dans **Settings → Database → Connection string → URI**
5. Copier l'URL qui ressemble à :
   ```
   postgresql://postgres:[MOT_DE_PASSE]@db.xxxx.supabase.co:5432/postgres
   ```
6. **Important** : remplacer `postgresql://` par `postgresql+asyncpg://`
   ```
   postgresql+asyncpg://postgres:[MOT_DE_PASSE]@db.xxxx.supabase.co:5432/postgres
   ```
   → Garder cette URL pour l'étape 3

---

## Étape 2 — Redis sur Upstash (3 min)

1. Aller sur https://upstash.com → "Get Started" → connexion GitHub
2. "Create Database" → nom: `mattest-redis` → région **EU-West-1** → **Free plan**
3. Une fois créé, cliquer sur la base → onglet **Details**
4. Copier **"Redis URL"** qui ressemble à :
   ```
   rediss://default:[PASSWORD]@xxxx.upstash.io:6379
   ```
   → Garder cette URL pour l'étape 3

---

## Étape 3 — Backend sur Render.com (10 min)

1. Aller sur https://render.com → "Get Started for Free" → connexion GitHub
2. "New +" → **Web Service**
3. Connecter le repo GitHub : `faycalbelaid-GC/mattest-platform`
4. Configurer :
   - **Name** : `mattest-backend`
   - **Root Directory** : `backend`
   - **Runtime** : Python 3
   - **Build Command** : `pip install -r requirements.txt`
   - **Start Command** : `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Plan** : Free

5. Section **Environment Variables** → ajouter :
   | Clé | Valeur |
   |-----|--------|
   | `DATABASE_URL` | URL Supabase de l'étape 1 |
   | `REDIS_URL` | URL Upstash de l'étape 2 |
   | `SECRET_KEY` | un texte aléatoire long (ex: `mattest-prod-key-2024-xyz-abc`) |
   | `CORS_ORIGINS` | `["https://mattest.vercel.app"]` (à ajuster après étape 4) |
   | `ML_MODELS_DIR` | `./ml_models` |
   | `REPORTS_DIR` | `./reports` |

6. Cliquer **Create Web Service**
7. Attendre 3-5 min → noter l'URL : `https://mattest-backend.onrender.com`

---

## Étape 4 — Frontend sur Vercel (5 min)

1. Aller sur https://vercel.com → "Start Deploying" → connexion GitHub
2. "Add New Project" → importer `faycalbelaid-GC/mattest-platform`
3. Configurer :
   - **Root Directory** : `frontend`
   - **Framework Preset** : Vite
   - **Build Command** : `npm run build`
   - **Output Directory** : `dist`

4. Section **Environment Variables** → ajouter :
   | Clé | Valeur |
   |-----|--------|
   | `VITE_API_URL` | `https://mattest-backend.onrender.com` |

5. Cliquer **Deploy** → noter l'URL : `https://mattest.vercel.app`

6. **Retourner sur Render** → modifier la variable `CORS_ORIGINS` avec l'URL Vercel réelle

---

## Étape 5 — Créer le premier compte admin

Une fois tout déployé, ouvrir un terminal et lancer :

```bash
curl -X POST https://mattest-backend.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@tonlabo.fr",
    "full_name": "Administrateur",
    "password": "motdepasse_securise",
    "role": "admin"
  }'
```

---

## Limitations du plan gratuit

| Limitation | Impact |
|-----------|--------|
| Backend dort après 15 min d'inactivité | Premier chargement = 30-60 sec d'attente |
| 512 MB RAM sur Render | Modèles ML légers uniquement (déjà optimisé) |
| 750h/mois sur Render | Suffisant pour un usage normal (1 service) |
| Supabase : 500 MB | Suffisant pour ~100k essais |
| Upstash : 10k req/jour | Suffisant si usage modéré |
| Rapports PDF non persistants | Les PDF générés sont perdus au redémarrage |

## Solution pour les PDF persistants (gratuit)

Ajouter le stockage sur **Cloudflare R2** (10 GB gratuit) ou **Supabase Storage** (1 GB gratuit).

---

## Coût réel si on dépasse le gratuit

| Service | Prix upgrade |
|---------|-------------|
| Render Starter | $7/mois (pas de sommeil, 512 MB) |
| Supabase Pro | $25/mois (8 GB, backups) |
| → **Alternative** : VPS Hetzner | **3.5€/mois** tout inclus |
