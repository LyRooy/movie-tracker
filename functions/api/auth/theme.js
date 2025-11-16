// Update current user's theme preference
export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await request.json();
    const pref = body && body.theme_preference;
    const allowed = ['light', 'dark', 'auto'];
    if (!pref || !allowed.includes(pref)) {
      return new Response(JSON.stringify({ error: 'Invalid theme_preference. Allowed: light,dark,auto' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Database schema only allows 'light' or 'dark'. Map 'auto' -> 'light' to avoid constraint violation.
    const dbPref = pref === 'auto' ? 'light' : pref;

    await env.db.prepare('UPDATE users SET theme_preference = ? WHERE id = ?').bind(dbPref, userId).run();

    const user = await env.db.prepare('SELECT id, nickname, email, role, theme_preference FROM users WHERE id = ?').bind(userId).first();

    return new Response(JSON.stringify({ success: true, user }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}

// Extract user ID from Authorization header (same logic as other auth endpoints)
async function getUserIdFromRequest(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const payload = JSON.parse(atob(token));
    if (payload.exp < Date.now()) return null;
    return payload.userId;
  } catch {
    return null;
  }
}
