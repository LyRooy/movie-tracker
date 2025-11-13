/**
 * Cloudflare Worker for MovieTracker
 * Using Hono.js framework for fast, lightweight API
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';
import { bearerAuth } from 'hono/bearer-auth';

const app = new Hono();

// CORS configuration
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Helper function to hash password (using Web Crypto API)
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper function to verify password
async function verifyPassword(password, hash) {
  const hashedInput = await hashPassword(password);
  return hashedInput === hash;
}

// Helper function to generate JWT
function generateToken(env, userId, nickname) {
  const payload = {
    userId,
    nickname,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours
  };
  return jwt.sign(payload, env.JWT_SECRET);
}

// Middleware for JWT authentication
const authMiddleware = async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);
  try {
    const payload = jwt.verify(token, c.env.JWT_SECRET);
    c.set('userId', payload.userId);
    c.set('user', payload);
    await next();
  } catch (err) {
    return c.json({ error: 'Invalid token' }, 403);
  }
};

// Routes

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============= Authentication Routes =============

// Register
app.post('/api/register', async (c) => {
  try {
    const { nickname, email, password, role = 'user' } = await c.req.json();

    // Check if user exists
    const existing = await c.env.DB.prepare(
      'SELECT id FROM Users WHERE email = ?'
    ).bind(email).first();

    if (existing) {
      return c.json({ message: 'User already exists' }, 400);
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const result = await c.env.DB.prepare(
      'INSERT INTO Users (nickname, email, password_hash, role) VALUES (?, ?, ?, ?)'
    ).bind(nickname, email, passwordHash, role).run();

    const userId = result.meta.last_row_id;
    const token = generateToken(c.env, userId, nickname);

    return c.json({
      message: 'User created successfully',
      token,
      user: { id: userId, nickname, email },
    }, 201);
  } catch (error) {
    return c.json({ message: 'Server error', error: error.message }, 500);
  }
});

// Login
app.post('/api/login', async (c) => {
  try {
    const { email, password } = await c.req.json();

    const user = await c.env.DB.prepare(
      'SELECT * FROM Users WHERE email = ?'
    ).bind(email).first();

    if (!user) {
      return c.json({ message: 'Invalid credentials' }, 401);
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return c.json({ message: 'Invalid credentials' }, 401);
    }

    const token = generateToken(c.env, user.id, user.nickname);

    return c.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        nickname: user.nickname,
        email: user.email,
        avatar_url: user.avatar_url,
        theme_preference: user.theme_preference,
      },
    });
  } catch (error) {
    return c.json({ message: 'Server error', error: error.message }, 500);
  }
});

// ============= User Routes =============

// Get user profile
app.get('/api/user/profile', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');

    const user = await c.env.DB.prepare(
      'SELECT id, nickname, email, avatar_url, description, role, theme_preference FROM Users WHERE id = ?'
    ).bind(userId).first();

    if (!user) {
      return c.json({ message: 'User not found' }, 404);
    }

    return c.json(user);
  } catch (error) {
    return c.json({ message: 'Server error', error: error.message }, 500);
  }
});

// Update user profile
app.put('/api/user/profile', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const { nickname, description, theme_preference } = await c.req.json();

    await c.env.DB.prepare(
      'UPDATE Users SET nickname = ?, description = ?, theme_preference = ? WHERE id = ?'
    ).bind(nickname, description, theme_preference, userId).run();

    return c.json({ message: 'Profile updated successfully' });
  } catch (error) {
    return c.json({ message: 'Server error', error: error.message }, 500);
  }
});

// Get user statistics
app.get('/api/user/statistics', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');

    // Get total watched
    const watchedCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM Watched WHERE user_id = ?'
    ).bind(userId).first();

    // Get movies and series count
    const movieCount = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM Watched w 
       JOIN Movies m ON w.movie_id = m.id 
       WHERE w.user_id = ? AND m.type = 'movie'`
    ).bind(userId).first();

    const seriesCount = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM Watched w 
       JOIN Movies m ON w.movie_id = m.id 
       WHERE w.user_id = ? AND m.type = 'series'`
    ).bind(userId).first();

    // Get average rating
    const avgRating = await c.env.DB.prepare(
      'SELECT AVG(rating) as avg FROM Reviews WHERE user_id = ?'
    ).bind(userId).first();

    // Get genre counts
    const genres = await c.env.DB.prepare(
      `SELECT m.genre, COUNT(*) as count FROM Watched w 
       JOIN Movies m ON w.movie_id = m.id 
       WHERE w.user_id = ? AND m.genre IS NOT NULL 
       GROUP BY m.genre`
    ).bind(userId).all();

    const genreMap = {};
    genres.results.forEach(g => {
      genreMap[g.genre] = g.count;
    });

    return c.json({
      total_watched: watchedCount.count,
      movies_count: movieCount.count,
      series_count: seriesCount.count,
      total_reviews: 0, // TODO: implement
      average_rating: avgRating.avg || 0,
      genres: genreMap,
    });
  } catch (error) {
    return c.json({ message: 'Server error', error: error.message }, 500);
  }
});

// ============= Movies Routes =============

// Search movies
app.get('/api/movies/search', async (c) => {
  try {
    const query = c.req.query('query');
    const type = c.req.query('type');
    const genre = c.req.query('genre');
    const year = c.req.query('year');

    let sql = 'SELECT * FROM Movies WHERE 1=1';
    const bindings = [];

    if (query) {
      sql += ' AND title LIKE ?';
      bindings.push(`%${query}%`);
    }

    if (type) {
      sql += ' AND type = ?';
      bindings.push(type);
    }

    if (genre) {
      sql += ' AND genre LIKE ?';
      bindings.push(`%${genre}%`);
    }

    if (year) {
      sql += ' AND strftime("%Y", release_date) = ?';
      bindings.push(year);
    }

    sql += ' ORDER BY title LIMIT 50';

    const stmt = c.env.DB.prepare(sql);
    const result = await stmt.bind(...bindings).all();

    return c.json(result.results);
  } catch (error) {
    return c.json({ message: 'Server error', error: error.message }, 500);
  }
});

// Get movie by ID
app.get('/api/movies/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const movie = await c.env.DB.prepare(
      'SELECT * FROM Movies WHERE id = ?'
    ).bind(id).first();

    if (!movie) {
      return c.json({ message: 'Movie not found' }, 404);
    }

    return c.json(movie);
  } catch (error) {
    return c.json({ message: 'Server error', error: error.message }, 500);
  }
});

// Add movie
app.post('/api/movies', authMiddleware, async (c) => {
  try {
    const { title, type, genre, release_date, description, poster_url, trailer_url } = await c.req.json();

    const result = await c.env.DB.prepare(
      'INSERT INTO Movies (title, type, genre, release_date, description, poster_url, trailer_url) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(title, type, genre, release_date, description, poster_url, trailer_url).run();

    return c.json({
      message: 'Movie added successfully',
      id: result.meta.last_row_id,
    }, 201);
  } catch (error) {
    return c.json({ message: 'Server error', error: error.message }, 500);
  }
});

// ============= Watched Routes =============

// Get watched list
app.get('/api/watched', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');

    const watched = await c.env.DB.prepare(
      `SELECT w.*, m.* FROM Watched w 
       JOIN Movies m ON w.movie_id = m.id 
       WHERE w.user_id = ?
       ORDER BY w.watched_date DESC`
    ).bind(userId).all();

    return c.json(watched.results);
  } catch (error) {
    return c.json({ message: 'Server error', error: error.message }, 500);
  }
});

// Add to watched
app.post('/api/watched', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const { movie_id, watched_date } = await c.req.json();

    const result = await c.env.DB.prepare(
      'INSERT INTO Watched (user_id, movie_id, watched_date) VALUES (?, ?, ?)'
    ).bind(userId, movie_id, watched_date || new Date().toISOString().split('T')[0]).run();

    return c.json({
      message: 'Added to watched list',
      id: result.meta.last_row_id,
    }, 201);
  } catch (error) {
    return c.json({ message: 'Server error', error: error.message }, 500);
  }
});

// Delete from watched
app.delete('/api/watched/:id', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const id = c.req.param('id');

    // Check ownership
    const watched = await c.env.DB.prepare(
      'SELECT * FROM Watched WHERE id = ? AND user_id = ?'
    ).bind(id, userId).first();

    if (!watched) {
      return c.json({ message: 'Watched entry not found' }, 404);
    }

    await c.env.DB.prepare(
      'DELETE FROM Watched WHERE id = ?'
    ).bind(id).run();

    return c.json({ message: 'Removed from watched list' });
  } catch (error) {
    return c.json({ message: 'Server error', error: error.message }, 500);
  }
});

// ============= Reviews Routes =============

// Get reviews for a movie
app.get('/api/reviews/movie/:movieId', async (c) => {
  try {
    const movieId = c.req.param('movieId');

    const reviews = await c.env.DB.prepare(
      `SELECT r.*, u.nickname, u.avatar_url 
       FROM Reviews r 
       JOIN Users u ON r.user_id = u.id 
       WHERE r.movie_id = ?
       ORDER BY r.created_at DESC`
    ).bind(movieId).all();

    return c.json(reviews.results);
  } catch (error) {
    return c.json({ message: 'Server error', error: error.message }, 500);
  }
});

// Add review
app.post('/api/reviews', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const { movie_id, content, rating } = await c.req.json();

    if (rating < 1 || rating > 5) {
      return c.json({ message: 'Rating must be between 1 and 5' }, 400);
    }

    const result = await c.env.DB.prepare(
      'INSERT INTO Reviews (user_id, movie_id, content, rating) VALUES (?, ?, ?, ?)'
    ).bind(userId, movie_id, content, rating).run();

    return c.json({
      message: 'Review added successfully',
      id: result.meta.last_row_id,
    }, 201);
  } catch (error) {
    return c.json({ message: 'Server error', error: error.message }, 500);
  }
});

// ============= Challenges Routes =============

// Get all challenges
app.get('/api/challenges', async (c) => {
  try {
    const active = c.req.query('active');

    let sql = 'SELECT * FROM Challenges';
    if (active === 'true') {
      sql += ' WHERE start_date <= datetime("now") AND end_date >= datetime("now")';
    }
    sql += ' ORDER BY created_at DESC';

    const result = await c.env.DB.prepare(sql).all();
    return c.json(result.results);
  } catch (error) {
    return c.json({ message: 'Server error', error: error.message }, 500);
  }
});

// Get badges
app.get('/api/badges', async (c) => {
  try {
    const result = await c.env.DB.prepare('SELECT * FROM Badges').all();
    return c.json(result.results);
  } catch (error) {
    return c.json({ message: 'Server error', error: error.message }, 500);
  }
});

// Export
export default app;
