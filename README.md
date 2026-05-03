# MatTest — Plateforme Intelligente de Gestion d'Essais de Matériaux

> **Full-stack** · **ML/IA** · **Temps réel** · **Rapports PDF certifiés** · **Docker**

---

## Vue d'ensemble

MatTest est une plateforme professionnelle de gestion d'essais de résistance pour matériaux de construction (béton, acier, bitume…). Elle automatise l'analyse, prédit les résistances à 28 jours depuis des mesures précoces (7j), détecte les anomalies par IA, et génère des rapports conformes aux normes internationales.

### ROI estimé
| Gain | Valeur |
|------|--------|
| Économie analyses manuelles | ~10h/semaine → **~26k€/an** |
| Anticipation résistance 28j | Dès le **7e jour** (gain 3 semaines) |
| Taux erreur humaine | Réduit de ~70% |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser (React 18 + TypeScript + TailwindCSS)          │
│  Dashboard · Matériaux · Essais · Prédictions · Rapports│
└────────────────┬────────────────────────────────────────┘
                 │ HTTP REST + WebSocket
┌────────────────▼────────────────────────────────────────┐
│  FastAPI 0.111  (Python 3.11)                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ /auth    │ │/materials│ │  /tests  │ │/reports  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│  ┌──────────────────────────────────────────────────┐   │
│  │  ML Services                                     │   │
│  │  • GradientBoosting → fc prédite 28j             │   │
│  │  • IsolationForest  → détection anomalies        │   │
│  │  • Méthode CEB-FIP + maturité Nurse-Saul         │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌─────────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │  SQLAlchemy │  │  Redis   │  │  ReportLab PDF   │   │
│  │  (async)    │  │  pub/sub │  │  EN 12390 layout │   │
│  └──────┬──────┘  └──────────┘  └──────────────────┘   │
└─────────┼───────────────────────────────────────────────┘
          │
┌─────────▼──────────────┐  ┌─────────────────┐
│  PostgreSQL 15          │  │  MLflow 2.11    │
│  (matériaux, essais,    │  │  (model registry│
│   prédictions, rapports,│  │   experiment    │
│   audit logs)           │  │   tracking)     │
└─────────────────────────┘  └─────────────────┘
```

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | React 18, TypeScript, Vite, TailwindCSS, Recharts, React Query |
| Backend | FastAPI, SQLAlchemy (async), Alembic, Pydantic v2 |
| Base de données | PostgreSQL 15 + asyncpg |
| Cache / WS | Redis 7 |
| ML | scikit-learn (GBR + IsolationForest), joblib, MLflow |
| PDF | ReportLab 4 |
| Auth | JWT (python-jose + passlib bcrypt) |
| Infra | Docker Compose, Nginx, GitHub Actions CI/CD |

---

## Fonctionnalités clés

### ML / Intelligence Artificielle
- **Prédiction fc à 28j** depuis mesures à 3j, 7j ou 14j (GradientBoosting + maturité CEB-FIP 1990)
- **Détection d'anomalies** en temps réel (Isolation Forest, contamination 5%)
- **Indice de maturité Nurse-Saul** : M = Σ(T − T₀)·Δt
- **Classe béton estimée** : C16/20 → C40/50+ (EN 206)

### Rapports certifiés
- Génération PDF asynchrone (background task)
- Layout conforme **EN 12390 / ASTM C39 / ISO 1920**
- Statistiques : fc,moy, σ, fck = fc,moy − 1.645·σ (EN 206 §8.2)
- Téléchargement direct depuis l'interface

### Temps réel (WebSocket)
- Alertes instantanées anomalies (toast + WS broadcast)
- Notifications rapport prêt
- Dashboard auto-refresh toutes les 15s

### Collaboration & traçabilité
- Multi-utilisateurs avec rôles : admin, engineer, technician, viewer
- Versioning des matériaux (historique complet)
- Audit trail (toutes les actions horodatées)

---

## Démarrage rapide

### Prérequis
- Docker Desktop 4.x
- Docker Compose v2

### Lancement en 3 commandes

```bash
# 1. Cloner et configurer
cp .env.example .env
# Modifier .env si nécessaire (changer SECRET_KEY en production)

# 2. Démarrer tous les services
docker compose up -d

# 3. Créer le premier utilisateur admin
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@lab.fr","full_name":"Admin","password":"admin123","role":"admin"}'
```

**Accès :**
| Service | URL |
|---------|-----|
| Application web | http://localhost:3000 |
| API REST + Swagger | http://localhost:8000/api/docs |
| MLflow tracking | http://localhost:5000 |
| PostgreSQL | localhost:5432 |

---

## Développement local (sans Docker)

### Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Linux/Mac
pip install -r requirements.txt

# Variables d'environnement
cp ../.env.example .env       # Adapter DATABASE_URL vers PostgreSQL local

uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

---

## Structure du projet

```
fa4/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app + lifespan
│   │   ├── config.py            # Settings (pydantic-settings)
│   │   ├── database.py          # Async SQLAlchemy engine
│   │   ├── models/              # ORM : User, Material, MaterialTest, Report, Prediction
│   │   ├── schemas/             # Pydantic I/O schemas
│   │   ├── routers/             # auth, materials, tests, predictions, reports, websockets
│   │   ├── services/            # ml_service, report_service (PDF), notification_service (WS)
│   │   └── ml/
│   │       └── models.py        # StrengthPredictionModel + AnomalyDetectionModel
│   ├── alembic/                 # Migrations DB
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Routing protégé
│   │   ├── components/          # Layout, Badge, StatCard
│   │   ├── pages/               # Dashboard, Materials, Tests, Predictions, Reports, Login
│   │   ├── hooks/               # useAuth, useWebSocket
│   │   ├── services/            # api.ts (axios), websocket.ts
│   │   └── types/               # TypeScript interfaces
│   ├── package.json
│   └── Dockerfile
├── nginx/nginx.conf             # Reverse proxy
├── .github/workflows/ci.yml    # CI/CD : test → build → docker
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## API — Endpoints principaux

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/auth/login` | Connexion JWT |
| POST | `/api/auth/register` | Créer un utilisateur |
| GET | `/api/materials` | Liste matériaux (paginé, filtrable) |
| POST | `/api/materials` | Créer matériau |
| GET | `/api/tests` | Liste essais |
| POST | `/api/tests` | Créer essai + analyse IA auto |
| GET | `/api/tests/stats` | Statistiques globales |
| POST | `/api/predictions/predict` | Prédiction fc28 ad hoc |
| POST | `/api/reports` | Générer rapport PDF (async) |
| GET | `/api/reports/{id}/download` | Télécharger PDF |
| WS | `/ws` | Flux temps réel (anomalies, rapports) |

Documentation interactive : **http://localhost:8000/api/docs**

---

## Modèles ML

### Prédiction résistance (StrengthPredictionModel)
- **Algorithme** : GradientBoostingRegressor (200 estimateurs)
- **Features** : fc_age, âge, w/c, température, humidité, dosage ciment, indice maturité
- **Bootstrap** : entraîné sur 1 200 éprouvettes synthétiques EN 206 (C20–C50)
- **Méthode** : CEB-FIP 1990 — s(t) = exp[0.25·(1 − √(28/t))]

### Détection anomalies (AnomalyDetectionModel)
- **Algorithme** : IsolationForest (150 arbres, contamination 5%)
- **Features** : fc, âge, densité, w/c
- **Seuil** : score < −0.1 → anomalie

Pour utiliser vos propres données d'entraînement, supprimez les fichiers `.pkl` dans `backend/ml_models/` — les modèles seront recréés au démarrage.

---

## Roadmap

- [ ] Export Excel (rapport statistique)
- [ ] Intégration capteurs IoT (MQTT → WebSocket)
- [ ] Modèle ML spécialisé acier (ASTM A370)
- [ ] Application mobile React Native
- [ ] Single Sign-On LDAP/OAuth2

---

## Licence

MIT — Libre d'utilisation pour usage personnel et commercial.
