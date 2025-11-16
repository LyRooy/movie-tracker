// Sample data insertion script for D1 database
export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method !== 'POST' && request.method !== 'GET') {
    return new Response('Method not allowed - use GET or POST', { status: 405 });
  }

  try {
    // Insert sample movies
    const sampleMovies = [
      {
        title: 'Incepcja',
        type: 'movie',
        release_date: '2010-07-16',
        genre: 'Sci-Fi',
        poster_url: 'https://via.placeholder.com/200x300/4CAF50/white?text=Incepcja',
        description: 'Dom Cobb jest złodziejem, najlepszym w niebezpiecznej sztuce eksploracji...'
      },
      {
        title: 'Breaking Bad',
        type: 'series', 
        release_date: '2008-01-20',
        genre: 'Dramat',
        poster_url: 'https://via.placeholder.com/200x300/2196F3/white?text=Breaking+Bad',
        description: 'Walter White, nauczyciel chemii w szkole średniej...'
      },
      {
        title: 'Paragraf 22',
        type: 'movie',
        release_date: '2019-05-17',
        genre: 'Komedia',
        poster_url: 'https://via.placeholder.com/200x300/FF9800/white?text=Paragraf+22',
        description: 'Komedia oparta na powieści Josepha Hellera...'
      }
    ];

    // Insert movies
    for (const movie of sampleMovies) {
      const movieResult = await env.db.prepare(`
        INSERT INTO Movies (title, type, release_date, genre, poster_url, description)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        movie.title,
        movie.type,
        movie.release_date,
        movie.genre,
        movie.poster_url,
        movie.description
      ).run();

      const movieId = movieResult.meta.last_row_id;
      
      // Add to watched for user 1
      await env.db.prepare(`
        INSERT INTO Watched (user_id, movie_id, watched_date)
        VALUES (?, ?, ?)
      `).bind(1, movieId, '2024-01-15').run();

      // Add review
      const rating = movie.title === 'Incepcja' ? 5 : (movie.title === 'Breaking Bad' ? 5 : 4);
      await env.db.prepare(`
        INSERT INTO Reviews (user_id, movie_id, content, rating)
        VALUES (?, ?, ?, ?)
      `).bind(1, movieId, `Świetne ${movie.type === 'movie' ? 'film' : 'serial'}!`, rating).run();
    }

    // Insert a sample challenge
    await env.db.prepare(`
      INSERT INTO Challenges (title, description, target_count, challenge_type, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      'Filmowy Maraton 2024',
      'Obejrzyj 50 filmów w 2024 roku',
      50,
      'movies',
      '2024-01-01',
      '2024-12-31'
    ).run();

    return new Response(JSON.stringify({ 
      message: 'Sample data inserted successfully',
      moviesAdded: sampleMovies.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}