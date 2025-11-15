-- Cloudflare D1 Database Schema for MovieTracker
-- This schema creates all necessary tables for the application

-- Users table
CREATE TABLE IF NOT EXISTS Users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  description TEXT,
  role TEXT CHECK(role IN ('admin', 'user', 'guest')) DEFAULT 'user',
  theme_preference TEXT CHECK(theme_preference IN ('light', 'dark')) DEFAULT 'light',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON Users(email);
CREATE INDEX idx_users_role ON Users(role);

-- Movies table
CREATE TABLE IF NOT EXISTS Movies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  release_date DATE,
  type TEXT CHECK(type IN ('movie', 'series')) NOT NULL,
  genre TEXT,
  description TEXT,
  poster_url TEXT,
  trailer_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_movies_type ON Movies(type);
CREATE INDEX idx_movies_genre ON Movies(genre);
CREATE INDEX idx_movies_title ON Movies(title);

-- Watched table
CREATE TABLE IF NOT EXISTS Watched (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  movie_id INTEGER NOT NULL,
  watched_date DATE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
  FOREIGN KEY (movie_id) REFERENCES Movies(id) ON DELETE CASCADE
);

CREATE INDEX idx_watched_user ON Watched(user_id);
CREATE INDEX idx_watched_movie ON Watched(movie_id);
CREATE INDEX idx_watched_date ON Watched(watched_date);

-- Reviews table
CREATE TABLE IF NOT EXISTS Reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  movie_id INTEGER NOT NULL,
  content TEXT,
  rating INTEGER CHECK(rating >= 1 AND rating <= 5) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
  FOREIGN KEY (movie_id) REFERENCES Movies(id) ON DELETE CASCADE
);

CREATE INDEX idx_reviews_user ON Reviews(user_id);
CREATE INDEX idx_reviews_movie ON Reviews(movie_id);
CREATE INDEX idx_reviews_rating ON Reviews(rating);

-- Challenges table
CREATE TABLE IF NOT EXISTS Challenges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  criteria_value TEXT,
  target_count INTEGER NOT NULL,
  start_date DATETIME NOT NULL,
  end_date DATETIME,
  badge_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (badge_id) REFERENCES Badges(id)
);

CREATE INDEX idx_challenges_dates ON Challenges(start_date, end_date);
CREATE INDEX idx_challenges_type ON Challenges(type);

-- Badges table
CREATE TABLE IF NOT EXISTS Badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Challenge_Participants table
CREATE TABLE IF NOT EXISTS Challenge_Participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  challenge_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  progress INTEGER DEFAULT 0,
  FOREIGN KEY (challenge_id) REFERENCES Challenges(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
  UNIQUE(challenge_id, user_id)
);

CREATE INDEX idx_participants_challenge ON Challenge_Participants(challenge_id);
CREATE INDEX idx_participants_user ON Challenge_Participants(user_id);
CREATE INDEX idx_participants_status ON Challenge_Participants(completed_at);

-- Challenge_Watched table
CREATE TABLE IF NOT EXISTS Challenge_Watched (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  challenge_participant_id INTEGER NOT NULL,
  movie_id INTEGER NOT NULL,
  watched_date DATE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (challenge_participant_id) REFERENCES Challenge_Participants(id) ON DELETE CASCADE,
  FOREIGN KEY (movie_id) REFERENCES Movies(id) ON DELETE CASCADE
);

CREATE INDEX idx_challenge_watched_participant ON Challenge_Watched(challenge_participant_id);
CREATE INDEX idx_challenge_watched_movie ON Challenge_Watched(movie_id);

-- User_Badges table
CREATE TABLE IF NOT EXISTS User_Badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  badge_id INTEGER NOT NULL,
  challenge_participant_id INTEGER,
  level TEXT CHECK(level IN ('silver', 'gold', 'platinum', 'none')) DEFAULT 'none',
  earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
  FOREIGN KEY (badge_id) REFERENCES Badges(id) ON DELETE CASCADE,
  FOREIGN KEY (challenge_participant_id) REFERENCES Challenge_Participants(id)
);

CREATE INDEX idx_user_badges_user ON User_Badges(user_id);
CREATE INDEX idx_user_badges_badge ON User_Badges(badge_id);
CREATE INDEX idx_user_badges_level ON User_Badges(level);

-- Friends table
CREATE TABLE IF NOT EXISTS Friends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user1_id INTEGER NOT NULL,
  user2_id INTEGER NOT NULL,
  status TEXT CHECK(status IN ('pending', 'accepted', 'rejected', 'blocked')) DEFAULT 'pending',
  requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  responded_at DATETIME,
  FOREIGN KEY (user1_id) REFERENCES Users(id) ON DELETE CASCADE,
  FOREIGN KEY (user2_id) REFERENCES Users(id) ON DELETE CASCADE,
  UNIQUE(user1_id, user2_id)
);

CREATE INDEX idx_friends_user1 ON Friends(user1_id);
CREATE INDEX idx_friends_user2 ON Friends(user2_id);
CREATE INDEX idx_friends_status ON Friends(status);
