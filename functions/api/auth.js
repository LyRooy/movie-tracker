// Authentication API endpoints
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const path = url.pathname.split('/').pop();

  try {
    switch (path) {
      case 'login':
        return handleLogin(env.db, request, corsHeaders);
      case 'register':
        return handleRegister(env.db, request, corsHeaders);
      case 'logout':
        return handleLogout(corsHeaders);
      case 'me':
        return handleGetCurrentUser(env.db, request, corsHeaders);
      default:
        return new Response('Not found', { status: 404, headers: corsHeaders });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Register new user
async function handleRegister(db, request, corsHeaders) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const { nickname, email, password } = await request.json();

  if (!nickname || !email || !password) {
    return new Response(JSON.stringify({ error: 'All fields required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Check if user exists
  const existingUser = await db.prepare('SELECT id FROM Users WHERE email = ?').bind(email).first();
  if (existingUser) {
    return new Response(JSON.stringify({ error: 'User already exists' }), {
      status: 409,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Hash password with PBKDF2
  const passwordHash = await hashPassword(password);

  // Insert user
  const result = await db.prepare(`
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
}

// Login user
async function handleLogin(db, request, corsHeaders) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const { email, password } = await request.json();

  if (!email || !password) {
    return new Response(JSON.stringify({ error: 'Email and password required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Find user
  const user = await db.prepare('SELECT * FROM Users WHERE email = ?').bind(email).first();
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
}

// Logout (client-side token removal)
async function handleLogout(corsHeaders) {
  return new Response(JSON.stringify({ message: 'Logged out successfully' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Get current user info
async function handleGetCurrentUser(db, request, corsHeaders) {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const user = await db.prepare('SELECT id, nickname, email, theme_preference FROM Users WHERE id = ?').bind(userId).first();
  if (!user) {
    return new Response(JSON.stringify({ error: 'User not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ user }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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