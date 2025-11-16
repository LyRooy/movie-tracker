// Import movies and TV shows from OMDb API
export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method !== 'POST' && request.method !== 'GET') {
    return new Response('Method not allowed - use GET or POST', { status: 405 });
  }

  // OMDb API configuration
  const OMDB_API_KEY = env.OMDB_API_KEY; // Add this to your Cloudflare environment variables
  const OMDB_BASE_URL = 'https://www.omdbapi.com';
  
  if (!OMDB_API_KEY) {
    return new Response(JSON.stringify({ 
      error: 'OMDb API key not configured',
      instructions: 'Add OMDB_API_KEY to your Cloudflare environment variables. Get free key from https://www.omdbapi.com/apikey.aspx'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    let moviesAdded = 0;
    let seriesAdded = 0;
    const notFoundMovies = [];
    const notFoundSeries = [];
    const errors = [];
    // Allow overriding limits/delays via query params to avoid rate limits during testing
    const url = new URL(request.url);
    let maxPerType = url.searchParams.has('limit') ? parseInt(url.searchParams.get('limit')) : 300; // max titles per type
    let perRequestDelay = url.searchParams.has('delay') ? parseInt(url.searchParams.get('delay')) : 600; // ms between titles
    // mode: 'movies' | 'series' | 'both'
    let mode = url.searchParams.has('mode') ? url.searchParams.get('mode').toLowerCase() : 'both';

    // If caller didn't provide any of the control params, default to importing 50 series
    const providedAny = url.searchParams.has('limit') || url.searchParams.has('mode') || url.searchParams.has('delay');
    if (!providedAny) {
      maxPerType = 50;
      mode = 'series';
    }
    
    // Popular movies to search for
    const popularMovies = [
      'The Shawshank Redemption', 'The Godfather', 'The Dark Knight', 'Pulp Fiction', 'Forrest Gump',
      'Inception', 'Fight Club', 'The Matrix', 'Goodfellas', 'The Silence of the Lambs',
      'Saving Private Ryan', 'The Green Mile', 'Interstellar', 'Parasite', 'Gladiator',
      'The Departed', 'The Prestige', 'The Lion King', 'Back to the Future', 'Terminator 2',
      'Alien', 'The Avengers', 'Titanic', 'Avatar', 'Jurassic Park', 'Star Wars',
      'The Lord of the Rings', 'Harry Potter', 'Spider-Man', 'Batman Begins',
      'Casino', 'Heat', 'Scarface', 'Taxi Driver', 'Raging Bull', 'Apocalypse Now',
      'The Shining', 'Full Metal Jacket', 'Platoon', 'Braveheart', 'The Pianist',
      'Schindlers List', 'Life is Beautiful', 'The Great Dictator', 'Casablanca', 'Citizen Kane',
      'Psycho', 'North by Northwest', 'Vertigo', 'Rear Window', 'Some Like It Hot',
      'Gone with the Wind', 'The Wizard of Oz', 'Its a Wonderful Life', 'The Third Man',
      'The Sound of Music', 'West Side Story', 'My Fair Lady', 'Lawrence of Arabia',
      'Doctor Zhivago', 'Ben-Hur', 'Cleopatra', 'Spartacus', 'The Ten Commandments',
      'The Bridge on the River Kwai', 'The African Queen', 'The Treasure of the Sierra Madre',
      'High Noon', 'Shane', 'The Searchers', 'Rio Bravo', 'The Good the Bad and the Ugly',
      'Once Upon a Time in the West', 'A Fistful of Dollars', 'Yojimbo', 'Seven Samurai',
      'Rashomon', 'Ikiru', 'Tokyo Story', 'Spirited Away', 'Princess Mononoke',
      'My Neighbor Totoro', 'Howls Moving Castle', 'Grave of the Fireflies', 'Akira',
      'Ghost in the Shell', 'Perfect Blue', 'Paprika', 'The Tale of the Princess Kaguya',
      'Your Name', 'A Silent Voice', 'Weathering with You', 'Wolf Children',
      '12 Angry Men', 'To Kill a Mockingbird', 'The Grapes of Wrath', 'Mr. Smith Goes to Washington',
      'Its a Wonderful Life', 'Double Indemnity', 'Sunset Boulevard', 'All About Eve',
      'A Streetcar Named Desire', 'On the Waterfront', 'The Graduate', 'Bonnie and Clyde',
      'Easy Rider', 'Midnight Cowboy', 'The French Connection', 'Chinatown', 'Network',
      'All the Presidents Men', 'Annie Hall', 'Manhattan', 'The Godfather Part II',
      'Once Upon a Time in America', 'Goodfellas', 'Casino', 'The Wolf of Wall Street',
      'The Big Short', 'Moneyball', 'The Social Network', 'Gone Girl', 'The Girl with the Dragon Tattoo',
      'Zodiac', 'Se7en', 'The Game', 'Panic Room', 'The Curious Case of Benjamin Button',
      'No Country for Old Men', 'There Will Be Blood', 'The Grand Budapest Hotel',
      'Moonrise Kingdom', 'The Royal Tenenbaums', 'Rushmore', 'Fantastic Mr Fox',
      'Isle of Dogs', 'Django Unchained', 'Inglourious Basterds', 'Kill Bill',
      'Reservoir Dogs', 'Jackie Brown', 'Death Proof', 'The Hateful Eight',
      'Blade Runner', 'Blade Runner 2049', 'Arrival', 'Sicario', 'Prisoners',
      'Enemy', 'Dune', 'Mad Max Fury Road', 'The Road Warrior', 'Mad Max',
      'Fury', 'Baby Driver', 'Drive', 'Nightcrawler', 'Whiplash', 'La La Land',
      'First Man', 'Damien', 'The Revenant', 'Birdman', 'Gravity', 'Children of Men',
      'Pan\'s Labyrinth', 'The Shape of Water', 'Crimson Peak', 'Pacific Rim',
      'Hellboy', 'Edge of Tomorrow', 'Looper', 'Rian Johnson', 'Knives Out',
      'Glass Onion', 'The Lighthouse', 'The Witch', 'Hereditary', 'Midsommar',
      'Get Out', 'Us', 'Nope', 'Jojo Rabbit', '1917', 'Dunkirk', 'Tenet',
      'The Nice Guys', 'Kiss Kiss Bang Bang', 'Iron Man 3', 'Logan', 'Deadpool',
      'John Wick', 'The Raid', 'Oldboy', 'The Handmaiden', 'Parasite',
      'Memories of Murder', 'The Host', 'Snowpiercer', 'Okja', 'Train to Busan',
      'The Wailing', 'Burning', 'Poetry', 'Secret Sunshine', 'Mother',
      'Thirst', 'Lady Vengeance', 'Sympathy for Mr Vengeance', 'JSA',
      'The Good the Bad the Weird', 'I Saw the Devil', 'The Man from Nowhere',
      'A Bittersweet Life', 'The Chaser', 'The Yellow Sea', 'New World',
      'The Thieves', 'Assassination', 'The Admiral', 'Veteran', 'Extreme Job',
      'Exit', 'Peninsula', 'Alive', 'Space Sweepers', 'The Call', 'Seobok',
      'The Pirates', 'Along with the Gods', 'Silenced', 'The Attorney', 'Ode to My Father',
      'Miracle in Cell No 7', 'A Taxi Driver', '1987', 'The Battleship Island',
      'Operation Chromite', 'Taegukgi', 'Brotherhood of War', 'Shiri', 'Kundo',
      'The Age of Shadows', 'Master', 'Inside Men', 'Asura', 'The Gangster the Cop the Devil',
      'Drug King', 'Believer', 'The Outlaws', 'Midnight Runners', 'Confidential Assignment',
      'Steel Rain', 'Ashfall', 'The Tower', 'Tunnel', 'Pandora', 'The Flu',
      'Deranged', 'The Terror Live', 'Cold Eyes', 'Commitment', 'The Berlin File',
      'The Suspect', 'No Tears for the Dead', 'A Company Man', 'The Man Standing Next',
      'The Spy Gone North', 'Steel Rain 2', 'Ashfall', 'Exit', 'Extreme Job',
      'The Roundup', 'Hansan', 'The Witch Part 2', 'Hunt', 'Decision to Leave',
      'Emergency Declaration', 'Carter', 'Seoul Vibe', 'The Policemans Lineage',
      'Escape from Mogadishu', 'Sinkhole', 'The Pirates 2', 'Alienoid', 'Broker',
      'Hush', 'Recalled', 'Night in Paradise', 'Time to Hunt', 'Beasts Clawing at Straws'
    ];

    const popularSeries = [
      'Breaking Bad', 'Game of Thrones', 'The Sopranos', 'The Wire', 'Friends',
      'The Office', 'Stranger Things', 'The Crown', 'Sherlock', 'Black Mirror',
      'Westworld', 'True Detective', 'Fargo', 'Better Call Saul', 'The Mandalorian',
      'House of Cards', 'Narcos', 'Mindhunter', 'Ozark', 'The Witcher',
      'The Boys', 'The Handmaids Tale', 'Succession', 'Chernobyl', 'Band of Brothers',
      'The Pacific', 'Generation Kill', 'Masters of Sex', 'Boardwalk Empire',
      'Peaky Blinders', 'Vikings', 'The Last Kingdom', 'Rome', 'Spartacus',
      'Lost', 'Prison Break', 'Dexter', 'House', 'Scrubs', 'How I Met Your Mother',
      'The Big Bang Theory', 'Modern Family', 'Parks and Recreation', 'Brooklyn Nine-Nine',
      'Community', 'Arrested Development', 'Its Always Sunny in Philadelphia',
      'Curb Your Enthusiasm', 'Silicon Valley', 'Veep', 'The Marvelous Mrs Maisel',
      'Fleabag', 'The Good Place', 'Russian Doll', 'Dead to Me', 'After Life',
      'Rick and Morty', 'BoJack Horseman', 'Archer', 'Futurama', 'South Park',
      'Family Guy', 'American Dad', 'Bobs Burgers', 'Adventure Time', 'Regular Show',
      'Gravity Falls', 'Steven Universe', 'Avatar The Last Airbender',
      'The Legend of Korra', 'Castlevania', 'Love Death and Robots', 'Arcane',
      'The Expanse', 'Battlestar Galactica', 'Firefly', 'Doctor Who', 'Star Trek',
      'The X-Files', 'Fringe', 'Person of Interest', 'Mr Robot', 'Watchmen',
      'The Leftovers', 'Six Feet Under', 'Deadwood', 'Carnivale', 'Justified',
      'The Shield', 'The Americans', 'Homeland', ' 24', 'Prison Break',
      'Sons of Anarchy', 'Mayans MC', 'The Walking Dead', 'Fear the Walking Dead',
      'Twin Peaks', 'Hannibal', 'Bates Motel', 'The Strain', 'Penny Dreadful',
      'American Horror Story', 'The Haunting of Hill House', 'The Haunting of Bly Manor',
      'Midnight Mass', 'The Fall of the House of Usher', 'Dark', 'Sense8',
      'The OA', 'Maniac', 'Altered Carbon', 'Raised by Wolves', 'Lovecraft Country',
      'Mare of Easttown', 'The Night Of', 'Sharp Objects', 'Big Little Lies',
      'The Undoing', 'The Flight Attendant', 'Only Murders in the Building',
      'Ted Lasso', 'Severance', 'For All Mankind', 'See', 'Foundation',
      'Invasion', 'Servant', 'Truth Be Told', 'The Morning Show', 'Dickinson',
      'The Mosquito Coast', 'Pachinko', 'WeCrashed', 'The Dropout', 'Super Pumped',
      'Pam and Tommy', 'The Girl from Plainville', 'Candy', 'The Thing About Pam',
      'The Staircase', 'Inventing Anna', 'The Tinder Swindler', 'Keep Breathing',
      'Echoes', 'Devil in Ohio', 'Partner Track', 'Love in the Villa', 'Fate',
      'Locke and Key', 'Shadow and Bone', 'The Umbrella Academy', 'Sweet Tooth',
      'The Sandman', 'Wednesday', 'Lucifer', 'Warrior Nun', 'Cursed',
      'The Letter for the King', 'Ragnarok', 'Biohackers', 'Dark Desire',
      'Control Z', 'Elite', 'Money Heist', 'Sky Rojo', 'Jaguar', 'Someone Has to Die',
      'Squid Game', 'All of Us Are Dead', 'My Name', 'Hellbound', 'Kingdom',
      'Sweet Home', 'The Silent Sea', 'Juvenile Justice', 'Forecasting Love and Weather',
      'Thirty-Nine', 'Tomorrow', 'Our Blues', 'Why Her', 'Extraordinary Attorney Woo',
      'Alchemy of Souls', 'Little Women', 'The Glory', 'Physical 100', 'Single\'s Inferno',
      'Love to Hate You', 'Celebrity', 'My Demon', 'A Time Called You', 'Ballerina',
      'Song of the Bandits', 'Mask Girl', 'Bloodhounds', 'Moving', 'The Worst of Evil',
      'Gyeongseong Creature', 'Maestra', 'Chicken Nugget', 'Parasyte The Grey',
      'Queen of Tears', 'Hierarchy', 'The 8 Show', 'Sweet Home 2', 'Sweet Home 3',
      'Squid Game 2', 'All of Us Are Dead 2', 'Hellbound 2', 'DP 2', 'My Name 2',
      'Kingdom 3', 'The Silent Sea 2', 'Juvenile Justice 2', 'Extraordinary Attorney Woo 2',
      'Physical 100 2', 'The Glory 2', 'Mask Girl 2', 'Bloodhounds 2', 'Moving 2',
      'Gyeongseong Creature 2', 'Queen of Tears 2', 'Hierarchy 2', 'The 8 Show 2',
      'Parasyte The Grey 2', 'Chicken Nugget 2', 'Maestra 2', 'Song of the Bandits 2'
    ];

    // Adjust which lists to process based on mode parameter
    if (mode === 'series') {
      // skip movies
      popularMovies.length = 0;
    } else if (mode === 'movies') {
      // skip series
      popularSeries.length = 0;
    }

    if (mode === 'both' || mode === 'movies') {
      console.log('Fetching movies from OMDb (with fallback search)...');
    }

    // quick validity check for API key
    try {
      const keyCheck = await fetch(`${OMDB_BASE_URL}/?apikey=${OMDB_API_KEY}&s=tt`);
      if (keyCheck.ok) {
        const kk = await keyCheck.json();
        if (kk && kk.Error && /invalid api key/i.test(kk.Error)) {
          return new Response(JSON.stringify({ error: 'OMDb API key invalid', details: kk.Error }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
      }
    } catch (e) {
      console.error('OMDb key check failed:', e.message || e);
    }

    // helper: try exact title fetch, otherwise search and fetch by imdbID
    // Fetch JSON with retries when OMDb returns Too many subrequests or transient network errors
    async function fetchJsonWithRetry(url, maxRetries = 4, baseDelay = 600) {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const res = await fetch(url);
          // Attempt to parse JSON; if parsing fails, treat as an error
          const json = await res.json().catch(() => null);
          if (json && json.Error && /Too many subrequests/i.test(json.Error)) {
            // wait and retry
            const wait = baseDelay * (attempt + 1);
            console.warn(`OMDb rate response, retrying after ${wait}ms (${attempt + 1}/${maxRetries})`);
            await new Promise(r => setTimeout(r, wait));
            continue;
          }
          return json;
        } catch (e) {
          const wait = baseDelay * (attempt + 1);
          console.warn(`Network fetch failed, retrying after ${wait}ms (${attempt + 1}/${maxRetries}):`, e.message || e);
          await new Promise(r => setTimeout(r, wait));
        }
      }
      return null;
    }

    async function fetchOmdbFull(title, type = 'movie') {
      try {
        // try exact title first (with retry wrapper)
        const exactUrl = `${OMDB_BASE_URL}/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(title)}&type=${type}`;
        let data = await fetchJsonWithRetry(exactUrl, 4, perRequestDelay);
        if (data && data.Response && data.Response === 'True') return data;

        // fallback: use search endpoint and fetch by imdbID
        const searchUrl = `${OMDB_BASE_URL}/?apikey=${OMDB_API_KEY}&s=${encodeURIComponent(title)}&type=${type}`;
        const list = await fetchJsonWithRetry(searchUrl, 4, perRequestDelay);
        if (!list || list.Response === 'False' || !Array.isArray(list.Search) || list.Search.length === 0) return null;

        const first = list.Search[0];
        if (!first || !first.imdbID) return null;

        const byIdUrl = `${OMDB_BASE_URL}/?apikey=${OMDB_API_KEY}&i=${encodeURIComponent(first.imdbID)}&plot=full`;
        data = await fetchJsonWithRetry(byIdUrl, 4, perRequestDelay);
        if (data && data.Response && data.Response === 'True') return data;
        return null;
      } catch (e) {
        console.error('fetchOmdbFull error for', title, e.message || e);
        throw e;
      }
    }

    // Import movies (try up to requested count or list length)
    for (let i = 0; i < Math.min(maxPerType, popularMovies.length); i++) {
      const movieTitle = popularMovies[i];
      try {
        const movie = await fetchOmdbFull(movieTitle, 'movie');
        if (!movie) {
          console.log(`Movie not found: ${movieTitle}`);
          notFoundMovies.push(movieTitle);
          await new Promise(resolve => setTimeout(resolve, 120));
          continue;
        }

        // Check if movie already exists
        const existing = await env.db.prepare(
          'SELECT id FROM movies WHERE title = ? AND media_type = ?'
        ).bind(movie.Title, 'movie').first();

        if (!existing) {
          // normalize release date: OMDb uses Released (e.g. "14 Oct 1994") or Year
          let release = null;
          if (movie.Released && movie.Released !== 'N/A') release = movie.Released;
          else if (movie.Year && movie.Year !== 'N/A') release = movie.Year;

          await env.db.prepare(`
            INSERT INTO movies (title, release_date, media_type, genre, description, poster_url, trailer_url)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind(
            movie.Title,
            release,
            'movie',
            movie.Genre && movie.Genre !== 'N/A' ? movie.Genre.split(',')[0].trim() : 'Unknown',
            movie.Plot && movie.Plot !== 'N/A' ? movie.Plot : '',
            movie.Poster && movie.Poster !== 'N/A' ? movie.Poster : null,
            null
          ).run();

          moviesAdded++;
          console.log(`Added movie: ${movie.Title}`);
        }

        // polite delay between titles to reduce chance of rate limiting
        await new Promise(resolve => setTimeout(resolve, perRequestDelay));
      } catch (error) {
        console.error(`Error adding movie ${movieTitle}:`, error.message || error);
        errors.push({ title: movieTitle, error: (error && error.message) || String(error) });
      }
    }

    console.log('Fetching TV shows from OMDb (with fallback search)...');

    // Import series
    for (let i = 0; i < Math.min(maxPerType, popularSeries.length); i++) {
      const seriesTitle = popularSeries[i];
      try {
        const series = await fetchOmdbFull(seriesTitle, 'series');
        if (!series) {
          console.log(`Series not found: ${seriesTitle}`);
          notFoundSeries.push(seriesTitle);
          await new Promise(resolve => setTimeout(resolve, 120));
          continue;
        }

        const existing = await env.db.prepare(
          'SELECT id FROM movies WHERE title = ? AND media_type = ?'
        ).bind(series.Title, 'series').first();

        if (!existing) {
          // prefer Released, fallback to Year
          let release = null;
          if (series.Released && series.Released !== 'N/A') release = series.Released;
          else if (series.Year && series.Year !== 'N/A') release = series.Year;

          await env.db.prepare(`
            INSERT INTO movies (title, release_date, media_type, genre, description, poster_url, trailer_url)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind(
            series.Title,
            release,
            'series',
            series.Genre && series.Genre !== 'N/A' ? series.Genre.split(',')[0].trim() : 'Unknown',
            series.Plot && series.Plot !== 'N/A' ? series.Plot : '',
            series.Poster && series.Poster !== 'N/A' ? series.Poster : null,
            null
          ).run();

          seriesAdded++;
          console.log(`Added series: ${series.Title}`);
        }

        await new Promise(resolve => setTimeout(resolve, perRequestDelay));
      } catch (error) {
        console.error(`Error adding series ${seriesTitle}:`, error.message || error);
        errors.push({ title: seriesTitle, error: (error && error.message) || String(error) });
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      moviesAdded,
      seriesAdded,
      totalAdded: moviesAdded + seriesAdded,
      notFoundMoviesCount: notFoundMovies.length,
      notFoundSeriesCount: notFoundSeries.length,
      notFoundMovies,
      notFoundSeries,
      errors,
      message: `Imported ${moviesAdded} movies and ${seriesAdded} TV shows (not found: ${notFoundMovies.length} movies, ${notFoundSeries.length} series)`
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Import error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
