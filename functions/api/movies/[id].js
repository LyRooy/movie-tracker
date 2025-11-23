// Endpoint użytkownika do zarządzania pojedynczymi filmami na jego liście do obejrzenia

// Funkcja pomocnicza zapewniająca, że adresy URL plakatów używają HTTPS
function normalizePosterUrl(url) {
  if (!url) return null;
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }
  return url;
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const method = request.method;
  const movieId = params.id;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Log do debugowania
  console.log(`[movies/[id].js] Method: ${method}, Movie ID: ${movieId}`);

  try {
    // Sprawdź uwierzytelnienie
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      console.error('[movies/[id].js] No userId found');
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[movies/[id].js] User ID: ${userId}`);

    switch (method) {
      case 'GET':
        return handleGetMovie(env.db, userId, movieId, corsHeaders);
      case 'PUT':
        return handleUpdateMovie(env.db, userId, request, movieId, corsHeaders);
      case 'DELETE':
        return handleDeleteMovie(env.db, userId, movieId, corsHeaders);
      default:
        return new Response('Method not allowed', { 
          status: 405,
          headers: corsHeaders 
        });
    }
  } catch (error) {
    console.error('[movies/[id].js] Error:', error);
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Pobierz konkretny film z recenzją użytkownika i statusem obejrzenia
async function handleGetMovie(db, userId, movieId, corsHeaders) {
  const query = `
    SELECT 
      m.id,
      m.title,
      m.media_type as type,
      m.release_date,
      strftime('%Y', m.release_date) as year,
      m.genre,
      m.poster_url as poster,
      m.description,
      m.duration,
      r.rating,
      r.content as review,
      w.watched_date as watchedDate,
      COALESCE(w.status, CASE WHEN w.id IS NOT NULL THEN 'watched' ELSE 'planning' END) as status
    FROM movies m
    LEFT JOIN reviews r ON m.id = r.movie_id AND r.user_id = ?
    LEFT JOIN watched w ON m.id = w.movie_id AND w.user_id = ?
    WHERE m.id = ?
  `;
  
  const movie = await db.prepare(query).bind(userId, userId, movieId).first();
  
  if (!movie) {
    return new Response(JSON.stringify({ error: 'Movie not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Przekształć do formatu zgodnego z frontendem
  // sanitize year and duration
  const rawYear = parseInt(movie.year);
  const currentYear = new Date().getFullYear();
  const year = (Number.isFinite(rawYear) && rawYear >= 1800 && rawYear <= currentYear + 5) ? rawYear : null;
  const movieDuration = (movie.duration !== undefined && movie.duration !== null) ? Number(movie.duration) : null;

  const transformedMovie = {
    id: movie.id,
    title: movie.title,
    type: movie.type,
    year: year,
    release_date: movie.release_date || null,
    genre: movie.genre || 'Unknown',
    description: movie.description || '',
    rating: movie.rating || 0,
    status: movie.status,
    watchedDate: movie.watchedDate || null,
    // Provide canonical poster_url for frontend to prefer, keep poster fallback for legacy clients
    poster_url: normalizePosterUrl(movie.poster) || null,
    poster: normalizePosterUrl(movie.poster) || `https://placehold.co/200x300/4CAF50/white/png?text=${encodeURIComponent(movie.title)}`,
    // do not default to 120 minutes for movies; keep null if unknown
    duration: movie.type === 'movie' ? movieDuration : null,
    review: movie.review || ''
  };

  // Jeśli to serial, oblicz średnią długość odcinka
  if (transformedMovie.type === 'series') {
    try {
      const avgRes = await env.db.prepare(`
        SELECT AVG(e.duration) as avg_duration
        FROM episodes e
        JOIN seasons s ON e.season_id = s.id
        WHERE s.series_id = ?
      `).bind(movieId).first();
      if (avgRes && avgRes.avg_duration !== null) {
        transformedMovie.avgEpisodeLength = Math.round(avgRes.avg_duration);
        // set duration to avgEpisodeLength for frontend convenience
        transformedMovie.duration = transformedMovie.avgEpisodeLength;
      } else {
        transformedMovie.avgEpisodeLength = null;
      }
    } catch (e) {
      console.warn('[movies/[id].js] Could not compute avg episode duration:', e);
      transformedMovie.avgEpisodeLength = null;
    }
  }

  return new Response(JSON.stringify(transformedMovie), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Zaktualizuj film (ocena, recenzja, status obejrzenia)
async function handleUpdateMovie(db, userId, request, movieId, corsHeaders) {
  let data;
  try {
    data = await request.json();
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Zweryfikuj, czy film istnieje
    const movie = await db.prepare('SELECT id FROM movies WHERE id = ?').bind(movieId).first();
    if (!movie) {
      return new Response(JSON.stringify({ error: 'Movie not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Zaktualizuj status obejrzenia na podstawie pola status
    if (data.status) {
      const watchedDate = data.watchedDate || new Date().toISOString().split('T')[0];
      
      // Sprawdź, czy rekord watched istnieje
      const existingWatched = await db.prepare(
        'SELECT id FROM watched WHERE user_id = ? AND movie_id = ?'
      ).bind(userId, movieId).first();
      
      if (existingWatched) {
        // Zaktualizuj istniejący rekord nowym statusem
        await db.prepare(`
          UPDATE watched 
          SET watched_date = ?, status = ?
          WHERE user_id = ? AND movie_id = ?
        `).bind(watchedDate, data.status, userId, movieId).run();
      } else {
        // Wstaw nowy rekord ze statusem
        await db.prepare(`
          INSERT INTO watched (user_id, movie_id, watched_date, status)
          VALUES (?, ?, ?, ?)
        `).bind(userId, movieId, watchedDate, data.status).run();
      }
    }
    
    // Zaktualizuj recenzję i ocenę
    if (data.rating !== undefined) {
      if (data.rating > 0) {
        // Sprawdź, czy recenzja istnieje
        const existingReview = await db.prepare(
          'SELECT id FROM reviews WHERE user_id = ? AND movie_id = ?'
        ).bind(userId, movieId).first();
        
        if (existingReview) {
          // Zaktualizuj istniejącą recenzję
          await db.prepare(`
            UPDATE reviews 
            SET content = ?, rating = ?, updated_at = datetime('now')
            WHERE user_id = ? AND movie_id = ?
          `).bind(data.review || '', data.rating, userId, movieId).run();
        } else {
          // Wstaw nową recenzję
          await db.prepare(`
            INSERT INTO reviews (user_id, movie_id, content, rating)
            VALUES (?, ?, ?, ?)
          `).bind(userId, movieId, data.review || '', data.rating).run();
        }
      } else {
        // Jeśli ocena wynosi 0, usuń recenzję
        await db.prepare(`
          DELETE FROM reviews WHERE user_id = ? AND movie_id = ?
        `).bind(userId, movieId).run();
      }
    }
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating movie:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.toString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Usuń film z listy obejrzanych użytkownika (usuwa status obejrzenia i recenzję, ale nie sam film)
async function handleDeleteMovie(db, userId, movieId, corsHeaders) {
  try {
    // Zweryfikuj, czy film istnieje
    const movie = await db.prepare('SELECT id, media_type FROM movies WHERE id = ?').bind(movieId).first();
    if (!movie) {
      return new Response(JSON.stringify({ error: 'Movie not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Jeśli to serial, usuń również wszystkie obejrzane odcinki użytkownika
    if (movie.media_type === 'series') {
      await db.prepare(`
        DELETE FROM user_episodes_watched 
        WHERE user_id = ? 
        AND episode_id IN (
          SELECT e.id FROM episodes e
          JOIN seasons s ON e.season_id = s.id
          WHERE s.series_id = ?
        )
      `).bind(userId, movieId).run();
    }
    
    // Usuń z listy obejrzanych
    const watchedResult = await db.prepare('DELETE FROM watched WHERE user_id = ? AND movie_id = ?')
      .bind(userId, movieId)
      .run();
    
    // Usuń recenzję
    const reviewResult = await db.prepare('DELETE FROM reviews WHERE user_id = ? AND movie_id = ?')
      .bind(userId, movieId)
      .run();
    
    console.log(`[handleDeleteMovie] Deleted ${watchedResult.meta?.changes || 0} watched records and ${reviewResult.meta?.changes || 0} review records`);
    
    return new Response(JSON.stringify({ 
      success: true,
      deletedWatched: watchedResult.meta?.changes || 0,
      deletedReviews: reviewResult.meta?.changes || 0
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error deleting movie:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.toString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
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
      return null; // Token wygasł
    }
    
    return payload.userId;
  } catch {
    return null;
  }
}
