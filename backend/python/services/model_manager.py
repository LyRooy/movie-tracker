import threading
import time
import pandas as pd
from surprise import SVD
from sklearn.feature_extraction.text import TfidfVectorizer

class ProgressTracker:
    """Bezpieczny (lockowany) rejestr postępu budowania modeli.
    
    Zbiera zdarzenia (np. 'building', 'built') oraz logi tekstowe dla każdego
    modelu i wystawia je przez endpoint HTTP/WebSocket dla panelu admina.
    """
    def __init__(self):
        self._lock = threading.Lock()
        # klucze: "cf" / "cb" — inicjalizowane od razu, żeby /admin/ws nie
        # rzucał KeyError zanim jakikolwiek model zacznie sie budować.
        self.models = {
            "cf": {"status": "not_started", "events": [], "logs": [], "count": None},
            "cb": {"status": "not_started", "events": [], "logs": [], "count": None},
        }

    def record_count(self, key, count):
        """Zapisz liczbę zapisanych rekomendacji dla modelu (pokazana w liczniku)."""
        with self._lock:
            self.models[key]["count"] = count

    def _model(self, key):
        if key not in self.models:
            self.models[key] = {"status": "not_started", "events": [], "logs": []}
        return self.models[key]

    def start(self, key, name, desc):
        """Zaznaczenie rozpoczęcia budowania modelu."""
        with self._lock:
            m = self._model(key)
            m["count"] = 0
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
                "count": self._model(key).get("count"),
            }


tracker = ProgressTracker()

class RecommendationModelManager:
    """Menedżer modeli rekomendacji hybrydowych"""
    
    def __init__(self):
        self.cf_model = None
        self.tfidf_matrix = None
        self.movie_indices = None
        self.movie_id_map = None # Błyskawiczne mapowanie ID bez odpytywania bazy

    def build_collaborative_filtering_model(self, trainset, user_id=None):
        tracker.start("cf", "CF", f"Budowanie modelu Collaborative Filtering (user_id={user_id})")
        try:
            svd = SVD(n_factors=100, n_epochs=20, random_state=42)
            svd.fit(trainset)
            self.cf_model = svd
            tracker.log("cf", "CF", f"SVD(n_factors=100, n_epochs=20, random_state=42) | user_id={user_id}")
            tracker.finish("cf", "CF", ok=True, message=f"Model CF gotowy (user_id={user_id})")
            print("Model CF (SVD) zbudowany poprawnie.")
        except Exception as e:
            tracker.log("cf", "CF", f"Błąd: {e} | user_id={user_id}", level="error")
            tracker.finish("cf", "CF", ok=False, message=f"Błąd budowania modelu CF (user_id={user_id})")
            print(f"Błąd budowania modelu CF: {e}")

    def build_content_based_model(self, movies_df, user_id=None):
        tracker.start("cb", "CB", f"Budowanie modelu Content-Based (user_id={user_id})")
        try:
            print("Budowanie macierzy rzadkiej TF-IDF dla Content-Based...")
            tracker.log("cb", "CB", f"Łączenie cech: genres, director, cast, overview | user_id={user_id}")
            
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
            tracker.log("cb", "CB", f"Macierz TF-IDF: {self.tfidf_matrix.shape[0]} filmów x {self.tfidf_matrix.shape[1]} wymiarów | user_id={user_id}")
            
            self.movie_indices = pd.Series(movies_df.index, index=movies_df['id']).drop_duplicates()
            self.movie_id_map = movies_df['id'].values
            tracker.log("cb", "CB", f"Zmapowano {len(self.movie_id_map)} filmów | user_id={user_id}")
            tracker.finish("cb", "CB", ok=True, message=f"Model CB gotowy (user_id={user_id})")
            print("Model CB (TF-IDF) zbudowany poprawnie.")
            
        except Exception as e:
            tracker.log("cb", "CB", f"Błąd: {e} | user_id={user_id}", level="error")
            tracker.finish("cb", "CB", ok=False, message=f"Błąd budowania modelu CB (user_id={user_id})")
            print(f"Błąd budowania modelu CB: {e}")
