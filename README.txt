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
- `CLOUDINARY_CLOUD_NAME=...`
- `CLOUDINARY_API_KEY=...`
- `CLOUDINARY_API_SECRET=...`
- `CLOUDINARY_FOLDER=dayenstore`

## Migrations
- `npm run migrate`
- `npm run backfill`
- `npm run setup`

## Netlify
- Static files are published from the repository root.
- API requests from `/api/*` are rewritten to `netlify/functions/api.js`.
- In Netlify, add the same env variables from `server/.env.example`.

## Uploads
If Cloudinary env variables are configured, uploads are stored in Cloudinary and the database keeps normal HTTPS image URLs.
If Cloudinary is not configured, the app falls back to inline `data:` URLs.
