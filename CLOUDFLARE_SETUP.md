# Przewodnik konfiguracji Cloudflare dla MovieTracker

Ten dokument zawiera szczegółowy przewodnik krok po kroku, jak skonfigurować Cloudflare D1 i Workers dla projektu MovieTracker.

## Spis treści
1. [Wymagania wstępne](#1-wymagania-wstępne)
2. [Instalacja Wrangler CLI](#2-instalacja-wrangler-cli)
3. [Tworzenie bazy danych D1](#3-tworzenie-bazy-danych-d1)
4. [Konfiguracja projektu](#4-konfiguracja-projektu)
5. [Inicjalizacja bazy danych](#5-inicjalizacja-bazy-danych)
6. [Lokalne testowanie](#6-lokalne-testowanie)
7. [Deployment](#7-deployment)

## 1. Wymagania wstępne

### Konto Cloudflare
- Utwórz darmowe konto na [cloudflare.com](https://www.cloudflare.com/)
- Nie musisz mieć domeny - Workers działają na subdomenach Cloudflare

### Node.js
- Zainstaluj Node.js w wersji 16.x lub wyższej
- Sprawdź: `node --version`

## 2. Instalacja Wrangler CLI

Wrangler to oficjalne narzędzie CLI Cloudflare do zarządzania Workers i D1.

### Globalnie (zalecane):
```bash
npm install -g wrangler
```

### Lub lokalnie w projekcie:
```bash
npm install --save-dev wrangler
```

### Weryfikacja:
```bash
wrangler --version
```

### Logowanie do Cloudflare:
```bash
wrangler login
```

To otworzy przeglądarkę i poprosi o autoryzację. Po zalogowaniu Wrangler będzie miał dostęp do Twojego konta.

## 3. Tworzenie bazy danych D1

### Krok 3.1: Utwórz bazę danych

```bash
wrangler d1 create movie-tracker-db
```

Otrzymasz output podobny do:
```
✅ Successfully created DB 'movie-tracker-db' in region WEUR
Created your new D1 database.

[[d1_databases]]
binding = "DB"
database_name = "movie-tracker-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**WAŻNE:** Skopiuj `database_id` - będzie Ci potrzebny!

### Krok 3.2: Lista baz danych (opcjonalnie)

```bash
wrangler d1 list
```

## 4. Konfiguracja projektu

### Krok 4.1: Sklonuj branch z konfiguracją Cloudflare

```bash
git clone https://github.com/LyRooy/movie-tracker.git
cd movie-tracker
git checkout copilot/cloudflare-database-config
```

### Krok 4.2: Zainstaluj zależności

```bash
npm install
```

### Krok 4.3: Edytuj wrangler.toml

Otwórz plik `wrangler.toml` i:

1. **Zmień `database_id`** na ID z kroku 3.1:
```toml
[[d1_databases]]
binding = "DB"
database_name = "movie-tracker-db"
database_id = "twoje-database-id-tutaj"  # ← ZMIEŃ TO
```

2. **Zmień JWT_SECRET** na bezpieczny klucz:
```toml
[vars]
JWT_SECRET = "twoj-bardzo-bezpieczny-losowy-klucz"  # ← ZMIEŃ TO
```

Możesz wygenerować bezpieczny klucz:
```bash
# Linux/Mac:
openssl rand -base64 32

# Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Krok 4.4: (Opcjonalnie) Ustaw nazwę Worker

W `wrangler.toml` możesz zmienić nazwę:
```toml
name = "movie-tracker"  # ← To będzie nazwa Twojego Workera
```

Worker będzie dostępny pod:
```
https://movie-tracker.twoja-subdomena.workers.dev
```

## 5. Inicjalizacja bazy danych

### Krok 5.1: Zastosuj schemat (lokalne środowisko)

```bash
wrangler d1 execute movie-tracker-db --local --file=./cloudflare/schema.sql
```

Output:
```
🌀 Mapping SQL input into an array of statements
🌀 Parsing 10 statements
🌀 Executing on movie-tracker-db (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx):
🌀 To execute on your remote database, remove the --local flag from your wrangler command.
🚣 Executed 10 commands in 0.123ms
```

### Krok 5.2: Dodaj przykładowe dane (lokalnie)

```bash
wrangler d1 execute movie-tracker-db --local --file=./cloudflare/seed.sql
```

### Krok 5.3: Zweryfikuj dane (lokalnie)

```bash
wrangler d1 execute movie-tracker-db --local --command="SELECT * FROM Movies"
```

### Krok 5.4: Zastosuj schemat w produkcji

**TYLKO gdy jesteś gotowy do produkcji:**
```bash
# Usuń --local, aby wykonać na produkcyjnej bazie
wrangler d1 execute movie-tracker-db --file=./cloudflare/schema.sql
wrangler d1 execute movie-tracker-db --file=./cloudflare/seed.sql
```

## 6. Lokalne testowanie

### Krok 6.1: Uruchom Worker lokalnie

```bash
wrangler dev
# lub
npm run dev:cloudflare
```

Output:
```
⛅️ wrangler 3.22.1
-------------------
⬣ Listening at http://localhost:8787
```

### Krok 6.2: Testuj API

Otwórz nową terminal i testuj endpointy:

**Health check:**
```bash
curl http://localhost:8787/health
```

**Rejestracja:**
```bash
curl -X POST http://localhost:8787/api/register \
  -H "Content-Type: application/json" \
  -d '{"nickname":"testuser","email":"test@example.com","password":"password123"}'
```

**Logowanie:**
```bash
curl -X POST http://localhost:8787/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

**Wyszukiwanie filmów:**
```bash
curl http://localhost:8787/api/movies/search
```

### Krok 6.3: Sprawdź logi

Logi są wyświetlane w terminalu gdzie uruchomiłeś `wrangler dev`.

### Krok 6.4: Live reload

Wrangler automatycznie przeładowuje Worker po zmianach w kodzie.

## 7. Deployment

### Krok 7.1: Deploy do Cloudflare

```bash
wrangler deploy
# lub
npm run deploy:cloudflare
```

Output:
```
Total Upload: xx.xx KiB / gzip: xx.xx KiB
Uploaded movie-tracker (x.xx sec)
Published movie-tracker (x.xx sec)
  https://movie-tracker.twoja-subdomena.workers.dev
```

### Krok 7.2: Zweryfikuj deployment

Otwórz URL z outputu w przeglądarce:
```
https://movie-tracker.twoja-subdomena.workers.dev/health
```

### Krok 7.3: Testuj API produkcyjne

```bash
# Zmień localhost:8787 na Twój Worker URL
curl https://movie-tracker.twoja-subdomena.workers.dev/api/movies/search
```

## Monitorowanie i Debugging

### Dashboard Cloudflare

1. Zaloguj się do [dash.cloudflare.com](https://dash.cloudflare.com/)
2. Przejdź do **Workers & Pages**
3. Kliknij na swojego Workera (`movie-tracker`)

Zobaczysz:
- **Metrics**: wykresy requestów, błędów, latency
- **Logs**: real-time logs
- **Settings**: konfiguracja, environment variables

### Wrangler Tail (Live Logs)

```bash
wrangler tail
```

To pokaże logi w czasie rzeczywistym. Bardzo przydatne podczas debugowania!

### Query do bazy danych (CLI)

```bash
# Produkcja
wrangler d1 execute movie-tracker-db --command="SELECT * FROM Users LIMIT 5"

# Lokalne
wrangler d1 execute movie-tracker-db --local --command="SELECT * FROM Users LIMIT 5"
```

## Dodatkowe konfiguracje

### Custom Domain

Jeśli masz domenę w Cloudflare:

1. Dashboard → Workers & Pages → Twój Worker
2. **Settings** → **Triggers** → **Custom Domains**
3. Dodaj swoją domenę (np. `api.twoja-domena.com`)

### Environment Variables (Secrets)

Dla wrażliwych danych (nie commituj ich do Git!):

```bash
# Ustaw secret
wrangler secret put JWT_SECRET
# Wpisz wartość gdy zostaniesz poproszony

# Lista secrets
wrangler secret list
```

W `worker.js` dostęp przez `c.env.JWT_SECRET`.

### R2 Storage (dla uploadów)

```bash
# Utwórz bucket R2
wrangler r2 bucket create movie-tracker-uploads

# Dodaj do wrangler.toml (już jest)
[[r2_buckets]]
binding = "UPLOADS"
bucket_name = "movie-tracker-uploads"
```

## Rozwiązywanie problemów

### Problem: "Could not find a D1 database with the name or binding"

**Rozwiązanie:**
- Sprawdź czy `database_id` w `wrangler.toml` jest poprawne
- Uruchom `wrangler d1 list` żeby zobaczyć swoje bazy

### Problem: "Module not found: hono"

**Rozwiązanie:**
```bash
npm install hono
```

### Problem: Błąd podczas migracji

**Rozwiązanie:**
- Sprawdź czy plik `cloudflare/schema.sql` istnieje
- Spróbuj utworzyć bazę ponownie:
```bash
wrangler d1 delete movie-tracker-db
wrangler d1 create movie-tracker-db
```

### Problem: Worker nie odpowiada

**Rozwiązanie:**
- Sprawdź logi: `wrangler tail`
- Sprawdź czy Worker jest wdrożony: `wrangler deployments list`
- Sprawdź Dashboard Cloudflare

### Problem: CORS errors w przeglądarce

**Rozwiązanie:**
- CORS jest już skonfigurowany w `worker.js`
- Jeśli potrzebujesz zmienić origin, edytuj:
```javascript
app.use('/*', cors({
  origin: 'https://twoja-domena.com', // Zmień '*' na konkretną domenę
  // ...
}));
```

## Migracja danych z Firebase

Jeśli migrujesz z Firebase:

### Krok 1: Export z Firebase

Stwórz skrypt `firebase-to-d1.js`:
```javascript
const admin = require('firebase-admin');
const fs = require('fs');

// Initialize Firebase
admin.initializeApp({ /* ... */ });
const db = admin.firestore();

async function exportToSQL() {
  const usersSnapshot = await db.collection('Users').get();
  let sql = '';
  
  usersSnapshot.forEach(doc => {
    const data = doc.data();
    sql += `INSERT INTO Users (nickname, email, password_hash) VALUES ('${data.nickname}', '${data.email}', '${data.password_hash}');\n`;
  });
  
  fs.writeFileSync('firebase-export.sql', sql);
}

exportToSQL();
```

### Krok 2: Import do D1

```bash
node firebase-to-d1.js
wrangler d1 execute movie-tracker-db --file=./firebase-export.sql
```

## Koszty

### Free Tier (wystarczy dla większości projektów):
- **100,000 requests dziennie**
- **10 milisekund CPU time na request**
- **5 GB D1 storage**
- **5 million D1 rows read dziennie**
- **100,000 D1 rows written dziennie**

### Paid Tier (jeśli przekroczysz free tier):
- **$0.30 za dodatkowy 1 milion requestów**
- **$0.02 za dodatkowy 1 milion CPU ms**
- **$0.75 za GB D1 storage miesięcznie**
- Bardzo konkurencyjne ceny!

## Kolejne kroki

Po deploymencie możesz:

1. **Skonfiguruj CI/CD**:
   - GitHub Actions z `wrangler deploy`
   - Automatyczny deployment przy push do main

2. **Dodaj monitoring**:
   - Cloudflare Analytics (wbudowany)
   - Sentry dla error tracking
   - Logflare dla advanced logging

3. **Optymalizuj**:
   - Cachowanie z Cloudflare Cache API
   - Edge caching dla statycznych assetów

4. **Skaluj**:
   - Dodaj więcej Workerów dla różnych części API
   - Użyj Durable Objects dla real-time features
   - Cloudflare Queues dla async processing

## Przydatne linki

- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [Hono.js Documentation](https://hono.dev/)
- [Cloudflare Community](https://community.cloudflare.com/)
- [Cloudflare Discord](https://discord.gg/cloudflaredev)

---

Gratulacje! Twoja aplikacja MovieTracker działa teraz na edge Cloudflare! 🎉
