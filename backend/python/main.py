import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.recommendations import router as recommendations_router
from services.admin import router as admin_router

# 1. Pobranie klucza z pamięci RAM kontenera
MVT_API_KEY = os.getenv("MVT_API_KEY")

if not MVT_API_KEY:
    print("BŁĄD KRYTYCZNY: Zmienna środowiskowa MVT_API_KEY nie została ustawiona!")
    sys.exit(1)

app = FastAPI(title="MVT Recommendation API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Podpinamy endpointy z innych plików
app.include_router(recommendations_router)
# Endpointy panelu admina (status/postep modeli).
# Go admin dzwoni zawsze pod /admin/* (np. /admin/status, /admin/ws), a router w admin.py
# ma prefix="/admin", wiec nie dodajemy tu ponownego prefixa (to by dalo /admin/admin/*).
app.include_router(admin_router)

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
