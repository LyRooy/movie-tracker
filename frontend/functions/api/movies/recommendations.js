// Endpoint rekomendacji per-user.
// Czyta bezpośrednio z bazy D1 (env.db) — NIE dzwoni do backendu FastAPI.
// Dzięki temu działa nawet gdy serwer Python jest wyłączone.
// Backend (FastAPI) jest odpowiedzialny TYLKO za zapis rekomendacji do tabeli user_recommendations.
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Złączenie rekomendacji (CF + CB) z pełnymi danymi metadanymi filmu z tabeli movies.
    // recommendation_type: 'collaborative_filtering' (CF) lub 'content_based' (CB).
    // predicted_rating: rekomendowana ocena (skala 1-5).
    const limit = parseInt(url.searchParams.get('limit')) || 20;
    const offset = parseInt(url.searchParams.get('offset')) || 0;

const rows = await env.db.prepare(`
      SELECT
        r.user_id,
        r.movie_id,
        r.predicted_rating,
        r.confidence_lower,
        r.confidence_upper,
        r.recommendation_type,
        m.id,
        m.title,
        m.media_type,
        m.release_date,
        m.genre,
        m.poster_path,
        m.poster_url,
        m.overview,
        m.cast,
        m.director,
        m.imdb_rating,
        m.popularity
      FROM user_recommendations r
      JOIN movies m ON m.id = r.movie_id
      WHERE r.user_id = ?
        AND (
          CAST(r.expires_at AS INTEGER) > unixepoch()
          OR r.expires_at > strftime('%Y-%m-%d %H:%M:%f', 'now')
        )
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(userId, limit + 1, offset).all();

    // Przekształć w pełne obiekty filmów z typem rekomendacji
    const recommendations = rows.results.map(r => {
      const poster = r.poster_path
        ? `https://image.tmdb.org/t/p/w200${r.poster_path}`
        : 'https://placehold.co/200x300/cccccc/666666/png?text=?';

      return {
        id: r.movie_id,
        title: r.title,
        media_type: r.media_type,
        release_date: r.release_date,
        genre: r.genre,
        overview: r.overview,
        cast: r.cast,
        director: r.director,
        poster_path: r.poster_path || r.poster_url,
        poster_url: poster,
        imdb_rating: r.imdb_rating,
        popularity: r.popularity,
        recommended_rating: r.predicted_rating,
        confidence_lower: r.confidence_lower,
        confidence_upper: r.confidence_upper,
        // 'CF' = collaborative_filtering, 'CB' = content_based
        recType: r.recommendation_type === 'content_based' ? 'content_based' : 'collaborative_filtering',
      };
    });

    const hasMore = recommendations.length > limit;
    if (hasMore) recommendations.pop();

    // Dane są per-user — nie cachujemy na poziomie CDN (każdy użytkownik ma inne rekomendacje).
    return new Response(JSON.stringify({
      userId,
      results: recommendations,
      count: recommendations.length,
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        // Brak Cache-Control na poziomie CDN: rekomendacje są per-user i się zmieniają w czasie
      },
    });
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// Wyodrębnij ID użytkownika z tokenu autoryzacyjnego.
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
