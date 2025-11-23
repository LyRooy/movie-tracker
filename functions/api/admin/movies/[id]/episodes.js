// Admin endpoint to fetch and update episodes for a series
async function getUserIdFromRequest(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const token = authHeader.substring(7);
    const payload = JSON.parse(atob(token));
    if (payload.exp < Date.now()) return null;
    return payload.userId;
  } catch {
    return null;
  }
}

async function checkAdminRole(db, userId) {
  const user = await db.prepare('SELECT role FROM users WHERE id = ?').bind(userId).first();
  return user && user.role === 'admin';
}

async function ensureEpisodesHasDisplayNumber(db) {
  try {
    const info = await db.prepare("PRAGMA table_info(episodes)").all();
    const cols = (info && info.results) ? info.results : (info || []);
    const hasDisplay = cols.some && cols.some(c => c.name === 'display_number');
    if (!hasDisplay) {
      await db.prepare('ALTER TABLE episodes ADD COLUMN display_number TEXT').run();
    }
  } catch (e) {
    console.error('ensureEpisodesHasDisplayNumber error:', e);
  }
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const method = request.method;
  const seriesId = params.id;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const isAdmin = await checkAdminRole(env.db, userId);
    if (!isAdmin) return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    switch (method) {
      case 'GET':
        return handleGetAdminEpisodes(env.db, seriesId, corsHeaders);
      case 'PUT':
        return handleUpdateEpisode(env.db, request, corsHeaders);
      case 'POST':
        return handleBulkUpdate(env.db, request, corsHeaders);
      default:
        return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }
  } catch (error) {
    console.error('[admin episodes] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}

async function handleGetAdminEpisodes(db, seriesId, corsHeaders) {
  try {
    const series = await db.prepare('SELECT id, title FROM movies WHERE id = ? AND media_type = ?').bind(seriesId, 'series').first();
    if (!series) return new Response(JSON.stringify({ error: 'Series not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const rows = await db.prepare(`
      SELECT e.id as episode_id, e.season_id, s.season_number, e.episode_number, e.title as episode_title, e.description, e.air_date, e.duration, e.display_number
      FROM episodes e
      JOIN seasons s ON e.season_id = s.id
      WHERE s.series_id = ?
      ORDER BY s.season_number, e.episode_number
    `).bind(seriesId).all();

    const episodes = (rows && rows.results) ? rows.results.map(r => ({
      id: r.episode_id,
      seasonId: r.season_id,
      seasonNumber: r.season_number,
      episodeNumber: r.episode_number,
      displayNumber: r.display_number || `S${String(r.season_number).padStart(2,'0')} - E${String(r.episode_number).padStart(3,'0')}`,
      title: r.episode_title,
      description: r.description,
      airDate: r.air_date || null,
      duration: r.duration
    })) : [];

    return new Response(JSON.stringify({ series: { id: series.id, title: series.title }, episodes }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[admin episodes get] error:', e);
    return new Response(JSON.stringify({ error: e.message || 'Get failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}

async function handleUpdateEpisode(db, request, corsHeaders) {
  try {
    const data = await request.json();
    if (!data || !data.id) return new Response(JSON.stringify({ error: 'Episode id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    // Ensure display_number column exists
    await ensureEpisodesHasDisplayNumber(db);

    const updates = [];
    const params = [];
    if (data.title !== undefined) { updates.push('title = ?'); params.push(data.title); }
    if (data.description !== undefined) { updates.push('description = ?'); params.push(data.description); }
    if (data.airDate !== undefined) { updates.push('air_date = ?'); params.push(data.airDate || null); }
    if (data.duration !== undefined) { updates.push('duration = ?'); params.push(Number(data.duration) || null); }
    if (data.displayNumber !== undefined) { updates.push('display_number = ?'); params.push(data.displayNumber); }

    if (updates.length === 0) return new Response(JSON.stringify({ error: 'No fields to update' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    params.push(data.id);
    await db.prepare(`UPDATE episodes SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[admin episodes update] error:', e);
    return new Response(JSON.stringify({ error: e.message || 'Update failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}

async function handleBulkUpdate(db, request, corsHeaders) {
  try {
    const data = await request.json();
    const { episodes } = data;
    if (!Array.isArray(episodes)) return new Response(JSON.stringify({ error: 'episodes array required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    await ensureEpisodesHasDisplayNumber(db);
    for (const ep of episodes) {
      const updates = [];
      const params = [];
      if (ep.title !== undefined) { updates.push('title = ?'); params.push(ep.title); }
      if (ep.description !== undefined) { updates.push('description = ?'); params.push(ep.description); }
      if (ep.airDate !== undefined) { updates.push('air_date = ?'); params.push(ep.airDate || null); }
      if (ep.duration !== undefined) { updates.push('duration = ?'); params.push(Number(ep.duration) || null); }
      if (ep.displayNumber !== undefined) { updates.push('display_number = ?'); params.push(ep.displayNumber); }
      if (updates.length > 0) {
        params.push(ep.id);
        await db.prepare(`UPDATE episodes SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
      }
    }
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[admin episodes bulk update] error:', e);
    return new Response(JSON.stringify({ error: e.message || 'Bulk update failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}
