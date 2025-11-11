# Przewodnik konfiguracji Firebase dla MovieTracker

Ten dokument zawiera szczegółowy przewodnik krok po kroku, jak skonfigurować Firebase dla projektu MovieTracker.

## Spis treści
1. [Tworzenie projektu Firebase](#1-tworzenie-projektu-firebase)
2. [Konfiguracja Firestore Database](#2-konfiguracja-firestore-database)
3. [Pobieranie danych uwierzytelniających](#3-pobieranie-danych-uwierzytelniających)
4. [Konfiguracja aplikacji](#4-konfiguracja-aplikacji)
5. [Inicjalizacja bazy danych](#5-inicjalizacja-bazy-danych)
6. [Testowanie](#6-testowanie)

## 1. Tworzenie projektu Firebase

### Krok 1.1: Utwórz konto Firebase
1. Przejdź do [Firebase Console](https://console.firebase.google.com/)
2. Zaloguj się za pomocą konta Google
3. Jeśli to Twoja pierwsza wizyta, zaakceptuj warunki korzystania z usługi

### Krok 1.2: Utwórz nowy projekt
1. Kliknij **"Add project"** lub **"Dodaj projekt"**
2. Wprowadź nazwę projektu (np. `movie-tracker`)
3. (Opcjonalnie) Edytuj ID projektu, jeśli chcesz
4. Kliknij **"Continue"** lub **"Kontynuuj"**
5. (Opcjonalnie) Włącz Google Analytics - możesz to pominąć dla projektu rozwojowego
6. Kliknij **"Create project"** lub **"Utwórz projekt"**
7. Poczekaj, aż Firebase utworzy projekt (może to potrwać minutę)
8. Kliknij **"Continue"** gdy projekt będzie gotowy

## 2. Konfiguracja Firestore Database

### Krok 2.1: Utwórz bazę danych Firestore
1. W lewym menu, znajdź i kliknij **"Firestore Database"**
2. Kliknij **"Create database"** lub **"Utwórz bazę danych"**

### Krok 2.2: Wybierz tryb bezpieczeństwa
Masz dwa warianty:

**Dla środowiska rozwojowego (zalecane na start):**
- Wybierz **"Start in test mode"**
- To pozwoli na łatwy dostęp podczas rozwoju
- Pamiętaj, aby później zmienić reguły na bardziej restrykcyjne!

**Dla środowiska produkcyjnego:**
- Wybierz **"Start in production mode"**
- Będziesz musiał skonfigurować reguły bezpieczeństwa od razu

### Krok 2.3: Wybierz lokalizację
1. Wybierz region najbliższy Twojej lokalizacji (np. `europe-west3` dla Polski)
2. **UWAGA:** Lokalizacja nie może być zmieniona później!
3. Kliknij **"Enable"** lub **"Włącz"**

### Krok 2.4: Konfiguracja reguł bezpieczeństwa (opcjonalnie)
1. Po utworzeniu bazy, przejdź do zakładki **"Rules"**
2. Możesz użyć reguł z pliku `firestore.rules` w projekcie
3. Kliknij **"Publish"** po wprowadzeniu reguł

## 3. Pobieranie danych uwierzytelniających

### Krok 3.1: Pobierz dane dla Backend (Firebase Admin SDK)

1. Kliknij ikonę **koła zębatego** obok "Project Overview"
2. Wybierz **"Project settings"** lub **"Ustawienia projektu"**
3. Przejdź do zakładki **"Service accounts"**
4. W sekcji "Firebase Admin SDK" upewnij się, że wybrany jest **"Node.js"**
5. Kliknij **"Generate new private key"** lub **"Wygeneruj nowy klucz prywatny"**
6. Potwierdź, że chcesz pobrać klucz
7. **WAŻNE:** Pobierze się plik JSON - zachowaj go w bezpiecznym miejscu!

Plik JSON będzie wyglądał podobnie:
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com",
  ...
}
```

### Krok 3.2: Pobierz dane dla Frontend (Firebase Web SDK)

1. Wróć do **"Project settings"**
2. Przewiń w dół do sekcji **"Your apps"** lub **"Twoje aplikacje"**
3. Jeśli nie masz jeszcze aplikacji webowej, kliknij ikonę **"<>"** (Web)
4. Zarejestruj aplikację:
   - Wprowadź nazwę aplikacji (np. "MovieTracker Web")
   - (Opcjonalnie) Zaznacz "Also set up Firebase Hosting" jeśli planujesz używać hostingu
   - Kliknij **"Register app"**
5. Skopiuj obiekt konfiguracji - będzie wyglądał tak:
```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:..."
};
```

## 4. Konfiguracja aplikacji

### Krok 4.1: Skonfiguruj zmienne środowiskowe dla backendu

1. W katalogu projektu, skopiuj plik przykładowy:
```bash
cp .env.example .env
```

2. Otwórz plik `.env` w edytorze tekstu

3. Wypełnij wartości używając danych z pobranego pliku JSON (Service Account):
```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
```

4. Dodaj dane z Firebase Web Config:
```env
FIREBASE_API_KEY=AIza...
FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:...
```

5. Wygeneruj bezpieczny klucz JWT (możesz użyć generator online lub komendy):
```bash
# Linux/Mac:
openssl rand -base64 32

# Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Dodaj wygenerowany klucz do `.env`:
```env
JWT_SECRET=your-generated-jwt-secret-key
```

6. (Opcjonalnie) Ustaw port:
```env
PORT=3000
```

### Krok 4.2: Skonfiguruj frontend

1. Otwórz plik `js/firebase-config.js`

2. Zastąp placeholder wartości danymi z Firebase Web Config:
```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:..."
};
```

### Krok 4.3: Zainstaluj zależności

```bash
npm install
```

## 5. Inicjalizacja bazy danych

### Krok 5.1: Uruchom skrypt inicjalizacyjny

Ten skrypt doda przykładowe filmy, odznaki i wyzwania do bazy:

```bash
npm run init-db
```

Powinieneś zobaczyć output podobny do:
```
🚀 Starting database initialization...

📽️  Adding sample movies...
  ✓ Added: Incepcja
  ✓ Added: Breaking Bad
  ...
✅ Added 5 movies

🏆 Adding sample badges...
  ✓ Added: Początkujący kinoman
  ...
✅ Added 5 badges

🎯 Creating sample challenge...
✅ Created sample challenge

🎉 Database initialization completed successfully!
```

### Krok 5.2: Sprawdź dane w Firebase Console

1. Wróć do Firebase Console
2. Przejdź do **"Firestore Database"**
3. Powinieneś zobaczyć kolekcje:
   - Movies
   - Badges
   - Challenges

## 6. Testowanie

### Krok 6.1: Uruchom serwer

```bash
# Tryb rozwojowy (automatyczny restart):
npm run dev

# lub tryb produkcyjny:
npm start
```

### Krok 6.2: Otwórz aplikację

Otwórz przeglądarkę i przejdź do:
```
http://localhost:3000
```

### Krok 6.3: Testuj podstawowe funkcje

1. **Rejestracja użytkownika:**
   - Otwórz narzędzia deweloperskie (F12)
   - W konsoli wykonaj:
   ```javascript
   fetch('http://localhost:3000/api/register', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       nickname: 'testuser',
       email: 'test@example.com',
       password: 'password123'
     })
   }).then(r => r.json()).then(console.log)
   ```

2. **Logowanie:**
   ```javascript
   fetch('http://localhost:3000/api/login', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       email: 'test@example.com',
       password: 'password123'
     })
   }).then(r => r.json()).then(data => {
     console.log(data);
     localStorage.setItem('token', data.token);
   })
   ```

3. **Sprawdź filmy:**
   ```javascript
   fetch('http://localhost:3000/api/movies/search')
     .then(r => r.json())
     .then(console.log)
   ```

### Krok 6.4: Sprawdź dane w Firestore

1. Wróć do Firebase Console → Firestore Database
2. Po rejestracji i testach powinieneś zobaczyć nową kolekcję **Users** z Twoim użytkownikiem
3. Możesz ręcznie przeglądać i edytować dane

## Rozwiązywanie problemów

### Problem: "Error: Could not load the default credentials"
**Rozwiązanie:** Sprawdź, czy:
- Plik `.env` istnieje i zawiera prawidłowe dane
- `FIREBASE_PRIVATE_KEY` zawiera kompletny klucz z `\n` jako separator linii
- `FIREBASE_CLIENT_EMAIL` jest poprawny

### Problem: "Permission denied" przy zapisie do Firestore
**Rozwiązanie:**
- Sprawdź reguły Firestore w Firebase Console
- Jeśli jesteś w trybie testowym, upewnij się że nie minął okres testowy (domyślnie 30 dni)
- Możesz tymczasowo ustawić:
```javascript
match /{document=**} {
  allow read, write: if true;
}
```
**UWAGA:** To jest niebezpieczne w produkcji!

### Problem: Port 3000 już używany
**Rozwiązanie:** Zmień port w `.env`:
```env
PORT=3001
```

### Problem: "Cannot find module 'firebase-admin'"
**Rozwiązanie:** Uruchom ponownie:
```bash
npm install
```

## Bezpieczeństwo - Ważne uwagi

1. **NIE commituj pliku `.env` do repozytorium!**
   - Plik `.gitignore` już go ignoruje
   - Sprawdź: `git status` - nie powinien pokazywać `.env`

2. **Chroń swój Service Account key**
   - Ten plik daje pełny dostęp do Twojego projektu Firebase
   - Nigdy nie udostępniaj go publicznie

3. **Używaj silnego JWT_SECRET w produkcji**
   - Minimum 32 znaki losowe

4. **Skonfiguruj właściwe reguły Firestore przed publikacją**
   - Użyj pliku `firestore.rules` jako bazę

5. **Regularnie aktualizuj zależności**
   ```bash
   npm audit
   npm update
   ```

## Co dalej?

Po pomyślnej konfiguracji możesz:
- Dodać więcej filmów i seriali
- Stworzyć własne wyzwania
- Zaprojektować nowe odznaki
- Rozbudować funkcjonalności aplikacji
- Wdrożyć aplikację na Firebase Hosting

## Przydatne linki

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)

---

Jeśli napotkasz jakiekolwiek problemy, utwórz issue na GitHubie lub skontaktuj się z autorem projektu.
