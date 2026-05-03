from fastapi import APIRouter, Depends
from app.schemas.prediction import PredictionRequest, PredictionResponse, ModelInfo
from app.services import ml_service
from app.ml.models import get_strength_model, get_anomaly_model
from app.routers.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/predictions", tags=["predictions"])


@router.post("/predict", response_model=PredictionResponse)
async def predict_strength(
    req: PredictionRequest,
    _: User = Depends(get_current_user),
):
    return await ml_service.predict_strength(req)


@router.get("/model-info", response_model=ModelInfo)
async def model_info(_: User = Depends(get_current_user)):
    model = get_strength_model()
    info = model.get_info()
    return ModelInfo(
        name=info["name"],
        version=model.version,
        algorithm=info["algorithm"],
        r2_score=info.get("r2_score"),
        rmse=info.get("rmse"),
        trained_at=None,
        n_samples=1200,
    )
