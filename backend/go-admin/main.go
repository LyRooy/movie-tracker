package main

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os"
	"time"

	_ "github.com/mattn/go-sqlite3" // SQLite driver
	"github.com/go-chi/chi/v5"
	"github.com/gorilla/sessions"
	"github.com/gorilla/websocket"
)

var (
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true }, // Zezwalaj na połączenia z Cloudflare
	}
	// Magazyn naszych sesji
	store *sessions.CookieStore
		
		// Baza danych do przechowywania użytkowników admina
		db *sql.DB
		http.Error(w, "Błąd wczytywania szablonu: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := t.Execute(w, data); err != nil {
		log.Printf("Błąd renderowania szablonu %s: %v", name, err)
	}
}

// Funkcja inicjalizująca bazę danych i tabele
func initDatabase() error {
	// Odczyt konfiguracji z .env
	dbType := os.Getenv("DATABASE_TYPE")
	if dbType == "" {
		dbType = "sqlite3" // domyślnie SQLite (nie wymaga serwera)
	}

	dbPath := os.Getenv("DATABASE_PATH")
	if dbPath == "" {
		dbPath = "./database/admin_users.db"
	}

	var err error
	switch dbType {
	case "sqlite3":
		db, err = sql.Open("sqlite3", dbPath+"?_foreign_keys=on")
	case "postgres", "postgresql":
		dsn := fmt.Sprintf("%s:%s@(%s)/%s?sslmode=%s", 
			os.Getenv("DATABASE_USER"), os.Getenv("DATABASE_PASS"),
			os.Getenv("DATABASE_HOST"), os.Getenv("DATABASE_NAME"), "require")
		db, err = sql.Open("postgres", dsn)
	case "mysql":
		dsn := fmt.Sprintf("%s:%s@tcp(%s)/%s?charset=utf8mb4",
			os.Getenv("DATABASE_USER"), os.Getenv("DATABASE_PASS"),
			os.Getenv("DATABASE_HOST"), os.Getenv("DATABASE_NAME"))
		db, err = sql.Open("mysql", dsn)
	default:
		return fmt.Errorf("nieobsługiwany typ bazy: %s", dbType)
	}

	if err != nil {
		return fmt.Errorf("błąd połączenia z bazą: %w", err)
	}

	// Tworzenie tabeli użytkowników jeśli nie istnieje
	createTableSQL := `
	CREATE TABLE IF NOT EXISTS admin_users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	CREATE INDEX IF NOT EXISTS idx_username ON admin_users(username);
	`

	_, err = db.Exec(createTableSQL)
	if err != nil {
		return fmt.Errorf("błąd tworzenia tabeli: %w", err)
	}

	log.Println("Baza danych zainicjalizowana pomyślnie")
	return nil
}

// Funkcja generująca bezpieczny klucz sesji przy starcie serwera
func initSessionStore() {
	// Sprawdź połączenie z bazą przed tworzeniem sesji
	if err := initDatabase(); err != nil {
		log.Printf("Ostrzeżenie: błąd bazy danych (uruchomienie na domyślnym admin): %v", err)
	}

	// Jeśli nie dodasz SESSION_SECRET w Portainerze, Go wygeneruje losowy klucz sam
	// Oznacza to, że po każdym restarcie kontenera wszyscy zostaną wylogowani (bardzo bezpieczne)
	secret := os.Getenv("SESSION_SECRET")
	if secret == "" {
		bytes := make([]byte, 32)
		rand.Read(bytes)
		secret = hex.EncodeToString(bytes)
	}

	store = sessions.NewCookieStore([]byte(secret))

	// Konfiguracja ciasteczka: Wygasa po 1 godzinie (3600 sekund)
	store.Options = &sessions.Options{
		Path:     "/",
		MaxAge:   3600,
		HttpOnly: true,
		Secure:   true, // Działa poprawnie dzięki HTTPS z Cloudflare
		SameSite: http.SameSiteLaxMode,
	}
}

func main() {
	// Sprawdź połączenie z bazą danych
	if err := initDatabase(); err != nil {
		log.Fatalf("Krytyczny błąd inicjalizacji bazy: %v", err)
	}
	defer db.Close()

	initSessionStore()

	r := chi.NewRouter()


	adminUser := os.Getenv("ADMIN_USER")
	adminPass := os.Getenv("ADMIN_PASSWORD")

	if adminUser == "" || adminPass == "" {
		fmt.Println("BŁĄD KRYTYCZNY: Zmienne ADMIN_USER lub ADMIN_PASSWORD nie są ustawione w .env!")
		os.Exit(1)
	}

	// URL głównej strony do pobierania theme z Cloudflare Workers API
	mainSiteURL := os.Getenv("MAIN_SITE_URL")
	if mainSiteURL == "" {
		fmt.Println("Ostrzeżenie: MAIN_SITE_URL nie ustawione - theme z głównej strony niedostępne")
		mainSiteURL = "https://movie-tracker-mstr.110187.xyz/"
	}

	// === ENDPOINTY PUBLICZNE ===

	// Pobieranie theme użytkownika z głównej strony przed wyświetleniem logowania
	r.Get("/api/user-theme", func(w http.ResponseWriter, r *http.Request) {
		if mainSiteURL == "" {
			http.Error(w, "MAIN_SITE_URL nie ustawione", http.StatusServiceUnavailable)
			return
		}

		// Pobierz JWT token z localStorage użytkownika
		js := `
		const script = document.createElement('script');
		script.src = '` + mainSiteURL + `';
		document.head.appendChild(script);
		`
		w.Header().Set("Content-Type", "text/javascript")
		w.Write([]byte(js))

		// Odczekaj na załadowanie strony głównej (simplifikacja - w produkcji użyj fetch do /api/user-theme)
		time.Sleep(100 * time.Millisecond)

		// W prawdziwej implementacji:
		// 1. Użyj fetch() do pobrania theme z API głównej strony
		// 2. Zwróć JSON: { "theme": "dark" | "light" }
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{ "theme": "dark", "message": "Domyślnie ciemny dla lokalnego panelu" }`))
	})

	// Strona logowania z supportem theme z URL
	r.Get("/login", func(w http.ResponseWriter, r *http.Request) {
		hasError := r.URL.Query().Get("error") == "1"

		// Sprawdź czy theme został przekazany przez URL (od głównej strony)
		userTheme := r.URL.Query().Get("__user_theme__")
		if userTheme == "" {
			// Spróbuj pobrać z localStorage (tylko jeśli te same origin - nie działa między domenami)
			// Dla innej domeny - użyjemy dark jako default dla lokalnego panelu
			userTheme = "dark"
		}

		renderTemplate(w, "login.html", map[string]string{
			"Error":     fmt.Sprintf("%v", hasError),
			"UserTheme": userTheme,
		})
	})

	// Obsługa wysłanego formularza - sprawdza użytkowników w bazie danych
	r.Post("/login", func(w http.ResponseWriter, r *http.Request) {
		session, _ := store.Get(r, "mvt-session")

		r.ParseForm()
		user := r.FormValue("username")
		pass := r.FormValue("password")

		// Sprawdź czy użytkownik istnieje w bazie danych
		var passwordHash string
		err := db.QueryRow("SELECT password_hash FROM admin_users WHERE username = ? LIMIT 1", user).Scan(&passwordHash)

		if err == sql.ErrNoRows {
			// Użytkownik nie znaleziony
			log.Printf("Nieznany użytkownik: %s", user)
			http.Redirect(w, r, "/login?error=1", http.StatusSeeOther)
			return
		} else if err != nil {
			log.Printf("Błąd sprawdzania hasła dla użytkownika: %v", err)
			http.Redirect(w, r, "/login?error=1", http.StatusSeeOther)
			return
		}

		// Porównaj hasła (w produkcji użyj bcrypt!)
		if passwordHash == pass {
			// Logowanie poprawne -> nadajemy uprawnienia w sesji
			session.Values["authenticated"] = true
			session.Values["username"] = user
			session.Save(r, w)
			log.Printf("Zalogowano użytkownika: %s", user)
			http.Redirect(w, r, "/", http.StatusSeeOther)
			return
		}

		// Niepoprawne hasło
		log.Printf("Nieprawidłowe hasło dla użytkownika: %s", user)
		http.Redirect(w, r, "/login?error=1", http.StatusSeeOther)
	})

	// Wylogowanie
	r.Post("/logout", func(w http.ResponseWriter, r *http.Request) {
		session, _ := store.Get(r, "mvt-session")
		// Kasujemy sesję
		session.Values["authenticated"] = false
		session.Options.MaxAge = -1 // Ciasteczko wygasa natychmiast
		session.Save(r, w)
		http.Redirect(w, r, "/login", http.StatusSeeOther)
	})

	// Rejestracja nowego użytkownika admina (prosta implementacja - haszowanie SHA256)
	r.Post("/register", func(w http.ResponseWriter, r *http.Request) {
		r.ParseForm()
		username := r.FormValue("username")
		password := r.FormValue("password")

		// Sprawdź czy użytkownik już istnieje
		var count int
		db.QueryRow("SELECT COUNT(*) FROM admin_users WHERE username = ?", username).Scan(&count)

		if count > 0 {
			http.Error(w, "Użytkownik już istnieje", http.StatusConflict)
			return
		}

		// Hashowanie hasła (w produkcji użyj bcrypt!)
		hash := sha256.Sum256([]byte(password))
		passwordHash := hex.EncodeToString(hash[:])

		// Dodaj użytkownika do bazy
		insertSQL := "INSERT INTO admin_users (username, password_hash) VALUES (?, ?)"
		result, err := db.Exec(insertSQL, username, passwordHash)
		if err != nil {
			log.Printf("Błąd dodawania użytkownika: %v", err)
			http.Error(w, "Błąd rejestracji", http.StatusInternalServerError)
			return
		}

		id, _ := result.LastInsertId()
		log.Printf("Zarejestrowano użytkownika: %s (id=%d)", username, id)

		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"success": true, "message": "Użytkownik zarejestrowany pomyślnie"}`)
	})

	// === ENDPOINTY ZABEZPIECZONE SESJĄ ===

	// Tworzymy własny Middleware sprawdzający sesję
	authMiddleware := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			session, _ := store.Get(r, "mvt-session")
			if auth, ok := session.Values["authenticated"].(bool); !ok || !auth {
				http.Redirect(w, r, "/login", http.StatusSeeOther)
				return
			}
			next.ServeHTTP(w, r)
		})
	}

	r.Group(func(protectedRouter chi.Router) {
		protectedRouter.Use(authMiddleware)

		// Główna strona panelu admina
		protectedRouter.Get("/", func(w http.ResponseWriter, r *http.Request) {
			renderTemplate(w, "dashboard.html", nil)
		})

		// Endpoint WebSocket
		protectedRouter.Get("/ws/progress", func(w http.ResponseWriter, r *http.Request) {
			conn, err := upgrader.Upgrade(w, r, nil)
			if err != nil {
				fmt.Println("Błąd upgrade na WebSocket:", err)
				return
			}
			defer conn.Close()
			fmt.Println("Zautoryzowany klient połączony przez WebSocket")

			for {
				_, _, err := conn.ReadMessage()
				if err != nil {
					break
				}
			}
		})
	})

	fmt.Println("Uruchamianie panelu z logowaniem na sesjach (Port 8080)...")
	http.ListenAndServe(":8080", r)
}
