// Database schema inspection endpoint
export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method !== 'GET') {
    return new Response('Method not allowed - use GET', { status: 405 });
  }

  try {
    const tables = ['Users', 'Movies', 'Watched', 'Reviews', 'Challenges'];
    const schema = {};
    
    for (const tableName of tables) {
      const columns = await env.db.prepare(`PRAGMA table_info(${tableName})`).all();
      schema[tableName] = columns.results.map(col => ({
        name: col.name,
        type: col.type,
        nullable: !col.notnull,
        defaultValue: col.dflt_value,
        primaryKey: col.pk
      }));
    }

    return new Response(JSON.stringify(schema, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}