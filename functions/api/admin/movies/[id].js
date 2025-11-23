// Endpoint administracyjny do zarządzania pojedynczymi filmami
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
        return handleGetMovie(env.db, movieId, corsHeaders);
      case 'PUT':
        return handleUpdateMovie(env.db, request, movieId, corsHeaders);
      case 'DELETE':
        return handleDeleteMovie(env.db, movieId, corsHeaders);
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

// Pobierz konkretny film
async function handleGetMovie(db, movieId, corsHeaders) {
  const movie = await db.prepare('SELECT * FROM movies WHERE id = ?').bind(movieId).first();
  
  if (!movie) {
    return new Response(JSON.stringify({ error: 'Movie not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Dla seriali pobierz średni czas trwania odcinka z tabeli episodes
  if (movie.media_type === 'series') {
    const episodeDurations = await db.prepare(`
      SELECT AVG(e.duration) as avg_duration
      FROM episodes e
      JOIN seasons s ON e.season_id = s.id
      WHERE s.series_id = ?
    `).bind(movieId).first();
    
    if (episodeDurations && episodeDurations.avg_duration) {
      movie.duration = Math.round(episodeDurations.avg_duration);
    }
  }

  return new Response(JSON.stringify(movie), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Zaktualizuj film
async function handleUpdateMovie(db, request, movieId, corsHeaders) {
  const data = await request.json();
  
  // Zbuduj zapytanie UPDATE dynamicznie na podstawie podanych pól
  const updates = [];
  const values = [];
  
  if (data.title !== undefined) {
    updates.push('title = ?');
    values.push(data.title);
  }
  if (data.type !== undefined) {
    updates.push('media_type = ?');
    values.push(data.type);
  }
  if (data.year !== undefined) {
    updates.push('release_date = ?');
    values.push(data.year ? `${data.year}-01-01` : null);
  }
  if (data.genre !== undefined) {
    updates.push('genre = ?');
    values.push(data.genre);
  }
  if (data.poster !== undefined) {
    updates.push('poster_url = ?');
    values.push(data.poster);
  }
  if (data.description !== undefined) {
    updates.push('description = ?');
    values.push(data.description);
  }
  
  if (updates.length === 0) {
    return new Response(JSON.stringify({ error: 'No fields to update' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  values.push(movieId);
  
  await db.prepare(`
    UPDATE movies 
    SET ${updates.join(', ')}
    WHERE id = ?
  `).bind(...values).run();

  return new Response(JSON.stringify({ success: true, id: movieId }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Usuń film
async function handleDeleteMovie(db, movieId, corsHeaders) {
  // Usuń powiązane rekordy najpierw (na wypadek gdyby CASCADE nie działało)
  await db.prepare('DELETE FROM watched WHERE movie_id = ?').bind(movieId).run();
  await db.prepare('DELETE FROM reviews WHERE movie_id = ?').bind(movieId).run();
  await db.prepare('DELETE FROM challenge_watched WHERE movie_id = ?').bind(movieId).run();
  
  // Usuń film
  await db.prepare('DELETE FROM movies WHERE id = ?').bind(movieId).run();

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Wyodrębnij ID użytkownika z tokenu JWT
async function getUserIdFromRequest(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  
  try {
    const payload = JSON.parse(atob(token));
    return payload.userId;
  } catch (error) {
    return null;
  }
}
