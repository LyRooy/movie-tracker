import os
import sys
from fastapi import FastAPI, HTTPException, Security, Depends
from fastapi.security.api_key import APIKeyHeader
from starlette.status import HTTP_403_FORBIDDEN

# 1. Pobranie klucza z pamięci RAM kontenera
MVT_API_KEY = os.getenv("MVT_API_KEY")

# Bezpieczeństwo przede wszystkim: jeśli klucza brak, wyłączamy aplikację
if not MVT_API_KEY:
    print("BŁĄD KRYTYCZNY: Zmienna środowiskowa MVT_API_KEY nie została ustawiona!")
    sys.exit(1)

app = FastAPI(title="MVT Recommendation API")

# Definiujemy, że klucz ma być przekazywany w nagłówku HTTP o nazwie X-API-Key
API_KEY_NAME = "X-API-Key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

# Funkcja weryfikująca poprawność klucza
async def verify_api_key(header_value: str = Depends(api_key_header)):
    if header_value == MVT_API_KEY:
        return header_value
    raise HTTPException(
        status_code=HTTP_403_FORBIDDEN, 
        detail="Brak lub niepoprawny klucz API (X-API-Key)"
    )

# --- PRZYKŁAD ZABEZPIECZONEGO ENDPOINTU ---
# Dodajemy `dependencies=[Depends(verify_api_key)]` do każdego endpointu, który ma być tajny
@app.get("/movies/recommendations", dependencies=[Depends(verify_api_key)])
async def get_recommendations():
    # Tutaj będzie Twoja logika rekomendacji dla 250k filmów
    return {
        "status": "success",
        "recommendations": ["Incepcja", "Interstellar", "Matrix"]
    }

# Endpoint publiczny (np. dla Cloudflare do sprawdzania czy kontener żyje)
@app.get("/health")
async def health_check():
    return {"status": "healthy"}