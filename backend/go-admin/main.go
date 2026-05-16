package main

import (
	"fmt"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true }, // Zezwalaj na połączenia z domeny Cloudflare
}

func main() {
	r := chi.NewRouter()

	// 1. Pobranie danych logowania z pamięci RAM kontenera
	adminUser := os.Getenv("ADMIN_USER")
	adminPass := os.Getenv("ADMIN_PASSWORD")

	// Bezpieczeństwo: Brak zmiennych = natychmiastowe zamknięcie programu
	if adminUser == "" || adminPass == "" {
		fmt.Println("BŁĄD KRYTYCZNY: Zmienne ADMIN_USER lub ADMIN_PASSWORD nie są ustawione!")
		os.Exit(1)
	}

	// 2. Grupa tras chronionych hasłem
	r.Group(func(protectedRouter chi.Router) {
		
		// Wstrzykujemy BasicAuth korzystający wyłącznie ze zmiennych środowiskowych
		protectedRouter.Use(middleware.BasicAuth("MVT Reco Admin Area", map[string]string{
			adminUser: adminPass,
		}))

		// Główna strona panelu admina (Dashboard) - TERAZ BEZPIECZNA
		protectedRouter.Get("/", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			fmt.Fprintf(w, `
				<h1>MVT Reco Admin Dashboard</h1>
				<p>Status połączenia z silnikiem Python AI: <strong style="color: green;">Online</strong></p>
				<div id="progress-bar" style="width: 300px; background: #eee; border: 1px solid #ccc;">
					<div id="progress" style="width: 0%; background: #4CAF50; height: 20px; text-align: center; color: white;">0%</div>
				</div>
				<p>Wykres straty (Loss): <span id="loss-val">---</span></p>
				
				<script>
					// Przeglądarka automatycznie przekaże token Basic Auth do handshake'u WebSocket
					const ws = new WebSocket("wss://" + window.location.host + "/ws/progress");
					ws.onmessage = function(event) {
						const data = JSON.parse(event.data);
						document.getElementById("progress").style.width = data.percent + "%";
						document.getElementById("progress").innerText = data.percent + "%";
						document.getElementById("loss-val").innerText = data.loss;
					};
				</script>
			`)
		})

		// Endpoint WebSocket - TERAZ CHRONIONY przed nieautoryzowanym nasłuchem
		protectedRouter.Get("/ws/progress", func(w http.ResponseWriter, r *http.Request) {
			conn, err := upgrader.Upgrade(w, r, nil)
			if err != nil {
				fmt.Println("Błąd upgrade na WebSocket:", err)
				return
			}
			defer conn.Close()
			fmt.Println("Klient połączony przez WebSocket pod dashboard")
			
			for {
				_, _, err := conn.ReadMessage()
				if err != nil {
					break
				}
			}
		})
	})

	fmt.Println("Uruchamianie profesjonalnego panelu Go na porcie 8080...")
	http.ListenAndServe(":8080", r)
}