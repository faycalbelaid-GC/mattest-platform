from pydantic import BaseModel
from typing import Optional, Dict, Any


class PredictionRequest(BaseModel):
    age_days: int
    compressive_strength_mpa: float
    water_cement_ratio: Optional[float] = None
    temperature_c: Optional[float] = 20.0
    humidity_pct: Optional[float] = 95.0
    cement_content_kg_m3: Optional[float] = None


class PredictionResponse(BaseModel):
    predicted_28d_mpa: float
    confidence_interval_lower: float
    confidence_interval_upper: float
    confidence_pct: float
    model_name: str
    model_version: str
    maturity_index: Optional[float] = None
    input_features: Dict[str, Any]


class AnomalyResult(BaseModel):
    is_anomaly: bool
    anomaly_score: float
    threshold: float
    reason: Optional[str] = None


class BatchPredictionRequest(BaseModel):
    test_ids: list[str]


class ModelInfo(BaseModel):
    name: str
    version: str
    algorithm: str
    r2_score: Optional[float]
    rmse: Optional[float]
    trained_at: Optional[str]
    n_samples: Optional[int]
