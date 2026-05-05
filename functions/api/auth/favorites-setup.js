// Endpoint do ustawiania ulubionych filmów nowego użytkownika (onboarding)
//
// SCHEMAT BAZY DANYCH:
//   ALTER TABLE users ADD COLUMN favorites_selected INTEGER DEFAULT 0;
//   ALTER TABLE users ADD COLUMN favorite_kaggle_ids TEXT DEFAULT NULL;
//
//   favorite_kaggle_ids – JSON-owa tablica ID filmów z datasetu Kaggle,
//   np. '[tt1234567, tt7654321]'. Do dodania gdy dataset zostanie
//   zaimportowany do bazy.

// Pomocnicza funkcja dekodowania tokenu
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

// Do dodania: migracja bazy danych
// ALTER TABLE users ADD COLUMN favorites_selected INTEGER DEFAULT 0;
// ALTER TABLE users ADD COLUMN favorite_kaggle_ids TEXT DEFAULT NULL;
//   favorite_kaggle_ids – JSON array ID filmów z datasetu Kaggle, np. '["tt1234567","tt7654321"]'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// GET – zwróć listę filmów do wyboru (z datasetu Kaggle)
export async function onRequestGet(context) {
  const { request } = context;

  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Do dodania: pobieranie losowych filmów z datasetu Kaggle po jego imporcie do bazy.
  // Docelowo: SELECT kaggle_id, title, poster_url, ... FROM kaggle_movies ORDER BY RANDOM() LIMIT 16
  return new Response(JSON.stringify([]), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// POST – zapisz zaznaczone ID filmów z Kaggle i oznacz favorites_selected = 1
export async function onRequestPost(context) {
  const { request } = context;

  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const movieIds = Array.isArray(body.movieIds) ? body.movieIds : [];
    const skipped = body.skipped === true;

    // Do dodania: zapis wybranych ID z datasetu Kaggle oraz oznaczenie onboardingu jako zakończonego.
    // Wymaga wcześniejszego dodania kolumn do tabeli users (patrz komentarz na górze pliku).
    // UPDATE users SET favorite_kaggle_ids = ?, favorites_selected = 1 WHERE id = ?
    //   gdzie pierwszym parametrem: JSON.stringify(movieIds)

    return new Response(JSON.stringify({ success: true, skipped }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}
