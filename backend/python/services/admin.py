import asyncio
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
    """WebSocket do live streamowania postępu modeli.

    Wysyła tylko nowe zdarzenia/logi (od ostatnio wysłanego indeksu), zamiast
    całej historii w kółko — inaczej strumień rósł w nieskończoność i zalewał
    połączenie duplikatami przy każdej iteracji pętli.
    """
    await websocket.accept()
    sent_events = {"cf": 0, "cb": 0}
    sent_logs = {"cf": 0, "cb": 0}
    try:
        print(f"[admin_ws] Połączono. Rozpoczęto streamowanie dla {len(tracker.models)} modeli.")
        while True:
            try:
                for model_key in ("cf", "cb"):
                    snap = tracker.snapshot(model_key)
                    new_events = snap["events"][sent_events[model_key]:]
                    # Liczba zapisanych rekomendacji (z /admin/status) dołączana do
                    # eventu "built", żeby licznik na dashboardzie się zaktualizował.
                    events_with_count = [
                        {**event, "count": snap["count"]} if event["event"] == "built" else event
                        for event in new_events
                    ]
                    for event in events_with_count:
                        await websocket.send_json({"type": "event", "model": model_key, **event})
                    sent_events[model_key] = len(snap["events"])

                    new_logs = snap["logs"][sent_logs[model_key]:]
                    for log in new_logs:
                        await websocket.send_json({"type": "log", "model": model_key, **log})
                    sent_logs[model_key] = len(snap["logs"])
            except Exception as e:
                # Krytyczny błąd w pętli streamowania: logujemy i kontynuujemy,
                # żeby tunel pozostał otwarty (Go relayer nie widzi nagłego disconnect).
                print(f"[admin_ws] Błąd streamowania: {e}")
            await websocket.send_json({"type": "ping"})
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        print("Połączenie WebSocket panelu admina rozłączone.")
    except Exception as e:
        print(f"Błąd w WebSocket panelu admina: {e}")
