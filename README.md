# DevCollab — AI-Powered Code Review Platform

A full-stack collaborative code review platform with real-time comments, AI-assisted feedback, and GitHub integration. Built as a portfolio project to demonstrate modern software engineering skills.

![Tech Stack](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=nextdotjs&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)

---

## What is DevCollab?

DevCollab lets developers review GitHub pull requests with real-time inline comments and instant AI-generated code feedback. Think of it as a lightweight GitHub code review interface with an AI reviewer built in.

**Live demo:** _coming soon_

---

## Features

- **GitHub OAuth login** — sign in with your GitHub account, no passwords stored
- **Repository browser** — lists all your GitHub repos pulled live from the GitHub API
- **Pull request viewer** — view open/closed PRs with a colour-coded diff viewer (green additions, red deletions)
- **AI code review** — click "Run AI Review" on any PR to get instant structured feedback powered by Groq (Llama 3 70B), streamed live character by character
- **Real-time inline comments** — comment on specific files in a PR; all viewers see new comments instantly via WebSocket without refreshing
- **Review submissions** — approve a PR or request changes, just like GitHub
- **Analytics dashboard** — charts showing review activity, PR stats, and AI suggestion breakdowns
- **Persistent storage** — all reviews, comments, and AI suggestions saved to PostgreSQL

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React, TypeScript, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL with Prisma ORM |
| Caching & realtime | Redis + Socket.io (WebSockets) |
| AI | Groq API — Llama 3 70B (streaming) |
| Auth | GitHub OAuth 2.0 + JWT |
| Monorepo | Turborepo |
| DevOps | Docker Compose, GitHub Actions CI/CD |

---

## Architecture

```
devcollab/
├── apps/
│   ├── web/          ← Next.js 14 frontend        (port 3000)
│   └── api/          ← Express REST + WebSocket    (port 4000)
├── packages/
│   ├── types/        ← Shared TypeScript types
│   └── config/       ← Shared ESLint / Tailwind config
├── docker-compose.yml
└── turbo.json
```

**Key architectural decisions:**
- **WebSockets over polling** — Socket.io keeps a persistent connection per PR room. Redis pub/sub fans out comment events across multiple server instances, making the architecture horizontally scalable.
- **Streaming AI responses** — the backend opens a Server-Sent Events (SSE) stream to the frontend, piping Groq API chunks through in real time so the review appears word by word.
- **Prisma ORM** — type-safe database queries with automatic migration tracking. Schema changes are versioned and reproducible.
- **Monorepo with Turborepo** — frontend and backend share TypeScript types from a shared package, with cached builds across workspaces.

---

## Getting started locally

### Prerequisites
- Node.js 18+
- Docker Desktop
- A GitHub OAuth App ([create one here](https://github.com/settings/developers))
- A Groq API key ([free at console.groq.com](https://console.groq.com))

### Setup

```bash
# 1. Clone and install
git clone https://github.com/AqeelAroos/devcollab.git
cd devcollab
npm install

# 2. Start PostgreSQL + Redis
docker-compose up -d

# 3. Set up environment variables
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# Fill in GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GROQ_API_KEY, JWT_SECRET

# 4. Run database migrations
cd apps/api
npm run db:migrate
npm run db:generate
cd ../..

# 5. Start the app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### GitHub OAuth setup
1. Go to GitHub → Settings → Developer Settings → OAuth Apps → New OAuth App
2. Homepage URL: `http://localhost:3000`
3. Callback URL: `http://localhost:4000/api/auth/github/callback`
4. Copy Client ID and Secret into `apps/api/.env`

---

## API reference

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/auth/github` | Start GitHub OAuth flow | — |
| GET | `/api/auth/me` | Get current user | ✓ |
| GET | `/api/repos` | List user's GitHub repos | ✓ |
| GET | `/api/prs/:owner/:repo` | List pull requests | ✓ |
| GET | `/api/prs/:owner/:repo/:number` | Get PR with diff | ✓ |
| GET | `/api/comments/pr/:id` | Get PR comments | ✓ |
| POST | `/api/comments` | Post a comment | ✓ |
| DELETE | `/api/comments/:id` | Delete own comment | ✓ |
| POST | `/api/reviews` | Submit review (approve/changes) | ✓ |
| POST | `/api/ai/review` | Stream AI code review | ✓ |
| GET | `/api/ai/suggestions/:prId` | Get saved AI suggestions | ✓ |
| POST | `/api/webhooks/github` | GitHub webhook receiver | — |

---

## Database schema

```
users           — GitHub OAuth profiles
repositories    — synced repo metadata
pull_requests   — PR data cached from GitHub API
reviews         — approve / request changes submissions
comments        — inline PR comments with file + line info
ai_suggestions  — parsed AI review results per file/line
notifications   — user notification feed
```

---

## Running tests

```bash
cd apps/api
npm run test
```

Integration tests cover auth, repos, comments, and AI routes using Jest + Supertest with mocked external APIs.

---

## Deployment

Designed to deploy on:
- **Frontend** → [Vercel](https://vercel.com) (free)
- **Backend + DB + Redis** → [Railway](https://railway.app) (free tier)

CI/CD pipeline runs on every push via GitHub Actions — lints, tests, and is ready to add auto-deploy steps.

---

## What I learned building this

- Designing a **real-time multi-user system** using WebSockets and Redis pub/sub for horizontal scalability
- **Streaming API responses** from an LLM through a backend SSE endpoint to a React frontend
- **GitHub OAuth 2.0** flow and securely storing/refreshing access tokens
- **Monorepo architecture** with Turborepo — shared types, cached builds, unified dev server
- **Docker Compose** for local development parity with production infrastructure
- Writing **integration tests** with Supertest against a real test database

---

## Author

**Aqeel Aroos** — [github.com/AqeelAroos](https://github.com/AqeelAroos)
