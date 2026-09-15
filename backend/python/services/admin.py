from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from services.model_manager import tracker

router = APIRouter(prefix="/admin", tags=["Admin Panel"])


@router.get("/status")
async def status():
    """Zwraca aktualny status obu modeli (cf, cb)."""
    models = {}
    for key in ("cf", "cb"):
        models[key] = tracker.snapshot(key)
    return models


@router.get("/model/{model}")
async def model(model: str):
    """Zwraca stan pojedynczego modelu (cf lub cb)."""
    if model not in ("cf", "cb"):
        raise HTTPException(status_code=400, detail=f"Nieznany model: {model}")
    return tracker.snapshot(model)


@router.websocket("/ws")
async def admin_ws(websocket: WebSocket):
    """WebSocket do live streamowania postępu modeli."""
    await websocket.accept()
    try:
        while True:
            for model_key in ("cf", "cb"):
                for event in tracker.models[model_key]["events"]:
                    await websocket.send_json({"type": "event", "model": model_key, **event})
                for log in tracker.models[model_key]["logs"]:
                    await websocket.send_json({"type": "log", "model": model_key, **log})
            await websocket.send_json({"type": "ping"})
    except WebSocketDisconnect:
        print("Połączenie WebSocket panelu admina rozłączone.")
    except Exception as e:
        print(f"Błąd w WebSocket panelu admina: {e}")
