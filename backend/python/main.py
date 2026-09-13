import os
import sys
from fastapi import FastAPI
from api.recommendations import router as recommendations_router

# 1. Pobranie klucza z pamięci RAM kontenera
MVT_API_KEY = os.getenv("MVT_API_KEY")

if not MVT_API_KEY:
    print("BŁĄD KRYTYCZNY: Zmienna środowiskowa MVT_API_KEY nie została ustawiona!")
    sys.exit(1)

app = FastAPI(title="MVT Recommendation API")

# Podpinamy endpointy z innych plików
app.include_router(recommendations_router)

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
