from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from uuid import uuid4
import uuid

from app.database import get_db
from app.models.material import Material, MaterialVersion
from app.models.user import User
from app.schemas.material import MaterialCreate, MaterialUpdate, MaterialOut, MaterialListOut
from app.routers.auth import get_current_user

router = APIRouter(prefix="/materials", tags=["materials"])


@router.get("", response_model=MaterialListOut)
async def list_materials(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str = Query(""),
    material_type: str = Query(""),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = select(Material)
    if search:
        q = q.where(or_(
            Material.name.ilike(f"%{search}%"),
            Material.reference.ilike(f"%{search}%"),
            Material.supplier.ilike(f"%{search}%"),
        ))
    if material_type:
        q = q.where(Material.material_type == material_type)

    total_result = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_result.scalar()

    q = q.offset((page - 1) * page_size).limit(page_size).order_by(Material.created_at.desc())
    result = await db.execute(q)
    items = result.scalars().all()

    return MaterialListOut(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=MaterialOut, status_code=201)
async def create_material(
    data: MaterialCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = await db.execute(select(Material).where(Material.reference == data.reference))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Référence '{data.reference}' déjà utilisée")

    material = Material(**data.model_dump(), created_by=current_user.id)
    db.add(material)
    await db.flush()
    return material


@router.get("/{material_id}", response_model=MaterialOut)
async def get_material(
    material_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Material).where(Material.id == material_id))
    material = result.scalar_one_or_none()
    if not material:
        raise HTTPException(status_code=404, detail="Matériau introuvable")
    return material


@router.put("/{material_id}", response_model=MaterialOut)
async def update_material(
    material_id: uuid.UUID,
    data: MaterialUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Material).where(Material.id == material_id))
    material = result.scalar_one_or_none()
    if not material:
        raise HTTPException(status_code=404, detail="Matériau introuvable")

    # Save version snapshot
    snapshot = {c.name: str(getattr(material, c.name)) for c in material.__table__.columns}
    version = MaterialVersion(
        material_id=material.id,
        version=material.version,
        data_snapshot=snapshot,
        changed_by=current_user.id,
        change_reason=data.change_reason,
    )
    db.add(version)

    update_data = data.model_dump(exclude_unset=True, exclude={"change_reason"})
    for key, val in update_data.items():
        setattr(material, key, val)
    material.version += 1
    await db.flush()
    return material


@router.delete("/{material_id}", status_code=204)
async def delete_material(
    material_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Material).where(Material.id == material_id))
    material = result.scalar_one_or_none()
    if not material:
        raise HTTPException(status_code=404, detail="Matériau introuvable")
    await db.delete(material)
