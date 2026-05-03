import uuid
import random
import string
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from typing import Optional

from app.database import get_db
from app.models.test import MaterialTest, TestStatus, Prediction
from app.models.user import User
from app.schemas.test import TestCreate, TestUpdate, TestOut, TestListOut, TestStats
from app.routers.auth import get_current_user
from app.services import ml_service, notification_service

router = APIRouter(prefix="/tests", tags=["tests"])


def _gen_reference() -> str:
    return "TST-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))


async def _run_ml_analysis(test: MaterialTest, db: AsyncSession):
    """Background task: run anomaly detection + strength prediction."""
    if not test.compressive_strength_mpa or not test.age_days:
        return

    # Anomaly detection
    anomaly = await ml_service.detect_anomaly(
        compressive_strength_mpa=test.compressive_strength_mpa,
        age_days=test.age_days,
        density_kg_m3=test.density_kg_m3 or 2350.0,
        water_cement_ratio=test.water_cement_ratio or 0.45,
    )
    test.is_anomaly = anomaly.is_anomaly
    test.anomaly_score = anomaly.anomaly_score
    test.anomaly_reason = anomaly.reason

    # Strength prediction
    from app.schemas.prediction import PredictionRequest
    req = PredictionRequest(
        age_days=test.age_days,
        compressive_strength_mpa=test.compressive_strength_mpa,
        water_cement_ratio=test.water_cement_ratio,
        temperature_c=test.temperature_c,
        humidity_pct=test.humidity_pct,
    )
    pred_result = await ml_service.predict_strength(req)
    test.predicted_28d_mpa = pred_result.predicted_28d_mpa
    test.prediction_confidence = pred_result.confidence_pct

    # Save prediction record
    pred = Prediction(
        test_id=test.id,
        model_name=pred_result.model_name,
        model_version=pred_result.model_version,
        input_features=pred_result.input_features,
        predicted_value=pred_result.predicted_28d_mpa,
        target_age_days=28,
        confidence_interval_lower=pred_result.confidence_interval_lower,
        confidence_interval_upper=pred_result.confidence_interval_upper,
    )
    db.add(pred)
    await db.commit()

    # Notifications
    if anomaly.is_anomaly:
        await notification_service.notify_anomaly(
            test_reference=test.reference,
            material_name=str(test.material_id),
            fc=test.compressive_strength_mpa,
            reason=anomaly.reason or "",
        )
    else:
        await notification_service.notify_test_completed(
            test_reference=test.reference,
            fc=test.compressive_strength_mpa,
            predicted_28d=test.predicted_28d_mpa,
        )


@router.get("", response_model=TestListOut)
async def list_tests(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    material_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    is_anomaly: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = select(MaterialTest).options(selectinload(MaterialTest.predictions))
    filters = []
    if material_id:
        filters.append(MaterialTest.material_id == material_id)
    if status:
        filters.append(MaterialTest.status == status)
    if is_anomaly is not None:
        filters.append(MaterialTest.is_anomaly == is_anomaly)
    if filters:
        q = q.where(and_(*filters))

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    q = q.offset((page - 1) * page_size).limit(page_size).order_by(MaterialTest.created_at.desc())
    result = await db.execute(q)
    items = result.scalars().all()

    return TestListOut(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=TestOut, status_code=201)
async def create_test(
    data: TestCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    test = MaterialTest(
        reference=_gen_reference(),
        created_by=current_user.id,
        **data.model_dump(),
    )
    if test.compressive_strength_mpa:
        test.status = TestStatus.completed
    db.add(test)
    await db.flush()

    if test.compressive_strength_mpa and test.age_days:
        background_tasks.add_task(_run_ml_analysis, test, db)

    return test


@router.get("/stats", response_model=TestStats)
async def get_stats(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    total = (await db.execute(select(func.count(MaterialTest.id)))).scalar()
    completed = (await db.execute(
        select(func.count(MaterialTest.id)).where(MaterialTest.status == TestStatus.completed)
    )).scalar()
    anomalies = (await db.execute(
        select(func.count(MaterialTest.id)).where(MaterialTest.is_anomaly == True)
    )).scalar()
    agg = (await db.execute(
        select(
            func.avg(MaterialTest.compressive_strength_mpa),
            func.min(MaterialTest.compressive_strength_mpa),
            func.max(MaterialTest.compressive_strength_mpa),
            func.stddev(MaterialTest.compressive_strength_mpa),
        ).where(MaterialTest.compressive_strength_mpa.isnot(None))
    )).one()

    conformity = None
    if agg[0] and agg[3]:
        fck = agg[0] - 1.645 * agg[3]
        conformity = round(100.0 * max(0, fck) / agg[0], 1) if agg[0] else None

    return TestStats(
        total_tests=total,
        completed_tests=completed,
        anomaly_count=anomalies,
        avg_strength_mpa=round(agg[0], 2) if agg[0] else None,
        min_strength_mpa=round(agg[1], 2) if agg[1] else None,
        max_strength_mpa=round(agg[2], 2) if agg[2] else None,
        std_strength_mpa=round(agg[3], 2) if agg[3] else None,
        conformity_rate=conformity,
    )


@router.get("/{test_id}", response_model=TestOut)
async def get_test(
    test_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(MaterialTest).options(selectinload(MaterialTest.predictions))
        .where(MaterialTest.id == test_id)
    )
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=404, detail="Essai introuvable")
    return test


@router.put("/{test_id}", response_model=TestOut)
async def update_test(
    test_id: uuid.UUID,
    data: TestUpdate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(MaterialTest).where(MaterialTest.id == test_id))
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=404, detail="Essai introuvable")

    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(test, key, val)

    if data.compressive_strength_mpa and test.age_days:
        background_tasks.add_task(_run_ml_analysis, test, db)

    await db.flush()
    return test
