import os
from fastapi import APIRouter, Depends, HTTPException, Security
from fastapi.security.api_key import APIKeyHeader
from surprise import Dataset, Reader

from services.model_manager import RecommendationModelManager
from database.db_manager import DatabaseManager

router = APIRouter(prefix="/movies/user", tags=["Recommendations"])
model_manager = RecommendationModelManager()
db = DatabaseManager()

API_KEY = os.getenv("MVT_API_KEY")
CACHE_MINUTES = 30
REC_TYPE = "collaborative_filtering"

async def verify_api_key(header: str = Security(APIKeyHeader(name="X-API-Key", auto_error=False))):
    if not header:
        raise HTTPException(status_code=403, detail="Brak klucza API w nagłówku")
    safe_api_key = API_KEY or ""
    clean_header = header.strip()
    clean_api_key = safe_api_key.strip().strip('"').strip("'")
    
    if clean_header == clean_api_key and clean_api_key != "": 
        return header
    raise HTTPException(status_code=403, detail="Niepoprawny klucz API")

@router.get("/{user_id}/recommendations", dependencies=[Depends(verify_api_key)])
async def get_recommendations(user_id: int):
    cached = db.get_cached_recommendations(user_id, REC_TYPE)
    if cached: 
        return {"status": "success", "source": "database_cache", "user_id": user_id, "recommendations": cached}
    
    df = db.fetch_user_ratings(user_id)
    if df is None or df.empty: 
        return {"status": "error", "message": "Brak ocen"}
    
    # Przygotowanie danych dla Surprise
    df['user_id'] = user_id
    df = df[['user_id', 'movie_id', 'rating']]
    
    reader = Reader(rating_scale=(1, 5))
    dataset = Dataset.load_from_df(df, reader)
    
    # Używamy build_full_trainset, bo nie potrzebujemy testować modelu w locie, tylko wygenerować predykcje
    trainset = dataset.build_full_trainset()
    
    if not model_manager.cf_model: 
        model_manager.build_collaborative_filtering_model(trainset)
        
    # Pobieramy wszystkie filmy z lokalnej bazy SQLite
    movies_df = db.fetch_movies_metadata()
    if movies_df is None or movies_df.empty:
        return {"status": "error", "message": "Brak lokalnej bazy filmów do wygenerowania rekomendacji"}
        
    all_movie_ids = movies_df['id'].tolist()
    rated_movie_ids = set(df['movie_id'].tolist())
    
    recs = []
    if model_manager.cf_model:
        for m_id in all_movie_ids:
            # Przewidujemy oceny tylko dla filmów, których użytkownik jeszcze nie ocenił
            if m_id not in rated_movie_ids:
                pred = model_manager.cf_model.predict(user_id, m_id)
                recs.append({
                    "movie_id": m_id, 
                    "rating": round(pred.est, 2), # .est zamiast .estimation
                    "confidence_interval": [0.0, 0.0] # Surprise nie wylicza confidence interval
                })
        
        # Sortujemy od najwyższej przewidywanej oceny
        recs.sort(key=lambda x: x["rating"], reverse=True)
        top_recs = recs[:10]
        
        # Zapisujemy do chmury D1
        db.save_cached_recommendations(user_id, top_recs, CACHE_MINUTES, REC_TYPE)
        
    return {"status": "success", "source": "computed", "user_id": user_id, "recommendations": top_recs}

@router.get("/{user_id}/recommendations/force-recalculate", dependencies=[Depends(verify_api_key)])
async def force_recalculate(user_id: int):
    df = db.fetch_user_ratings(user_id)
    if df is None or df.empty: 
        return {"status": "error", "message": "Brak ocen"}
    
    df['user_id'] = user_id
    df = df[['user_id', 'movie_id', 'rating']]
    
    reader = Reader(rating_scale=(1, 5))
    dataset = Dataset.load_from_df(df, reader)
    trainset = dataset.build_full_trainset()
    
    # Trenujemy od zera (nadpisując ewentualny stary model w RAM)
    model_manager.build_collaborative_filtering_model(trainset)
    
    movies_df = db.fetch_movies_metadata()
    if movies_df is None or movies_df.empty:
        return {"status": "error", "message": "Brak lokalnej bazy filmów do wygenerowania rekomendacji"}
        
    all_movie_ids = movies_df['id'].tolist()
    rated_movie_ids = set(df['movie_id'].tolist())
    
    recs = []
    if model_manager.cf_model:
        for m_id in all_movie_ids:
            if m_id not in rated_movie_ids:
                pred = model_manager.cf_model.predict(user_id, m_id)
                recs.append({
                    "movie_id": m_id, 
                    "rating": round(pred.est, 2), 
                    "confidence_interval": [0.0, 0.0]
                })
        
        recs.sort(key=lambda x: x["rating"], reverse=True)
        top_recs = recs[:10]
        
        db.save_cached_recommendations(user_id, top_recs, CACHE_MINUTES, REC_TYPE)
        
    return {"status": "success", "source": "forced-recalculation", "user_id": user_id, "recommendations": top_recs}