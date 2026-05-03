from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime
from uuid import UUID
from app.models.test import TestStatus, TestNorm


class SpecimenDimensions(BaseModel):
    diameter_mm: Optional[float] = None
    height_mm: Optional[float] = None
    side_mm: Optional[float] = None


class TestCreate(BaseModel):
    material_id: UUID
    test_norm: TestNorm = TestNorm.en_12390
    sample_id: Optional[str] = None
    age_days: Optional[int] = None
    temperature_c: Optional[float] = None
    humidity_pct: Optional[float] = None
    water_cement_ratio: Optional[float] = None
    specimen_dimensions: Optional[Dict[str, Any]] = None
    load_kn: Optional[float] = None
    area_mm2: Optional[float] = None
    compressive_strength_mpa: Optional[float] = None
    density_kg_m3: Optional[float] = None
    tested_at: Optional[datetime] = None
    notes: Optional[str] = None
    raw_data: Dict[str, Any] = {}


class TestUpdate(BaseModel):
    status: Optional[TestStatus] = None
    compressive_strength_mpa: Optional[float] = None
    load_kn: Optional[float] = None
    density_kg_m3: Optional[float] = None
    notes: Optional[str] = None
    raw_data: Optional[Dict[str, Any]] = None


class PredictionOut(BaseModel):
    id: UUID
    model_name: Optional[str]
    model_version: Optional[str]
    predicted_value: float
    target_age_days: int
    confidence_interval_lower: Optional[float]
    confidence_interval_upper: Optional[float]
    created_at: datetime

    model_config = {"from_attributes": True}


class TestOut(BaseModel):
    id: UUID
    reference: str
    material_id: UUID
    test_norm: TestNorm
    status: TestStatus
    sample_id: Optional[str]
    age_days: Optional[int]
    temperature_c: Optional[float]
    humidity_pct: Optional[float]
    water_cement_ratio: Optional[float]
    specimen_dimensions: Optional[Dict[str, Any]]
    load_kn: Optional[float]
    area_mm2: Optional[float]
    compressive_strength_mpa: Optional[float]
    density_kg_m3: Optional[float]
    is_anomaly: bool
    anomaly_score: Optional[float]
    anomaly_reason: Optional[str]
    predicted_28d_mpa: Optional[float]
    prediction_confidence: Optional[float]
    tested_at: Optional[datetime]
    created_at: datetime
    notes: Optional[str]
    predictions: List[PredictionOut] = []

    model_config = {"from_attributes": True}


class TestListOut(BaseModel):
    items: list[TestOut]
    total: int
    page: int
    page_size: int


class TestStats(BaseModel):
    total_tests: int
    completed_tests: int
    anomaly_count: int
    avg_strength_mpa: Optional[float]
    min_strength_mpa: Optional[float]
    max_strength_mpa: Optional[float]
    std_strength_mpa: Optional[float]
    conformity_rate: Optional[float]
