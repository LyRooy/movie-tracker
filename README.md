# MovieTracker - Firebase Edition

MovieTracker to aplikacja do śledzenia obejrzanych filmów i seriali, zbudowana z użyciem Firebase jako backendu.

## Spis treści
- [Funkcje](#funkcje)
- [Technologie](#technologie)
- [Schemat bazy danych](#schemat-bazy-danych)
- [Instalacja](#instalacja)
- [Konfiguracja Firebase](#konfiguracja-firebase)
- [Uruchomienie](#uruchomienie)
- [API Endpoints](#api-endpoints)

## Funkcje

- ✅ Rejestracja i logowanie użytkowników
- ✅ Przeglądanie i wyszukiwanie filmów/seriali
- ✅ Dodawanie filmów do listy obejrzanych
- ✅ Wystawianie ocen i recenzji
- ✅ System wyzwań (challenges)
- ✅ System odznak (badges)
- ✅ System znajomych
- ✅ Statystyki oglądania
- ✅ Personalizacja profilu
- ✅ Jasny i ciemny motyw

## Technologie

### Frontend
- HTML5, CSS3, JavaScript (Vanilla JS)
- Chart.js - wizualizacja statystyk
- Firebase Client SDK

### Backend
- Node.js
- Express.js
- Firebase Admin SDK
- Firestore Database
- JWT Authentication
- bcryptjs - hashowanie haseł
- Multer - upload plików

## Schemat bazy danych

Aplikacja wykorzystuje Firebase Firestore z następującymi kolekcjami:

### Users
- id (auto-generated)
- nickname (string)
- email (string, unique)
- password_hash (string)
- avatar_url (string, nullable)
- description (text, nullable)
- role (enum: 'admin', 'user', 'guest')
- theme_preference (enum: 'light', 'dark')

### Movies
- id (auto-generated)
- title (string)
- release_date (timestamp)
- type (enum: 'movie', 'series')
- genre (string)
- description (text)
- poster_url (string)
- trailer_url (string)

### Watched
- id (auto-generated)
- user_id (reference → Users)
- movie_id (reference → Movies)
- watched_date (timestamp)

### Reviews
- id (auto-generated)
- user_id (reference → Users)
- movie_id (reference → Movies)
- content (text, nullable)
- rating (number, 1-5)
- created_at (timestamp)

### Challenges
- id (auto-generated)
- title (string)
- description (text)
- type (string)
- criteria_value (string)
- target_count (number)
- start_date (timestamp)
- end_date (timestamp)
- badge_id (reference → Badges)

### Challenge_Participants
- id (auto-generated)
- challenge_id (reference → Challenges)
- user_id (reference → Users)
- joined_at (timestamp)
- completed_at (timestamp, nullable)
- progress (number)

### Challenge_Watched
- id (auto-generated)
- challenge_participant_id (reference → Challenge_Participants)
- movie_id (reference → Movies)
- watched_date (timestamp)

### Badges
- id (auto-generated)
- name (string)
- description (text)
- image_url (string)

### User_Badges
- id (auto-generated)
- user_id (reference → Users)
- badge_id (reference → Badges)
- challenge_participant_id (reference → Challenge_Participants)
- level (enum: 'silver', 'gold', 'platinum', 'none')
- earned_at (timestamp)

### Friends
- id (auto-generated)
- user1_id (reference → Users)
- user2_id (reference → Users)
- status (enum: 'pending', 'accepted', 'rejected', 'blocked')
- requested_at (timestamp)
- responded_at (timestamp, nullable)

## Instalacja

1. Sklonuj repozytorium:
```bash
git clone https://github.com/LyRooy/movie-tracker.git
cd movie-tracker
```

2. Zainstaluj zależności:
```bash
npm install
```

3. Utwórz folder dla uploadów:
```bash
mkdir -p public/uploads
```

## Konfiguracja Firebase

### 1. Utwórz projekt Firebase

1. Przejdź do [Firebase Console](https://console.firebase.google.com/)
2. Kliknij "Add project" (Dodaj projekt)
3. Podaj nazwę projektu (np. "movie-tracker")
4. Postępuj zgodnie z instrukcjami, aby dokończyć tworzenie projektu

### 2. Skonfiguruj Firestore Database

1. W Firebase Console, przejdź do "Firestore Database"
2. Kliknij "Create database"
3. Wybierz tryb "Start in production mode" lub "Start in test mode" (dla rozwoju)
4. Wybierz lokalizację najbliższą Twojemu regionowi

### 3. Pobierz dane uwierzytelniające

#### Dla backendu (Firebase Admin SDK):

1. W Firebase Console, przejdź do Project Settings → Service Accounts
2. Kliknij "Generate new private key"
3. Pobierz plik JSON z kluczem

#### Dla frontendu (Firebase Web SDK):

1. W Firebase Console, przejdź do Project Settings → General
2. W sekcji "Your apps", kliknij na ikonę web (</>)
3. Zarejestruj swoją aplikację
4. Skopiuj configuration object

### 4. Skonfiguruj zmienne środowiskowe

1. Skopiuj plik `.env.example` do `.env`:
```bash
cp .env.example .env
```

2. Edytuj plik `.env` i uzupełnij wartości z pobranych danych:

```env
# Z pobranego pliku JSON (Service Account):
FIREBASE_PROJECT_ID=twoj-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@twoj-project-id.iam.gserviceaccount.com

# Z Firebase Web Config:
FIREBASE_API_KEY=twoj-api-key
FIREBASE_AUTH_DOMAIN=twoj-project-id.firebaseapp.com
FIREBASE_STORAGE_BUCKET=twoj-project-id.appspot.com
FIREBASE_MESSAGING_SENDER_ID=twoj-sender-id
FIREBASE_APP_ID=twoj-app-id

# Wygeneruj własny silny klucz JWT:
JWT_SECRET=twoj-bardzo-bezpieczny-losowy-klucz

# Opcjonalnie:
PORT=3000
```

### 5. Zaktualizuj konfigurację frontendu

Edytuj plik `js/firebase-config.js` i zastąp wartości placeholder własnymi danymi z Firebase Console:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 6. Skonfiguruj reguły bezpieczeństwa Firestore (opcjonalnie)

W Firebase Console → Firestore Database → Rules, możesz ustawić reguły bezpieczeństwa. Przykładowe reguły:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /Users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Movies collection
    match /Movies/{movieId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Watched collection
    match /Watched/{watchedId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.resource.data.user_id == request.auth.uid;
    }
    
    // Reviews collection
    match /Reviews/{reviewId} {
      allow read: if true;
      allow write: if request.auth != null && request.resource.data.user_id == request.auth.uid;
    }
    
    // Other collections - adjust as needed
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Uruchomienie

### Tryb rozwojowy (z automatycznym restartowaniem):
```bash
npm run dev
```

### Tryb produkcyjny:
```bash
npm start
```

Aplikacja będzie dostępna pod adresem `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/register` - Rejestracja użytkownika
- `POST /api/login` - Logowanie użytkownika

### User
- `GET /api/user/profile` - Pobranie profilu użytkownika
- `PUT /api/user/profile` - Aktualizacja profilu
- `POST /api/user/avatar` - Upload avatara
- `GET /api/user/statistics` - Statystyki użytkownika
- `GET /api/user/challenges` - Wyzwania użytkownika
- `GET /api/user/badges` - Odznaki użytkownika

### Movies
- `GET /api/movies/search` - Wyszukiwanie filmów
- `GET /api/movies/:id` - Szczegóły filmu
- `POST /api/movies` - Dodanie filmu (wymaga autoryzacji)

### Watched
- `GET /api/watched` - Lista obejrzanych (wymaga autoryzacji)
- `POST /api/watched` - Dodanie do obejrzanych (wymaga autoryzacji)
- `DELETE /api/watched/:id` - Usunięcie z obejrzanych (wymaga autoryzacji)

### Reviews
- `GET /api/reviews/movie/:movieId` - Recenzje filmu
- `POST /api/reviews` - Dodanie recenzji (wymaga autoryzacji)
- `PUT /api/reviews/:id` - Aktualizacja recenzji (wymaga autoryzacji)
- `DELETE /api/reviews/:id` - Usunięcie recenzji (wymaga autoryzacji)

### Challenges
- `GET /api/challenges` - Lista wyzwań
- `GET /api/challenges/:id` - Szczegóły wyzwania
- `POST /api/challenges` - Utworzenie wyzwania (wymaga autoryzacji)
- `POST /api/challenges/:id/join` - Dołączenie do wyzwania (wymaga autoryzacji)
- `GET /api/challenges/:id/participants` - Uczestnicy wyzwania

### Badges
- `GET /api/badges` - Lista odznak

### Friends
- `GET /api/friends` - Lista znajomych (wymaga autoryzacji)
- `POST /api/friends/request` - Wysłanie zaproszenia (wymaga autoryzacji)
- `PUT /api/friends/:id/respond` - Odpowiedź na zaproszenie (wymaga autoryzacji)
- `DELETE /api/friends/:id` - Usunięcie znajomego (wymaga autoryzacji)

## Struktura projektu

```
movie-tracker/
├── css/
│   └── styles.css          # Style aplikacji
├── js/
│   ├── app.js             # Główna logika frontendu
│   └── firebase-config.js  # Konfiguracja Firebase dla frontendu
├── public/
│   └── uploads/           # Folder na uploady (avatary, etc.)
├── .env                   # Zmienne środowiskowe (nie commitowane)
├── .env.example           # Przykład konfiguracji
├── .gitignore            # Pliki ignorowane przez Git
├── firebase-admin.js      # Konfiguracja Firebase Admin SDK
├── server.js             # Serwer Express z API
├── package.json          # Zależności projektu
├── index.html            # Główna strona HTML
└── README.md             # Ten plik

```

## Rozwój

### Dodawanie nowych funkcji

1. Zdefiniuj endpoint w `server.js`
2. Dodaj odpowiednią kolekcję w Firestore (jeśli potrzebna)
3. Zaktualizuj frontend w `js/app.js`
4. Zaktualizuj dokumentację w README.md

### Testowanie

Możesz użyć narzędzi takich jak Postman lub curl do testowania API:

```bash
# Przykład: Rejestracja użytkownika
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"nickname":"testuser","email":"test@example.com","password":"password123"}'

# Przykład: Logowanie
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

## Bezpieczeństwo

- Hasła są hashowane za pomocą bcryptjs
- API używa JWT do autoryzacji
- Firebase Firestore ma reguły bezpieczeństwa
- Nie commituj pliku `.env` do repozytorium
- Używaj silnych kluczy JWT w produkcji
- Regularnie aktualizuj zależności

## Licencja

MIT

## Autor

LyRooy

## Wsparcie

W razie problemów, utwórz issue na GitHubie.
