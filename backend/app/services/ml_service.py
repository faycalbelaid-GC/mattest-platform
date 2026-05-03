from app.ml.models import get_strength_model, get_anomaly_model
from app.schemas.prediction import PredictionRequest, PredictionResponse, AnomalyResult


async def predict_strength(req: PredictionRequest) -> PredictionResponse:
    model = get_strength_model()
    pred, ci_low, ci_high = model.predict(
        fc_age=req.compressive_strength_mpa,
        age_days=req.age_days,
        water_cement_ratio=req.water_cement_ratio or 0.45,
        temperature_c=req.temperature_c or 20.0,
        humidity_pct=req.humidity_pct or 95.0,
        cement_content_kg_m3=req.cement_content_kg_m3 or 350.0,
    )
    info = model.get_info()
    ci_width = ci_high - ci_low
    confidence_pct = max(0.0, min(100.0, 100.0 * (1.0 - ci_width / max(pred, 1.0))))

    return PredictionResponse(
        predicted_28d_mpa=pred,
        confidence_interval_lower=ci_low,
        confidence_interval_upper=ci_high,
        confidence_pct=round(confidence_pct, 1),
        model_name=info["name"],
        model_version=model.version,
        input_features={
            "fc_age_mpa": req.compressive_strength_mpa,
            "age_days": req.age_days,
            "water_cement_ratio": req.water_cement_ratio,
            "temperature_c": req.temperature_c,
            "humidity_pct": req.humidity_pct,
        },
    )


async def detect_anomaly(
    compressive_strength_mpa: float,
    age_days: int,
    density_kg_m3: float = 2350.0,
    water_cement_ratio: float = 0.45,
) -> AnomalyResult:
    model = get_anomaly_model()
    is_anomaly, score, reason = model.predict(
        compressive_strength_mpa=compressive_strength_mpa,
        age_days=age_days,
        density_kg_m3=density_kg_m3,
        water_cement_ratio=water_cement_ratio,
    )
    return AnomalyResult(
        is_anomaly=is_anomaly,
        anomaly_score=score,
        threshold=-0.1,
        reason=reason if is_anomaly else None,
    )
