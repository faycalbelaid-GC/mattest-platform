"""WebSocket connection manager + broadcast helpers."""
import json
from typing import Dict, Set
from fastapi import WebSocket
from datetime import datetime


class ConnectionManager:
    def __init__(self):
        self.active: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room: str = "global"):
        await websocket.accept()
        self.active.setdefault(room, set()).add(websocket)

    def disconnect(self, websocket: WebSocket, room: str = "global"):
        if room in self.active:
            self.active[room].discard(websocket)

    async def broadcast(self, message: dict, room: str = "global"):
        payload = json.dumps({**message, "timestamp": datetime.utcnow().isoformat()})
        dead = set()
        for ws in list(self.active.get(room, [])):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.active[room].discard(ws)

    async def broadcast_all(self, message: dict):
        for room in list(self.active.keys()):
            await self.broadcast(message, room)


manager = ConnectionManager()


async def notify_anomaly(test_reference: str, material_name: str, fc: float, reason: str):
    await manager.broadcast_all({
        "type": "anomaly_detected",
        "test_reference": test_reference,
        "material_name": material_name,
        "fc_mpa": fc,
        "reason": reason,
        "severity": "high",
    })


async def notify_test_completed(test_reference: str, fc: float, predicted_28d: float | None):
    await manager.broadcast_all({
        "type": "test_completed",
        "test_reference": test_reference,
        "fc_mpa": fc,
        "predicted_28d_mpa": predicted_28d,
    })


async def notify_report_ready(report_id: str, title: str):
    await manager.broadcast_all({
        "type": "report_ready",
        "report_id": report_id,
        "title": title,
    })
