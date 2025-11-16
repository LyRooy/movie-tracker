// Create a guest user and return a session token
export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    // Generate a random guest nickname and disposable email
    const id = Math.floor(Math.random() * 900000) + 100000;
    const nickname = `Guest_${id}`;
    const email = `guest_${Date.now()}_${id}@guest.local`;

    // Insert guest user with role = 'guest'
    // password_hash is NOT NULL in schema, store an empty placeholder for guest accounts
    const placeholderHash = '';
    const result = await env.db.prepare(`
      INSERT INTO users (nickname, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `).bind(nickname, email, placeholderHash, 'guest').run();

    const userId = result.meta.last_row_id;

    const token = generateSimpleToken(userId, email);

    return new Response(JSON.stringify({
      user: { id: userId, nickname, email, role: 'guest' },
      token
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}

function generateSimpleToken(userId, email) {
  const payload = { userId, email, exp: Date.now() + (24 * 60 * 60 * 1000) };
  return btoa(JSON.stringify(payload));
}
