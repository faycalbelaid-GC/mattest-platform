"""
ML models for compressive strength prediction and anomaly detection.

Maturity method (Nurse-Saul): M = Σ(T - T0) * Δt
Strength-maturity relation: fc(M) = fc_∞ * M / (k + M)
"""
import numpy as np
import joblib
import os
from pathlib import Path
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import IsolationForest
from sklearn.pipeline import Pipeline
from sklearn.model_selection import cross_val_score
from datetime import datetime
from typing import Optional, Tuple, Dict, Any


MODELS_DIR = Path(os.getenv("ML_MODELS_DIR", "./ml_models"))
MODELS_DIR.mkdir(exist_ok=True)

T0_DATUM = -10.0  # datum temperature °C for Nurse-Saul


def maturity_index(age_days: float, temperature_c: float, humidity_pct: float = 95.0) -> float:
    """Nurse-Saul temperature-time factor (°C·h)."""
    return (temperature_c - T0_DATUM) * age_days * 24.0


def theoretical_28d_from_age(fc_age: float, age_days: int) -> float:
    """CEB-FIP maturity correction: fc28 = fc_t / s(t) where s(t) = exp(0.25*(1-sqrt(28/t)))."""
    if age_days <= 0:
        return fc_age
    s_t = np.exp(0.25 * (1.0 - np.sqrt(28.0 / age_days)))
    return fc_age / s_t if s_t > 0 else fc_age


class StrengthPredictionModel:
    """Predicts compressive strength at 28 days from early-age measurements."""

    MODEL_FILE = MODELS_DIR / "strength_predictor.pkl"
    SCALER_FILE = MODELS_DIR / "strength_scaler.pkl"

    def __init__(self):
        self.model: Optional[GradientBoostingRegressor] = None
        self.scaler: Optional[StandardScaler] = None
        self.version = "1.0.0"
        self.r2_score: Optional[float] = None
        self.rmse: Optional[float] = None
        self._load_or_init()

    def _load_or_init(self):
        if self.MODEL_FILE.exists() and self.SCALER_FILE.exists():
            self.model = joblib.load(self.MODEL_FILE)
            self.scaler = joblib.load(self.SCALER_FILE)
        else:
            self._train_on_synthetic_data()

    def _train_on_synthetic_data(self):
        """Bootstrap model with realistic synthetic concrete data (EN 206)."""
        np.random.seed(42)
        n = 1200

        # Simulate concrete classes C20 to C50
        fc28_target = np.random.uniform(20, 55, n)
        age = np.random.choice([3, 7, 14, 28], n)
        wc_ratio = 0.65 - (fc28_target - 20) / 100
        temperature = np.random.normal(20, 3, n)
        humidity = np.random.uniform(80, 100, n)
        cement_content = 300 + (fc28_target - 20) * 5

        # CEB-FIP strength development
        s_t = np.exp(0.25 * (1.0 - np.sqrt(28.0 / age)))
        fc_age = fc28_target * s_t + np.random.normal(0, 1.5, n)
        fc_age = np.clip(fc_age, 5, 60)

        mi = (temperature - T0_DATUM) * age * 24.0

        X = np.column_stack([fc_age, age, wc_ratio, temperature, humidity, cement_content, mi])
        y = fc28_target

        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)

        self.model = GradientBoostingRegressor(
            n_estimators=200, max_depth=4, learning_rate=0.05,
            subsample=0.8, random_state=42
        )
        self.model.fit(X_scaled, y)

        scores = cross_val_score(self.model, X_scaled, y, cv=5, scoring="r2")
        self.r2_score = float(scores.mean())
        mse_scores = cross_val_score(self.model, X_scaled, y, cv=5, scoring="neg_mean_squared_error")
        self.rmse = float(np.sqrt(-mse_scores.mean()))

        joblib.dump(self.model, self.MODEL_FILE)
        joblib.dump(self.scaler, self.SCALER_FILE)

    def predict(
        self,
        fc_age: float,
        age_days: int,
        water_cement_ratio: float = 0.45,
        temperature_c: float = 20.0,
        humidity_pct: float = 95.0,
        cement_content_kg_m3: float = 350.0,
    ) -> Tuple[float, float, float]:
        """Returns (predicted_fc28, ci_lower, ci_upper) in MPa."""
        mi = maturity_index(age_days, temperature_c, humidity_pct)
        X = np.array([[fc_age, age_days, water_cement_ratio, temperature_c, humidity_pct, cement_content_kg_m3, mi]])
        X_scaled = self.scaler.transform(X)

        pred = float(self.model.predict(X_scaled)[0])

        # Confidence interval using staged predictions variance
        preds_per_stage = np.array([
            est.predict(X_scaled)[0]
            for est in self.model.estimators_[-20:]
        ])
        std = float(np.std(preds_per_stage)) * 2.5
        ci_lower = max(0, pred - 1.96 * std)
        ci_upper = pred + 1.96 * std

        return round(pred, 2), round(ci_lower, 2), round(ci_upper, 2)

    def get_info(self) -> Dict[str, Any]:
        return {
            "name": "GradientBoostingRegressor",
            "version": self.version,
            "algorithm": "Gradient Boosting (CEB-FIP features)",
            "r2_score": self.r2_score,
            "rmse": self.rmse,
            "features": ["fc_age", "age_days", "w/c", "temperature", "humidity", "cement_content", "maturity_index"],
        }


class AnomalyDetectionModel:
    """Detects outliers in compressive strength measurements using Isolation Forest."""

    MODEL_FILE = MODELS_DIR / "anomaly_detector.pkl"
    CONTAMINATION = 0.05  # expected 5% anomaly rate

    def __init__(self):
        self.model: Optional[IsolationForest] = None
        self.scaler: Optional[StandardScaler] = None
        self._load_or_init()

    def _load_or_init(self):
        if self.MODEL_FILE.exists():
            data = joblib.load(self.MODEL_FILE)
            self.model = data["model"]
            self.scaler = data["scaler"]
        else:
            self._train_on_synthetic_data()

    def _train_on_synthetic_data(self):
        np.random.seed(0)
        n = 1000
        fc = np.random.normal(35, 5, n)
        age = np.random.choice([3, 7, 14, 28], n)
        density = np.random.normal(2350, 50, n)
        wc = np.random.normal(0.45, 0.05, n)

        X = np.column_stack([fc, age, density, wc])
        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)

        self.model = IsolationForest(
            n_estimators=150, contamination=self.CONTAMINATION,
            max_samples="auto", random_state=42
        )
        self.model.fit(X_scaled)
        joblib.dump({"model": self.model, "scaler": self.scaler}, self.MODEL_FILE)

    def predict(
        self,
        compressive_strength_mpa: float,
        age_days: int,
        density_kg_m3: float = 2350.0,
        water_cement_ratio: float = 0.45,
    ) -> Tuple[bool, float, str]:
        """Returns (is_anomaly, score, reason)."""
        X = np.array([[compressive_strength_mpa, age_days, density_kg_m3, water_cement_ratio]])
        X_scaled = self.scaler.transform(X)

        raw_score = float(self.model.decision_function(X_scaled)[0])
        prediction = self.model.predict(X_scaled)[0]
        is_anomaly = prediction == -1

        reason = ""
        if is_anomaly:
            if compressive_strength_mpa < 10:
                reason = "Résistance anormalement faible (< 10 MPa)"
            elif compressive_strength_mpa > 80:
                reason = "Résistance anormalement élevée (> 80 MPa)"
            elif density_kg_m3 < 2000:
                reason = "Densité anormalement faible (< 2000 kg/m³)"
            else:
                reason = "Combinaison atypique des paramètres (détectée par Isolation Forest)"

        return is_anomaly, round(float(raw_score), 4), reason


# Singleton instances — loaded once at startup
_strength_model: Optional[StrengthPredictionModel] = None
_anomaly_model: Optional[AnomalyDetectionModel] = None


def get_strength_model() -> StrengthPredictionModel:
    global _strength_model
    if _strength_model is None:
        _strength_model = StrengthPredictionModel()
    return _strength_model


def get_anomaly_model() -> AnomalyDetectionModel:
    global _anomaly_model
    if _anomaly_model is None:
        _anomaly_model = AnomalyDetectionModel()
    return _anomaly_model
