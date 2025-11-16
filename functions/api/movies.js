// API endpoint for movies/series operations
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  // CORS headers
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
      case 'PUT':
        return handlePut(env.db, request, url, corsHeaders);
      case 'DELETE':
        return handleDelete(env.db, request, url, corsHeaders);
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

// Get movies/series with reviews and watched status
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

  // Join Movies with Reviews and Watched tables
  let query = `
    SELECT 
      m.id,
      m.title,
      m.media_type as type,
      strftime('%Y', m.release_date) as year,
      m.genre,
      m.poster_url as poster,
      r.rating,
      r.content as review,
      w.watched_date as watchedDate,
      CASE 
        WHEN w.id IS NOT NULL THEN 'watched'
        ELSE 'planning'
      END as status,
      120 as duration
    FROM Movies m
    LEFT JOIN Reviews r ON m.id = r.movie_id AND r.user_id = ?
    LEFT JOIN Watched w ON m.id = w.movie_id AND w.user_id = ?
  `;
  
  let params = [userId, userId];
  let whereClause = [];

  if (status && status !== 'all') {
    if (status === 'watched') {
      whereClause.push('w.id IS NOT NULL');
    } else {
      whereClause.push('w.id IS NULL');
    }
  }

  if (type) {
    whereClause.push('m.media_type = ?');
    params.push(type);
  }

  if (whereClause.length > 0) {
    query += ' WHERE ' + whereClause.join(' AND ');
  }

  query += ' ORDER BY COALESCE(w.watched_date, m.created_at) DESC';

  const result = await db.prepare(query).bind(...params).all();
  
  // Transform to match frontend format
  const transformedResults = result.results.map(row => ({
    id: row.id,
    title: row.title,
    type: row.type,
    year: parseInt(row.year) || new Date().getFullYear(),
    genre: row.genre || 'Unknown',
    rating: row.rating || 0,
    status: row.status,
    watchedDate: row.watchedDate || new Date().toISOString().split('T')[0],
    poster: row.poster || `https://via.placeholder.com/200x300/4CAF50/white?text=${encodeURIComponent(row.title)}`,
    duration: row.duration || 120,
    review: row.review || ''
  }));
  
  return new Response(JSON.stringify(transformedResults), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Add new movie/series
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
    // Start transaction
    await db.prepare('BEGIN').run();
    
    // Insert movie
    const movieResult = await db.prepare(`
      INSERT INTO Movies (title, media_type, release_date, genre, poster_url, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      data.title,
      data.type,
      `${data.year}-01-01`,
      data.genre,
      data.poster,
      data.description || ''
    ).run();
    
    const movieId = movieResult.meta.last_row_id;
    
    // Add to watched if status is watched
    if (data.status === 'watched') {
      await db.prepare(`
        INSERT INTO Watched (user_id, movie_id, watched_date)
        VALUES (?, ?, ?)
      `).bind(userId, movieId, data.watchedDate).run();
    }
    
    // Add review if rating provided
    if (data.rating > 0) {
      await db.prepare(`
        INSERT INTO Reviews (user_id, movie_id, content, rating)
        VALUES (?, ?, ?, ?)
      `).bind(userId, movieId, data.review || '', data.rating).run();
    }
    
    await db.prepare('COMMIT').run();
    
    return new Response(JSON.stringify({ 
      success: true, 
      id: movieId 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    await db.prepare('ROLLBACK').run();
    throw error;
  }
}

// Update movie/series
async function handlePut(db, request, url, corsHeaders) {
  const userId = await getUserIdFromRequest(request);
  
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  const id = url.pathname.split('/').pop();
  const data = await request.json();
  
  try {
    await db.prepare('BEGIN').run();
    
    // Update movie
    await db.prepare(`
      UPDATE Movies 
      SET title = ?, media_type = ?, release_date = ?, genre = ?, poster_url = ?
      WHERE id = ?
    `).bind(
      data.title,
      data.type,
      `${data.year}-01-01`,
      data.genre,
      data.poster,
      id
    ).run();
    
    // Update watched status
    if (data.status === 'watched') {
      await db.prepare(`
        INSERT OR REPLACE INTO Watched (user_id, movie_id, watched_date)
        VALUES (?, ?, ?)
      `).bind(userId, id, data.watchedDate).run();
    } else {
      await db.prepare(`
        DELETE FROM Watched WHERE user_id = ? AND movie_id = ?
      `).bind(userId, id).run();
    }
    
    // Update review
    if (data.rating > 0) {
      await db.prepare(`
        INSERT OR REPLACE INTO Reviews (user_id, movie_id, content, rating)
        VALUES (?, ?, ?, ?)
      `).bind(userId, id, data.review || '', data.rating).run();
    }
    
    await db.prepare('COMMIT').run();
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    await db.prepare('ROLLBACK').run();
    throw error;
  }
}

// Delete movie/series
async function handleDelete(db, request, url, corsHeaders) {
  const userId = await getUserIdFromRequest(request);
  
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const id = url.pathname.split('/').pop();
  
  // Delete movie (cascading will handle watched and reviews)
  await db.prepare('DELETE FROM Movies WHERE id = ?').bind(id).run();

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Extract user ID from Authorization header
async function getUserIdFromRequest(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const payload = JSON.parse(atob(token));
    
    if (payload.exp < Date.now()) {
      return null; // Token expired
    }
    
    return payload.userId;
  } catch {
    return null;
  }
}