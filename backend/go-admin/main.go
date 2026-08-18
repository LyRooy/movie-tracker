package main

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os"

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
)

// renderTemplate wczytuje szablon z folderu pages/ i renderuje go do odpowiedzi HTTP.
func renderTemplate(w http.ResponseWriter, name string, data any) {
	t, err := template.ParseFiles("pages/" + name)
	if err != nil {
		http.Error(w, "Błąd wczytywania szablonu: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := t.Execute(w, data); err != nil {
		log.Printf("Błąd renderowania szablonu %s: %v", name, err)
	}
}

// Funkcja generująca bezpieczny klucz sesji przy starcie serwera
func initSessionStore() {
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
	initSessionStore()

	r := chi.NewRouter()

	adminUser := os.Getenv("ADMIN_USER")
	adminPass := os.Getenv("ADMIN_PASSWORD")

	if adminUser == "" || adminPass == "" {
		fmt.Println("BŁĄD KRYTYCZNY: Zmienne ADMIN_USER lub ADMIN_PASSWORD nie są ustawione w .env!")
		os.Exit(1)
	}

	// URL głównej strony do pobierania theme z Cloudflare Workers API (do przyszłej implementacji)
	mainSiteURL := os.Getenv("MAIN_SITE_URL")
	if mainSiteURL == "" {
		fmt.Println("Ostrzeżenie: MAIN_SITE_URL nie ustawione - theme z głównej strony niedostępne")
		mainSiteURL = "https://movie-tracker-mstr.110187.xyz/"
	}

	// === ENDPOINTY PUBLICZNE ===

	// Strona logowania (hard-coded admin)
	r.Get("/login", func(w http.ResponseWriter, r *http.Request) {
		hasError := r.URL.Query().Get("error") == "1"

		// Sprawdź czy theme został przekazany przez URL (od głównej strony)
		userTheme := r.URL.Query().Get("__user_theme__")
		if userTheme == "" {
			userTheme = "dark" // domyślnie ciemny dla lokalnego panelu
		}

		renderTemplate(w, "login.html", map[string]string{
			"Error":     fmt.Sprintf("%v", hasError),
			"UserTheme": userTheme,
		})
	})

	// Obsługa wysłanego formularza - hard-coded admin (do przyszłej bazy)
	r.Post("/login", func(w http.ResponseWriter, r *http.Request) {
		session, _ := store.Get(r, "mvt-session")

		r.ParseForm()
		user := r.FormValue("username")
		pass := r.FormValue("password")

		if user == adminUser && pass == adminPass {
			// Logowanie poprawne
			session.Values["authenticated"] = true
			session.Values["username"] = user
			session.Save(r, w)
			log.Printf("Zalogowano administratora: %s", user)
			http.Redirect(w, r, "/", http.StatusSeeOther)
			return
		}

		// Złe dane - wróć na stronę logowania z błędem
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

		// Główna strona panelu admina - pobieramy theme z URL
		protectedRouter.Get("/", func(w http.ResponseWriter, r *http.Request) {
			userTheme := r.URL.Query().Get("__user_theme__")
			if userTheme == "" {
				userTheme = "dark" // Domyślnie ciemny motyw dla lokalnego panelu admina
			}
			renderTemplate(w, "dashboard.html", map[string]string{
				"UserTheme": userTheme,
			})
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
