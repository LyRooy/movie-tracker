// API endpoint for viewing challenges
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

  try {
    // Check authentication
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Get challenges with progress
    const result = await env.db.prepare(`
      SELECT 
        c.id,
        c.title,
        c.description,
        c.target_count,
        c.type as challenge_type,
        c.start_date,
        c.end_date,
        COUNT(cp.id) as current_progress,
        CASE 
          WHEN COUNT(cp.id) >= c.target_count THEN 'completed'
          WHEN date('now') > c.end_date THEN 'expired'
          ELSE 'active'
        END as status
      FROM Challenges c
      LEFT JOIN (
        SELECT w.id, c.id as challenge_id
        FROM Watched w
        JOIN Movies m ON w.movie_id = m.id
        JOIN Challenges c ON (
          (c.type = 'movies' AND m.media_type = 'movie') OR
          (c.type = 'series' AND m.media_type = 'series') OR
          c.type = 'both'
        )
        WHERE w.user_id = ? 
        AND w.watched_date BETWEEN c.start_date AND c.end_date
      ) cp ON c.id = cp.challenge_id
      GROUP BY c.id, c.title, c.description, c.target_count, 
               c.type, c.start_date, c.end_date
      ORDER BY c.end_date ASC
    `).bind(userId).all();

    // Transform to frontend format
    const challenges = result.results.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      target: row.target_count,
      progress: row.current_progress,
      type: row.challenge_type,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
      percentage: Math.round((row.current_progress / row.target_count) * 100)
    }));

    return new Response(JSON.stringify(challenges), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
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