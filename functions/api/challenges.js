// API endpoint for viewing challenges
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
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
    const userId = url.searchParams.get('userId') || 1;
    
    // Get challenges with progress
    const result = await env.db.prepare(`
      SELECT 
        c.id,
        c.title,
        c.description,
        c.target_count,
        c.challenge_type,
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
          (c.challenge_type = 'movies' AND m.type = 'movie') OR
          (c.challenge_type = 'series' AND m.type = 'series') OR
          c.challenge_type = 'both'
        )
        WHERE w.user_id = ? 
        AND w.watched_date BETWEEN c.start_date AND c.end_date
      ) cp ON c.id = cp.challenge_id
      GROUP BY c.id, c.title, c.description, c.target_count, 
               c.challenge_type, c.start_date, c.end_date
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