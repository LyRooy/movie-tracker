import os
import sys
import sqlite3
from fastapi import FastAPI, status, HTTPException, Security, Depends
from fastapi.security.api_key import APIKeyHeader

# Importy do Surprise i analizy danych
import pandas as pd
import numpy as np
from surprise import KNNBasic, SVD, Dataset, Reader
from surprise.model_selection import train_test_split

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
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Brak lub niepoprawny klucz API (X-API-Key)"
    )

# --- MODELE REKOMENDACJI SURPRISE ---

class RecommendationModelManager:
    """Menedżer modeli rekomendacji z Surprise"""
    
    def __init__(self):
        self.cf_model = None  # Collaborative Filtering (SVD)
        self.cb_model = None  # Content-Based Filtering (KNNBasic)
        self.dataset = None
        self.trainset = None
        self.testset = None
    
    def load_user_data_from_cloudflare_db(self, user_id: int):
        """Ładuje dane użytkownika z bazy Cloudflare D1"""
        try:
            # Zapytanie do bazy Cloudflare - pobieramy rating i watched movies użytkownika
            query = f"""
                SELECT r.rating, w.movie_id
                FROM reviews r
                JOIN watched w ON r.user_id = w.user_id 
                WHERE r.user_id = {user_id}
                LIMIT 1000
            """
            
            # Tutaj należy wstawić kod do pobrania danych z bazy Cloudflare D1
            # Na przykład: db_connection.execute(query).fetchall()
            # Poniżej są przykładowe dane - podmień na prawdziwe!
            data = [(user_id, 4.5), (user_id, 3.8), (user_id, 4.2)]  
            
            return pd.DataFrame(data, columns=['rating', 'movie_id'])
            
        except Exception as e:
            print(f"✗ Błąd podczas ładowania danych użytkownika z Cloudflare: {e}")
            return None
    
    def load_movies_from_local_db(self):
        """Ładuje wszystkie filmy z lokalnej bazy movies.db"""
        try:
            import sqlite3
            conn = sqlite3.connect('movies.db')  # lub inny ścieżek do pliku movies.db
            
            query = """
                SELECT id, title, genre, description, 
                       COALESCE(vote_average, 0) as rating
                FROM movies
                LIMIT 500
            """
            
            df = pd.read_sql_query(query, conn)
            conn.close()
            
            print(f"✓ Załadowano {len(df)} filmów z movies.db")
            return df
            
        except Exception as e:
            print(f"✗ Błąd podczas ładowania filmów z movies.db: {e}")
            return None
    
    def prepare_surprise_dataset(self, user_ratings_df):
        """Przygotowuje zestaw danych w formacie Surprise"""
        try:
            # TworzyReader z skalą oceny 1-5
            reader = Reader(rating_scale=(0.5, 5))  # Surprise używa skali 0.5-5
            
            # Tworzy dataset z ratingów użytkowników
            self.dataset = Dataset.from_df(
                user_ratings_df,
                id_columns=['movie_id'],
                rcolumns=['rating']
            )
            
            print(f"✓ Przygotowano dataset: {len(self.dataset)} ocen")
            
        except Exception as e:
            print(f"✗ Błąd podczas przygotowania dataset: {e}")
    
    def build_collaborative_filtering_model(self, trainset):
        """Buduje model Collaborative Filtering (SVD)"""
        try:
            # SVD - Singular Value Decomposition dla collaborative filtering
            self.cf_model = SVD(
                n_factors=50,          # Liczba czynników (komponentów)
                n_epochs=20,           # Liczba iteracji treningowych
                random_state=42,       # Dla reproducibility
                verbose=True           # Włączaj logowanie postępu
            )
            
            # Trenujemy model
            self.cf_model.fit(trainset)
            print(f"✓ Model Collaborative Filtering (SVD) gotowy!")
            
        except Exception as e:
            print(f"✗ Błąd budowania CF modelu: {e}")
    
    def build_content_based_filtering_model(self, trainset):
        """Buduje model Content-Based Filtering (KNNBasic)"""
        try:
            # KNN - k-Nearest Neighbors dla content-based filtering
            self.cb_model = KNNBasic(
                mem_map=True,          # Używaj mapowania pamięci dla dużych datasetów
                ns_neighbors=20,       # Liczba sąsiadów do uwzględnienia
                user_based=True,        # Opiera się na użytkownikach (zamiast filmów)
                verbose=True           # Włączaj logowanie postępu
            )
            
            # Trenujemy model
            self.cb_model.fit(trainset)
            print(f"✓ Model Content-Based Filtering (KNNBasic) gotowy!")
            
        except Exception as e:
            print(f"✗ Błąd budowania CB modelu: {e}")
    
    def split_data(self, dataset):
        """Podzieli dane na zestaw treningowy i testowy"""
        try:
            self.trainset, self.testset = train_test_split(
                dataset, 
                test_size=0.25,       # 25% do testów
                allow_same_user=True   # Pozwala na ten samego użytkownika w training/test
            )
            print(f"✓ Dane podzielone: {len(self.trainset)} treningowych, {len(self.testset)} testowych")
        except Exception as e:
            print(f"✗ Błąd podczas podziału danych: {e}")
    
    def predict_single(self, user_id, movie_id):
        """Przeprowadź pojedynczą predykcję"""
        if self.cf_model and user_id in self.cf_model.get_all_users():
            try:
                prediction = self.cf_model.predict(user_id, movie_id)
                return {
                    "estimation": prediction.estimation,
                    "confidence_interval": list(prediction.confidence_interval),
                    "error_bound": prediction.error_bound
                }
            except Exception as e:
                print(f"Predict error: {e}")
        return None
    
    def get_recommendations_for_user(self, user_id, n=10):
        """Zwróć TOP-N rekomendacji dla użytkownika"""
        try:
            # Sprawdzamy czy użytkownik jest w modelu
            if not self.cf_model or user_id not in self.cf_model.get_all_users():
                return []
            
            predictions = []
            watched_movies = set()
            
            # Pobierzmy liste wszystkich użytkowników i filmów z modelu
            all_users = list(self.cf_model.get_all_users())
            
            for movie_id, rating_data in self.cf_model.similar_items(user_id):
                try:
                    prediction = self.cf_model.predict(user_id, movie_id)
                    
                    # Sprawdź czy użytkownik nie ocenił już tego filmu
                    if user_id not in rating_data or str(rating_data[user_id]) != "nan":
                        predictions.append({
                            "movie_id": movie_id,
                            "rating": prediction.estimation,
                            "confidence_interval": list(prediction.confidence_interval)
                        })
                except:
                    continue
            
            # Sortuj według przewidywanych ocen (najwyższe pierwsze)
            predictions.sort(key=lambda x: x["rating"], reverse=True)
            
            return predictions[:n]
            
        except Exception as e:
            print(f"✗ Błąd podczas generowania rekomendacji: {e}")
            return []

# Globalny menedżer modeli
model_manager = RecommendationModelManager()

@app.get("/movies/recommendations", dependencies=[Depends(verify_api_key)])
async def get_recommendations(user_id: int):
    """Endpoint rekomendacji filmów z Surprise (Content-Based + Collaborative Filtering)"""
    
    # 1. Ładujemy dane użytkownika z Cloudflare D1
    user_ratings_df = model_manager.load_user_data_from_cloudflare_db(user_id)
    
    if user_ratings_df is None:
        return {
            "status": "error",
            "message": "Nie można pobrać danych użytkownika z bazy Cloudflare"
        }
    
    # 2. Ładujemy filmy z lokalnej bazy movies.db (tylko jeśli dataset nie istnieje)
    if model_manager.dataset is None:
        movies_df = model_manager.load_movies_from_local_db()
        
        if movies_df is None:
            return {
                "status": "error", 
                "message": "Nie można pobrać danych filmów z movies.db"
            }
    
    # 3. Przygotujemy Surprise dataset
    model_manager.prepare_surprise_dataset(user_ratings_df)
    
    # 4. Trenuj oba modele (tylko jeśli jeszcze nie są trenowane)
    if model_manager.dataset:
        try:
            # Podziel dane na trening/test (tylko jeśli potrzeba)
            model_manager.split_data(model_manager.dataset)
            
            # Budujemy modele (tylko jeśli jeszcze nie istnieją)
            if not model_manager.cf_model:
                model_manager.build_collaborative_filtering_model(model_manager.trainset)
            if not model_manager.cb_model:
                model_manager.build_content_based_filtering_model(model_manager.trainset)
                
        except Exception as e:
            print(f"✗ Błąd podczas trenowania modeli: {e}")
    
    # 5. Generujemy rekomendacje
    recommendations = model_manager.get_recommendations_for_user(user_id, n=10)
    
    return {
        "user_id": user_id,
        "type": "collaborative_filtering",  # SVD model
        "count": len(recommendations),
        "recommendations": [
            {
                "movie_id": rec["movie_id"],
                "prediction": round(rec["rating"], 2),
                "confidence_interval": rec["confidence_interval"]
            }
            for rec in recommendations
        ]
    }

# Endpoint publiczny (np. dla Cloudflare do sprawdzania czy kontener żywe)
@app.get("/health")
async def health_check():
    return {"status": "healthy"}
