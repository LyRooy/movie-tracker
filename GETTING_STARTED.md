# MovieTracker - Cloudflare D1 Edition

This branch contains the **Cloudflare D1 implementation only**. All Firebase-related code has been removed.

## Quick Start

### 1. Install Wrangler CLI
```bash
npm install -g wrangler
```

### 2. Login to Cloudflare
```bash
wrangler login
```

### 3. Create D1 Database
```bash
wrangler d1 create movie-tracker-db
```

Copy the `database_id` from the output and update it in `wrangler.toml`.

### 4. Apply Database Schema
```bash
# Local development
wrangler d1 execute movie-tracker-db --local --file=./cloudflare/schema.sql
wrangler d1 execute movie-tracker-db --local --file=./cloudflare/seed.sql

# Production
wrangler d1 execute movie-tracker-db --file=./cloudflare/schema.sql
wrangler d1 execute movie-tracker-db --file=./cloudflare/seed.sql
```

### 5. Start Development Server
```bash
wrangler dev
```

Your API will be available at `http://localhost:8787`

### 6. Deploy to Production
```bash
wrangler deploy
```

## Configuration

Edit `wrangler.toml` to configure:
- `database_id` - Your D1 database ID
- `JWT_SECRET` - Your JWT secret key
- `name` - Your Worker name (determines the URL)

## Documentation

- **README.md** - Overview and features
- **CLOUDFLARE_SETUP.md** - Detailed step-by-step setup guide
- **COMPARISON.md** - Comparison with Firebase implementation

## Architecture

```
Frontend (HTML/CSS/JS) → Cloudflare Worker (Hono.js) → D1 Database (SQLite)
                         ↓
                    300+ Edge Locations
```

## Why Cloudflare D1?

✅ **5-10x cheaper** than traditional databases  
✅ **Ultra-low latency** (5-20ms) globally  
✅ **SQL** - Standard SQLite queries  
✅ **No cold starts** - Always fast  
✅ **Serverless** - Zero infrastructure management  
✅ **One-command deploy**  

## Need Firebase Instead?

The Firebase implementation is available on the `copilot/create-firebase-database-schema` branch.

## Support

- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
