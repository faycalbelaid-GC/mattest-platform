from sqlalchemy import Column, String, Float, Text, Enum, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base


class MaterialType(str, enum.Enum):
    concrete = "concrete"
    steel = "steel"
    asphalt = "asphalt"
    soil = "soil"
    aggregate = "aggregate"
    cement = "cement"
    other = "other"


class Material(Base):
    __tablename__ = "materials"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    reference = Column(String(100), unique=True, nullable=False, index=True)
    material_type = Column(Enum(MaterialType), nullable=False)
    description = Column(Text)
    supplier = Column(String(200))
    batch_number = Column(String(100))
    manufacturing_date = Column(DateTime(timezone=True))
    specifications = Column(JSONB, default={})
    version = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    tests = relationship("MaterialTest", back_populates="material")
    versions = relationship("MaterialVersion", back_populates="material")


class MaterialVersion(Base):
    __tablename__ = "material_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    material_id = Column(UUID(as_uuid=True), ForeignKey("materials.id"), nullable=False)
    version = Column(Integer, nullable=False)
    data_snapshot = Column(JSONB, nullable=False)
    changed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    changed_at = Column(DateTime(timezone=True), server_default=func.now())
    change_reason = Column(Text)

    material = relationship("Material", back_populates="versions")
