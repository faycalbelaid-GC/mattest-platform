from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.services.notification_service import manager

router = APIRouter(tags=["websockets"])


@router.websocket("/ws")
async def websocket_global(websocket: WebSocket):
    await manager.connect(websocket, room="global")
    try:
        while True:
            data = await websocket.receive_text()
            # Echo ping/pong
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket, room="global")


@router.websocket("/ws/{room}")
async def websocket_room(websocket: WebSocket, room: str):
    await manager.connect(websocket, room=room)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, room=room)
