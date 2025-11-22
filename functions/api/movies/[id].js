// User endpoint for managing individual movies in their watch list
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
    // Check authentication
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

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
    console.error('Error in movies/[id]:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Get specific movie with user's review and watched status
async function handleGetMovie(db, userId, movieId, corsHeaders) {
  const query = `
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

  // Transform to match frontend format
  const transformedMovie = {
    id: movie.id,
    title: movie.title,
    type: movie.type,
    year: parseInt(movie.year) || new Date().getFullYear(),
    genre: movie.genre || 'Unknown',
    rating: movie.rating || 0,
    status: movie.status,
    watchedDate: movie.watchedDate || null,
    poster: movie.poster || `https://placehold.co/200x300/4CAF50/white/png?text=${encodeURIComponent(movie.title)}`,
    duration: movie.duration || 120,
    review: movie.review || ''
  };

  return new Response(JSON.stringify(transformedMovie), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Update movie (rating, review, watched status)
async function handleUpdateMovie(db, userId, request, movieId, corsHeaders) {
  const data = await request.json();
  
  try {
    await db.prepare('BEGIN').run();
    
    // Verify movie exists
    const movie = await db.prepare('SELECT id FROM movies WHERE id = ?').bind(movieId).first();
    if (!movie) {
      await db.prepare('ROLLBACK').run();
      return new Response(JSON.stringify({ error: 'Movie not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Update watched status
    if (data.status === 'watched') {
      const watchedDate = data.watchedDate || new Date().toISOString().split('T')[0];
      await db.prepare(`
        INSERT OR REPLACE INTO watched (user_id, movie_id, watched_date)
        VALUES (?, ?, ?)
      `).bind(userId, movieId, watchedDate).run();
    } else {
      await db.prepare(`
        DELETE FROM watched WHERE user_id = ? AND movie_id = ?
      `).bind(userId, movieId).run();
    }
    
    // Update review and rating
    if (data.rating !== undefined) {
      if (data.rating > 0) {
        await db.prepare(`
          INSERT OR REPLACE INTO reviews (user_id, movie_id, content, rating)
          VALUES (?, ?, ?, ?)
        `).bind(userId, movieId, data.review || '', data.rating).run();
      } else {
        // If rating is 0, remove the review
        await db.prepare(`
          DELETE FROM reviews WHERE user_id = ? AND movie_id = ?
        `).bind(userId, movieId).run();
      }
    }
    
    await db.prepare('COMMIT').run();
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    await db.prepare('ROLLBACK').run();
    console.error('Error updating movie:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Delete movie from user's watched list (removes watched status and review, but not the movie itself)
async function handleDeleteMovie(db, userId, movieId, corsHeaders) {
  try {
    await db.prepare('BEGIN').run();
    
    // Verify movie exists
    const movie = await db.prepare('SELECT id FROM movies WHERE id = ?').bind(movieId).first();
    if (!movie) {
      await db.prepare('ROLLBACK').run();
      return new Response(JSON.stringify({ error: 'Movie not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Remove from watched list
    await db.prepare('DELETE FROM watched WHERE user_id = ? AND movie_id = ?')
      .bind(userId, movieId)
      .run();
    
    // Remove review
    await db.prepare('DELETE FROM reviews WHERE user_id = ? AND movie_id = ?')
      .bind(userId, movieId)
      .run();
    
    await db.prepare('COMMIT').run();
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    await db.prepare('ROLLBACK').run();
    console.error('Error deleting movie:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
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
