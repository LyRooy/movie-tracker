# MovieTracker - Cloudflare D1 Edition

MovieTracker to aplikacja do śledzenia obejrzanych filmów i seriali, zbudowana z użyciem Cloudflare D1 jako bazy danych i Cloudflare Workers jako backendu.

## Spis treści
- [Funkcje](#funkcje)
- [Technologie](#technologie)
- [Schemat bazy danych](#schemat-bazy-danych)
- [Instalacja](#instalacja)
- [Konfiguracja Cloudflare](#konfiguracja-cloudflare)
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

### Backend
- Cloudflare Workers - serverless compute
- Cloudflare D1 - serverless SQL database (SQLite)
- Cloudflare R2 - object storage (dla uploadów)
- Hono.js - szybki framework webowy dla Workers
- JWT Authentication
- bcryptjs - hashowanie haseł

## Schemat bazy danych

Aplikacja wykorzystuje Cloudflare D1 (SQLite) z następującymi tabelami:

### Users
```sql
CREATE TABLE Users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  description TEXT,
  role TEXT CHECK(role IN ('admin', 'user', 'guest')) DEFAULT 'user',
  theme_preference TEXT CHECK(theme_preference IN ('light', 'dark')) DEFAULT 'light',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Movies
```sql
CREATE TABLE Movies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  release_date DATE,
  type TEXT CHECK(type IN ('movie', 'series')) NOT NULL,
  genre TEXT,
  description TEXT,
  poster_url TEXT,
  trailer_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Watched
```sql
CREATE TABLE Watched (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  movie_id INTEGER NOT NULL,
  watched_date DATE NOT NULL,
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
  FOREIGN KEY (movie_id) REFERENCES Movies(id) ON DELETE CASCADE
);
```

### Reviews
```sql
CREATE TABLE Reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  movie_id INTEGER NOT NULL,
  content TEXT,
  rating INTEGER CHECK(rating >= 1 AND rating <= 5) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
  FOREIGN KEY (movie_id) REFERENCES Movies(id) ON DELETE CASCADE
);
```

### Challenges
```sql
CREATE TABLE Challenges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  criteria_value TEXT,
  target_count INTEGER NOT NULL,
  start_date DATETIME NOT NULL,
  end_date DATETIME,
  badge_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (badge_id) REFERENCES Badges(id)
);
```

### Challenge_Participants
```sql
CREATE TABLE Challenge_Participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  challenge_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  progress INTEGER DEFAULT 0,
  FOREIGN KEY (challenge_id) REFERENCES Challenges(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);
```

### Challenge_Watched
```sql
CREATE TABLE Challenge_Watched (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  challenge_participant_id INTEGER NOT NULL,
  movie_id INTEGER NOT NULL,
  watched_date DATE NOT NULL,
  FOREIGN KEY (challenge_participant_id) REFERENCES Challenge_Participants(id) ON DELETE CASCADE,
  FOREIGN KEY (movie_id) REFERENCES Movies(id) ON DELETE CASCADE
);
```

### Badges
```sql
CREATE TABLE Badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### User_Badges
```sql
CREATE TABLE User_Badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  badge_id INTEGER NOT NULL,
  challenge_participant_id INTEGER,
  level TEXT CHECK(level IN ('silver', 'gold', 'platinum', 'none')) DEFAULT 'none',
  earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
  FOREIGN KEY (badge_id) REFERENCES Badges(id) ON DELETE CASCADE,
  FOREIGN KEY (challenge_participant_id) REFERENCES Challenge_Participants(id)
);
```

### Friends
```sql
CREATE TABLE Friends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user1_id INTEGER NOT NULL,
  user2_id INTEGER NOT NULL,
  status TEXT CHECK(status IN ('pending', 'accepted', 'rejected', 'blocked')) DEFAULT 'pending',
  requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  responded_at DATETIME,
  FOREIGN KEY (user1_id) REFERENCES Users(id) ON DELETE CASCADE,
  FOREIGN KEY (user2_id) REFERENCES Users(id) ON DELETE CASCADE
);
```

## Instalacja

1. Zainstaluj Wrangler CLI (narzędzie Cloudflare):
```bash
npm install -g wrangler
```

2. Zaloguj się do Cloudflare:
```bash
wrangler login
```

3. Sklonuj repozytorium:
```bash
git clone https://github.com/LyRooy/movie-tracker.git
cd movie-tracker
git checkout copilot/cloudflare-database-config
```

4. Zainstaluj zależności:
```bash
npm install
```

## Konfiguracja Cloudflare

### 1. Utwórz bazę danych D1

```bash
# Utwórz bazę danych D1
wrangler d1 create movie-tracker-db

# Skopiuj database_id i database_name do wrangler.toml
```

### 2. Uruchom migracje bazy danych

```bash
# Zastosuj schemat bazy danych
wrangler d1 execute movie-tracker-db --local --file=./cloudflare/schema.sql

# Dla produkcji (bez --local):
wrangler d1 execute movie-tracker-db --file=./cloudflare/schema.sql
```

### 3. Dodaj przykładowe dane

```bash
# Lokalne
wrangler d1 execute movie-tracker-db --local --file=./cloudflare/seed.sql

# Produkcja
wrangler d1 execute movie-tracker-db --file=./cloudflare/seed.sql
```

### 4. Skonfiguruj R2 (dla uploadów)

```bash
# Utwórz bucket R2 dla uploadów
wrangler r2 bucket create movie-tracker-uploads
```

### 5. Skonfiguruj zmienne środowiskowe

Edytuj `wrangler.toml` i uzupełnij wartości:

```toml
name = "movie-tracker"
main = "cloudflare/worker.js"
compatibility_date = "2024-01-01"

[vars]
JWT_SECRET = "twoj-bardzo-bezpieczny-losowy-klucz"

[[d1_databases]]
binding = "DB"
database_name = "movie-tracker-db"
database_id = "twoje-database-id"

[[r2_buckets]]
binding = "UPLOADS"
bucket_name = "movie-tracker-uploads"
```

## Uruchomienie

### Tryb lokalny (development):
```bash
npm run dev:cloudflare
# lub
wrangler dev
```

### Deploy do Cloudflare Workers:
```bash
npm run deploy:cloudflare
# lub
wrangler deploy
```

Po deploymencie aplikacja będzie dostępna pod adresem:
```
https://movie-tracker.twoja-subdomena.workers.dev
```

## Zalety Cloudflare D1

### 🚀 Wydajność
- **Edge computing** - Worker uruchamia się w ponad 300 lokalizacjach na świecie
- **Niskie opóźnienia** - baza danych D1 jest replikowana globalnie
- **Auto-scaling** - automatyczne skalowanie bez konfiguracji

### 💰 Koszty
- **Free tier**:
  - 100,000 zapytań dziennie
  - 5 GB storage
  - 10 GB transfer
- **Paid tier** - bardzo konkurencyjne ceny pay-as-you-go

### 🔒 Bezpieczeństwo
- **DDoS protection** wbudowana
- **Rate limiting** na poziomie Cloudflare
- **WAF** (Web Application Firewall) dostępny

### 🛠️ Developer Experience
- **SQL** - standardowy SQL (SQLite)
- **Wrangler CLI** - świetne narzędzie deweloperskie
- **Local development** - pełne środowisko lokalne
- **Git integration** - łatwe CI/CD

## Porównanie: Firebase vs Cloudflare D1

| Feature | Firebase Firestore | Cloudflare D1 |
|---------|-------------------|---------------|
| **Typ bazy** | NoSQL (dokumentowa) | SQL (SQLite) |
| **Lokalizacja** | Multi-region | Global edge |
| **Cold start** | ~100-500ms | ~0-10ms |
| **Koszty** | $0.06/100k reads | $0.001/1k queries |
| **Query** | Limited queries | Full SQL |
| **Transactions** | Limited | ACID compliant |
| **Learning curve** | Średnia | Niska (SQL) |
| **Offline support** | Tak (SDK) | Nie (edge only) |

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
- `POST /api/movies` - Dodanie filmu

### Watched
- `GET /api/watched` - Lista obejrzanych
- `POST /api/watched` - Dodanie do obejrzanych
- `DELETE /api/watched/:id` - Usunięcie z obejrzanych

### Reviews
- `GET /api/reviews/movie/:movieId` - Recenzje filmu
- `POST /api/reviews` - Dodanie recenzji
- `PUT /api/reviews/:id` - Aktualizacja recenzji
- `DELETE /api/reviews/:id` - Usunięcie recenzji

### Challenges
- `GET /api/challenges` - Lista wyzwań
- `GET /api/challenges/:id` - Szczegóły wyzwania
- `POST /api/challenges` - Utworzenie wyzwania
- `POST /api/challenges/:id/join` - Dołączenie do wyzwania
- `GET /api/challenges/:id/participants` - Uczestnicy wyzwania

### Badges
- `GET /api/badges` - Lista odznak

### Friends
- `GET /api/friends` - Lista znajomych
- `POST /api/friends/request` - Wysłanie zaproszenia
- `PUT /api/friends/:id/respond` - Odpowiedź na zaproszenie
- `DELETE /api/friends/:id` - Usunięcie znajomego

## Struktura projektu

```
movie-tracker/
├── cloudflare/
│   ├── worker.js          # Główny Worker (API)
│   ├── schema.sql         # Schemat bazy danych
│   ├── seed.sql           # Przykładowe dane
│   └── migrations/        # Migracje bazy danych
├── css/
│   └── styles.css
├── js/
│   └── app.js
├── wrangler.toml          # Konfiguracja Cloudflare
├── package.json
└── index.html
```

## Monitoring i Debugging

### Logi
```bash
# Podgląd logów w czasie rzeczywistym
wrangler tail
```

### Metryki
Dostępne w Cloudflare Dashboard:
- Request count
- Response time
- Error rate
- Database queries

### Local debugging
```bash
# Uruchom z debuggerem
wrangler dev --local --inspect
```

## Bezpieczeństwo

- Hasła są hashowane za pomocą bcryptjs
- API używa JWT do autoryzacji
- Rate limiting na poziomie Cloudflare Workers
- CORS skonfigurowany
- SQL injection protection (prepared statements)
- XSS protection

## Migracja z Firebase

Jeśli migrujesz z wersji Firebase:

1. **Export danych z Firestore**:
```bash
# Użyj Firebase Admin SDK do exportu
node firebase-export.js
```

2. **Import do D1**:
```bash
# Konwertuj JSON na SQL
node convert-to-sql.js
wrangler d1 execute movie-tracker-db --file=./import.sql
```

3. **Aktualizuj frontend**:
- Zmień URL API na Cloudflare Worker
- Pozostała logika pozostaje bez zmian

## Licencja

MIT

## Autor

LyRooy

## Wsparcie

W razie problemów:
- GitHub Issues
- Cloudflare Community: https://community.cloudflare.com
- Cloudflare Discord: https://discord.gg/cloudflaredev
