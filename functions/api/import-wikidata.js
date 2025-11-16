// Import movies and TV shows from Wikidata (SPARQL) — hybrid: curated list + require Polish label
export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'GET' && request.method !== 'POST') {
    return new Response('Method not allowed - use GET or POST', { status: 405 });
  }

  try {
    const url = new URL(request.url);
    // allow overriding limit via query param; default 50 per type when not provided
    const providedAny = url.searchParams.has('limit') || url.searchParams.has('mode') || url.searchParams.has('delay');
    const limitPerType = url.searchParams.has('limit') ? parseInt(url.searchParams.get('limit')) : (providedAny ? 300 : 50);
    const mode = url.searchParams.has('mode') ? url.searchParams.get('mode').toLowerCase() : 'both';
    const perRequestDelay = url.searchParams.has('delay') ? parseInt(url.searchParams.get('delay')) : 200;

    const errors = [];

    // curated popular lists (subset of previous OMDb list for brevity)
    const popularMovies = [
      'The Shawshank Redemption', 'The Godfather', 'The Dark Knight', 'Pulp Fiction', 'Forrest Gump',
      'Inception', 'Fight Club', 'The Matrix', 'Goodfellas', 'The Silence of the Lambs',
      'Saving Private Ryan', 'The Green Mile', 'Interstellar', 'Parasite', 'Gladiator',
      'The Departed', 'The Prestige', 'The Lion King', 'Back to the Future', 'Terminator 2',
      'Alien', 'The Avengers', 'Titanic', 'Avatar', 'Jurassic Park', 'Star Wars',
      'The Lord of the Rings', 'Harry Potter', 'Spider-Man', 'Batman Begins', 'Casino',
      'Heat', 'Scarface', 'Taxi Driver', 'Raging Bull', 'Apocalypse Now', 'The Shining',
      'Full Metal Jacket', 'Platoon', 'Braveheart', 'The Pianist', 'Schindlers List', 'Life is Beautiful',
      'Casablanca', 'Citizen Kane', 'Psycho', 'Vertigo', 'Rear Window', 'Some Like It Hot',
      'Gone with the Wind', 'The Wizard of Oz'
    ];

    const popularSeries = [
      'Breaking Bad', 'Game of Thrones', 'The Sopranos', 'The Wire', 'Friends',
      'The Office', 'Stranger Things', 'The Crown', 'Sherlock', 'Black Mirror',
      'Westworld', 'True Detective', 'Fargo', 'Better Call Saul', 'The Mandalorian',
      'House of Cards', 'Narcos', 'Mindhunter', 'Ozark', 'The Witcher',
      'The Boys', 'Peaky Blinders', 'Vikings', 'Lost', 'Dexter', 'How I Met Your Mother',
      'The Big Bang Theory', 'Modern Family', 'Parks and Recreation', 'Brooklyn Nine-Nine', 'Community'
    ];

    // Helper to run a SPARQL query against wikidata.org
    async function runSparql(query) {
      const endpoint = 'https://query.wikidata.org/sparql';
      const params = new URLSearchParams({ query });
      const resp = await fetch(endpoint + '?' + params.toString(), {
        headers: {
          'Accept': 'application/sparql-results+json',
          'User-Agent': 'movie-tracker-importer/1.0 (https://example.local)'
        }
      });
      if (!resp.ok) throw new Error(`Wikidata SPARQL error: ${resp.status}`);
      return await resp.json();
    }

    // Find Wikidata item for a given title that has a Polish label; returns binding or null
    async function findItemWithPolishLabel(title, instanceQ) {
      const esc = title.replace(/"/g, '\\"');
      const q = `
SELECT ?item ?itemLabel ?plLabel ?imdb ?year ?poster WHERE {
  ?item wdt:P31 ${instanceQ} .
  ?item rdfs:label ?plLabel .
  FILTER(LANG(?plLabel) = "pl")
  { ?item rdfs:label ?m1 . FILTER(LANG(?m1) = "pl" && STR(?m1) = "${esc}") }
  UNION
  { ?item rdfs:label ?m2 . FILTER(LANG(?m2) != "pl" && STR(?m2) = "${esc}") }
  OPTIONAL { ?item wdt:P345 ?imdb }
  OPTIONAL { ?item wdt:P577 ?pub . BIND(YEAR(?pub) AS ?year) }
  OPTIONAL { ?item wdt:P18 ?poster }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "pl,en". }
}
LIMIT 1
      `;
      const json = await runSparql(q);
      if (!json || !json.results || !json.results.bindings || json.results.bindings.length === 0) return null;
      return json.results.bindings[0];
    }

    // Helper to extract value safely
    const val = (b, key) => (b && b[key] && b[key].value) ? b[key].value : null;

    let moviesAdded = 0;
    let seriesAdded = 0;

    async function insertIfMissing(item, mediaType) {
      if (!item.title || item.title.trim().length === 0) return false;
      const existing = await env.db.prepare('SELECT id FROM movies WHERE title = ? AND media_type = ?').bind(item.title, mediaType).first();
      if (existing) return false;

      const releaseDate = item.year ? `${item.year}-01-01` : null;
      await env.db.prepare(`
        INSERT INTO movies (title, release_date, media_type, genre, description, poster_url, trailer_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        item.title,
        releaseDate,
        mediaType,
        'Unknown',
        '',
        item.poster || null,
        null
      ).run();
      return true;
    }

    // Process movies list
    if (mode === 'movies' || mode === 'both') {
      const toProcess = popularMovies.slice(0, limitPerType);
      for (const title of toProcess) {
        try {
          const b = await findItemWithPolishLabel(title, 'wd:Q11424');
          if (!b) continue; // skip if no PL label or no match
          const titlePL = val(b, 'plLabel') || val(b, 'itemLabel') || title;
          const year = val(b, 'year');
          const posterRaw = val(b, 'poster');
          const poster = posterRaw ? (posterRaw.startsWith('http') ? posterRaw : `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(posterRaw)}`) : null;
          const added = await insertIfMissing({ title: titlePL, year, poster }, 'movie');
          if (added) moviesAdded++;
        } catch (e) {
          errors.push({ title, error: String(e) });
        }
        await new Promise(r => setTimeout(r, perRequestDelay));
      }
    }

    // Process series list
    if (mode === 'series' || mode === 'both') {
      const toProcess = popularSeries.slice(0, limitPerType);
      for (const title of toProcess) {
        try {
          const b = await findItemWithPolishLabel(title, 'wd:Q5398426');
          if (!b) continue;
          const titlePL = val(b, 'plLabel') || val(b, 'itemLabel') || title;
          const year = val(b, 'year');
          const posterRaw = val(b, 'poster');
          const poster = posterRaw ? (posterRaw.startsWith('http') ? posterRaw : `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(posterRaw)}`) : null;
          const added = await insertIfMissing({ title: titlePL, year, poster }, 'series');
          if (added) seriesAdded++;
        } catch (e) {
          errors.push({ title, error: String(e) });
        }
        await new Promise(r => setTimeout(r, perRequestDelay));
      }
    }

    return new Response(JSON.stringify({
      success: true,
      moviesRequested: Math.min(popularMovies.length, limitPerType),
      seriesRequested: Math.min(popularSeries.length, limitPerType),
      moviesAdded,
      seriesAdded,
      totalAdded: moviesAdded + seriesAdded,
      errors
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Wikidata import error:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
