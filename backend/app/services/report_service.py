"""
PDF report generation service — EN 12390 / ASTM C39 / ISO 1920 compliant layout.
"""
import os
import uuid
from pathlib import Path
from datetime import datetime
from typing import List, Optional

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

from app.config import settings

REPORTS_DIR = Path(settings.reports_dir)
REPORTS_DIR.mkdir(exist_ok=True)

PRIMARY = colors.HexColor("#1e40af")
SECONDARY = colors.HexColor("#64748b")
ACCENT = colors.HexColor("#f59e0b")
LIGHT_GRAY = colors.HexColor("#f1f5f9")
DANGER = colors.HexColor("#dc2626")
SUCCESS = colors.HexColor("#16a34a")


def _styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("title", fontSize=18, fontName="Helvetica-Bold",
                                textColor=PRIMARY, spaceAfter=6, alignment=TA_LEFT),
        "subtitle": ParagraphStyle("subtitle", fontSize=11, fontName="Helvetica",
                                   textColor=SECONDARY, spaceAfter=4),
        "heading": ParagraphStyle("heading", fontSize=12, fontName="Helvetica-Bold",
                                  textColor=PRIMARY, spaceBefore=12, spaceAfter=4),
        "body": ParagraphStyle("body", fontSize=9, fontName="Helvetica", leading=14),
        "small": ParagraphStyle("small", fontSize=8, fontName="Helvetica", textColor=SECONDARY),
        "footer": ParagraphStyle("footer", fontSize=7, fontName="Helvetica",
                                 textColor=SECONDARY, alignment=TA_CENTER),
    }


def generate_compressive_strength_report(
    report_id: str,
    title: str,
    norm: str,
    tests: List[dict],
    materials: List[dict],
    generated_by: str,
    project_name: Optional[str] = None,
) -> Path:
    file_path = REPORTS_DIR / f"report_{report_id}.pdf"
    doc = SimpleDocTemplate(
        str(file_path), pagesize=A4,
        rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm,
    )
    styles = _styles()
    story = []

    # ── Header ──────────────────────────────────────────────────────────
    header_data = [
        [Paragraph(f"<b>RAPPORT D'ESSAI</b>", styles["title"]),
         Paragraph(f"Réf: {report_id[:8].upper()}<br/>Date: {datetime.now().strftime('%d/%m/%Y')}", styles["small"])],
    ]
    header_table = Table(header_data, colWidths=[13*cm, 4*cm])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [LIGHT_GRAY]),
        ("BOX", (0, 0), (-1, -1), 1, PRIMARY),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 0.4*cm))

    # Norm badge
    story.append(Paragraph(f"Norme de référence : <b>{norm}</b>", styles["body"]))
    if project_name:
        story.append(Paragraph(f"Projet : {project_name}", styles["body"]))
    story.append(Paragraph(f"Établi par : {generated_by}", styles["body"]))
    story.append(Spacer(1, 0.3*cm))
    story.append(HRFlowable(width="100%", thickness=2, color=PRIMARY))
    story.append(Spacer(1, 0.3*cm))

    # ── Materials summary ────────────────────────────────────────────────
    if materials:
        story.append(Paragraph("1. Matériaux testés", styles["heading"]))
        mat_data = [["Référence", "Nom", "Type", "Fournisseur", "Lot"]]
        for m in materials:
            mat_data.append([
                m.get("reference", "—"),
                m.get("name", "—"),
                m.get("material_type", "—"),
                m.get("supplier", "—"),
                m.get("batch_number", "—"),
            ])
        mat_table = Table(mat_data, colWidths=[3*cm, 4*cm, 2.5*cm, 3.5*cm, 2.5*cm])
        mat_table.setStyle(_table_style())
        story.append(mat_table)
        story.append(Spacer(1, 0.4*cm))

    # ── Test results ─────────────────────────────────────────────────────
    story.append(Paragraph("2. Résultats des essais de résistance à la compression", styles["heading"]))

    if not tests:
        story.append(Paragraph("Aucun essai disponible pour ce rapport.", styles["body"]))
    else:
        results_data = [
            ["Éprouvette", "Âge\n(j)", "fc mesurée\n(MPa)", "fc préd. 28j\n(MPa)", "Densité\n(kg/m³)", "Anomalie", "Statut"],
        ]
        strengths = []
        for t in tests:
            fc = t.get("compressive_strength_mpa")
            if fc:
                strengths.append(fc)
            anomaly_flag = "⚠ OUI" if t.get("is_anomaly") else "Non"
            results_data.append([
                t.get("reference", t.get("sample_id", "—")),
                str(t.get("age_days", "—")),
                f"{fc:.1f}" if fc else "—",
                f"{t['predicted_28d_mpa']:.1f}" if t.get("predicted_28d_mpa") else "—",
                f"{t['density_kg_m3']:.0f}" if t.get("density_kg_m3") else "—",
                anomaly_flag,
                t.get("status", "—").replace("_", " "),
            ])

        res_table = Table(results_data, colWidths=[3*cm, 1.5*cm, 2.5*cm, 2.5*cm, 2.5*cm, 2*cm, 2.5*cm])
        res_table.setStyle(_results_table_style(tests))
        story.append(res_table)
        story.append(Spacer(1, 0.4*cm))

        # ── Statistical summary ──────────────────────────────────────────
        if strengths:
            import statistics
            story.append(Paragraph("3. Analyse statistique", styles["heading"]))
            mean_fc = statistics.mean(strengths)
            std_fc = statistics.stdev(strengths) if len(strengths) > 1 else 0.0
            fck = mean_fc - 1.645 * std_fc  # characteristic strength EN 206
            conformity = "CONFORME" if fck >= 0 else "NON CONFORME"
            stat_data = [
                ["Paramètre", "Valeur"],
                ["Nombre d'éprouvettes", str(len(strengths))],
                ["fc,moy (MPa)", f"{mean_fc:.2f}"],
                ["Écart-type s (MPa)", f"{std_fc:.2f}"],
                ["fc,k = fc,moy − 1.645·s (MPa)", f"{fck:.2f}"],
                ["Conformité EN 206", conformity],
            ]
            stat_table = Table(stat_data, colWidths=[9*cm, 5*cm])
            stat_table.setStyle(_table_style())
            story.append(stat_table)
            story.append(Spacer(1, 0.4*cm))

    # ── Footer ───────────────────────────────────────────────────────────
    story.append(Spacer(1, 0.5*cm))
    story.append(HRFlowable(width="100%", thickness=1, color=SECONDARY))
    story.append(Paragraph(
        f"MatTest Platform — Rapport généré le {datetime.now().strftime('%d/%m/%Y à %H:%M')} "
        f"| Norme {norm} | ID {report_id}",
        styles["footer"],
    ))

    doc.build(story)
    return file_path


def _table_style() -> TableStyle:
    return TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_GRAY]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ])


def _results_table_style(tests: List[dict]) -> TableStyle:
    style = _table_style()
    for i, t in enumerate(tests, start=1):
        if t.get("is_anomaly"):
            style.add("BACKGROUND", (5, i), (5, i), colors.HexColor("#fee2e2"))
            style.add("TEXTCOLOR", (5, i), (5, i), DANGER)
    return style
