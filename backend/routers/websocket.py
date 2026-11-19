from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from database import SessionLocal
from models import User
from utils.security import decode_access_token

router = APIRouter()


@router.websocket("/connect")
async def websocket_connect(websocket: WebSocket):
    """Authenticated WebSocket connection for future real-time features."""
    token = websocket.query_params.get("token")

    if not token:
        await websocket.close(code=1008, reason="Authentication required")
        return

    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        await websocket.close(code=1008, reason="Invalid or expired token")
        return

    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.id == payload["sub"]).first()

        if user is None or not user.is_active:
            await websocket.close(code=1008, reason="User not found or inactive")
            return

        await websocket.accept()
        await websocket.send_json({
            "type": "connected",
            "user_id": user.id,
            "message": "PLINTH WebSocket connected",
        })

        # Keep the connection alive; application events can be added later.
        while True:
            message = await websocket.receive_text()
            await websocket.send_json({
                "type": "ack",
                "message": message,
            })

    except WebSocketDisconnect:
        pass
    finally:
        db.close()
