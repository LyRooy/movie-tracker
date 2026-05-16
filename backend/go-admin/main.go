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

// Wspólny arkusz stylów dopasowany do motywu frontendu MovieTracker
const mvtCSS = `
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --primary:#2c3e50;
  --secondary:#3498db;
  --accent:#e74c3c;
  --bg:#1a1a1a;
  --surface:#2c2c2c;
  --text:#ffffff;
  --text-sec:#cccccc;
  --border:#404040;
  --shadow:0 2px 10px rgba(0,0,0,0.4);
  --radius:10px;
  --transition:all 0.3s ease;
}
body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}

/* Navbar */
.navbar{background:var(--surface);box-shadow:var(--shadow);position:sticky;top:0;z-index:100}
.nav-inner{max-width:960px;margin:0 auto;padding:0 1.5rem;height:64px;display:flex;align-items:center;justify-content:space-between}
.nav-logo{display:flex;align-items:center;gap:0.4rem}
.logo-mvt{font-size:1.6rem;font-weight:800;color:var(--secondary);letter-spacing:0.05em}
.logo-sub{font-size:0.85rem;color:var(--text-sec);font-weight:500;padding-top:2px}

/* Buttons */
.btn-logout{padding:0.45rem 1rem;background:var(--accent);color:#fff;border:none;border-radius:6px;font-size:0.9rem;font-weight:600;cursor:pointer;transition:var(--transition)}
.btn-logout:hover{opacity:0.85}
.btn-login{width:100%;padding:0.75rem;background:var(--secondary);color:#fff;border:none;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer;transition:var(--transition);margin-top:0.5rem}
.btn-login:hover{opacity:0.85;transform:translateY(-1px)}

/* Login page */
.login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem}
.login-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:2.5rem 2rem;width:100%;max-width:380px;box-shadow:var(--shadow)}
.login-logo{text-align:center;margin-bottom:2rem}
.login-logo .logo-mvt{display:block;font-size:2.5rem;font-weight:900;color:var(--secondary);letter-spacing:0.08em}
.login-logo .logo-sub{display:block;font-size:0.9rem;color:var(--text-sec);margin-top:0.2rem}
.login-form .form-group{margin-bottom:1.2rem}
.login-form label{display:block;font-size:0.85rem;color:var(--text-sec);margin-bottom:0.35rem;font-weight:500}
.login-form input{width:100%;padding:0.65rem 0.9rem;background:#1a1a1a;border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.95rem;transition:var(--transition)}
.login-form input:focus{outline:none;border-color:var(--secondary)}

/* Dashboard */
.main{padding:2rem 1rem}
.container{max-width:960px;margin:0 auto;display:flex;flex-direction:column;gap:1.5rem}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:1.5rem;box-shadow:var(--shadow)}
.card-header{font-size:1rem;font-weight:700;color:var(--text-sec);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:1rem;border-bottom:1px solid var(--border);padding-bottom:0.6rem}

/* Status */
.status-row{display:flex;align-items:center;gap:0.6rem;font-size:0.95rem}
.status-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.status-dot.online{background:#2ecc71;box-shadow:0 0 6px #2ecc71}
.status-dot.offline{background:var(--accent)}

/* Progress */
.progress-label{display:flex;justify-content:space-between;font-size:0.85rem;color:var(--text-sec);margin-bottom:0.5rem}
.progress-track{background:#111;border-radius:999px;height:18px;overflow:hidden;border:1px solid var(--border)}
.progress-fill{height:100%;background:linear-gradient(90deg,var(--secondary),#2ecc71);border-radius:999px;transition:width 0.4s ease;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;color:#fff;min-width:2px}
.loss-row{margin-top:1rem;display:flex;align-items:center;gap:0.6rem}
.loss-label{color:var(--text-sec);font-size:0.9rem}
.loss-value{font-size:1.1rem;font-weight:700;color:var(--secondary)}
`

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
		fmt.Fprintf(w, `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MVT Reco Admin — Logowanie</title>
<style>
%s
</style>
</head>
<body>
<div class="login-wrap">
  <div class="login-card">
    <div class="login-logo">
      <span class="logo-mvt">MVT</span>
      <span class="logo-sub">Reco Admin</span>
    </div>
    <form method="POST" action="/login" class="login-form">
      <div class="form-group">
        <label for="username">Login</label>
        <input type="text" id="username" name="username" required autocomplete="username" placeholder="Nazwa użytkownika">
      </div>
      <div class="form-group">
        <label for="password">Hasło</label>
        <input type="password" id="password" name="password" required autocomplete="current-password" placeholder="••••••••">
      </div>
      <button type="submit" class="btn-login">Zaloguj się</button>
    </form>
  </div>
</div>
</body>
</html>`, mvtCSS)
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

		// Główna strona panelu admina
		protectedRouter.Get("/", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			fmt.Fprintf(w, `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MVT Reco Admin — Dashboard</title>
<style>
%s
</style>
</head>
<body>
<nav class="navbar">
  <div class="nav-inner">
    <div class="nav-logo"><span class="logo-mvt">MVT</span><span class="logo-sub">Reco Admin</span></div>
    <form method="POST" action="/logout">
      <button type="submit" class="btn-logout">Wyloguj</button>
    </form>
  </div>
</nav>

<main class="main">
  <div class="container">

    <div class="card">
      <div class="card-header">Status silnika AI</div>
      <div class="status-row">
        <span class="status-dot online"></span>
        <span>Python FastAPI &mdash; <strong>Online</strong></span>
      </div>
    </div>

    <div class="card">
      <div class="card-header">Postęp trenowania modelu</div>
      <div class="progress-label">
        <span>Ukończono</span>
        <span id="progress-pct">0%%</span>
      </div>
      <div class="progress-track">
        <div id="progress" class="progress-fill" style="width:0%%"></div>
      </div>
      <div class="loss-row">
        <span class="loss-label">Strata (Loss):</span>
        <span id="loss-val" class="loss-value">---</span>
      </div>
    </div>

  </div>
</main>

<script>
  const ws = new WebSocket("wss://" + window.location.host + "/ws/progress");
  ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    const pct = data.percent + "%%";
    document.getElementById("progress").style.width = pct;
    document.getElementById("progress-pct").innerText = pct;
    document.getElementById("loss-val").innerText = data.loss;
  };
  ws.onclose = function() {
    console.warn("WebSocket rozłączony.");
  };
</script>
</body>
</html>`, mvtCSS)
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