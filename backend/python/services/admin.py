from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from model_manager import tracker

app = FastAPI(title="MVT Admin Panel")


@app.get("/admin/status")
async def status():
    """Return a snapshot of the status of every recommendation model."""
    models = {}
    for key in ("cf", "cb"):
        models[key] = tracker.snapshot(key)
    return models


@app.get("/admin/model/{model}")
async def model(model: str):
    """Return the status of a single model by key (`cf` or `cb`)."""
    if model not in ("cf", "cb"):
        raise HTTPException(status_code=400, detail=f"Nieznany model: {model}")
    return tracker.snapshot(model)


@app.websocket("/admin/ws")
async def admin_ws(websocket: WebSocket):
    """Bidirectional live stream of model events and logs to the admin panel."""
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
