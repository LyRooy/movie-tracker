# 🎬 Movie Tracker - System Śledzenia Filmów i Seriali

> Nowoczesna aplikacja webowa do zarządzania listą obejrzanych filmów i seriali z zaawansowanym systemem śledzenia odcinków, wyzwań i odznak.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)

---

## 📋 Spis Treści

- [O Projekcie](#o-projekcie)
- [Główne Funkcje](#główne-funkcje)
- [Architektura Techniczna](#architektura-techniczna)
- [Technologie](#technologie)
- [Struktura Bazy Danych](#struktura-bazy-danych)
- [Instalacja i Konfiguracja](#instalacja-i-konfiguracja)
- [API Endpoints](#api-endpoints)
- [Funkcjonalności](#funkcjonalności)
- [Bezpieczeństwo](#bezpieczeństwo)
- [Roadmap](#roadmap)

---

## 🎯 O Projekcie

**Movie Tracker** to kompleksowa aplikacja webowa zaprojektowana dla miłośników filmów i seriali. System umożliwia użytkownikom katalogowanie obejrzanych treści, śledzenie postępów w serialach z dokładnością do pojedynczych odcinków, uczestnictwo w wyzwaniach filmowych oraz zdobywanie odznak za osiągnięcia.

### Cel Projektu

Stworzenie intuicyjnej platformy, która:
- Centralizuje informacje o filmach i serialach użytkownika
- Gamifikuje doświadczenie oglądania poprzez system wyzwań i odznak
- Umożliwia budowanie społeczności poprzez system znajomych

---

## ⭐ Główne Funkcje

### 🎬 Zarządzanie Treściami
- **Wyszukiwanie filmów i seriali** - W własnej bazie danych
- **Kategorie statusów**: Obejrzane, Obecnie oglądane, Planowane, Porzucone
- **System ocen** - ocena od 1 do 5 gwiazdek
- **Recenzje** - pisanie własnych opinii o filmach

### 📺 Zaawansowane Śledzenie Seriali
- **Śledzenie odcinków** - dokładność do pojedynczego odcinka
- **Zarządzanie sezonami** - konfiguracja liczby odcinków per sezon
- **Automatyczna aktualizacja statusu** - serial zmienia status w zależności od postępu
- **Wsparcie dla zakresów lat** - np. "2008-2013" dla seriali wieloletnich

### 🏆 System Wyzwań i Odznak
- **Wyzwania filmowe** - np. "Obejrzyj 10 filmów akcji w miesiąc"
- **Odznaki za osiągnięcia** - z poziomami: Silver, Gold, Platinum
- **Śledzenie postępu** - wizualizacja postępu w wyzwaniach
- **Historia odznak** - zapis zdobytych osiągnięć z datami

### 👥 System Społecznościowy
- **Znajomi** - dodawanie i zarządzanie kontaktami
- **Zaproszenia** - system zaproszeń do znajomych
- **Porównywanie statystyk** - konkurowanie z przyjaciółmi

### 📊 Dashboard i Statystyki
- **Liczba obejrzanych filmów** - filtrowanie po typie (film/serial)
- **Całkowity czas** - suma godzin spędzonych na oglądaniu
- **Średnia ocena** - automatycznie wyliczana średnia z ocen
- **Wykres aktywności** - wizualizacja aktywności w czasie

---

## 🏗 Architektura Techniczna

### Frontend
```
├── index.html          # Główny plik HTML (SPA)
├── css/
│   └── styles.css      # Style aplikacji
└── js/
    └── app.js          # Główna logika aplikacji (ES6)
```

### Backend (Cloudflare)
```
functions/
├── api/
│   ├── movies.js                    # CRUD filmów/seriali
│   ├── search.js                    # Wyszukiwanie w bazie
│   ├── badges.js                    # System odznak
│   ├── friends.js                   # System znajomych
│   ├── challenges.js                # System wyzwań
│   ├── movies/
│   │   └── [id].js                  # Operacje na pojedynczym filmie
│   ├── series/
│   │   └── [id]/
│   │       └── episodes.js          # Zarządzanie odcinkami
│   ├── admin/
│   │   ├── movies.js                # Panel administracyjny
│   │   ├── badges.js                # Zarządzanie odznakami
│   │   ├── challenges.js            # Zarządzanie wyzwaniami
│   │   └── movies/
│   │       └── [id]/
│   │           └── seasons.js       # Konfiguracja sezonów
│   ├── auth/
│   │   ├── login.js                 # Logowanie
│   │   ├── register.js              # Rejestracja
│   │   ├── me.js                    # Dane użytkownika
│   │   ├── avatar.js                # Upload avatara
│   │   ├── theme.js                 # Zmiana motywu
│   │   └── delete.js                # Usunięcie konta
│   └── users/
│       └── search.js                # Wyszukiwanie użytkowników
```

### Baza Danych (D1 SQLite)
- **Cloudflare D1** - serverless SQL database
- **19 tabel** - pełna relacyjna struktura
- **Indeksy** - zoptymalizowane zapytania

### Storage (R2)
- **Cloudflare R2** - przechowywanie posterów i awatarów
- **Public bucket** - szybki dostęp do obrazów
- **CDN** - automatyczne cachowanie

---

## 💻 Technologie

### Frontend Stack
| Technologia | Wersja | Zastosowanie |
|------------|--------|--------------|
| **HTML5** | - | Struktura aplikacji |
| **CSS3** | - | Style i animacje |
| **JavaScript (ES6+)** | - | Logika aplikacji |
| **Font Awesome** | 6.4.0 | Ikony |
| **Chart.js** | 4.4.0 | Wykresy statystyk |

### Backend Stack
| Technologia | Zastosowanie |
|------------|--------------|
| **Cloudflare Pages** | Hosting aplikacji |
| **Cloudflare Functions** | Serverless API |
| **Cloudflare D1** | Baza danych SQLite |
| **Cloudflare R2** | Object storage |

---

## 🗄 Struktura Bazy Danych

### Główne Tabele

#### 👤 Użytkownicy (`users`)
```sql
- id (PRIMARY KEY)
- nickname (TEXT)
- email (UNIQUE)
- password_hash
- avatar_url
- description
- role (admin/user)
- theme_preference (light/dark)
- created_at
```

#### 🎬 Filmy i Seriale (`movies`)
```sql
- id (PRIMARY KEY)
- title
- release_date
- media_type (movie/series)
- genre
- description
- poster_url
- trailer_url
- total_seasons
- total_episodes
- created_at
```

#### 📺 Sezony (`seasons`)
```sql
- id (PRIMARY KEY)
- series_id (FOREIGN KEY → movies)
- season_number
- episode_count
- title
- air_date
- UNIQUE(series_id, season_number)
```

#### 🎞 Odcinki (`episodes`)
```sql
- id (PRIMARY KEY)
- season_id (FOREIGN KEY → seasons)
- episode_number
- title
- description
- air_date
- duration
- UNIQUE(season_id, episode_number)
```

#### ✅ Obejrzane (`watched`)
```sql
- id (PRIMARY KEY)
- user_id (FOREIGN KEY → users)
- movie_id (FOREIGN KEY → movies)
- watched_date
- status (watched/watching/planning/dropped)
```

#### 📝 Recenzje (`reviews`)
```sql
- id (PRIMARY KEY)
- user_id (FOREIGN KEY → users)
- movie_id (FOREIGN KEY → movies)
- content
- rating (1-5)
- created_at
- updated_at
```

#### 👀 Obejrzane Odcinki (`user_episodes_watched`)
```sql
- id (PRIMARY KEY)
- user_id (FOREIGN KEY → users)
- episode_id (FOREIGN KEY → episodes)
- watched_date
- UNIQUE(user_id, episode_id)
```

#### 🏆 Odznaki (`badges`)
```sql
- id (PRIMARY KEY)
- name
- description
- image_url
- created_at
```

#### 🎖 Odznaki Użytkowników (`user_badges`)
```sql
- id (PRIMARY KEY)
- user_id (FOREIGN KEY → users)
- badge_id (FOREIGN KEY → badges)
- challenge_participant_id
- level (silver/gold/platinum/none)
- earned_at
```

#### 🎯 Wyzwania (`challenges`)
```sql
- id (PRIMARY KEY)
- title
- description
- type
- criteria_value
- target_count
- start_date
- end_date
- badge_id (FOREIGN KEY → badges)
```

#### 🤝 Znajomi (`friends`)
```sql
- id (PRIMARY KEY)
- user1_id (FOREIGN KEY → users)
- user2_id (FOREIGN KEY → users)
- status (pending/accepted/rejected/blocked)
- requested_at
- responded_at
- UNIQUE(user1_id, user2_id)
```

### Relacje
```
users ──┬─→ watched ──→ movies ──→ seasons ──→ episodes
        │                                         ↓
        ├─→ reviews ──→ movies           user_episodes_watched
        │                                         ↑
        ├─→ user_badges ──→ badges               │
        │                                        users
        ├─→ challenge_participants ──→ challenges
        │                                         ↓
        └─→ friends (self-reference)      challenge_watched
```

---

## 🚀 Instalacja i Konfiguracja

### Wymagania
- Node.js 18+
- Wrangler CLI
- Konto Cloudflare

### Krok 1: Klonowanie Repozytorium
```bash
git clone https://github.com/LyRooy/movie-tracker.git
cd movie-tracker
```

### Krok 2: Instalacja Wrangler
```bash
npm install -g wrangler
wrangler login
```

### Krok 3: Konfiguracja D1
```bash
# Utwórz bazę danych
wrangler d1 create movie-tracker-db

# Importuj schemat
wrangler d1 execute movie-tracker-db --file=./schema.sql
```

### Krok 4: Konfiguracja R2
```bash
# Utwórz bucket dla posterów
wrangler r2 bucket create movie-posters

# Utwórz bucket dla odznak
wrangler r2 bucket create movie-tracker-badges
```

### Krok 5: Konfiguracja wrangler.toml
```toml
name = "movie-tracker"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "db"
database_name = "movie-tracker-db"
database_id = "your-database-id"

[[r2_buckets]]
binding = "POSTERS"
bucket_name = "movie-posters"

[[r2_buckets]]
binding = "BADGES"
bucket_name = "movie-tracker-badges"

[vars]
R2_PUBLIC_URL = "https://pub-xxxxx.r2.dev"
R2_PUBLIC_URL_BADGES = "https://pub-xxxxx.r2.dev"
```

### Krok 6: Deployment
```bash
# Development
wrangler pages dev

# Production
wrangler pages deploy
```

---

## 🔌 API Endpoints

### Autoryzacja
- `POST /api/auth/register` - Rejestracja użytkownika
- `POST /api/auth/login` - Logowanie
- `GET /api/auth/me` - Dane zalogowanego użytkownika
- `PUT /api/auth/theme` - Zmiana motywu
- `POST /api/auth/avatar` - Przesyłanie avatara (FormData)
- `DELETE /api/auth/delete` - Usunięcie konta (wymaga potwierdzenia "USUN KONTO")

### Filmy i Seriale
- `GET /api/movies` - Lista filmów użytkownika
- `POST /api/movies` - Dodaj film do listy
- `GET /api/movies/:id` - Szczegóły filmu
- `PUT /api/movies/:id` - Aktualizuj film
- `DELETE /api/movies/:id` - Usuń z listy
- `GET /api/search?query=...` - Wyszukaj w bazie

### Odcinki Seriali
- `GET /api/series/:id/episodes` - Lista odcinków
- `POST /api/series/:id/episodes` - Oznacz odcinek
- `GET /api/admin/movies/:id/seasons` - Pobierz sezony
- `POST /api/admin/movies/:id/seasons` - Konfiguruj sezony

### Odznaki
- `GET /api/badges?limit=6` - Lista odznak użytkownika
- `GET /api/admin/badges` - Wszystkie odznaki (admin)
- `POST /api/admin/badges` - Utwórz odznakę z obrazkiem (FormData: name, description, image)
- `PUT /api/admin/badges` - Zaktualizuj odznakę (FormData: id, name, description, image)
- `DELETE /api/admin/badges?id=X` - Usuń odznakę i plik z R2

### Znajomi
- `GET /api/friends?status=accepted` - Lista znajomych
- `POST /api/friends` - Wyślij zaproszenie
- `PUT /api/friends` - Odpowiedz na zaproszenie
- `DELETE /api/friends` - Usuń znajomego
- `GET /api/users/search?q=nick` - Szukaj użytkowników

### Wyzwania
- `GET /api/challenges` - Lista wyzwań
- `POST /api/challenges/:id/join` - Dołącz do wyzwania
- `GET /api/challenges/:id/progress` - Postęp w wyzwaniu

---

## 🎨 Funkcjonalności

### 1. System Śledzenia Odcinków
```javascript
// Automatyczna aktualizacja statusu serialu
- 0 odcinków → status: 'planning'
- 1+ odcinków → status: 'watching'
- Wszystkie odcinki → status: 'watched'
```

### 2. Inteligentne Wyszukiwanie
- Debouncing (300ms)
- Podgląd posters
- Automatyczne rozróżnianie film/serial

### 3. System Notyfikacji
```javascript
showNotification(message, type, autoHide)
// type: 'success', 'info', 'error'
// autoHide: true/false
```

### 4. Responsywność
- Desktop: pełna funkcjonalność
- Tablet: optymalizowany layout
- Mobile: uproszczony interfejs

### 5. Motywy
- Jasny motyw
- Ciemny motyw
- Automatyczne przełączanie

---

## 🔒 Bezpieczeństwo

### Autoryzacja
- **JWT Tokens** - Bearer authentication
- **Password Hashing** - bezpieczne hashowanie haseł
- **Session Management** - zarządzanie sesjami

### Walidacja
- **Input Sanitization** - czyszczenie danych wejściowych
- **SQL Injection Protection** - prepared statements
- **XSS Protection** - escape HTML

### CORS
```javascript
{
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}
```


## 📊 Diagram Bazy Danych

Diagram można wygenerować używając:

### Opcja 1: dbdiagram.io
```
// Wejdź na https://dbdiagram.io
// Wklej schemat SQL
// Export do PNG/PDF
```

### Opcja 2: SchemaSpy
```bash
npm install -g schemaspy
schemaspy -t sqlite -db movie-tracker.db -o docs/schema
```

### Opcja 3: DBeaver
```
1. Otwórz bazę w DBeaver
2. Wybierz Database → ER Diagram
3. Export to Image (PNG/SVG)
```

---

## 👨‍💻 Autor

**LRooy**
- GitHub: [@LyRooy](https://github.com/LyRooy)
- Projekt: Praca inżynierska - Politechnika Częstochowska

---

## 📝 Licencja

MIT License - szczegóły w pliku `LICENSE`

---
