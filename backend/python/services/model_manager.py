import pandas as pd
from surprise import KNNBasic
from sklearn.feature_extraction.text import TfidfVectorizer

class RecommendationModelManager:
    """Menedżer modeli rekomendacji hybrydowych"""
    
    def __init__(self):
        self.cf_model = None
        self.tfidf_matrix = None
        self.movie_indices = None
        self.movie_id_map = None # Błyskawiczne mapowanie ID bez odpytywania bazy

    def build_collaborative_filtering_model(self, trainset):
        try:
            knn = KNNBasic(k=40, min_k=20, random_state=42)
            knn.fit(trainset)
            self.cf_model = knn
            print("Model CF (KNNBasic) zbudowany poprawnie.")
        except Exception as e:
            print(f"Błąd budowania modelu CF: {e}")

    def build_content_based_model(self, movies_df):
        try:
            print("Budowanie macierzy rzadkiej TF-IDF dla Content-Based...")
            
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
            
            self.movie_indices = pd.Series(movies_df.index, index=movies_df['id']).drop_duplicates()
            self.movie_id_map = movies_df['id'].values
            print("Model CB (TF-IDF) zbudowany poprawnie.")
            
        except Exception as e:
            print(f"Błąd budowania modelu CB: {e}")
