from sqlalchemy import Column, String, Text, Enum, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base


class ReportStatus(str, enum.Enum):
    pending = "pending"
    generating = "generating"
    ready = "ready"
    failed = "failed"


class ReportFormat(str, enum.Enum):
    pdf = "pdf"
    excel = "excel"
    json = "json"


class Report(Base):
    __tablename__ = "reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(300), nullable=False)
    report_type = Column(String(100))
    norm = Column(String(100))
    status = Column(Enum(ReportStatus), default=ReportStatus.pending)
    format = Column(Enum(ReportFormat), default=ReportFormat.pdf)
    test_ids = Column(ARRAY(String), default=[])
    material_ids = Column(ARRAY(String), default=[])
    file_path = Column(String(500))
    file_size_bytes = Column(Integer)
    metadata = Column(JSONB, default={})
    generated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
    error_message = Column(Text)

    generator = relationship("User", foreign_keys=[generated_by])
