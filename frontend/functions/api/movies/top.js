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
    const sort  = url.searchParams.get('sort')  || 'popularity'; // popularity | imdb_rating | avg_rating
    const page  = Math.max(0, parseInt(url.searchParams.get('page') || '0', 10));
    const limit = 40;
    const offset = page * limit;

    let orderBy;
    let countSql;

    if (sort === 'imdb_rating') {
        orderBy  = 'm.imdb_rating DESC NULLS LAST';
        countSql = `SELECT COUNT(*) AS cnt FROM movies m WHERE m.media_type='movie' AND m.imdb_rating IS NOT NULL`;
    } else if (sort === 'avg_rating') {
        // sortujemy po AVG(r.rating) — alias działa w ORDER BY po GROUP BY w SQLite
        orderBy  = 'AVG(r.rating) DESC NULLS LAST';
        countSql = `SELECT COUNT(DISTINCT m.id) AS cnt FROM movies m INNER JOIN reviews r ON r.movie_id = m.id WHERE m.media_type='movie'`;
    } else {
        orderBy  = 'm.popularity DESC NULLS LAST';
        countSql = `SELECT COUNT(*) AS cnt FROM movies m WHERE m.media_type='movie' AND m.popularity IS NOT NULL`;
    }

    const countRow = await env.db.prepare(countSql).first();
    const total = countRow?.cnt ?? 0;

    const rows = await env.db.prepare(`
        SELECT m.id, m.title, m.release_date, m.poster_path, m.popularity,
               m.imdb_rating, m.genre,
               AVG(r.rating)  AS avg_user_rating,
               COUNT(r.id)    AS review_count
        FROM movies m
        LEFT JOIN reviews r ON r.movie_id = m.id
        WHERE m.media_type = 'movie'
        GROUP BY m.id
        ORDER BY ${orderBy}
        LIMIT ${limit} OFFSET ${offset}
    `).all();

    return new Response(JSON.stringify({
        results: rows.results ?? [],
        total,
        page,
        hasMore: offset + limit < total,
    }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}
