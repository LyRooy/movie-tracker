from surprise import KNNBasic, SVD

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
    
    def build_content_based_filtering_model(self, trainset):
        try:
            svd = SVD(n_factors=50, n_epochs=20, random_state=42)
            svd.fit(trainset)
            self.cb_model = svd
        except Exception as e:
            print(f"Błąd CB: {e}")