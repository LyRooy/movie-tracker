// Endpoint administracyjny do zarządzania filmami w bazie danych

// Funkcja pomocnicza zapewniająca, że adresy URL plakatów używają HTTPS
function normalizePosterUrl(url) {
  if (!url) return null;
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }
  return url;
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Sprawdź czy użytkownik jest administratorem
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const user = await env.db.prepare('SELECT role FROM users WHERE id = ?').bind(userId).first();
    if (!user || user.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    switch (method) {
      case 'GET':
        return handleGetMovies(env.db, request, corsHeaders);
      case 'POST':
        return handleCreateMovie(env.db, request, corsHeaders);
      case 'PUT':
        return handleUpdateMovie(env.db, request, corsHeaders);
      case 'DELETE':
        return handleDeleteMovie(env.db, request, corsHeaders);
      default:
        return new Response('Method not allowed', { 
          status: 405,
          headers: corsHeaders 
        });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Pobierz filmy (wszystkie lub konkretny po ID)
async function handleGetMovies(db, request, corsHeaders) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const movieId = pathParts[pathParts.length - 1] !== 'movies' ? pathParts[pathParts.length - 1] : null;

  if (movieId) {
    // Pobierz konkretny film
    const movie = await db.prepare('SELECT * FROM movies WHERE id = ?').bind(movieId).first();
    if (!movie) {
      return new Response(JSON.stringify({ error: 'Movie not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify(movie), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } else {
    // Pobierz wszystkie filmy
    const movies = await db.prepare('SELECT * FROM movies ORDER BY title').all();
    return new Response(JSON.stringify(movies.results || []), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Ensure the movies table has a duration column (safe migration at runtime)
async function ensureMoviesHasDuration(db) {
  try {
    const info = await db.prepare("PRAGMA table_info(movies)").all();
    const cols = (info && info.results) ? info.results : (info || []);
    const hasDuration = cols.some && cols.some(c => c.name === 'duration');
    if (!hasDuration) {
      await db.prepare('ALTER TABLE movies ADD COLUMN duration INTEGER').run();
    }
  } catch (e) {
    // If for some reason PRAGMA or ALTER fails, log and continue — endpoint will still try to use duration
    console.error('ensureMoviesHasDuration error:', e);
  }
}

// Utwórz nowy film
async function handleCreateMovie(db, request, corsHeaders) {
  try {
    const data = await request.json();
    // Ensure DB has duration column so we can persist minutes
    await ensureMoviesHasDuration(db);
    
    console.log('Creating movie with data:', data);
    
    if (!data.title || !data.type) {
      return new Response(JSON.stringify({ error: 'Title and type are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Sprawdź czy film już istnieje
    const existing = await db.prepare('SELECT id FROM movies WHERE title = ? AND media_type = ?')
      .bind(data.title, data.type).first();
    
    if (existing) {
      return new Response(JSON.stringify({ error: 'Movie already exists', id: existing.id }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Oblicz całkowitą liczbę odcinków dla serialu
    const totalSeasons = data.totalSeasons || 1;
    const episodesPerSeason = data.episodesPerSeason || (data.type === 'series' ? 10 : 1);
    const totalEpisodes = data.type === 'series' ? totalSeasons * episodesPerSeason : 1;

    const result = await db.prepare(`
      INSERT INTO movies (title, media_type, release_date, genre, poster_url, description, duration, total_seasons, total_episodes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      data.title,
      data.type,
      data.year || new Date().getFullYear().toString(),
      data.genre || 'Unknown',
      normalizePosterUrl(data.poster) || `https://placehold.co/200x300/4CAF50/white/png?text=${encodeURIComponent(data.title)}`,
      data.description || '',
      (data.type === 'movie' && data.duration !== undefined) ? Number(data.duration) : null,
      totalSeasons,
      totalEpisodes
    ).run();

    const movieId = result.meta.last_row_id;

    // Jeśli to serial, utwórz sezony i odcinki
    if (data.type === 'series') {
      // Use provided duration for episodes, or default to 45
      const episodeDuration = data.duration !== undefined ? Number(data.duration) : 45;
      
      for (let seasonNum = 1; seasonNum <= totalSeasons; seasonNum++) {
        // Utwórz sezon
        const seasonResult = await db.prepare(`
          INSERT INTO seasons (series_id, season_number, episode_count, title)
          VALUES (?, ?, ?, ?)
        `).bind(
          movieId,
          seasonNum,
          episodesPerSeason,
          `Sezon ${seasonNum}`
        ).run();

        const seasonId = seasonResult.meta.last_row_id;

        // Utwórz odcinki dla tego sezonu
        for (let episodeNum = 1; episodeNum <= episodesPerSeason; episodeNum++) {
          await db.prepare(`
            INSERT INTO episodes (season_id, episode_number, title, duration)
            VALUES (?, ?, ?, ?)
          `).bind(
            seasonId,
            episodeNum,
            `Odcinek ${episodeNum}`,
            episodeDuration
          ).run();
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      id: movieId 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in handleCreateMovie:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Zaktualizuj istniejący film
async function handleUpdateMovie(db, request, corsHeaders) {
  const data = await request.json();
  
  if (!data.id) {
    return new Response(JSON.stringify({ error: 'Movie ID is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const updates = [];
  const params = [];

  if (data.title) {
    updates.push('title = ?');
    params.push(data.title);
  }
  if (data.type) {
    updates.push('media_type = ?');
    params.push(data.type);
  }
  if (data.year !== undefined) {
    updates.push('release_date = ?');
    params.push(data.year);
  }
  if (data.genre) {
    updates.push('genre = ?');
    params.push(data.genre);
  }
  if (data.poster) {
    updates.push('poster_url = ?');
    params.push(normalizePosterUrl(data.poster));
  }
  if (data.description !== undefined) {
    updates.push('description = ?');
    params.push(data.description);
  }
  if (data.duration !== undefined) {
    // For movies duration should be minutes; for series it should be null
    updates.push('duration = ?');
    params.push(data.type === 'series' ? null : Number(data.duration));
  }

  if (updates.length === 0) {
    return new Response(JSON.stringify({ error: 'No fields to update' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  params.push(data.id);
  
  // Ensure duration column exists before updating
  await ensureMoviesHasDuration(db);

  await db.prepare(`
    UPDATE movies SET ${updates.join(', ')} WHERE id = ?
  `).bind(...params).run();

  // If admin provided average duration for a series, propagate it to episodes
  try {
    if (data.duration !== undefined && data.type === 'series') {
      const avg = Number(data.duration);
      if (!Number.isNaN(avg)) {
        await db.prepare(`
          UPDATE episodes SET duration = ?
          WHERE season_id IN (SELECT id FROM seasons WHERE series_id = ?)
        `).bind(avg, data.id).run();
      }
    }
  } catch (e) {
    console.error('Error propagating avg duration to episodes:', e);
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Usuń film
async function handleDeleteMovie(db, request, corsHeaders) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  
  if (!id) {
    return new Response(JSON.stringify({ error: 'Movie ID is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Usuń powiązane rekordy najpierw (jeśli nie ma kaskadowania)
  await db.prepare('DELETE FROM challenge_watched WHERE movie_id = ?').bind(id).run();
  await db.prepare('DELETE FROM reviews WHERE movie_id = ?').bind(id).run();
  await db.prepare('DELETE FROM watched WHERE movie_id = ?').bind(id).run();
  await db.prepare('DELETE FROM movies WHERE id = ?').bind(id).run();

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Wyodrębnij ID użytkownika z nagłówka Authorization
async function getUserIdFromRequest(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const payload = JSON.parse(atob(token));
    
    if (payload.exp < Date.now()) {
      return null;
    }
    
    return payload.userId;
  } catch {
    return null;
  }
}
