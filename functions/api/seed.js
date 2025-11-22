// Skrypt do wstawiania przykładowych danych do bazy danych D1
export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method !== 'POST' && request.method !== 'GET') {
    return new Response('Method not allowed - use GET or POST', { status: 405 });
  }

  try {
    // Sprawdź czy użytkownik testowy już istnieje
    const existingUser = await env.db.prepare('SELECT id FROM users WHERE email = ?').bind('test@example.com').first();
    
    let userId;
    if (existingUser) {
      userId = existingUser.id;
      console.log('Test user already exists, using existing user');
    } else {
      // Utwórz użytkownika testowego
      const passwordHash = await hashPassword('test123');
      const userResult = await env.db.prepare(`
        INSERT INTO users (nickname, email, password_hash)
        VALUES (?, ?, ?)
      `).bind('TestUser', 'test@example.com', passwordHash).run();
      
      userId = userResult.meta.last_row_id;
      console.log('Created new test user');
    }
    // Wstaw przykładowe filmy
    const sampleMovies = [
      {
        title: 'Incepcja',
        type: 'movie',
        release_date: '2010-07-16',
        genre: 'Sci-Fi',
        poster_url: 'https://placehold.co/200x300/4CAF50/white/png?text=Incepcja',
        description: 'Dom Cobb jest złodziejem, najlepszym w niebezpiecznej sztuce eksploracji...'
      },
      {
        title: 'Breaking Bad',
        type: 'series', 
        release_date: '2008-01-20',
        genre: 'Dramat',
        poster_url: 'https://placehold.co/200x300/2196F3/white/png?text=Breaking+Bad',
        description: 'Walter White, nauczyciel chemii w szkole średniej...'
      },
      {
        title: 'Paragraf 22',
        type: 'movie',
        release_date: '2019-05-17',
        genre: 'Komedia',
        poster_url: 'https://placehold.co/200x300/FF9800/white/png?text=Paragraf+22',
        description: 'Komedia oparta na powieści Josepha Hellera...'
      }
    ];

    // Wstaw filmy (tylko jeśli nie istnieją)
    let moviesAdded = 0;
    for (const movie of sampleMovies) {
      // Sprawdź czy film już istnieje
      const existingMovie = await env.db.prepare('SELECT id FROM movies WHERE title = ? AND media_type = ?')
        .bind(movie.title, movie.type).first();
      
      let movieId;
      if (existingMovie) {
        movieId = existingMovie.id;
        console.log(`Movie "${movie.title}" already exists, skipping`);
      } else {
        const movieResult = await env.db.prepare(`
          INSERT INTO movies (title, media_type, release_date, genre, poster_url, description)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          movie.title,
          movie.type,
          movie.release_date,
          movie.genre,
          movie.poster_url,
          movie.description
        ).run();
        
        movieId = movieResult.meta.last_row_id;
        moviesAdded++;
        console.log(`Added new movie: "${movie.title}"`);
      }

      // Sprawdź czy użytkownik już obejrzał ten film
      const existingWatched = await env.db.prepare('SELECT id FROM watched WHERE user_id = ? AND movie_id = ?')
        .bind(userId, movieId).first();
      
      if (!existingWatched) {
        // Dodaj do obejrzanych dla użytkownika
        await env.db.prepare(`
          INSERT INTO watched (user_id, movie_id, watched_date)
          VALUES (?, ?, ?)
        `).bind(userId, movieId, '2024-01-15').run();
      }

      // Sprawdź czy recenzja już istnieje
      const existingReview = await env.db.prepare('SELECT id FROM reviews WHERE user_id = ? AND movie_id = ?')
        .bind(userId, movieId).first();
      
      if (!existingReview) {
        // Dodaj recenzję
        const rating = movie.title === 'Incepcja' ? 5 : (movie.title === 'Breaking Bad' ? 5 : 4);
        await env.db.prepare(`
          INSERT INTO reviews (user_id, movie_id, content, rating)
          VALUES (?, ?, ?, ?)
        `).bind(userId, movieId, `Świetne ${movie.type === 'movie' ? 'film' : 'serial'}!`, rating).run();
      }
    }

    // Wstaw przykładowe wyzwanie (tylko jeśli nie istnieje)
    const existingChallenge = await env.db.prepare('SELECT id FROM challenges WHERE title = ?')
      .bind('Filmowy Maraton 2024').first();
    
    if (!existingChallenge) {
      await env.db.prepare(`
        INSERT INTO Challenges (title, description, type, target_count, start_date, end_date)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        'Filmowy Maraton 2024',
        'Obejrzyj 50 filmów w 2024 roku',
        'movies',
        50,
        '2024-01-01',
        '2024-12-31'
      ).run();
    }

    return new Response(JSON.stringify({ 
      message: 'Sample data inserted successfully',
      moviesAdded: moviesAdded,
      testUser: { email: 'test@example.com', password: 'test123' },
      userExisted: !!existingUser,
      challengeExisted: !!existingChallenge
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

// Haszuj hasło używając PBKDF2 z solą (tak samo jak w auth.js)
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
  
  // Połącz sól i hasz
  return saltArray.concat(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
}