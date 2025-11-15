-- Sample data for MovieTracker Cloudflare D1 database

-- Insert sample badges
INSERT INTO Badges (name, description, image_url) VALUES
  ('Początkujący kinoman', 'Obejrzyj swój pierwszy film', '/images/badges/beginner.png'),
  ('Miłośnik kina', 'Obejrzyj 10 filmów', '/images/badges/cinephile.png'),
  ('Maraton serialowy', 'Obejrzyj cały sezon serialu w jeden dzień', '/images/badges/binge-watcher.png'),
  ('Krytyk filmowy', 'Napisz 20 recenzji', '/images/badges/critic.png'),
  ('Fan Sci-Fi', 'Obejrzyj 15 filmów sci-fi', '/images/badges/scifi-fan.png');

-- Insert sample movies
INSERT INTO Movies (title, release_date, type, genre, description, poster_url, trailer_url) VALUES
  ('Incepcja', '2010-07-16', 'movie', 'Sci-Fi', 'Dom Cobb jest złodziejem najlepszym w swym fachu - kradnie cenne sekrety z głębin podświadomości podczas fazy snu.', 'https://via.placeholder.com/300x450/4CAF50/white?text=Incepcja', 'https://www.youtube.com/watch?v=YoHD9XEInc0'),
  ('Breaking Bad', '2008-01-20', 'series', 'Dramat', 'Zdiagnozowany na raka płuc nauczyciel chemii zaczyna produkować metamfetaminę.', 'https://via.placeholder.com/300x450/2196F3/white?text=Breaking+Bad', 'https://www.youtube.com/watch?v=HhesaQXLuRY'),
  ('Matrix', '1999-03-31', 'movie', 'Sci-Fi', 'Programista komputerowy odkrywa, że rzeczywistość w której żyje jest tylko symulacją.', 'https://via.placeholder.com/300x450/9C27B0/white?text=Matrix', 'https://www.youtube.com/watch?v=vKQi3bBA1y8'),
  ('Stranger Things', '2016-07-15', 'series', 'Horror', 'Grupa dzieci w małym miasteczku odkrywa nadprzyrodzone tajemnice.', 'https://via.placeholder.com/300x450/F44336/white?text=Stranger+Things', 'https://www.youtube.com/watch?v=b9EkMc79ZSU'),
  ('Avengers: Endgame', '2019-04-26', 'movie', 'Akcja', 'Avengers gromadzą się raz jeszcze, aby odwrócić działania Thanosa.', 'https://via.placeholder.com/300x450/3F51B5/white?text=Endgame', 'https://www.youtube.com/watch?v=TcMBFSGVi1c');

-- Insert a sample challenge
INSERT INTO Challenges (title, description, type, criteria_value, target_count, start_date, end_date, badge_id) VALUES
  ('Wyzwanie 10 filmów', 'Obejrzyj 10 różnych filmów w ciągu 30 dni', 'watch_count', 'movie', 10, datetime('now'), datetime('now', '+30 days'), 2);
