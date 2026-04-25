# Marketplace Project

## Local install
1. Run `npm install` in the project root.
2. Run `npm install` in `server/` if you still want to use the old nested server workflow locally.

## Local server
Run `npm run dev:server`

## Database
The project is ready for Neon. Put your Neon connection string into `server/.env` as `DATABASE_URL`.

Recommended env values:
- `DATABASE_URL=postgresql://USER:PASSWORD@YOUR-NEON-HOST.neon.tech/DBNAME?sslmode=require`
- `DATABASE_SSL=true`
- `APP_BASE_URL=https://your-site.netlify.app`
- `UPLOAD_STORAGE_MODE=inline`

## Migrations
- `npm run migrate`
- `npm run backfill`
- `npm run setup`

## Netlify
- Static files are published from the repository root.
- API requests from `/api/*` are rewritten to `netlify/functions/api.js`.
- In Netlify, add the same env variables from `server/.env.example`.

## Uploads
On Netlify, uploads use inline `data:` URLs so the app does not depend on a persistent filesystem. This is deployment-safe, but large images are not ideal; keeping product and avatar images compressed is recommended.
