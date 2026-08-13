# Project: Sokrates — Intellectual Matchmaking Platform

## Architecture
- **Frontend**: Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4, Zustand 5, Socket.io-client 4, React Flow 12.
- **Backend (REST)**: Next.js API Routes / App Router (`app/api/*`).
- **Backend (Real-Time)**: Express 5 + Socket.io 4 server (`server/index.ts`).
- **Database & Storage**: Supabase PostgreSQL 15 + `pgvector` extension (HNSW indexes), Supabase Auth, Prisma ORM 5.
- **Cache & Queue**: Upstash Redis (matchmaking queue, rate limiting, trending topics).
- **AI Integration**:
  - Gemini `text-embedding-004` (768-dim user profile interest & topic vector embeddings)
  - Gemini `2.0 Flash` (Discussion starters, post-chat digests, argument maps)
  - Groq `llama-3.3-70b-versatile` (Real-time 1-on-1 AI fallback partner streaming tokens over WebSockets)

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Audit & Database Schema | Audit existing code, refine Prisma schema (pgvector HNSW & GIN indexes), Supabase migration setup | None | IN_PROGRESS |
| M2 | Auth & Profiles (R1) | Supabase Auth, registration interest category picker, 768-dim Gemini embeddings generation & storage | M1 | PLANNED |
| M3 | Group Rooms & Real-time Chat (R2) | Feed page, group room creation, Socket.io WebSocket real-time chat, typing indicators, join requests | M1, M2 | PLANNED |
| M4 | 1-on-1 Matchmaking & Watchlist (R3) | Queue-based matchmaking, cosine similarity search via pgvector, system topic watchlist & live notifications | M1, M2, M3 | PLANNED |
| M5 | Real-time AI Fallback (R4) | 30s queue timeout trigger, Groq Llama-3.3 streaming AI fallback partner via WebSockets | M3, M4 | PLANNED |
| M6 | Post-Chat AI Digest & Argument Map (R5) | End-room trigger, Gemini 2.0 Flash async digest generation (3 sentences), JSON argument map graph (nodes/edges), React Flow rendering | M3, M4, M5 | PLANNED |
| M7 | Public Debates & Admin Dashboard (R6) | Public debate publishing feed (`/debates`), admin site stats, user suspension tools, room force-end controls, topic CRUD | M2, M3, M6 | PLANNED |
| M8 | E2E Integration & Forensic Audit | End-to-end testing suite (Tiers 1-5), performance/security verification, forensic integrity audit | M1-M7 | PLANNED |

## Interface Contracts

### Auth & Profiles
- `POST /api/auth/register`: `{ email, password, username, interestCategories: string[] }` -> returns `{ user, profile }`
- `GET /api/profile`: returns `{ id, username, avatarUrl, bio, interestCategories, vectorEmbedding }`
- `POST /api/profile/interests`: `{ interestCategories: string[] }` -> updates profile, generates Gemini `text-embedding-004` (768 Float array), stores vector in PostgreSQL.

### Matchmaking & Watchlist
- `POST /api/matchmaking/join`: `{ topicId: string }` -> places user in queue.
- `POST /api/matchmaking/leave`: `{ topicId: string }` -> removes user from queue.
- `GET /api/topics/watchlist`: returns user's watched topics.
- `POST /api/topics/[id]/watch`: toggles watch status for a topic.

### WebSocket Events (Express / Socket.io)
- Client -> Server: `join_room`, `leave_room`, `send_message`, `typing_start`, `typing_stop`, `request_join_room`, `respond_join_request`
- Server -> Client: `room_message`, `user_typing`, `join_request_received`, `match_found`, `ai_stream_token`, `ai_stream_end`, `room_ended`

### AI Processing
- `POST /api/rooms/[id]/end`: triggers room end, queues digest & argument map extraction.
- Argument Map Schema: `{ nodes: Array<{ id: string, type: 'claim'|'evidence'|'rebuttal'|'concession'|'agreement', label: string, participantId?: string }>, edges: Array<{ id: string, source: string, target: string, label?: string }> }`

## Code Layout
```
/
├── app/                  # Next.js App Router (pages & REST API routes)
│   ├── (auth)/           # Login, Register with Interest Picker
│   ├── (main)/           # Home Feed, Topics, Rooms, Debates, Admin
│   └── api/              # REST Endpoints (Auth, Profile, Topics, Matchmaking, AI)
├── components/           # UI Components (Chat, React Flow Argument Map, Room Card, Feed)
├── lib/                  # Shared utilities (Supabase, Gemini, Groq, Prisma client, Redis)
├── prisma/               # Database schema (`schema.prisma`) & migrations
├── server/               # Express + Socket.io Server for WebSockets & AI streaming
├── types/                # TypeScript type definitions
└── tests/                # E2E & Unit test suite
```
