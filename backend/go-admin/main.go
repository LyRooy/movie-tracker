package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

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

	// === Stan live postępu modeli (przekazywany z Pythona) ===
	// mu chroni dane przed równoczesnym dostępem z wielu połączeń WebSocket
	stateMu sync.RWMutex
	// models: klucz "cf"/"cb" -> aktualny stan (status, events, logs)
	models map[string]ModelState
)

// initProgressState inicjalizuje magazyn stanów i rejestruje endpointy
//
//	live postępy modeli (trzeba wywolac przed uruchomieniem routera).
func initProgressState(baseURL string) {
	if models == nil {
		models = map[string]ModelState{
			"cf": {Status: "not_started", Events: []ModelStatus{}, Logs: []ModelStatus{}},
			"cb": {Status: "not_started", Events: []ModelStatus{}, Logs: []ModelStatus{}},
		}
	}
}

// registerProgressRoutes rejestruje endpointy progressu na podanym routerze.
func registerProgressRoutes(r chi.Router, baseURL string) {
	// Endpoint pushowy dla dashboardu — zwraca aktualny stan wszystkich modeli.
	r.Get("/admin/progress", func(w http.ResponseWriter, r *http.Request) {
		mergePythonState(baseURL)
		broadcastPush(w)
	})

	// Endpoint WebSocket (relay): laczy sie z Pythonem (/admin/ws) i przekazuje
	// zdarzenia dalej do panelu dashboardu (dwukierunkowy most).
	r.Get("/admin/ws", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("Blad upgrade na WebSocket (admin): %v", err)
			return
		}
		defer conn.Close()

		// 1. ZAMIANA SCHEMATU: Dialer WebSocket wymaga "ws://" zamiast "http://"
		wsURL := strings.Replace(baseURL, "http://", "ws://", 1)
		wsURL = strings.Replace(wsURL, "https://", "wss://", 1)

		// DIAL ZWRACA (conn, response, error). response zawiera "101 Switching Protocols"
		// po udanym handshake, wiec NIE moze byc przypisany do perr (wtedy kazde
		// pojeczenie dzialajace wygladalo by jak bled). Ignorujemy response, perr bierze
		// trzecie miejsce.
		pyConn, _, perr := websocket.DefaultDialer.Dial(wsURL+"/admin/ws", nil)
		if perr != nil {
			log.Printf("Nie udalo sie polaczyc z Pythonem: %v", perr)
			// Jeśli nie ma Pythona, kończymy. Frontend spróbuje ponownie za 2 sekundy.
			return
		}
		if pyConn == nil {
			log.Printf("Nie udalo sie polaczyc z Pythonem (nil conn)")
			return
		}
		defer pyConn.Close()

		// 2. WSPÓŁBIEŻNOŚĆ: Rozdzielamy odbieranie na dwa osobne kanały (goroutines)

		// Wątek A: Odbieranie od Pythona -> wysyłanie do Dashboardu
		go func() {
			for {
				if conn == nil || pyConn == nil {
					break
				}
				// Deadline na odczyt: USUNIĘTO dla testów (Python wysyła piny co sekundę,
				// wiec nigdy nie ma 15s ciszy). Jeśli w przyszłości Python zacznie milczeć,
				// przywrócić ten deadline, żeby rozróżnić "Python spoczywa" od "Python umarł".
				pyMsgType, pyMsg, pyErr := pyConn.ReadMessage()
				if pyErr != nil {
					// Python zerwał połączenie. Zamykamy sesję przeglądarki, by wymusić reconnect.
					conn.Close()
					break
				}
				if err := conn.WriteMessage(pyMsgType, pyMsg); err != nil {
					break
				}
			}
		}()

		// Wątek B (główny): Odbieranie od Dashboardu -> wysyłanie do Pythona
		for {
			if conn == nil {
				log.Printf("Nie udalo sie pobrac wiadomosci z dashboardu (nil conn)")
				break
			}
			dashMsgType, dashMsg, dashErr := conn.ReadMessage()
			if dashErr != nil {
				break
			}

			// Ignoruj pingi podtrzymujące tunel Cloudflare
			if string(dashMsg) == `{"type":"ping"}` {
				continue
			}

			if err := pyConn.WriteMessage(dashMsgType, dashMsg); err != nil {
				break
			}
		}
	})
}

// ModelStatus to pojedyncze zdarzenie postępu (building/built) lub log.
// Pola pasuja do formatu wysyłanego przez Pythona (model_manager.py).
type ModelStatus struct {
	T       int64  `json:"t"`     // timestamp (ms)
	Level   string `json:"level"` // info / building / built / error
	Model   string `json:"model"` // "cf" lub "cb"
	Event   string `json:"event"` // building / built
	Name    string `json:"name"`
	OK      bool   `json:"ok"` // dla eventów "built"
	Message string `json:"message"`
	Status  string `json:"status"` // dla eventów: not_started/running/ready/error
}

// ModelState to kompletny stan danego modelu.
type ModelState struct {
	Status string        `json:"status"` // not_started/running/ready/error
	Events []ModelStatus `json:"events"`
	Logs   []ModelStatus `json:"logs"`
	// Count to liczba zapisanych rekomendacji (dla eventów "built").
	Count *int `json:"count"`
}

// modelHasData zwraca true, jeśli ModelState ma jakies dane (status ustawiony lub events/logs).
func modelHasData(m ModelState) bool {
	return m.Status != "" || len(m.Events) > 0 || len(m.Logs) > 0
}

// fetchPythonProgress pobiera aktualny stan modeli z Pythona (REST).
// Powraca false, jeśli Python nie jest dostępny (jeszcze nie uruchomiony).
func fetchPythonProgress(baseURL string) (map[string]ModelState, bool) {
	// Timeout powyzszeny (30s) — Python /admin/status czyta z bazy i moze byc powolny.
	client := &http.Client{Timeout: 30 * time.Second}

	resp, err := client.Get(baseURL + "/admin/status")
	if err != nil {
		log.Printf("Nie udalo sie pobrac statusu z Pythona: %v", err)
		return nil, false
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("Nie udalo sie pobrac statusu (HTTP %d)", resp.StatusCode)
		return nil, false
	}

	var status struct {
		CF ModelState `json:"cf"`
		CB ModelState `json:"cb"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		log.Printf("Nie udalo sie zdeserialize statusu Pythona: %v", err)
		return nil, false
	}

	out := make(map[string]ModelState, 2)
	// ModelState zawiera slice, wiec nie mozna go porownac z wartoscia domyslna (!=).
	// Zamiast tego sprawdzamy, czy model ma jakies dane.
	if modelHasData(status.CF) {
		out["cf"] = status.CF
	}
	if modelHasData(status.CB) {
		out["cb"] = status.CB
	}
	return out, true
}

// mergePythonState polaczy nowy stan z Pythona z naszym lokalnym magazynem.
func mergePythonState(baseURL string) {
	stateMu.Lock()
	defer stateMu.Unlock()

	if fetched, ok := fetchPythonProgress(baseURL); ok {
		for key, fetchedState := range fetched {
			cur, exists := models[key]
			// Python (tracker) zwraca kompletna, rosna liste events/logs, wiec
			// NADPISUJEMY lokalny stan zamiast doklejac (append). Append bez
			// deduplikacji powodowal "duchy" — stare logi ponowny render w DOM
			// przy kazdym odpytaniu /admin/progress (WS onclose + pierwszy load).
			if exists {
				cur.Status = fetchedState.Status
				if fetchedState.Count != nil {
					cur.Count = fetchedState.Count
				}
				models[key] = cur
			} else {
				models[key] = fetchedState
			}
		}
	}
}

// broadcastPush wysyla aktualne stany do wszystkich podlaczonych WebSocket.
// Zwraca poprawny obiekt JSON postaci {"cf": {...}, "cb": {...}} — wczesniej
// sklejano zserializowane obiekty przecinkiem bez otaczajacych klamer, co
// dawalo niepoprawny JSON i r.json() w przegladarce rzucalo wyjatek (cicho
// łapany przez .catch(() => {})).
func broadcastPush(w http.ResponseWriter) {
	stateMu.RLock()
	defer stateMu.RUnlock()

	payload, err := json.Marshal(models)
	if err != nil {
		log.Printf("Blad marshal JSON stanu modeli: %v", err)
		http.Error(w, "Blad serializacji stanu modeli", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(payload)
}

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
	fileServer := http.FileServer(http.Dir("static"))
	r.Handle("/static/*", http.StripPrefix("/static/", fileServer))

	adminUser := os.Getenv("ADMIN_USER")
	adminPass := os.Getenv("ADMIN_PASSWORD")

	if adminUser == "" || adminPass == "" {
		fmt.Println("BŁĄD KRYTYCZNY: Zmienne ADMIN_USER lub ADMIN_PASSWORD nie są ustawione w .env!")
		os.Exit(1)
	}

	// URL głównej strony do pobierania theme z Cloudflare Workers API (do ewentualnej przyszłej implementacji)
	mainSiteURL := os.Getenv("MAIN_SITE_URL")
	if mainSiteURL == "" {
		fmt.Println("Ostrzeżenie: MAIN_SITE_URL nie ustawione - theme z głównej strony niedostępne")
		mainSiteURL = "https://movie-tracker-mstr.110187.xyz/"
	}

	// URL Pythona (FastAPI). Domyślne: adres IP TrueNAS SCALE, port 8000.
	pythonURL := os.Getenv("ADMIN_PYTHON_URL")
	if pythonURL == "" {
		pythonURL = "http://python:8000"
	}
	fmt.Printf("Panel admin bedzie pobieral progres z Pythona: %s\n", pythonURL)

	// Inicjalizuj magazyn stanów i zarejestruj endpointy progressu.
	initProgressState(pythonURL)
	registerProgressRoutes(r, pythonURL)

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
