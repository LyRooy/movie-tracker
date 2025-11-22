// Upload user avatar to R2
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
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse FormData
    const formData = await request.formData();
    const file = formData.get('avatar');

    if (!file) {
      return new Response(JSON.stringify({ error: 'Avatar image is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return new Response(JSON.stringify({ error: 'Invalid image format. Only images allowed.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'File size must be less than 2MB' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate unique filename
    const extension = file.name.split('.').pop() || 'jpg';
    const filename = `avatars/${userId}-${Date.now()}.${extension}`;

    // Upload to R2
    const arrayBuffer = await file.arrayBuffer();
    await env.AVATARS.put(filename, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
    });

    // Get public URL (assuming custom domain or R2.dev URL)
    // Format: https://pub-xxxxx.r2.dev/avatars/user-timestamp.jpg
    const avatarUrl = `${env.R2_PUBLIC_URL}/${filename}`;

    // Delete old avatar if exists
    const oldUser = await env.db.prepare('SELECT avatar_url FROM users WHERE id = ?')
      .bind(userId).first();
    
    if (oldUser && oldUser.avatar_url && oldUser.avatar_url.includes(env.R2_PUBLIC_URL)) {
      const oldKey = oldUser.avatar_url.replace(`${env.R2_PUBLIC_URL}/`, '');
      try {
        await env.AVATARS.delete(oldKey);
      } catch (e) {
        console.warn('Failed to delete old avatar:', e);
      }
    }

    // Update user's avatar_url in database
    await env.db.prepare(`
      UPDATE users 
      SET avatar_url = ? 
      WHERE id = ?
    `).bind(avatarUrl, userId).run();

    return new Response(JSON.stringify({ 
      success: true,
      avatar_url: avatarUrl 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error uploading avatar:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), {
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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}

// Helper function to get user ID from JWT token
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
