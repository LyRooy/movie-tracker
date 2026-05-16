from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def read_root():
    return {"status": "API Rekomendacji Działa", "model": "Gotowy na Surprise"}

@app.get("/recommend/{user_id}")
def get_recommendations(user_id: int):
    # Tutaj w przyszłości dodasz logikę pobierania z D1 i liczenia Surprise
    return {"user_id": user_id, "recommendations": [101, 202, 303]}