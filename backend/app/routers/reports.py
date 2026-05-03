import uuid
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pathlib import Path

from app.database import get_db
from app.models.report import Report, ReportStatus
from app.models.test import MaterialTest
from app.models.material import Material
from app.models.user import User
from app.schemas.report import ReportCreate, ReportOut
from app.routers.auth import get_current_user
from app.services.report_service import generate_compressive_strength_report, REPORTS_DIR
from app.services.notification_service import notify_report_ready

router = APIRouter(prefix="/reports", tags=["reports"])


async def _generate_report_bg(report_id: str, db: AsyncSession):
    result = await db.execute(select(Report).where(Report.id == uuid.UUID(report_id)))
    report = result.scalar_one_or_none()
    if not report:
        return

    try:
        report.status = ReportStatus.generating
        await db.commit()

        # Load tests
        tests_data = []
        for tid in report.test_ids:
            tr = await db.execute(select(MaterialTest).where(MaterialTest.id == uuid.UUID(tid)))
            t = tr.scalar_one_or_none()
            if t:
                tests_data.append({
                    "reference": t.reference,
                    "sample_id": t.sample_id,
                    "age_days": t.age_days,
                    "compressive_strength_mpa": t.compressive_strength_mpa,
                    "predicted_28d_mpa": t.predicted_28d_mpa,
                    "density_kg_m3": t.density_kg_m3,
                    "is_anomaly": t.is_anomaly,
                    "status": t.status.value if t.status else "unknown",
                })

        # Load materials
        materials_data = []
        for mid in report.material_ids:
            mr = await db.execute(select(Material).where(Material.id == uuid.UUID(mid)))
            m = mr.scalar_one_or_none()
            if m:
                materials_data.append({
                    "reference": m.reference,
                    "name": m.name,
                    "material_type": m.material_type.value if m.material_type else "",
                    "supplier": m.supplier,
                    "batch_number": m.batch_number,
                })

        # Get generator name
        generator_name = "Système"
        if report.generated_by:
            ur = await db.execute(select(User).where(User.id == report.generated_by))
            u = ur.scalar_one_or_none()
            if u:
                generator_name = u.full_name

        file_path = generate_compressive_strength_report(
            report_id=report_id,
            title=report.title,
            norm=report.norm or "EN 12390",
            tests=tests_data,
            materials=materials_data,
            generated_by=generator_name,
            project_name=report.metadata.get("project_name") if report.metadata else None,
        )

        from datetime import datetime
        report.status = ReportStatus.ready
        report.file_path = str(file_path)
        report.file_size_bytes = file_path.stat().st_size
        report.completed_at = datetime.utcnow()
        await db.commit()
        await notify_report_ready(report_id=report_id, title=report.title)

    except Exception as e:
        report.status = ReportStatus.failed
        report.error_message = str(e)
        await db.commit()


@router.post("", response_model=ReportOut, status_code=201)
async def create_report(
    data: ReportCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = Report(
        title=data.title,
        report_type=data.report_type,
        norm=data.norm,
        format=data.format,
        test_ids=data.test_ids,
        material_ids=data.material_ids,
        metadata=data.metadata,
        generated_by=current_user.id,
    )
    db.add(report)
    await db.flush()
    background_tasks.add_task(_generate_report_bg, str(report.id), db)
    return report


@router.get("", response_model=list[ReportOut])
async def list_reports(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(Report).order_by(Report.created_at.desc()).limit(50))
    return result.scalars().all()


@router.get("/{report_id}", response_model=ReportOut)
async def get_report(report_id: uuid.UUID, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Rapport introuvable")
    return report


@router.get("/{report_id}/download")
async def download_report(report_id: uuid.UUID, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Rapport introuvable")
    if report.status != ReportStatus.ready or not report.file_path:
        raise HTTPException(status_code=400, detail="Rapport non disponible")
    path = Path(report.file_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Fichier introuvable sur le serveur")
    return FileResponse(path, media_type="application/pdf", filename=f"{report.title}.pdf")
