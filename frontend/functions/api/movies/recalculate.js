export async function onRequest(context) {
    const { request, env } = context;

    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    try {
        // Wyciągnij userId z tokenu użytkownika (identycznie jak w recommendations.js)
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }
        const token = authHeader.substring(7);
        const payload = JSON.parse(atob(token));
        const userId = payload.userId;

        if (!userId) {
            return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 });
        }

        // Wywołaj FastAPI używając ukrytego klucza ze zmiennych środowiskowych CF
        // Założyłem nagłówek X-API-Key, dostosuj go do tego, czego wymaga Twoje FastAPI
        const fastApiUrl = `https://mvt-api.110187.xyz/movies/user/${userId}/recommendations/force-recalculate`;
        
        const response = await fetch(fastApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': env.MVT_API_KEY // Zmienna środowiskowa dodana w panelu Cloudflare
            }
        });

        if (!response.ok) {
            throw new Error(`FastAPI zwróciło błąd: ${response.status}`);
        }

        return new Response(JSON.stringify({ success: true }), { status: 200 });

    } catch (error) {
        console.error('Błąd przeliczania:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}