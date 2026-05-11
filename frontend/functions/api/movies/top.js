const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestOptions() {
    return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ request, env }) {
    const url = new URL(request.url);
    const sort  = url.searchParams.get('sort') || 'popularity'; // popularity | imdb_rating | avg_rating
    const page  = Math.max(0, parseInt(url.searchParams.get('page') || '0', 10));
    const limit = 40;
    const offset = page * limit;

    let results;

    if (sort === 'avg_rating') {
        // avg_rating wymaga JOIN ze wszystkimi recenzjami — nie da się pre-filtrować
        const rows = await env.db.prepare(`
            SELECT m.id, m.title, m.release_date, m.poster_path, m.popularity,
                   m.imdb_rating, m.genre,
                   AVG(r.rating)  AS avg_user_rating,
                   COUNT(r.id)    AS review_count
            FROM movies m
            INNER JOIN reviews r ON r.movie_id = m.id
            WHERE m.media_type = 'movie'
            GROUP BY m.id
            ORDER BY avg_user_rating DESC NULLS LAST
            LIMIT ? OFFSET ?
        `).bind(limit + 1, offset).all();
        results = rows.results ?? [];
    } else {
        // popularity / imdb_rating:
        // CTE pobiera tylko top (limit+1) ID z indeksu, potem JOIN tylko tych wierszy.
        // Zamiast GROUP BY na 250k rekordach — GROUP BY na max 41.
        const col = sort === 'imdb_rating' ? 'imdb_rating' : 'popularity';
        const rows = await env.db.prepare(`
            WITH ids AS (
                SELECT id FROM movies
                WHERE media_type = 'movie' AND ${col} IS NOT NULL
                ORDER BY ${col} DESC
                LIMIT ? OFFSET ?
            )
            SELECT m.id, m.title, m.release_date, m.poster_path, m.popularity,
                   m.imdb_rating, m.genre,
                   AVG(r.rating)  AS avg_user_rating,
                   COUNT(r.id)    AS review_count
            FROM movies m
            JOIN ids ON ids.id = m.id
            LEFT JOIN reviews r ON r.movie_id = m.id
            GROUP BY m.id
            ORDER BY m.${col} DESC NULLS LAST
        `).bind(limit + 1, offset).all();
        results = rows.results ?? [];
    }

    const hasMore = results.length > limit;
    if (hasMore) results.pop(); // usuń nadmiarowy wiersz użyty tylko do sprawdzenia hasMore

    // Cache-Control: Cloudflare CDN może cachować tę odpowiedź (globalne rankingi, nie per-user)
    // s-maxage=300 = 5 min w CDN, stale-while-revalidate=600 = podaj stale przez kolejne 10 min
    return new Response(JSON.stringify({ results, page, hasMore }), {
        status: 200,
        headers: {
            ...CORS,
            'Content-Type': 'application/json',
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
    });
}
