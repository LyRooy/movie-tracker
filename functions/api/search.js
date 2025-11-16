// API endpoint for movie search in D1 database
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (method !== 'GET') {
    return new Response('Method not allowed', { 
      status: 405,
      headers: corsHeaders 
    });
  }

  const query = url.searchParams.get('query');
  if (!query) {
    return new Response(JSON.stringify({ error: 'Query parameter required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Check authentication
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    // Search in our D1 database
    const searchQuery = `%${query.toLowerCase()}%`;
    const result = await env.db.prepare(`
      SELECT 
        id,
        title,
        media_type as type,
        strftime('%Y', release_date) as year,
        genre,
        poster_url as poster,
        description,
        0 as rating,
        'planning' as status,
        date('now') as watchedDate
      FROM movies 
      WHERE LOWER(title) LIKE ? OR LOWER(genre) LIKE ? OR LOWER(description) LIKE ?
      ORDER BY title
      LIMIT 20
    `).bind(searchQuery, searchQuery, searchQuery).all();

    // Transform to match frontend format
    const transformedResults = result.results.map(row => ({
      id: `db_${row.id}`,
      title: row.title,
      type: row.type,
      year: parseInt(row.year) || new Date().getFullYear(),
      genre: row.genre || 'Unknown',
      poster: row.poster || `https://via.placeholder.com/200x300/4CAF50/white?text=${encodeURIComponent(row.title)}`,
      description: row.description || '',
      rating: 0,
      status: 'planning',
      watchedDate: new Date().toISOString().split('T')[0]
    }));

    return new Response(JSON.stringify(transformedResults), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Search error:', error);
    return new Response(JSON.stringify({ error: 'Search failed' }), {
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