import os
from fastapi import APIRouter, Depends, HTTPException, Security
from fastapi.security.api_key import APIKeyHeader
from surprise import Dataset
from surprise.model_selection import train_test_split

from services.model_manager import RecommendationModelManager
from database.db_manager import DatabaseManager

router = APIRouter(prefix="/movies/user", tags=["Recommendations"])
model_manager = RecommendationModelManager()
db = DatabaseManager()

API_KEY = os.getenv("MVT_API_KEY")
CACHE_MINUTES = 30
REC_TYPE = "collaborative_filtering"

async def verify_api_key(header: str = Security(APIKeyHeader(name="X-API-Key", auto_error=False))):
    if header == API_KEY: 
        return header
    raise HTTPException(status_code=403, detail="Brak klucza API")

@router.get("/{user_id}/recommendations", dependencies=[Depends(verify_api_key)])
async def get_recommendations(user_id: int):
    cached = db.get_cached_recommendations(user_id, REC_TYPE)
    if cached: 
        return {"status": "success", "source": "database_cache", "user_id": user_id, "recommendations": cached}
    
    df = db.fetch_user_ratings(user_id)
    if df is None or df.empty: 
        return {"status": "error", "message": "Brak ocen"}
    
    trainset, _ = train_test_split(Dataset.from_df(df, id_columns=['movie_id'], rcolumns=['rating']), test_size=0.25, allow_same_user=True)
    if not model_manager.cf_model: 
        model_manager.build_collaborative_filtering_model(trainset)
    
    recs = []
    if model_manager.cf_model and user_id in model_manager.cf_model.get_all_users():
        for m_id, data in model_manager.cf_model.similar_items(user_id):
            try:
                if user_id not in data or str(data[user_id]) != "nan":
                    pred = model_manager.cf_model.predict(user_id, m_id)
                    recs.append({
                        "movie_id": m_id, 
                        "rating": round(pred.estimation, 2), 
                        "confidence_interval": [float(pred.confidence_interval[0]), float(pred.confidence_interval[1])]
                    })
            except:
                continue
        recs.sort(key=lambda x: x["rating"], reverse=True)
        db.save_cached_recommendations(user_id, recs[:10], CACHE_MINUTES, REC_TYPE)
        
    return {"status": "success", "source": "computed", "user_id": user_id, "recommendations": recs[:10]}

@router.get("/{user_id}/recommendations/force-recalculate", dependencies=[Depends(verify_api_key)])
async def force_recalculate(user_id: int):
    df = db.fetch_user_ratings(user_id)
    if df is None or df.empty: 
        return {"status": "error", "message": "Brak ocen"}
    
    trainset, _ = train_test_split(Dataset.from_df(df, id_columns=['movie_id'], rcolumns=['rating']), test_size=0.25, allow_same_user=True)
    model_manager.build_collaborative_filtering_model(trainset)
    
    recs = []
    if model_manager.cf_model and user_id in model_manager.cf_model.get_all_users():
        for m_id, data in model_manager.cf_model.similar_items(user_id):
            try:
                if user_id not in data or str(data[user_id]) != "nan":
                    pred = model_manager.cf_model.predict(user_id, m_id)
                    recs.append({
                        "movie_id": m_id, 
                        "rating": round(pred.estimation, 2), 
                        "confidence_interval": [float(pred.confidence_interval[0]), float(pred.confidence_interval[1])]
                    })
            except:
                continue
        recs.sort(key=lambda x: x["rating"], reverse=True)
        db.save_cached_recommendations(user_id, recs[:10], CACHE_MINUTES, REC_TYPE)
        
    return {"status": "success", "source": "forced-recalculation", "user_id": user_id, "recommendations": recs[:10]}