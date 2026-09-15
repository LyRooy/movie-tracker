import threading
import time
import pandas as pd
from surprise import KNNBasic
from sklearn.feature_extraction.text import TfidfVectorizer

class ProgressTracker:
    """Bezpieczny (lockowany) rejestr postępu budowania modeli.
    
    Zbiera zdarzenia (np. 'building', 'built') oraz logi tekstowe dla każdego
    modelu i wystawia je przez endpoint HTTP/WebSocket dla panelu admina.
    """
    def __init__(self):
        self._lock = threading.Lock()
        # klucze: "cf" / "cb"
        self.models = {}

    def _model(self, key):
        if key not in self.models:
            self.models[key] = {"status": "not_started", "events": [], "logs": []}
        return self.models[key]

    def start(self, key, name, desc):
        """Zaznaczenie rozpoczęcia budowania modelu."""
        with self._lock:
            m = self._model(key)
            if m["status"] != "running":
                m["status"] = "running"
                m["events"].append({"t": round(time.time()*1000), "level": "info", "event": "building", "model": key, "name": name, "message": desc})

    def finish(self, key, name, ok=True, message=None):
        """Zaznaczenie zakończenia budowania modelu."""
        with self._lock:
            m = self._model(key)
            status = "ready" if ok else "error"
            if m["status"] != status:
                m["status"] = status
                m["events"].append({"t": round(time.time()*1000), "level": "info", "event": "built", "model": key, "name": name, "ok": ok, "message": message or (f"Zbudowano model {name}" if ok else f"Błąd budowania modelu {name}")})

    def log(self, key, name, message, level="info"):
        """Dodanie pojedynczego logu do modelu."""
        with self._lock:
            m = self._model(key)
            m["logs"].append({"t": round(time.time()*1000), "level": level, "model": key, "name": name, "message": message})

    def snapshot(self, key):
        """Zwraca aktualny stan (kopię) dla danego modelu."""
        with self._lock:
            return {
                "status": self._model(key)["status"],
                "events": list(self._model(key)["events"]),
                "logs": list(self._model(key)["logs"]),
            }


tracker = ProgressTracker()

class RecommendationModelManager:
    """Menedżer modeli rekomendacji hybrydowych"""
    
    def __init__(self):
        self.cf_model = None
        self.tfidf_matrix = None
        self.movie_indices = None
        self.movie_id_map = None # Błyskawiczne mapowanie ID bez odpytywania bazy

    def build_collaborative_filtering_model(self, trainset):
        tracker.start("cf", "CF", "Budowanie modelu Collaborative Filtering")
        try:
            knn = KNNBasic(k=40, min_k=20, random_state=42)
            knn.fit(trainset)
            self.cf_model = knn
            tracker.log("cf", "CF", "KNNBasic(k=40, min_k=20, random_state=42)")
            tracker.finish("cf", "CF", ok=True, message="Model CF gotowy")
            print("Model CF (KNNBasic) zbudowany poprawnie.")
        except Exception as e:
            tracker.log("cf", "CF", f"Błąd: {e}", level="error")
            tracker.finish("cf", "CF", ok=False, message=str(e))
            print(f"Błąd budowania modelu CF: {e}")

    def build_content_based_model(self, movies_df):
        tracker.start("cb", "CB", "Budowanie modelu Content-Based")
        try:
            print("Budowanie macierzy rzadkiej TF-IDF dla Content-Based...")
            tracker.log("cb", "CB", "Łączenie cech: genres, director, cast, overview")
            
            movies_df['combined_features'] = (
                movies_df['genres'] + " " + 
                movies_df['genres'] + " " + 
                movies_df['director'] + " " + 
                movies_df['cast_members'] + " " + 
                movies_df['overview']
            )
            movies_df['combined_features'] = movies_df['combined_features'].fillna('')
            
            tfidf = TfidfVectorizer(stop_words='english')
            self.tfidf_matrix = tfidf.fit_transform(movies_df['combined_features'])
            tracker.log("cb", "CB", f"Macierz TF-IDF: {self.tfidf_matrix.shape[0]} filmów x {self.tfidf_matrix.shape[1]} wymiarów")
            
            self.movie_indices = pd.Series(movies_df.index, index=movies_df['id']).drop_duplicates()
            self.movie_id_map = movies_df['id'].values
            tracker.log("cb", "CB", f"Zmapowano {len(self.movie_id_map)} filmów")
            tracker.finish("cb", "CB", ok=True, message="Model CB gotowy")
            print("Model CB (TF-IDF) zbudowany poprawnie.")
            
        except Exception as e:
            tracker.log("cb", "CB", f"Błąd: {e}", level="error")
            tracker.finish("cb", "CB", ok=False, message=str(e))
            print(f"Błąd budowania modelu CB: {e}")
