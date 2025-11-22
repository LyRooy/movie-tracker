// API endpoint for series episodes operations
export async function onRequest(context) {
  const { request, env, params } = context;
  const method = request.method;
  const seriesId = params.id;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    switch (method) {
      case 'GET':
        return handleGetEpisodes(env.db, userId, seriesId, corsHeaders);
      case 'POST':
        return handleMarkEpisode(env.db, userId, request, corsHeaders);
      default:
        return new Response('Method not allowed', { 
          status: 405,
          headers: corsHeaders 
        });
    }
  } catch (error) {
    console.error('[episodes] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Get all episodes for a series with user's watched status
async function handleGetEpisodes(db, userId, seriesId, corsHeaders) {
  // Get series info
  const series = await db.prepare('SELECT * FROM movies WHERE id = ? AND media_type = ?')
    .bind(seriesId, 'series')
    .first();

  if (!series) {
    return new Response(JSON.stringify({ error: 'Series not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Get all seasons with episodes
  const query = `
    SELECT 
      s.id as season_id,
      s.season_number,
      s.episode_count,
      s.title as season_title,
      e.id as episode_id,
      e.episode_number,
      e.title as episode_title,
      e.description,
      e.air_date,
      e.duration,
      uew.watched_date,
      CASE WHEN uew.id IS NOT NULL THEN 1 ELSE 0 END as is_watched
    FROM seasons s
    LEFT JOIN episodes e ON s.id = e.season_id
    LEFT JOIN user_episodes_watched uew ON e.id = uew.episode_id AND uew.user_id = ?
    WHERE s.series_id = ?
    ORDER BY s.season_number, e.episode_number
  `;

  const result = await db.prepare(query).bind(userId, seriesId).all();

  // Group episodes by season
  const seasonsMap = new Map();
  
  for (const row of result.results) {
    if (!seasonsMap.has(row.season_id)) {
      seasonsMap.set(row.season_id, {
        id: row.season_id,
        seasonNumber: row.season_number,
        episodeCount: row.episode_count,
        title: row.season_title,
        episodes: []
      });
    }

    if (row.episode_id) {
      seasonsMap.get(row.season_id).episodes.push({
        id: row.episode_id,
        episodeNumber: row.episode_number,
        title: row.episode_title,
        description: row.description,
        airDate: row.air_date,
        duration: row.duration,
        isWatched: row.is_watched === 1,
        watchedDate: row.watched_date
      });
    }
  }

  const seasons = Array.from(seasonsMap.values());

  // Calculate progress
  const totalEpisodes = seasons.reduce((sum, s) => sum + s.episodes.length, 0);
  const watchedEpisodes = seasons.reduce((sum, s) => 
    sum + s.episodes.filter(e => e.isWatched).length, 0
  );

  return new Response(JSON.stringify({
    series: {
      id: series.id,
      title: series.title,
      totalSeasons: series.total_seasons,
      totalEpisodes: series.total_episodes
    },
    seasons,
    progress: {
      total: totalEpisodes,
      watched: watchedEpisodes,
      percentage: totalEpisodes > 0 ? Math.round((watchedEpisodes / totalEpisodes) * 100) : 0
    }
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Mark episode as watched/unwatched
async function handleMarkEpisode(db, userId, request, corsHeaders) {
  const data = await request.json();
  const { episodeId, watched, markPreviousAsWatched } = data;

  if (!episodeId) {
    return new Response(JSON.stringify({ error: 'Episode ID is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    // Get episode info to find series and check if we need to mark previous episodes
    const episodeInfo = await db.prepare(`
      SELECT e.id, e.season_id, e.episode_number, s.season_number, s.series_id
      FROM episodes e
      JOIN seasons s ON e.season_id = s.id
      WHERE e.id = ?
    `).bind(episodeId).first();

    if (!episodeInfo) {
      return new Response(JSON.stringify({ error: 'Episode not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const seriesId = episodeInfo.series_id;

    if (watched) {
      // Check if there are unwatched previous episodes
      const unwatchedPrevious = await db.prepare(`
        SELECT COUNT(*) as count
        FROM episodes e
        JOIN seasons s ON e.season_id = s.id
        WHERE s.series_id = ?
        AND (
          s.season_number < ? 
          OR (s.season_number = ? AND e.episode_number < ?)
        )
        AND NOT EXISTS (
          SELECT 1 FROM user_episodes_watched uew 
          WHERE uew.episode_id = e.id AND uew.user_id = ?
        )
      `).bind(seriesId, episodeInfo.season_number, episodeInfo.season_number, episodeInfo.episode_number, userId).first();

      // If markPreviousAsWatched is true or if it's undefined and there are previous unwatched episodes, mark them
      if (markPreviousAsWatched && unwatchedPrevious.count > 0) {
        const watchedDate = new Date().toISOString().split('T')[0];
        
        // Mark all previous episodes as watched
        const previousEpisodes = await db.prepare(`
          SELECT e.id
          FROM episodes e
          JOIN seasons s ON e.season_id = s.id
          WHERE s.series_id = ?
          AND (
            s.season_number < ? 
            OR (s.season_number = ? AND e.episode_number < ?)
          )
        `).bind(seriesId, episodeInfo.season_number, episodeInfo.season_number, episodeInfo.episode_number).all();

        for (const ep of previousEpisodes.results) {
          const existing = await db.prepare(
            'SELECT id FROM user_episodes_watched WHERE user_id = ? AND episode_id = ?'
          ).bind(userId, ep.id).first();

          if (!existing) {
            await db.prepare(`
              INSERT INTO user_episodes_watched (user_id, episode_id, watched_date)
              VALUES (?, ?, ?)
            `).bind(userId, ep.id, watchedDate).run();
          }
        }
      }

      // Mark current episode as watched
      const watchedDate = new Date().toISOString().split('T')[0];
      const existing = await db.prepare(
        'SELECT id FROM user_episodes_watched WHERE user_id = ? AND episode_id = ?'
      ).bind(userId, episodeId).first();

      if (!existing) {
        await db.prepare(`
          INSERT INTO user_episodes_watched (user_id, episode_id, watched_date)
          VALUES (?, ?, ?)
        `).bind(userId, episodeId, watchedDate).run();
      }
    } else {
      // Mark as unwatched
      await db.prepare(
        'DELETE FROM user_episodes_watched WHERE user_id = ? AND episode_id = ?'
      ).bind(userId, episodeId).run();
    }

    // Update series status in watched table based on completion
    await updateSeriesStatus(db, userId, seriesId);

    // Return info about unwatched previous episodes for frontend to show prompt
    const stillUnwatchedPrevious = await db.prepare(`
      SELECT COUNT(*) as count
      FROM episodes e
      JOIN seasons s ON e.season_id = s.id
      WHERE s.series_id = ?
      AND (
        s.season_number < ? 
        OR (s.season_number = ? AND e.episode_number < ?)
      )
      AND NOT EXISTS (
        SELECT 1 FROM user_episodes_watched uew 
        WHERE uew.episode_id = e.id AND uew.user_id = ?
      )
    `).bind(seriesId, episodeInfo.season_number, episodeInfo.season_number, episodeInfo.episode_number, userId).first();

    return new Response(JSON.stringify({ 
      success: true,
      hasPreviousUnwatched: watched && !markPreviousAsWatched && stillUnwatchedPrevious.count > 0,
      previousUnwatchedCount: stillUnwatchedPrevious.count
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error marking episode:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Update series status based on watched episodes
async function updateSeriesStatus(db, userId, seriesId) {
  // Get total episodes count
  const totalEpisodes = await db.prepare(`
    SELECT COUNT(*) as count
    FROM episodes e
    JOIN seasons s ON e.season_id = s.id
    WHERE s.series_id = ?
  `).bind(seriesId).first();

  // Get watched episodes count
  const watchedEpisodes = await db.prepare(`
    SELECT COUNT(*) as count
    FROM user_episodes_watched uew
    JOIN episodes e ON uew.episode_id = e.id
    JOIN seasons s ON e.season_id = s.id
    WHERE s.series_id = ? AND uew.user_id = ?
  `).bind(seriesId, userId).first();

  const watchedDate = new Date().toISOString().split('T')[0];

  // Check if record exists in watched table
  const existingWatched = await db.prepare(
    'SELECT id, status FROM watched WHERE user_id = ? AND movie_id = ?'
  ).bind(userId, seriesId).first();

  if (watchedEpisodes.count === 0) {
    // No episodes watched - remove from watched table or set to planning
    if (existingWatched) {
      await db.prepare(
        'DELETE FROM watched WHERE user_id = ? AND movie_id = ?'
      ).bind(userId, seriesId).run();
    }
  } else if (watchedEpisodes.count === totalEpisodes.count) {
    // All episodes watched - mark as 'watched'
    if (existingWatched) {
      await db.prepare(`
        UPDATE watched 
        SET status = 'watched', watched_date = ?
        WHERE user_id = ? AND movie_id = ?
      `).bind(watchedDate, userId, seriesId).run();
    } else {
      await db.prepare(`
        INSERT INTO watched (user_id, movie_id, watched_date, status)
        VALUES (?, ?, ?, 'watched')
      `).bind(userId, seriesId, watchedDate).run();
    }
  } else {
    // Some episodes watched - mark as 'watching'
    if (existingWatched) {
      await db.prepare(`
        UPDATE watched 
        SET status = 'watching', watched_date = ?
        WHERE user_id = ? AND movie_id = ?
      `).bind(watchedDate, userId, seriesId).run();
    } else {
      await db.prepare(`
        INSERT INTO watched (user_id, movie_id, watched_date, status)
        VALUES (?, ?, ?, 'watching')
      `).bind(userId, seriesId, watchedDate).run();
    }
  }
}

// Extract user ID from Authorization header
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
