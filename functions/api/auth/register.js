// User registration endpoint
export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const { nickname, email, password } = await request.json();

    if (!nickname || !email || !password) {
      return new Response(JSON.stringify({ error: 'All fields required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if user exists
    const existingUser = await env.db.prepare('SELECT id FROM Users WHERE email = ?').bind(email).first();
    if (existingUser) {
      return new Response(JSON.stringify({ error: 'User already exists' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Insert user
    const result = await env.db.prepare(`
      INSERT INTO Users (nickname, email, password_hash)
      VALUES (?, ?, ?)
    `).bind(nickname, email, passwordHash).run();

    const userId = result.meta.last_row_id;
    const token = await generateSimpleToken(userId, email);

    return new Response(JSON.stringify({
      user: { id: userId, nickname, email },
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

// Handle OPTIONS for CORS
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}

// Hash password using PBKDF2 with salt
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    passwordKey,
    256
  );
  
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const saltArray = Array.from(salt);
  
  // Combine salt and hash
  return saltArray.concat(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate simple JWT-like token
async function generateSimpleToken(userId, email) {
  const payload = { userId, email, exp: Date.now() + (24 * 60 * 60 * 1000) }; // 24h
  return btoa(JSON.stringify(payload));
}