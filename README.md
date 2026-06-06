# DevCollab

AI-powered real-time code review platform. Built with Next.js, Node.js, PostgreSQL, Redis, WebSockets, and Claude AI.

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14, React, TypeScript, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Cache / realtime | Redis + Socket.io |
| AI | Anthropic Claude API (streaming) |
| Auth | GitHub OAuth + JWT |
| DevOps | Docker Compose, GitHub Actions |

## Project structure

```
devcollab/
├── apps/
│   ├── web/          ← Next.js frontend (port 3000)
│   └── api/          ← Express backend (port 4000)
├── packages/
│   ├── db/           ← Shared Prisma types (future)
│   ├── types/        ← Shared TypeScript types
│   └── config/       ← Shared ESLint/Tailwind config
├── docker-compose.yml
└── turbo.json
```

## Getting started

### 1. Prerequisites

- Node.js 18+
- Docker Desktop
- A GitHub OAuth App ([create one here](https://github.com/settings/developers))
- An Anthropic API key ([get one here](https://console.anthropic.com))

### 2. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/devcollab.git
cd devcollab
npm install
```

### 3. Set up environment variables

```bash
# API
cp apps/api/.env.example apps/api/.env
# Fill in: DATABASE_URL, REDIS_URL, JWT_SECRET, GITHUB_CLIENT_ID,
#          GITHUB_CLIENT_SECRET, ANTHROPIC_API_KEY

# Web
cp apps/web/.env.example apps/web/.env.local
```

### 4. Start infrastructure

```bash
docker-compose up -d
# Starts PostgreSQL on :5432 and Redis on :6379
```

### 5. Set up database

```bash
cd apps/api
npm run db:migrate    # Creates tables
npm run db:generate   # Generates Prisma client
```

### 6. Run the app

```bash
# From root — runs both frontend and backend
npm run dev

# Frontend: http://localhost:3000
# Backend:  http://localhost:4000
```

## GitHub OAuth setup

1. Go to GitHub → Settings → Developer Settings → OAuth Apps → New OAuth App
2. Set **Homepage URL** to `http://localhost:3000`
3. Set **Authorization callback URL** to `http://localhost:4000/api/auth/github/callback`
4. Copy Client ID and Client Secret into `apps/api/.env`

## Key features to build (phases)

- [x] Project scaffold + monorepo
- [x] GitHub OAuth + JWT auth
- [x] Prisma schema (users, repos, PRs, reviews, comments, AI suggestions)
- [x] REST API (auth, repos, PRs, reviews, comments, AI, webhooks)
- [x] WebSocket real-time comments
- [x] AI code review with streaming (Claude API)
- [ ] PR diff viewer UI
- [ ] Inline comment threads UI
- [ ] Analytics dashboard
- [ ] Notifications

## API routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/auth/github | Start GitHub OAuth |
| GET | /api/auth/github/callback | OAuth callback |
| GET | /api/auth/me | Get current user |
| GET | /api/repos | List user repos |
| GET | /api/repos/:owner/:repo | Get single repo |
| GET | /api/prs/:owner/:repo | List PRs |
| GET | /api/prs/:owner/:repo/:number | Get PR + diff |
| GET | /api/comments/pr/:id | Get PR comments |
| POST | /api/comments | Post comment |
| POST | /api/reviews | Submit review |
| POST | /api/ai/review | Stream AI review |
| GET | /api/ai/suggestions/:prId | Get AI suggestions |
| POST | /api/webhooks/github | GitHub webhook |

## Running tests

```bash
npm run test
```

## Deployment

The app is designed to deploy on Railway or Render:
- `apps/api` → Web Service (Node.js)
- `apps/web` → Static Site / Web Service (Next.js)
- PostgreSQL → Managed database
- Redis → Redis add-on
