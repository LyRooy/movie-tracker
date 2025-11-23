// Endpoint do wyszukiwania użytkowników
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

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
    const userId = await getUserIdFromRequest(request);
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const query = url.searchParams.get('q') || '';
    const limit = parseInt(url.searchParams.get('limit')) || 10;

    if (!query || query.length < 2) {
      return new Response(JSON.stringify({ users: [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Wyszukaj użytkowników (z wyłączeniem siebie)
    const result = await env.db.prepare(`
      SELECT 
        u.id,
        u.nickname,
        u.avatar_url,
        u.description,
        CASE 
          WHEN f.id IS NOT NULL THEN f.status
          ELSE NULL
        END as friendship_status
      FROM users u
      LEFT JOIN friends f ON (
        (f.user1_id = ? AND f.user2_id = u.id) OR 
        (f.user2_id = ? AND f.user1_id = u.id)
      )
      WHERE u.id != ? 
      AND u.nickname LIKE ?
      ORDER BY u.nickname
      LIMIT ?
    `).bind(userId, userId, userId, `%${query}%`, limit).all();

    // Normalize results to include both snake_case and camelCase fields
    const users = result.results.map(row => {
      // Ensure avatar uses https when possible
      let avatar = (row.avatar_url && String(row.avatar_url).trim()) ? String(row.avatar_url).trim() : null;
      if (avatar && avatar.startsWith('http://')) avatar = avatar.replace('http://', 'https://');

      // If no avatar provided, generate a simple placeholder with initials via placehold.co
      if (!avatar) {
        const name = (row.nickname || '').trim();
        const initials = name ? name.split(/\s+/).map(w => w[0]).join('').slice(0,2).toUpperCase() : 'U';
        avatar = `https://placehold.co/80x80/cccccc/000000/png?text=${encodeURIComponent(initials)}`;
      }

      return {
        id: row.id,
        nickname: row.nickname,
        description: row.description,
        // provide both conventions to make client tolerant
        avatar_url: avatar,
        avatarUrl: avatar,
        avatar: avatar,
        friendship_status: row.friendship_status,
        friendshipStatus: row.friendship_status
      };
    });

    return new Response(JSON.stringify({ users }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error searching users:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function getUserIdFromRequest(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const payload = JSON.parse(atob(token));
    
    if (payload.exp < Date.now()) {
      return null;
    }
    
    return payload.userId;
  } catch {
    return null;
  }
}
