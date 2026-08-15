# KOD IMPORTERA DO BAZY D1 Z PLIKU CSV ZBIORU DANYCH Z KAGGLE
import csv
import json
import re
import os
import subprocess
import sys
import tempfile
import math


CSV_PATH   = r"/path/to/TMDB_all_movies.csv"   # ścieżka do pliku CSV z danymi TMDB
DB_NAME    = "my_db_name"                      # nazwa bazy danych z wrangler.toml
SQL_BATCH  = 40                                # rekordów w jednym poleceniu INSERT
MAX_RECORDS = 250_000                          # limit łączny rekordów do zaimportowania (~372 MB / 500MB limitu D1)
PROGRESS_FILE = os.path.join(os.path.dirname(__file__), "import_progress.txt")
TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w500"

# Słowa blokujące - jeśli któreś słowo wystąpi w TYTULE lub OPISIE -> pomiń film
BLOCKED_WORDS = [
    "s*x", "p*rn", "er*tic", "xxx", "h*ntai", "nsfw",
    "wh*rehouse", "wh*re", "broth*l", "pr*stitut",
    "n*de", "n*dity", "strip club", "stripper",
    "softcore", "hardcore", "[explicit]", "[explicit]", "[explicit]", "g*y", "lesb*an", "bis*xual",
    "p*nis", "v*gina", "h**ker", "esc*rt", "camgirl", "camming", "adult film", "er*tica",
    "bdsm", "b*ndage", "domin*trix", "subm*ssive", "f*tish", "k*nk", "s&m", "sadom*sochism",
    "[explicit]", "[explicit]", "most offensive"
] # W tym kodzie zasosowana placeholdery w oryginalnym import.py nie było gwiazdek itd.

def read_progress() -> int:
    """Zwróć numer ostatnio zapisanego wiersza CSV (0 = nic nie zaimportowano)."""
    if os.path.exists(PROGRESS_FILE):
        try:
            return int(open(PROGRESS_FILE).read().strip())
        except ValueError:
            pass
    return 0

def write_progress(row_index: int):
    with open(PROGRESS_FILE, "w") as f:
        f.write(str(row_index))

def escape_sql(value) -> str:
    """Bezpieczne escapowanie wartości dla SQLite."""
    if value is None or (isinstance(value, str) and value.strip() == ""):
        return "NULL"
    if isinstance(value, (int, float)):
        return str(value)
    # Stringi: zamień pojedynczy apostrof na dwa
    return "'" + str(value).replace("'", "''") + "'"

def parse_float(val):
    try:
        f = float(val)
        return f if not math.isnan(f) else None
    except (ValueError, TypeError):
        return None

def parse_int(val):
    f = parse_float(val)
    if f is None:
        return None
    return int(f)

def build_poster_url(poster_path: str) -> str | None:
    if not poster_path or poster_path.strip() == "":
        return None
    path = poster_path.strip()
    if not path.startswith("/"):
        path = "/" + path
    return TMDB_POSTER_BASE + path

def row_to_sql_values(row: dict) -> str:
    """Zwróć fragment VALUES(...) dla jednego wiersza."""
    kaggle_id       = escape_sql(row.get("id"))
    title           = escape_sql(row.get("title") or "Bez tytułu")
    release_date    = escape_sql(row.get("release_date"))
    media_type      = "'movie'"
    genres_raw      = row.get("genres", "") or ""
    genre           = escape_sql(genres_raw[:500] if genres_raw else None)
    description     = escape_sql((row.get("overview") or "")[:2000] or None)
    poster_url      = escape_sql(build_poster_url(row.get("poster_path", "")))
    trailer_url     = "NULL"
    total_seasons   = "1"
    total_episodes  = "1"
    duration        = escape_sql(parse_int(row.get("runtime")))
    vote_average    = escape_sql(parse_float(row.get("vote_average")))
    vote_count      = escape_sql(parse_float(row.get("vote_count")))
    status          = escape_sql(row.get("status"))
    revenue         = escape_sql(parse_float(row.get("revenue")))
    runtime         = escape_sql(parse_float(row.get("runtime")))
    budget          = escape_sql(parse_float(row.get("budget")))
    imdb_id         = escape_sql(row.get("imdb_id"))
    original_lang   = escape_sql(row.get("original_language"))
    original_title  = escape_sql(row.get("original_title"))
    overview        = escape_sql((row.get("overview") or "")[:2000] or None)
    popularity      = escape_sql(parse_float(row.get("popularity")))
    tagline         = escape_sql(row.get("tagline"))
    genres_col      = escape_sql(genres_raw[:500] if genres_raw else None)
    prod_companies  = escape_sql((row.get("production_companies") or "")[:500] or None)
    prod_countries  = escape_sql((row.get("production_countries") or "")[:200] or None)
    spoken_langs    = escape_sql((row.get("spoken_languages") or "")[:200] or None)
    cast_col        = escape_sql((row.get("cast") or "")[:1000] or None)
    director        = escape_sql(row.get("director"))
    dop             = escape_sql(row.get("director_of_photography"))
    writers         = escape_sql((row.get("writers") or "")[:500] or None)
    producers       = escape_sql((row.get("producers") or "")[:500] or None)
    music           = escape_sql(row.get("music_composer"))
    imdb_rating     = escape_sql(parse_float(row.get("imdb_rating")))
    imdb_votes      = escape_sql(parse_float(row.get("imdb_votes")))
    poster_path_col = escape_sql(row.get("poster_path"))

    return (
        f"({kaggle_id},{title},{release_date},{media_type},{genre},{description},"
        f"{poster_url},{trailer_url},strftime('%Y-%m-%d %H:%M:%f','now'),"
        f"{total_seasons},{total_episodes},{duration},"
        f"{vote_average},{vote_count},{status},{revenue},{runtime},{budget},"
        f"{imdb_id},{original_lang},{original_title},{overview},{popularity},{tagline},"
        f"{genres_col},{prod_companies},{prod_countries},{spoken_langs},{cast_col},"
        f"{director},{dop},{writers},{producers},{music},"
        f"{imdb_rating},{imdb_votes},{poster_path_col})"
    )

INSERT_COLS = """(kaggle_id,title,release_date,media_type,genre,description,
poster_url,trailer_url,created_at,
total_seasons,total_episodes,duration,
vote_average,vote_count,status,revenue,runtime,budget,
imdb_id,original_language,original_title,overview,popularity,tagline,
genres,production_companies,production_countries,spoken_languages,cast,
director,director_of_photography,writers,producers,music_composer,
imdb_rating,imdb_votes,poster_path)""".replace("\n", "")

def run_sql_file(sql_path: str):
    """Wykonaj plik SQL przez wrangler d1 execute."""
    result = subprocess.run(
        ["npx", "wrangler", "d1", "execute", DB_NAME, "--remote", f"--file={sql_path}"],
        capture_output=True, encoding="utf-8", errors="replace",
        cwd=os.path.dirname(__file__), shell=True
    )
    if result.returncode != 0:
        print("BŁĄD wrangler:", result.stderr[-2000:])
        sys.exit(1)

def count_db_records() -> int:
    """Zwróć aktualną liczbę rekordów w bazie D1."""
    result = subprocess.run(
        f'npx wrangler d1 execute {DB_NAME} --remote --json --command "SELECT COUNT(*) AS cnt FROM movies WHERE media_type = \'movie\';"',
        shell=True, capture_output=True, encoding="utf-8", errors="replace",
        cwd=os.path.dirname(__file__),
    )
    try:
        data = json.loads(result.stdout)
        # wrangler --json zwraca listę: [{"results": [{"cnt": 57684}], ...}]
        return int(data[0]["results"][0]["cnt"])
    except Exception:
        return 0

def main():
    start_row = read_progress()

    print(f"Zliczanie wierszy CSV...")
    with open(CSV_PATH, encoding="utf-8", newline="") as f:
        total_csv_rows = sum(1 for _ in f) - 1  # minus nagłówek

    remaining_total = max(0, total_csv_rows - start_row)

    print(f"Odpytywanie bazy o liczbę rekordów...")
    already_imported = count_db_records()
    print(f"Odczyt CSV: {CSV_PATH}")
    can_import = max(0, MAX_RECORDS - already_imported)

    print(f"Wierszy w CSV:        {total_csv_rows:,}")
    print(f"Limit łączny:         {MAX_RECORDS:,}")
    print(f"Już zaimportowano:    ~{already_imported:,}")
    print(f"Pozostały limit:      {can_import:,}")
    print(f"Postęp: zaczynamy od wiersza {start_row + 1}\n")

    if can_import == 0:
        print(f"Osiągnięto limit {MAX_RECORDS:,} rekordów — baza pełna.")
        return

    if remaining_total == 0:
        print("Wszystkie rekordy zostały już zaimportowane!")
        return

    imported = 0
    skipped  = 0
    buffer: list[str] = []
    current_row = 0

    def flush_buffer(buf: list[str], label: str = ""):
        """Wyślij jeden batch INSERT do D1."""
        if not buf:
            return
        sql = f"INSERT OR IGNORE INTO movies {INSERT_COLS} VALUES\n"
        sql += ",\n".join(buf) + ";\n"
        with tempfile.NamedTemporaryFile(mode="w", suffix=".sql", delete=False,
                                         encoding="utf-8") as tf:
            tf.write(sql)
            tmp_path = tf.name
        try:
            run_sql_file(tmp_path)
        finally:
            os.unlink(tmp_path)
        if label:
            print(f"  ✓ {label}")

    with open(CSV_PATH, encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            current_row += 1

            # Pomiń już zaimportowane wiersze
            if current_row <= start_row:
                skipped += 1
                if skipped % 100_000 == 0:
                    print(f"  Pomijam... {skipped:,} wierszy zaimportowane, aktualnie na wierszu {current_row:,}")
                continue

            # Pomiń wiersze bez tytułu
            if not (row.get("title") or "").strip():
                continue

            # Pomiń filmy przed 1970 rokiem
            release = (row.get("release_date") or "").strip()
            if not release or release < "1970-01-01":
                continue

            # Pomiń treści dla dorosłych
            title_low = (row.get("title") or "").lower()
            desc_low  = (row.get("overview") or row.get("description") or "").lower()
            combined  = title_low + " " + desc_low
            if any(w in combined for w in BLOCKED_WORDS):
                continue

            try:
                buffer.append(row_to_sql_values(row))
            except Exception as e:
                print(f"  Ostrzeżenie: błąd parsowania wiersza {current_row}: {e}")
                continue

            imported += 1

            # Osiągnięto limit łączny
            if imported >= can_import:
                break

            # Flush co SQL_BATCH rekordów
            if len(buffer) >= SQL_BATCH:
                total_in_db = already_imported + imported
                pct = total_in_db / MAX_RECORDS * 100
                flush_buffer(buffer, f"W bazie: {total_in_db:,} / {MAX_RECORDS:,} ({pct:.1f}%) | CSV row {current_row:,}")
                buffer = []
                write_progress(current_row)

    # Flush reszty
    if buffer:
        flush_buffer(buffer, f"{start_row + imported:,} / {total_csv_rows:,} (100%) | ostatni batch")

    write_progress(current_row if imported > 0 else start_row)

    print(f"\n{'='*55}")
    print(f"Zaimportowano w tej sesji: {imported:,} rekordów")
    print(f"Łącznie w bazie:           ~{already_imported + imported:,} / {MAX_RECORDS:,}")
    print(f"Postęp CSV zapisany:       wiersz {current_row:,} / {total_csv_rows:,}")
    print(f"{'='*55}")

    if already_imported + imported >= MAX_RECORDS:
        print(f"\nOsiągnięto limit {MAX_RECORDS:,} rekordów — baza pełna.")
    elif start_row + imported >= total_csv_rows:
        print("\nWszystkie rekordy zostały zaimportowane!")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nPrzerwano przez użytkownika. Postęp został zapisany.")
