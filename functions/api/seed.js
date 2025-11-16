// Sample data insertion script for D1 database
export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method !== 'POST' && request.method !== 'GET') {
    return new Response('Method not allowed - use GET or POST', { status: 405 });
  }

  try {
    // Check if test user already exists
    const existingUser = await env.db.prepare('SELECT id FROM Users WHERE email = ?').bind('test@example.com').first();
    
    let userId;
    if (existingUser) {
      userId = existingUser.id;
      console.log('Test user already exists, using existing user');
    } else {
      // Create a test user
      const passwordHash = await hashPassword('test123');
      const userResult = await env.db.prepare(`
        INSERT INTO Users (nickname, email, password_hash)
        VALUES (?, ?, ?)
      `).bind('TestUser', 'test@example.com', passwordHash).run();
      
      userId = userResult.meta.last_row_id;
      console.log('Created new test user');
    }
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

    // Insert movies (only if they don't exist)
    let moviesAdded = 0;
    for (const movie of sampleMovies) {
      // Check if movie already exists
      const existingMovie = await env.db.prepare('SELECT id FROM Movies WHERE title = ? AND media_type = ?')
        .bind(movie.title, movie.type).first();
      
      let movieId;
      if (existingMovie) {
        movieId = existingMovie.id;
        console.log(`Movie "${movie.title}" already exists, skipping`);
      } else {
        const movieResult = await env.db.prepare(`
          INSERT INTO Movies (title, media_type, release_date, genre, poster_url, description)
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

      // Check if user already watched this movie
      const existingWatched = await env.db.prepare('SELECT id FROM Watched WHERE user_id = ? AND movie_id = ?')
        .bind(userId, movieId).first();
      
      if (!existingWatched) {
        // Add to watched for user
        await env.db.prepare(`
          INSERT INTO Watched (user_id, movie_id, watched_date)
          VALUES (?, ?, ?)
        `).bind(userId, movieId, '2024-01-15').run();
      }

      // Check if review already exists
      const existingReview = await env.db.prepare('SELECT id FROM Reviews WHERE user_id = ? AND movie_id = ?')
        .bind(userId, movieId).first();
      
      if (!existingReview) {
        // Add review
        const rating = movie.title === 'Incepcja' ? 5 : (movie.title === 'Breaking Bad' ? 5 : 4);
        await env.db.prepare(`
          INSERT INTO Reviews (user_id, movie_id, content, rating)
          VALUES (?, ?, ?, ?)
        `).bind(userId, movieId, `Świetne ${movie.type === 'movie' ? 'film' : 'serial'}!`, rating).run();
      }
    }

    // Insert a sample challenge (only if it doesn't exist)
    const existingChallenge = await env.db.prepare('SELECT id FROM Challenges WHERE title = ?')
      .bind('Filmowy Maraton 2024').first();
    
    if (!existingChallenge) {
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

// Hash password using PBKDF2 with salt (same as auth.js)
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
  
  // Combine salt and hash
  return saltArray.concat(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
}