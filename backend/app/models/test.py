from sqlalchemy import Column, String, Float, Text, Enum, DateTime, ForeignKey, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base


class TestStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    anomaly = "anomaly"
    rejected = "rejected"


class TestNorm(str, enum.Enum):
    en_12390 = "EN 12390"
    astm_c39 = "ASTM C39"
    iso_1920 = "ISO 1920"
    nf_en_206 = "NF EN 206"
    astm_a370 = "ASTM A370"
    other = "OTHER"


class MaterialTest(Base):
    __tablename__ = "material_tests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reference = Column(String(100), unique=True, nullable=False, index=True)
    material_id = Column(UUID(as_uuid=True), ForeignKey("materials.id"), nullable=False)
    test_norm = Column(Enum(TestNorm), default=TestNorm.en_12390)
    status = Column(Enum(TestStatus), default=TestStatus.pending)

    # Test parameters
    sample_id = Column(String(100))
    age_days = Column(Integer)               # curing age in days (7, 14, 28...)
    temperature_c = Column(Float)            # curing temperature
    humidity_pct = Column(Float)             # curing humidity
    water_cement_ratio = Column(Float)
    specimen_dimensions = Column(JSONB)      # {diameter_mm, height_mm, side_mm}

    # Results
    load_kn = Column(Float)                  # applied load kN
    area_mm2 = Column(Float)                 # cross-section area
    compressive_strength_mpa = Column(Float) # fc in MPa
    density_kg_m3 = Column(Float)
    raw_data = Column(JSONB, default={})     # additional sensor data

    # Anomaly detection
    is_anomaly = Column(Boolean, default=False)
    anomaly_score = Column(Float)
    anomaly_reason = Column(Text)

    # Prediction
    predicted_28d_mpa = Column(Float)
    prediction_confidence = Column(Float)

    # Metadata
    tested_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    notes = Column(Text)
    attachments = Column(ARRAY(String), default=[])

    material = relationship("Material", back_populates="tests")
    created_by_user = relationship("User", back_populates="tests", foreign_keys=[created_by])
    predictions = relationship("Prediction", back_populates="test")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50))
    entity_id = Column(String(100))
    details = Column(JSONB, default={})
    ip_address = Column(String(50))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="audit_logs")


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    test_id = Column(UUID(as_uuid=True), ForeignKey("material_tests.id"), nullable=False)
    model_name = Column(String(100))
    model_version = Column(String(50))
    input_features = Column(JSONB)
    predicted_value = Column(Float)
    target_age_days = Column(Integer, default=28)
    confidence_interval_lower = Column(Float)
    confidence_interval_upper = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    test = relationship("MaterialTest", back_populates="predictions")
