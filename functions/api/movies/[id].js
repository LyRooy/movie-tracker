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

  // Log for debugging
  console.log(`[movies/[id].js] Method: ${method}, Movie ID: ${movieId}`);

  try {
    // Check authentication
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
      COALESCE(w.status, CASE WHEN w.id IS NOT NULL THEN 'watched' ELSE 'planning' END) as status,
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
    // Verify movie exists
    const movie = await db.prepare('SELECT id FROM movies WHERE id = ?').bind(movieId).first();
    if (!movie) {
      return new Response(JSON.stringify({ error: 'Movie not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Update watched status based on status field
    if (data.status) {
      const watchedDate = data.watchedDate || new Date().toISOString().split('T')[0];
      
      // Check if watched record exists
      const existingWatched = await db.prepare(
        'SELECT id FROM watched WHERE user_id = ? AND movie_id = ?'
      ).bind(userId, movieId).first();
      
      if (existingWatched) {
        // Update existing record with new status
        await db.prepare(`
          UPDATE watched 
          SET watched_date = ?, status = ?
          WHERE user_id = ? AND movie_id = ?
        `).bind(watchedDate, data.status, userId, movieId).run();
      } else {
        // Insert new record with status
        await db.prepare(`
          INSERT INTO watched (user_id, movie_id, watched_date, status)
          VALUES (?, ?, ?, ?)
        `).bind(userId, movieId, watchedDate, data.status).run();
      }
    }
    
    // Update review and rating
    if (data.rating !== undefined) {
      if (data.rating > 0) {
        // Check if review exists
        const existingReview = await db.prepare(
          'SELECT id FROM reviews WHERE user_id = ? AND movie_id = ?'
        ).bind(userId, movieId).first();
        
        if (existingReview) {
          // Update existing review
          await db.prepare(`
            UPDATE reviews 
            SET content = ?, rating = ?, updated_at = datetime('now')
            WHERE user_id = ? AND movie_id = ?
          `).bind(data.review || '', data.rating, userId, movieId).run();
        } else {
          // Insert new review
          await db.prepare(`
            INSERT INTO reviews (user_id, movie_id, content, rating)
            VALUES (?, ?, ?, ?)
          `).bind(userId, movieId, data.review || '', data.rating).run();
        }
      } else {
        // If rating is 0, remove the review
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

// Delete movie from user's watched list (removes watched status and review, but not the movie itself)
async function handleDeleteMovie(db, userId, movieId, corsHeaders) {
  try {
    // Verify movie exists
    const movie = await db.prepare('SELECT id FROM movies WHERE id = ?').bind(movieId).first();
    if (!movie) {
      return new Response(JSON.stringify({ error: 'Movie not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Remove from watched list
    const watchedResult = await db.prepare('DELETE FROM watched WHERE user_id = ? AND movie_id = ?')
      .bind(userId, movieId)
      .run();
    
    // Remove review
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
