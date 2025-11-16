// User login endpoint
export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Find user
    const user = await env.db.prepare('SELECT * FROM Users WHERE email = ?').bind(email).first();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check password
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = await generateSimpleToken(user.id, user.email);

    return new Response(JSON.stringify({
      user: { 
        id: user.id, 
        nickname: user.nickname, 
        email: user.email,
        theme_preference: user.theme_preference 
      },
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

// Verify password against hash
async function verifyPassword(password, storedHash) {
  const encoder = new TextEncoder();
  const hashBytes = storedHash.match(/.{2}/g).map(byte => parseInt(byte, 16));
  const salt = new Uint8Array(hashBytes.slice(0, 16));
  const hash = new Uint8Array(hashBytes.slice(16));
  
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
  
  const newHash = new Uint8Array(hashBuffer);
  
  // Compare hashes
  if (hash.length !== newHash.length) return false;
  for (let i = 0; i < hash.length; i++) {
    if (hash[i] !== newHash[i]) return false;
  }
  return true;
}

// Generate simple JWT-like token
async function generateSimpleToken(userId, email) {
  const payload = { userId, email, exp: Date.now() + (24 * 60 * 60 * 1000) }; // 24h
  return btoa(JSON.stringify(payload));
}