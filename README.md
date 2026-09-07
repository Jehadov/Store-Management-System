# Restaurant-Backend - DB setup

## Option A: Docker (recommended, 1 command)

1. Start Docker Desktop (it was stopped when checked).
2. Run:
```bash
cd Restaurant-Backend
docker compose up -d db
cd server
copy .env.example .env
npm i
npm run db:migrate
npm run dev  # :4000, GET /api/health -> {ok:true}
```

## Option B: Local Postgres (no Docker)

1. Install PostgreSQL 16 (EDB installer, default port 5432, user `postgres`).
2. Create db: `createdb -U postgres restaurant` (or via pgAdmin).
3. Same as above from `copy .env.example .env` onwards. Edit `DATABASE_URL` if password differs.

## Seed first admin + test

```bash
curl -X POST localhost:4000/api/auth/seed -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"admin123\"}"
curl -X POST localhost:4000/api/auth/login -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"admin123\"}"
```
