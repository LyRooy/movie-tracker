// Admin endpoint for managing individual movies
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
    // Check if user is admin
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

// Get specific movie
async function handleGetMovie(db, movieId, corsHeaders) {
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
}

// Update movie
async function handleUpdateMovie(db, request, movieId, corsHeaders) {
  const data = await request.json();
  
  // Build update query dynamically based on provided fields
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

// Delete movie
async function handleDeleteMovie(db, movieId, corsHeaders) {
  // Check if movie is referenced in watched or reviews
  const watched = await db.prepare('SELECT COUNT(*) as count FROM watched WHERE movie_id = ?').bind(movieId).first();
  const reviews = await db.prepare('SELECT COUNT(*) as count FROM reviews WHERE movie_id = ?').bind(movieId).first();
  
  if (watched.count > 0 || reviews.count > 0) {
    return new Response(JSON.stringify({ 
      error: 'Cannot delete movie that has been watched or reviewed',
      watched: watched.count,
      reviews: reviews.count
    }), {
      status: 409,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  await db.prepare('DELETE FROM movies WHERE id = ?').bind(movieId).run();

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Extract user ID from JWT token
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
