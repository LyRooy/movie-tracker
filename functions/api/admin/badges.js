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
        return handleGetBadges(env, request, corsHeaders);
      case 'POST':
        return handleCreateBadge(env, request, corsHeaders);
      case 'PUT':
        return handleUpdateBadge(env, request, corsHeaders);
      case 'DELETE':
        return handleDeleteBadge(env, request, corsHeaders);
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
async function handleGetBadges(env, request, corsHeaders) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const badgeId = pathParts[pathParts.length - 1] !== 'badges' ? pathParts[pathParts.length - 1] : null;

  if (badgeId) {
    // Pobierz konkretną odznakę
    const badge = await env.db.prepare('SELECT * FROM badges WHERE id = ?').bind(badgeId).first();
    if (!badge) {
      return new Response(JSON.stringify({ error: 'Badge not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    // Przekształć image_url na pełny URL R2
    if (badge.image_url && !badge.image_url.startsWith('http')) {
      badge.image_url = `${env.R2_PUBLIC_URL_BADGES}/${badge.image_url}`;
    }
    return new Response(JSON.stringify(badge), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } else {
    // Pobierz wszystkie odznaki
    const result = await env.db.prepare('SELECT * FROM badges ORDER BY created_at DESC').all();
    // Przekształć image_url dla wszystkich odznak
    const badges = (result.results || []).map(badge => {
      if (badge.image_url && !badge.image_url.startsWith('http')) {
        badge.image_url = `${env.R2_PUBLIC_URL_BADGES}/${badge.image_url}`;
      }
      return badge;
    });
    return new Response(JSON.stringify(badges), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Utwórz nową odznakę
async function handleCreateBadge(env, request, corsHeaders) {
  try {
    const formData = await request.formData();
    const name = formData.get('name');
    const description = formData.get('description');
    const imageFile = formData.get('image');
    
    if (!name) {
      return new Response(JSON.stringify({ error: 'Badge name is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let imageUrl = null;

    // Jeśli przesłano plik obrazka
    if (imageFile && imageFile.size > 0) {
      // Sprawdź typ pliku
      if (!imageFile.type.startsWith('image/')) {
        return new Response(JSON.stringify({ error: 'File must be an image' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Sprawdź rozmiar pliku (max 1MB dla odznak)
      if (imageFile.size > 1024 * 1024) {
        return new Response(JSON.stringify({ error: 'File size must be less than 1MB' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Wygeneruj unikalną nazwę pliku
      const extension = imageFile.name.split('.').pop() || 'png';
      const filename = `badges/${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.${extension}`;

      // Prześlij do R2
      const arrayBuffer = await imageFile.arrayBuffer();
      await env.BADGES.put(filename, arrayBuffer, {
        httpMetadata: {
          contentType: imageFile.type,
        },
      });

      // Zapisz tylko nazwę pliku (bez pełnego URL)
      imageUrl = filename;
    }

    const result = await env.db.prepare(`
      INSERT INTO badges (name, description, image_url)
      VALUES (?, ?, ?)
    `).bind(
      name,
      description || '',
      imageUrl
    ).run();

    return new Response(JSON.stringify({ 
      success: true, 
      id: result.meta.last_row_id,
      imageUrl: imageUrl ? `${env.R2_PUBLIC_URL_BADGES}/${imageUrl}` : null
    }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating badge:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Zaktualizuj istniejącą odznakę
async function handleUpdateBadge(env, request, corsHeaders) {
  try {
    const formData = await request.formData();
    const id = formData.get('id');
    const name = formData.get('name');
    const description = formData.get('description');
    const imageFile = formData.get('image');
    
    if (!id) {
      return new Response(JSON.stringify({ error: 'Badge ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const updates = [];
    const params = [];

    if (name) {
      updates.push('name = ?');
      params.push(name);
    }
    if (description !== null && description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }

    // Jeśli przesłano nowy plik obrazka
    if (imageFile && imageFile.size > 0) {
      // Sprawdź typ pliku
      if (!imageFile.type.startsWith('image/')) {
        return new Response(JSON.stringify({ error: 'File must be an image' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Sprawdź rozmiar pliku (max 1MB)
      if (imageFile.size > 1024 * 1024) {
        return new Response(JSON.stringify({ error: 'File size must be less than 1MB' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Pobierz starą odznakę aby usunąć stary plik
      const oldBadge = await env.db.prepare('SELECT image_url FROM badges WHERE id = ?').bind(id).first();
      
      // Usuń stary plik z R2 jeśli istnieje
      if (oldBadge && oldBadge.image_url) {
        try {
          await env.BADGES.delete(oldBadge.image_url);
        } catch (e) {
          console.warn('Failed to delete old badge image:', e);
        }
      }

      // Wygeneruj unikalną nazwę pliku
      const extension = imageFile.name.split('.').pop() || 'png';
      const filename = `badges/${(name || 'badge').toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.${extension}`;

      // Prześlij do R2
      const arrayBuffer = await imageFile.arrayBuffer();
      await env.BADGES.put(filename, arrayBuffer, {
        httpMetadata: {
          contentType: imageFile.type,
        },
      });

      updates.push('image_url = ?');
      params.push(filename);
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: 'No fields to update' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    params.push(id);
    
    await env.db.prepare(`
      UPDATE badges SET ${updates.join(', ')} WHERE id = ?
    `).bind(...params).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating badge:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Usuń odznakę
async function handleDeleteBadge(env, request, corsHeaders) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  
  if (!id) {
    return new Response(JSON.stringify({ error: 'Badge ID is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Sprawdź czy odznaka jest używana w wyzwaniach
  const usedInChallenges = await env.db.prepare('SELECT id FROM challenges WHERE badge_id = ? LIMIT 1').bind(id).first();
  if (usedInChallenges) {
    return new Response(JSON.stringify({ error: 'Cannot delete badge that is used in challenges' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Pobierz odznakę aby usunąć plik z R2
  const badge = await env.db.prepare('SELECT image_url FROM badges WHERE id = ?').bind(id).first();
  
  // Usuń plik z R2 jeśli istnieje
  if (badge && badge.image_url) {
    try {
      await env.BADGES.delete(badge.image_url);
    } catch (e) {
      console.warn('Failed to delete badge image from R2:', e);
    }
  }

  await env.db.prepare('DELETE FROM badges WHERE id = ?').bind(id).run();

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
