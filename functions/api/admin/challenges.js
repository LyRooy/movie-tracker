// Admin endpoint for managing challenges
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
        return handleGetChallenges(env.db, request, corsHeaders);
      case 'POST':
        return handleCreateChallenge(env.db, request, corsHeaders);
      case 'PUT':
        return handleUpdateChallenge(env.db, request, corsHeaders);
      case 'DELETE':
        return handleDeleteChallenge(env.db, request, corsHeaders);
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

// Get challenges (all or specific by ID)
async function handleGetChallenges(db, request, corsHeaders) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const challengeId = pathParts[pathParts.length - 1] !== 'challenges' ? pathParts[pathParts.length - 1] : null;

  if (challengeId) {
    // Get specific challenge
    const challenge = await db.prepare('SELECT * FROM challenges WHERE id = ?').bind(challengeId).first();
    if (!challenge) {
      return new Response(JSON.stringify({ error: 'Challenge not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify(challenge), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } else {
    // Get all challenges
    const challenges = await db.prepare('SELECT * FROM challenges ORDER BY title').all();
    return new Response(JSON.stringify(challenges.results || []), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Create new challenge
async function handleCreateChallenge(db, request, corsHeaders) {
  const data = await request.json();
  
  if (!data.title || !data.type || !data.targetCount || !data.startDate) {
    return new Response(JSON.stringify({ error: 'Title, type, targetCount, and startDate are required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const result = await db.prepare(`
    INSERT INTO challenges (title, description, type, criteria_value, target_count, start_date, end_date, badge_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.title,
    data.description || '',
    data.type,
    data.criteriaValue || null,
    data.targetCount,
    data.startDate,
    data.endDate || null,
    data.badgeId || null
  ).run();

  return new Response(JSON.stringify({ 
    success: true, 
    id: result.meta.last_row_id 
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Update existing challenge
async function handleUpdateChallenge(db, request, corsHeaders) {
  const data = await request.json();
  
  if (!data.id) {
    return new Response(JSON.stringify({ error: 'Challenge ID is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const updates = [];
  const params = [];

  if (data.title) {
    updates.push('title = ?');
    params.push(data.title);
  }
  if (data.description !== undefined) {
    updates.push('description = ?');
    params.push(data.description);
  }
  if (data.type) {
    updates.push('type = ?');
    params.push(data.type);
  }
  if (data.criteriaValue !== undefined) {
    updates.push('criteria_value = ?');
    params.push(data.criteriaValue);
  }
  if (data.targetCount) {
    updates.push('target_count = ?');
    params.push(data.targetCount);
  }
  if (data.startDate) {
    updates.push('start_date = ?');
    params.push(data.startDate);
  }
  if (data.endDate !== undefined) {
    updates.push('end_date = ?');
    params.push(data.endDate);
  }
  if (data.badgeId !== undefined) {
    updates.push('badge_id = ?');
    params.push(data.badgeId);
  }

  if (updates.length === 0) {
    return new Response(JSON.stringify({ error: 'No fields to update' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  params.push(data.id);
  
  await db.prepare(`
    UPDATE challenges SET ${updates.join(', ')} WHERE id = ?
  `).bind(...params).run();

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Delete challenge
async function handleDeleteChallenge(db, request, corsHeaders) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  
  if (!id) {
    return new Response(JSON.stringify({ error: 'Challenge ID is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  await db.prepare('DELETE FROM challenges WHERE id = ?').bind(id).run();

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
      return null;
    }
    
    return payload.userId;
  } catch {
    return null;
  }
}
