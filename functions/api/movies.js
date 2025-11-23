// Endpoint API dla operacji na filmach/serialach
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  // Nagłówki CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    switch (method) {
      case 'GET':
        return handleGet(env.db, request, url, corsHeaders);
      case 'POST':
        return handlePost(env.db, request, corsHeaders);
      default:
        return new Response('Method not allowed', { 
          status: 405,
          headers: corsHeaders 
        });
    }
  } catch (error) {
    console.error('Error in movies API:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Pobierz filmy/seriale z recenzjami i statusem obejrzenia
async function handleGet(db, request, url, corsHeaders) {
  const userId = await getUserIdFromRequest(request);
  
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  const status = url.searchParams.get('status');
  const type = url.searchParams.get('type');

  // Połącz tabele Movies z tabelami Reviews i Watched
  // Zwróć tylko filmy, z którymi użytkownik wchodził w interakcję (obejrzane lub zrecenzowane)
  let query = `
    SELECT 
      m.id,
      m.title,
      m.media_type as type,
      strftime('%Y', m.release_date) as year,
      m.genre,
      m.poster_url as poster,
      COALESCE(m.total_seasons, 1) as total_seasons,
      COALESCE(m.total_episodes, 1) as total_episodes,
      COALESCE(r.rating, 0) as rating,
      r.content as review,
      w.watched_date as watchedDate,
      COALESCE(w.status, 'watched') as status,
      120 as duration
    FROM movies m
    LEFT JOIN reviews r ON m.id = r.movie_id AND r.user_id = ?
    LEFT JOIN watched w ON m.id = w.movie_id AND w.user_id = ?
    WHERE (w.id IS NOT NULL OR r.id IS NOT NULL)
  `;
  
  let params = [userId, userId];
  let additionalWhere = [];

  // Filtruj według statusu, jeśli został podany (i nie jest 'all')
  if (status && status !== 'all') {
    additionalWhere.push('COALESCE(w.status, \'watched\') = ?');
    params.push(status);
  }

  if (type) {
    additionalWhere.push('m.media_type = ?');
    params.push(type);
  }

  if (additionalWhere.length > 0) {
    query += ' AND ' + additionalWhere.join(' AND ');
  }

  query += ' ORDER BY COALESCE(w.watched_date, m.created_at) DESC';

  try {
    const result = await db.prepare(query).bind(...params).all();
    
    if (!result || !result.results) {
      console.error('Query returned no results object:', result);
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log('Query returned', result.results.length, 'rows');
    
    // Dla każdego serialu pobierz liczbę obejrzanych odcinków
        const transformedResults = await Promise.all(result.results.map(async row => {
      try {
        let watchedEpisodes = 0;
        
        // Jeśli to serial, policz obejrzane odcinki
        if (row.type === 'series') {
          try {
            const episodesResult = await db.prepare(`
              SELECT COUNT(*) as count
              FROM user_episodes_watched uew
              JOIN episodes e ON uew.episode_id = e.id
              JOIN seasons s ON e.season_id = s.id
              WHERE s.series_id = ? AND uew.user_id = ?
            `).bind(row.id, userId).first();
            
            watchedEpisodes = episodesResult?.count || 0;
          } catch (e) {
            console.warn('Could not fetch watched episodes:', e);
          }
        }
            // Compute average episode duration for series (from episodes.duration) if available
            let avgEpisodeLength = null;
            if (row.type === 'series') {
              try {
                const avgRes = await db.prepare(`
                  SELECT AVG(e.duration) as avg_duration
                  FROM episodes e
                  JOIN seasons s ON e.season_id = s.id
                  WHERE s.series_id = ?
                `).bind(row.id).first();
                if (avgRes && avgRes.avg_duration !== null) {
                  avgEpisodeLength = Math.round(avgRes.avg_duration);
                }
              } catch (e) {
                console.warn('Could not compute avg episode duration:', e);
              }
            }

        return {
          id: row.id,
          title: row.title,
          type: row.type,
          year: parseInt(row.year) || new Date().getFullYear(),
          genre: row.genre || 'Unknown',
          rating: row.rating || 0,
          status: row.status || 'watched',
          watchedDate: row.watchedDate || null,
              // Expose canonical `poster_url` (if available) and keep `poster` for backwards compatibility
              poster_url: normalizePosterUrl(row.poster) || null,
              poster: normalizePosterUrl(row.poster) || `https://placehold.co/200x300/4CAF50/white/png?text=${encodeURIComponent(row.title)}`,
              // For movies keep duration; for series expose avgEpisodeLength
              duration: row.type === 'movie' ? (row.duration || 120) : (avgEpisodeLength || (row.duration || 120)),
          review: row.review || '',
          // Pola specyficzne dla seriali
          totalSeasons: row.total_seasons || null,
          totalEpisodes: row.total_episodes || null,
              watchedEpisodes: watchedEpisodes,
              avgEpisodeLength: avgEpisodeLength,
          // Oblicz postęp dla serialu
          progress: row.type === 'series' && row.total_episodes > 0 
            ? Math.round((watchedEpisodes / row.total_episodes) * 100) 
            : null
        };
      } catch (rowError) {
        console.error('Error processing row:', row.id, rowError);
        // Zwróć podstawowy obiekt w przypadku błędu
        return {
          id: row.id,
          title: row.title,
          type: row.type || 'movie',
          year: parseInt(row.year) || new Date().getFullYear(),
          genre: row.genre || 'Unknown',
          rating: row.rating || 0,
          status: row.status || 'watched',
          watchedDate: row.watchedDate || null,
          poster_url: null,
          poster: `https://placehold.co/200x300/4CAF50/white/png?text=${encodeURIComponent(row.title || 'Movie')}`,
          duration: 120,
          review: ''
        };
      }
    }));
    
    return new Response(JSON.stringify(transformedResults), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in handleGet:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      query: query,
      params: params 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Dodaj film do listy obejrzanych użytkownika (nie twórz nowego filmu!)
async function handlePost(db, request, corsHeaders) {
  const userId = await getUserIdFromRequest(request);
  
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  const data = await request.json();
  
  try {
    // Zweryfikuj, czy film istnieje
    if (!data.id) {
      return new Response(JSON.stringify({ error: 'Movie ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Normalizuj ID: frontend czasami dodaje przedrostek `db_` do ID z bazy danych (zobacz /api/search)
    let movieIdParam = data.id;
    if (typeof movieIdParam === 'string') {
      if (movieIdParam.startsWith('db_')) {
        movieIdParam = movieIdParam.replace(/^db_/, '');
      }
      // jeśli ciąg cyfr, konwertuj na liczbę
      if (/^\d+$/.test(movieIdParam)) {
        movieIdParam = parseInt(movieIdParam, 10);
      }
    }

    if (typeof movieIdParam !== 'number' || Number.isNaN(movieIdParam)) {
      return new Response(JSON.stringify({ error: 'Movie ID invalid' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const movie = await db.prepare('SELECT id FROM movies WHERE id = ?').bind(movieIdParam).first();
    if (!movie) {
      return new Response(JSON.stringify({ error: 'Movie not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const movieId = movie.id;
    
    // Dodaj do tabeli watched z odpowiednim statusem
    const watchedStatus = data.status || 'watched';
    
    // Sprawdź, czy już znajduje się w tabeli watched
    const alreadyWatched = await db.prepare('SELECT id FROM watched WHERE user_id = ? AND movie_id = ?')
      .bind(userId, movieId).first();
    
    if (!alreadyWatched) {
      await db.prepare(`
        INSERT INTO watched (user_id, movie_id, watched_date, status)
        VALUES (?, ?, ?, ?)
      `).bind(userId, movieId, data.watchedDate || new Date().toISOString().split('T')[0], watchedStatus).run();
    } else {
      // Zaktualizuj status, jeśli już istnieje
      await db.prepare(`
        UPDATE watched 
        SET status = ?, watched_date = ?
        WHERE user_id = ? AND movie_id = ?
      `).bind(watchedStatus, data.watchedDate || new Date().toISOString().split('T')[0], userId, movieId).run();
    }
    
    // Dodaj lub zaktualizuj recenzję, jeśli podano ocenę
    if (data.rating > 0) {
      const existingReview = await db.prepare('SELECT id FROM reviews WHERE user_id = ? AND movie_id = ?')
        .bind(userId, movieId).first();
      
      if (existingReview) {
        await db.prepare(`
          UPDATE reviews SET content = ?, rating = ?, updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
          WHERE user_id = ? AND movie_id = ?
        `).bind(data.review || '', data.rating, userId, movieId).run();
      } else {
        await db.prepare(`
          INSERT INTO reviews (user_id, movie_id, content, rating)
          VALUES (?, ?, ?, ?)
        `).bind(userId, movieId, data.review || '', data.rating).run();
      }
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      id: movieId 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in handlePost:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
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