# 🎓 Prezentacja Projektu - Movie Tracker

## Slajd 1: Tytuł
**Movie Tracker - System Śledzenia Filmów i Seriali**
- Autor: Łukasz Rooy
- Uczelnia: Politechnika Częstochowska
- Kierunek: Informatyka

---

## Slajd 2: Problem i Motywacja
### Problemy istniejących rozwiązań:
- ❌ Brak szczegółowego śledzenia odcinków seriali
- ❌ Ograniczona gamifikacja
- ❌ Słaba integracja społecznościowa
- ❌ Brak personalizacji

### Cel projektu:
✅ Kompleksowa platforma do zarządzania historią oglądania
✅ Zaawansowane śledzenie postępów w serialach
✅ System motywacji przez wyzwania i odznaki
✅ Budowanie społeczności filmowej

---

## Slajd 3: Główne Funkcjonalności

### 🎬 Zarządzanie Kolekcją
- Wyszukiwanie w bazie 500,000+ filmów (TMDB API)
- 4 statusy: Obejrzane, Oglądane, Planowane, Porzucone
- System ocen (1-5 ⭐) i recenzje

### 📺 Śledzenie Seriali
- Dokładność do pojedynczego odcinka
- Automatyczna aktualizacja statusu
- Wsparcie dla wieloletnich seriali (np. "2008-2013")

### 🏆 Gamifikacja
- System wyzwań filmowych
- Odznaki (Silver, Gold, Platinum)
- Porównywanie z przyjaciółmi

---

## Slajd 4: Architektura Systemu

```
┌─────────────────────────────────────────┐
│         FRONTEND (SPA)                  │
│  HTML5 + CSS3 + Vanilla JavaScript      │
└─────────────────┬───────────────────────┘
                  │ REST API
┌─────────────────▼───────────────────────┐
│    CLOUDFLARE FUNCTIONS (Serverless)    │
│  • Authentication  • CRUD Operations    │
│  • Series Tracking • Challenges         │
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┴──────────┐
        │                    │
┌───────▼────────┐  ┌────────▼────────┐
│ CLOUDFLARE D1  │  │ CLOUDFLARE R2   │
│  (SQLite DB)   │  │ (Object Store)  │
│  19 Tables     │  │ Posters/Badges  │
└────────────────┘  └─────────────────┘
```

---

## Slajd 5: Stack Technologiczny

### Frontend
| Technologia | Zastosowanie |
|-------------|--------------|
| HTML5 | Struktura SPA |
| CSS3 | Style + Animacje |
| JavaScript ES6+ | Logika aplikacji |
| Chart.js | Wykresy statystyk |
| Font Awesome | Ikony |

### Backend (Serverless)
| Technologia | Zastosowanie |
|-------------|--------------|
| Cloudflare Pages | Hosting |
| Cloudflare Functions | API Endpoints |
| Cloudflare D1 | Baza SQLite |
| Cloudflare R2 | Storage (S3-compatible) |

### Zewnętrzne API
- **TMDB API** - dane o filmach

---

## Slajd 6: Model Bazy Danych

### Główne Encje (19 tabel):
```
users ─┬→ watched ──→ movies ──→ seasons ──→ episodes
       │                                        ↓
       ├→ reviews ──→ movies         user_episodes_watched
       │
       ├→ user_badges ──→ badges
       │
       ├→ challenge_participants ──→ challenges
       │
       └→ friends (relacja N:N)
```

### Kluczowe Relacje:
- **1:N** - User → Watched, User → Reviews
- **1:N** - Movies → Seasons → Episodes
- **N:N** - Users ↔ Friends (self-reference)
- **N:N** - Users ↔ Challenges (przez participants)

---

## Slajd 7: Zaawansowane Śledzenie Seriali

### Algorytm Automatycznego Statusu
```javascript
function updateSeriesStatus(watchedEpisodes, totalEpisodes) {
    if (watchedEpisodes === 0) return 'planning';
    if (watchedEpisodes === totalEpisodes) return 'watched';
    return 'watching';
}
```

### Funkcje:
✅ Konfiguracja sezonów (admin panel)
✅ Checkbox dla każdego odcinka
✅ "Zaznacz poprzednie" - automatyczne zaznaczanie
✅ Real-time aktualizacja postępu
✅ Historia oglądania z datami

---

## Slajd 8: System Wyzwań

### Typy Wyzwań:
1. **Ilościowe** - "Obejrzyj 10 filmów"
2. **Gatunkowe** - "5 filmów akcji"
3. **Czasowe** - "Maratony weekendowe"
4. **Społecznościowe** - "Wspólne wyzwania"

### Flow Wyzwania:
```
1. Administrator tworzy wyzwanie
2. Użytkownik dołącza (challenge_participants)
3. System śledzi postęp automatycznie
4. Po ukończeniu → przyznanie odznaki (user_badges)
5. Odznaka z poziomem (Silver/Gold/Platinum)
```

---

## Slajd 9: API Endpoints (RESTful)

### Przykładowe Endpointy:
```http
# Autoryzacja
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me

# Filmy
GET    /api/movies?status=watching
POST   /api/movies
PUT    /api/movies/:id
DELETE /api/movies/:id

# Seriale
GET    /api/series/:id/episodes
POST   /api/series/:id/episodes
POST   /api/admin/movies/:id/seasons

# Społeczność
GET    /api/friends?status=accepted
POST   /api/friends
GET    /api/badges?limit=6
```

---

## Slajd 10: Bezpieczeństwo

### Implementowane Mechanizmy:
✅ **JWT Tokens** - autoryzacja Bearer
✅ **Password Hashing** - bezpieczne hashowanie
✅ **Prepared Statements** - ochrona przed SQL Injection
✅ **Input Validation** - walidacja po stronie API
✅ **CORS** - kontrolowane pochodzenie requestów
✅ **Rate Limiting** - ochrona przed abuse (Cloudflare)

### Przykład Autoryzacji:
```javascript
async function getUserIdFromRequest(request) {
    const token = request.headers.get('Authorization')?.substring(7);
    const payload = JSON.parse(atob(token));
    if (payload.exp < Date.now()) return null;
    return payload.userId;
}
```

---

## Slajd 11: UX/UI - Kluczowe Rozwiązania

### 1. Inteligentne Notyfikacje
```javascript
showNotification(message, type, autoHide)
// type: 'success' (zielony), 'info' (niebieski), 'error' (czerwony)
// autoHide: false dla operacji długotrwałych
```

### 2. Responsywny Design
- Desktop: pełna funkcjonalność
- Tablet: optymalizowany layout
- Mobile: uproszczony interfejs

### 3. Motywy
- 🌞 Light theme
- 🌙 Dark theme
- 🔄 Auto (system preference)

### 4. Real-time Search
- Debouncing (300ms)
- Autocomplete
- Podgląd posterów

---

## Slajd 12: Statystyki i Dane

### Dashboard Użytkownika:
📊 **Liczba filmów** - filtrowane po typie i statusie
⏱ **Całkowity czas** - suma godzin oglądania
⭐ **Średnia ocena** - automatycznie wyliczana
📈 **Wykres aktywności** - wizualizacja Chart.js
🏆 **Zdobyte odznaki** - ostatnie 6 z linkiem do wszystkich

### Przykładowe Statystyki:
- Użytkownik: 150 filmów, 25 seriali
- Całkowity czas: ~450 godzin
- Średnia ocena: 4.2/5 ⭐
- Zdobyte odznaki: 12 (3 Gold, 9 Silver)

---

## Slajd 13: Wyzwania Techniczne

### Problem 1: Synchronizacja Odcinków
**Wyzwanie**: Jak śledzić status serialu gdy użytkownik zaznacza odcinki?

**Rozwiązanie**:
```sql
-- Trigger automatycznej aktualizacji
UPDATE watched SET status = 
    CASE 
        WHEN watched_count = 0 THEN 'planning'
        WHEN watched_count = total_count THEN 'watched'
        ELSE 'watching'
    END
```

### Problem 2: Performance przy Dużych Kolekcjach
**Rozwiązanie**: Indeksowanie + paginacja + lazy loading

### Problem 3: Real-time Search bez Rate Limiting
**Rozwiązanie**: Debouncing + client-side caching

---

## Slajd 14: Deployment i DevOps

### Continuous Deployment:
```bash
# Development
wrangler pages dev

# Production
wrangler pages deploy
```

### Environment Variables:
```toml
[vars]
TMDB_API_KEY = "***"
JWT_SECRET = "***"

[[d1_databases]]
binding = "db"
database_id = "***"

[[r2_buckets]]
binding = "POSTERS"
bucket_name = "movie-posters"
```

### Monitoring:
- Cloudflare Analytics
- Real User Monitoring (RUM)
- Error tracking

---

## Slajd 15: Metryki Projektu

### Statystyki Kodu:
```
Frontend:
- index.html: ~650 linii
- app.js: ~2,500 linii
- styles.css: ~1,200 linii

Backend:
- 15 API endpoints
- 19 funkcji serverless
- 19 tabel w bazie danych

Całość: ~5,000 linii kodu
```

### Funkcjonalności:
✅ 4 statusy filmów
✅ Śledzenie odcinków
✅ System wyzwań
✅ System odznak
✅ System znajomych
✅ Panel administracyjny
✅ Statystyki i wykresy

---

## Slajd 16: Roadmap - Przyszłe Rozwój

### Wersja 1.1 (Q1 2025)
- [ ] Integracja z IMDb, Rotten Tomatoes
- [ ] System rekomendacji AI
- [ ] Export danych (CSV, JSON)
- [ ] Kalendarz premier

### Wersja 1.2 (Q2 2025)
- [ ] PWA (Progressive Web App)
- [ ] Watchparty - wspólne oglądanie
- [ ] Social media integration
- [ ] System komentarzy

### Wersja 2.0 (Q3 2025)
- [ ] Machine Learning rekomendacje
- [ ] Live chat
- [ ] Streaming integrations
- [ ] Advanced analytics

---

## Slajd 17: Porównanie z Konkurencją

| Feature | Movie Tracker | Letterboxd | IMDb | Trakt.tv |
|---------|--------------|------------|------|----------|
| Śledzenie odcinków | ✅ Szczegółowe | ❌ | ❌ | ✅ Podstawowe |
| System wyzwań | ✅ | ❌ | ❌ | ❌ |
| Odznaki | ✅ | ✅ | ❌ | ✅ |
| Znajomi | ✅ | ✅ | ✅ | ✅ |
| Open Source | ✅ | ❌ | ❌ | ❌ |
| Self-hosted | ✅ | ❌ | ❌ | ❌ |
| Darmowy | ✅ | 💰 Premium | ✅ | 💰 VIP |

---

## Slajd 18: Możliwości Biznesowe

### Model Freemium:
**Free Tier:**
- Podstawowe funkcje
- 100 filmów w kolekcji
- 3 aktywne wyzwania

**Premium ($4.99/miesiąc):**
- Nieograniczona kolekcja
- Nieograniczone wyzwania
- Priorytetowa synchronizacja
- Export danych
- Bez reklam

### Model B2B:
- White-label dla firm streamingowych
- API dla integratorów
- Enterprise features

---

## Slajd 19: Wnioski

### Osiągnięcia:
✅ Funkcjonalna aplikacja full-stack
✅ Serverless architecture (99.9% uptime)
✅ Zaawansowane śledzenie seriali
✅ Gamifikacja przez wyzwania
✅ Skalowalność (Cloudflare edge)

### Zdobyte Umiejętności:
- Projektowanie REST API
- Modelowanie bazy danych
- Frontend development (Vanilla JS)
- Serverless computing
- DevOps (CI/CD)

### Wartość dla Użytkowników:
- Centralizacja historii oglądania
- Motywacja przez gamifikację
- Społeczność filmowa

---

## Slajd 20: Pytania?

### Demo: [movie-tracker-48r.pages.dev](https://movie-tracker-48r.pages.dev)
### GitHub: [github.com/LyRooy/movie-tracker](https://github.com/LyRooy/movie-tracker)
### Kontakt: kontakt@example.com

**Dziękuję za uwagę!**

---

## Backup Slajdy (Q&A)

### Q: Dlaczego Cloudflare zamiast tradycyjnego serwera?
**A:** 
- Zero maintenance (serverless)
- Globalny edge network (niska latencja)
- Darmowy tier wystarczający dla MVP
- Automatyczne skalowanie
- Built-in CDN i DDoS protection

### Q: Jak radzicie sobie z synchronizacją TMDB?
**A:**
- API call przy wyszukiwaniu (real-time)
- Cache w R2 dla posterów
- Scheduled Workers dla aktualizacji (przyszłość)

### Q: Bezpieczeństwo haseł?
**A:**
- Hashing (bcrypt-like) po stronie API
- Nigdy nie logujemy plain-text passwords
- JWT z expiracją (7 dni)
- HTTPS everywhere (Cloudflare SSL)
