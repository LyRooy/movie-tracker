# MovieTracker - System Śledzenia Filmów i Seriali + Rekomendacje

> Nowoczesna aplikacja webowa do zarządzania listą obejrzanych filmów i seriali z zaawansowanym systemem śledzenia odcinków, wyzwań, odznak oraz hybrydowym silnikiem rekomendacji.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)

---

## Spis Treści

- [O Projekcie](#o-projekcie)
- [Główne Funkcje](#główne-funkcje)
- [Architektura](#architektura-hybrydowa-i-rekomendacje-wersja-magisterska)
- [Baza Danych](#baza-danych)
- [Technologie](#technologie)

---

## O Projekcie

**Movie Tracker** to kompleksowa aplikacja webowa zaprojektowana dla miłośników filmów i seriali. System umożliwia użytkownikom katalogowanie obejrzanych treści, śledzenie postępów w serialach z dokładnością do pojedynczych odcinków, uczestnictwo w wyzwaniach filmowych oraz zdobywanie odznak za osiągnięcia. 

Obecna iteracja (wersja magisterska) rozszerza projekt o zaawansowane mechanizmy rekomendacji, hostowane we własnym środowisku serwerowym.

### Cel Projektu

Stworzenie intuicyjnej platformy, która:
- Centralizuje informacje o filmach i serialach użytkownika
- Gamifikuje doświadczenie oglądania poprzez system wyzwań i odznak
- Umożliwia budowanie społeczności poprzez system znajomych
- **Dostarcza spersonalizowane rekomendacje filmowe** z wykorzystaniem hybrydowej architektury chmurowo-lokalnej

---

## Główne Funkcje

### Zarządzanie Treściami
- **Wyszukiwanie filmów i seriali** - Paginowane wyszukiwanie w bogatej bazie danych
- **Kategorie statusów**: Obejrzane, Obecnie oglądane, Planowane, Porzucone
- **System ocen** - ocena od 1 do 5 gwiazdek
- **Recenzje** - pisanie własnych opinii o filmach

### Zaawansowane Śledzenie Seriali
- **Śledzenie odcinków** - dokładność do pojedynczego odcinka
- **Zarządzanie sezonami** - konfiguracja liczby odcinków per sezon
- **Automatyczna aktualizacja statusu** - serial zmienia status w zależności od postępu
- **Wsparcie dla zakresów lat** - np. "2008-2013" dla seriali wieloletnich

### System Wyzwań i Odznak
- **Wyzwania filmowe** - np. "Obejrzyj 10 filmów akcji w miesiąc"
- **Odznaki za osiągnięcia** - z poziomami: Silver, Gold, Platinum
- **Śledzenie postępu** - wizualizacja postępu w wyzwaniach
- **Historia odznak** - zapis zdobytych osiągnięć z datami

### System Społecznościowy
- **Znajomi** - dodawanie i zarządzanie kontaktami, przejrzysty podgląd profilu
- **Zaproszenia** - system zaproszeń do znajomych
- **Porównywanie statystyk** - konkurowanie z przyjaciółmi

### Personalizacja i Onboarding
- **Kreator preferencji** - interaktywny modal powitalny pozwalający nowym użytkownikom na wybór ulubionych tytułów z losowo generowanej puli (z podziałem na gatunki).
- **Dashboard 2-kolumnowy** - szybki dostęp do kompaktowych statystyk oraz zoptymalizowanych globalnych rankingów filmowych (najpopularniejsze, najwyżej oceniane).

### Panel Administratora
- Zoptymalizowane zarządzanie bazą i użytkownikami
- Wydajna wyszukiwarka z paginacją i filtrowaniem zawartości
- Integracja z lokalnym silnikiem rekomendacji i podgląd na żywo postępów treningu modeli

---

## Architektura Hybrydowa i Rekomendacje (Wersja Magisterska)

Wdrożenie hybrydowego silnika rekomendacji wymusiło podział architektury na dwa współpracujące filary. Baza filmów znajduje się **symultanicznie w dwóch miejscach**. Rozwiązanie to zapobiega wyczerpaniu darmowych limitów zapytań (Row Reads) w Cloudflare D1 - modele podczas trenowania operują wyłącznie na lokalnej kopii, nie generując żadnego ruchu do bazy w chmurze.

1. **Warstwa Chmurowa (Cloudflare D1 + Pages + Workers):** Główna baza danych obsługująca cały ruch z frontendu (wyświetlanie katalogu, wyszukiwarka, dodawanie do list przez użytkowników).
2. **Warstwa Obliczeniowa (Lokalna kopia - TrueNAS SCALE):** Środowisko Docker posiadające fizyczną, zrzuconą kopię bazy (replika SQLite). To tutaj system intensywnie iteruje po danych, wykonując ciężkie obliczenia całkowicie offline w stosunku do limitów Cloudflare.

### Silnik Rekomendacji
Na serwerze lokalnym uruchomiony jest kontener **FastAPI** (Python), który przetwarza dane w dwóch podejściach:
- **Podejście oparte na treści (Context/Content-based):** Wykorzystanie metadanych (gatunki, tagi) jako klasycznego systemu regułowego (Information Retrieval).
- **Uczenie Maszynowe (Machine Learning):** Collaborative Filtering przy użyciu biblioteki `scikit-surprise`.
- W przyszłości planowana jest rozbudowa systemu o integrację z modelami językowymi (LLM) w celu przeprowadzenia testów porównawczych.
- Cała komunikacja wystawiona jest przez *Cloudflare Tunnel* (protokół HTTP2) i zabezpieczona kluczami API w architekturze Fail-Fast.

### Monitoring Silnika
Dodatkowy kontener napisany w **Go** służy jako dedykowany panel administracyjny do monitorowania silnika rekomendacji. Wykorzystuje on moduł `github.com/go-chi/chi/v5` do routingu żądań HTTP. Bezpieczna autoryzacja sesyjna oparta jest na pakiecie `github.com/gorilla/sessions`. Panel na bieżąco odbiera i wyświetla statystyki (np. postęp treningu i błąd Loss) poprzez stałe połączenie, wykorzystując implementację `github.com/gorilla/websocket`.

---

## Baza Danych

Pierwotnie system opierał się wyłącznie na pozycjach dodawanych ręcznie przez administratora. Został on rozszerzony o wyselekcjonowany fragment zbioru [The Ultimate 1Million Movies Dataset (Kaggle)](https://www.kaggle.com/datasets/alanvourch/tmdb-movies-daily-updates).

- **Skala i Limit D1:** Z oryginalnego zbioru (>1,2 mln filmów) zaimportowano około 250 000 rekordów. Taka paczka zajmuje ~372 MB, co pozwala zmieścić się w darmowym limicie 500 MB pojemności dla bazy Cloudflare D1, zostawiając bezpieczny margines (~128 MB) na dane użytkowników, recenzje i postępy.
- **Selekcja:** Import objął wyłącznie filmy wyprodukowane od 1970 roku wzwyż, ze zintegrowanym mechanizmem blokowania słów kluczowych eliminującym treści nieodpowiednie.
- **Optymalizacja:** Architektura wspiera szybką paginację po stronie frontendu, a specjalnie skonstruowane zapytania SQL (w tym CTE - Common Table Expressions) zapewniają natychmiastowe ładowanie bez błędów przepełnienia pamięci po stronie chmury.

---

## Technologie

### Frontend Stack (Główna Aplikacja)
| Technologia | Zastosowanie |
|------------|--------------|
| **HTML5 / CSS3** | Struktura i stylowanie aplikacji (Custom Themes) |
| **JavaScript (ES6+)** | Logika kliencka, LocalStorage Caching |
| **Font Awesome** | System ikon |
| **Chart.js** | Wizualizacja statystyk użytkownika |

### Frontend Stack (Lokalny Panel Administracyjny)
| Technologia | Zastosowanie |
|------------|--------------|
| **Go (chi, gorilla)** | Natywny serwer UI, rendering szablonów, autoryzacja sesyjna |
| **HTML5 / CSS3** | Struktura i stylowanie panelu monitoringu |
| **JavaScript (WebSockets)** | Odbiór i wizualizacja logów (Loss) w czasie rzeczywistym |

### Backend Stack (Chmura - Główne API)
| Technologia | Zastosowanie |
|------------|--------------|
| **Cloudflare Pages** | Hosting frontendowej aplikacji webowej |
| **Cloudflare Workers** | Bezserwerowe punkty końcowe API (Serverless) |
| **Cloudflare D1** | Produkcyjna baza relacyjna SQLite (Główna) |
| **Cloudflare R2** | Przechowywanie obiektów (Storage) |

### Backend Stack (Serwer Lokalny - Obliczenia)
| Technologia | Zastosowanie |
|------------|--------------|
| **Python (FastAPI)** | API silnika, system regułowy oraz ML (`scikit-surprise`) |
| **Docker / Compose** | Konteneryzacja i zarządzanie usługami |
| **Cloudflare Tunnel** | Bezpieczny routing bez publicznego IP (protokół HTTP2) |
| **TrueNAS** | Lokalny system operacyjny i replika SQLite dla rekomendacji |

---

## Autor

Dawid Łyczko

---

## Licencja

MIT License - szczegóły w pliku `LICENSE`