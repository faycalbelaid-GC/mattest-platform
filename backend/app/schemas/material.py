from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID
from app.models.material import MaterialType


class MaterialCreate(BaseModel):
    name: str
    reference: str
    material_type: MaterialType
    description: Optional[str] = None
    supplier: Optional[str] = None
    batch_number: Optional[str] = None
    manufacturing_date: Optional[datetime] = None
    specifications: Dict[str, Any] = {}


class MaterialUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    supplier: Optional[str] = None
    batch_number: Optional[str] = None
    specifications: Optional[Dict[str, Any]] = None
    change_reason: Optional[str] = None


class MaterialOut(BaseModel):
    id: UUID
    name: str
    reference: str
    material_type: MaterialType
    description: Optional[str]
    supplier: Optional[str]
    batch_number: Optional[str]
    manufacturing_date: Optional[datetime]
    specifications: Dict[str, Any]
    version: int
    created_at: datetime

    model_config = {"from_attributes": True}


class MaterialListOut(BaseModel):
    items: list[MaterialOut]
    total: int
    page: int
    page_size: int
