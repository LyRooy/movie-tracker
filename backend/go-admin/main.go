package main

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
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
		fmt.Println("BŁĄD KRYTYCZNY: Zmienne ADMIN_USER lub ADMIN_PASSWORD nie są ustawione!")
		os.Exit(1)
	}

	// === ENDPOINTY PUBLICZNE ===

	// Strona logowania (Formularz HTML)
	r.Get("/login", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		fmt.Fprintf(w, `
			<h2>Logowanie do MVT Reco Admin</h2>
			<form method="POST" action="/login">
				<label>Login:</label><br>
				<input type="text" name="username" required><br><br>
				<label>Hasło:</label><br>
				<input type="password" name="password" required><br><br>
				<button type="submit">Zaloguj się</button>
			</form>
		`)
	})

	// Obsługa wysłanego formularza
	r.Post("/login", func(w http.ResponseWriter, r *http.Request) {
		session, _ := store.Get(r, "mvt-session")

		r.ParseForm()
		user := r.FormValue("username")
		pass := r.FormValue("password")

		if user == adminUser && pass == adminPass {
			// Logowanie poprawne -> nadajemy uprawnienia w sesji
			session.Values["authenticated"] = true
			session.Save(r, w)
			http.Redirect(w, r, "/", http.StatusSeeOther)
			return
		}

		// Złe dane
		http.Error(w, "Nieprawidłowy login lub hasło", http.StatusUnauthorized)
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

		// Główna strona panelu admina (TERAZ Z PRZYCISKIEM WYLOGUJ)
		protectedRouter.Get("/", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			fmt.Fprintf(w, `
				<div style="display: flex; justify-content: space-between; align-items: center;">
					<h1>MVT Reco Admin Dashboard</h1>
					<form method="POST" action="/logout">
						<button type="submit" style="padding: 5px 15px; background: #f44336; color: white; border: none; cursor: pointer;">Wyloguj</button>
					</form>
				</div>
				<p>Status połączenia z silnikiem Python AI: <strong style="color: green;">Online</strong></p>
				<div id="progress-bar" style="width: 300px; background: #eee; border: 1px solid #ccc;">
					<div id="progress" style="width: 0%; background: #4CAF50; height: 20px; text-align: center; color: white;">0%</div>
				</div>
				<p>Wykres straty (Loss): <span id="loss-val">---</span></p>
				
				<script>
					// Ciasteczka sesyjne są automatycznie wysyłane przy nawiązywaniu WebSocketu!
					const ws = new WebSocket("wss://" + window.location.host + "/ws/progress");
					ws.onmessage = function(event) {
						const data = JSON.parse(event.data);
						document.getElementById("progress").style.width = data.percent + "%";
						document.getElementById("progress").innerText = data.percent + "%";
						document.getElementById("loss-val").innerText = data.loss;
					};
					ws.onclose = function() {
						console.log("WebSocket rozłączony (być może sesja wygasła).");
					};
				</script>
			`)
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