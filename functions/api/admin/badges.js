// Endpoint administracyjny do zarządzania odznakami
export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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
        return handleGetBadges(env.db, request, corsHeaders);
      case 'POST':
        return handleCreateBadge(env.db, request, corsHeaders);
      case 'PUT':
        return handleUpdateBadge(env.db, request, corsHeaders);
      case 'DELETE':
        return handleDeleteBadge(env.db, request, corsHeaders);
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

// Pobierz odznaki (wszystkie lub konkretną po ID)
async function handleGetBadges(db, request, corsHeaders) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const badgeId = pathParts[pathParts.length - 1] !== 'badges' ? pathParts[pathParts.length - 1] : null;

  if (badgeId) {
    // Pobierz konkretną odznakę
    const badge = await db.prepare('SELECT * FROM badges WHERE id = ?').bind(badgeId).first();
    if (!badge) {
      return new Response(JSON.stringify({ error: 'Badge not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify(badge), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } else {
    // Pobierz wszystkie odznaki
    const result = await db.prepare('SELECT * FROM badges ORDER BY created_at DESC').all();
    return new Response(JSON.stringify(result.results || []), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Utwórz nową odznakę
async function handleCreateBadge(db, request, corsHeaders) {
  const data = await request.json();
  
  if (!data.name) {
    return new Response(JSON.stringify({ error: 'Badge name is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const result = await db.prepare(`
    INSERT INTO badges (name, description, image_url)
    VALUES (?, ?, ?)
  `).bind(
    data.name,
    data.description || '',
    data.imageUrl || null
  ).run();

  return new Response(JSON.stringify({ 
    success: true, 
    id: result.meta.last_row_id 
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Zaktualizuj istniejącą odznakę
async function handleUpdateBadge(db, request, corsHeaders) {
  const data = await request.json();
  
  if (!data.id) {
    return new Response(JSON.stringify({ error: 'Badge ID is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const updates = [];
  const params = [];

  if (data.name) {
    updates.push('name = ?');
    params.push(data.name);
  }
  if (data.description !== undefined) {
    updates.push('description = ?');
    params.push(data.description);
  }
  if (data.imageUrl !== undefined) {
    updates.push('image_url = ?');
    params.push(data.imageUrl);
  }

  if (updates.length === 0) {
    return new Response(JSON.stringify({ error: 'No fields to update' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  params.push(data.id);
  
  await db.prepare(`
    UPDATE badges SET ${updates.join(', ')} WHERE id = ?
  `).bind(...params).run();

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Usuń odznakę
async function handleDeleteBadge(db, request, corsHeaders) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  
  if (!id) {
    return new Response(JSON.stringify({ error: 'Badge ID is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Sprawdź czy odznaka jest używana w wyzwaniach
  const usedInChallenges = await db.prepare('SELECT id FROM challenges WHERE badge_id = ? LIMIT 1').bind(id).first();
  if (usedInChallenges) {
    return new Response(JSON.stringify({ error: 'Cannot delete badge that is used in challenges' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  await db.prepare('DELETE FROM badges WHERE id = ?').bind(id).run();

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
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
      return null;
    }
    
    return payload.userId;
  } catch {
    return null;
  }
}
