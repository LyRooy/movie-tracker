import pandas as pd
from surprise import KNNBasic
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


class RecommendationModelManager:
    """Menedżer modeli rekomendacji z Surprise"""
    
    def __init__(self):
        self.cf_model = None
        self.cb_model = None

    def build_collaborative_filtering_model(self, trainset):
        try:
            knn = KNNBasic(min_k=20, n_factors=50, n_epochs=20, random_state=42)
            knn.fit(trainset)
            self.cf_model = knn
        except Exception as e:
            print(f"Błąd CF: {e}")
    
    def build_content_based_model(self, movies_df):
        try:
            print("Budowanie macierzy Content-Based (TF-IDF)...")
            
            # Łączymy cechy tekstowe, nadając większą wagę gatunkom i reżyserowi poprzez ich powielenie
            movies_df['combined_features'] = (
                movies_df['genres'] + " " + 
                movies_df['genres'] + " " + 
                movies_df['director'] + " " + 
                movies_df['cast_members'] + " " + 
                movies_df['overview']
            )
            
            # Zabezpieczenie przed pustymi stringami
            movies_df['combined_features'] = movies_df['combined_features'].fillna('')
            
            # Wektoryzacja tekstu z odrzuceniem angielskich przerywników
            tfidf = TfidfVectorizer(stop_words='english')
            tfidf_matrix = tfidf.fit_transform(movies_df['combined_features'])
            
            # Obliczenie podobieństwa cosinusowego każdego filmu z każdym innym
            self.cb_similarity_matrix = cosine_similarity(tfidf_matrix, tfidf_matrix)
            
            # Mapowanie ID filmu z bazy SQLite na jego indeks w wyliczonej macierzy matematycznej
            self.movie_indices = pd.Series(movies_df.index, index=movies_df['id']).drop_duplicates()
            print("Model CB (TF-IDF) zbudowany poprawnie.")
            
        except Exception as e:
            print(f"Błąd budowania modelu CB: {e}")
