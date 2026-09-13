import os
import time
import requests
import sqlite3
import pandas as pd

class DatabaseManager:
    def __init__(self):
        self.account_id = os.getenv("ACCOUNT_ID")
        self.database_id = os.getenv("DATABASE_ID")
        self.api_token = os.getenv("API_TOKEN")
        self.endpoint = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/databases/{self.database_id}/query"
        self.headers = {"Authorization": f"Bearer {self.api_token}", "Content-Type": "application/json"}
        
        # Ścieżka do lokalnej bazy w kontenerze
        self.local_db_path = "/app/local_movies.sqlite"

    def fetch_user_ratings(self, user_id: int):
        query = "SELECT rating, movie_id FROM reviews WHERE user_id = ? ORDER BY created_at DESC"
        res = requests.post(self.endpoint, json={"query": query, "params": [user_id]}, headers=self.headers)
        if res.status_code == 200:
            data = res.json().get("result", [])
            rows = data[0].get('results', []) if data and 'results' in data[0] else data
            return pd.DataFrame(rows, columns=["rating", "movie_id"])
        return None

    def get_cached_recommendations(self, user_id: int, rec_type: str):
        query = "SELECT movie_id, predicted_rating, confidence_lower, confidence_upper FROM recommendations WHERE user_id = ? AND recommendation_type = ? AND expires_at > ? ORDER BY predicted_rating DESC"
        res = requests.post(self.endpoint, json={"query": query, "params": [user_id, rec_type, str(int(time.time()))]}, headers=self.headers)
        if res.status_code == 200:
            data = res.json().get("result", [])
            rows = data[0].get('results', []) if data else []
            return [{"movie_id": r["movie_id"], "rating": r["predicted_rating"], "confidence_interval": [r["confidence_lower"], r["confidence_upper"]]} for r in rows] if rows else None
        return None

    def save_cached_recommendations(self, user_id: int, recs: list, minutes: int, rec_type: str):
        if not recs:
            return
        expires_at = str(int(time.time()) + (minutes * 60))
        base_query = "INSERT OR REPLACE INTO recommendations (user_id, movie_id, predicted_rating, confidence_lower, confidence_upper, recommendation_type, expires_at) VALUES "
        values = [f"({user_id}, {r['movie_id']}, {r['rating']}, {r['confidence_interval'][0]}, {r['confidence_interval'][1]}, '{rec_type}', '{expires_at}')" for r in recs]
        requests.post(self.endpoint, json={"query": base_query + ",\n".join(values) + ";"}, headers=self.headers)

    def fetch_movies_metadata(self):
        if not os.path.exists(self.local_db_path):
            print("BŁĄD: Brak pliku lokalnej bazy danych!")
            return None
        try:
            conn = sqlite3.connect(self.local_db_path)
            df = pd.read_sql_query("SELECT id, title, genre, overview, cast FROM movies", conn)
            conn.close()
            return df
        except Exception as e:
            print(f"Błąd odczytu z lokalnej bazy: {e}")
            return None