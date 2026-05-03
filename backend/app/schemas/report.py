from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID
from app.models.report import ReportStatus, ReportFormat


class ReportCreate(BaseModel):
    title: str
    report_type: str = "compressive_strength"
    norm: str = "EN 12390"
    format: ReportFormat = ReportFormat.pdf
    test_ids: List[str] = []
    material_ids: List[str] = []
    metadata: Dict[str, Any] = {}


class ReportOut(BaseModel):
    id: UUID
    title: str
    report_type: Optional[str]
    norm: Optional[str]
    status: ReportStatus
    format: ReportFormat
    test_ids: List[str]
    material_ids: List[str]
    file_size_bytes: Optional[int]
    created_at: datetime
    completed_at: Optional[datetime]
    error_message: Optional[str]

    model_config = {"from_attributes": True}
