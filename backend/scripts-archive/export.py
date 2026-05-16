# KOD EXPORTERA Z BAZY D1 Z PLIKU DO PLIKU movies.db (LOKALNEJ KOPII BAZY FILMÓW) 
import sqlite3

sql_dump_path = 'movies_dump.sql'
local_db_path = 'movies.db'

conn = sqlite3.connect(local_db_path)
cursor = conn.cursor()

print("Rozpoczynam zaawansowane filtrowanie i import danych...")

statement = ""
count = 0

with open(sql_dump_path, 'r', encoding='utf-8') as file:
    for line in file:
        # Pomijamy komentarze SQL i puste linie
        if line.startswith('--') or line.startswith('/*') or not line.strip():
            continue
            
        # Budujemy pełne zapytanie SQL (sklejamy linie)
        statement += line
        
        # Jeśli linia kończy się średnikiem, to znaczy, że mamy całe zapytanie
        if line.strip().endswith(';'):
            # Wykonujemy tylko to, co dotyczy bezpośrednio tabeli 'movies'
            if 'movies' in statement:
                try:
                    cursor.execute(statement)
                    count += 1
                    if count % 1000 == 0:
                        print(f"Przetworzono i zapisano partię zapytania nr {count}...")
                except sqlite3.Error as e:
                    print(f"Pominięto problematyczną linię z błędem: {e}")
            
            # Czyszczenie bufora na następne zapytanie
            statement = ""

conn.commit()
conn.close()

print(f"Sukces! Masz czysty plik movies.db gotowy do wrzucenia przez SMB.")